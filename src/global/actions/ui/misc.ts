import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';

import type { ApiError, ApiNotification } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import {
  APP_VERSION, DEBUG, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT, INACTIVE_MARKER, PAGE_TITLE,
} from '../../../config';
import getReadableErrorText from '../../../util/getReadableErrorText';
import {
  selectChatMessage, selectCurrentChat, selectCurrentMessageList, selectTabState, selectIsTrustedBot, selectChat,
} from '../../selectors';
import generateIdFor from '../../../util/generateIdFor';
import { compact, unique } from '../../../util/iteratees';
import { getAllMultitabTokens, getCurrentTabId, reestablishMasterToSelf } from '../../../util/establishMultitabRole';
import { getAllNotificationsCount } from '../../../util/folderManager';
import updateIcon from '../../../util/updateIcon';
import { setPageTitle, setPageTitleInstant } from '../../../util/updatePageTitle';
import { updateTabState } from '../../reducers/tabs';
import { getIsMobile, getIsTablet } from '../../../hooks/useAppLayout';
import * as langProvider from '../../../util/langProvider';
import { getAllowedAttachmentOptions, getChatTitle } from '../../helpers';

export const APP_VERSION_URL = 'version.txt';
const MAX_STORED_EMOJIS = 8 * 4; // Represents four rows of recent emojis

addActionHandler('toggleChatInfo', (global, actions, payload): ActionReturnType => {
  const { force, tabId = getCurrentTabId() } = payload || {};
  const isChatInfoShown = force !== undefined ? force : !selectTabState(global, tabId).isChatInfoShown;

  global = updateTabState(global, { isChatInfoShown }, tabId);
  global = { ...global, lastIsChatInfoShown: isChatInfoShown };

  return global;
});

addActionHandler('setLeftColumnWidth', (global, actions, payload): ActionReturnType => {
  const { leftColumnWidth } = payload;

  return {
    ...global,
    leftColumnWidth,
  };
});

addActionHandler('resetLeftColumnWidth', (global): ActionReturnType => {
  return {
    ...global,
    leftColumnWidth: undefined,
  };
});

addActionHandler('toggleManagement', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};

  if (!chatId) {
    return undefined;
  }

  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    management: {
      byChatId: {
        ...tabState.management.byChatId,
        [chatId]: {
          ...tabState.management.byChatId[chatId],
          isActive: !(tabState.management.byChatId[chatId] || {}).isActive,
        },
      },
    },
  }, tabId);
});

addActionHandler('requestNextManagementScreen', (global, actions, payload): ActionReturnType => {
  const { screen, tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};

  if (!chatId) {
    return undefined;
  }

  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    management: {
      byChatId: {
        ...tabState.management.byChatId,
        [chatId]: {
          ...tabState.management.byChatId[chatId],
          isActive: true,
          nextScreen: screen,
        },
      },
    },
  }, tabId);
});

addActionHandler('closeManagement', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};

  if (!chatId) {
    return undefined;
  }

  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    management: {
      byChatId: {
        ...tabState.management.byChatId,
        [chatId]: {
          ...tabState.management.byChatId[chatId],
          isActive: false,
        },
      },
    },
  }, tabId);
});

addActionHandler('openChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  if (!getIsMobile() && !getIsTablet()) {
    return undefined;
  }

  return updateTabState(global, {
    isLeftColumnShown: selectTabState(global, tabId).messageLists.length === 0,
  }, tabId);
});

addActionHandler('toggleStatistics', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    isStatisticsShown: !tabState.isStatisticsShown,
    statistics: {
      ...tabState.statistics,
      currentMessageId: undefined,
    },
  }, tabId);
});

addActionHandler('toggleMessageStatistics', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), messageId } = payload || {};
  return updateTabState(global, {
    statistics: {
      ...selectTabState(global, tabId).statistics,
      currentMessageId: messageId,
    },
  }, tabId);
});

addActionHandler('toggleLeftColumn', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    isLeftColumnShown: !selectTabState(global, tabId).isLeftColumnShown,
  }, tabId);
});

