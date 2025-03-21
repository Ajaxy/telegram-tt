import type { ApiNotifyPeerType, ApiPeerNotifySettings } from '../../api/types';
import type {
  ISettings, IThemeSettings,
  ThemeKey,
} from '../../types';
import type { GlobalState } from '../types';

import { updateUserBlockedState } from './users';

export function replaceSettings<T extends GlobalState>(global: T, newSettings?: Partial<ISettings>): T {
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

export function replaceThemeSettings<T extends GlobalState>(
  global: T, theme: ThemeKey, newSettings?: Partial<IThemeSettings>,
): T {
  return {
    ...global,
    settings: {
      ...global.settings,
      themes: {
        ...global.settings.themes,
        [theme]: {
          ...(global.settings.themes[theme] || {}),
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
