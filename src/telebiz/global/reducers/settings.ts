import type { GlobalState } from '../../../global/types';
import type { ChatFollowupSettings, UserSettings } from '../../services/types';
import type { TelebizSettingsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizSettings<T extends GlobalState>(
  global: T,
  update: Partial<TelebizSettingsState>,
): T {
  const currentSettings = global.telebiz?.settings || INITIAL_TELEBIZ_STATE.settings;
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      settings: {
        ...currentSettings,
        ...update,
        // Ensure chatSettings is always an object
        chatSettings: update.chatSettings ?? currentSettings.chatSettings ?? {},
      },
    },
  };
}

export function setTelebizUserSettings<T extends GlobalState>(
  global: T,
  userSettings: UserSettings,
): T {
  return updateTelebizSettings(global, {
    userSettings,
    isLoading: false,
    error: undefined,
  });
}

export function setTelebizChatSettings<T extends GlobalState>(
  global: T,
  chatId: string,
  chatSettings: ChatFollowupSettings,
): T {
  const currentSettings = global.telebiz?.settings || INITIAL_TELEBIZ_STATE.settings;
  return updateTelebizSettings(global, {
    chatSettings: {
      ...currentSettings.chatSettings,
      [chatId]: chatSettings,
    },
    isLoading: false,
    error: undefined,
  });
}

export function setTelebizAllChatSettings<T extends GlobalState>(
  global: T,
  chatSettingsList: ChatFollowupSettings[],
): T {
  const chatSettings = chatSettingsList.reduce((acc, settings) => {
    if (settings?.chat_id) {
      acc[settings.chat_id] = settings;
    }
    return acc;
  }, {} as Record<string, ChatFollowupSettings>);

  return updateTelebizSettings(global, {
    chatSettings: chatSettings || {},
    isLoading: false,
    error: undefined,
  });
}

export function setTelebizSettingsSyncing<T extends GlobalState>(
  global: T,
  isSyncing: boolean,
): T {
  return updateTelebizSettings(global, {
    isSyncing,
    ...(isSyncing ? {} : { lastSyncAt: Date.now() }),
  });
}
