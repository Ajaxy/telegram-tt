import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ApiError } from '../../../api/types';

import { APP_VERSION, DEBUG, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT } from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT, IS_TABLET_COLUMN_LAYOUT } from '../../../util/environment';
import getReadableErrorText from '../../../util/getReadableErrorText';
import { selectChatMessage, selectCurrentMessageList, selectIsTrustedBot } from '../../selectors';
import generateIdFor from '../../../util/generateIdFor';
import { unique } from '../../../util/iteratees';

export const APP_VERSION_URL = 'version.txt';
const MAX_STORED_EMOJIS = 8 * 4; // Represents four rows of recent emojis

addActionHandler('toggleChatInfo', (global, action, payload) => {
  return {
    ...global,
    isChatInfoShown: payload !== undefined ? payload : !global.isChatInfoShown,
  };
});

addActionHandler('setLeftColumnWidth', (global, actions, payload) => {
  const leftColumnWidth = payload;

  return {
    ...global,
    leftColumnWidth,
  };
});

addActionHandler('resetLeftColumnWidth', (global) => {
  return {
    ...global,
    leftColumnWidth: undefined,
  };
});

addActionHandler('toggleManagement', (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};

  if (!chatId) {
    return undefined;
  }

  return {
    ...global,
    management: {
      byChatId: {
        ...global.management.byChatId,
        [chatId]: {
          ...global.management.byChatId[chatId],
          isActive: !(global.management.byChatId[chatId] || {}).isActive,
        },
      },
    },
  };
});

addActionHandler('requestNextManagementScreen', (global, actions, payload) => {
  const { screen } = payload || {};
  const { chatId } = selectCurrentMessageList(global) || {};

  if (!chatId) {
    return undefined;
  }

  return {
    ...global,
    management: {
      byChatId: {
        ...global.management.byChatId,
        [chatId]: {
          ...global.management.byChatId[chatId],
          isActive: true,
          nextScreen: screen,
        },
      },
    },
  };
});

addActionHandler('closeManagement', (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};

  if (!chatId) {
    return undefined;
  }

  return {
    ...global,
    management: {
      byChatId: {
        ...global.management.byChatId,
        [chatId]: {
          ...global.management.byChatId[chatId],
          isActive: false,
        },
      },
    },
  };
});

addActionHandler('openChat', (global) => {
  if (!IS_SINGLE_COLUMN_LAYOUT && !IS_TABLET_COLUMN_LAYOUT) {
    return undefined;
  }

  return {
    ...global,
    isLeftColumnShown: global.messages.messageLists.length === 0,
  };
});

addActionHandler('toggleStatistics', (global) => {
  return {
    ...global,
    isStatisticsShown: !global.isStatisticsShown,
    statistics: {
      ...global.statistics,
      currentMessageId: undefined,
    },
  };
});

addActionHandler('toggleMessageStatistics', (global, action, payload) => {
  return {
    ...global,
    statistics: {
      ...global.statistics,
      currentMessageId: payload?.messageId,
    },
  };
});

addActionHandler('toggleLeftColumn', (global) => {
  return {
    ...global,
    isLeftColumnShown: !global.isLeftColumnShown,
  };
});

addActionHandler('addRecentEmoji', (global, action, payload) => {
  const { emoji } = payload;
  const { recentEmojis } = global;
  if (!recentEmojis) {
    return {
      ...global,
      recentEmojis: [emoji],
    };
  }

  const newEmojis = recentEmojis.filter((e) => e !== emoji);
  newEmojis.unshift(emoji);
  if (newEmojis.length > MAX_STORED_EMOJIS) {
    newEmojis.pop();
  }

  return {
    ...global,
    recentEmojis: newEmojis,
  };
});

addActionHandler('addRecentSticker', (global, action, payload) => {
  const { sticker } = payload;
  const { recent } = global.stickers;
  if (!recent) {
    return {
      ...global,
      stickers: {
        ...global.stickers,
        recent: {
          hash: '0',
          stickers: [sticker],
        },
      },
    };
  }

  const newStickers = recent.stickers.filter((s) => s.id !== sticker.id);
  newStickers.unshift(sticker);

  return {
    ...global,
    stickers: {
      ...global.stickers,
      recent: {
        ...recent,
        stickers: newStickers,
      },
    },
  };
});

addActionHandler('reorderStickerSets', (global, action, payload) => {
  const { order, isCustomEmoji } = payload;
  return {
    ...global,
    stickers: {
      ...global.stickers,
      [isCustomEmoji ? 'customEmoji' : 'added']: {
        setIds: order,
      },
    },
  };
});

