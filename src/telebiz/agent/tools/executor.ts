import { getActions, getGlobal, setGlobal } from '../../../global';

import type { ApiChat, ApiChatFolder, ApiMessage } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ExtraToolName, ToolResult } from '../types';

import {
  isChatArchived,
  isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
} from '../../../global/helpers';
import { updateChat } from '../../../global/reducers/chats';
import { updateUser } from '../../../global/reducers/users';
import {
  selectChat,
  selectChatFolder,
  selectChatFullInfo,
  selectChatLastMessage,
  selectChatMessages,
  selectCurrentChat,
  selectIsChatPinned,
  selectListedIds,
  selectPeer,
} from '../../../global/selectors';
import { selectUser, selectUserCommonChats } from '../../../global/selectors/users';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getOrderedIds } from '../../../util/folderManager';
import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';
import { pause } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { canUndoTool, getUndoTool } from './registry';
import { executeExtraToolTool, EXTRA_TOOLS_REGISTRY, getToolExtraTool } from './skills';

const BATCH_DELAY_MS = 1000;
const ALL_FOLDER_ID = 0;

// Rate limiting to prevent Telegram flood protection
const RATE_LIMIT_CONFIG = {
  // Minimum delay between ANY API calls (ms)
  MIN_CALL_DELAY_MS: 500,
  // Extra delay for heavy operations like getChatInfo
  HEAVY_CALL_DELAY_MS: 1000,
  // Maximum calls per minute
  MAX_CALLS_PER_MINUTE: 30,
  // Maximum calls per single agent request
  MAX_CALLS_PER_REQUEST: 20,
};

// Track call timestamps for rate limiting
const callHistory: number[] = [];
let callsInCurrentRequest = 0;

// Heavy operations that need more delay (mutating/creating operations only)
const HEAVY_OPERATIONS = new Set([
  'sendMessage',
  'forwardMessages',
  'deleteMessages',
  'createGroup',
  'addChatMembers',
  'removeChatMember',
  'archiveChat',
  'deleteChat',
  'createFolder',
  'deleteFolder',
  'batchSendMessage',
  'batchArchive',
  'batchAddToFolder',
]);

/**
 * Reset the per-request call counter (call at start of new agent request)
 */
export function resetRequestCallCount(): void {
  callsInCurrentRequest = 0;
}

/**
 * Enforce rate limiting before making an API call
 */
async function enforceRateLimit(toolName: string): Promise<{ allowed: boolean; error?: string }> {
  const now = Date.now();

  // Check per-request limit
  if (callsInCurrentRequest >= RATE_LIMIT_CONFIG.MAX_CALLS_PER_REQUEST) {
    return {
      allowed: false,
      error: `Rate limit: Maximum ${RATE_LIMIT_CONFIG.MAX_CALLS_PER_REQUEST} API calls per request reached. `
        + 'Please be more specific or break your request into smaller parts.',
    };
  }

  // Clean old entries (older than 1 minute)
  const oneMinuteAgo = now - 60000;
  while (callHistory.length > 0 && callHistory[0] < oneMinuteAgo) {
    callHistory.shift();
  }

  // Check per-minute limit
  if (callHistory.length >= RATE_LIMIT_CONFIG.MAX_CALLS_PER_MINUTE) {
    const waitTime = Math.ceil((callHistory[0] + 60000 - now) / 1000);
    return {
      allowed: false,
      error: `Rate limit: Too many API calls. Please wait ${waitTime} seconds before trying again.`,
    };
  }

  // Calculate required delay
  const lastCallTime = callHistory.length > 0 ? callHistory[callHistory.length - 1] : 0;
  const isHeavyOperation = HEAVY_OPERATIONS.has(toolName);
  const requiredDelay = isHeavyOperation
    ? RATE_LIMIT_CONFIG.HEAVY_CALL_DELAY_MS
    : RATE_LIMIT_CONFIG.MIN_CALL_DELAY_MS;

  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < requiredDelay) {
    await pause(requiredDelay - timeSinceLastCall);
  }

  // Record this call
  callHistory.push(Date.now());
  callsInCurrentRequest++;

  return { allowed: true };
}

interface ListChatsFilter {
  chatType?: 'private' | 'group' | 'supergroup' | 'channel' | 'all';
  hasUnread?: boolean;
  isArchived?: boolean;
  lastMessageOlderThanDays?: number;
  lastMessageNewerThanDays?: number;
  iAmLastSender?: boolean;
  titleContains?: string;
  folderId?: number;
  limit?: number;
}

