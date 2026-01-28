import type { ToolDefinition } from '../types';

/**
 * Tool Registry - Defines all available agent tools with OpenRouter-compatible schemas
 */

// Chat Tools
export const listChats: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listChats',
    description: [
      'Get a list of chats with optional filters. Returns chat IDs, titles, types, and last message info.',
      '',
      'IMPORTANT filter combinations:',
      '- "inactive chats" or "chats I haven\'t heard from": use iAmLastSender=true',
      '- "chats waiting for my response": use iAmLastSender=false',
      '- "old/dormant chats": use lastMessageOlderThanDays with a number like 7, 30',
      '- Combine: iAmLastSender=true + lastMessageOlderThanDays=7 = waiting for reply over a week',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatType: {
          type: 'string',
          enum: ['private', 'group', 'supergroup', 'channel', 'all'],
          description: 'Filter by chat type. Default: all',
        },
        hasUnread: {
          type: 'boolean',
          description: 'true = only unread chats, false = only read chats',
        },
        isArchived: {
          type: 'boolean',
          description: 'true = archived only, false = non-archived only. Omit for both.',
        },
        lastMessageOlderThanDays: {
          type: 'number',
          description: 'Chats where last message is OLDER than N days',
        },
        lastMessageNewerThanDays: {
          type: 'number',
          description: 'Chats where last message is NEWER than N days',
        },
        iAmLastSender: {
          type: 'boolean',
          description: 'true = I sent last message, false = they sent last message',
        },
        titleContains: {
          type: 'string',
          description: 'Filter by chat title containing this text (case-insensitive)',
        },
        folderId: {
          type: 'number',
          description: 'Filter to chats in a specific folder ID',
        },
        limit: {
          type: 'number',
          description: 'Max chats to return (default: 50, max: 200)',
        },
      },
    },
  },
};

export const getChatInfo: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getChatInfo',
    description: [
      'Get detailed information about a specific chat including members count, description, and settings.',
      'For private chats (users), also returns common groups you share with that person.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to get info for',
        },
      },
      required: ['chatId'],
    },
  },
};

export const getCurrentChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getCurrentChat',
    description: 'Get info about the currently open chat. Use when user says "this chat" or "here".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export const openChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'openChat',
    description: 'Navigate to and open a specific chat in the UI.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to open',
        },
      },
      required: ['chatId'],
    },
  },
};

export const archiveChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'archiveChat',
    description: 'Archive a chat to move it to the archived folder.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to archive',
        },
      },
      required: ['chatId'],
    },
  },
};

export const unarchiveChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'unarchiveChat',
    description: 'Unarchive a chat to move it back to the main chat list.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to unarchive',
        },
      },
      required: ['chatId'],
    },
  },
};

export const pinChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'pinChat',
    description: 'Pin a chat to keep it at the top of the chat list.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to pin',
        },
      },
      required: ['chatId'],
    },
  },
};

export const unpinChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'unpinChat',
    description: 'Unpin a chat from the top of the chat list.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to unpin',
        },
      },
      required: ['chatId'],
    },
  },
};

export const muteChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'muteChat',
    description: 'Mute notifications for a chat.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to mute',
        },
        muteUntil: {
          type: 'number',
          description: 'Unix timestamp until when to mute. Use 0 for forever, or omit for default duration.',
        },
      },
      required: ['chatId'],
    },
  },
};

export const unmuteChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'unmuteChat',
    description: 'Unmute notifications for a chat.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to unmute',
        },
      },
      required: ['chatId'],
    },
  },
};

export const deleteChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deleteChat',
    description: 'Delete a chat or leave a group/channel. WARNING: This is a destructive action.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to delete/leave',
        },
      },
      required: ['chatId'],
    },
  },
};

// Message Tools
export const sendMessage: ToolDefinition = {
  type: 'function',
  function: {
    name: 'sendMessage',
    description: 'Send a text message to a chat. Supports Telegram markdown formatting.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to send the message to',
        },
        username: {
          type: 'string',
          description: 'Username (without @) for private chats. Required if chat not previously opened.',
        },
        text: {
          type: 'string',
          description: [
            'The message text. Markdown: **bold**, __italic__, ~~strike~~, `code`, ||spoiler||, [text](url).',
            'To mention/tag users, ALWAYS use @username format (e.g. @johndoe), never use tg://user links.',
          ].join(' '),
        },
        replyToMessageId: {
          type: 'number',
          description: 'Optional message ID to reply to',
        },
      },
      required: ['chatId', 'text'],
    },
  },
};

