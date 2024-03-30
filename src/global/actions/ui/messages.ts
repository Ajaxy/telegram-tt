import type { ApiMessage } from '../../../api/types';
import type {
  ActionReturnType,
  GlobalState,
} from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { FocusDirection } from '../../../types';

import {
  ANIMATION_END_DELAY,
  FAST_SMOOTH_MAX_DURATION,
  RELEASE_DATETIME,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../../config';
import { copyHtmlToClipboard } from '../../../util/clipboard';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { compact, findLast } from '../../../util/iteratees';
import * as langProvider from '../../../util/langProvider';
import { translate } from '../../../util/langProvider';
import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';
import { getServerTime } from '../../../util/serverTime';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import versionNotification from '../../../versionNotification.txt';
import {
  getIsSavedDialog, getMessageSummaryText, getSenderTitle, isChatChannel, isJoinedChannelMessage,
} from '../../helpers';
import { renderMessageSummaryHtml } from '../../helpers/renderMessageSummaryHtml';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addActiveMessageMediaDownload,
  cancelMessageMediaDownload,
  enterMessageSelectMode,
  exitMessageSelectMode,
  replaceTabThreadParam,
  replaceThreadParam,
  toggleMessageSelection,
  updateFocusDirection,
  updateFocusedMessage,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectAllowedMessageActions,
  selectChat,
  selectChatLastMessageId,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentChat,
  selectCurrentMessageList,
  selectDraft,
  selectForwardedMessageIdsByGroupId,
  selectIsRightColumnShown,
  selectIsViewportNewest,
  selectMessageIdsByGroupId,
  selectPinnedIds,
  selectReplyStack,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectSender,
  selectTabState,
  selectThreadInfo,
  selectViewportIds,
} from '../../selectors';

import { getIsMobile } from '../../../hooks/useAppLayout';

const FOCUS_DURATION = 1500;
const FOCUS_NO_HIGHLIGHT_DURATION = FAST_SMOOTH_MAX_DURATION + ANIMATION_END_DELAY;
const POLL_RESULT_OPEN_DELAY_MS = 450;
const VERSION_NOTIFICATION_DURATION = 1000 * 60 * 60 * 24 * 3; // 3 days
const SERVICE_NOTIFICATIONS_MAX_AMOUNT = 1e3;

let blurTimeout: number | undefined;

addActionHandler('setScrollOffset', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId, scrollOffset, tabId = getCurrentTabId(),
  } = payload;

  global = replaceThreadParam(global, chatId, threadId, 'lastScrollOffset', scrollOffset);

  return replaceTabThreadParam(global, chatId, threadId, 'scrollOffset', scrollOffset, tabId);
});

addActionHandler('setEditingId', (global, actions, payload): ActionReturnType => {
  const { messageId, tabId = getCurrentTabId() } = payload;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId, type } = currentMessageList;
  const paramName = type === 'scheduled' ? 'editingScheduledId' : 'editingId';

  return replaceThreadParam(global, chatId, threadId, paramName, messageId);
});

addActionHandler('setEditingDraft', (global, actions, payload): ActionReturnType => {
  const {
    text, chatId, threadId, type,
  } = payload;

  const paramName = type === 'scheduled' ? 'editingScheduledDraft' : 'editingDraft';

  return replaceThreadParam(global, chatId, threadId, paramName, text);
});

addActionHandler('editLastMessage', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (!chatMessages || !viewportIds) {
    return undefined;
  }

  const lastOwnEditableMessageId = findLast(viewportIds, (id) => {
    return Boolean(chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId).canEdit);
  });

  if (!lastOwnEditableMessageId) {
    return undefined;
  }

  return replaceThreadParam(global, chatId, threadId, 'editingId', lastOwnEditableMessageId);
});

