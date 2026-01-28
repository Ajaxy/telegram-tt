import type { GlobalState } from '../../../global/types';
import type { ChatFollowupSettings, UserSettings } from '../../services/types';
import type { TelebizSettingsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizSettings(global: GlobalState): TelebizSettingsState {
  return global.telebiz?.settings || INITIAL_TELEBIZ_STATE.settings;
}

export function selectTelebizUserSettings(global: GlobalState): UserSettings {
  return selectTelebizSettings(global).userSettings;
}

export function selectTelebizChatSettings(
  global: GlobalState,
  chatId: string,
): ChatFollowupSettings | undefined {
  return selectTelebizSettings(global).chatSettings[chatId];
}

export function selectTelebizAllChatSettings(
  global: GlobalState,
): Record<string, ChatFollowupSettings> {
  return selectTelebizSettings(global).chatSettings;
}

export function selectTelebizChatsWithFollowupsEnabled(
  global: GlobalState,
): string[] {
  const chatSettings = selectTelebizAllChatSettings(global);
  return Object.keys(chatSettings).filter(
    (chatId) => chatSettings[chatId]?.followup_enabled,
  );
}

export function selectTelebizSettingsIsLoading(global: GlobalState): boolean {
  return selectTelebizSettings(global).isLoading;
}

export function selectTelebizSettingsIsSyncing(global: GlobalState): boolean {
  return selectTelebizSettings(global).isSyncing;
}

export function selectTelebizSettingsLastSyncAt(global: GlobalState): number | undefined {
  return selectTelebizSettings(global).lastSyncAt;
}

export function selectTelebizSettingsError(global: GlobalState): string | undefined {
  return selectTelebizSettings(global).error;
}

export function selectTelebizLastSyncByChatId(global: GlobalState): Record<string, number> {
  return selectTelebizSettings(global).lastSyncByChatId || {};
}
