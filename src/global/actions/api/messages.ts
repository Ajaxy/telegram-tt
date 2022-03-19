import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { GlobalActions } from '../../types';
import {
  ApiAttachment,
  ApiChat,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiOnProgress,
  ApiSticker,
  ApiUser,
  ApiVideo,
  MAIN_THREAD_ID,
  MESSAGE_DELETED,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  MAX_MEDIA_FILES_FOR_ALBUM,
  MESSAGE_LIST_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../../config';
import { IS_IOS } from '../../../util/environment';
import { callApi, cancelApiProgress } from '../../../api/gramjs';
import {
  areSortedArraysIntersecting, buildCollectionByKey, split, unique,
} from '../../../util/iteratees';
import {
  addUsers,
  addChatMessagesById,
  replaceThreadParam,
  safeReplaceViewportIds,
  updateChatMessage,
  addChats,
  updateListedIds,
  updateOutlyingIds,
  replaceScheduledMessages,
  updateThreadInfos,
  updateChat,
  updateThreadUnreadFromForwardedMessage,
  updateSponsoredMessage,
} from '../../reducers';
import {
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectFocusedMessageId,
  selectCurrentChat,
  selectListedIds,
  selectOutlyingIds,
  selectViewportIds,
  selectRealLastReadId,
  selectReplyingToId,
  selectEditingId,
  selectDraft,
  selectThreadOriginChat,
  selectThreadTopMessageId,
  selectEditingScheduledId,
  selectEditingMessage,
  selectScheduledMessage,
  selectNoWebPage,
  selectFirstUnreadId,
  selectUser,
  selectSendAs,
  selectSponsoredMessage,
} from '../../selectors';
import { debounce, rafPromise } from '../../../util/schedulers';
import { isServiceNotificationMessage } from '../../helpers';

const uploadProgressCallbacks = new Map<number, ApiOnProgress>();

const runDebouncedForMarkRead = debounce((cb) => cb(), 500, false);

addActionHandler('loadViewportMessages', (global, actions, payload) => {
  const {
    direction = LoadMoreDirection.Around,
    isBudgetPreload = false,
  } = payload || {};

  let { chatId, threadId } = payload || {};

  if (!chatId) {
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return undefined;
    }

    chatId = currentMessageList.chatId;
    threadId = currentMessageList.threadId;
  }

  const chat = selectChat(global, chatId);
  // TODO Revise if `chat.isRestricted` check is needed
  if (!chat || chat.isRestricted) {
    return undefined;
  }

  const viewportIds = selectViewportIds(global, chatId, threadId);
  const listedIds = selectListedIds(global, chatId, threadId);
  const outlyingIds = selectOutlyingIds(global, chatId, threadId);

  if (!viewportIds || !viewportIds.length || direction === LoadMoreDirection.Around) {
    const offsetId = selectFocusedMessageId(global, chatId) || selectRealLastReadId(global, chatId, threadId);
    const isOutlying = Boolean(offsetId && listedIds && !listedIds.includes(offsetId));
    const historyIds = (isOutlying ? outlyingIds : listedIds) || [];
    const {
      newViewportIds, areSomeLocal, areAllLocal,
    } = getViewportSlice(historyIds, offsetId, LoadMoreDirection.Around);

    if (areSomeLocal && newViewportIds.length >= MESSAGE_LIST_SLICE) {
      global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds);
    }

    if (!areAllLocal) {
      void loadViewportMessages(chat, threadId, offsetId, LoadMoreDirection.Around, isOutlying, isBudgetPreload);
    }
  } else {
    const offsetId = direction === LoadMoreDirection.Backwards ? viewportIds[0] : viewportIds[viewportIds.length - 1];
    const isOutlying = Boolean(outlyingIds);
    const historyIds = (isOutlying ? outlyingIds : listedIds)!;
    const {
      newViewportIds, areSomeLocal, areAllLocal,
    } = getViewportSlice(historyIds, offsetId, direction);

    if (areSomeLocal) {
      global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds);
    }

    void loadWithBudget(actions, areAllLocal, isOutlying, isBudgetPreload, chat, threadId, direction, offsetId);

    if (isBudgetPreload) {
      return undefined;
    }
  }

  return global;
});