interface ChatInfo {
  id: string;
  title: string;
  type: string;
  membersCount?: number;
  lastMessageDate?: number;
  unreadCount?: number;
  isArchived: boolean;
  isPinned: boolean;
}

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // Enforce rate limiting for mutating tools only
  const skipRateLimitTools = new Set([
    // Read-only tools - just read from global state
    'listChats',
    'listFolders',
    'getChatInfo',
    'getCurrentChat',
    'getRecentMessages',
    'getChatMembers',
    'getUserInfo',
    'searchUsers',
    'searchMessages',
    // UI-only tools - no API calls
    'openChat',
    // Batch tools - handle rate limits internally
    'batchSendMessage',
    'batchAddToFolder',
    'batchArchive',
  ]);
  if (!skipRateLimitTools.has(toolName)) {
    const rateCheck = await enforceRateLimit(toolName);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error };
    }
  }

  try {
    switch (toolName) {
      // Chat Tools
      case 'listChats':
        // All filter params are now flat on args (no nested filter object)
        return executeListChats(args as ListChatsFilter);
      case 'getChatInfo':
        return executeGetChatInfo(args.chatId as string);
      case 'getCurrentChat':
        return executeGetCurrentChat();
      case 'openChat':
        return executeOpenChat(args.chatId as string);
      case 'archiveChat':
        return executeArchiveChat(args.chatId as string);
      case 'unarchiveChat':
        return executeUnarchiveChat(args.chatId as string);
      case 'pinChat':
        return executePinChat(args.chatId as string);
      case 'unpinChat':
        return executeUnpinChat(args.chatId as string);
      case 'muteChat':
        return executeMuteChat(args.chatId as string, args.muteUntil as number | undefined);
      case 'unmuteChat':
        return executeUnmuteChat(args.chatId as string);
      case 'deleteChat':
        return executeDeleteChat(args.chatId as string);

      // Message Tools
      case 'sendMessage':
        return executeSendMessage(
          args.chatId as string,
          args.text as string,
          args.username as string | undefined,
          args.replyToMessageId as number | undefined,
        );
      case 'forwardMessages':
        return executeForwardMessages(
          args.fromChatId as string,
          args.toChatId as string,
          args.messageIds as number[],
          args.withoutAuthor as boolean | undefined,
        );
      case 'deleteMessages':
        return executeDeleteMessages(
          args.chatId as string,
          args.messageIds as number[],
          args.forEveryone as boolean | undefined,
        );
      case 'searchMessages':
        return executeSearchMessages(
          args.query as string,
          args.chatId as string | undefined,
          args.limit as number | undefined,
        );
      case 'getRecentMessages':
        return executeGetRecentMessages(
          args.chatId as string,
          args.limit as number | undefined,
          args.offset as number | undefined,
        );
      case 'markChatAsRead':
        return executeMarkChatAsRead(args.chatId as string);

      // Folder Tools
      case 'listFolders':
        return executeListFolders();
      case 'createFolder':
        return executeCreateFolder(args as {
          title: string;
          includedChatIds?: string[];
          excludedChatIds?: string[];
          includeContacts?: boolean;
          includeNonContacts?: boolean;
          includeGroups?: boolean;
          includeChannels?: boolean;
          includeBots?: boolean;
        });
      case 'addChatToFolder':
        return executeAddChatToFolder(args.chatId as string, args.folderIds as number[]);
      case 'removeChatFromFolder':
        return executeRemoveChatFromFolder(args.chatId as string, args.folderIds as number[]);
      case 'deleteFolder':
        return executeDeleteFolder(args.folderId as number);

      // Member Tools
      case 'getChatMembers':
        return executeGetChatMembers(
          args.chatId as string,
          args.filter as string | undefined,
          args.limit as number | undefined,
        );
      case 'addChatMembers':
        return executeAddChatMembers(args.chatId as string, args.userIds as string[]);
      case 'removeChatMember':
        return executeRemoveChatMember(args.chatId as string, args.userId as string);
      case 'createGroup':
        return executeCreateGroup(args.title as string, args.memberIds as string[]);

      // User Tools
      case 'searchUsers':
        return executeSearchUsers(args.query as string, args.limit as number | undefined);
      case 'getUserInfo':
        return executeGetUserInfo(args.userId as string);

      // Batch Tools
      case 'batchSendMessage':
        return executeBatchSendMessage(
          args.chatIds as string[],
          args.text as string,
          args.usernames as string[] | undefined,
          args.delayMs as number | undefined,
        );
      case 'batchAddToFolder':
        return executeBatchAddToFolder(args.chatIds as string[], args.folderId as number);
      case 'batchArchive':
        return executeBatchArchive(args.chatIds as string[]);

      // Telebiz Core Tools
      case 'listPendingChats':
        return executeListPendingChats(args.limit as number | undefined);
      case 'getChatTasks':
        return executeGetChatTasks(args.chatId as string);
      case 'getChatRelationship':
        return executeGetChatRelationship(args.chatId as string);
      case 'dismissTask':
        return executeDismissTask(args.notificationId as number);
      case 'snoozeTask':
        return executeSnoozeTask(args.notificationId as number, args.snoozeMinutes as number | undefined);
      case 'useExtraTool':
        return executeUseExtraTool(args.extraTool as string);

      default: {
        // Check if this is an extra tool
        const extraToolResult = await executeExtraToolIfExists(toolName, args);
        if (extraToolResult) {
          return extraToolResult;
        }
        return { success: false, error: `Unknown tool: ${toolName}` };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Build undo action if the tool is reversible
 */
export function buildUndoAction(
  toolName: string,
  args: Record<string, unknown>,
): { tool: string; args: Record<string, unknown> } | undefined {
  if (!canUndoTool(toolName)) return undefined;

  const undoTool = getUndoTool(toolName)!;
  return { tool: undoTool, args };
}

// Chat Tool Implementations

function executeListChats(filter: ListChatsFilter = {}): ToolResult {
  const global = getGlobal();
  const allChatIds = getOrderedIds(filter.folderId ?? ALL_FOLDER_ID) || [];

  const results: ChatInfo[] = [];
  const currentUserId = global.currentUserId;
  const now = getServerTime();
  const limit = Math.min(filter.limit ?? 50, 200);

  // Track filter stats for debugging
  let totalChecked = 0;
  let filteredOut = 0;

  for (const chatId of allChatIds) {
    if (results.length >= limit) break;

    const chat = selectChat(global, chatId);
    if (!chat) continue;

    totalChecked++;

    // Apply filters
    if (!matchesChatFilter(global, chat, filter, currentUserId, now)) {
      filteredOut++;
      continue;
    }

    const lastMessage = selectChatLastMessage(global, chatId);
    const isPinned = selectIsChatPinned(global, chatId, filter.folderId);

    results.push({
      id: chat.id,
      title: chat.title,
      type: getChatTypeString(chat),
      membersCount: chat.membersCount,
      lastMessageDate: lastMessage?.date,
      unreadCount: chat.unreadCount,
      isArchived: isChatArchived(chat),
      isPinned,
    });
  }

  // Build active filters list for clarity
  const activeFilters: string[] = [];
  if (filter.chatType && filter.chatType !== 'all') activeFilters.push(`type=${filter.chatType}`);
  if (filter.hasUnread !== undefined) activeFilters.push(`hasUnread=${filter.hasUnread}`);
  if (filter.isArchived !== undefined) activeFilters.push(`isArchived=${filter.isArchived}`);
  if (filter.lastMessageOlderThanDays !== undefined) {
    activeFilters.push(`lastMessageOlderThan=${filter.lastMessageOlderThanDays}days`);
  }
  if (filter.lastMessageNewerThanDays !== undefined) {
    activeFilters.push(`lastMessageNewerThan=${filter.lastMessageNewerThanDays}days`);
  }
  if (filter.iAmLastSender !== undefined) activeFilters.push(`iAmLastSender=${filter.iAmLastSender}`);
  if (filter.titleContains) activeFilters.push(`titleContains="${filter.titleContains}"`);
  if (filter.folderId !== undefined) activeFilters.push(`folderId=${filter.folderId}`);

  return {
    success: true,
    data: {
      chats: results,
      totalFound: results.length,
      totalChecked,
      filteredOut,
      filtersApplied: activeFilters.length > 0 ? activeFilters : ['none'],
    },
    affectedChatIds: results.map((c) => c.id),
  };
}

function matchesChatFilter(
  global: GlobalState,
  chat: ApiChat,
  filter: ListChatsFilter,
  currentUserId: string | undefined,
  now: number,
): boolean {
  // Type filter (renamed from 'type' to 'chatType' to avoid JSON schema confusion)
  if (filter.chatType && filter.chatType !== 'all') {
    const chatType = getChatTypeString(chat);
    if (chatType !== filter.chatType) return false;
  }

  // Unread filter
  if (filter.hasUnread !== undefined) {
    const hasUnread = (chat.unreadCount || 0) > 0;
    if (hasUnread !== filter.hasUnread) return false;
  }

  // Archived filter
  if (filter.isArchived !== undefined) {
    if (isChatArchived(chat) !== filter.isArchived) return false;
  }

  // Title contains
  if (filter.titleContains) {
    if (!chat.title.toLowerCase().includes(filter.titleContains.toLowerCase())) return false;
  }

  // Last message date filters - require last message for these filters
  const lastMessage = selectChatLastMessage(global, chat.id);

  // If any message-related filter is specified but there's no last message, exclude this chat
  const hasMessageFilter = filter.lastMessageOlderThanDays !== undefined
    || filter.lastMessageNewerThanDays !== undefined
    || filter.iAmLastSender !== undefined;

  if (hasMessageFilter && !lastMessage) {
    return false;
  }

  if (lastMessage) {
    // Calculate days since last message (now is already in seconds from getServerTime)
    const daysSinceLastMessage = (now - lastMessage.date) / (24 * 60 * 60);

    if (filter.lastMessageOlderThanDays !== undefined) {
      if (daysSinceLastMessage < filter.lastMessageOlderThanDays) return false;
    }

    if (filter.lastMessageNewerThanDays !== undefined) {
      if (daysSinceLastMessage > filter.lastMessageNewerThanDays) return false;
    }

    // I am last sender filter - check if current user sent the last message
    if (filter.iAmLastSender !== undefined && currentUserId) {
      // For outgoing messages, isOutgoing is true. Alternatively check senderId
      const isLastSender = lastMessage.isOutgoing || lastMessage.senderId === currentUserId;
      if (isLastSender !== filter.iAmLastSender) return false;
    }
  }

  return true;
}

function getChatTypeString(chat: ApiChat): string {
  if (chat.type === 'chatTypePrivate') return 'private';
  if (isChatChannel(chat)) return 'channel';
  if (isChatSuperGroup(chat)) return 'supergroup';
  if (isChatBasicGroup(chat)) return 'group';
  return 'private';
}

function executeGetChatInfo(chatId: string): ToolResult {
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  const fullInfo = selectChatFullInfo(global, chatId);
  const lastMessage = selectChatLastMessage(global, chatId);
  const chatType = getChatTypeString(chat);

  // For private chats, include common groups with this user
  let commonGroups: { id: string; title: string }[] | undefined;
  if (chatType === 'private') {
    const userId = chatId; // For private chats, chatId equals userId
    const commonChats = selectUserCommonChats(global, userId);

    if (commonChats?.ids && commonChats.ids.length > 0) {
      commonGroups = commonChats.ids
        .map((commonChatId) => {
          const commonChat = selectChat(global, commonChatId);
          return commonChat ? { id: commonChat.id, title: commonChat.title } : undefined;
        })
        .filter((g): g is { id: string; title: string } => Boolean(g));
    } else {
      // Trigger loading common chats if not cached
      const { loadCommonChats } = getActions();
      loadCommonChats({ userId });
    }
  }

  return {
    success: true,
    data: {
      id: chat.id,
      title: chat.title,
      type: chatType,
      membersCount: chat.membersCount || fullInfo?.members?.length,
      description: fullInfo?.about,
      lastMessageDate: lastMessage?.date,
      unreadCount: chat.unreadCount,
      isArchived: isChatArchived(chat),
      isPinned: selectIsChatPinned(global, chatId),
      isVerified: chat.isVerified,
      isForum: chat.isForum,
      usernames: chat.usernames,
      ...(chatType === 'private' && {
        commonGroups,
        commonGroupsNote: commonGroups
          ? `${commonGroups.length} shared group(s)`
          : 'Loading common groups... Call getChatInfo again to see them.',
      }),
    },
    affectedChatIds: [chatId],
  };
}

function executeGetCurrentChat(): ToolResult {
  const global = getGlobal();
  const tabId = getCurrentTabId();
  const chat = selectCurrentChat(global, tabId);

  if (!chat) {
    return { success: false, error: 'No chat is currently open' };
  }

  const fullInfo = selectChatFullInfo(global, chat.id);
  const lastMessage = selectChatLastMessage(global, chat.id);

  return {
    success: true,
    data: {
      id: chat.id,
      title: chat.title,
      type: getChatTypeString(chat),
      membersCount: chat.membersCount || fullInfo?.members?.length,
      description: fullInfo?.about,
      lastMessageDate: lastMessage?.date,
      unreadCount: chat.unreadCount,
      isArchived: isChatArchived(chat),
      isPinned: selectIsChatPinned(global, chat.id),
      isVerified: chat.isVerified,
      isForum: chat.isForum,
      usernames: chat.usernames,
    },
    affectedChatIds: [chat.id],
  };
}

function executeOpenChat(chatId: string): ToolResult {
  const { openChat } = getActions();
  openChat({ id: chatId, tabId: getCurrentTabId() });

  return {
    success: true,
    data: { opened: chatId },
    affectedChatIds: [chatId],
  };
}

function executeArchiveChat(chatId: string): ToolResult {
  const { toggleChatArchived } = getActions();
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  if (isChatArchived(chat)) {
    return { success: true, data: { alreadyArchived: true }, affectedChatIds: [chatId] };
  }

  toggleChatArchived({ id: chatId });

  return {
    success: true,
    data: { archived: chatId },
    affectedChatIds: [chatId],
  };
}

function executeUnarchiveChat(chatId: string): ToolResult {
  const { toggleChatArchived } = getActions();
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  if (!isChatArchived(chat)) {
    return { success: true, data: { alreadyUnarchived: true }, affectedChatIds: [chatId] };
  }

  toggleChatArchived({ id: chatId });

  return {
    success: true,
    data: { unarchived: chatId },
    affectedChatIds: [chatId],
  };
}

function executePinChat(chatId: string, folderId = ALL_FOLDER_ID): ToolResult {
  const { toggleChatPinned } = getActions();
  const global = getGlobal();

  if (selectIsChatPinned(global, chatId, folderId)) {
    return { success: true, data: { alreadyPinned: true }, affectedChatIds: [chatId] };
  }

  toggleChatPinned({ id: chatId, folderId, tabId: getCurrentTabId() });

  return {
    success: true,
    data: { pinned: chatId },
    affectedChatIds: [chatId],
  };
}

function executeUnpinChat(chatId: string, folderId = ALL_FOLDER_ID): ToolResult {
  const { toggleChatPinned } = getActions();
  const global = getGlobal();

  if (!selectIsChatPinned(global, chatId, folderId)) {
    return { success: true, data: { alreadyUnpinned: true }, affectedChatIds: [chatId] };
  }

  toggleChatPinned({ id: chatId, folderId, tabId: getCurrentTabId() });

  return {
    success: true,
    data: { unpinned: chatId },
    affectedChatIds: [chatId],
  };
}

function executeMuteChat(chatId: string, muteUntil?: number): ToolResult {
  const { updateChatMutedState } = getActions();

  // mutedUntil: 0 = unmuted, MAX_INT_32 = muted forever, timestamp = muted until that time
  const MAX_INT_32 = 2147483647;
  const mutedUntil = muteUntil === 0 ? MAX_INT_32 : (muteUntil || (Math.floor(Date.now() / 1000) + 8 * 60 * 60));
  updateChatMutedState({ chatId, mutedUntil });

  return {
    success: true,
    data: { muted: chatId, until: mutedUntil },
    affectedChatIds: [chatId],
  };
}

function executeUnmuteChat(chatId: string): ToolResult {
  const { updateChatMutedState } = getActions();

  updateChatMutedState({ chatId, mutedUntil: 0 });

  return {
    success: true,
    data: { unmuted: chatId },
    affectedChatIds: [chatId],
  };
}

function executeDeleteChat(chatId: string): ToolResult {
  const { leaveChannel, deleteChat } = getActions();
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  if (isChatChannel(chat) || isChatSuperGroup(chat)) {
    leaveChannel({ chatId, tabId: getCurrentTabId() });
  } else {
    deleteChat({ chatId, tabId: getCurrentTabId() });
  }

  return {
    success: true,
    data: { deleted: chatId },
    affectedChatIds: [chatId],
  };
}

// Message Tool Implementations

/**
 * Convert standard markdown to Telegram markdown format.
 * LLMs often use different syntax than Telegram expects.
 */
function convertToTelegramMarkdown(text: string): string {
  let result = text;

  // Convert markdown headers to bold (Telegram doesn't support headers)
  // Must be done first before other conversions
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  // Convert *italic* to __italic__ (but not **bold**)
  result = result.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '__$1__');

  // Convert _italic_ to __italic__ (but not __already__)
  result = result.replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, '__$1__');

  // Convert ~strikethrough~ to ~~strikethrough~~ (Telegram requires double tildes)
  result = result.replace(/(?<!~)~(?!~)([^~\n]+?)(?<!~)~(?!~)/g, '~~$1~~');

  return result;
}

async function executeSendMessage(
  chatId: string,
  text: string,
  username?: string,
  replyToMessageId?: number,
): Promise<ToolResult> {
  const { sendMessage } = getActions();
  const tabId = getCurrentTabId();

  // 1. Check if chat already exists in state (no API call needed)
  let global = getGlobal();
  let chat = selectChat(global, chatId);

  // 2. If chat doesn't exist and we have username, fetch it
  if (!chat && username) {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    const result = await callApi('getChatByUsername', cleanUsername);

    if (result?.chat) {
      global = getGlobal();
      global = updateChat(global, result.chat.id, result.chat);
      if (result.user) {
        global = updateUser(global, result.user.id, result.user);
      }
      setGlobal(global);
      chat = result.chat;
    }
  }

  // 3. If still no chat, return error with clear message
  if (!chat) {
    if (username) {
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      return {
        success: false,
        error: `User @${cleanUsername} not found`,
      };
    }
    return {
      success: false,
      error: `Chat ${chatId} not found. Username is required for private chats that haven't been opened.`,
    };
  }

  // 4. Now safe to send
  const telegramText = convertToTelegramMarkdown(text);
  const formattedText = parseHtmlAsFormattedText(telegramText, true);

  sendMessage({
    text: formattedText.text,
    entities: formattedText.entities,
    messageList: { chatId: chat.id, threadId: -1, type: 'thread' },
    replyInfo: replyToMessageId ? { type: 'message', replyToMsgId: replyToMessageId } : undefined,
    tabId,
  });

  const preview = formattedText.text.substring(0, 50) + (formattedText.text.length > 50 ? '...' : '');

  return {
    success: true,
    data: { sent: true, chatId: chat.id, text: preview },
    affectedChatIds: [chat.id],
  };
}

function executeForwardMessages(
  fromChatId: string,
  toChatId: string,
  messageIds: number[],
  withoutAuthor?: boolean,
): ToolResult {
  // Forward messages requires:
  // 1. openForwardMenu - sets up source chat and messages
  // 2. setForwardChatOrTopic - sets target chat
  // 3. forwardMessages - executes the forward
  const { openForwardMenu, setForwardChatOrTopic, forwardMessages } = getActions();
  const tabId = getCurrentTabId();

  // Step 1: Set up forward state with source
  openForwardMenu({
    fromChatId,
    messageIds,
    withMyScore: false,
    tabId,
  });

  // Step 2: Set target chat
  setForwardChatOrTopic({ chatId: toChatId, tabId });

  // Step 3: Execute forward (isSilent to avoid notification)
  forwardMessages({ isSilent: true, tabId });

  return {
    success: true,
    data: { forwarded: messageIds.length, from: fromChatId, to: toChatId },
    affectedChatIds: [fromChatId, toChatId],
  };
}

function executeDeleteMessages(chatId: string, messageIds: number[], forEveryone?: boolean): ToolResult {
  const { deleteMessages } = getActions();
  const tabId = getCurrentTabId();

  deleteMessages({
    messageIds,
    shouldDeleteForAll: forEveryone,
    tabId,
  });

  return {
    success: true,
    data: { deleted: messageIds.length, chatId },
    affectedChatIds: [chatId],
  };
}

async function executeSearchMessages(query: string, chatId?: string, limit = 50): Promise<ToolResult> {
  const global = getGlobal();

  if (chatId) {
    // Chat-specific search via API
    const peer = selectPeer(global, chatId);
    if (!peer) {
      return { success: false, error: `Chat not found: ${chatId}` };
    }

    const result = await callApi('searchMessagesInChat', {
      peer,
      type: 'text',
      query,
      limit: Math.min(limit, 100),
    });

    if (!result || !result.messages) {
      return {
        success: true,
        data: { query, chatId, messages: [], totalCount: 0 },
        affectedChatIds: [chatId],
      };
    }

    const messages = result.messages.map((msg: ApiMessage) => ({
      id: msg.id,
      date: msg.date,
      text: msg.content.text?.text || '[Non-text message]',
      senderId: msg.senderId,
      isOutgoing: msg.isOutgoing,
    }));

    return {
      success: true,
      data: {
        query,
        chatId,
        messages,
        totalCount: result.totalCount || messages.length,
      },
      affectedChatIds: [chatId],
    };
  }

  // Global search via API
  const result = await callApi('searchMessagesGlobal', {
    query,
    type: 'text',
    limit: Math.min(limit, 100),
  });

  if (!result || !result.messages) {
    return {
      success: true,
      data: { query, messages: [], totalCount: 0 },
    };
  }

  const messages = result.messages.map((msg: ApiMessage) => ({
    id: msg.id,
    chatId: msg.chatId,
    date: msg.date,
    text: msg.content.text?.text || '[Non-text message]',
    senderId: msg.senderId,
    isOutgoing: msg.isOutgoing,
  }));

  return {
    success: true,
    data: {
      query,
      messages,
      totalCount: result.totalCount || messages.length,
    },
  };
}

function formatMessageForAgent(msg: ApiMessage, global: GlobalState) {
  const sender = msg.senderId ? selectUser(global, msg.senderId) : undefined;
  const { content } = msg;

  return {
    id: msg.id,
    date: msg.date,
    dateFormatted: new Date(msg.date * 1000).toLocaleString(),
    senderId: msg.senderId,
    senderName: sender
      ? (`${sender.firstName || ''}${sender.lastName ? ` ${sender.lastName}` : ''}`.trim()
        || sender.usernames?.[0]?.username || 'User')
      : 'Unknown',
    text: content.text?.text || '',
    hasMedia: Boolean(content.photo || content.video || content.document || content.sticker),
    mediaType: content.photo ? 'photo'
      : content.video ? 'video'
        : content.document ? 'document'
          : content.sticker ? 'sticker'
            : content.voice ? 'voice'
              : content.audio ? 'audio' : undefined,
    isOutgoing: msg.isOutgoing,
  };
}

async function executeGetRecentMessages(chatId: string, limit = 20, offset = 0): Promise<ToolResult> {
  let global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  const maxMessages = Math.min(limit, 100);
  const messagesById = selectChatMessages(global, chatId);
  const listedIds = selectListedIds(global, chatId, -1);
  const cachedCount = listedIds?.length || 0;
  const canUseCache = cachedCount > 0 && offset + maxMessages <= cachedCount;

  let messages: ReturnType<typeof formatMessageForAgent>[] = [];
  let hasMore = false;

  if (canUseCache && messagesById && listedIds) {
    // Use cached messages
    const endIndex = cachedCount - offset;
    const startIndex = Math.max(0, endIndex - maxMessages);
    hasMore = startIndex > 0;

    messages = listedIds
      .slice(startIndex, endIndex)
      .reverse()
      .map((msgId) => messagesById[msgId])
      .filter(Boolean)
      .map((msg) => formatMessageForAgent(msg, global));
  } else {
    // Fetch from API - threadId: -1 is MAIN_THREAD_ID for GetHistory
    const result = await callApi('fetchMessages', {
      chat,
      threadId: -1,
      limit: maxMessages,
      addOffset: offset,
    });

    if (result?.messages?.length) {
      global = getGlobal();
      messages = result.messages.map((msg: ApiMessage) => formatMessageForAgent(msg, global));
      hasMore = result.messages.length >= maxMessages;
    }
  }

  return {
    success: true,
    data: {
      chatTitle: chat.title,
      messageCount: messages.length,
      offset,
      hasMore,
      messages,
    },
    affectedChatIds: [chatId],
  };
}

function executeMarkChatAsRead(chatId: string): ToolResult {
  const { markMessageListRead } = getActions();
  const tabId = getCurrentTabId();

  markMessageListRead({ maxId: Infinity, tabId });

  return {
    success: true,
    data: { markedAsRead: chatId },
    affectedChatIds: [chatId],
  };
}

// Folder Tool Implementations

function executeListFolders(): ToolResult {
  const global = getGlobal();
  const { byId, orderedIds } = global.chatFolders;

  // Filter out virtual folders like "All Chats" (id=0) that don't exist in byId
  const folders = (orderedIds || [])
    .filter((id) => byId[id])
    .map((id) => {
      const folder = byId[id];
      return {
        id: folder.id,
        title: folder.title.text,
        includedChatCount: folder.includedChatIds.length,
        excludedChatCount: folder.excludedChatIds?.length || 0,
        hasContacts: folder.contacts,
        hasNonContacts: folder.nonContacts,
        hasGroups: folder.groups,
        hasChannels: folder.channels,
        hasBots: folder.bots,
      };
    });

  return {
    success: true,
    data: folders,
  };
}

function executeCreateFolder(args: {
  title: string;
  includedChatIds?: string[];
  excludedChatIds?: string[];
  includeContacts?: boolean;
  includeNonContacts?: boolean;
  includeGroups?: boolean;
  includeChannels?: boolean;
  includeBots?: boolean;
}): ToolResult {
  // Validate folder has content - Telegram returns 400 for empty folders
  const hasContent = args.includedChatIds?.length
    || args.includeContacts || args.includeNonContacts
    || args.includeGroups || args.includeChannels || args.includeBots;

  if (!hasContent) {
    return {
      success: false,
      error: 'Folder must include at least one chat or chat type filter (contacts, groups, channels, etc.)',
    };
  }

  const { addChatFolder } = getActions();
  const tabId = getCurrentTabId();

  const folder: Partial<ApiChatFolder> = {
    title: { text: args.title },
    includedChatIds: args.includedChatIds || [],
    excludedChatIds: args.excludedChatIds || [],
    contacts: args.includeContacts ? true : undefined,
    nonContacts: args.includeNonContacts ? true : undefined,
    groups: args.includeGroups ? true : undefined,
    channels: args.includeChannels ? true : undefined,
    bots: args.includeBots ? true : undefined,
  };

  addChatFolder({ folder: folder as ApiChatFolder, tabId });

  return {
    success: true,
    data: { created: args.title },
    affectedChatIds: args.includedChatIds || [],
  };
}

function executeAddChatToFolder(chatId: string, folderIds: number[]): ToolResult {
  const { editChatFolders } = getActions();
  const tabId = getCurrentTabId();

  editChatFolders({
    chatId,
    idsToAdd: folderIds,
    idsToRemove: [],
    tabId,
  });

  return {
    success: true,
    data: { added: chatId, toFolders: folderIds },
    affectedChatIds: [chatId],
  };
}

function executeRemoveChatFromFolder(chatId: string, folderIds: number[]): ToolResult {
  const { editChatFolders } = getActions();
  const tabId = getCurrentTabId();

  editChatFolders({
    chatId,
    idsToAdd: [],
    idsToRemove: folderIds,
    tabId,
  });

  return {
    success: true,
    data: { removed: chatId, fromFolders: folderIds },
    affectedChatIds: [chatId],
  };
}

function executeDeleteFolder(folderId: number): ToolResult {
  const { deleteChatFolder } = getActions();

  deleteChatFolder({ id: folderId });

  return {
    success: true,
    data: { deleted: folderId },
  };
}

// Member Tool Implementations

function executeGetChatMembers(chatId: string, _filter?: string, _limit = 200): ToolResult {
  const global = getGlobal();
  const fullInfo = selectChatFullInfo(global, chatId);

  if (!fullInfo?.members) {
    // Trigger loading members
    const { loadFullChat } = getActions();
    loadFullChat({ chatId });

    return {
      success: true,
      data: { loading: true, note: 'Members are being loaded, retry in a moment' },
      affectedChatIds: [chatId],
    };
  }

  const members = fullInfo.members.map((member) => {
    const user = selectUser(global, member.userId);
    return {
      id: member.userId,
      firstName: user?.firstName,
      lastName: user?.lastName,
      username: user?.usernames?.[0]?.username,
      isAdmin: member.isAdmin,
      isOwner: member.isOwner,
    };
  });

  return {
    success: true,
    data: members,
    affectedChatIds: [chatId],
  };
}

function executeAddChatMembers(chatId: string, userIds: string[]): ToolResult {
  const { addChatMembers } = getActions();
  const tabId = getCurrentTabId();

  addChatMembers({ chatId, memberIds: userIds, tabId });

  return {
    success: true,
    data: { added: userIds.length, toChatId: chatId },
    affectedChatIds: [chatId],
  };
}

function executeRemoveChatMember(chatId: string, userId: string): ToolResult {
  const { deleteChatMember } = getActions();
  const tabId = getCurrentTabId();

  deleteChatMember({ chatId, userId, tabId });

  return {
    success: true,
    data: { removed: userId, fromChatId: chatId },
    affectedChatIds: [chatId],
  };
}

function executeCreateGroup(title: string, memberIds: string[]): ToolResult {
  const { createGroupChat } = getActions();
  const tabId = getCurrentTabId();

  if (!title || title.trim().length === 0) {
    return { success: false, error: 'Group title is required' };
  }

  if (!memberIds || memberIds.length === 0) {
    return { success: false, error: 'At least one member is required to create a group' };
  }

  createGroupChat({ title: title.trim(), memberIds, tabId });

  return {
    success: true,
    data: { created: true, title, memberCount: memberIds.length },
  };
}

// User Tool Implementations

async function executeSearchUsers(query: string, limit = 50): Promise<ToolResult> {
  if (!query || query.trim().length === 0) {
    return { success: false, error: 'Search query cannot be empty' };
  }

  const result = await callApi('searchChats', { query: query.trim() });

  if (!result) {
    return { success: false, error: 'Search failed' };
  }

  const global = getGlobal();
  const allPeerIds = [...result.accountResultIds, ...result.globalResultIds];

  // Filter to only user IDs (positive IDs are users) and get user info
  const users = allPeerIds
    .filter((id) => !id.startsWith('-')) // Users have positive IDs
    .slice(0, limit)
    .map((userId) => {
      const user = selectUser(global, userId);
      if (!user) return undefined;
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.usernames?.[0]?.username,
        phoneNumber: user.phoneNumber,
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        isContact: result.accountResultIds.includes(userId),
      };
    })
    .filter(Boolean);

  return {
    success: true,
    data: {
      query,
      totalFound: users.length,
      users,
    },
  };
}

