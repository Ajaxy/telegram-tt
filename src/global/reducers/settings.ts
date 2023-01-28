import type { GlobalState } from '../types';
import type {
  ISettings, IThemeSettings, ThemeKey, NotifyException,
} from '../../types';
import type { ApiNotifyException } from '../../api/types';
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
  global: T, notifyExceptions: ApiNotifyException[],
): T {
  notifyExceptions.forEach((notifyException) => {
    const { chatId, ...exceptionData } = notifyException;
    global = addNotifyException(global, chatId, exceptionData);
  });

  return global;
}

export function addNotifyException<T extends GlobalState>(
  global: T, id: string, notifyException: NotifyException,
): T {
  return {
    ...global,
    settings: {
      ...global.settings,
      notifyExceptions: {
        ...global.settings.notifyExceptions,
        [id]: notifyException,
      },
    },
  };
}

// eslint-disable-next-line consistent-return
export function updateNotifySettings<T extends GlobalState>(
  global: T, peerType: 'contact' | 'group' | 'broadcast', isSilent?: boolean, shouldShowPreviews?: boolean,
): T {
  switch (peerType) {
    case 'contact':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasPrivateChatsNotifications: !isSilent }),
        ...(typeof shouldShowPreviews !== 'undefined' && { hasPrivateChatsMessagePreview: shouldShowPreviews }),
      });
    case 'group':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasGroupNotifications: !isSilent }),
        ...(typeof shouldShowPreviews !== 'undefined' && { hasGroupMessagePreview: shouldShowPreviews }),
      });
    case 'broadcast':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasBroadcastNotifications: !isSilent }),
        ...(typeof shouldShowPreviews !== 'undefined' && { hasBroadcastMessagePreview: shouldShowPreviews }),
      });
  }
}

export function addBlockedContact<T extends GlobalState>(global: T, contactId: string): T {
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

export function removeBlockedContact<T extends GlobalState>(global: T, contactId: string): T {
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