addActionHandler('addRecentEmoji', (global, actions, payload): ActionReturnType => {
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

addActionHandler('addRecentSticker', (global, actions, payload): ActionReturnType => {
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

addActionHandler('addRecentCustomEmoji', (global, actions, payload): ActionReturnType => {
  const { documentId } = payload;
  const { recentCustomEmojis } = global;
  if (!recentCustomEmojis) {
    return {
      ...global,
      recentCustomEmojis: [documentId],
    };
  }

  const newEmojis = recentCustomEmojis.filter((id) => id !== documentId);
  newEmojis.unshift(documentId);
  if (newEmojis.length > MAX_STORED_EMOJIS) {
    newEmojis.pop();
  }

  return {
    ...global,
    recentCustomEmojis: newEmojis,
  };
});

addActionHandler('clearRecentCustomEmoji', (global): ActionReturnType => {
  return {
    ...global,
    recentCustomEmojis: [],
  };
});

addActionHandler('reorderStickerSets', (global, actions, payload): ActionReturnType => {
  const { order, isCustomEmoji } = payload;
  return {
    ...global,
    stickers: {
      ...global.stickers,
      added: {
        setIds: (!isCustomEmoji ? order : global.stickers.added.setIds),
      },
    },
    customEmojis: {
      ...global.customEmojis,
      added: {
        setIds: (isCustomEmoji ? order : global.customEmojis.added.setIds),
      },
    },
  };
});

addActionHandler('showNotification', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), ...notification } = payload;
  notification.localId = generateIdFor({});

  const newNotifications = [...selectTabState(global, tabId).notifications];
  const existingNotificationIndex = newNotifications.findIndex((n) => n.message === notification.message);
  if (existingNotificationIndex !== -1) {
    newNotifications.splice(existingNotificationIndex, 1);
  }

  newNotifications.push(notification as ApiNotification);

  return updateTabState(global, {
    notifications: newNotifications,
  }, tabId);
});

addActionHandler('showAllowedMessageTypesNotification', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const {
    canSendPlainText, canSendPhotos, canSendVideos, canSendDocuments, canSendAudios,
    canSendStickers, canSendRoundVideos, canSendVoices,
  } = getAllowedAttachmentOptions(chat);
  const allowedContent = compact([
    canSendPlainText ? 'Chat.SendAllowedContentTypeText' : undefined,
    canSendPhotos ? 'Chat.SendAllowedContentTypePhoto' : undefined,
    canSendVideos ? 'Chat.SendAllowedContentTypeVideo' : undefined,
    canSendVoices ? 'Chat.SendAllowedContentTypeVoiceMessage' : undefined,
    canSendRoundVideos ? 'Chat.SendAllowedContentTypeVideoMessage' : undefined,
    canSendDocuments ? 'Chat.SendAllowedContentTypeFile' : undefined,
    canSendAudios ? 'Chat.SendAllowedContentTypeMusic' : undefined,
    canSendStickers ? 'Chat.SendAllowedContentTypeSticker' : undefined,
  ]).map((l) => langProvider.translate(l));

  if (!allowedContent.length) {
    actions.showNotification({
      message: langProvider.translate('Chat.SendNotAllowedText'),
      tabId,
    });
    return;
  }

  const lastDelimiter = langProvider.translate('AutoDownloadSettings.LastDelimeter');
  const allowedContentString = allowedContent.join(', ').replace(/,([^,]*)$/, `${lastDelimiter}$1`);

  actions.showNotification({
    message: langProvider.translate('Chat.SendAllowedContentText', allowedContentString),
    tabId,
  });
});

addActionHandler('dismissNotification', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  const newNotifications = selectTabState(global, tabId)
    .notifications.filter(({ localId }) => localId !== payload.localId);

  return updateTabState(global, {
    notifications: newNotifications,
  }, tabId);
});

