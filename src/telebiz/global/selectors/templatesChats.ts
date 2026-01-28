import type { GlobalState } from '../../../global/types';
import type { TelebizTemplatesChatsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizTemplatesChats(global: GlobalState): TelebizTemplatesChatsState {
  return global.telebiz?.templatesChats || INITIAL_TELEBIZ_STATE.templatesChats;
}

export function selectTelebizTemplatesChatsList(global: GlobalState): string[] {
  return selectTelebizTemplatesChats(global).templatesChats;
}

export function selectTelebizTemplatesChatsIsLoading(global: GlobalState): boolean {
  return selectTelebizTemplatesChats(global).isLoading;
}

export function selectTelebizTemplatesChatsError(global: GlobalState): string | undefined {
  return selectTelebizTemplatesChats(global).error;
}

export function selectIsTelebizTemplatesChat(global: GlobalState, chatId: string): boolean {
  return selectTelebizTemplatesChatsList(global).includes(chatId);
}
