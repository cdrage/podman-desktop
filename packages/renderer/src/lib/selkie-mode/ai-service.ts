/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type {
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  ChatMessage,
  ContextLevel,
  SelkieModeConfig,
  ToolCall,
  ToolDefinition,
} from '/@api/selkie-mode-info';

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: 'AUTH_ERROR' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_RESPONSE' | 'ABORTED',
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIService {
  private abortController: AbortController | null = null;

  constructor(private config: SelkieModeConfig) {}

  updateConfig(config: SelkieModeConfig): void {
    this.config = config;
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream?: (content: string) => void,
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    this.abortController = new AbortController();

    const apiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
      ...(msg.toolName && { name: msg.toolName }), // Required by Gemini and some other APIs
    }));

    // Build tools with additionalProperties: false for better schema compliance
    // This helps all models follow the schema more strictly
    const enhancedTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        ...t,
        parameters: {
          ...t.parameters,
          additionalProperties: false,
        },
      },
    }));

    // Use 'auto' for compatibility - 'required' isn't supported by all providers
    // The code detects protocol violations (plain text questions) as a fallback
    const request: AICompletionRequest = {
      model: this.config.model,
      messages: apiMessages,
      tools: enhancedTools,
      tool_choice: 'auto',
      max_tokens: this.config.maxTokens,
      stream: !!onStream,
    };

    try {
      // Handle both base URLs and full paths (in case user includes /chat/completions)
      let endpoint = this.config.apiEndpoint.replace(/\/+$/, ''); // Remove trailing slashes
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = `${endpoint}/chat/completions`;
      }

      // Log request
      console.log('%c[Selkie Mode] Request', 'color: #a855f7; font-weight: bold');
      console.log('Endpoint:', endpoint);
      console.log('Model:', this.config.model);
      console.log('Messages:', apiMessages);
      console.log(
        'Tools:',
        tools.map(t => t.name),
      );
      console.log('Full request body:', JSON.stringify(request, null, 2));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new AIServiceError('Authentication failed. Check your API key.', 'AUTH_ERROR');
        }
        if (response.status === 429) {
          throw new AIServiceError('Rate limit exceeded. Please wait and try again.', 'RATE_LIMIT', true);
        }
        throw new AIServiceError(`API error: ${response.status} - ${errorText}`, 'INVALID_RESPONSE');
      }

      if (onStream && response.body) {
        return this.handleStreamResponse(response.body, onStream);
      }

      const data: AICompletionResponse = await response.json();
      const message = data.choices[0]?.message;
      const finishReason = data.choices[0]?.finish_reason ?? '';

      // Log full response for debugging
      console.log('%c[Selkie Mode] Response', 'color: #22c55e; font-weight: bold');
      console.log('Full response:', data);
      console.log('Content:', message?.content ?? '(none)');
      console.log('Tool Calls:', message?.tool_calls ?? '(none)');
      console.log('Finish Reason:', finishReason);

      // Handle Gemini-specific errors
      if (finishReason.includes('MALFORMED_FUNCTION_CALL')) {
        throw new AIServiceError(
          'Model generated invalid function call. This model may not fully support tool use. Try GPT-4 or Claude.',
          'INVALID_RESPONSE',
        );
      }

      // Handle safety filter
      if (finishReason.includes('SAFETY') || finishReason.includes('BLOCKED')) {
        throw new AIServiceError('Response blocked by safety filter.', 'INVALID_RESPONSE');
      }

      // Handle case where model returns empty response
      if (!message?.content && !message?.tool_calls) {
        console.warn('[Selkie Mode] Model returned empty response');
        throw new AIServiceError('Model returned empty response. Try rephrasing your request.', 'INVALID_RESPONSE');
      }

      return {
        content: message?.content ?? '',
        toolCalls: message?.tool_calls,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError('Request was cancelled', 'ABORTED');
      }
      throw new AIServiceError(`Network error: ${error}`, 'NETWORK', true);
    }
  }

  private async handleStreamResponse(
    body: ReadableStream<Uint8Array>,
    onStream: (content: string) => void,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    const toolCalls: Map<number, ToolCall> = new Map();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk: AIStreamChunk = JSON.parse(trimmed.slice(6));
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              onStream(delta.content);
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index);
                if (existing) {
                  if (tc.function?.arguments) {
                    existing.function.arguments += tc.function.arguments;
                  }
                } else if (tc.id && tc.function?.name) {
                  toolCalls.set(tc.index, {
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments ?? '',
                    },
                  });
                }
              }
            }
          } catch {
            // Ignore parse errors for individual chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.size > 0 ? Array.from(toolCalls.values()) : undefined,
    };
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

export async function loadAIConfig(): Promise<SelkieModeConfig> {
  const [enabled, apiEndpoint, apiKey, model, confirmDestructive, maxTokens, maxSteps, contextLevel] =
    await Promise.all([
      window.getConfigurationValue<boolean>('selkie.mode.enabled', 'DEFAULT'),
      window.getConfigurationValue<string>('selkie.mode.apiEndpoint', 'DEFAULT'),
      window.getConfigurationValue<string>('selkie.mode.apiKey', 'DEFAULT'),
      window.getConfigurationValue<string>('selkie.mode.model', 'DEFAULT'),
      window.getConfigurationValue<boolean>('selkie.mode.confirmDestructive', 'DEFAULT'),
      window.getConfigurationValue<number>('selkie.mode.maxTokens', 'DEFAULT'),
      window.getConfigurationValue<number>('selkie.mode.maxSteps', 'DEFAULT'),
      window.getConfigurationValue<ContextLevel>('selkie.mode.contextLevel', 'DEFAULT'),
    ]);

  return {
    enabled: enabled ?? false,
    apiEndpoint: apiEndpoint ?? 'https://openrouter.ai/api/v1',
    apiKey: apiKey ?? '',
    model: model ?? 'anthropic/claude-sonnet-4',
    confirmDestructive: confirmDestructive ?? true,
    maxTokens: maxTokens ?? 4096,
    maxSteps: maxSteps ?? 30,
    contextLevel: contextLevel ?? 'standard',
  };
}