addActionHandler('replyToNextMessage', (global, actions, payload): ActionReturnType => {
  const { targetIndexDelta, tabId = getCurrentTabId() } = payload;
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (!chatMessages || !viewportIds) {
    return;
  }

  const replyInfo = selectDraft(global, chatId, threadId)?.replyInfo;
  const isLatest = selectIsViewportNewest(global, chatId, threadId, tabId);

  let messageId: number | undefined;

  if (!isLatest || !replyInfo?.replyToMsgId) {
    if (threadId === MAIN_THREAD_ID) {
      messageId = selectChatLastMessageId(global, chatId);
    } else {
      const threadInfo = selectThreadInfo(global, chatId, threadId);

      messageId = threadInfo?.lastMessageId;
    }
  } else {
    const chatMessageKeys = Object.keys(chatMessages);
    const indexOfCurrent = chatMessageKeys.indexOf(replyInfo.replyToMsgId.toString());
    const newIndex = indexOfCurrent + targetIndexDelta;
    messageId = newIndex <= chatMessageKeys.length + 1 && newIndex >= 0
      ? Number(chatMessageKeys[newIndex])
      : undefined;
  }
  actions.updateDraftReplyInfo({ replyToMsgId: messageId, tabId });
  actions.focusMessage({
    chatId,
    threadId,
    messageId: messageId!,
    tabId,
  });
});

addActionHandler('openAudioPlayer', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId, messageId, origin, volume, playbackRate, isMuted,
    tabId = getCurrentTabId(),
  } = payload;

  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    audioPlayer: {
      chatId,
      threadId,
      messageId,
      origin: origin ?? tabState.audioPlayer.origin,
      volume: volume ?? tabState.audioPlayer.volume,
      playbackRate: playbackRate || tabState.audioPlayer.playbackRate || global.audioPlayer.lastPlaybackRate,
      isPlaybackRateActive: (tabState.audioPlayer.isPlaybackRateActive === undefined
        ? global.audioPlayer.isLastPlaybackRateActive
        : tabState.audioPlayer.isPlaybackRateActive),
      isMuted: isMuted || tabState.audioPlayer.isMuted,
    },
  }, tabId);
});

addActionHandler('setAudioPlayerVolume', (global, actions, payload): ActionReturnType => {
  const {
    volume, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    audioPlayer: {
      ...selectTabState(global, tabId).audioPlayer,
      volume,
      isMuted: false,
    },
  }, tabId);
});

addActionHandler('setAudioPlayerPlaybackRate', (global, actions, payload): ActionReturnType => {
  const {
    playbackRate, isPlaybackRateActive, tabId = getCurrentTabId(),
  } = payload;

  global = {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      lastPlaybackRate: playbackRate,
      isLastPlaybackRateActive: isPlaybackRateActive,
    },
  };

  return updateTabState(global, {
    audioPlayer: {
      ...selectTabState(global, tabId).audioPlayer,
      playbackRate,
      isPlaybackRateActive,
    },
  }, tabId);
});

addActionHandler('setAudioPlayerMuted', (global, actions, payload): ActionReturnType => {
  const {
    isMuted, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    audioPlayer: {
      ...selectTabState(global, tabId).audioPlayer,
      isMuted,
    },
  }, tabId);
});

addActionHandler('setAudioPlayerOrigin', (global, actions, payload): ActionReturnType => {
  const {
    origin, tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    audioPlayer: {
      ...selectTabState(global, tabId).audioPlayer,
      origin,
    },
  }, tabId);
});

addActionHandler('closeAudioPlayer', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    audioPlayer: {
      volume: tabState.audioPlayer.volume,
      playbackRate: tabState.audioPlayer.playbackRate,
      isPlaybackRateActive: tabState.audioPlayer.isPlaybackRateActive,
      isMuted: tabState.audioPlayer.isMuted,
    },
  }, tabId);
});