async function loadWithBudget(
  actions: GlobalActions,
  areAllLocal: boolean, isOutlying: boolean, isBudgetPreload: boolean,
  chat: ApiChat, threadId: number, direction: LoadMoreDirection, offsetId?: number,
) {
  if (!areAllLocal) {
    await loadViewportMessages(
      chat, threadId, offsetId, direction, isOutlying, isBudgetPreload,
    );
  }

  if (!isBudgetPreload) {
    // Let reducer return and update global
    await Promise.resolve();
    actions.loadViewportMessages({
      chatId: chat.id, threadId, direction, isBudgetPreload: true,
    });
  }
}

addActionHandler('loadMessage', (global, actions, payload) => {
  const {
    chatId, messageId, replyOriginForId, threadUpdate,
  } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  (async () => {
    const message = await loadMessage(chat, messageId, replyOriginForId);
    if (message && threadUpdate) {
      const { lastMessageId, isDeleting } = threadUpdate;

      setGlobal(updateThreadUnreadFromForwardedMessage(
        getGlobal(),
        message,
        chatId,
        lastMessageId,
        isDeleting,
      ));
    }
  })();
});

addActionHandler('sendMessage', (global, actions, payload) => {
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId, type } = currentMessageList;

  if (type === 'scheduled' && !payload.scheduledAt) {
    return {
      ...global,
      messages: {
        ...global.messages,
        contentToBeScheduled: payload,
      },
    };
  }

  const chat = selectChat(global, chatId)!;

  const params = {
    ...payload,
    chat,
    replyingTo: selectReplyingToId(global, chatId, threadId),
    noWebPage: selectNoWebPage(global, chatId, threadId),
    sendAs: selectSendAs(global, chatId),
  };

  actions.setReplyingToId({ messageId: undefined });
  actions.clearWebPagePreview({ chatId, threadId, value: false });

  const isSingle = !payload.attachments || payload.attachments.length <= 1;
  const isGrouped = !isSingle && payload.attachments && payload.attachments.length > 1;

  if (isSingle) {
    const { attachments, ...restParams } = params;
    sendMessage({
      ...restParams,
      attachment: attachments ? attachments[0] : undefined,
    });
  } else if (isGrouped) {
    const {
      text, entities, attachments, ...commonParams
    } = params;
    const groupedAttachments = split(attachments, MAX_MEDIA_FILES_FOR_ALBUM);
    for (let i = 0; i < groupedAttachments.length; i++) {
      const [firstAttachment, ...restAttachments] = groupedAttachments[i];
      const groupedId = `${Date.now()}${i}`;

      sendMessage({
        ...commonParams,
        text: i === 0 ? text : undefined,
        entities: i === 0 ? entities : undefined,
        attachment: firstAttachment,
        groupedId: restAttachments.length > 0 ? groupedId : undefined,
      });

      restAttachments.forEach((attachment: ApiAttachment) => {
        sendMessage({
          ...commonParams,
          attachment,
          groupedId,
        });
      });
    }
  } else {
    const {
      text, entities, attachments, replyingTo, ...commonParams
    } = params;

    if (text) {
      sendMessage({
        ...commonParams,
        text,
        entities,
        replyingTo,
      });
    }

    attachments.forEach((attachment: ApiAttachment) => {
      sendMessage({
        ...commonParams,
        attachment,
      });
    });
  }

  return undefined;
});

addActionHandler('editMessage', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const { text, entities } = payload!;

  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId, type: messageListType } = currentMessageList;
  const chat = selectChat(global, chatId);
  const message = selectEditingMessage(global, chatId, threadId, messageListType);
  if (!chat || !message) {
    return;
  }

  void callApi('editMessage', {
    chat, message, text, entities, noWebPage: selectNoWebPage(global, chatId, threadId), serverTimeOffset,
  });

  actions.setEditingId({ messageId: undefined });
});

