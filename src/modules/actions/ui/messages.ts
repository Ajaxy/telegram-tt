import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { MAIN_THREAD_ID } from '../../../api/types';
import { FocusDirection, RightColumnContent } from '../../../types';

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
  selectForwardedMessageIdsByGroupId, selectIsViewportNewest, selectReplyingToId,
} from '../../selectors';
import { findLast } from '../../../util/iteratees';
import { HistoryWrapper } from '../../../util/history';

const FOCUS_DURATION = 2000;
const POLL_RESULT_OPEN_DELAY_MS = 450;

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

      messageId = chat && chat.lastMessage ? chat.lastMessage.id : undefined;
    } else {
      const threadInfo = selectThreadInfo(global, chatId, threadId);

      messageId = threadInfo ? threadInfo.lastMessageId : undefined;
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
    chatId, threadId, messageId,
  } = payload!;

  return {
    ...global,
    audioPlayer: {
      chatId,
      threadId,
      messageId,
    },
  };
});

addReducer('closeAudioPlayer', (global) => {
  return {
    ...global,
    audioPlayer: {},
  };
});

addReducer('openPollResults', (global, actions, payload) => {
  const { chatId, messageId, noPushState } = payload!;

  const shouldOpenInstantly = selectIsRightColumnShown(global);

  if (!noPushState) {
    HistoryWrapper.pushState({
      type: 'right',
      contentKey: RightColumnContent.PollResults,
    });
  }

  if (shouldOpenInstantly) {
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

addReducer('closePollResults', (global, actions, payload) => {
  const { noPushState } = payload;

  if (!noPushState) {
    HistoryWrapper.back();
  }

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

    lastMessageId = chat && chat.lastMessage ? chat.lastMessage.id : undefined;
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    lastMessageId = threadInfo ? threadInfo.lastMessageId : undefined;
  }

  if (!lastMessageId) {
    return;
  }

  actions.focusMessage({
    chatId, threadId, messageId: lastMessageId, noHighlight: true,
  });
});

addReducer('focusMessage', (global, actions, payload) => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageListType = 'thread', noHighlight, groupedId, groupedChatId,
  } = payload!;

  let { messageId } = payload!;

  if (groupedId !== undefined) {
    const ids = selectForwardedMessageIdsByGroupId(global, groupedChatId, groupedId);
    if (ids && ids.length) {
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
  }, FOCUS_DURATION);

  global = updateFocusedMessage(global, chatId, messageId, noHighlight);
  global = updateFocusDirection(global, undefined);

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
    return undefined;
  }

  const { chatId, threadId, type: messageListType } = currentMessageList;

  return toggleMessageSelection(
    global, chatId, threadId, messageListType, messageId, groupedId, childMessageIds, withShift,
  );
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
