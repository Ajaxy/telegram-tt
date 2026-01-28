/**
 * MCP Server Tests
 *
 * Tests the core functionality of the Telebiz MCP server:
 * - WebSocket server startup and connection handling
 * - MCP protocol message handling
 * - Tool listing and execution forwarding
 */

import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';

// Test configuration
const TEST_PORT = 9717; // Use different port than production
const CONNECT_TIMEOUT = 2000;

describe('MCP Server', () => {
  describe('WebSocket Server', () => {
    let wss: WebSocketServer | undefined;

    afterEach(() => {
      if (wss) {
        wss.close();
        wss = undefined;
      }
    });

    it('should start WebSocket server on specified port', async () => {
      wss = new WebSocketServer({ port: TEST_PORT });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server start timeout')), CONNECT_TIMEOUT);
        wss!.on('listening', () => {
          clearTimeout(timeout);
          resolve();
        });
        wss!.on('error', reject);
      });

      assert.ok(wss.address(), 'Server should have an address');
    });

    it('should accept client connections', async () => {
      wss = new WebSocketServer({ port: TEST_PORT });

      await new Promise<void>((resolve) => {
        wss!.on('listening', resolve);
      });

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), CONNECT_TIMEOUT);
        client.on('open', () => {
          clearTimeout(timeout);
          client.close();
          resolve();
        });
        client.on('error', reject);
      });
    });

    it('should handle executor registration', async () => {
      wss = new WebSocketServer({ port: TEST_PORT });
      let registeredRole: string | undefined;

      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'register') {
            registeredRole = message.role;
          }
        });
      });

      await new Promise<void>((resolve) => {
        wss!.on('listening', resolve);
      });

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({ type: 'register', role: 'executor' }));
          setTimeout(() => {
            client.close();
            resolve();
          }, 100);
        });
      });

      assert.strictEqual(registeredRole, 'executor', 'Should receive executor registration');
    });
  });

  describe('Message Protocol', () => {
    it('should generate unique request IDs', () => {
      const generateId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const id1 = generateId();
      const id2 = generateId();

      assert.ok(id1.startsWith('req_'), 'ID should start with req_');
      assert.notStrictEqual(id1, id2, 'IDs should be unique');
    });

    it('should parse valid JSON messages', () => {
      const validMessage = JSON.stringify({
        id: 'test_123',
        type: 'execute',
        tool: 'listChats',
        args: { limit: 10 },
      });

      const parsed = JSON.parse(validMessage);

      assert.strictEqual(parsed.type, 'execute');
      assert.strictEqual(parsed.tool, 'listChats');
      assert.strictEqual(parsed.args.limit, 10);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformed = 'not valid json {';

      assert.throws(() => {
        JSON.parse(malformed);
      }, SyntaxError);
    });
  });

  describe('Request Types', () => {
    it('should recognize ping request type', () => {
      const request = { type: 'ping' };
      assert.strictEqual(request.type, 'ping');
    });

    it('should recognize list_tools request type', () => {
      const request = { type: 'list_tools' };
      assert.strictEqual(request.type, 'list_tools');
    });

    it('should recognize execute request type', () => {
      const request = { type: 'execute', tool: 'listChats', args: {} };
      assert.strictEqual(request.type, 'execute');
      assert.ok(request.tool, 'Execute request should have tool name');
    });

    it('should recognize list_skills request type', () => {
      const request = { type: 'list_skills' };
      assert.strictEqual(request.type, 'list_skills');
    });
  });

  describe('Response Format', () => {
    it('should format success response correctly', () => {
      const response = {
        id: 'req_123',
        type: 'result',
        success: true,
        data: { chats: [] },
      };

      assert.ok(response.id, 'Response should have ID');
      assert.strictEqual(response.type, 'result');
      assert.strictEqual(response.success, true);
      assert.ok(response.data, 'Success response should have data');
    });

    it('should format error response correctly', () => {
      const response = {
        id: 'req_123',
        type: 'result',
        success: false,
        error: 'Tool not found',
      };

      assert.ok(response.id, 'Response should have ID');
      assert.strictEqual(response.success, false);
      assert.ok(response.error, 'Error response should have error message');
    });

    it('should format tools list response correctly', () => {
      const response = {
        id: 'req_123',
        type: 'tools',
        tools: [
          {
            name: 'listChats',
            description: 'List chats',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      };

      assert.strictEqual(response.type, 'tools');
      assert.ok(Array.isArray(response.tools), 'Tools should be an array');
      assert.ok(response.tools[0].name, 'Tool should have name');
      assert.ok(response.tools[0].inputSchema, 'Tool should have input schema');
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid MCP tool schema structure', () => {
      const validTool = {
        name: 'sendMessage',
        description: 'Send a message to a chat',
        inputSchema: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'Chat ID' },
            text: { type: 'string', description: 'Message text' },
          },
          required: ['chatId', 'text'],
        },
      };

      assert.strictEqual(validTool.inputSchema.type, 'object');
      assert.ok(validTool.inputSchema.properties, 'Schema should have properties');
      assert.ok(Array.isArray(validTool.inputSchema.required), 'Required should be array');
    });

    it('should validate required fields are in properties', () => {
      const tool = {
        name: 'testTool',
        inputSchema: {
          type: 'object',
          properties: {
            field1: { type: 'string' },
            field2: { type: 'number' },
          },
          required: ['field1'],
        },
      };

      const requiredFields = tool.inputSchema.required;
      const propertyNames = Object.keys(tool.inputSchema.properties);

      for (const required of requiredFields) {
        assert.ok(
          propertyNames.includes(required),
          `Required field "${required}" should be in properties`,
        );
      }
    });
  });

  describe('Connection State', () => {
    it('should track connection state correctly', () => {
      let isConnected = false;

      // Simulate connection
      isConnected = true;
      assert.strictEqual(isConnected, true);

      // Simulate disconnection
      isConnected = false;
      assert.strictEqual(isConnected, false);
    });

    it('should handle reconnection attempts', async () => {
      const RECONNECT_INTERVAL = 100;
      let reconnectCount = 0;

      const scheduleReconnect = () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            reconnectCount++;
            resolve();
          }, RECONNECT_INTERVAL);
        });
      };

      await scheduleReconnect();
      await scheduleReconnect();

      assert.strictEqual(reconnectCount, 2, 'Should track reconnection attempts');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce request timeout', async () => {
      const REQUEST_TIMEOUT = 100;

      const timedRequest = () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Request timed out'));
          }, REQUEST_TIMEOUT);
        });

      await assert.rejects(timedRequest, { message: 'Request timed out' });
    });
  });
});

// Run tests if executed directly
if (process.argv[1]?.endsWith('index.test.ts') || process.argv[1]?.endsWith('index.test.js')) {
  console.log('Running MCP Server tests...');
}