addActionHandler('cancelSendingMessage', (global, actions, payload) => {
  const { chatId, messageId } = payload!;
  const message = selectChatMessage(global, chatId, messageId);
  const progressCallback = message && uploadProgressCallbacks.get(message.previousLocalId || message.id);
  if (progressCallback) {
    cancelApiProgress(progressCallback);
  }

  actions.apiUpdate({
    '@type': 'deleteMessages',
    ids: [messageId],
    chatId,
  });
});

addActionHandler('saveDraft', (global, actions, payload) => {
  const { chatId, threadId, draft } = payload!;
  if (!draft) {
    return undefined;
  }

  const { text, entities } = draft;
  const chat = selectChat(global, chatId)!;

  if (threadId === MAIN_THREAD_ID) {
    void callApi('saveDraft', {
      chat,
      text,
      entities,
      replyToMsgId: selectReplyingToId(global, chatId, threadId),
    });
  }

  global = replaceThreadParam(global, chatId, threadId, 'draft', draft);
  global = updateChat(global, chatId, { draftDate: Math.round(Date.now() / 1000) });

  return global;
});

addActionHandler('clearDraft', (global, actions, payload) => {
  const { chatId, threadId, localOnly } = payload!;
  if (!selectDraft(global, chatId, threadId)) {
    return undefined;
  }

  const chat = selectChat(global, chatId)!;

  if (!localOnly && threadId === MAIN_THREAD_ID) {
    void callApi('clearDraft', chat);
  }

  global = replaceThreadParam(global, chatId, threadId, 'draft', undefined);
  global = updateChat(global, chatId, { draftDate: undefined });

  return global;
});

addActionHandler('toggleMessageWebPage', (global, actions, payload) => {
  const { chatId, threadId, noWebPage } = payload!;

  return replaceThreadParam(global, chatId, threadId, 'noWebPage', noWebPage);
});

addActionHandler('pinMessage', (global, actions, payload) => {
  const chat = selectCurrentChat(global);
  if (!chat) {
    return;
  }

  const {
    messageId, isUnpin, isOneSide, isSilent,
  } = payload!;

  void callApi('pinMessage', {
    chat, messageId, isUnpin, isOneSide, isSilent,
  });
});

addActionHandler('unpinAllMessages', (global, actions, payload) => {
  const chat = selectChat(global, payload.chatId);
  if (!chat) {
    return;
  }

  void unpinAllMessages(chat);
});

async function unpinAllMessages(chat: ApiChat) {
  await callApi('unpinAllMessages', { chat });
  let global = getGlobal();
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'pinnedIds', []);
  setGlobal(global);
}

addActionHandler('deleteMessages', (global, actions, payload) => {
  const { messageIds, shouldDeleteForAll } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }
  const { chatId, threadId } = currentMessageList;
  const chat = selectChat(global, chatId)!;

  void callApi('deleteMessages', { chat, messageIds, shouldDeleteForAll });

  const editingId = selectEditingId(global, chatId, threadId);
  if (messageIds.includes(editingId)) {
    actions.setEditingId({ messageId: undefined });
  }
});

addActionHandler('deleteScheduledMessages', (global, actions, payload) => {
  const { messageIds } = payload!;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId } = currentMessageList;
  const chat = selectChat(global, chatId)!;

  void callApi('deleteScheduledMessages', { chat, messageIds });

  const editingId = selectEditingScheduledId(global, chatId);
  if (messageIds.includes(editingId)) {
    actions.setEditingId({ messageId: undefined });
  }
});

addActionHandler('deleteHistory', (global, actions, payload) => {
  (async () => {
    const { chatId, shouldDeleteForAll } = payload!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return;
    }

    const maxId = chat.lastMessage?.id;

    await callApi('deleteHistory', { chat, shouldDeleteForAll, maxId });

    const activeChat = selectCurrentMessageList(global);
    if (activeChat && activeChat.chatId === chatId) {
      actions.openChat({ id: undefined });
    }
  })();
});

