import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ApiMessage } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { FocusDirection } from '../../../types';
import type { GlobalState } from '../../types';

import {
  ANIMATION_END_DELAY,
  APP_VERSION,
  RELEASE_DATETIME,
  FAST_SMOOTH_MAX_DURATION,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import {
  enterMessageSelectMode,
  toggleMessageSelection,
  exitMessageSelectMode,
  replaceThreadParam,
  updateFocusDirection,
  updateFocusedMessage,
} from '../../reducers';
import {
  selectCurrentChat,
  selectViewportIds,
  selectIsRightColumnShown,
  selectCurrentMessageList,
  selectChat,
  selectThreadInfo,
  selectChatMessages,
  selectAllowedMessageActions,
  selectMessageIdsByGroupId,
  selectForwardedMessageIdsByGroupId,
  selectIsViewportNewest,
  selectReplyingToId,
  selectReplyStack,
  selectSender,
  selectChatScheduledMessages,
} from '../../selectors';
import { findLast } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';

import versionNotification from '../../../versionNotification.txt';
import parseMessageInput from '../../../util/parseMessageInput';
import { getMessageSummaryText, getSenderTitle } from '../../helpers';
import * as langProvider from '../../../util/langProvider';
import { copyHtmlToClipboard } from '../../../util/clipboard';
import { renderMessageSummaryHtml } from '../../helpers/renderMessageSummaryHtml';
import { getIsMobile } from '../../../hooks/useAppLayout';

const FOCUS_DURATION = 1500;
const FOCUS_NO_HIGHLIGHT_DURATION = FAST_SMOOTH_MAX_DURATION + ANIMATION_END_DELAY;
const POLL_RESULT_OPEN_DELAY_MS = 450;
const VERSION_NOTIFICATION_DURATION = 1000 * 60 * 60 * 24 * 3; // 3 days
const SERVICE_NOTIFICATIONS_MAX_AMOUNT = 1e3;

let blurTimeout: number | undefined;

addActionHandler('setScrollOffset', (global, actions, payload) => {
  const { chatId, threadId, scrollOffset } = payload!;

  return replaceThreadParam(global, chatId, threadId, 'scrollOffset', scrollOffset);
});

addActionHandler('setReplyingToId', (global, actions, payload) => {
  const { messageId } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }
  const { chatId, threadId } = currentMessageList;

  return replaceThreadParam(global, chatId, threadId, 'replyingToId', messageId);
});

addActionHandler('setEditingId', (global, actions, payload) => {
  const { messageId } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId, type } = currentMessageList;
  const paramName = type === 'scheduled' ? 'editingScheduledId' : 'editingId';

  return replaceThreadParam(global, chatId, threadId, paramName, messageId);
});

addActionHandler('setEditingDraft', (global, actions, payload) => {
  const {
    text, chatId, threadId, type,
  } = payload;

  const paramName = type === 'scheduled' ? 'editingScheduledDraft' : 'editingDraft';

  return replaceThreadParam(global, chatId, threadId, paramName, text);
});

addActionHandler('editLastMessage', (global) => {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, threadId);
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

addActionHandler('replyToNextMessage', (global, actions, payload) => {
  const { targetIndexDelta } = payload;
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, threadId);
  if (!chatMessages || !viewportIds) {
    return;
  }

  const replyingToId = selectReplyingToId(global, chatId, threadId);
  const isLatest = selectIsViewportNewest(global, chatId, threadId);

  let messageId: number | undefined;

  if (!isLatest || !replyingToId) {
    if (threadId === MAIN_THREAD_ID) {
      const chat = selectChat(global, chatId);

      messageId = chat?.lastMessage?.id;
    } else {
      const threadInfo = selectThreadInfo(global, chatId, threadId);

      messageId = threadInfo?.lastMessageId;
    }
  } else {
    const chatMessageKeys = Object.keys(chatMessages);
    const indexOfCurrent = chatMessageKeys.indexOf(replyingToId.toString());
    const newIndex = indexOfCurrent + targetIndexDelta;
    messageId = newIndex <= chatMessageKeys.length + 1 && newIndex >= 0
      ? Number(chatMessageKeys[newIndex])
      : undefined;
  }
  actions.setReplyingToId({ messageId });
  actions.focusMessage({
    chatId, threadId, messageId,
  });
});

addActionHandler('openAudioPlayer', (global, actions, payload) => {
  const {
    chatId, threadId, messageId, origin, volume, playbackRate, isMuted,
  } = payload;

  return {
    ...global,
    audioPlayer: {
      chatId,
      threadId,
      messageId,
      origin: origin ?? global.audioPlayer.origin,
      volume: volume ?? global.audioPlayer.volume,
      playbackRate: playbackRate || global.audioPlayer.playbackRate,
      isMuted: isMuted || global.audioPlayer.isMuted,
    },
  };
});