export const forwardMessages: ToolDefinition = {
  type: 'function',
  function: {
    name: 'forwardMessages',
    description: 'Forward messages from one chat to another.',
    parameters: {
      type: 'object',
      properties: {
        fromChatId: {
          type: 'string',
          description: 'The ID of the chat to forward messages from',
        },
        toChatId: {
          type: 'string',
          description: 'The ID of the chat to forward messages to',
        },
        messageIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of message IDs to forward',
        },
        withoutAuthor: {
          type: 'boolean',
          description: 'Forward without showing the original author',
        },
      },
      required: ['fromChatId', 'toChatId', 'messageIds'],
    },
  },
};

export const deleteMessages: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deleteMessages',
    description: 'Delete messages from a chat. WARNING: This is a destructive action.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat containing the messages',
        },
        messageIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of message IDs to delete',
        },
        forEveryone: {
          type: 'boolean',
          description: 'Delete for all participants (if allowed)',
        },
      },
      required: ['chatId', 'messageIds'],
    },
  },
};

export const searchMessages: ToolDefinition = {
  type: 'function',
  function: {
    name: 'searchMessages',
    description: 'Search for messages by text. Returns content, sender, date. Can search in a chat or globally.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query text to find in messages',
        },
        chatId: {
          type: 'string',
          description: 'Optional chat ID to search within. If omitted, searches globally across all chats.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50, max: 100)',
        },
      },
      required: ['query'],
    },
  },
};

export const getRecentMessages: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getRecentMessages',
    description: [
      'Get messages from a chat. Returns message text, sender info, and timestamps.',
      'Use offset to paginate through older messages.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to get messages from',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 20, max: 100)',
        },
        offset: {
          type: 'number',
          description: [
            'Number of messages to skip from most recent (default: 0).',
            'Use to paginate: offset=0 gets newest, offset=100 gets messages 101-200.',
          ].join(' '),
        },
      },
      required: ['chatId'],
    },
  },
};

export const markChatAsRead: ToolDefinition = {
  type: 'function',
  function: {
    name: 'markChatAsRead',
    description: 'Mark all messages in a chat as read.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to mark as read',
        },
      },
      required: ['chatId'],
    },
  },
};

// Folder Tools
export const listFolders: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listFolders',
    description: 'Get all chat folders with their IDs, names, and included chat counts.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};

export const createFolder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createFolder',
    description: 'Create a new chat folder. IMPORTANT: You MUST provide either includedChatIds with at least one chat, '
      + 'OR at least one chat type filter (includeContacts, includeGroups, includeChannels, etc.). '
      + 'Empty folders cannot be created - always gather the chat IDs first before calling this tool.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The name of the folder',
        },
        includedChatIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of chat IDs to include in the folder. Required if no chat type filters are set.',
        },
        excludedChatIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of chat IDs to exclude from the folder',
        },
        includeContacts: {
          type: 'boolean',
          description: 'Include all contacts',
        },
        includeNonContacts: {
          type: 'boolean',
          description: 'Include non-contacts',
        },
        includeGroups: {
          type: 'boolean',
          description: 'Include groups',
        },
        includeChannels: {
          type: 'boolean',
          description: 'Include channels',
        },
        includeBots: {
          type: 'boolean',
          description: 'Include bots',
        },
      },
      required: ['title'],
    },
  },
};

export const addChatToFolder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'addChatToFolder',
    description: 'Add a chat to one or more folders.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to add',
        },
        folderIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of folder IDs to add the chat to',
        },
      },
      required: ['chatId', 'folderIds'],
    },
  },
};

export const removeChatFromFolder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'removeChatFromFolder',
    description: 'Remove a chat from one or more folders.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to remove',
        },
        folderIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of folder IDs to remove the chat from',
        },
      },
      required: ['chatId', 'folderIds'],
    },
  },
};

export const deleteFolder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deleteFolder',
    description: 'Delete a chat folder. WARNING: This is a destructive action.',
    parameters: {
      type: 'object',
      properties: {
        folderId: {
          type: 'number',
          description: 'The ID of the folder to delete',
        },
      },
      required: ['folderId'],
    },
  },
};

// Member Tools
export const getChatMembers: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getChatMembers',
    description: 'Get the list of members in a group or channel.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the chat to get members for',
        },
        filter: {
          type: 'string',
          enum: ['all', 'admins', 'kicked', 'restricted', 'bots'],
          description: 'Filter members by type',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of members to return (default: 200)',
        },
      },
      required: ['chatId'],
    },
  },
};

export const addChatMembers: ToolDefinition = {
  type: 'function',
  function: {
    name: 'addChatMembers',
    description: 'Add users to a group chat.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the group to add members to',
        },
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs to add',
        },
      },
      required: ['chatId', 'userIds'],
    },
  },
};