addActionHandler('reportMessages', (global, actions, payload) => {
  (async () => {
    const {
      messageIds, reason, description,
    } = payload!;
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return;
    }

    const { chatId } = currentMessageList;
    const chat = selectChat(global, chatId)!;

    const result = await callApi('reportMessages', {
      peer: chat, messageIds, reason, description,
    });

    actions.showNotification({
      message: result
        ? 'Thank you! Your report will be reviewed by our team.'
        : 'Error occured while submiting report. Please, try again later.',
    });
  })();
});

addActionHandler('sendMessageAction', (global, actions, payload) => {
  (async () => {
    const { action, chatId, threadId } = payload!;
    if (chatId === global.currentUserId) return; // Message actions are disabled in Saved Messages

    const chat = selectChat(global, chatId)!;
    if (!chat) return;

    await callApi('sendMessageAction', {
      peer: chat, threadId, action,
    });
  })();
});

addActionHandler('markMessageListRead', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId } = currentMessageList;
  const chat = selectThreadOriginChat(global, chatId, threadId);
  if (!chat) {
    return undefined;
  }

  const { maxId } = payload!;

  runDebouncedForMarkRead(() => {
    void callApi('markMessageListRead', {
      serverTimeOffset, chat, threadId, maxId,
    });
  });

  // TODO Support local marking read for threads
  if (threadId !== MAIN_THREAD_ID) {
    return undefined;
  }

  if (chatId === SERVICE_NOTIFICATIONS_USER_ID) {
    global = {
      ...global,
      serviceNotifications: global.serviceNotifications.map((notification) => {
        return notification.isUnread && notification.id <= maxId ? { ...notification, isUnread: false } : notification;
      }),
    };
  }

  const viewportIds = selectViewportIds(global, chatId, threadId);
  const minId = selectFirstUnreadId(global, chatId, threadId);
  if (!viewportIds || !minId || !chat.unreadCount) {
    return global;
  }

  const readCount = countSortedIds(viewportIds!, minId, maxId);
  if (!readCount) {
    return global;
  }

  return updateChat(global, chatId, {
    lastReadInboxMessageId: maxId,
    unreadCount: Math.max(0, chat.unreadCount - readCount),
  });
});

addActionHandler('markMessagesRead', (global, actions, payload) => {
  const chat = selectCurrentChat(global);
  if (!chat) {
    return;
  }

  const { messageIds } = payload!;

  void callApi('markMessagesRead', { chat, messageIds });
});

addActionHandler('loadWebPagePreview', (global, actions, payload) => {
  const { text } = payload!;
  void loadWebPagePreview(text);
});

addActionHandler('clearWebPagePreview', (global) => {
  if (!global.webPagePreview) {
    return undefined;
  }

  return {
    ...global,
    webPagePreview: undefined,
  };
});

addActionHandler('sendPollVote', (global, actions, payload) => {
  const { chatId, messageId, options } = payload!;
  const chat = selectChat(global, chatId);

  if (chat) {
    void callApi('sendPollVote', { chat, messageId, options });
  }
});

addActionHandler('loadPollOptionResults', (global, actions, payload) => {
  const {
    chat, messageId, option, offset, limit, shouldResetVoters,
  } = payload!;

  void loadPollOptionResults(chat, messageId, option, offset, limit, shouldResetVoters);
});

addActionHandler('forwardMessages', (global, action, payload) => {
  const { fromChatId, messageIds, toChatId } = global.forwardMessages;
  const fromChat = fromChatId ? selectChat(global, fromChatId) : undefined;
  const toChat = toChatId ? selectChat(global, toChatId) : undefined;
  const messages = fromChatId && messageIds
    ? messageIds
      .sort((a, b) => a - b)
      .map((id) => selectChatMessage(global, fromChatId, id)).filter<ApiMessage>(Boolean as any)
    : undefined;

  if (!fromChat || !toChat || !messages) {
    return;
  }

  const { isSilent, scheduledAt } = payload;
  const sendAs = selectSendAs(global, toChatId!);

  const realMessages = messages.filter((m) => !isServiceNotificationMessage(m));
  if (realMessages.length) {
    void callApi('forwardMessages', {
      fromChat,
      toChat,
      messages: realMessages,
      serverTimeOffset: getGlobal().serverTimeOffset,
      isSilent,
      scheduledAt,
      sendAs,
    });
  }

  messages
    .filter((m) => isServiceNotificationMessage(m))
    .forEach((message) => {
      const { text, entities } = message.content.text || {};
      const { sticker, poll } = message.content;

      void sendMessage({
        chat: toChat,
        text,
        entities,
        sticker,
        poll,
        isSilent,
        scheduledAt,
        sendAs,
      });
    });

  setGlobal({
    ...getGlobal(),
    forwardMessages: {},
  });
});

