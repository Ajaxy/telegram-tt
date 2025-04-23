import type { ApiNotifyPeerType, ApiPeerNotifySettings } from '../../api/types';
import type {
  AccountSettings, IThemeSettings,
  ThemeKey,
} from '../../types';
import type { GlobalState, SharedState } from '../types';

import { selectSharedSettings } from '../selectors/sharedState';
import { updateSharedState } from './sharedState';
import { updateUserBlockedState } from './users';

export function replaceSettings<T extends GlobalState>(global: T, newSettings?: Partial<AccountSettings>): T {
  return {
    ...global,
    settings: {
      ...global.settings,
      byKey: {
        ...global.settings.byKey,
        ...newSettings,
      },
    },
  };
}

export function updateSharedSettings<T extends GlobalState>(
  global: T, newSettings?: Partial<SharedState['settings']>,
): T {
  const settings = selectSharedSettings(global);
  return updateSharedState(global, {
    settings: {
      ...settings,
      ...newSettings,
    },
  });
}

export function updateThemeSettings<T extends GlobalState>(
  global: T, theme: ThemeKey, newSettings?: Partial<IThemeSettings>,
): T {
  const settings = global.settings;
  const current = settings.themes[theme];

  return {
    ...global,
    settings: {
      ...global.settings,
      themes: {
        ...settings.themes,
        [theme]: {
          ...current,
          ...newSettings,
        },
      },
    },
  };
}

export function addNotifyExceptions<T extends GlobalState>(
  global: T, notifyExceptionById: Record<string, ApiPeerNotifySettings>,
): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      notifyExceptionById: {
        ...global.chats.notifyExceptionById,
        ...notifyExceptionById,
      },
    },
  };
}

export function replaceNotifyExceptions<T extends GlobalState>(
  global: T, notifyExceptionById: Record<string, ApiPeerNotifySettings>,
): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      notifyExceptionById,
    },
  };
}

export function addNotifyException<T extends GlobalState>(
  global: T, id: string, notifyException: ApiPeerNotifySettings,
): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      notifyExceptionById: {
        ...global.chats.notifyExceptionById,
        [id]: notifyException,
      },
    },
  };
}

export function updateNotifyDefaults<T extends GlobalState>(
  global: T, peerType: ApiNotifyPeerType, settings: Partial<ApiPeerNotifySettings>,
): T {
  return {
    ...global,
    settings: {
      ...global.settings,
      notifyDefaults: {
        ...global.settings.notifyDefaults,
        [peerType]: {
          ...global.settings.notifyDefaults?.[peerType],
          ...settings,
        },
      },
    },
  };
}

export function addBlockedUser<T extends GlobalState>(global: T, contactId: string): T {
  global = updateUserBlockedState(global, contactId, true);

  return {
    ...global,
    blocked: {
      ...global.blocked,
      ids: [contactId, ...global.blocked.ids],
      totalCount: global.blocked.totalCount + 1,
    },
  };
}

export function removeBlockedUser<T extends GlobalState>(global: T, contactId: string): T {
  global = updateUserBlockedState(global, contactId, false);

  return {
    ...global,
    blocked: {
      ...global.blocked,
      ids: global.blocked.ids.filter((id) => id !== contactId),
      totalCount: global.blocked.totalCount - 1,
    },
  };
}