function executeGetUserInfo(userId: string): ToolResult {
  const global = getGlobal();
  const user = selectUser(global, userId);

  if (!user) {
    return { success: false, error: `User not found: ${userId}` };
  }

  return {
    success: true,
    data: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.usernames?.[0]?.username,
      phoneNumber: user.phoneNumber,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
    },
  };
}

// Batch Tool Implementations

async function executeBatchSendMessage(
  chatIds: string[],
  text: string,
  usernames?: string[],
  delayMs = BATCH_DELAY_MS,
): Promise<ToolResult> {
  const results: { chatId: string; success: boolean; error?: string }[] = [];
  let rateLimitError: string | undefined;

  for (let i = 0; i < chatIds.length; i++) {
    const chatId = chatIds[i];
    const username = usernames?.[i] || undefined;

    // Enforce rate limit for each message
    const rateCheck = await enforceRateLimit('sendMessage');
    if (!rateCheck.allowed) {
      rateLimitError = rateCheck.error;
      break; // Stop batch on rate limit
    }

    const result = await executeSendMessage(chatId, text, username);
    results.push({ chatId, success: result.success, error: result.error });

    if (delayMs > 0 && i < chatIds.length - 1) {
      await pause(delayMs);
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: !rateLimitError,
    error: rateLimitError,
    data: { sent: successCount, total: chatIds.length, results, stoppedDueToRateLimit: Boolean(rateLimitError) },
    affectedChatIds: chatIds.slice(0, results.length),
  };
}

async function executeBatchAddToFolder(chatIds: string[], folderId: number): Promise<ToolResult> {
  const global = getGlobal();
  const folder = selectChatFolder(global, folderId);

  if (!folder) {
    return { success: false, error: `Folder not found: ${folderId}` };
  }

  // Rate limit check - count as ONE operation
  const rateCheck = await enforceRateLimit('batchAddToFolder');
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error };
  }

  // Merge new chat IDs with existing (avoid duplicates)
  const existingIds = new Set(folder.includedChatIds);
  const newChatIds = chatIds.filter((id) => !existingIds.has(id));

  if (newChatIds.length === 0) {
    return {
      success: true,
      data: { added: 0, total: chatIds.length, toFolder: folder.title.text, alreadyIncluded: chatIds.length },
      affectedChatIds: [],
    };
  }

  // Single API call with all chats
  const result = await callApi('editChatFolder', {
    id: folderId,
    folderUpdate: {
      ...folder,
      includedChatIds: [...folder.includedChatIds, ...newChatIds],
    },
  });

  if (!result) {
    return { success: false, error: 'Failed to update folder' };
  }

  return {
    success: true,
    data: { added: newChatIds.length, total: chatIds.length, toFolder: folder.title.text },
    affectedChatIds: newChatIds,
  };
}