addActionHandler('setAudioPlayerVolume', (global, actions, payload) => {
  const {
    volume,
  } = payload;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      volume,
      isMuted: false,
    },
  };
});

addActionHandler('setAudioPlayerPlaybackRate', (global, actions, payload) => {
  const {
    playbackRate,
  } = payload;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      playbackRate,
    },
  };
});

addActionHandler('setAudioPlayerMuted', (global, actions, payload) => {
  const {
    isMuted,
  } = payload;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      isMuted,
    },
  };
});

addActionHandler('setAudioPlayerOrigin', (global, actions, payload) => {
  const {
    origin,
  } = payload;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      origin,
    },
  };
});

addActionHandler('closeAudioPlayer', (global) => {
  return {
    ...global,
    audioPlayer: {
      volume: global.audioPlayer.volume,
      playbackRate: global.audioPlayer.playbackRate,
      isMuted: global.audioPlayer.isMuted,
    },
  };
});

addActionHandler('openPollResults', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  const shouldOpenInstantly = selectIsRightColumnShown(global, getIsMobile());

  if (!shouldOpenInstantly) {
    window.setTimeout(() => {
      global = getGlobal();

      setGlobal({
        ...global,
        pollResults: {
          chatId,
          messageId,
          voters: {},
        },
      });
    }, POLL_RESULT_OPEN_DELAY_MS);
  } else if (chatId !== global.pollResults.chatId || messageId !== global.pollResults.messageId) {
    return {
      ...global,
      pollResults: {
        chatId,
        messageId,
        voters: {},
      },
    };
  }

  return undefined;
});

addActionHandler('closePollResults', (global) => {
  return {
    ...global,
    pollResults: {},
  };
});

addActionHandler('focusLastMessage', (global, actions, payload) => {
  const { noForumTopicPanel } = payload || {};
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId } = currentMessageList;

  let lastMessageId: number | undefined;
  if (threadId === MAIN_THREAD_ID) {
    const chat = selectChat(global, chatId);

    lastMessageId = chat?.lastMessage?.id;
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    lastMessageId = threadInfo?.lastMessageId;
  }

  if (!lastMessageId) {
    return;
  }

  actions.focusMessage({
    chatId, threadId, messageId: lastMessageId, noHighlight: true, noForumTopicPanel,
  });
});

addActionHandler('focusNextReply', (global, actions) => {
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId } = currentMessageList;

  const replyStack = selectReplyStack(global, chatId, threadId);

  if (!replyStack || replyStack.length === 0) {
    actions.focusLastMessage({ noForumTopicPanel: true });
  } else {
    const messageId = replyStack.pop();

    global = replaceThreadParam(global, chatId, threadId, 'replyStack', [...replyStack]);

    setGlobal(global);

    actions.focusMessage({
      chatId,
      threadId,
      messageId,
      noForumTopicPanel: true,
    });
  }

  return undefined;
});

addActionHandler('focusMessage', (global, actions, payload) => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageListType = 'thread', noHighlight, groupedId, groupedChatId,
    replyMessageId, isResizingContainer, shouldReplaceHistory, noForumTopicPanel,
  } = payload!;

  let { messageId } = payload!;

  if (groupedId !== undefined) {
    const ids = selectForwardedMessageIdsByGroupId(global, groupedChatId, groupedId);
    if (ids?.length) {
      ([messageId] = ids);
    }
  }

  const currentMessageList = selectCurrentMessageList(global);
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
    let newGlobal = getGlobal();
    newGlobal = updateFocusedMessage(newGlobal);
    newGlobal = updateFocusDirection(newGlobal);
    setGlobal(newGlobal);
  }, noHighlight ? FOCUS_NO_HIGHLIGHT_DURATION : FOCUS_DURATION);

  global = updateFocusedMessage(global, chatId, messageId, noHighlight, isResizingContainer);
  global = updateFocusDirection(global, undefined);

  if (replyMessageId) {
    const replyStack = selectReplyStack(global, chatId, threadId) || [];
    global = replaceThreadParam(global, chatId, threadId, 'replyStack', [...replyStack, replyMessageId]);
  }

  if (shouldSwitchChat) {
    global = updateFocusDirection(global, FocusDirection.Static);
  }

  const viewportIds = selectViewportIds(global, chatId, threadId);
  if (viewportIds && viewportIds.includes(messageId)) {
    setGlobal(global);
    actions.openChat({
      id: chatId,
      threadId,
      shouldReplaceHistory,
      noForumTopicPanel,
    });
    return undefined;
  }

  if (shouldSwitchChat) {
    global = replaceThreadParam(global, chatId, threadId, 'viewportIds', undefined);
  }

  global = replaceThreadParam(global, chatId, threadId, 'outlyingIds', undefined);

  if (viewportIds && !shouldSwitchChat) {
    const direction = messageId > viewportIds[0] ? FocusDirection.Down : FocusDirection.Up;
    global = updateFocusDirection(global, direction);
  }

  setGlobal(global);

  actions.openChat({
    id: chatId,
    threadId,
    shouldReplaceHistory,
    noForumTopicPanel,
  });
  actions.loadViewportMessages();
  return undefined;
});

