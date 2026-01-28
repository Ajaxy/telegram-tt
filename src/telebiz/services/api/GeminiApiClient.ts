import type {
  AgentConfig,
  AgentMessage,
  GeminiModel,
  StreamCallback,
  ToolCall,
  ToolDefinition,
} from '../../agent/types';

import { logDebugMessage } from '../../../util/debugConsole';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 8192,
};

// Timeout for streaming (30 seconds without any data)
const STREAM_TIMEOUT_MS = 30000;

// Available Gemini models with pricing (updated Jan 2026)
// Note: Gemini 1.x retired, Gemini 2.0 retiring March 2026
export const GEMINI_MODELS: GeminiModel[] = [
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Most intelligent reasoning model',
    contextLength: 1000000,
    pricing: { prompt: 0.000002, completion: 0.000012 },
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    description: 'Balanced speed and intelligence',
    contextLength: 1000000,
    pricing: { prompt: 0.0000005, completion: 0.000002 },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning capabilities',
    contextLength: 1000000,
    pricing: { prompt: 0.00000125, completion: 0.000005 },
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Best price-performance ratio',
    contextLength: 1000000,
    pricing: { prompt: 0.000000075, completion: 0.0000003 },
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fastest and most cost-efficient',
    contextLength: 1000000,
    pricing: { prompt: 0.00000005, completion: 0.0000002 },
  },
];

/**
 * Gemini API Client
 * Handles direct Gemini API calls from the client
 */
export class GeminiApiClient {
  /**
   * Get available Gemini models
   */
  getModels(): GeminiModel[] {
    return GEMINI_MODELS;
  }

  /**
   * Convert tool definitions to Gemini format
   */
  private convertToolsToGeminiFormat(tools: ToolDefinition[]): Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
      };
    }>;
  }> {
    if (tools.length === 0) return [];

    return [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: {
          type: 'object',
          properties: tool.function.parameters.properties,
          required: tool.function.parameters.required,
        },
      })),
    }];
  }

  /**
   * Send chat completion request to Gemini with streaming
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

    // Convert messages to Gemini format
    const systemInstruction = messages.find((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const contents = conversationMessages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'function' as const,
          parts: [{
            functionResponse: {
              name: msg.toolCallId?.split('_')[0] || 'function',
              response: { result: msg.content },
            },
          }],
        };
      }

      if (msg.role === 'assistant') {
        const parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.toolCalls?.length) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              },
            });
          }
        }

        return {
          role: 'model' as const,
          parts: parts.length > 0 ? parts : [{ text: '' }],
        };
      }

      return {
        role: 'user' as const,
        parts: [{ text: msg.content }],
      };
    });

    // Build request body
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: mergedConfig.maxTokens,
        temperature: mergedConfig.temperature,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const geminiTools = this.convertToolsToGeminiFormat(tools);
    if (geminiTools.length > 0) {
      requestBody.tools = geminiTools;
    }

    const modelId = mergedConfig.model;
    const url = `${GEMINI_API_URL}/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls: ToolCall[] = [];
    let lastActivityTime = Date.now();
    let toolCallIndex = 0;

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
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            const candidates = parsed.candidates;

            if (!candidates?.length) continue;

            const candidate = candidates[0];
            const content = candidate.content;

            if (!content?.parts) continue;

            for (const part of content.parts) {
              // Handle text content
              if (part.text) {
                onStream({ type: 'content', content: part.text });
              }

              // Handle thinking/reasoning (Gemini 2.0 thinking models)
              if (part.thought) {
                onStream({ type: 'reasoning', reasoning: part.thought });
              }

              // Handle function calls
              if (part.functionCall) {
                const toolCall: ToolCall = {
                  id: `call_${toolCallIndex++}`,
                  type: 'function',
                  function: {
                    name: part.functionCall.name,
                    arguments: JSON.stringify(part.functionCall.args || {}),
                  },
                };
                toolCalls.push(toolCall);
              }
            }

            // Check for finish
            if (candidate.finishReason) {
              // Emit tool calls before done
              if (toolCalls.length > 0) {
                for (const tc of toolCalls) {
                  onStream({ type: 'tool_call', toolCall: tc });
                }
              }
              onStream({ type: 'done' });
              return;
            }
          } catch (parseError) {
            logDebugMessage('warn', 'Failed to parse Gemini SSE data:', parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final tool calls if not already emitted
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
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
