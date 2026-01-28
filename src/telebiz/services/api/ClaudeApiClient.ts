import type {
  AgentConfig,
  AgentMessage,
  ClaudeModel,
  StreamCallback,
  ToolCall,
  ToolDefinition,
} from '../../agent/types';

import { logDebugMessage } from '../../../util/debugConsole';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 4096,
};

// Timeout for streaming (30 seconds without any data)
const STREAM_TIMEOUT_MS = 30000;

// Pricing per token (not per million) for Claude models
// Source: https://www.anthropic.com/pricing
const CLAUDE_PRICING: Record<string, { prompt: number; completion: number }> = {
  // Claude 4.5 family
  'claude-opus-4-5': { prompt: 0.000015, completion: 0.000075 },
  'claude-sonnet-4-5': { prompt: 0.000003, completion: 0.000015 },
  'claude-haiku-4-5': { prompt: 0.000001, completion: 0.000005 },
  // Claude 4.1
  'claude-opus-4-1': { prompt: 0.000015, completion: 0.000075 },
  // Claude 4
  'claude-opus-4': { prompt: 0.000015, completion: 0.000075 },
  'claude-sonnet-4': { prompt: 0.000003, completion: 0.000015 },
  // Claude 3.7
  'claude-3-7-sonnet': { prompt: 0.000003, completion: 0.000015 },
  // Claude 3.5
  'claude-3-5-sonnet': { prompt: 0.000003, completion: 0.000015 },
  'claude-3-5-haiku': { prompt: 0.0000008, completion: 0.000004 },
  // Claude 3
  'claude-3-opus': { prompt: 0.000015, completion: 0.000075 },
  'claude-3-sonnet': { prompt: 0.000003, completion: 0.000015 },
  'claude-3-haiku': { prompt: 0.00000025, completion: 0.00000125 },
};

// Get pricing for a model ID (checks for partial matches for versioned models)
function getPricingForModel(modelId: string): { prompt: number; completion: number } {
  // Direct match
  if (CLAUDE_PRICING[modelId]) {
    return CLAUDE_PRICING[modelId];
  }

  // Strip date suffix (e.g., 'claude-opus-4-5-20251101' -> 'claude-opus-4-5')
  const withoutDate = modelId.replace(/-\d{8}$/, '');
  if (CLAUDE_PRICING[withoutDate]) {
    return CLAUDE_PRICING[withoutDate];
  }

  // Check for partial matches (model ID starts with a known pricing key)
  for (const [key, pricing] of Object.entries(CLAUDE_PRICING)) {
    if (withoutDate.startsWith(key) || withoutDate === key) {
      return pricing;
    }
  }

  // Default pricing for unknown models
  return { prompt: 0, completion: 0 };
}

// Fallback Claude models (used if API fetch fails)
export const CLAUDE_MODELS: ClaudeModel[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent model for complex tasks',
    contextLength: 200000,
    pricing: CLAUDE_PRICING['claude-opus-4-5'],
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Best balance of intelligence and speed',
    contextLength: 200000,
    pricing: CLAUDE_PRICING['claude-sonnet-4-5'],
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'Reliable and capable',
    contextLength: 200000,
    pricing: CLAUDE_PRICING['claude-sonnet-4'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fastest and most cost-effective',
    contextLength: 200000,
    pricing: CLAUDE_PRICING['claude-3-5-haiku'],
  },
];

/**
 * Claude API Client
 * Handles direct Claude API calls from the client
 */
export class ClaudeApiClient {
  /**
   * Get fallback Claude models (static list)
   */
  getModels(): ClaudeModel[] {
    return CLAUDE_MODELS;
  }