addActionHandler('openForwardMenu', (global, actions, payload) => {
  const {
    fromChatId, messageIds, groupedId, withMyScore,
  } = payload;
  let groupedMessageIds;
  if (groupedId) {
    groupedMessageIds = selectMessageIdsByGroupId(global, fromChatId, groupedId);
  }
  return {
    ...global,
    forwardMessages: {
      fromChatId,
      messageIds: groupedMessageIds || messageIds,
      isModalShown: true,
      withMyScore,
    },
  };
});

addActionHandler('changeForwardRecipient', (global) => {
  return {
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      toChatId: undefined,
      isModalShown: true,
      noAuthors: false,
      noCaptions: false,
    },
  };
});

addActionHandler('setForwardNoAuthors', (global, actions, payload) => {
  return {
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      noAuthors: payload,
      noCaptions: payload && global.forwardMessages.noCaptions, // `noCaptions` cannot be true when `noAuthors` is false
    },
  };
});

addActionHandler('setForwardNoCaptions', (global, actions, payload) => {
  return {
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      noCaptions: payload,
      noAuthors: payload, // On other clients `noAuthors` updates together with `noCaptions`
    },
  };
});

addActionHandler('exitForwardMode', (global) => {
  setGlobal({
    ...global,
    forwardMessages: {},
  });
});

addActionHandler('openForwardMenuForSelectedMessages', (global, actions) => {
  if (!global.selectedMessages) {
    return;
  }

  const { chatId: fromChatId, messageIds } = global.selectedMessages;

  actions.openForwardMenu({ fromChatId, messageIds });
});

addActionHandler('cancelMessageMediaDownload', (global, actions, payload) => {
  const { message } = payload;

  const byChatId = global.activeDownloads.byChatId[message.chatId];
  if (!byChatId || !byChatId.length) return;

  setGlobal({
    ...global,
    activeDownloads: {
      byChatId: {
        ...global.activeDownloads.byChatId,
        [message.chatId]: byChatId.filter((id) => id !== message.id),
      },
    },
  });
});

addActionHandler('cancelMessagesMediaDownload', (global, actions, payload) => {
  const { messages } = payload;

  const byChatId = global.activeDownloads.byChatId;
  const newByChatId: GlobalState['activeDownloads']['byChatId'] = {};
  Object.keys(byChatId).forEach((chatId) => {
    newByChatId[chatId] = byChatId[chatId].filter((id) => !messages.find((message) => message.id === id));
  });
  return {
    ...global,
    activeDownloads: {
      byChatId: newByChatId,
    },
  };
});

addActionHandler('downloadMessageMedia', (global, actions, payload) => {
  const { message } = payload;

  setGlobal({
    ...global,
    activeDownloads: {
      byChatId: {
        ...global.activeDownloads.byChatId,
        [message.chatId]: [...(global.activeDownloads.byChatId[message.chatId] || []), message.id],
      },
    },
  });
});

addActionHandler('downloadSelectedMessages', (global, actions) => {
  if (!global.selectedMessages) {
    return;
  }

  const { chatId, messageIds } = global.selectedMessages;
  const { threadId } = selectCurrentMessageList(global) || {};

  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages || !threadId) return;
  const messages = messageIds.map((id) => chatMessages[id])
    .filter((message) => selectAllowedMessageActions(global, message, threadId).canDownload);
  messages.forEach((message) => actions.downloadMessageMedia({ message }));
});

addActionHandler('enterMessageSelectMode', (global, actions, payload) => {
  const { messageId } = payload || {};
  const openChat = selectCurrentChat(global);
  if (!openChat) {
    return global;
  }

  return enterMessageSelectMode(global, openChat.id, messageId);
});

