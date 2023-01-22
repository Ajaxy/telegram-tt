import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { GlobalActions } from '../../types';
import type {
  ApiAttachment,
  ApiChat,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiOnProgress,
  ApiSticker,
  ApiUser,
  ApiVideo,
} from '../../../api/types';
import {
  MAIN_THREAD_ID,
  MESSAGE_DELETED,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import {
  MAX_MEDIA_FILES_FOR_ALBUM,
  MESSAGE_LIST_SLICE,
  RE_TELEGRAM_LINK,
  RE_TG_LINK,
  RE_TME_LINK,
  SERVICE_NOTIFICATIONS_USER_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
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
  updateTopic,
  updateThreadInfo,
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
  selectIsCurrentUserPremium,
  selectForwardsContainVoiceMessages,
  selectThreadIdFromMessage,
} from '../../selectors';
import {
  debounce, onTickEnd, rafPromise,
} from '../../../util/schedulers';
import {
  getMessageOriginalId, getUserFullName, isDeletedUser, isServiceNotificationMessage, isUserBot,
} from '../../helpers';
import { getTranslation } from '../../../util/langProvider';
import { ensureProtocol } from '../../../util/ensureProtocol';

const AUTOLOGIN_TOKEN_KEY = 'autologin_token';

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
      onTickEnd(() => {
        void loadViewportMessages(chat, threadId, offsetId, LoadMoreDirection.Around, isOutlying, isBudgetPreload);
      });
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

    onTickEnd(() => {
      void loadWithBudget(actions, areAllLocal, isOutlying, isBudgetPreload, chat, threadId, direction, offsetId);
    });

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
    actions.loadViewportMessages({
      chatId: chat.id, threadId, direction, isBudgetPreload: true,
    });
  }
}

