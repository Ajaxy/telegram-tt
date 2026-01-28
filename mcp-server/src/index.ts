#!/usr/bin/env node
/**
 * Telebiz MCP Server
 *
 * A single service that:
 * 1. Exposes MCP tools to Claude Desktop (via stdio)
 * 2. Runs a WebSocket server for the Telebiz browser app to connect
 *
 * Usage:
 * 1. Open Telebiz in your browser
 * 2. Configure Claude Desktop to use this MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocket, WebSocketServer } from 'ws';

const SERVER_NAME = 'telebiz-mcp-server';
const SERVER_VERSION = '1.0.0';
const WS_PORT = 9716; // "TBIZ" on phone keypad
const REQUEST_TIMEOUT = 30000;

// WebSocket state
let executor: WebSocket | undefined;
let tools: Tool[] = [];
const pendingRequests = new Map<string, {
  resolve: (value: BridgeResponse) => void;
  reject: (error: Error) => void;
}>();

interface BridgeRequest {
  id: string;
  type: 'execute' | 'list_tools' | 'list_skills';
  tool?: string;
  args?: Record<string, unknown>;
}

interface BridgeResponse {
  id?: string;
  type: string;
  role?: string;
  tools?: Tool[];
  success?: boolean;
  data?: unknown;
  error?: string;
}

function log(message: string) {
  console.error(`[Telebiz MCP] ${message}`);
}

function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Send request to browser and wait for response
async function sendToBrowser(request: Omit<BridgeRequest, 'id'>): Promise<BridgeResponse> {
  if (!executor || executor.readyState !== WebSocket.OPEN) {
    throw new Error('Telebiz app is not connected. Please open Telebiz in your browser.');
  }

  const id = generateId();
  const message: BridgeRequest = { ...request, id };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    executor!.send(JSON.stringify(message));

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timed out'));
      }
    }, REQUEST_TIMEOUT);
  });
}

// Handle message from browser
function handleBrowserMessage(data: string) {
  try {
    const message: BridgeResponse = JSON.parse(data);

    // Handle registration
    if (message.type === 'register' && message.role === 'executor') {
      log('Telebiz app connected');
      return;
    }

    // Handle response to pending request
    if (message.id && pendingRequests.has(message.id)) {
      const { resolve } = pendingRequests.get(message.id)!;
      pendingRequests.delete(message.id);
      resolve(message);
    }
  } catch (error) {
    log(`Error parsing browser message: ${error}`);
  }
}

// Start WebSocket server for browser connections
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws) => {
    log('New WebSocket connection');

    ws.on('message', (data) => {
      const message = data.toString();

      // Check if this is the executor registering
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'register' && parsed.role === 'executor') {
          if (executor && executor.readyState === WebSocket.OPEN) {
            executor.close();
          }
          executor = ws;
          log('Telebiz app registered as executor');

          // Fetch tools from browser
          sendToBrowser({ type: 'list_tools' })
            .then((response) => {
              if (response.tools) {
                tools = response.tools;
                log(`Loaded ${tools.length} tools from Telebiz`);
              }
            })
            .catch((err) => log(`Failed to load tools: ${err.message}`));
          return;
        }
      } catch {
        // Not JSON, ignore
      }

      // Handle other messages
      handleBrowserMessage(message);
    });

    ws.on('close', () => {
      if (ws === executor) {
        log('Telebiz app disconnected');
        executor = undefined;
        tools = [];
      }
    });

    ws.on('error', (error) => {
      log(`WebSocket error: ${error.message}`);
    });
  });

  wss.on('listening', () => {
    log(`WebSocket server running on ws://localhost:${WS_PORT}`);
    log('Waiting for Telebiz app to connect...');
  });

  wss.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      log(`Port ${WS_PORT} is already in use. Is another instance running?`);
      process.exit(1);
    }
    log(`WebSocket server error: ${error.message}`);
  });

  return wss;
}

async function main() {
  // Start WebSocket server for browser connections
  const wss = startWebSocketServer();

  // Create MCP server for Claude Desktop
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // If no executor connected, wait a bit for it to connect
    if (!executor || executor.readyState !== WebSocket.OPEN) {
      log('Waiting for Telebiz app to connect...');
      // Wait up to 5 seconds for browser to connect
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (executor && executor.readyState === WebSocket.OPEN) {
          break;
        }
      }
    }

    // Try to fetch tools from browser if connected
    if (executor && executor.readyState === WebSocket.OPEN) {
      try {
        const response = await sendToBrowser({ type: 'list_tools' });
        if (response.tools) {
          tools = response.tools;
          log(`Refreshed ${tools.length} tools from Telebiz`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Failed to fetch tools: ${errorMessage}`);
        // Use cached tools
      }
    } else {
      log('Telebiz app not connected - returning empty tools list');
    }

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`Tool call: ${name}`);

    try {
      const response = await sendToBrowser({
        type: 'execute',
        tool: name,
        args: args || {},
      });

      if (response.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `Error: ${response.error}`,
          }],
          isError: true,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Tool error: ${errorMessage}`);
      return {
        content: [{
          type: 'text',
          text: `Error: ${errorMessage}`,
        }],
        isError: true,
      };
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    log('Shutting down...');
    wss.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start MCP server (stdio transport)
  const transport = new StdioServerTransport();
  log('Starting Telebiz MCP Server...');
  await server.connect(transport);
  log('MCP Server is running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