async function executeBatchArchive(chatIds: string[]): Promise<ToolResult> {
  const results: { chatId: string; success: boolean }[] = [];
  let rateLimitError: string | undefined;

  for (const chatId of chatIds) {
    // Enforce rate limit for each operation
    const rateCheck = await enforceRateLimit('archiveChat');
    if (!rateCheck.allowed) {
      rateLimitError = rateCheck.error;
      break; // Stop batch on rate limit
    }

    const result = executeArchiveChat(chatId);
    results.push({ chatId, success: result.success });
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: successCount > 0,
    error: rateLimitError,
    data: { archived: successCount, total: chatIds.length, stoppedDueToRateLimit: Boolean(rateLimitError) },
    affectedChatIds: chatIds.slice(0, results.length),
  };
}

// ============================================================================
// TELEBIZ CORE TOOL IMPLEMENTATIONS
// ============================================================================

function executeListPendingChats(limit = 50): ToolResult {
  const global = getGlobal();
  const orderedChatIds = global.telebiz?.notifications?.orderedPendingChatIds || [];
  const pendingByChatId = global.telebiz?.notifications?.pendingNotificationsByChatId || {};

  const chats = orderedChatIds.slice(0, limit).map((chatId) => {
    const chat = selectChat(global, chatId);
    const notifications = pendingByChatId[chatId] || [];
    const relationships = global.telebiz?.relationships?.byChatId[chatId];
    const selectedRelationshipId = relationships?.selectedRelationshipId;
    const relationship = relationships?.relationships.find((r) => r.id === selectedRelationshipId);

    return {
      chatId,
      chatTitle: chat?.title || 'Unknown',
      chatType: getChatTypeString(chat!),
      taskCount: notifications.length,
      oldestTask: notifications[0] ? {
        id: notifications[0].id,
        type: notifications[0].type,
        message: notifications[0].message,
        createdAt: notifications[0].created_at,
      } : undefined,
      hasRelationship: Boolean(relationship),
      entityType: relationship?.entity_type,
      provider: relationship?.integration?.provider?.name,
    };
  });

  return {
    success: true,
    data: {
      totalPendingChats: orderedChatIds.length,
      chats,
    },
    affectedChatIds: chats.map((c) => c.chatId),
  };
}