addActionHandler('loadMessage', async (global, actions, payload) => {
  const {
    chatId, messageId, replyOriginForId, threadUpdate,
  } = payload!;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

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
  const replyingToTopId = chat.isForum ? selectThreadTopMessageId(global, chatId, threadId) : undefined;

  const params = {
    ...payload,
    chat,
    replyingTo: selectReplyingToId(global, chatId, threadId),
    replyingToTopId,
    noWebPage: selectNoWebPage(global, chatId, threadId),
    sendAs: selectSendAs(global, chatId),
  };

  actions.setReplyingToId({ messageId: undefined });
  actions.clearWebPagePreview({ chatId, threadId, value: false });

  const isSingle = !payload.attachments || payload.attachments.length <= 1;
  const isGrouped = !isSingle && payload.shouldGroupMessages;

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
    const byType = splitAttachmentsByType(attachments);

    byType.forEach((group, groupIndex) => {
      const groupedAttachments = split(group as ApiAttachment[], MAX_MEDIA_FILES_FOR_ALBUM);
      for (let i = 0; i < groupedAttachments.length; i++) {
        const [firstAttachment, ...restAttachments] = groupedAttachments[i];
        const groupedId = `${Date.now()}${groupIndex}${i}`;

        const isFirst = i === 0 && groupIndex === 0;

        sendMessage({
          ...commonParams,
          text: isFirst ? text : undefined,
          entities: isFirst ? entities : undefined,
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
    });
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
  const progressCallback = message && uploadProgressCallbacks.get(getMessageOriginalId(message));
  if (progressCallback) {
    cancelApiProgress(progressCallback);
  }

  actions.apiUpdate({
    '@type': 'deleteMessages',
    ids: [messageId],
    chatId,
  });
});

addActionHandler('saveDraft', async (global, actions, payload) => {
  const { chatId, threadId, draft } = payload!;
  if (!draft) {
    return;
  }

  const { text, entities } = draft;
  const chat = selectChat(global, chatId)!;
  const user = selectUser(global, chatId)!;
  if (user && isDeletedUser(user)) return;

  const result = await callApi('saveDraft', {
    chat,
    text,
    entities,
    replyToMsgId: selectReplyingToId(global, chatId, threadId),
    threadId: selectThreadTopMessageId(global, chatId, threadId),
  });

  if (!result) {
    draft.isLocal = true;
  }

  global = getGlobal();
  global = replaceThreadParam(global, chatId, threadId, 'draft', draft);
  global = updateChat(global, chatId, { draftDate: Math.round(Date.now() / 1000) });

  setGlobal(global);
});

addActionHandler('clearDraft', (global, actions, payload) => {
  const { chatId, threadId, localOnly } = payload!;
  if (!selectDraft(global, chatId, threadId)) {
    return undefined;
  }

  const chat = selectChat(global, chatId)!;

  if (!localOnly) {
    void callApi('clearDraft', chat, selectThreadTopMessageId(global, chatId, threadId));
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
  const { chatId, threadId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void unpinAllMessages(chat, selectThreadTopMessageId(global, chatId, threadId));
});

async function unpinAllMessages(chat: ApiChat, threadId?: number) {
  await callApi('unpinAllMessages', { chat, threadId });

  let global = getGlobal();
  global = replaceThreadParam(global, chat.id, threadId || MAIN_THREAD_ID, 'pinnedIds', []);
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

addActionHandler('deleteHistory', async (global, actions, payload) => {
  const { chatId, shouldDeleteForAll } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  await callApi('deleteHistory', { chat, shouldDeleteForAll });

  const activeChat = selectCurrentMessageList(global);
  if (activeChat && activeChat.chatId === chatId) {
    actions.openChat({ id: undefined });
  }
});

addActionHandler('reportMessages', async (global, actions, payload) => {
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
      ? getTranslation('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
  });
});

addActionHandler('sendMessageAction', async (global, actions, payload) => {
  const { action, chatId, threadId } = payload!;
  if (chatId === global.currentUserId) return; // Message actions are disabled in Saved Messages

  const chat = selectChat(global, chatId)!;
  if (!chat) return;
  const user = selectUser(global, chatId);
  if (user && (isUserBot(user) || isDeletedUser(user))) return;

  await callApi('sendMessageAction', {
    peer: chat, threadId, action,
  });
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

  if (chat.isForum && chat.topics?.[threadId]) {
    const topic = chat.topics[threadId];
    global = updateThreadInfo(global, chatId, threadId, {
      lastReadInboxMessageId: maxId,
    });
    const newTopicUnreadCount = Math.max(0, topic.unreadCount - readCount);
    if (newTopicUnreadCount === 0) {
      global = updateChat(global, chatId, {
        unreadCount: Math.max(0, chat.unreadCount - 1),
      });
    }
    return updateTopic(global, chatId, threadId, {
      unreadCount: newTopicUnreadCount,
    });
  }

  // TODO Support local marking read for comments
  if (threadId !== MAIN_THREAD_ID) {
    return undefined;
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

addActionHandler('cancelPollVote', (global, actions, payload) => {
  const { chatId, messageId } = payload!;
  const chat = selectChat(global, chatId);

  if (chat) {
    void callApi('sendPollVote', { chat, messageId, options: [] });
  }
});

addActionHandler('closePoll', (global, actions, payload) => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  const poll = selectChatMessage(global, chatId, messageId)?.content.poll;
  if (chat && poll) {
    void callApi('closePoll', { chat, messageId, poll });
  }
});

addActionHandler('loadPollOptionResults', (global, actions, payload) => {
  const {
    chat, messageId, option, offset, limit, shouldResetVoters,
  } = payload!;

  void loadPollOptionResults(chat, messageId, option, offset, limit, shouldResetVoters);
});

addActionHandler('loadExtendedMedia', (global, actions, payload) => {
  const { chatId, ids } = payload;
  const chat = selectChat(global, chatId);
  if (chat) {
    void callApi('fetchExtendedMedia', { chat, ids });
  }
});

addActionHandler('forwardMessages', (global, action, payload) => {
  const {
    fromChatId, messageIds, toChatId, withMyScore, noAuthors, noCaptions, toThreadId,
  } = global.forwardMessages;
  const isCurrentUserPremium = selectIsCurrentUserPremium(global);
  const fromChat = fromChatId ? selectChat(global, fromChatId) : undefined;
  const toChat = toChatId ? selectChat(global, toChatId) : undefined;
  const messages = fromChatId && messageIds
    ? messageIds
      .sort((a, b) => a - b)
      .map((id) => selectChatMessage(global, fromChatId, id)).filter(Boolean)
    : undefined;

  if (!fromChat || !toChat || !messages || (toThreadId && !toChat.isForum)) {
    return;
  }

  const { isSilent, scheduledAt } = payload;
  const sendAs = selectSendAs(global, toChatId!);

  const realMessages = messages.filter((m) => !isServiceNotificationMessage(m));
  if (realMessages.length) {
    void callApi('forwardMessages', {
      fromChat,
      toChat,
      toThreadId,
      messages: realMessages,
      serverTimeOffset: getGlobal().serverTimeOffset,
      isSilent,
      scheduledAt,
      sendAs,
      withMyScore,
      noAuthors,
      noCaptions,
      isCurrentUserPremium,
    });
  }

  messages
    .filter((m) => isServiceNotificationMessage(m))
    .forEach((message) => {
      const { text, entities } = message.content.text || {};
      const { sticker, poll } = message.content;

      void sendMessage({
        chat: toChat,
        replyingToTopId: toThreadId,
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

addActionHandler('requestThreadInfoUpdate', async (global, actions, payload) => {
  const { chatId, threadId } = payload;
  const chat = selectThreadOriginChat(global, chatId, threadId);
  if (!chat) {
    return;
  }

  const result = await callApi('requestThreadInfoUpdate', { chat, threadId });
  if (!result) return;
  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);
});

addActionHandler('transcribeAudio', async (global, actions, payload) => {
  const { messageId, chatId } = payload;

  const chat = selectChat(global, chatId);

  if (!chat) return;

  global = updateChatMessage(global, chatId, messageId, {
    transcriptionId: '',
  });

  setGlobal(global);

  const result = await callApi('transcribeAudio', { chat, messageId });

  global = updateChatMessage(getGlobal(), chatId, messageId, {
    transcriptionId: result,
    isTranscriptionError: !result,
  });

  setGlobal(global);
});

addActionHandler('loadCustomEmojis', async (global, actions, payload) => {
  const { ids, ignoreCache } = payload;
  const newCustomEmojiIds = ignoreCache ? ids
    : unique(ids.filter((documentId) => !global.customEmojis.byId[documentId]));
  const customEmoji = await callApi('fetchCustomEmoji', {
    documentId: newCustomEmojiIds,
  });
  if (!customEmoji) return;

  global = getGlobal();
  setGlobal({
    ...global,
    customEmojis: {
      ...global.customEmojis,
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(customEmoji, 'id'),
      },
    },
  });
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
    messages, users, chats, repliesThreadInfos,
  } = result;

  let global = getGlobal();

  const localMessages = chatId === SERVICE_NOTIFICATIONS_USER_ID
    ? global.serviceNotifications.filter(({ isDeleted }) => !isDeleted).map(({ message }) => message)
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
  global = updateThreadInfos(global, chatId, repliesThreadInfos);

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
  replyingToTopId?: number;
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

  if (params.replyingTo && !params.replyingToTopId && threadId !== MAIN_THREAD_ID) {
    params.replyingToTopId = selectThreadTopMessageId(global, params.chat.id, threadId)!;
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
  const { chatId, threadId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void loadPinnedMessages(chat, threadId);
});

addActionHandler('loadSeenBy', async (global, actions, payload) => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchSeenBy', { chat, messageId });
  if (!result) {
    return;
  }

  setGlobal(updateChatMessage(getGlobal(), chatId, messageId, {
    seenByUserIds: result,
  }));
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

addActionHandler('loadSendAs', async (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchSendAs', { chat });
  if (!result) {
    setGlobal(updateChat(getGlobal(), chatId, {
      sendAsPeerIds: [],
    }));

    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = updateChat(global, chatId, { sendAsPeerIds: result.sendAs });
  setGlobal(global);
});

async function loadPinnedMessages(chat: ApiChat, threadId = MAIN_THREAD_ID) {
  const result = await callApi('fetchPinnedMessages', { chat, threadId });
  if (!result) {
    return;
  }

  const { messages, chats, users } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  let global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = replaceThreadParam(global, chat.id, threadId, 'pinnedIds', ids);
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
  if (chat?.isForum) {
    const scheduledPerThread: Record<number, number[]> = {};
    messages.forEach((message) => {
      const threadId = selectThreadIdFromMessage(global, message);
      const scheduledInThread = scheduledPerThread[threadId] || [];
      scheduledInThread.push(message.id);
      scheduledPerThread[threadId] = scheduledInThread;
    });

    Object.entries(scheduledPerThread).forEach(([threadId, scheduledIds]) => {
      global = replaceThreadParam(global, chat.id, Number(threadId), 'scheduledIds', scheduledIds);
    });
  }
  setGlobal(global);
}

addActionHandler('loadSponsoredMessages', async (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchSponsoredMessages', { chat });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateSponsoredMessage(global, chatId, result.messages[0]);
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  setGlobal(global);
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

addActionHandler('fetchUnreadMentions', async (global, actions, payload) => {
  const { chatId, offsetId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('fetchUnreadMentions', { chat, offsetId });

  if (!result) return;

  const { messages, chats, users } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number);

  global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = updateChat(global, chatId, {
    unreadMentions: [...(chat.unreadMentions || []), ...ids],
  });

  setGlobal(global);
});

addActionHandler('markMentionsRead', (global, actions, payload) => {
  const { messageIds } = payload;

  const chat = selectCurrentChat(global);
  if (!chat) return;

  const unreadMentions = (chat.unreadMentions || []).filter((id) => !messageIds.includes(id));
  global = updateChat(global, chat.id, {
    unreadMentions,
  });

  setGlobal(global);

  actions.markMessagesRead({ messageIds });
});

addActionHandler('focusNextMention', (global, actions) => {
  const chat = selectCurrentChat(global);

  if (!chat?.unreadMentions) return;

  actions.focusMessage({ chatId: chat.id, messageId: chat.unreadMentions[0] });
});

addActionHandler('readAllMentions', (global) => {
  const chat = selectCurrentChat(global);
  if (!chat) return undefined;

  callApi('readAllMentions', { chat });

  return updateChat(global, chat.id, {
    unreadMentionsCount: undefined,
    unreadMentions: undefined,
  });
});

addActionHandler('openUrl', (global, actions, payload) => {
  const { url, shouldSkipModal } = payload;
  const urlWithProtocol = ensureProtocol(url)!;

  if (urlWithProtocol.match(RE_TME_LINK) || urlWithProtocol.match(RE_TG_LINK)) {
    actions.openTelegramLink({ url });
    return;
  }

  const { appConfig } = global;
  if (appConfig) {
    const parsedUrl = new URL(urlWithProtocol);

    if (appConfig.autologinDomains.includes(parsedUrl.hostname)) {
      parsedUrl.searchParams.set(AUTOLOGIN_TOKEN_KEY, appConfig.autologinToken);
      window.open(parsedUrl.href, '_blank', 'noopener');
      return;
    }

    if (appConfig.urlAuthDomains.includes(parsedUrl.hostname)) {
      actions.requestLinkUrlAuth({ url });
      return;
    }
  }

  const shouldDisplayModal = !urlWithProtocol.match(RE_TELEGRAM_LINK) && !shouldSkipModal;

  if (shouldDisplayModal) {
    actions.toggleSafeLinkModal({ url: urlWithProtocol });
  } else {
    window.open(urlWithProtocol, '_blank', 'noopener');
  }
});

addActionHandler('setForwardChatOrTopic', async (global, actions, payload) => {
  const { chatId, topicId } = payload;
  let user = selectUser(global, chatId);
  if (user && selectForwardsContainVoiceMessages(global)) {
    if (!user.fullInfo) {
      const { accessHash } = user;
      user = await callApi('fetchFullUser', { id: chatId, accessHash });
      global = getGlobal();
    }

    if (user?.fullInfo!.noVoiceMessages) {
      actions.showDialog({
        data: {
          message: getTranslation('VoiceMessagesRestrictedByPrivacy', getUserFullName(user)),
        },
      });
      return;
    }
  }

  setGlobal({
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      toChatId: chatId,
      toThreadId: topicId,
      isModalShown: false,
    },
  });

  actions.openChat({ id: chatId, threadId: topicId });
  actions.closeMediaViewer();
  actions.exitMessageSelectMode();
});

addActionHandler('forwardToSavedMessages', (global, actions) => {
  setGlobal({
    ...global,
    forwardMessages: {
      ...global.forwardMessages,
      toChatId: global.currentUserId,
    },
  });

  actions.exitMessageSelectMode();
  actions.forwardMessages({ isSilent: true });
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

function splitAttachmentsByType(attachments: ApiAttachment[]) {
  return attachments.reduce((acc, attachment, index, arr) => {
    if (index === 0) {
      acc.push([attachment]);
      return acc;
    }

    const type = getAttachmentType(attachment);
    const previousType = getAttachmentType(arr[index - 1]);
    if (type === previousType) {
      acc[acc.length - 1].push(attachment);
    } else {
      acc.push([attachment]);
    }

    return acc;
  }, [] as ApiAttachment[][]);
}

function getAttachmentType(attachment: ApiAttachment) {
  const {
    shouldSendAsFile, mimeType,
  } = attachment;
  if (shouldSendAsFile) return 'file';
  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType) || SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) return 'media';
  if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) return 'audio';
  if (attachment.voice) return 'voice';
  return 'file';
}