addActionHandler('showDialog', (global, actions, payload): ActionReturnType => {
  const { data, tabId = getCurrentTabId() } = payload!;

  // Filter out errors that we don't want to show to the user
  if ('message' in data && data.hasErrorKey && !getReadableErrorText(data)) {
    return global;
  }

  const newDialogs = [...selectTabState(global, tabId).dialogs];
  if ('message' in data) {
    const existingErrorIndex = newDialogs.findIndex((err) => (err as ApiError).message === data.message);
    if (existingErrorIndex !== -1) {
      newDialogs.splice(existingErrorIndex, 1);
    }
  }

  newDialogs.push(data);

  return updateTabState(global, {
    dialogs: newDialogs,
  }, tabId);
});

addActionHandler('dismissDialog', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const newDialogs = [...selectTabState(global, tabId).dialogs];

  newDialogs.pop();

  return updateTabState(global, {
    dialogs: newDialogs,
  }, tabId);
});

addActionHandler('toggleSafeLinkModal', (global, actions, payload): ActionReturnType => {
  const { url: safeLinkModalUrl, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    safeLinkModalUrl,
  }, tabId);
});

addActionHandler('openHistoryCalendar', (global, actions, payload): ActionReturnType => {
  const { selectedAt, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    historyCalendarSelectedAt: selectedAt,
  }, tabId);
});

addActionHandler('closeHistoryCalendar', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    historyCalendarSelectedAt: undefined,
  }, tabId);
});

addActionHandler('openGame', (global, actions, payload): ActionReturnType => {
  const {
    url, chatId, messageId, tabId = getCurrentTabId(),
  } = payload;

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return;

  const botId = message.viaBotId || message.senderId;
  if (!botId) return;

  if (!selectIsTrustedBot(global, botId)) {
    global = updateTabState(global, {
      botTrustRequest: {
        botId,
        type: 'game',
        onConfirm: {
          action: 'openGame',
          payload,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    openedGame: {
      url,
      chatId,
      messageId,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeGame', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    openedGame: undefined,
  }, tabId);
});

addActionHandler('requestConfetti', (global, actions, payload): ActionReturnType => {
  const {
    top, left, width, height, tabId = getCurrentTabId(),
  } = payload || {};
  const { animationLevel } = global.settings.byKey;
  if (animationLevel === 0) return undefined;

  return updateTabState(global, {
    confetti: {
      lastConfettiTime: Date.now(),
      top,
      left,
      width,
      height,
    },
  }, tabId);
});

addActionHandler('updateAttachmentSettings', (global, actions, payload): ActionReturnType => {
  const {
    shouldCompress, shouldSendGrouped,
  } = payload;

  return {
    ...global,
    attachmentSettings: {
      shouldCompress: shouldCompress ?? global.attachmentSettings.shouldCompress,
      shouldSendGrouped: shouldSendGrouped ?? global.attachmentSettings.shouldSendGrouped,
    },
  };
});

addActionHandler('openLimitReachedModal', (global, actions, payload): ActionReturnType => {
  const { limit, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    limitReachedModal: {
      limit,
    },
  }, tabId);
});

addActionHandler('closeLimitReachedModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    limitReachedModal: undefined,
  }, tabId);
});

addActionHandler('closeStickerSetModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    openedStickerSetShortName: undefined,
  }, tabId);
});

addActionHandler('openCustomEmojiSets', (global, actions, payload): ActionReturnType => {
  const { setIds, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    openedCustomEmojiSetIds: setIds,
  }, tabId);
});

addActionHandler('closeCustomEmojiSets', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    openedCustomEmojiSetIds: undefined,
  }, tabId);
});

addActionHandler('updateLastRenderedCustomEmojis', (global, actions, payload): ActionReturnType => {
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

addActionHandler('openCreateTopicPanel', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  // Topic panel can be opened only if there is a selected chat
  const currentChat = selectCurrentChat(global, tabId);
  if (!currentChat) actions.openChat({ id: chatId, threadId: MAIN_THREAD_ID, tabId });

  return updateTabState(global, {
    createTopicPanel: {
      chatId,
    },
  }, tabId);
});

addActionHandler('closeCreateTopicPanel', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    createTopicPanel: undefined,
  }, tabId);
});

