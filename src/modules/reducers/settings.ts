import { GlobalState } from '../../global/types';
import {
  ISettings, IThemeSettings, ThemeKey, NotifyException,
} from '../../types';

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

export function addNotifyException(
  global: GlobalState, id: number, notifyException: NotifyException,
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

    default:
      return undefined;
  }
}

export function addBlockedContact(global: GlobalState, contactId: number): GlobalState {
  return {
    ...global,
    blocked: {
      ...global.blocked,
      ids: [contactId, ...global.blocked.ids],
      totalCount: global.blocked.totalCount + 1,
    },
  };
}

export function removeBlockedContact(global: GlobalState, contactId: number): GlobalState {
  return {
    ...global,
    blocked: {
      ...global.blocked,
      ids: global.blocked.ids.filter((id) => id !== contactId),
      totalCount: global.blocked.totalCount - 1,
    },
  };
}
