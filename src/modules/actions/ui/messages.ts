import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { ApiMessage, MAIN_THREAD_ID } from '../../../api/types';
import { FocusDirection } from '../../../types';

import {
  ANIMATION_END_DELAY,
  APP_VERSION,
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
} from '../../selectors';
import { findLast } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';

import versionNotification from '../../../versionNotification.txt';
import parseMessageInput from '../../../util/parseMessageInput';

const FOCUS_DURATION = 1500;
const FOCUS_NO_HIGHLIGHT_DURATION = FAST_SMOOTH_MAX_DURATION + ANIMATION_END_DELAY;
const POLL_RESULT_OPEN_DELAY_MS = 450;
const SERVICE_NOTIFICATIONS_MAX_AMOUNT = 1e3;

let blurTimeout: number | undefined;

addReducer('setScrollOffset', (global, actions, payload) => {
  const { chatId, threadId, scrollOffset } = payload!;

  return replaceThreadParam(global, chatId, threadId, 'scrollOffset', scrollOffset);
});

addReducer('setReplyingToId', (global, actions, payload) => {
  const { messageId } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }
  const { chatId, threadId } = currentMessageList;

  return replaceThreadParam(global, chatId, threadId, 'replyingToId', messageId);
});

addReducer('setEditingId', (global, actions, payload) => {
  const { messageId } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId, type } = currentMessageList;
  const paramName = type === 'scheduled' ? 'editingScheduledId' : 'editingId';

  return replaceThreadParam(global, chatId, threadId, paramName, messageId);
});

addReducer('editLastMessage', (global) => {
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

addReducer('replyToNextMessage', (global, actions, payload) => {
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

addReducer('openMediaViewer', (global, actions, payload) => {
  const {
    chatId, threadId, messageId, avatarOwnerId, profilePhotoIndex, origin,
  } = payload!;

  return {
    ...global,
    mediaViewer: {
      chatId,
      threadId,
      messageId,
      avatarOwnerId,
      profilePhotoIndex,
      origin,
    },
    forwardMessages: {},
  };
});

addReducer('closeMediaViewer', (global) => {
  return {
    ...global,
    mediaViewer: {},
  };
});

addReducer('openAudioPlayer', (global, actions, payload) => {
  const {
    chatId, threadId, messageId, origin, volume, playbackRate, isMuted,
  } = payload!;

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

addReducer('setAudioPlayerVolume', (global, actions, payload) => {
  const {
    volume,
  } = payload!;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      volume,
    },
  };
});

addReducer('setAudioPlayerPlaybackRate', (global, actions, payload) => {
  const {
    playbackRate,
  } = payload!;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      playbackRate,
    },
  };
});

addReducer('setAudioPlayerMuted', (global, actions, payload) => {
  const {
    isMuted,
  } = payload!;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      isMuted,
    },
  };
});

addReducer('setAudioPlayerOrigin', (global, actions, payload) => {
  const {
    origin,
  } = payload!;

  return {
    ...global,
    audioPlayer: {
      ...global.audioPlayer,
      origin,
    },
  };
});

addReducer('closeAudioPlayer', (global) => {
  return {
    ...global,
    audioPlayer: {
      volume: global.audioPlayer.volume,
      playbackRate: global.audioPlayer.playbackRate,
      isMuted: global.audioPlayer.isMuted,
    },
  };
});

addReducer('openPollResults', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  const shouldOpenInstantly = selectIsRightColumnShown(global);

  if (!shouldOpenInstantly) {
    window.setTimeout(() => {
      const newGlobal = getGlobal();

      setGlobal({
        ...newGlobal,
        pollResults: {
          chatId,
          messageId,
          voters: {},
        },
      });
    }, POLL_RESULT_OPEN_DELAY_MS);
  } else if (chatId !== global.pollResults.chatId || messageId !== global.pollResults.messageId) {
    setGlobal({
      ...global,
      pollResults: {
        chatId,
        messageId,
        voters: {},
      },
    });
  }
});

addReducer('closePollResults', (global) => {
  setGlobal({
    ...global,
    pollResults: {},
  });
});

