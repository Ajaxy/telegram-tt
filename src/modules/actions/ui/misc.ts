import { addReducer } from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TABLET_COLUMN_LAYOUT } from '../../../util/environment';
import getReadableErrorText from '../../../util/getReadableErrorText';
import { selectCurrentMessageList } from '../../selectors';

const MAX_STORED_EMOJIS = 18; // Represents two rows of recent emojis

addReducer('toggleChatInfo', (global) => {
  return {
    ...global,
    isChatInfoShown: !global.isChatInfoShown,
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

addReducer('openChat', (global, actions, payload) => {
  if (!IS_SINGLE_COLUMN_LAYOUT && !IS_TABLET_COLUMN_LAYOUT) {
    return undefined;
  }

  const { id } = payload!;

  return {
    ...global,
    isLeftColumnShown: id === undefined,
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
          hash: 0,
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

addReducer('dismissNotification', (global) => {
  const newNotifications = [...global.notifications];

  newNotifications.pop();

  return {
    ...global,
    notifications: newNotifications,
  };
});

addReducer('showError', (global, actions, payload) => {
  const { error } = payload!;

  // Filter out errors that we don't want to show to the user
  if (!getReadableErrorText(error)) {
    return global;
  }

  const newErrors = [...global.errors];
  const existingErrorIndex = newErrors.findIndex((err) => err.message === error.message);
  if (existingErrorIndex !== -1) {
    newErrors.splice(existingErrorIndex, 1);
  }

  newErrors.push(error);

  return {
    ...global,
    errors: newErrors,
  };
});

addReducer('dismissError', (global) => {
  const newErrors = [...global.errors];

  newErrors.pop();

  return {
    ...global,
    errors: newErrors,
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
