import { getActions, getGlobal } from '../../../../global';

import type { Notification } from '../../../services/types';
import type { ExtraTool, ToolDefinition, ToolResult } from '../../types';

import { selectChat } from '../../../../global/selectors';
import {
  selectTelebizOrderedPendingChatIds,
  selectTelebizPendingNotificationsByChatId,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';

// Bulk Operations Tool Definitions
const processAllPendingTasks: ToolDefinition = {
  type: 'function',
  function: {
    name: 'processAllPendingTasks',
    description: [
      'Get a complete overview of all chats with pending tasks.',
      'Returns each chat with its pending notifications and linked CRM entity.',
      'Use this to understand what needs to be done across all chats.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of chats to process (default: 20)',
        },
      },
    },
  },
};

const batchDismissTasks: ToolDefinition = {
  type: 'function',
  function: {
    name: 'batchDismissTasks',
    description: 'Dismiss multiple notifications/tasks at once.',
    parameters: {
      type: 'object',
      properties: {
        notificationIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of notification IDs to dismiss',
        },
      },
      required: ['notificationIds'],
    },
  },
};

const batchSnoozeTasks: ToolDefinition = {
  type: 'function',
  function: {
    name: 'batchSnoozeTasks',
    description: 'Snooze multiple notifications/tasks at once.',
    parameters: {
      type: 'object',
      properties: {
        notificationIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of notification IDs to snooze',
        },
        snoozeMinutes: {
          type: 'number',
          description: 'Minutes to snooze for (default: 60)',
        },
      },
      required: ['notificationIds'],
    },
  },
};

const summarizeActions: ToolDefinition = {
  type: 'function',
  function: {
    name: 'summarizeActions',
    description: [
      'Generate a summary of actions taken during the session.',
      'Call this at the end of a bulk operation to report what was done.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chatId: { type: 'string' },
              action: { type: 'string' },
              details: { type: 'string' },
            },
          },
          description: 'Array of actions that were taken',
        },
      },
      required: ['actions'],
    },
  },
};

const getWorkflowContext: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getWorkflowContext',
    description: [
      'Get context for a specific chat including its tasks, relationship, and recent messages.',
      'Use this to understand what needs to be done for a specific chat.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The chat ID to get context for',
        },
      },
      required: ['chatId'],
    },
  },
};

// Bulk Operations Extra Tool Definition
export const BULK_EXTRA_TOOL: ExtraTool = {
  name: 'bulk',
  description: 'Batch operations - process all pending tasks, dismiss multiple, summarize actions',
  tools: [
    processAllPendingTasks,
    batchDismissTasks,
    batchSnoozeTasks,
    summarizeActions,
    getWorkflowContext,
  ],
  readOnlyTools: ['processAllPendingTasks', 'getWorkflowContext', 'summarizeActions'],
  contextPrompt: `BULK OPERATIONS SKILL LOADED. You can now:
- Get all pending chats with processAllPendingTasks
- Dismiss multiple tasks with batchDismissTasks
- Snooze multiple tasks with batchSnoozeTasks
- Get full context for a chat with getWorkflowContext
- Generate summary with summarizeActions

WORKFLOW PATTERN:
1. Call processAllPendingTasks to see what needs attention
2. For each chat, use getWorkflowContext if you need more details
3. Take appropriate actions (dismiss, send message, update CRM)
4. Use summarizeActions to report what was done`,
};

// Bulk Operations Tool Executors
export async function executeBulkTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'processAllPendingTasks':
      return executeProcessAllPendingTasks(args.limit as number | undefined);
    case 'batchDismissTasks':
      return executeBatchDismissTasks(args.notificationIds as number[]);
    case 'batchSnoozeTasks':
      return executeBatchSnoozeTasks(
        args.notificationIds as number[],
        args.snoozeMinutes as number | undefined,
      );
    case 'summarizeActions':
      return executeSummarizeActions(args.actions as Array<Record<string, string>>);
    case 'getWorkflowContext':
      return executeGetWorkflowContext(args.chatId as string);
    default:
      return { success: false, error: `Unknown bulk tool: ${toolName}` };
  }
}