addActionHandler('openPollResults', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, tabId = getCurrentTabId() } = payload;

  const shouldOpenInstantly = selectIsRightColumnShown(global, getIsMobile(), tabId);
  const tabState = selectTabState(global, tabId);

  if (!shouldOpenInstantly) {
    window.setTimeout(() => {
      global = getGlobal();

      global = updateTabState(global, {
        pollResults: {
          chatId,
          messageId,
          voters: {},
        },
      }, tabId);
      setGlobal(global);
    }, POLL_RESULT_OPEN_DELAY_MS);
  } else if (chatId !== tabState.pollResults.chatId || messageId !== tabState.pollResults.messageId) {
    return updateTabState(global, {
      pollResults: {
        chatId,
        messageId,
        voters: {},
      },
    }, tabId);
  }

  return undefined;
});

addActionHandler('closePollResults', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    pollResults: {},
  }, tabId);
});

addActionHandler('focusLastMessage', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId, type } = currentMessageList;

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

  let lastMessageId: number | undefined;
  if (threadId === MAIN_THREAD_ID) {
    if (type === 'pinned') {
      const pinnedMessageIds = selectPinnedIds(global, chatId, MAIN_THREAD_ID);
      if (!pinnedMessageIds?.length) {
        return;
      }

      lastMessageId = pinnedMessageIds[pinnedMessageIds.length - 1];
    } else {
      lastMessageId = selectChatLastMessageId(global, chatId);

      const chatMessages = selectChatMessages(global, chatId);
      // Workaround for scroll to local message 'you joined this channel'
      const lastChatMessage = Object.values(chatMessages).reverse()[0];
      if (lastMessageId && isJoinedChannelMessage(lastChatMessage) && lastChatMessage.id > lastMessageId) {
        lastMessageId = lastChatMessage.id;
      }
    }
  } else if (isSavedDialog) {
    lastMessageId = selectChatLastMessageId(global, String(threadId), 'saved');
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    lastMessageId = threadInfo?.lastMessageId;
  }

  if (!lastMessageId) {
    return;
  }

  actions.focusMessage({
    chatId,
    threadId,
    messageListType: type,
    messageId: lastMessageId,
    noHighlight: true,
    noForumTopicPanel: true,
    tabId,
  });
});

addActionHandler('focusNextReply', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId } = currentMessageList;

  const replyStack = selectReplyStack(global, chatId, threadId, tabId);

  if (!replyStack || replyStack.length === 0) {
    actions.focusLastMessage({ tabId });
  } else {
    const messageId = replyStack.pop();

    global = replaceTabThreadParam(global, chatId, threadId, 'replyStack', [...replyStack], tabId);

    setGlobal(global);

    actions.focusMessage({
      chatId,
      threadId,
      messageId: messageId!,
      tabId,
      noForumTopicPanel: true,
    });
  }

  return undefined;
});