addActionHandler('showNotification', (global, actions, payload) => {
  const notification = payload!;
  notification.localId = generateIdFor({});

  const newNotifications = [...global.notifications];
  const existingNotificationIndex = newNotifications.findIndex((n) => n.message === notification.message);
  if (existingNotificationIndex !== -1) {
    newNotifications.splice(existingNotificationIndex, 1);
  }

  newNotifications.push(notification);

  return {
    ...global,
    notifications: newNotifications,
  };
});

addActionHandler('dismissNotification', (global, actions, payload) => {
  const newNotifications = global.notifications.filter(({ localId }) => localId !== payload.localId);

  return {
    ...global,
    notifications: newNotifications,
  };
});

addActionHandler('showDialog', (global, actions, payload) => {
  const { data } = payload!;

  // Filter out errors that we don't want to show to the user
  if ('message' in data && data.hasErrorKey && !getReadableErrorText(data)) {
    return global;
  }

  const newDialogs = [...global.dialogs];
  if ('message' in data) {
    const existingErrorIndex = newDialogs.findIndex((err) => (err as ApiError).message === data.message);
    if (existingErrorIndex !== -1) {
      newDialogs.splice(existingErrorIndex, 1);
    }
  }

  newDialogs.push(data);

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('dismissDialog', (global) => {
  const newDialogs = [...global.dialogs];

  newDialogs.pop();

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addActionHandler('toggleSafeLinkModal', (global, actions, payload) => {
  const { url: safeLinkModalUrl } = payload;

  return {
    ...global,
    safeLinkModalUrl,
  };
});

addActionHandler('openHistoryCalendar', (global, actions, payload) => {
  const { selectedAt } = payload;

  return {
    ...global,
    historyCalendarSelectedAt: selectedAt,
  };
});

addActionHandler('closeHistoryCalendar', (global) => {
  return {
    ...global,
    historyCalendarSelectedAt: undefined,
  };
});

addActionHandler('openGame', (global, actions, payload) => {
  const { url, chatId, messageId } = payload;

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return;

  const botId = message.viaBotId || message.senderId;
  if (!botId) return;

  if (!selectIsTrustedBot(global, botId)) {
    setGlobal({
      ...global,
      botTrustRequest: {
        botId,
        type: 'game',
        onConfirm: {
          action: 'openGame',
          payload,
        },
      },
    });
    return;
  }

  setGlobal({
    ...global,
    openedGame: {
      url,
      chatId,
      messageId,
    },
  });
});

addActionHandler('closeGame', (global) => {
  return {
    ...global,
    openedGame: undefined,
  };
});

addActionHandler('requestConfetti', (global, actions, payload) => {
  const {
    top, left, width, height,
  } = payload || {};
  const { animationLevel } = global.settings.byKey;
  if (animationLevel === 0) return undefined;

  return {
    ...global,
    confetti: {
      lastConfettiTime: Date.now(),
      top,
      left,
      width,
      height,
    },
  };
});

addActionHandler('openLimitReachedModal', (global, actions, payload) => {
  const { limit } = payload;

  return {
    ...global,
    limitReachedModal: {
      limit,
    },
  };
});

addActionHandler('closeLimitReachedModal', (global) => {
  return {
    ...global,
    limitReachedModal: undefined,
  };
});

addActionHandler('closeStickerSetModal', (global) => {
  return {
    ...global,
    openedStickerSetShortName: undefined,
  };
});

addActionHandler('openCustomEmojiSets', (global, actions, payload) => {
  const { setIds } = payload;
  return {
    ...global,
    openedCustomEmojiSetIds: setIds,
  };
});

addActionHandler('closeCustomEmojiSets', (global) => {
  return {
    ...global,
    openedCustomEmojiSetIds: undefined,
  };
});

addActionHandler('updateLastRenderedCustomEmojis', (global, actions, payload) => {
  const { ids } = payload;
  const { lastRendered } = global.customEmojis;

  return {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      lastRendered: unique([...lastRendered, ...ids]).slice(0, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT),
    },
  };
});

addActionHandler('checkAppVersion', () => {
  const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

  fetch(`${APP_VERSION_URL}?${Date.now()}`)
    .then((response) => response.text())
    .then((version) => {
      version = version.trim();

      if (APP_VERSION_REGEX.test(version) && version !== APP_VERSION) {
        setGlobal({
          ...getGlobal(),
          isUpdateAvailable: true,
        });
      }
    })
    .catch((err) => {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[checkAppVersion failed] ', err);
      }
    });
});
