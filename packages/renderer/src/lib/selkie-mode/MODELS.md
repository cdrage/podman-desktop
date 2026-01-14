# Selkie Mode - Model Compatibility Guide

Selkie Mode uses OpenAI-compatible function calling to automate Podman Desktop. This guide covers which models work best and how to configure them.

## What Standard Does Selkie Mode Use?

Selkie Mode uses the **OpenAI Chat Completions API** with **function calling** (also called "tool use"). This has become the de-facto industry standard that most AI providers now support.

### The API Format

```
POST /v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [...],
  "tools": [{ "type": "function", "function": { "name": "...", "parameters": {...} } }],
  "tool_choice": "auto"
}
```

When a model supports this format, it can return structured function calls instead of plain text:

```json
{
  "choices": [{
    "message": {
      "tool_calls": [{
        "function": { "name": "click_element", "arguments": "{\"element\": \"Pull\"}" }
      }]
    }
  }]
}
```

### Official Documentation

| Provider | Documentation |
|----------|--------------|
| **OpenAI** | [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) |
| **OpenAI** | [Structured Outputs (strict mode)](https://platform.openai.com/docs/guides/structured-outputs) |
| **Anthropic** | [Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) |
| **Google** | [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) |
| **Together.ai** | [Function Calling](https://docs.together.ai/docs/function-calling) |
| **OpenRouter** | [API Reference](https://openrouter.ai/docs/requests) |

### What to Look For in a Model

When evaluating if a model will work with Selkie Mode, check for:

1. **"Function calling" or "Tool use" support**
   - The model must be able to output structured function calls
   - Look for phrases like "supports function calling", "tool use", or "structured outputs"

2. **OpenAI API compatibility**
   - The provider must expose a `/v1/chat/completions` endpoint
   - Must accept `tools` array in the request
   - Must return `tool_calls` in the response

3. **Model size (parameters)**
   - Models < 7B parameters: Usually cannot follow function schemas reliably
   - Models 7B-30B: May work for simple tasks, unreliable for complex ones
   - Models 30B-70B: Generally reliable
   - Models 70B+: Best reliability

4. **Instruction-tuned / Chat variant**
   - Use "instruct" or "chat" variants, not base models
   - Example: `llama-3.1-70b-instruct` not `llama-3.1-70b`

### Key Features to Check

| Feature | What It Means | Who Supports It |
|---------|---------------|-----------------|
| `tools` parameter | Basic function calling | Most providers |
| `tool_choice: "required"` | Force model to use tools | OpenAI, OpenRouter, Together |
| `tool_choice: {"function": {...}}` | Force specific function | OpenAI, some others |
| `strict: true` | Guaranteed schema compliance | OpenAI GPT-4o only |
| `parallel_tool_calls` | Multiple tools per response | OpenAI, some others |

### Why Some Models Fail

Common reasons a model won't work well:

1. **No function calling support** - Base models or older chat models
2. **Weak instruction following** - Model ignores the schema and hallucinates parameters
3. **Text-only responses** - Model returns explanations instead of tool calls
4. **Malformed JSON** - Model outputs invalid JSON in function arguments
5. **Wrong parameter types** - Model sends strings instead of booleans, etc.

### Why Some Small Models Work Better Than Expected

The parameter count guidelines above are general rules. Some smaller models work surprisingly well because:

1. **Specialized fine-tuning** - Models fine-tuned specifically for function calling/tool use
2. **Distillation** - "Flash" or "mini" variants trained to mimic larger models' behavior
3. **Architecture optimizations** - Mixture-of-experts (MoE) models are larger than they appear
4. **Provider enhancements** - Some providers (like OpenRouter) may add post-processing

**Examples of smaller models that may work:**
- `xiaomi/mimo-v2-flash` - Optimized for structured outputs
- `gpt-4o-mini` - Heavily distilled from GPT-4o, retains function calling ability
- MoE models (Mixtral) - 8x7B = effectively much larger for inference

**How to test a new model:**
1. Try a simple command: "Navigate to the containers page"
2. Check the browser console for the response
3. If it returns `tool_calls` with valid JSON, it works
4. If it returns text like "I'll navigate to...", it won't work

## Quick Recommendations

| Use Case | Model | Endpoint |
|----------|-------|----------|
| Best overall (default) | `anthropic/claude-sonnet-4` | `https://openrouter.ai/api/v1` |
| Fast & cheap | `google/gemini-2.0-flash-001` | `https://openrouter.ai/api/v1` |
| Budget-friendly | `openai/gpt-4o-mini` | `https://openrouter.ai/api/v1` |
| Privacy-focused | `meta-llama/llama-3.1-70b-instruct` | `https://openrouter.ai/api/v1` |
| Free tier (coding) | `mistralai/devstral-2512:free` | `https://openrouter.ai/api/v1` |
| Free tier (general) | `xiaomi/mimo-v2-flash:free` | `https://openrouter.ai/api/v1` |

## Model Compatibility Matrix

| Model | Function Calling | Reliability | Speed | Cost |
|-------|-----------------|-------------|-------|------|
| **Claude Sonnet 4** | Excellent | Excellent | Fast | $$ |
| **Claude 3.5 Sonnet** | Excellent | Excellent | Fast | $$ |
| **GPT-4o** | Excellent | Excellent | Fast | $$$ |
| **GPT-4o-mini** | Excellent | Very Good | Very Fast | $ |
| **Gemini 2.0 Flash** | Very Good | Good | Very Fast | $ |
| **Gemini 1.5 Pro** | Good | Good | Fast | $$ |
| **Devstral (free)** | Good | Good | Fast | Free |
| **MiMo V2 Flash (free)** | Good | Good | Very Fast | Free |
| **Llama 3.1 405B** | Good | Good | Medium | $$ |
| **Llama 3.1 70B** | Good | Fair | Fast | $ |
| **Mistral Large** | Fair | Fair | Fast | $$ |

### Legend
- **Function Calling**: How well the model generates valid tool calls
- **Reliability**: How consistently the model follows instructions
- **Cost**: Relative cost per task ($ = cheapest, $$$$ = most expensive)

## Provider Setup

### OpenRouter (Recommended - Default)

Access all major models through one API. This is the default provider.

```
Endpoint: https://openrouter.ai/api/v1
API Key: sk-or-...
Model: anthropic/claude-sonnet-4
```

**Recommended models:**
- `anthropic/claude-sonnet-4` - Best overall (default)
- `anthropic/claude-3.5-sonnet` - Excellent, slightly older
- `google/gemini-2.0-flash-001` - Fast and cheap
- `google/gemini-2.0-flash-exp:free` - Free tier option
- `openai/gpt-4o` - OpenAI's best
- `openai/gpt-4o-mini` - Budget OpenAI option
- `meta-llama/llama-3.1-70b-instruct` - Open source

**Note:** Model names include provider prefix (e.g., `anthropic/claude-sonnet-4`)

Get an API key at: https://openrouter.ai/keys

### OpenAI (Direct)

```
Endpoint: https://api.openai.com/v1
API Key: sk-...
Model: gpt-4o
```

**Supported models:**
- `gpt-4o` - Best for complex tasks
- `gpt-4o-mini` - Good balance of cost/performance

### Together.ai

Best for open-source models.

```
Endpoint: https://api.together.ai/v1
API Key: ...
Model: meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
```

**Recommended models:**
- `meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo` - Most capable
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` - Good balance
- `mistralai/Mixtral-8x22B-Instruct-v0.1` - Fast alternative

### Azure OpenAI

For enterprise deployments.

```
Endpoint: https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT
API Key: ...
Model: gpt-4o
```

**Note:** The endpoint should include your deployment name. The model field should match your deployment's model.

### Google AI (Gemini)

Via OpenAI-compatible endpoint.

```
Endpoint: https://generativelanguage.googleapis.com/v1beta/openai
API Key: ... (Google AI API key)
Model: gemini-1.5-pro
```

**Caveats:**
- May return `MALFORMED_FUNCTION_CALL` errors
- Less reliable tool calling than GPT-4o
- Works but not recommended for complex tasks

## Troubleshooting

### "Model returned empty response"
- The model didn't generate any tool calls
- Try a more capable model (GPT-4o recommended)
- Check if your prompt is clear

### "MALFORMED_FUNCTION_CALL" (Gemini)
- Gemini sometimes generates invalid function calls
- Switch to GPT-4o or Claude for better reliability

### "AI did not call task_complete"
- Model returned text instead of tool calls
- This model may not support function calling well
- Use GPT-4o, GPT-4o-mini, or Claude 3.5 Sonnet

### Model seems slow
- GPT-4o-mini is faster than GPT-4o
- Local models depend on your hardware
- Consider using a faster provider (Together.ai is fast)

### High token usage
- The system prompt is ~2000 tokens
- Each action returns page state (~500-2000 tokens)
- Complex tasks may use 10,000+ tokens
- Use GPT-4o-mini for cost savings
- **Use the Context Level setting** to control history size (see below)

## Cost Estimation

Approximate cost per typical task (e.g., "pull an image and run a container"):

| Model | Estimated Cost |
|-------|---------------|
| GPT-4o-mini | $0.01 - $0.03 |
| GPT-4o | $0.05 - $0.15 |
| Claude 3.5 Sonnet | $0.03 - $0.10 |
| Llama 3.1 70B (Together) | $0.01 - $0.03 |

## Context Level Setting

The **Context Level** setting controls how much conversation history is sent to the AI with each request. This directly affects token usage and cost.

### How LLM APIs Work

LLM APIs are **stateless** - they have no memory between requests. Every API call must include the full conversation history you want the model to "remember." This means:

- Turn 1: Send system prompt + user message (~3k tokens)
- Turn 5: Send system prompt + ALL previous messages (~15k tokens)
- Turn 10: Send system prompt + ALL previous messages (~30k tokens)

**You pay for the full context every single time.**

### Context Levels Explained

| Level | History Kept | Token Usage | Best For |
|-------|-------------|-------------|----------|
| **Minimal** | Last 2 exchanges | Lowest (~50% reduction) | Simple tasks, cost-sensitive usage |
| **Standard** | Last 6 exchanges | Balanced | Most tasks (default) |
| **Full** | Everything | Highest | Complex multi-step tasks requiring full history |

### What Gets Pruned

When using `minimal` or `standard`:
- The **original user request** is always kept
- **Recent tool calls and results** are kept (based on level)
- **Older tool results** (page content, etc.) are dropped

The AI still sees the current page state from recent actions, but loses context about earlier steps.

### When to Use Each Level

**Minimal** - Use when:
- Running simple, direct commands ("pull nginx image")
- Cost is a primary concern
- Using expensive models (GPT-4o, Claude)
- Tasks complete in 3-5 steps

**Standard** (default) - Use when:
- Running typical multi-step tasks
- You want a balance of cost and reliability
- Most everyday usage

**Full** - Use when:
- Running complex tasks (10+ steps)
- The AI needs to remember early decisions
- Debugging why the AI made certain choices
- Using cheap/local models where cost doesn't matter

### Example Token Savings

For a 10-step task with ~2000 tokens per tool result:

| Level | Approximate Total Tokens | Savings vs Full |
|-------|-------------------------|-----------------|
| Full | ~25,000 | - |
| Standard | ~15,000 | ~40% |
| Minimal | ~8,000 | ~68% |

## Best Practices

1. **Start with GPT-4o-mini** for testing - it's cheap and fast
2. **Use GPT-4o** for production/complex tasks
3. **Enable strict mode** (automatic for GPT-4o) for reliable tool calling
4. **Monitor the console** to see what's being sent to the AI
5. **Use fully qualified image names** (e.g., `docker.io/library/nginx:latest`)
6. **Use "minimal" context level** for simple tasks to reduce costs

## Adding New Model Support

If you're using a model not listed here, Selkie Mode will:
1. Default to `tool_choice: auto` (may return text instead of tools)
2. Not enable strict mode
3. Disable parallel tool calls

For best results with unlisted models:
- Use models with 70B+ parameters
- Prefer models fine-tuned for function calling
- Test with simple tasks first ("navigate to containers")
