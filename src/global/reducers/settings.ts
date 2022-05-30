import type { GlobalState } from '../types';
import type {
  ISettings, IThemeSettings, ThemeKey, NotifyException,
} from '../../types';
import type { ApiNotifyException } from '../../api/types';
import { updateUserBlockedState } from './users';

export function replaceSettings(global: GlobalState, newSettings?: Partial<ISettings>): GlobalState {
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

export function replaceThemeSettings(
  global: GlobalState, theme: ThemeKey, newSettings?: Partial<IThemeSettings>,
): GlobalState {
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

export function addNotifyExceptions(
  global: GlobalState, notifyExceptions: ApiNotifyException[],
): GlobalState {
  notifyExceptions.forEach((notifyException) => {
    const { chatId, ...exceptionData } = notifyException;
    global = addNotifyException(global, chatId, exceptionData);
  });

  return global;
}

export function addNotifyException(
  global: GlobalState, id: string, notifyException: NotifyException,
): GlobalState {
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
export function updateNotifySettings(
  global: GlobalState, peerType: 'contact' | 'group' | 'broadcast', isSilent?: boolean, shouldShowPreviews?: boolean,
) {
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

export function addBlockedContact(global: GlobalState, contactId: string): GlobalState {
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

export function removeBlockedContact(global: GlobalState, contactId: string): GlobalState {
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
