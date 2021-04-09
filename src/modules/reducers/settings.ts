import { GlobalState } from '../../global/types';
import { ISettings } from '../../types';

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

export function updateNotifySettings(
  global: GlobalState, peerType: 'contact' | 'group' | 'broadcast', isSilent?: boolean, isShowPreviews?: boolean,
) {
  switch (peerType) {
    case 'contact':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasPrivateChatsNotifications: !isSilent }),
        ...(typeof isShowPreviews !== 'undefined' && { hasPrivateChatsMessagePreview: isShowPreviews }),
      });
    case 'group':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasGroupNotifications: !isSilent }),
        ...(typeof isShowPreviews !== 'undefined' && { hasGroupMessagePreview: isShowPreviews }),
      });
    case 'broadcast':
      return replaceSettings(global, {
        ...(typeof isSilent !== 'undefined' && { hasBroadcastNotifications: !isSilent }),
        ...(typeof isShowPreviews !== 'undefined' && { hasBroadcastMessagePreview: isShowPreviews }),
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