export const removeChatMember: ToolDefinition = {
  type: 'function',
  function: {
    name: 'removeChatMember',
    description: 'Remove a user from a group chat. WARNING: This is a destructive action.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The ID of the group to remove the member from',
        },
        userId: {
          type: 'string',
          description: 'The user ID to remove',
        },
      },
      required: ['chatId', 'userId'],
    },
  },
};

export const createGroup: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createGroup',
    description: 'Create a new group chat with specified members.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The name/title of the new group',
        },
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs to add to the group',
        },
      },
      required: ['title', 'memberIds'],
    },
  },
};

// User Tools
export const searchUsers: ToolDefinition = {
  type: 'function',
  function: {
    name: 'searchUsers',
    description: 'Search for users by name or username.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (name or @username)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
      required: ['query'],
    },
  },
};

export const getUserInfo: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getUserInfo',
    description: [
      'Get basic information about a user (name, username, phone).',
      'For common groups with a user, use getChatInfo with their userId instead.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The ID of the user to get info for',
        },
      },
      required: ['userId'],
    },
  },
};

// Bulk Operation Tools
export const batchSendMessage: ToolDefinition = {
  type: 'function',
  function: {
    name: 'batchSendMessage',
    description: 'Send the same message to multiple chats.',
    parameters: {
      type: 'object',
      properties: {
        chatIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of chat IDs to send the message to',
        },
        usernames: {
          type: 'array',
          items: { type: 'string' },
          description: [
            'Array of usernames (without @) for private chats not previously opened.',
            'Must match chatIds array order. Use empty string for chats that are already open.',
          ].join(' '),
        },
        text: {
          type: 'string',
          description: 'The message text to send',
        },
        delayMs: {
          type: 'number',
          description: 'Delay in milliseconds between each message (default: 1000)',
        },
      },
      required: ['chatIds', 'text'],
    },
  },
};

export const batchAddToFolder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'batchAddToFolder',
    description: 'Add multiple chats to an existing folder in a single operation. '
      + 'Use this to add chats to a folder that already exists. '
      + 'For new folders, prefer createFolder with includedChatIds instead of creating empty folder then using this.',
    parameters: {
      type: 'object',
      properties: {
        chatIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of chat IDs to add to the folder',
        },
        folderId: {
          type: 'number',
          description: 'The ID of the folder to add chats to',
        },
      },
      required: ['chatIds', 'folderId'],
    },
  },
};

export const batchArchive: ToolDefinition = {
  type: 'function',
  function: {
    name: 'batchArchive',
    description: 'Archive multiple chats at once.',
    parameters: {
      type: 'object',
      properties: {
        chatIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of chat IDs to archive',
        },
      },
      required: ['chatIds'],
    },
  },
};

/**
 * All available tools grouped by category
 */
export const TOOL_CATEGORIES = {
  chat: [
    listChats,
    getChatInfo,
    getCurrentChat,
    openChat,
    archiveChat,
    unarchiveChat,
    pinChat,
    unpinChat,
    muteChat,
    unmuteChat,
    deleteChat,
  ],
  message: [
    sendMessage,
    forwardMessages,
    deleteMessages,
    searchMessages,
    getRecentMessages,
    markChatAsRead,
  ],
  folder: [
    listFolders,
    createFolder,
    addChatToFolder,
    removeChatFromFolder,
    deleteFolder,
  ],
  member: [
    getChatMembers,
    addChatMembers,
    removeChatMember,
    createGroup,
  ],
  user: [
    searchUsers,
    getUserInfo,
  ],
  batch: [
    batchSendMessage,
    batchAddToFolder,
    batchArchive,
  ],
} as const;

// NOTE: ALL_TOOLS and READ_ONLY_TOOLS are defined at the end of the file
// after TELEBIZ_CORE_TOOLS to avoid forward reference issues

/**
 * UI-only tools that affect the user interface but don't modify data
 * These should only be called when user explicitly requests UI changes
 */
export const UI_TOOLS: ToolDefinition[] = [
  openChat,
];

/**
 * Get tool definition by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((tool) => tool.function.name === name);
}

/**
 * Check if a tool is read-only (doesn't modify state)
 */
export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.some((t) => t.function.name === toolName);
}

/**
 * Check if a tool is UI-only (affects user interface)
 */
export function isUITool(toolName: string): boolean {
  return UI_TOOLS.some((t) => t.function.name === toolName);
}

/**
 * Tools that require confirmation before execution (destructive actions)
 */
export const DESTRUCTIVE_TOOLS = new Set([
  'deleteChat',
  'deleteMessages',
  'deleteFolder',
  'removeChatMember',
  'batchSendMessage',
]);

/**
 * Tools that can be undone
 */
export const REVERSIBLE_TOOLS: Record<string, string> = {
  archiveChat: 'unarchiveChat',
  unarchiveChat: 'archiveChat',
  pinChat: 'unpinChat',
  unpinChat: 'pinChat',
  muteChat: 'unmuteChat',
  unmuteChat: 'muteChat',
  addChatToFolder: 'removeChatFromFolder',
  removeChatFromFolder: 'addChatToFolder',
};