function executeGetChatTasks(chatId: string): ToolResult {
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  const notifications = global.telebiz?.notifications?.pendingNotificationsByChatId?.[chatId] || [];

  return {
    success: true,
    data: {
      chatId,
      chatTitle: chat.title,
      taskCount: notifications.length,
      tasks: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        status: n.status,
        createdAt: n.created_at,
        snoozedUntil: n.snoozed_until,
        metadata: n.metadata,
      })),
    },
    affectedChatIds: [chatId],
  };
}

function executeGetChatRelationship(chatId: string): ToolResult {
  const global = getGlobal();
  const chat = selectChat(global, chatId);

  if (!chat) {
    return { success: false, error: `Chat not found: ${chatId}` };
  }

  const relationships = global.telebiz?.relationships?.byChatId[chatId];
  const selectedRelationshipId = relationships?.selectedRelationshipId;
  const relationship = relationships?.relationships.find((r) => r.id === selectedRelationshipId);

  if (!relationship) {
    return {
      success: true,
      data: {
        chatId,
        chatTitle: chat.title,
        hasRelationship: false,
        message: 'No CRM entity linked to this chat',
      },
      affectedChatIds: [chatId],
    };
  }

  // Get entity details if cached
  const entity = global.telebiz?.relationships?.entitiesByIntegrationId
    ?.[relationship.integration_id]
    ?.[relationship.entity_type]
    ?.[relationship.entity_id];

  return {
    success: true,
    data: {
      chatId,
      chatTitle: chat.title,
      hasRelationship: true,
      relationshipId: relationship.id,
      entityType: relationship.entity_type,
      entityId: relationship.entity_id,
      integrationId: relationship.integration_id,
      provider: relationship.integration?.provider?.name || 'Unknown',
      entityCached: Boolean(entity),
      entitySummary: entity ? summarizeEntityForAgent(entity, relationship.entity_type) : undefined,
    },
    affectedChatIds: [chatId],
  };
}