  /**
   * Fetch available models from Claude API
   */
  async fetchModels(apiKey: string): Promise<ClaudeModel[]> {
    try {
      const response = await fetch(`${CLAUDE_API_URL}/models?limit=100`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });

      if (!response.ok) {
        logDebugMessage('warn', 'Failed to fetch Claude models, using fallback list');
        return CLAUDE_MODELS;
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        return CLAUDE_MODELS;
      }

      // Convert API response to ClaudeModel format
      const models: ClaudeModel[] = data.data.map((model: { id: string; display_name: string }) => ({
        id: model.id,
        name: model.display_name,
        description: model.display_name,
        contextLength: 200000, // Default context length
        pricing: getPricingForModel(model.id),
      }));

      return models.length > 0 ? models : CLAUDE_MODELS;
    } catch (error) {
      logDebugMessage('warn', 'Error fetching Claude models:', error);
      return CLAUDE_MODELS;
    }
  }

  /**
   * Convert OpenRouter-style tool definitions to Claude format
   */
  private convertToolsToClaudeFormat(tools: ToolDefinition[]): Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  }> {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.function.parameters.properties,
        required: tool.function.parameters.required,
      },
    }));
  }

  /**
   * Send chat completion request to Claude with streaming
   */
  async streamChat(
    apiKey: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    config: Partial<AgentConfig> = {},
    onStream: StreamCallback,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const mergedConfig = { ...DEFAULT_AGENT_CONFIG, ...config };

    // Convert messages to Claude format
    const claudeMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => {
        if (msg.role === 'tool') {
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: msg.toolCallId,
              content: msg.content,
            }],
          };
        }

        if (msg.role === 'assistant') {
          const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> = [];

          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }

          if (msg.toolCalls?.length) {
            for (const tc of msg.toolCalls) {
              let input: unknown = {};
              try {
                input = JSON.parse(tc.function.arguments || '{}');
              } catch {
                logDebugMessage('warn', 'Failed to parse tool arguments, using empty object', tc.function.arguments);
              }
              content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input,
              });
            }
          }

          return {
            role: 'assistant' as const,
            content: content.length > 0 ? content : [{ type: 'text', text: '' }],
          };
        }

        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        };
      });

    // Extract system message if present
    const systemMessage = messages.find((msg) => msg.role === 'system');

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: mergedConfig.model,
      messages: claudeMessages,
      max_tokens: mergedConfig.maxTokens || 4096,
      stream: true,
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    if (mergedConfig.temperature !== undefined) {
      requestBody.temperature = mergedConfig.temperature;
    }

    if (tools.length > 0) {
      requestBody.tools = this.convertToolsToClaudeFormat(tools);
    }

    const response = await fetch(`${CLAUDE_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls = new Map<string, Partial<ToolCall>>();
    let lastActivityTime = Date.now();
    let currentToolUseId: string | undefined;
    let currentToolUseName: string | undefined;
    let currentToolUseInput = '';

    // Helper to read with timeout
    const readWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      return Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          const checkTimeout = () => {
            if (Date.now() - lastActivityTime > STREAM_TIMEOUT_MS) {
              reject(new Error('Stream timeout: No data received for 30 seconds'));
            }
          };
          setTimeout(checkTimeout, STREAM_TIMEOUT_MS);
        }),
      ]);
    };

    try {
      while (true) {
        const { done, value } = await readWithTimeout();
        if (done) break;

        lastActivityTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // Handle different event types
            switch (parsed.type) {
              case 'content_block_start':
                if (parsed.content_block?.type === 'tool_use') {
                  currentToolUseId = parsed.content_block.id;
                  currentToolUseName = parsed.content_block.name;
                  currentToolUseInput = '';
                }
                break;

              case 'content_block_delta':
                if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
                  onStream({ type: 'content', content: parsed.delta.text });
                } else if (parsed.delta?.type === 'thinking_delta' && parsed.delta.thinking) {
                  // Handle extended thinking (Claude's reasoning)
                  onStream({
                    type: 'reasoning',
                    reasoning: parsed.delta.thinking,
                  });
                } else if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
                  currentToolUseInput += parsed.delta.partial_json;
                }
                break;

              case 'content_block_stop':
                if (currentToolUseId && currentToolUseName) {
                  toolCalls.set(currentToolUseId, {
                    id: currentToolUseId,
                    type: 'function',
                    function: {
                      name: currentToolUseName,
                      // Default to empty object if no arguments received (for tools with no params)
                      arguments: currentToolUseInput || '{}',
                    },
                  });
                  currentToolUseId = undefined;
                  currentToolUseName = undefined;
                  currentToolUseInput = '';
                }
                break;

              case 'message_stop':
                // Emit tool calls before done
                if (toolCalls.size > 0) {
                  for (const tc of toolCalls.values()) {
                    onStream({ type: 'tool_call', toolCall: tc });
                  }
                }
                onStream({ type: 'done' });
                return;

              case 'error':
                onStream({ type: 'error', error: parsed.error?.message || 'Unknown error' });
                return;

              default:
                break;
            }
          } catch (parseError) {
            logDebugMessage('warn', 'Failed to parse Claude SSE data:', parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final tool calls if not already emitted
    if (toolCalls.size > 0) {
      for (const tc of toolCalls.values()) {
        onStream({ type: 'tool_call', toolCall: tc });
      }
    }

    onStream({ type: 'done' });
  }

  /**
   * Non-streaming chat completion (for simpler use cases)
   */
  async chat(
    apiKey: string,
    messages: AgentMessage[],
    tools: ToolDefinition[],
    config: Partial<AgentConfig> = {},
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    let content = '';
    const toolCalls: ToolCall[] = [];

    await this.streamChat(apiKey, messages, tools, config, (delta) => {
      if (delta.type === 'content' && delta.content) {
        content += delta.content;
      }
      if (delta.type === 'tool_call' && delta.toolCall?.id && delta.toolCall.function?.name) {
        const existing = toolCalls.find((tc) => tc.id === delta.toolCall!.id);
        if (!existing) {
          toolCalls.push(delta.toolCall as ToolCall);
        }
      }
    });

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}