addActionHandler('toggleMessageSelection', (global, actions, payload) => {
  const {
    messageId,
    groupedId,
    childMessageIds,
    withShift,
  } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId, type: messageListType } = currentMessageList;

  global = toggleMessageSelection(
    global, chatId, threadId, messageListType, messageId, groupedId, childMessageIds, withShift,
  );

  setGlobal(global);

  if (global.shouldShowContextMenuHint) {
    actions.disableContextMenuHint();
    actions.showNotification({
      // eslint-disable-next-line max-len
      message: `To **edit** or **reply**, close this menu. Then ${IS_TOUCH_ENV ? 'long tap' : 'right click'} on a message.`,
    });
  }
});

addActionHandler('disableContextMenuHint', (global) => {
  if (!global.shouldShowContextMenuHint) {
    return undefined;
  }

  return {
    ...global,
    shouldShowContextMenuHint: false,
  };
});

addActionHandler('exitMessageSelectMode', exitMessageSelectMode);

addActionHandler('openPollModal', (global, actions, payload) => {
  const { isQuiz } = payload || {};
  return {
    ...global,
    pollModal: {
      isOpen: true,
      isQuiz,
    },
  };
});

addActionHandler('closePollModal', (global) => {
  return {
    ...global,
    pollModal: {
      isOpen: false,
    },
  };
});

addActionHandler('checkVersionNotification', (global, actions) => {
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
      text: parseMessageInput(versionNotification, true),
    },
    isOutgoing: false,
  };

  actions.createServiceNotification({
    message,
    version: currentVersion,
  });
});

addActionHandler('createServiceNotification', (global, actions, payload) => {
  const { message, version } = payload;
  const { serviceNotifications } = global;
  const serviceChat = selectChat(global, SERVICE_NOTIFICATIONS_USER_ID)!;

  const maxId = Math.max(
    serviceChat.lastMessage?.id || 0,
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

  setGlobal({
    ...global,
    serviceNotifications: [
      ...serviceNotifications.slice(-SERVICE_NOTIFICATIONS_MAX_AMOUNT),
      serviceNotification,
    ],
  });

  actions.apiUpdate({
    '@type': 'newMessage',
    id: message.id,
    chatId: message.chatId,
    message,
  });
});

addActionHandler('openReactorListModal', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  return {
    ...global,
    reactorModal: { chatId, messageId },
  };
});

addActionHandler('closeReactorListModal', (global) => {
  return {
    ...global,
    reactorModal: undefined,
  };
});

addActionHandler('openSeenByModal', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  return {
    ...global,
    seenByModal: { chatId, messageId },
  };
});

addActionHandler('closeSeenByModal', (global) => {
  return {
    ...global,
    seenByModal: undefined,
  };
});

addActionHandler('copySelectedMessages', (global) => {
  if (!global.selectedMessages) {
    return;
  }

  const { chatId, messageIds } = global.selectedMessages;
  copyTextForMessages(global, chatId, messageIds);
});

addActionHandler('copyMessagesByIds', (global, actions, payload: { messageIds?: number[] }) => {
  const { messageIds } = payload;
  const chat = selectCurrentChat(global);
  if (!messageIds || messageIds.length === 0 || !chat) {
    return;
  }

  copyTextForMessages(global, chat.id, messageIds);
});

function copyTextForMessages(global: GlobalState, chatId: string, messageIds: number[]) {
  const { type: messageListType, threadId } = selectCurrentMessageList(global) || {};
  const lang = langProvider.translate;

  const chatMessages = messageListType === 'scheduled'
    ? selectChatScheduledMessages(global, chatId)
    : selectChatMessages(global, chatId);
  if (!chatMessages || !threadId) return;
  const messages = messageIds
    .map((id) => chatMessages[id])
    .filter((message) => selectAllowedMessageActions(global, message, threadId).canCopy)
    .sort((message1, message2) => message1.id - message2.id);

  const result = messages.reduce((acc, message) => {
    const sender = selectSender(global, message);

    acc.push(`> ${sender ? getSenderTitle(lang, sender) : ''}:`);
    acc.push(`${renderMessageSummaryHtml(lang, message)}\n`);

    return acc;
  }, [] as string[]);

  const resultText = messages.reduce((acc, message) => {
    const sender = selectSender(global, message);

    acc.push(`> ${sender ? getSenderTitle(lang, sender) : ''}:`);
    acc.push(`${getMessageSummaryText(lang, message, false, 0, undefined, true)}\n`);

    return acc;
  }, [] as string[]);

  copyHtmlToClipboard(result.join('\n'), resultText.join('\n'));
}