addActionHandler('loadScheduledHistory', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void loadScheduledHistory(chat);
});

addActionHandler('sendScheduledMessages', (global, actions, payload) => {
  const {
    chatId, id,
  } = payload!;

  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('sendScheduledMessages', {
    chat,
    ids: [id],
  });
});

addActionHandler('rescheduleMessage', (global, actions, payload) => {
  const {
    chatId, messageId, scheduledAt,
  } = payload!;

  const chat = selectChat(global, chatId);
  const message = chat && selectScheduledMessage(global, chat.id, messageId);
  if (!chat || !message) {
    return;
  }

  void callApi('rescheduleMessage', {
    chat,
    message,
    scheduledAt,
  });
});

addActionHandler('requestThreadInfoUpdate', (global, actions, payload) => {
  const { chatId, threadId } = payload;
  const chat = selectThreadOriginChat(global, chatId, threadId);
  if (!chat) {
    return;
  }

  void callApi('requestThreadInfoUpdate', { chat, threadId });
});

async function loadWebPagePreview(message: string) {
  const webPagePreview = await callApi('fetchWebPagePreview', { message });

  setGlobal({
    ...getGlobal(),
    webPagePreview,
  });
}

async function loadViewportMessages(
  chat: ApiChat,
  threadId: number,
  offsetId: number | undefined,
  direction: LoadMoreDirection,
  isOutlying = false,
  isBudgetPreload = false,
) {
  const chatId = chat.id;

  let addOffset: number | undefined;
  switch (direction) {
    case LoadMoreDirection.Backwards:
      addOffset = undefined;
      break;
    case LoadMoreDirection.Around:
      addOffset = -(Math.round(MESSAGE_LIST_SLICE / 2) + 1);
      break;
    case LoadMoreDirection.Forwards:
      addOffset = -(MESSAGE_LIST_SLICE + 1);
      break;
  }

  const result = await callApi('fetchMessages', {
    chat: selectThreadOriginChat(getGlobal(), chatId, threadId)!,
    offsetId,
    addOffset,
    limit: MESSAGE_LIST_SLICE,
    threadId,
  });

  if (!result) {
    return;
  }

  const {
    messages, users, chats, threadInfos,
  } = result;

  let global = getGlobal();

  const localMessages = chatId === SERVICE_NOTIFICATIONS_USER_ID
    ? global.serviceNotifications.map(({ message }) => message)
    : [];
  const allMessages = ([] as ApiMessage[]).concat(messages, localMessages);
  const byId = buildCollectionByKey(allMessages, 'id');
  const ids = Object.keys(byId).map(Number);

  global = addChatMessagesById(global, chatId, byId);
  global = isOutlying
    ? updateOutlyingIds(global, chatId, threadId, ids)
    : updateListedIds(global, chatId, threadId, ids);

  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = updateThreadInfos(global, chatId, threadInfos);

  let listedIds = selectListedIds(global, chatId, threadId);
  const outlyingIds = selectOutlyingIds(global, chatId, threadId);

  if (isOutlying && listedIds && outlyingIds) {
    if (!outlyingIds.length || areSortedArraysIntersecting(listedIds, outlyingIds)) {
      global = updateListedIds(global, chatId, threadId, outlyingIds);
      listedIds = selectListedIds(global, chatId, threadId);
      global = replaceThreadParam(global, chatId, threadId, 'outlyingIds', undefined);
      isOutlying = false;
    }
  }

  if (!isBudgetPreload) {
    const historyIds = isOutlying ? outlyingIds! : listedIds!;
    const { newViewportIds } = getViewportSlice(historyIds, offsetId, direction);
    global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds!);
  }

  setGlobal(global);
}