addReducer('focusLastMessage', (global, actions) => {
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
    chatId, threadId, messageId: lastMessageId, noHighlight: true,
  });
});

addReducer('focusNextReply', (global, actions) => {
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId } = currentMessageList;

  const replyStack = selectReplyStack(global, chatId, threadId);

  if (!replyStack || replyStack.length === 0) {
    actions.focusLastMessage();
  } else {
    const messageId = replyStack.pop();

    global = replaceThreadParam(global, chatId, threadId, 'replyStack', [...replyStack]);

    setGlobal(global);

    actions.focusMessage({
      chatId,
      threadId,
      messageId,
    });
  }

  return undefined;
});

addReducer('focusMessage', (global, actions, payload) => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageListType = 'thread', noHighlight, groupedId, groupedChatId,
    replyMessageId, isResizingContainer,
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
    actions.openChat({ id: chatId, threadId });
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

  actions.openChat({ id: chatId, threadId });
  actions.loadViewportMessages();
  return undefined;
});

addReducer('openForwardMenu', (global, actions, payload) => {
  const { fromChatId, messageIds, groupedId } = payload!;
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
    },
  };
});

addReducer('exitForwardMode', (global) => {
  setGlobal({
    ...global,
    forwardMessages: {},
  });
});

addReducer('setForwardChatId', (global, actions, payload) => {
  const { id } = payload!;

  setGlobal({
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      toChatId: id,
      isModalShown: false,
    },
  });

  actions.openChat({ id });
  actions.closeMediaViewer();
  actions.exitMessageSelectMode();
});

addReducer('openForwardMenuForSelectedMessages', (global, actions) => {
  if (!global.selectedMessages) {
    return;
  }

  const { chatId: fromChatId, messageIds } = global.selectedMessages;

  actions.openForwardMenu({ fromChatId, messageIds });
});

addReducer('cancelMessageMediaDownload', (global, actions, payload) => {
  const { message } = payload!;

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

addReducer('downloadMessageMedia', (global, actions, payload) => {
  const { message } = payload!;
  if (!message) return;

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

addReducer('downloadSelectedMessages', (global, actions) => {
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

addReducer('enterMessageSelectMode', (global, actions, payload) => {
  const { messageId } = payload || {};
  const openChat = selectCurrentChat(global);
  if (!openChat) {
    return global;
  }

  return enterMessageSelectMode(global, openChat.id, messageId);
});

addReducer('toggleMessageSelection', (global, actions, payload) => {
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

addReducer('disableContextMenuHint', (global) => {
  if (!global.shouldShowContextMenuHint) {
    return undefined;
  }

  return {
    ...global,
    shouldShowContextMenuHint: false,
  };
});

addReducer('exitMessageSelectMode', exitMessageSelectMode);

addReducer('openPollModal', (global) => {
  return {
    ...global,
    isPollModalOpen: true,
  };
});

addReducer('closePollModal', (global) => {
  return {
    ...global,
    isPollModalOpen: false,
  };
});

addReducer('checkVersionNotification', (global, actions) => {
  const currentVersion = APP_VERSION.split('.').slice(0, 2).join('.');
  const { serviceNotifications } = global;

  if (serviceNotifications.find(({ version }) => version === currentVersion)) {
    return;
  }

  const message: Omit<ApiMessage, 'id'> = {
    chatId: SERVICE_NOTIFICATIONS_USER_ID,
    date: getServerTime(global.serverTimeOffset),
    content: {
      text: parseMessageInput(versionNotification),
    },
    isOutgoing: false,
  };

  actions.createServiceNotification({
    message,
    version: currentVersion,
  });
});

addReducer('createServiceNotification', (global, actions, payload) => {
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

addReducer('openReactorListModal', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  return {
    ...global,
    reactorModal: { chatId, messageId },
  };
});

addReducer('closeReactorListModal', (global) => {
  return {
    ...global,
    reactorModal: undefined,
  };
});

addReducer('openSeenByModal', (global, actions, payload) => {
  const { chatId, messageId } = payload!;

  return {
    ...global,
    seenByModal: { chatId, messageId },
  };
});

addReducer('closeSeenByModal', (global) => {
  return {
    ...global,
    seenByModal: undefined,
  };
});