function executeDismissTask(notificationId: number): ToolResult {
  const { dismissTelebizNotification } = getActions();

  dismissTelebizNotification({ notificationId });

  return {
    success: true,
    data: { dismissed: true, notificationId },
  };
}

function executeSnoozeTask(notificationId: number, snoozeMinutes = 60): ToolResult {
  const { snoozeTelebizNotification } = getActions();

  snoozeTelebizNotification({ notificationId, snoozeMinutes });

  return {
    success: true,
    data: { snoozed: true, notificationId, snoozeMinutes },
  };
}

function executeUseExtraTool(extraToolName: string): ToolResult {
  // Derive valid extra tools from the central registry
  const validExtraTools = Object.keys(EXTRA_TOOLS_REGISTRY) as ExtraToolName[];

  if (!validExtraTools.includes(extraToolName as ExtraToolName)) {
    return {
      success: false,
      error: `Unknown extra tool: ${extraToolName}. Available: ${validExtraTools.join(', ')}`,
    };
  }

  // Get extra tool info from registry
  const extraTool = EXTRA_TOOLS_REGISTRY[extraToolName as ExtraToolName];
  const toolNames = extraTool.tools.map((t) => t.function.name).join(', ');

  return {
    success: true,
    data: {
      extraToolLoaded: extraToolName,
      message: `${extraTool.description}. Tools available: ${toolNames}`,
    },
  };
}

// Helper to summarize entity for agent context
function summarizeEntityForAgent(entity: unknown, entityType: string): Record<string, unknown> {
  const e = entity as Record<string, unknown>;

  switch (entityType) {
    case 'deal':
      return {
        title: e.title,
        amount: e.amount,
        stage: e.stage,
        status: e.status,
        closeDate: e.closeDate,
      };
    case 'contact':
      return {
        name: e.name,
        email: e.email,
        phone: e.phone,
        company: e.company,
      };
    case 'page':
      return {
        title: e.title || 'Untitled',
        url: e.url,
        archived: e.archived,
      };
    default:
      return { id: e.id, type: entityType };
  }
}

/**
 * Try to execute an extra tool if the tool belongs to one
 */
async function executeExtraToolIfExists(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult | undefined> {
  const extraToolName = getToolExtraTool(toolName);
  if (!extraToolName) {
    return undefined;
  }
  return executeExtraToolTool(extraToolName, toolName, args);
}
