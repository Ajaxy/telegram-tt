import type { GlobalState } from '../../../global/types';
import type { TelebizTemplatesChatsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizTemplatesChats<T extends GlobalState>(
  global: T,
  update: Partial<TelebizTemplatesChatsState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      templatesChats: {
        ...(global.telebiz?.templatesChats || INITIAL_TELEBIZ_STATE.templatesChats),
        ...update,
      },
    },
  };
}

export function setTelebizTemplatesChatsList<T extends GlobalState>(
  global: T,
  chatIds: string[],
): T {
  return updateTelebizTemplatesChats(global, {
    templatesChats: chatIds,
  });
}

export function addTelebizTemplatesChat<T extends GlobalState>(
  global: T,
  chatId: string,
): T {
  return updateTelebizTemplatesChats(global, {
    templatesChats: [...(global.telebiz?.templatesChats?.templatesChats || []), chatId],
  });
}

export function removeTelebizTemplatesChat<T extends GlobalState>(
  global: T,
  chatId: string,
): T {
  return updateTelebizTemplatesChats(global, {
    templatesChats: (global.telebiz?.templatesChats?.templatesChats || []).filter((id) => id !== chatId),
  });
}

export function setIsLoadingTelebizTemplatesChats<T extends GlobalState>(
  global: T,
  isLoading: boolean,
): T {
  return updateTelebizTemplatesChats(global, {
    ...global.telebiz?.templatesChats,
    isLoading,
  });
}

export function setErrorTelebizTemplatesChats<T extends GlobalState>(
  global: T,
  error: string,
): T {
  return updateTelebizTemplatesChats(global, {
    ...global.telebiz?.templatesChats,
    error,
  });
}
