import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ActionReturnType } from '../../../global/types';
import type { ChatActivitySync, ChatType } from '../../services/types';

import { isActionMessage } from '../../../global/helpers';
import { selectChat, selectChatLastMessage, selectChatMessages } from '../../../global/selectors';
import { telebizApiClient } from '../../services';
import {
  setTelebizAllChatSettings,
  setTelebizChatSettings,
  setTelebizSettingsSyncing,
  setTelebizUserSettings,
  updateTelebizSettings,
} from '../reducers';
import {
  selectCurrentTelebizOrganization,
  selectIsTelebizAuthenticated,
  selectTelebizAllChatSettings,
  selectTelebizLastSyncByChatId,
  selectTelebizRelationships,
  selectTelebizUserSettings,
} from '../selectors';

addActionHandler('loadTelebizUserSettings', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  global = updateTelebizSettings(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const userSettings = await telebizApiClient.settings.getSettings(
      organization.id,
    );

    global = getGlobal();
    global = setTelebizUserSettings(global, userSettings);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
    global = getGlobal();
    global = updateTelebizSettings(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('updateTelebizUserSettings', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  const settings = payload;

  global = updateTelebizSettings(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const userSettings = await telebizApiClient.settings.updateSettings(
      organization.id,
      settings,
    );

    global = getGlobal();
    global = setTelebizUserSettings(global, userSettings);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
    global = getGlobal();
    global = updateTelebizSettings(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizAllChatSettings', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  global = updateTelebizSettings(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const chatSettings = await telebizApiClient.settings.getAllChatSettings(
      organization.id,
    );

    global = getGlobal();
    global = setTelebizAllChatSettings(global, chatSettings);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load chat settings';
    global = getGlobal();
    global = updateTelebizSettings(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizChatSettings', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  const { chatId } = payload;

  try {
    const chatSettings = await telebizApiClient.settings.getChatSettings(
      organization.id,
      chatId,
    );

    global = getGlobal();
    global = setTelebizChatSettings(global, chatId, chatSettings);
    setGlobal(global);
  } catch (err) {
    // Chat settings not found is not an error - it means the chat has no followup settings yet
    // Just don't update state
  }
});

addActionHandler('updateTelebizChatSettings', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  const { chatId, settings } = payload;

  global = updateTelebizSettings(global, { isLoading: true, error: undefined });
  setGlobal(global);

  // Build activity data from last message (skip system/action messages)
  const chat = selectChat(global, chatId);
  const chatMessages = selectChatMessages(global, chatId);
  const lastMessage = selectChatLastMessage(global, chatId);
  const relevantMessage = findLastNonActionMessage(chatMessages, lastMessage);

  const activity: Partial<ChatActivitySync> = {
    chat_type: chat ? getChatType(chat.type) : 'private',
  };

  if (relevantMessage) {
    const timestamp = new Date(relevantMessage.date * 1000).toISOString();
    if (relevantMessage.isOutgoing) {
      activity.last_outgoing_at = timestamp;
    } else {
      activity.last_incoming_at = timestamp;
    }
  }

  try {
    const chatSettings = await telebizApiClient.settings.updateChatSettings(
      organization.id,
      chatId,
      settings,
      activity,
    );

    global = getGlobal();
    global = setTelebizChatSettings(global, chatId, chatSettings);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update chat settings';
    global = getGlobal();
    global = updateTelebizSettings(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
    getActions().showNotification({
      message: errorMessage,
    });
  }
});

function getChatType(chatType: string | undefined): ChatType {
  const privateChats = ['chatTypePrivate', 'chatTypeSecret'];

  if (chatType && privateChats.includes(chatType)) {
    return 'private';
  }

  return 'group';
}

const MAX_MESSAGES_TO_CHECK = 10;

// Find the last non-action message (skips system notifications like "User added User")
function findLastNonActionMessage(
  messages: Record<number, ApiMessage> | undefined,
  lastMessage: ApiMessage | undefined,
): ApiMessage | undefined {
  if (!lastMessage) return undefined;

  // If last message is not an action, return it directly
  if (!isActionMessage(lastMessage)) return lastMessage;

  // Otherwise search through recent messages
  if (!messages) return undefined;

  const sortedIds = Object.keys(messages)
    .map(Number)
    .sort((a, b) => b - a) // Sort descending (newest first)
    .slice(0, MAX_MESSAGES_TO_CHECK);

  for (const id of sortedIds) {
    const message = messages[id];
    if (message && !isActionMessage(message)) {
      return message;
    }
  }

  return undefined;
}

addActionHandler('syncTelebizChatActivities', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;
  if (!global.isInited) return;

  const organization = selectCurrentTelebizOrganization(global);
  if (!organization?.id) return;

  const userSettings = selectTelebizUserSettings(global);
  const chatSettings = selectTelebizAllChatSettings(global);
  const relationships = selectTelebizRelationships(global);
  const lastSyncByChatId = selectTelebizLastSyncByChatId(global);

  // Get chats with relationships
  const chatsWithRelationships = new Set(Object.keys(relationships.byChatId));

  // Get chats with followups enabled
  const chatsWithFollowups = new Set(
    Object.keys(chatSettings).filter((chatId) => chatSettings[chatId].followup_enabled),
  );

  // Combine both sets - sync chats that have either relationships OR followups enabled
  const chatIdsToSync = new Set([...chatsWithRelationships, ...chatsWithFollowups]);

  if (chatIdsToSync.size === 0) return;

  // Build activities payload - only for chats with new activity since last sync
  const activities: ChatActivitySync[] = [];
  const syncedChatIds: string[] = [];

  for (const chatId of chatIdsToSync) {
    const chat = selectChat(global, chatId);
    if (!chat) continue;

    const chatType = getChatType(chat.type);

    // Filter by user settings
    if (userSettings) {
      const isPrivate = chatType === 'private';
      const isGroup = chatType === 'group';

      if (isPrivate && !userSettings.sync_private_chats) continue;
      if (isGroup && !userSettings.sync_groups) continue;
    }

    const chatMessages = selectChatMessages(global, chatId);
    const lastMessage = selectChatLastMessage(global, chatId);
    const relevantMessage = findLastNonActionMessage(chatMessages, lastMessage);
    if (!relevantMessage) continue;

    // Check if there's new activity since last sync
    const lastSyncTime = lastSyncByChatId[chatId];
    const relevantMessageTime = relevantMessage.date * 1000;

    if (lastSyncTime && relevantMessageTime <= lastSyncTime) {
      // No new activity since last sync, skip
      continue;
    }

    const activity: ChatActivitySync = {
      chat_id: chatId,
      chat_type: chatType,
    };

    const timestamp = new Date(relevantMessageTime).toISOString();
    if (relevantMessage.isOutgoing) {
      activity.last_outgoing_at = timestamp;
    } else {
      activity.last_incoming_at = timestamp;
    }

    activities.push(activity);
    syncedChatIds.push(chatId);
  }

  if (activities.length === 0) return;

  global = setTelebizSettingsSyncing(global, true);
  setGlobal(global);

  try {
    await telebizApiClient.settings.syncActivity(
      organization.id,
      activities,
    );

    // Update last sync timestamps for synced chats
    const now = Date.now();
    const updatedLastSyncByChatId = { ...lastSyncByChatId };
    for (const chatId of syncedChatIds) {
      updatedLastSyncByChatId[chatId] = now;
    }

    global = getGlobal();
    global = updateTelebizSettings(global, {
      isSyncing: false,
      lastSyncByChatId: updatedLastSyncByChatId,
    });
    setGlobal(global);
  } catch (err) {
    global = getGlobal();
    global = setTelebizSettingsSyncing(global, false);
    setGlobal(global);
  }
});

addActionHandler('clearTelebizSettingsError', (global): ActionReturnType => {
  return updateTelebizSettings(global, { error: undefined });
});
