import { addReducer } from '../..';

import { GlobalState } from '../../../global/types';
import { ApiError } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TABLET_COLUMN_LAYOUT } from '../../../util/environment';
import getReadableErrorText from '../../../util/getReadableErrorText';
import { selectCurrentMessageList } from '../../selectors';
import generateIdFor from '../../../util/generateIdFor';

const MAX_STORED_EMOJIS = 18; // Represents two rows of recent emojis

addReducer('toggleChatInfo', (global, action, payload) => {
  return {
    ...global,
    isChatInfoShown: payload !== undefined ? payload : !global.isChatInfoShown,
  };
});

addReducer('setLeftColumnWidth', (global, actions, payload) => {
  const leftColumnWidth = payload;

  return {
    ...global,
    leftColumnWidth,
  };
});

addReducer('resetLeftColumnWidth', (global) => {
  return {
    ...global,
    leftColumnWidth: undefined,
  };
});

addReducer('toggleManagement', (global): GlobalState | undefined => {
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

addReducer('requestNextManagementScreen', (global, actions, payload): GlobalState | undefined => {
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

addReducer('closeManagement', (global): GlobalState | undefined => {
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

addReducer('openChat', (global) => {
  if (!IS_SINGLE_COLUMN_LAYOUT && !IS_TABLET_COLUMN_LAYOUT) {
    return undefined;
  }

  return {
    ...global,
    isLeftColumnShown: global.messages.messageLists.length === 0,
  };
});

addReducer('toggleStatistics', (global) => {
  return {
    ...global,
    isStatisticsShown: !global.isStatisticsShown,
  };
});

addReducer('toggleLeftColumn', (global) => {
  return {
    ...global,
    isLeftColumnShown: !global.isLeftColumnShown,
  };
});

addReducer('addRecentEmoji', (global, action, payload) => {
  const { emoji } = payload!;
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

addReducer('addRecentSticker', (global, action, payload) => {
  const { sticker } = payload!;
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

addReducer('showNotification', (global, actions, payload) => {
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

addReducer('dismissNotification', (global, actions, payload) => {
  const newNotifications = global.notifications.filter(({ localId }) => localId !== payload.localId);

  return {
    ...global,
    notifications: newNotifications,
  };
});

addReducer('showDialog', (global, actions, payload) => {
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

addReducer('dismissDialog', (global) => {
  const newDialogs = [...global.dialogs];

  newDialogs.pop();

  return {
    ...global,
    dialogs: newDialogs,
  };
});

addReducer('toggleSafeLinkModal', (global, actions, payload) => {
  const { url: safeLinkModalUrl } = payload;

  return {
    ...global,
    safeLinkModalUrl,
  };
});

addReducer('openHistoryCalendar', (global, actions, payload) => {
  const { selectedAt } = payload;

  return {
    ...global,
    historyCalendarSelectedAt: selectedAt,
  };
});

addReducer('closeHistoryCalendar', (global) => {
  return {
    ...global,
    historyCalendarSelectedAt: undefined,
  };
});