addActionHandler('focusMessage', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageListType = 'thread', noHighlight, groupedId, groupedChatId,
    replyMessageId, isResizingContainer, shouldReplaceHistory, noForumTopicPanel, quote,
    tabId = getCurrentTabId(),
  } = payload;

  let { messageId } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) {
    actions.showNotification({ message: translate('Conversation.ErrorInaccessibleMessage'), tabId });
    return undefined;
  }

  if (groupedId !== undefined) {
    const ids = selectForwardedMessageIdsByGroupId(global, groupedChatId!, groupedId);
    if (ids?.length) {
      ([messageId] = compact(ids));
    }
  }

  const currentMessageList = selectCurrentMessageList(global, tabId);
  const shouldSwitchChat = !currentMessageList || (
    chatId !== currentMessageList.chatId
    || threadId !== currentMessageList.threadId
    || messageListType !== currentMessageList.type
  );

  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = undefined;
  }
  blurTimeout = window.setTimeout(() => {
    global = getGlobal();
    global = updateFocusedMessage({ global }, tabId);
    global = updateFocusDirection(global, undefined, tabId);
    setGlobal(global);
  }, noHighlight ? FOCUS_NO_HIGHLIGHT_DURATION : FOCUS_DURATION);

  global = updateFocusedMessage({
    global,
    chatId,
    messageId,
    threadId,
    noHighlight,
    isResizingContainer,
    quote,
  }, tabId);
  global = updateFocusDirection(global, undefined, tabId);

  if (replyMessageId) {
    const replyStack = selectReplyStack(global, chatId, threadId, tabId) || [];
    global = replaceTabThreadParam(global, chatId, threadId, 'replyStack', [...replyStack, replyMessageId], tabId);
  }

  if (shouldSwitchChat) {
    global = updateFocusDirection(global, FocusDirection.Static, tabId);
  }

  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (viewportIds && viewportIds.includes(messageId)) {
    setGlobal(global, { forceOnHeavyAnimation: true });
    actions.openThread({
      chatId,
      threadId,
      type: messageListType,
      shouldReplaceHistory,
      noForumTopicPanel,
      tabId,
    });
    return undefined;
  }

  if (shouldSwitchChat) {
    global = replaceTabThreadParam(global, chatId, threadId, 'viewportIds', undefined, tabId);
  }

  if (viewportIds && !shouldSwitchChat) {
    const direction = messageId > viewportIds[0] ? FocusDirection.Down : FocusDirection.Up;
    global = updateFocusDirection(global, direction, tabId);
  }

  setGlobal(global, { forceOnHeavyAnimation: true });

  actions.openThread({
    chatId,
    threadId,
    type: messageListType,
    shouldReplaceHistory,
    noForumTopicPanel,
    tabId,
  });
  actions.loadViewportMessages({
    chatId,
    threadId,
    tabId,
    shouldForceRender: true,
  });
  return undefined;
});

addActionHandler('openForwardMenu', (global, actions, payload): ActionReturnType => {
  const {
    fromChatId, messageIds, storyId, groupedId, withMyScore, tabId = getCurrentTabId(),
  } = payload;
  let groupedMessageIds;
  if (groupedId) {
    groupedMessageIds = selectMessageIdsByGroupId(global, fromChatId, groupedId);
  }
  return updateTabState(global, {
    forwardMessages: {
      fromChatId,
      messageIds: groupedMessageIds || messageIds,
      storyId,
      isModalShown: true,
      withMyScore,
    },
  }, tabId);
});

addActionHandler('changeForwardRecipient', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    forwardMessages: {
      ...selectTabState(global, tabId).forwardMessages,
      toChatId: undefined,
      isModalShown: true,
      noAuthors: false,
      noCaptions: false,
    },
  }, tabId);
});

addActionHandler('setForwardNoAuthors', (global, actions, payload): ActionReturnType => {
  const { noAuthors, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    forwardMessages: {
      ...tabState.forwardMessages,
      noAuthors,
      // `noCaptions` cannot be true when `noAuthors` is false
      noCaptions: noAuthors && tabState.forwardMessages.noCaptions,
    },
  }, tabId);
});

addActionHandler('setForwardNoCaptions', (global, actions, payload): ActionReturnType => {
  const { noCaptions, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    forwardMessages: {
      ...selectTabState(global, tabId).forwardMessages,
      noCaptions,
      noAuthors: noCaptions, // On other clients `noAuthors` updates together with `noCaptions`
    },
  }, tabId);
});

addActionHandler('exitForwardMode', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = updateTabState(global, {
    forwardMessages: {},
  }, tabId);
  setGlobal(global);
});

addActionHandler('openForwardMenuForSelectedMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  if (!tabState.selectedMessages) {
    return;
  }

  const { chatId: fromChatId, messageIds } = tabState.selectedMessages;

  actions.openForwardMenu({ fromChatId, messageIds, tabId });
});

addActionHandler('cancelMessageMediaDownload', (global, actions, payload): ActionReturnType => {
  const { message, tabId = getCurrentTabId() } = payload;

  return cancelMessageMediaDownload(global, message, tabId);
});

addActionHandler('cancelMessagesMediaDownload', (global, actions, payload): ActionReturnType => {
  const { messages, tabId = getCurrentTabId() } = payload;

  for (const message of messages) {
    global = cancelMessageMediaDownload(global, message, tabId);
  }

  return global;
});

