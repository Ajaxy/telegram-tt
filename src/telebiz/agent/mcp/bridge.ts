/**
 * MCP Bridge Client (Browser Side)
 *
 * Connects to the local MCP relay server and handles tool execution requests
 * from external MCP clients. The browser acts as the executor since it has
 * the authenticated Telegram session.
 *
 * Architecture:
 * - MCP Relay Server (Node.js) runs locally on port 9716
 * - Browser connects as "executor" - receives requests, executes tools
 * - MCP Server connects as "client" - sends requests to execute tools
 *
 * Protocol:
 * - Request: { id: string, type: 'execute', tool: string, args: object }
 * - Response: { id: string, type: 'result', success: boolean, data?: any, error?: string }
 */

import type { ExtraToolName, ToolDefinition } from '../types';

import { executeTool, resetRequestCallCount } from '../tools/executor';
import { ALL_TOOLS } from '../tools/registry';
import { EXTRA_TOOLS_REGISTRY, getExtraToolTools } from '../tools/skills';

const DEFAULT_PORT = 9716; // "TBIZ" on phone keypad
const RECONNECT_INTERVAL = 5000;

export interface McpRequest {
  id?: string;
  type: 'execute' | 'list_tools' | 'list_skills' | 'ping';
  tool?: string;
  args?: Record<string, unknown>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface McpResponse {
  id?: string;
  type: 'result' | 'tools' | 'skills' | 'pong' | 'error' | 'register';
  role?: 'executor';
  success?: boolean;
  data?: unknown;
  error?: string;
  tools?: McpTool[];
}

let ws: WebSocket | undefined;
let isConnecting = false;
let isStopped = true; // Start stopped until explicitly started
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
let connectionListeners: Array<(connected: boolean) => void> = [];

function notifyConnectionChange(connected: boolean) {
  connectionListeners.forEach((listener) => listener(connected));
}

export function onConnectionChange(listener: (connected: boolean) => void): () => void {
  connectionListeners.push(listener);
  return () => {
    connectionListeners = connectionListeners.filter((l) => l !== listener);
  };
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

function send(message: McpResponse) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleMessage(event: MessageEvent) {
  try {
    const request: McpRequest = JSON.parse(event.data);
    handleRequest(request).then(send);
  } catch (error) {
    console.error('[MCP Bridge] Failed to parse message:', error);
    send({ type: 'error', error: 'Invalid JSON message' });
  }
}

/**
 * Convert internal tool definition to MCP format
 */
export function convertToolToMcp(tool: ToolDefinition): McpTool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    inputSchema: {
      type: 'object',
      properties: tool.function.parameters?.properties || {},
      required: tool.function.parameters?.required || [],
    },
  };
}

/**
 * Get all extra tools flattened
 */
function getAllExtraTools(): ToolDefinition[] {
  const extraToolNames = Object.keys(EXTRA_TOOLS_REGISTRY) as ExtraToolName[];
  return extraToolNames.flatMap((name) => getExtraToolTools(name));
}

/**
 * Get all tools in MCP format (base tools + all extra tools)
 */
export function getMcpTools(): McpTool[] {
  const baseTools = ALL_TOOLS.map(convertToolToMcp);
  const extraTools = getAllExtraTools().map(convertToolToMcp);

  // Combine and dedupe by name (in case some tools appear in both)
  const toolsByName = new Map<string, McpTool>();
  for (const tool of [...baseTools, ...extraTools]) {
    if (!toolsByName.has(tool.name)) {
      toolsByName.set(tool.name, tool);
    }
  }

  return Array.from(toolsByName.values());
}

/**
 * Handle incoming MCP request and return response
 */
export async function handleRequest(request: McpRequest): Promise<McpResponse> {
  switch (request.type) {
    case 'ping':
      return { type: 'pong' };

    case 'list_tools': {
      const tools = getMcpTools();
      return { id: request.id, type: 'tools', tools };
    }

    case 'list_skills': {
      const extraTools = Object.entries(EXTRA_TOOLS_REGISTRY).map(([name, extraTool]) => ({
        name,
        description: extraTool.description,
        tools: getExtraToolTools(name as ExtraToolName).map((t) => ({
          name: t.function.name,
          description: t.function.description,
          inputSchema: {
            type: 'object',
            properties: t.function.parameters?.properties || {},
            required: t.function.parameters?.required || [],
          },
        })),
      }));
      return { id: request.id, type: 'skills', data: extraTools };
    }

    case 'execute': {
      if (!request.tool) {
        return {
          id: request.id,
          type: 'result',
          success: false,
          error: 'Missing tool name',
        };
      }

      // Reset rate limit counter for new request
      resetRequestCallCount();

      try {
        const result = await executeTool(request.tool, request.args || {});
        return {
          id: request.id,
          type: 'result',
          success: result.success,
          data: result.data,
          error: result.error,
        };
      } catch (error) {
        return {
          id: request.id,
          type: 'result',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    default:
      return {
        id: request.id,
        type: 'error',
        error: `Unknown request type: ${(request).type}`,
      };
  }
}

function connect() {
  if (isStopped || isConnecting || ws?.readyState === WebSocket.OPEN) {
    return;
  }

  isConnecting = true;

  try {
    ws = new WebSocket(`ws://localhost:${DEFAULT_PORT}`);

    ws.onopen = () => {
      isConnecting = false;
      console.log('[MCP Bridge] Connected to relay server');

      // Register as executor
      send({ type: 'register', role: 'executor' });
      notifyConnectionChange(true);

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = undefined;
      }
    };

    ws.onclose = () => {
      isConnecting = false;
      console.log('[MCP Bridge] Disconnected from relay server');
      notifyConnectionChange(false);
      ws = undefined;
      scheduleReconnect();
    };

    ws.onerror = () => {
      isConnecting = false;
    };

    ws.onmessage = handleMessage;
  } catch (error) {
    isConnecting = false;
    console.error('[MCP Bridge] Connection error:', error);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout || isStopped) return;

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = undefined;
    if (!isStopped) {
      connect();
    }
  }, RECONNECT_INTERVAL);
}

export function startMcpBridge() {
  console.log('[MCP Bridge] Starting...');
  isStopped = false;
  connect();
}

export function stopMcpBridge() {
  isStopped = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }

  if (ws) {
    ws.close();
    ws = undefined;
  }

  // Don't clear connectionListeners - they persist across enable/disable cycles
  notifyConnectionChange(false);
  console.log('[MCP Bridge] Stopped');
}
