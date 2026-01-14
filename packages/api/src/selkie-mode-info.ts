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

export type ContextLevel = 'minimal' | 'standard' | 'full';

export interface SelkieModeConfig {
  enabled: boolean;
  apiEndpoint: string;
  apiKey: string;
  model: string;
  confirmDestructive: boolean;
  maxTokens: number;
  maxSteps: number;
  contextLevel: ContextLevel;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string; // Function name for tool responses (required by some APIs like Gemini)
  timestamp: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string }; // For array types
      }
    >;
    required?: string[];
    additionalProperties?: boolean;
  };
  strict?: boolean; // OpenAI structured outputs mode
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AICompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string; // For tool responses (Gemini compatibility)
  }>;
  tools?: Array<{
    type: 'function';
    function: ToolDefinition;
    strict?: boolean; // OpenAI structured outputs
  }>;
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  parallel_tool_calls?: boolean; // Control parallel tool execution
  max_tokens?: number;
  stream?: boolean;
}

export interface AICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}