/**
 * Check if a tool is destructive
 */
export function isDestructiveTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOLS.has(toolName);
}

/**
 * Check if a tool can be undone
 */
export function canUndoTool(toolName: string): boolean {
  return toolName in REVERSIBLE_TOOLS;
}

/**
 * Get the undo action for a tool
 */
export function getUndoTool(toolName: string): string | undefined {
  return REVERSIBLE_TOOLS[toolName];
}

// ============================================================================
// TELEBIZ CORE TOOLS (Always Available)
// ============================================================================

/**
 * List all chats with pending tasks/notifications
 */
export const listPendingChats: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listPendingChats',
    description: [
      'Get all Telegram chats that have pending tasks/notifications.',
      'Returns chats ordered by priority with task count and linked CRM entity info.',
      'Use this to see what needs attention across your chats.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum chats to return (default: 50)',
        },
      },
    },
  },
};

/**
 * Get tasks for a specific chat
 */
export const getChatTasks: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getChatTasks',
    description: [
      'Get pending notifications/tasks for a specific chat.',
      'Returns task details including type, message, and when it was created.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID',
        },
      },
      required: ['chatId'],
    },
  },
};

/**
 * Get the active CRM relationship for a chat
 */
export const getChatRelationship: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getChatRelationship',
    description: [
      'Get the active CRM entity linked to a Telegram chat.',
      'Returns entity type (contact, deal, page), ID, and provider (HubSpot, Notion).',
      'Use this to understand the business context of a chat.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID',
        },
      },
      required: ['chatId'],
    },
  },
};

/**
 * Dismiss a task/notification
 */
export const dismissTask: ToolDefinition = {
  type: 'function',
  function: {
    name: 'dismissTask',
    description: 'Dismiss a notification/task, removing it from pending.',
    parameters: {
      type: 'object',
      properties: {
        notificationId: {
          type: 'number',
          description: 'The notification ID to dismiss',
        },
      },
      required: ['notificationId'],
    },
  },
};

/**
 * Snooze a task/notification
 */
export const snoozeTask: ToolDefinition = {
  type: 'function',
  function: {
    name: 'snoozeTask',
    description: 'Snooze a notification/task for a period of time.',
    parameters: {
      type: 'object',
      properties: {
        notificationId: {
          type: 'number',
          description: 'The notification ID to snooze',
        },
        snoozeMinutes: {
          type: 'number',
          description: 'Minutes to snooze for (default: 60). Common values: 15, 60, 240, 1440 (1 day)',
        },
      },
      required: ['notificationId'],
    },
  },
};

/**
 * Load an extra tool to get additional tools
 */
export const useExtraTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'useExtraTool',
    description: [
      'Load an extra tool to get additional specialized tools.',
      '',
      'Available extra tools:',
      '- "crm" - HubSpot/CRM operations (deals, contacts, stages)',
      '- "notion" - Notion page editing and todos',
      '- "reminders" - Reminder management',
      '- "bulk" - Batch operations across multiple chats',
      '- "skills" - Manage user-created skills',
      '',
      'After loading an extra tool, you will have access to its tools.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        extraTool: {
          type: 'string',
          enum: ['crm', 'notion', 'reminders', 'bulk', 'skills'],
          description: 'The extra tool to load',
        },
      },
      required: ['extraTool'],
    },
  },
};

/**
 * Telebiz core tools that are always available
 */
export const TELEBIZ_CORE_TOOLS: ToolDefinition[] = [
  listPendingChats,
  getChatTasks,
  getChatRelationship,
  dismissTask,
  snoozeTask,
  useExtraTool,
];

/**
 * Read-only Telebiz tools
 */
export const TELEBIZ_READ_ONLY_TOOLS: ToolDefinition[] = [
  listPendingChats,
  getChatTasks,
  getChatRelationship,
];

/**
 * All tools as a flat array (Telegram + Telebiz core)
 */
export const ALL_TOOLS: ToolDefinition[] = [
  ...Object.values(TOOL_CATEGORIES).flat(),
  ...TELEBIZ_CORE_TOOLS,
];

/**
 * Read-only tools that don't modify any state - safe for Ask mode
 * These tools only read data and don't perform any actions
 */
export const READ_ONLY_TOOLS: ToolDefinition[] = [
  listChats,
  getChatInfo,
  getCurrentChat,
  getRecentMessages,
  searchMessages,
  listFolders,
  getChatMembers,
  searchUsers,
  getUserInfo,
  // Telebiz read-only tools
  ...TELEBIZ_READ_ONLY_TOOLS,
];