async function loadMessage(chat: ApiChat, messageId: number, replyOriginForId: number) {
  const result = await callApi('fetchMessage', { chat, messageId });
  if (!result) {
    return undefined;
  }

  if (result === MESSAGE_DELETED) {
    if (replyOriginForId) {
      let global = getGlobal();
      const replyMessage = selectChatMessage(global, chat.id, replyOriginForId);
      global = updateChatMessage(global, chat.id, replyOriginForId, {
        ...replyMessage,
        replyToMessageId: undefined,
      });
      setGlobal(global);
    }

    return undefined;
  }

  let global = getGlobal();
  global = updateChatMessage(global, chat.id, messageId, result.message);
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);

  return result.message;
}

function findClosestIndex(sourceIds: number[], offsetId: number) {
  if (offsetId < sourceIds[0]) {
    return 0;
  }

  if (offsetId > sourceIds[sourceIds.length - 1]) {
    return sourceIds.length - 1;
  }

  return sourceIds.findIndex((id, i) => (
    id === offsetId
    || (id < offsetId && sourceIds[i + 1] > offsetId)
  ));
}

function getViewportSlice(
  sourceIds: number[],
  offsetId: number | undefined,
  direction: LoadMoreDirection,
) {
  const { length } = sourceIds;
  const index = offsetId ? findClosestIndex(sourceIds, offsetId) : -1;
  const isBackwards = direction === LoadMoreDirection.Backwards;
  const indexForDirection = isBackwards ? index : (index + 1) || length;
  const from = indexForDirection - MESSAGE_LIST_SLICE;
  const to = indexForDirection + MESSAGE_LIST_SLICE - 1;
  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  let areSomeLocal;
  let areAllLocal;
  switch (direction) {
    case LoadMoreDirection.Backwards:
      areSomeLocal = indexForDirection > 0;
      areAllLocal = from >= 0;
      break;
    case LoadMoreDirection.Forwards:
      areSomeLocal = indexForDirection < length;
      areAllLocal = to <= length - 1;
      break;
    case LoadMoreDirection.Around:
    default:
      areSomeLocal = newViewportIds.length > 0;
      areAllLocal = newViewportIds.length === MESSAGE_LIST_SLICE;
      break;
  }

  return { newViewportIds, areSomeLocal, areAllLocal };
}

async function sendMessage(params: {
  chat: ApiChat;
  text?: string;
  entities?: ApiMessageEntity[];
  replyingTo?: number;
  attachment?: ApiAttachment;
  sticker?: ApiSticker;
  gif?: ApiVideo;
  poll?: ApiNewPoll;
  serverTimeOffset?: number;
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiChat | ApiUser;
}) {
  let localId: number | undefined;
  const progressCallback = params.attachment ? (progress: number, messageLocalId: number) => {
    if (!uploadProgressCallbacks.has(messageLocalId)) {
      localId = messageLocalId;
      uploadProgressCallbacks.set(messageLocalId, progressCallback!);
    }

    const global = getGlobal();

    setGlobal({
      ...global,
      fileUploads: {
        byMessageLocalId: {
          ...global.fileUploads.byMessageLocalId,
          [messageLocalId]: { progress },
        },
      },
    });
  } : undefined;

  // @optimization
  if (params.replyingTo || IS_IOS) {
    await rafPromise();
  }

  const global = getGlobal();
  params.serverTimeOffset = global.serverTimeOffset;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }
  const { threadId } = currentMessageList;

  if (!params.replyingTo && threadId !== MAIN_THREAD_ID) {
    params.replyingTo = selectThreadTopMessageId(global, params.chat.id, threadId)!;
  }

  await callApi('sendMessage', params, progressCallback);

  if (progressCallback && localId) {
    uploadProgressCallbacks.delete(localId);
  }
}

