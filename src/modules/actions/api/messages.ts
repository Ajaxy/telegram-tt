import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import {
  ApiAttachment,
  ApiChat,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiOnProgress,
  ApiSticker,
  ApiVideo,
  MAIN_THREAD_ID,
  MESSAGE_DELETED,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { MAX_MEDIA_FILES_FOR_ALBUM, MESSAGE_LIST_SLICE } from '../../../config';
import { callApi, cancelApiProgress } from '../../../api/gramjs';
import { areSortedArraysIntersecting, buildCollectionByKey, split } from '../../../util/iteratees';
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
} from '../../selectors';
import { rafPromise, throttle } from '../../../util/schedulers';
import { copyTextToClipboard } from '../../../util/clipboard';

const uploadProgressCallbacks = new Map<number, ApiOnProgress>();

const runThrottledForMarkRead = throttle((cb) => cb(), 1000, true);

addReducer('loadViewportMessages', (global, actions, payload) => {
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

addReducer('loadMessage', (global, actions, payload) => {
  const { chatId, messageId, replyOriginForId } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void loadMessage(chat, messageId, replyOriginForId);
});

addReducer('sendMessage', (global, actions, payload) => {
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

  actions.setReplyingToId({ messageId: undefined });
  actions.clearWebPagePreview({ chatId, threadId, value: false });

  const params = {
    ...payload,
    chat,
    replyingTo: selectReplyingToId(global, chatId, threadId),
    noWebPage: selectNoWebPage(global, chatId, threadId),
  };

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

addReducer('editMessage', (global, actions, payload) => {
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
    chat, message, text, entities, noWebPage: selectNoWebPage(global, chatId, threadId),
  });

  actions.setEditingId({ messageId: undefined });
});

addReducer('cancelSendingMessage', (global, actions, payload) => {
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

addReducer('saveDraft', (global, actions, payload) => {
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

  return replaceThreadParam(global, chatId, threadId, 'draft', draft);
});

addReducer('clearDraft', (global, actions, payload) => {
  const { chatId, threadId, localOnly } = payload!;
  if (!selectDraft(global, chatId, threadId)) {
    return undefined;
  }

  const chat = selectChat(global, chatId)!;

  if (!localOnly && threadId === MAIN_THREAD_ID) {
    void callApi('clearDraft', chat);
  }

  return replaceThreadParam(global, chatId, threadId, 'draft', undefined);
});

addReducer('toggleMessageWebPage', (global, actions, payload) => {
  const { chatId, threadId, noWebPage } = payload!;

  return replaceThreadParam(global, chatId, threadId, 'noWebPage', noWebPage);
});

addReducer('pinMessage', (global, actions, payload) => {
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

addReducer('unpinAllMessages', (global, actions, payload) => {
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

addReducer('deleteMessages', (global, actions, payload) => {
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

addReducer('deleteScheduledMessages', (global, actions, payload) => {
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

addReducer('deleteHistory', (global, actions, payload) => {
  (async () => {
    const { chatId, shouldDeleteForAll } = payload!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return;
    }

    const maxId = chat.lastMessage && chat.lastMessage.id;

    await callApi('deleteHistory', { chat, shouldDeleteForAll, maxId });

    actions.openChat({ id: undefined });
  })();
});

addReducer('markMessageListRead', (global, actions, payload) => {
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId } = currentMessageList;
  const chat = selectThreadOriginChat(global, chatId, threadId);
  if (!chat) {
    return;
  }

  const { maxId } = payload!;

  runThrottledForMarkRead(() => {
    void callApi('markMessageListRead', { chat, threadId, maxId });
  });
});

addReducer('markMessagesRead', (global, actions, payload) => {
  const chat = selectCurrentChat(global);
  if (!chat) {
    return;
  }

  const { messageIds } = payload!;

  void callApi('markMessagesRead', { chat, messageIds });
});

addReducer('loadWebPagePreview', (global, actions, payload) => {
  const { text } = payload!;
  void loadWebPagePreview(text);
});

addReducer('clearWebPagePreview', (global) => {
  if (!global.webPagePreview) {
    return undefined;
  }

  return {
    ...global,
    webPagePreview: undefined,
  };
});

addReducer('sendPollVote', (global, actions, payload) => {
  const { chatId, messageId, options } = payload!;
  const chat = selectChat(global, chatId);

  if (chat) {
    void callApi('sendPollVote', { chat, messageId, options });
  }
});

addReducer('loadPollOptionResults', (global, actions, payload) => {
  const {
    chat, messageId, option, offset, limit, shouldResetVoters,
  } = payload!;

  void loadPollOptionResults(chat, messageId, option, offset, limit, shouldResetVoters);
});

addReducer('forwardMessages', (global) => {
  const { fromChatId, messageIds, toChatId } = global.forwardMessages;
  const fromChat = fromChatId ? selectChat(global, fromChatId) : undefined;
  const toChat = toChatId ? selectChat(global, toChatId) : undefined;
  const messages = fromChatId && messageIds
    ? messageIds
      .sort((a, b) => a - b)
      .map((id) => selectChatMessage(global, fromChatId, id)).filter<ApiMessage>(Boolean as any)
    : undefined;

  if (fromChat && toChat && messages && messages.length) {
    void forwardMessages(fromChat, toChat, messages);
  }
});

addReducer('loadScheduledHistory', (global) => {
  const chat = selectCurrentChat(global);
  if (!chat) {
    return;
  }

  const { hash } = global.scheduledMessages.byChatId[chat.id] || {};

  void loadScheduledHistory(chat, hash);
});

addReducer('sendScheduledMessages', (global, actions, payload) => {
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

addReducer('rescheduleMessage', (global, actions, payload) => {
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

addReducer('requestThreadInfoUpdate', (global, actions, payload) => {
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

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number);

  let global = getGlobal();

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
    if (areSortedArraysIntersecting(listedIds, outlyingIds)) {
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
    return;
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

    return;
  }

  let global = getGlobal();
  global = updateChatMessage(global, chat.id, messageId, result.message);
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);
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
  text: string;
  entities: ApiMessageEntity[];
  replyingTo: number;
  attachment: ApiAttachment;
  sticker: ApiSticker;
  gif: ApiVideo;
  poll: ApiNewPoll;
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
  if (params.replyingTo) {
    await rafPromise();
  }

  const global = getGlobal();
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

function forwardMessages(
  fromChat: ApiChat,
  toChat: ApiChat,
  messages: ApiMessage[],
) {
  callApi('forwardMessages', {
    fromChat,
    toChat,
    messages,
  });

  setGlobal({
    ...getGlobal(),
    forwardMessages: {},
  });
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

  const isUnique = (v: number, i: number, a: number[]) => a.indexOf(v) === i;
  let global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  const { voters } = global.pollResults;

  setGlobal({
    ...global,
    pollResults: {
      ...global.pollResults,
      voters: {
        ...voters,
        [option]: [
          ...(!shouldResetVoters && voters && voters[option] ? voters[option] : []),
          ...(result && result.users.map((user) => user.id)),
        ].filter(isUnique),
      },
      offsets: {
        ...(global.pollResults.offsets ? global.pollResults.offsets : {}),
        [option]: result.nextOffset || '',
      },
    },
  });
}

addReducer('loadPinnedMessages', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void loadPinnedMessages(chat);
});

addReducer('loadMessageLink', (global, actions, payload) => {
  const { messageId, chatId } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);

  if (!chat || !message) {
    return;
  }

  (async () => {
    const result = await callApi('fetchMessageLink', { chat, message });

    if (result) {
      copyTextToClipboard(result.link);
    }
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

async function loadScheduledHistory(chat: ApiChat, historyHash?: number) {
  const result = await callApi('fetchScheduledHistory', { chat, hash: historyHash });
  if (!result) {
    return;
  }

  const { hash, messages } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  let global = getGlobal();
  global = replaceScheduledMessages(global, chat.id, byId, hash);
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'scheduledIds', ids);
  setGlobal(global);
}