addActionHandler('downloadMessageMedia', (global, actions, payload): ActionReturnType => {
  const { message, tabId = getCurrentTabId() } = payload;

  return addActiveMessageMediaDownload(global, message, tabId);
});

addActionHandler('downloadSelectedMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  if (!tabState.selectedMessages) {
    return;
  }

  const { chatId, messageIds } = tabState.selectedMessages;
  const { threadId } = selectCurrentMessageList(global, tabId) || {};

  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages || !threadId) return;
  const messages = messageIds.map((id) => chatMessages[id])
    .filter((message) => selectAllowedMessageActions(global, message, threadId).canDownload);
  messages.forEach((message) => actions.downloadMessageMedia({ message, tabId }));
});

addActionHandler('enterMessageSelectMode', (global, actions, payload): ActionReturnType => {
  const { messageId, tabId = getCurrentTabId() } = payload || {};
  const openChat = selectCurrentChat(global, tabId);
  if (!openChat) {
    return global;
  }

  return enterMessageSelectMode(global, openChat.id, messageId, tabId);
});

addActionHandler('toggleMessageSelection', (global, actions, payload): ActionReturnType => {
  const {
    messageId,
    groupedId,
    childMessageIds,
    withShift,
    tabId = getCurrentTabId(),
  } = payload;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId, type: messageListType } = currentMessageList;

  global = toggleMessageSelection(
    global, chatId, threadId, messageListType, messageId, groupedId, childMessageIds, withShift, tabId,
  );

  setGlobal(global);

  if (global.shouldShowContextMenuHint) {
    actions.disableContextMenuHint();
    actions.showNotification({
      // eslint-disable-next-line max-len
      message: `To **edit** or **reply**, close this menu. Then ${IS_TOUCH_ENV ? 'long tap' : 'right click'} on a message.`,
      tabId,
    });
  }
});

addActionHandler('disableContextMenuHint', (global): ActionReturnType => {
  if (!global.shouldShowContextMenuHint) {
    return undefined;
  }

  return {
    ...global,
    shouldShowContextMenuHint: false,
  };
});

addActionHandler('exitMessageSelectMode', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return exitMessageSelectMode(global, tabId);
});

addActionHandler('openPollModal', (global, actions, payload): ActionReturnType => {
  const { isQuiz, tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    pollModal: {
      isOpen: true,
      isQuiz,
    },
  }, tabId);
});

addActionHandler('closePollModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    pollModal: {
      isOpen: false,
    },
  }, tabId);
});

addActionHandler('checkVersionNotification', (global, actions): ActionReturnType => {
  if (RELEASE_DATETIME && Date.now() > Number(RELEASE_DATETIME) + VERSION_NOTIFICATION_DURATION) {
    return;
  }

  const currentVersion = APP_VERSION.split('.').slice(0, 2).join('.');
  const { serviceNotifications } = global;

  if (serviceNotifications.find(({ version }) => version === currentVersion)) {
    return;
  }

  const message: Omit<ApiMessage, 'id'> = {
    chatId: SERVICE_NOTIFICATIONS_USER_ID,
    date: getServerTime(),
    content: {
      text: parseHtmlAsFormattedText(versionNotification, true),
    },
    isOutgoing: false,
  };

  actions.createServiceNotification({
    message: message as ApiMessage,
    version: currentVersion,
  });
});

addActionHandler('createServiceNotification', (global, actions, payload): ActionReturnType => {
  const { message, version } = payload;
  const { serviceNotifications } = global;

  const maxId = Math.max(
    selectChatLastMessageId(global, SERVICE_NOTIFICATIONS_USER_ID) || 0,
    ...serviceNotifications.map(({ id }) => id),
  );
  const fractionalPart = (serviceNotifications.length + 1) / SERVICE_NOTIFICATIONS_MAX_AMOUNT;
  // The fractional ID is made of the largest integer ID and an incremented fractional part
  const id = Math.floor(maxId) + fractionalPart;

  message.previousLocalId = message.id;
  message.id = id;

  const serviceNotification = {
    id,
    message,
    version,
    isUnread: true,
  };

  global = {
    ...global,
    serviceNotifications: [
      ...serviceNotifications.slice(-SERVICE_NOTIFICATIONS_MAX_AMOUNT),
      serviceNotification,
    ],
  };
  setGlobal(global);

  actions.apiUpdate({
    '@type': 'newMessage',
    id: message.id,
    chatId: message.chatId,
    message,
  });
});