async function loadPollOptionResults(
  chat: ApiChat,
  messageId: number,
  option: string,
  offset?: string,
  limit?: number,
  shouldResetVoters?: boolean,
) {
  const result = await callApi('loadPollOptionResults', {
    chat, messageId, option, offset, limit,
  });

  if (!result) {
    return;
  }

  let global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  const { voters } = global.pollResults;

  setGlobal({
    ...global,
    pollResults: {
      ...global.pollResults,
      voters: {
        ...voters,
        [option]: unique([
          ...(!shouldResetVoters && voters && voters[option] ? voters[option] : []),
          ...(result && result.users.map((user) => user.id)),
        ]),
      },
      offsets: {
        ...(global.pollResults.offsets ? global.pollResults.offsets : {}),
        [option]: result.nextOffset || '',
      },
    },
  });
}

addActionHandler('loadPinnedMessages', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void loadPinnedMessages(chat);
});

addActionHandler('loadSeenBy', (global, actions, payload) => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  (async () => {
    const result = await callApi('fetchSeenBy', { chat, messageId });
    if (!result) {
      return;
    }

    setGlobal(updateChatMessage(getGlobal(), chatId, messageId, {
      seenByUserIds: result,
    }));
  })();
});

addActionHandler('saveDefaultSendAs', (global, actions, payload) => {
  const { chatId, sendAsId } = payload;
  const chat = selectChat(global, chatId);
  const sendAsChat = selectChat(global, sendAsId) || selectUser(global, sendAsId);
  if (!chat || !sendAsChat) {
    return undefined;
  }

  void callApi('saveDefaultSendAs', { sendAs: sendAsChat, chat });

  return updateChat(global, chatId, {
    fullInfo: {
      ...chat.fullInfo,
      sendAsId,
    },
  });
});

addActionHandler('loadSendAs', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  (async () => {
    const result = await callApi('fetchSendAs', { chat });
    if (!result) {
      global = updateChat(global, chatId, {
        sendAsIds: [],
      });
      setGlobal(global);
      return;
    }

    global = getGlobal();
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    global = addChats(global, buildCollectionByKey(result.chats, 'id'));
    global = updateChat(global, chatId, {
      sendAsIds: result.ids,
    });
    setGlobal(global);
  })();
});

async function loadPinnedMessages(chat: ApiChat) {
  const result = await callApi('fetchPinnedMessages', { chat });
  if (!result) {
    return;
  }

  const { messages, chats, users } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  let global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'pinnedIds', ids);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));
  setGlobal(global);
}

async function loadScheduledHistory(chat: ApiChat) {
  const result = await callApi('fetchScheduledHistory', { chat });
  if (!result) {
    return;
  }

  const { messages } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  let global = getGlobal();
  global = replaceScheduledMessages(global, chat.id, byId);
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'scheduledIds', ids);
  setGlobal(global);
}

addActionHandler('loadSponsoredMessages', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  (async () => {
    const result = await callApi('fetchSponsoredMessages', { chat });
    if (!result) {
      return;
    }

    let newGlobal = updateSponsoredMessage(getGlobal(), chatId, result.messages[0]);
    newGlobal = addUsers(newGlobal, buildCollectionByKey(result.users, 'id'));
    newGlobal = addChats(newGlobal, buildCollectionByKey(result.chats, 'id'));

    setGlobal(newGlobal);
  })();
});

addActionHandler('viewSponsoredMessage', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  const message = selectSponsoredMessage(global, chatId);
  if (!chat || !message) {
    return;
  }

  void callApi('viewSponsoredMessage', { chat, random: message.randomId });
});

function countSortedIds(ids: number[], from: number, to: number) {
  let count = 0;

  for (let i = 0, l = ids.length; i < l; i++) {
    if (ids[i] >= from && ids[i] <= to) {
      count++;
    }

    if (ids[i] >= to) {
      break;
    }
  }

  return count;
}