addActionHandler('openEditTopicPanel', (global, actions, payload): ActionReturnType => {
  const { chatId, topicId, tabId = getCurrentTabId() } = payload;

  // Topic panel can be opened only if there is a selected chat
  const currentChat = selectCurrentChat(global, tabId);
  if (!currentChat) actions.openChat({ id: chatId, tabId });

  return updateTabState(global, {
    editTopicPanel: {
      chatId,
      topicId,
    },
  }, tabId);
});

addActionHandler('closeEditTopicPanel', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    editTopicPanel: undefined,
  }, tabId);
});

addActionHandler('updateArchiveSettings', (global, actions, payload): ActionReturnType => {
  const { archiveSettings } = global;
  const { isHidden = archiveSettings.isHidden, isMinimized = archiveSettings.isMinimized } = payload;

  return {
    ...global,
    archiveSettings: {
      isHidden,
      isMinimized,
    },
  };
});

addActionHandler('checkAppVersion', (global): ActionReturnType => {
  const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

  fetch(`${APP_VERSION_URL}?${Date.now()}`)
    .then((response) => response.text())
    .then((version) => {
      version = version.trim();

      if (APP_VERSION_REGEX.test(version) && version !== APP_VERSION) {
        global = getGlobal();
        global = {
          ...global,
          isUpdateAvailable: true,
        };
        setGlobal(global);
      }
    })
    .catch((err) => {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[checkAppVersion failed] ', err);
      }
    });
});

addActionHandler('afterHangUp', (global): ActionReturnType => {
  if (!selectTabState(global, getCurrentTabId()).multitabNextAction) return;
  reestablishMasterToSelf();
});

let notificationInterval: number | undefined;

const NOTIFICATION_INTERVAL = 500;

addActionHandler('onTabFocusChange', (global, actions, payload): ActionReturnType => {
  const { isBlurred, tabId = getCurrentTabId() } = payload;

  if (!isBlurred) {
    actions.updateIsOnline(true);
  }

  const blurredTabTokens = unique(isBlurred
    ? [...global.blurredTabTokens, tabId]
    : global.blurredTabTokens.filter((t) => t !== tabId));

  if (blurredTabTokens.length === getAllMultitabTokens().length) {
    actions.updateIsOnline(false);
  }

  if (isBlurred) {
    if (notificationInterval) clearInterval(notificationInterval);

    notificationInterval = window.setInterval(() => {
      actions.updatePageTitle({
        tabId,
      });
    }, NOTIFICATION_INTERVAL);
  } else {
    clearInterval(notificationInterval);
    notificationInterval = undefined;
  }

  return {
    ...global,
    blurredTabTokens,
    initialUnreadNotifications: isBlurred ? getAllNotificationsCount() : undefined,
  };
});

addActionHandler('updatePageTitle', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { canDisplayChatInTitle } = global.settings.byKey;
  const currentUserId = global.currentUserId;

  if (document.title.includes(INACTIVE_MARKER)) {
    updateIcon(false);
    setPageTitleInstant(`${PAGE_TITLE} ${INACTIVE_MARKER}`);
    return;
  }

  if (global.initialUnreadNotifications && Math.round(Date.now() / 1000) % 2 === 0) {
    const notificationCount = getAllNotificationsCount();

    const newUnread = notificationCount - global.initialUnreadNotifications;

    if (newUnread > 0) {
      setPageTitleInstant(`${newUnread} notification${newUnread > 1 ? 's' : ''}`);
      updateIcon(true);
      return;
    }
  }

  updateIcon(false);

  const messageList = selectCurrentMessageList(global, tabId);
  if (messageList && canDisplayChatInTitle) {
    const { chatId, threadId } = messageList;
    const currentChat = selectChat(global, chatId);
    if (currentChat) {
      const title = getChatTitle(langProvider.translate, currentChat, undefined, chatId === currentUserId);
      if (currentChat.isForum && currentChat.topics?.[threadId]) {
        setPageTitle(`${title} › ${currentChat.topics[threadId].title}`);
        return;
      }

      setPageTitle(title);
      return;
    }
  }

  setPageTitleInstant(PAGE_TITLE);
});