addActionHandler('openReactorListModal', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    reactorModal: { chatId, messageId },
  }, tabId);
});

addActionHandler('closeReactorListModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    reactorModal: undefined,
  }, tabId);
});

addActionHandler('openSeenByModal', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    seenByModal: { chatId, messageId },
  }, tabId);
});

addActionHandler('closeSeenByModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    seenByModal: undefined,
  }, tabId);
});

addActionHandler('openPrivacySettingsNoticeModal', (global, actions, payload): ActionReturnType => {
  const { chatId, isReadDate, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    privacySettingsNoticeModal: { chatId, isReadDate },
  }, tabId);
});

addActionHandler('closePrivacySettingsNoticeModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    privacySettingsNoticeModal: undefined,
  }, tabId);
});

addActionHandler('openChatLanguageModal', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, tabId = getCurrentTabId() } = payload;

  const activeLanguage = messageId
    ? selectRequestedMessageTranslationLanguage(global, chatId, messageId, tabId)
    : selectRequestedChatTranslationLanguage(global, chatId, tabId);

  return updateTabState(global, {
    chatLanguageModal: { chatId, messageId, activeLanguage },
  }, tabId);
});

addActionHandler('closeChatLanguageModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    chatLanguageModal: undefined,
  }, tabId);
});

addActionHandler('copySelectedMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  if (!tabState.selectedMessages) {
    return;
  }

  const { chatId, messageIds } = tabState.selectedMessages;
  copyTextForMessages(global, chatId, messageIds);
});

addActionHandler('copyMessagesByIds', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload;
  const chat = selectCurrentChat(global, tabId);
  if (!messageIds || messageIds.length === 0 || !chat) {
    return;
  }

  copyTextForMessages(global, chat.id, messageIds);
});

addActionHandler('openOneTimeMediaModal', (global, actions, payload): ActionReturnType => {
  const { message, tabId = getCurrentTabId() } = payload;
  global = updateTabState(global, {
    oneTimeMediaModal: {
      message,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeOneTimeMediaModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  global = updateTabState(global, {
    oneTimeMediaModal: undefined,
  }, tabId);
  setGlobal(global);
});

function copyTextForMessages(global: GlobalState, chatId: string, messageIds: number[]) {
  const { type: messageListType, threadId } = selectCurrentMessageList(global) || {};
  const lang = langProvider.translate;

  const chat = selectChat(global, chatId);

  const chatMessages = messageListType === 'scheduled'
    ? selectChatScheduledMessages(global, chatId)
    : selectChatMessages(global, chatId);

  if (!chat || !chatMessages || !threadId) return;

  const messages = messageIds
    .map((id) => chatMessages[id])
    .filter((message) => selectAllowedMessageActions(global, message, threadId).canCopy)
    .sort((message1, message2) => message1.id - message2.id);

  const resultHtml: string[] = [];
  const resultText: string[] = [];

  messages.forEach((message) => {
    const sender = isChatChannel(chat) ? chat : selectSender(global, message);
    const senderTitle = `> ${sender ? getSenderTitle(lang, sender) : message.forwardInfo?.hiddenUserName || ''}:`;

    resultHtml.push(senderTitle);
    resultHtml.push(`${renderMessageSummaryHtml(lang, message)}\n`);

    resultText.push(senderTitle);
    resultText.push(`${getMessageSummaryText(lang, message, false, 0, true)}\n`);
  });

  copyHtmlToClipboard(resultHtml.join('\n'), resultText.join('\n'));
}
