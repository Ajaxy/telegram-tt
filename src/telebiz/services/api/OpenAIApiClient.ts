import type {
  AgentConfig,
  AgentMessage,
  OpenAIModel,
  StreamCallback,
  ToolCall,
  ToolDefinition,
} from '../../agent/types';

import { logDebugMessage } from '../../../util/debugConsole';

const OPENAI_API_URL = 'https://api.openai.com/v1';

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'gpt-5.2',
  temperature: 0.7,
  maxTokens: 4096,
};

// Timeout for streaming (30 seconds without any data)
const STREAM_TIMEOUT_MS = 30000;

// Available OpenAI models with pricing (updated Jan 2026)
export const OPENAI_MODELS: OpenAIModel[] = [
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Flagship model for complex tasks',
    contextLength: 200000,
    pricing: { prompt: 0.000005, completion: 0.00002 },
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    description: 'Smartest model, slower responses',
    contextLength: 200000,
    pricing: { prompt: 0.00006, completion: 0.00024 },
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    description: 'Latest reasoning model',
    contextLength: 200000,
    pricing: { prompt: 0.0000011, completion: 0.0000044 },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Reliable and capable',
    contextLength: 128000,
    pricing: { prompt: 0.0000025, completion: 0.00001 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and cost-effective',
    contextLength: 128000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 },
  },
];

/**
 * OpenAI API Client
 * Handles direct OpenAI API calls from the client
 */
export class OpenAIApiClient {
  /**
   * Get available OpenAI models
   */
  getModels(): OpenAIModel[] {
    return OPENAI_MODELS;
  }

  /**
   * Send chat completion request to OpenAI with streaming
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

    // Convert messages to OpenAI format
    const openaiMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: msg.content || undefined,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: mergedConfig.model,
      messages: openaiMessages,
      stream: true,
    };

    if (mergedConfig.maxTokens) {
      requestBody.max_tokens = mergedConfig.maxTokens;
    }

    if (mergedConfig.temperature !== undefined) {
      requestBody.temperature = mergedConfig.temperature;
    }

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls = new Map<number, Partial<ToolCall>>();
    let lastActivityTime = Date.now();

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
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            if (!delta) continue;

            // Handle content
            if (delta.content) {
              onStream({ type: 'content', content: delta.content });
            }

            // Handle tool calls
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, {
                    id: tc.id,
                    type: 'function',
                    function: { name: '', arguments: '' },
                  });
                }
                const existing = toolCalls.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) {
                  existing.function = existing.function || { name: '', arguments: '' };
                  existing.function.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  existing.function = existing.function || { name: '', arguments: '' };
                  existing.function.arguments += tc.function.arguments;
                }
              }
            }

            // Handle finish reason
            if (choice?.finish_reason) {
              // Emit tool calls before done
              if (toolCalls.size > 0) {
                for (const tc of toolCalls.values()) {
                  onStream({ type: 'tool_call', toolCall: tc });
                }
              }
              onStream({ type: 'done' });
              return;
            }
          } catch (parseError) {
            logDebugMessage('warn', 'Failed to parse OpenAI SSE data:', parseError);
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