function executeProcessAllPendingTasks(limit = 20): ToolResult {
  const global = getGlobal();
  const orderedChatIds = selectTelebizOrderedPendingChatIds(global);

  const chats = orderedChatIds.slice(0, limit).map((chatId) => {
    const chat = selectChat(global, chatId);
    const notifications = selectTelebizPendingNotificationsByChatId(global, chatId);
    const relationship = selectTelebizSelectedRelationship(global, chatId);

    return {
      chatId,
      chatTitle: chat?.title || 'Unknown',
      chatType: chat?.type,
      taskCount: notifications.length,
      tasks: notifications.map((n) => summarizeNotification(n)),
      hasRelationship: Boolean(relationship),
      relationship: relationship ? {
        entityType: relationship.entity_type,
        entityId: relationship.entity_id,
        provider: relationship.integration?.provider?.name,
      } : undefined,
    };
  });

  return {
    success: true,
    data: {
      totalPendingChats: orderedChatIds.length,
      processed: chats.length,
      chats,
    },
  };
}

function executeBatchDismissTasks(notificationIds: number[]): ToolResult {
  const { dismissTelebizNotification } = getActions();

  const results: Array<{ id: number; success: boolean }> = [];

  for (const notificationId of notificationIds) {
    try {
      dismissTelebizNotification({ notificationId });
      results.push({ id: notificationId, success: true });
    } catch {
      results.push({ id: notificationId, success: false });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: true,
    data: {
      dismissed: successCount,
      total: notificationIds.length,
      results,
    },
  };
}

function executeBatchSnoozeTasks(
  notificationIds: number[],
  snoozeMinutes = 60,
): ToolResult {
  const { snoozeTelebizNotification } = getActions();

  const results: Array<{ id: number; success: boolean }> = [];

  for (const notificationId of notificationIds) {
    try {
      snoozeTelebizNotification({ notificationId, snoozeMinutes });
      results.push({ id: notificationId, success: true });
    } catch {
      results.push({ id: notificationId, success: false });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: true,
    data: {
      snoozed: successCount,
      total: notificationIds.length,
      snoozeMinutes,
      results,
    },
  };
}

function executeSummarizeActions(
  actions: Array<Record<string, string>>,
): ToolResult {
  // Group by action type
  const grouped: Record<string, number> = {};
  for (const action of actions) {
    const type = action.action || 'unknown';
    grouped[type] = (grouped[type] || 0) + 1;
  }

  return {
    success: true,
    data: {
      totalActions: actions.length,
      byType: grouped,
      actions,
      summary: `Completed ${actions.length} actions: ${
        Object.entries(grouped)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ')
      }`,
    },
  };
}

function executeGetWorkflowContext(chatId: string): ToolResult {
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  const notifications = selectTelebizPendingNotificationsByChatId(global, chatId);
  const relationship = selectTelebizSelectedRelationship(global, chatId);

  return {
    success: true,
    data: {
      chat: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
        unreadCount: chat.unreadCount,
      },
      tasks: notifications.map((n) => summarizeNotification(n)),
      relationship: relationship ? {
        entityType: relationship.entity_type,
        entityId: relationship.entity_id,
        integrationId: relationship.integration_id,
        provider: relationship.integration?.provider?.name,
      } : undefined,
      suggestions: generateSuggestions(notifications, relationship),
    },
    affectedChatIds: [chatId],
  };
}

// Helper to summarize a notification
function summarizeNotification(n: Notification): Record<string, unknown> {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    status: n.status,
    createdAt: n.created_at,
    snoozedUntil: n.snoozed_until,
    metadata: {
      chatId: n.metadata?.chat_id,
      messageId: n.metadata?.message_id,
      remindAt: n.metadata?.remind_at,
    },
  };
}

// Generate suggestions based on context
function generateSuggestions(
  notifications: Notification[],
  relationship: ReturnType<typeof selectTelebizSelectedRelationship>,
): string[] {
  const suggestions: string[] = [];

  if (notifications.length > 3) {
    suggestions.push('Consider batch dismissing old tasks');
  }

  if (relationship?.entity_type === 'deal') {
    suggestions.push('Check if deal stage needs updating');
  }

  if (!relationship) {
    suggestions.push('Consider linking this chat to a CRM entity');
  }

  const hasReminders = notifications.some((n) => n.type === 'reminder');
  if (hasReminders) {
    suggestions.push('Review and respond to reminders');
  }

  return suggestions;
}
