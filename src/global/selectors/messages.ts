import type {
  GlobalState, MessageListType, TabArgs, Thread, TabThread,
} from '../types';
import type {
  ApiChat,
  ApiMessage,
  ApiMessageEntityCustomEmoji,
  ApiMessageOutgoingStatus,
  ApiStickerSetInfo,
  ApiUser,
} from '../../api/types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import {
  GENERAL_TOPIC_ID, LOCAL_MESSAGE_MIN_ID, REPLIES_USER_ID, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import {
  selectChat, selectChatBot, selectIsChatWithSelf,
} from './chats';
import {
  selectIsCurrentUserPremium, selectIsUserOrChatContact, selectUser, selectUserStatus,
} from './users';
import {
  getCanPostInChat,
  getHasAdminRight,
  getMessageAudio,
  getMessageDocument,
  getMessageOriginalId,
  getMessagePhoto,
  getMessageVideo,
  getMessageVoice,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getSendingState,
  isActionMessage,
  isChatBasicGroup,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isCommonBoxChat,
  isForwardedMessage,
  isMessageLocal,
  isOwnMessage,
  isServiceNotificationMessage,
  isUserId,
  isUserRightBanned,
  canSendReaction,
} from '../helpers';
import { findLast } from '../../util/iteratees';
import { selectIsStickerFavorite } from './symbols';
import { getServerTime } from '../../util/serverTime';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

const MESSAGE_EDIT_ALLOWED_TIME = 172800; // 48 hours

export function selectCurrentMessageList<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageLists } = selectTabState(global, tabId);

  if (messageLists.length) {
    return messageLists[messageLists.length - 1];
  }

  return undefined;
}

export function selectCurrentChat<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId } = selectCurrentMessageList(global, tabId) || {};

  return chatId ? selectChat(global, chatId) : undefined;
}

export function selectChatMessages<T extends GlobalState>(global: T, chatId: string) {
  return global.messages.byChatId[chatId]?.byId;
}

export function selectChatScheduledMessages<T extends GlobalState>(global: T, chatId: string) {
  return global.scheduledMessages.byChatId[chatId]?.byId;
}

export function selectTabThreadParam<T extends GlobalState, K extends keyof TabThread>(
  global: T,
  chatId: string,
  threadId: number,
  key: K,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).tabThreads[chatId]?.[threadId]?.[key];
}

export function selectThreadParam<K extends keyof Thread>(
  global: GlobalState,
  chatId: string,
  threadId: number,
  key: K,
) {
  const messageInfo = global.messages.byChatId[chatId];
  if (!messageInfo) {
    return undefined;
  }

  const thread = messageInfo.threadsById[threadId];
  if (!thread) {
    return undefined;
  }

  return thread[key];
}

export function selectListedIds<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'listedIds');
}

export function selectOutlyingIds<T extends GlobalState>(
  global: T, chatId: string, threadId: number, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'outlyingIds', tabId);
}

export function selectCurrentMessageIds<T extends GlobalState>(
  global: T,
  chatId: string, threadId: number, messageListType: MessageListType,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  switch (messageListType) {
    case 'thread':
      return selectViewportIds(global, chatId, threadId, tabId);
    case 'pinned':
      return selectPinnedIds(global, chatId, threadId);
    case 'scheduled':
      return selectScheduledIds(global, chatId, threadId);
  }

  return undefined;
}

export function selectViewportIds<T extends GlobalState>(
  global: T, chatId: string, threadId: number, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'viewportIds', tabId);
}

export function selectPinnedIds<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'pinnedIds');
}

export function selectScheduledIds<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'scheduledIds');
}

export function selectScrollOffset<T extends GlobalState>(
  global: T, chatId: string, threadId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'scrollOffset', tabId);
}

export function selectLastScrollOffset<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'lastScrollOffset');
}

export function selectReplyingToId<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'replyingToId');
}

export function selectEditingId<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'editingId');
}

export function selectEditingDraft<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'editingDraft');
}

export function selectEditingScheduledId<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledId');
}

export function selectEditingScheduledDraft<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledDraft');
}

export function selectDraft<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'draft');
}

export function selectNoWebPage<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'noWebPage');
}

export function selectThreadInfo<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'threadInfo');
}

export function selectFirstMessageId<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'firstMessageId');
}

export function selectReplyStack<T extends GlobalState>(
  global: T, chatId: string, threadId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'replyStack', tabId);
}

export function selectThreadMessagesCount(global: GlobalState, chatId: string, threadId: number) {
  const chat = selectChat(global, chatId);
  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!chat || !threadInfo || threadInfo.messagesCount === undefined) return undefined;
  // In forum topics first message is ignored, but not in General
  if (chat.isForum && threadId !== GENERAL_TOPIC_ID) return threadInfo.messagesCount - 1;
  return threadInfo.messagesCount;
}

export function selectThreadOriginChat<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return selectChat(global, chatId);
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);

  return selectChat(global, threadInfo?.originChannelId || chatId);
}

export function selectThreadTopMessageId<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  const chat = selectChat(global, chatId);
  if (chat?.isForum) {
    return threadId;
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) {
    return undefined;
  }

  return threadInfo.topMessageId;
}

export function selectThreadByMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const threadId = selectThreadIdFromMessage(global, message);
  if (!threadId || threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  return global.messages.byChatId[message.chatId].threadsById[threadId];
}

export function selectIsMessageInCurrentMessageList<T extends GlobalState>(
  global: T, chatId: string, message: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return false;
  }

  const { threadInfo } = selectThreadByMessage(global, message) || {};
  return (
    chatId === currentMessageList.chatId
    && (
      (currentMessageList.threadId === MAIN_THREAD_ID)
      || (threadInfo && currentMessageList.threadId === threadInfo.threadId)
    )
  );
}

export function selectIsViewportNewest<T extends GlobalState>(
  global: T, chatId: string, threadId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (!viewportIds || !viewportIds.length) {
    return true;
  }

  let lastMessageId: number;

  if (threadId === MAIN_THREAD_ID) {
    const chat = selectChat(global, chatId);
    if (!chat || !chat.lastMessage) {
      return true;
    }

    lastMessageId = chat.lastMessage.id;
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo || !threadInfo.lastMessageId) {
      return undefined;
    }

    lastMessageId = threadInfo.lastMessageId;
  }

  // Edge case: outgoing `lastMessage` is updated with a delay to optimize animation
  if (lastMessageId > LOCAL_MESSAGE_MIN_ID && !selectChatMessage(global, chatId, lastMessageId)) {
    return true;
  }

  return viewportIds[viewportIds.length - 1] >= lastMessageId;
}

export function selectChatMessage<T extends GlobalState>(global: T, chatId: string, messageId: number) {
  const chatMessages = selectChatMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectScheduledMessage<T extends GlobalState>(global: T, chatId: string, messageId: number) {
  const chatMessages = selectChatScheduledMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectEditingMessage<T extends GlobalState>(
  global: T, chatId: string, threadId: number, messageListType: MessageListType,
) {
  if (messageListType === 'scheduled') {
    const messageId = selectEditingScheduledId(global, chatId);
    return messageId ? selectScheduledMessage(global, chatId, messageId) : undefined;
  } else {
    const messageId = selectEditingId(global, chatId, threadId);
    return messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  }
}

export function selectChatMessageByPollId<T extends GlobalState>(global: T, pollId: string) {
  let messageWithPoll: ApiMessage | undefined;

  // eslint-disable-next-line no-restricted-syntax
  for (const chatMessages of Object.values(global.messages.byChatId)) {
    const { byId } = chatMessages;
    messageWithPoll = Object.values(byId).find((message) => {
      return message.content.poll && message.content.poll.id === pollId;
    });
    if (messageWithPoll) {
      break;
    }
  }

  return messageWithPoll;
}

export function selectFocusedMessageId<T extends GlobalState>(
  global: T, chatId: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId: focusedChatId, messageId } = selectTabState(global, tabId).focusedMessage || {};

  return focusedChatId === chatId ? messageId : undefined;
}

export function selectIsMessageFocused<T extends GlobalState>(
  global: T, message: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const focusedId = selectFocusedMessageId(global, message.chatId, tabId);

  return focusedId ? focusedId === message.id || focusedId === message.previousLocalId : false;
}

export function selectIsMessageUnread<T extends GlobalState>(global: T, message: ApiMessage) {
  const { lastReadOutboxMessageId } = selectChat(global, message.chatId) || {};
  return isMessageLocal(message) || !lastReadOutboxMessageId || lastReadOutboxMessageId < message.id;
}

export function selectOutgoingStatus<T extends GlobalState>(
  global: T, message: ApiMessage, isScheduledList = false,
): ApiMessageOutgoingStatus {
  if (!selectIsMessageUnread(global, message) && !isScheduledList) {
    return 'read';
  }

  return getSendingState(message);
}

export function selectSender<T extends GlobalState>(global: T, message: ApiMessage): ApiUser | ApiChat | undefined {
  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  return isUserId(senderId) ? selectUser(global, senderId) : selectChat(global, senderId);
}

export function selectReplySender<T extends GlobalState>(global: T, message: ApiMessage, isForwarded = false) {
  if (isForwarded) {
    const { senderUserId, hiddenUserName } = message.forwardInfo || {};
    if (senderUserId) {
      return isUserId(senderUserId) ? selectUser(global, senderUserId) : selectChat(global, senderUserId);
    }
    if (hiddenUserName) return undefined;
  }

  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  return isUserId(senderId) ? selectUser(global, senderId) : selectChat(global, senderId);
}

export function selectForwardedSender<T extends GlobalState>(
  global: T, message: ApiMessage,
): ApiUser | ApiChat | undefined {
  const { forwardInfo } = message;
  if (!forwardInfo) {
    return undefined;
  }

  if (forwardInfo.isChannelPost && forwardInfo.fromChatId) {
    return selectChat(global, forwardInfo.fromChatId);
  } else if (forwardInfo.senderUserId) {
    return selectUser(global, forwardInfo.senderUserId) || selectChat(global, forwardInfo.senderUserId);
  }

  return undefined;
}

const MAX_MESSAGES_TO_DELETE_OWNER_TOPIC = 10;
export function selectCanDeleteOwnerTopic<T extends GlobalState>(global: T, chatId: string, topicId: number) {
  const chat = selectChat(global, chatId);
  if (!chat) {
    return false;
  }

  if (chat.topics?.[topicId] && !chat.topics?.[topicId].isOwner) return false;

  const thread = global.messages.byChatId[chatId]?.threadsById[topicId];

  if (!thread) return false;

  const { listedIds } = thread;
  if (!listedIds
    // Plus one for root message
    || listedIds.length + 1 >= MAX_MESSAGES_TO_DELETE_OWNER_TOPIC) {
    return false;
  }

  const hasNotOutgoingMessages = listedIds.some((messageId) => {
    const message = selectChatMessage(global, chatId, messageId);
    return !message || !message.isOutgoing;
  });

  return !hasNotOutgoingMessages;
}

export function selectCanDeleteTopic<T extends GlobalState>(global: T, chatId: string, topicId: number) {
  const chat = selectChat(global, chatId);
  if (!chat) return false;

  if (topicId === GENERAL_TOPIC_ID) return false;

  return chat.isCreator
    || getHasAdminRight(chat, 'deleteMessages')
    || (chat.isForum
      && selectCanDeleteOwnerTopic(global, chat.id, topicId));
}

export function selectThreadIdFromMessage<T extends GlobalState>(global: T, message: ApiMessage): number {
  const chat = selectChat(global, message.chatId);
  const {
    replyToMessageId, replyToTopMessageId, isTopicReply, content,
  } = message;
  if ('action' in content && content.action?.type === 'topicCreate') {
    return message.id;
  }

  // TODO ignore only basic group if reply threads are added
  if (!chat?.isForum) return MAIN_THREAD_ID;
  if (!isTopicReply) return GENERAL_TOPIC_ID;
  return replyToTopMessageId || replyToMessageId || GENERAL_TOPIC_ID;
}

export function selectTopicFromMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const { chatId } = message;
  const chat = selectChat(global, chatId);
  if (!chat?.isForum) return undefined;

  const threadId = selectThreadIdFromMessage(global, message);
  return chat.topics?.[threadId];
}

export function selectAllowedMessageActions<T extends GlobalState>(global: T, message: ApiMessage, threadId: number) {
  const chat = selectChat(global, message.chatId);
  if (!chat || chat.isRestricted) {
    return {};
  }

  const isPrivate = isUserId(chat.id);
  const isChatWithSelf = selectIsChatWithSelf(global, message.chatId);
  const isBasicGroup = isChatBasicGroup(chat);
  const isSuperGroup = isChatSuperGroup(chat);
  const isChannel = isChatChannel(chat);
  const isLocal = isMessageLocal(message);
  const isServiceNotification = isServiceNotificationMessage(message);
  const isOwn = isOwnMessage(message);
  const isAction = isActionMessage(message);
  const { content } = message;
  const messageTopic = selectTopicFromMessage(global, message);

  const canEditMessagesIndefinitely = isChatWithSelf
    || (isSuperGroup && getHasAdminRight(chat, 'pinMessages'))
    || (isChannel && getHasAdminRight(chat, 'editMessages'));
  const isMessageEditable = (
    (
      canEditMessagesIndefinitely
      || getServerTime() - message.date < MESSAGE_EDIT_ALLOWED_TIME
    ) && !(
      content.sticker || content.contact || content.poll || content.action || content.audio
      || (content.video?.isRound) || content.location || content.invoice
    )
    && !isForwardedMessage(message)
    && !message.viaBotId
    && !chat.isForbidden
  );

  const canReply = !isLocal && !isServiceNotification && !chat.isForbidden && getCanPostInChat(chat, threadId)
    && (!messageTopic || !messageTopic.isClosed || messageTopic.isOwner || getHasAdminRight(chat, 'manageTopics'));

  const hasPinPermission = isPrivate || (
    chat.isCreator
    || (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
    || getHasAdminRight(chat, 'pinMessages')
  );

  let canPin = !isLocal && !isServiceNotification && !isAction && hasPinPermission;
  let canUnpin = false;

  const pinnedMessageIds = selectPinnedIds(global, chat.id, threadId);

  if (canPin) {
    canUnpin = Boolean(pinnedMessageIds && pinnedMessageIds.includes(message.id));
    canPin = !canUnpin;
  }

  const canDelete = !isLocal && !isServiceNotification && (
    isPrivate
    || isOwn
    || isBasicGroup
    || chat.isCreator
    || getHasAdminRight(chat, 'deleteMessages')
  );

  const canReport = !isPrivate && !isOwn;

  const canDeleteForAll = canDelete && !chat.isForbidden && (
    (isPrivate && !isChatWithSelf)
    || (isBasicGroup && (
      isOwn || getHasAdminRight(chat, 'deleteMessages') || chat.isCreator
    ))
  );

  const canEdit = !isLocal && !isAction && isMessageEditable && (
    isOwn
    || (isChannel && (chat.isCreator || getHasAdminRight(chat, 'editMessages')))
  );

  const isChatProtected = selectIsChatProtected(global, message.chatId);
  const canForward = (
    !isLocal && !isAction && !isChatProtected && (message.isForwardingAllowed || isServiceNotification)
  );

  const hasSticker = Boolean(message.content.sticker);
  const hasFavoriteSticker = hasSticker && selectIsStickerFavorite(global, message.content.sticker!);
  const canFaveSticker = !isAction && hasSticker && !hasFavoriteSticker;
  const canUnfaveSticker = !isAction && hasFavoriteSticker;
  const canCopy = !isAction;
  const canCopyLink = !isAction && (isChannel || isSuperGroup);
  const canSelect = !isAction;

  const canDownload = Boolean(content.webPage?.document || content.webPage?.video || content.webPage?.photo
    || content.audio || content.voice || content.photo || content.video || content.document || content.sticker);

  const canSaveGif = message.content.video?.isGif;

  const poll = content.poll;
  const canRevote = !poll?.summary.closed && !poll?.summary.quiz && poll?.results.results?.some((r) => r.isChosen);
  const canClosePoll = isOwn && poll && !poll.summary.closed;

  const noOptions = [
    canReply,
    canEdit,
    canPin,
    canUnpin,
    canReport,
    canDelete,
    canDeleteForAll,
    canForward,
    canFaveSticker,
    canUnfaveSticker,
    canCopy,
    canCopyLink,
    canSelect,
    canDownload,
    canSaveGif,
    canRevote,
    canClosePoll,
  ].every((ability) => !ability);

  return {
    noOptions,
    canReply,
    canEdit,
    canPin,
    canUnpin,
    canReport,
    canDelete,
    canDeleteForAll,
    canForward,
    canFaveSticker,
    canUnfaveSticker,
    canCopy,
    canCopyLink,
    canSelect,
    canDownload,
    canSaveGif,
    canRevote,
    canClosePoll,
  };
}

// This selector always returns a new object which can not be safely used in shallow-equal checks
export function selectCanDeleteSelectedMessages<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds: selectedMessageIds } = selectTabState(global, tabId).selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  const chatMessages = chatId && selectChatMessages(global, chatId);
  if (!chatMessages || !selectedMessageIds || !threadId) {
    return {};
  }

  const messageActions = selectedMessageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId))
    .filter(Boolean);

  return {
    canDelete: messageActions.every((actions) => actions.canDelete),
    canDeleteForAll: messageActions.every((actions) => actions.canDeleteForAll),
  };
}

export function selectCanReportSelectedMessages<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds: selectedMessageIds } = selectTabState(global, tabId).selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  const chatMessages = chatId && selectChatMessages(global, chatId);
  if (!chatMessages || !selectedMessageIds || !threadId) {
    return false;
  }

  const messageActions = selectedMessageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId))
    .filter(Boolean);

  return messageActions.every((actions) => actions.canReport);
}

export function selectCanDownloadSelectedMessages<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds: selectedMessageIds } = selectTabState(global, tabId).selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  const chatMessages = chatId && selectChatMessages(global, chatId);
  if (!chatMessages || !selectedMessageIds || !threadId) {
    return false;
  }

  const messageActions = selectedMessageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId))
    .filter(Boolean);

  return messageActions.some((actions) => actions.canDownload);
}

export function selectIsDownloading<T extends GlobalState>(
  global: T, message: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const activeInChat = selectTabState(global, tabId).activeDownloads.byChatId[message.chatId];
  return activeInChat ? activeInChat.includes(message.id) : false;
}

export function selectActiveDownloadIds<T extends GlobalState>(
  global: T, chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).activeDownloads.byChatId[chatId] || MEMO_EMPTY_ARRAY;
}

export function selectUploadProgress<T extends GlobalState>(global: T, message: ApiMessage) {
  return global.fileUploads.byMessageLocalId[getMessageOriginalId(message)]?.progress;
}

export function selectRealLastReadId<T extends GlobalState>(global: T, chatId: string, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return undefined;
    }

    // `lastReadInboxMessageId` is empty for new chats
    if (!chat.lastReadInboxMessageId) {
      return undefined;
    }

    if (!chat.lastMessage) {
      return chat.lastReadInboxMessageId;
    }

    if (isMessageLocal(chat.lastMessage)) {
      return chat.lastMessage.id;
    }

    // Some previously read messages may be deleted
    return Math.min(chat.lastMessage.id, chat.lastReadInboxMessageId);
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo) {
      return undefined;
    }

    if (!threadInfo.lastReadInboxMessageId) {
      return threadInfo.topMessageId;
    }

    // Some previously read messages may be deleted
    return Math.min(threadInfo.lastReadInboxMessageId, threadInfo.lastMessageId || Infinity);
  }
}

export function selectFirstUnreadId<T extends GlobalState>(
  global: T, chatId: string, threadId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const chat = selectChat(global, chatId);

  if (threadId === MAIN_THREAD_ID) {
    if (!chat) {
      return undefined;
    }
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo
      || (threadInfo.lastMessageId !== undefined && threadInfo.lastMessageId === threadInfo.lastReadInboxMessageId)) {
      return undefined;
    }
  }

  const outlyingIds = selectOutlyingIds(global, chatId, threadId, tabId);
  const listedIds = selectListedIds(global, chatId, threadId);
  const byId = selectChatMessages(global, chatId);
  if (!byId || !(outlyingIds || listedIds)) {
    return undefined;
  }

  const lastReadId = selectRealLastReadId(global, chatId, threadId);
  if (!lastReadId && chat && chat.isNotJoined) {
    return undefined;
  }

  const lastReadServiceNotificationId = chatId === SERVICE_NOTIFICATIONS_USER_ID
    ? global.serviceNotifications.reduce((max, notification) => {
      return !notification.isUnread && notification.id > max ? notification.id : max;
    }, -1)
    : -1;

  function findAfterLastReadId(listIds: number[]) {
    return listIds.find((id) => {
      return (
        (!lastReadId || id > lastReadId)
        && byId[id]
        && (!byId[id].isOutgoing || byId[id].isFromScheduled)
        && id > lastReadServiceNotificationId
      );
    });
  }

  if (outlyingIds) {
    const found = findAfterLastReadId(outlyingIds);
    if (found) {
      return found;
    }
  }

  if (listedIds) {
    const found = findAfterLastReadId(listedIds);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function selectIsPollResultsOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { pollResults } = selectTabState(global, tabId);
  return Boolean(pollResults.messageId);
}

export function selectIsCreateTopicPanelOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { createTopicPanel } = selectTabState(global, tabId);
  return Boolean(createTopicPanel);
}

export function selectIsEditTopicPanelOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { editTopicPanel } = selectTabState(global, tabId);
  return Boolean(editTopicPanel);
}

export function selectIsForwardModalOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { forwardMessages } = selectTabState(global, tabId);
  return Boolean(forwardMessages.isModalShown);
}

export function selectCommonBoxChatId<T extends GlobalState>(global: T, messageId: number) {
  const fromLastMessage = Object.values(global.chats.byId).find((chat) => (
    isCommonBoxChat(chat) && chat.lastMessage && chat.lastMessage.id === messageId
  ));
  if (fromLastMessage) {
    return fromLastMessage.id;
  }

  const { byChatId } = global.messages;
  return Object.keys(byChatId).find((chatId) => {
    const chat = selectChat(global, chatId);
    return chat && isCommonBoxChat(chat) && byChatId[chat.id].byId[messageId];
  });
}

export function selectIsInSelectMode<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { selectedMessages } = selectTabState(global, tabId);

  return Boolean(selectedMessages);
}

export function selectIsMessageSelected<T extends GlobalState>(
  global: T, messageId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds } = selectTabState(global, tabId).selectedMessages || {};
  if (!messageIds) {
    return false;
  }

  return messageIds.includes(messageId);
}

export function selectForwardedMessageIdsByGroupId<T extends GlobalState>(
  global: T, chatId: string, groupedId: string,
) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.values(chatMessages)
    .filter((message) => message.groupedId === groupedId && message.forwardInfo)
    .map(({ forwardInfo }) => forwardInfo!.fromMessageId);
}

export function selectMessageIdsByGroupId<T extends GlobalState>(global: T, chatId: string, groupedId: string) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.keys(chatMessages)
    .map(Number)
    .filter((id) => chatMessages[id].groupedId === groupedId);
}

export function selectIsDocumentGroupSelected<T extends GlobalState>(
  global: T, chatId: string, groupedId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds: selectedIds } = selectTabState(global, tabId).selectedMessages || {};
  if (!selectedIds) {
    return false;
  }

  const groupIds = selectMessageIdsByGroupId(global, chatId, groupedId);
  return groupIds && groupIds.every((id) => selectedIds.includes(id));
}

export function selectSelectedMessagesCount<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds } = selectTabState(global, tabId).selectedMessages || {};

  return messageIds ? messageIds.length : 0;
}

export function selectNewestMessageWithBotKeyboardButtons<T extends GlobalState>(
  global: T, chatId: string, threadId = MAIN_THREAD_ID,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): ApiMessage | undefined {
  const chat = selectChat(global, chatId);
  if (!chat) {
    return undefined;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (!chatMessages || !viewportIds) {
    return undefined;
  }

  const messageId = findLast(viewportIds, (id) => selectShouldDisplayReplyKeyboard(global, chatMessages[id]));

  const replyHideMessageId = findLast(viewportIds, (id) => selectShouldHideReplyKeyboard(global, chatMessages[id]));

  if (messageId && replyHideMessageId && replyHideMessageId > messageId) {
    return undefined;
  }

  return messageId ? chatMessages[messageId] : undefined;
}

function selectShouldHideReplyKeyboard<T extends GlobalState>(global: T, message: ApiMessage) {
  const {
    shouldHideKeyboardButtons,
    isHideKeyboardSelective,
    replyToMessageId,
    isMentioned,
  } = message;
  if (!shouldHideKeyboardButtons) return false;

  if (isHideKeyboardSelective) {
    if (isMentioned) return true;
    if (!replyToMessageId) return false;

    const replyMessage = selectChatMessage(global, message.chatId, replyToMessageId);
    return Boolean(replyMessage?.senderId === global.currentUserId);
  }
  return true;
}

function selectShouldDisplayReplyKeyboard<T extends GlobalState>(global: T, message: ApiMessage) {
  const {
    keyboardButtons,
    shouldHideKeyboardButtons,
    isKeyboardSelective,
    isMentioned,
    replyToMessageId,
  } = message;
  if (!keyboardButtons || shouldHideKeyboardButtons) return false;

  if (isKeyboardSelective) {
    if (isMentioned) return true;
    if (!replyToMessageId) return false;

    const replyMessage = selectChatMessage(global, message.chatId, replyToMessageId);
    return Boolean(replyMessage?.senderId === global.currentUserId);
  }

  return true;
}

export function selectCanAutoLoadMedia<T extends GlobalState>(global: T, message: ApiMessage) {
  const chat = selectChat(global, message.chatId);
  if (!chat) {
    return undefined;
  }

  const sender = selectSender(global, message);

  const isPhoto = Boolean(getMessagePhoto(message) || getMessageWebPagePhoto(message));
  const isVideo = Boolean(getMessageVideo(message) || getMessageWebPageVideo(message));
  const isFile = Boolean(getMessageAudio(message) || getMessageVoice(message) || getMessageDocument(message));

  const {
    canAutoLoadPhotoFromContacts,
    canAutoLoadPhotoInPrivateChats,
    canAutoLoadPhotoInGroups,
    canAutoLoadPhotoInChannels,
    canAutoLoadVideoFromContacts,
    canAutoLoadVideoInPrivateChats,
    canAutoLoadVideoInGroups,
    canAutoLoadVideoInChannels,
    canAutoLoadFileFromContacts,
    canAutoLoadFileInPrivateChats,
    canAutoLoadFileInGroups,
    canAutoLoadFileInChannels,
  } = global.settings.byKey;

  if (isPhoto) {
    return canAutoLoadMedia({
      global,
      chat,
      sender,
      canAutoLoadMediaFromContacts: canAutoLoadPhotoFromContacts,
      canAutoLoadMediaInPrivateChats: canAutoLoadPhotoInPrivateChats,
      canAutoLoadMediaInGroups: canAutoLoadPhotoInGroups,
      canAutoLoadMediaInChannels: canAutoLoadPhotoInChannels,
    });
  }

  if (isVideo) {
    return canAutoLoadMedia({
      global,
      chat,
      sender,
      canAutoLoadMediaFromContacts: canAutoLoadVideoFromContacts,
      canAutoLoadMediaInPrivateChats: canAutoLoadVideoInPrivateChats,
      canAutoLoadMediaInGroups: canAutoLoadVideoInGroups,
      canAutoLoadMediaInChannels: canAutoLoadVideoInChannels,
    });
  }

  if (isFile) {
    return canAutoLoadMedia({
      global,
      chat,
      sender,
      canAutoLoadMediaFromContacts: canAutoLoadFileFromContacts,
      canAutoLoadMediaInPrivateChats: canAutoLoadFileInPrivateChats,
      canAutoLoadMediaInGroups: canAutoLoadFileInGroups,
      canAutoLoadMediaInChannels: canAutoLoadFileInChannels,
    });
  }

  return true;
}

function canAutoLoadMedia<T extends GlobalState>({
  global,
  chat,
  sender,
  canAutoLoadMediaFromContacts,
  canAutoLoadMediaInPrivateChats,
  canAutoLoadMediaInGroups,
  canAutoLoadMediaInChannels,
}: {
  global: T;
  chat: ApiChat;
  canAutoLoadMediaFromContacts: boolean;
  canAutoLoadMediaInPrivateChats: boolean;
  canAutoLoadMediaInGroups: boolean;
  canAutoLoadMediaInChannels: boolean;
  sender?: ApiChat | ApiUser;
}) {
  const isMediaFromContact = Boolean(sender && (
    sender.id === global.currentUserId || selectIsUserOrChatContact(global, sender)
  ));

  return Boolean(
    (isMediaFromContact && canAutoLoadMediaFromContacts)
    || (!isMediaFromContact && canAutoLoadMediaInPrivateChats && isUserId(chat.id))
    || (canAutoLoadMediaInGroups && isChatGroup(chat))
    || (canAutoLoadMediaInChannels && isChatChannel(chat)),
  );
}

export function selectCanAutoPlayMedia<T extends GlobalState>(global: T, message: ApiMessage) {
  const video = getMessageVideo(message) || getMessageWebPageVideo(message);
  if (!video) {
    return undefined;
  }

  const {
    canAutoPlayVideos,
    canAutoPlayGifs,
  } = global.settings.byKey;

  const asGif = video.isGif || video.isRound;

  return (canAutoPlayVideos && !asGif) || (canAutoPlayGifs && asGif);
}

export function selectShouldLoopStickers<T extends GlobalState>(global: T) {
  return global.settings.byKey.shouldLoopStickers;
}

export function selectLastServiceNotification<T extends GlobalState>(global: T) {
  const { serviceNotifications } = global;
  const maxId = Math.max(...serviceNotifications.map(({ id }) => id));

  return serviceNotifications.find(({ id, isDeleted }) => !isDeleted && id === maxId);
}

export function selectIsMessageProtected<T extends GlobalState>(global: T, message?: ApiMessage) {
  return Boolean(message && (message.isProtected || selectIsChatProtected(global, message.chatId)));
}

export function selectIsChatProtected<T extends GlobalState>(global: T, chatId: string) {
  return selectChat(global, chatId)?.isProtected || false;
}

export function selectHasProtectedMessage<T extends GlobalState>(global: T, chatId: string, messageIds?: number[]) {
  if (selectChat(global, chatId)?.isProtected) {
    return true;
  }

  if (!messageIds) {
    return false;
  }

  const messages = selectChatMessages(global, chatId);

  return messageIds.some((messageId) => messages[messageId]?.isProtected);
}

export function selectCanForwardMessages<T extends GlobalState>(global: T, chatId: string, messageIds?: number[]) {
  if (selectChat(global, chatId)?.isProtected) {
    return false;
  }

  if (!messageIds) {
    return false;
  }

  const messages = selectChatMessages(global, chatId);

  return messageIds
    .map((id) => messages[id])
    .every((message) => message.isForwardingAllowed || isServiceNotificationMessage(message));
}

export function selectSponsoredMessage<T extends GlobalState>(global: T, chatId: string) {
  const chat = selectChat(global, chatId);
  const message = chat && isChatChannel(chat) ? global.messages.sponsoredByChatId[chatId] : undefined;

  return message && message.expiresAt >= Math.round(Date.now() / 1000) ? message : undefined;
}

export function selectDefaultReaction<T extends GlobalState>(global: T, chatId: string) {
  if (chatId === SERVICE_NOTIFICATIONS_USER_ID) return undefined;

  const isPrivate = isUserId(chatId);
  const defaultReaction = global.config?.defaultReaction;
  if (!defaultReaction) {
    return undefined;
  }

  if (isPrivate) {
    return defaultReaction;
  }

  const chatReactions = selectChat(global, chatId)?.fullInfo?.enabledReactions;
  if (!chatReactions || !canSendReaction(defaultReaction, chatReactions)) {
    return undefined;
  }

  return defaultReaction;
}

export function selectMaxUserReactions<T extends GlobalState>(global: T): number {
  const isPremium = selectIsCurrentUserPremium(global);
  const { maxUserReactionsPremium = 3, maxUserReactionsDefault = 1 } = global.appConfig || {};
  return isPremium ? maxUserReactionsPremium : maxUserReactionsDefault;
}

// Slow, not to be used in `withGlobal`
export function selectVisibleUsers<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const messageIds = selectTabThreadParam(global, chatId, threadId, 'viewportIds', tabId);
  if (!messageIds) {
    return undefined;
  }

  return messageIds.map((messageId) => {
    const { senderId } = selectChatMessage(global, chatId, messageId) || {};
    return senderId ? selectUser(global, senderId) : undefined;
  }).filter(Boolean);
}

export function selectShouldSchedule<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectCurrentMessageList(global, tabId)?.type === 'scheduled';
}

export function selectCanScheduleUntilOnline<T extends GlobalState>(global: T, id: string) {
  const isChatWithSelf = selectIsChatWithSelf(global, id);
  const chatBot = id === REPLIES_USER_ID && selectChatBot(global, id);
  return Boolean(
    !isChatWithSelf && !chatBot && isUserId(id) && selectUserStatus(global, id)?.wasOnline,
  );
}

export function selectCustomEmojis(message: ApiMessage) {
  const entities = message.content.text?.entities;
  return entities?.filter((entity): entity is ApiMessageEntityCustomEmoji => (
    entity.type === ApiMessageEntityTypes.CustomEmoji
  ));
}

export function selectMessageCustomEmojiSets<T extends GlobalState>(
  global: T, message: ApiMessage,
): ApiStickerSetInfo[] | undefined {
  const customEmojis = selectCustomEmojis(message);
  if (!customEmojis) return MEMO_EMPTY_ARRAY;
  const documents = customEmojis.map((entity) => global.customEmojis.byId[entity.documentId]);
  // If some emoji still loading, do not return empty array
  if (!documents.every(Boolean)) return undefined;
  const sets = documents.map((doc) => doc.stickerSetInfo);
  const setsWithoutDuplicates = sets.reduce((acc, set) => {
    if ('shortName' in set) {
      if (acc.some((s) => 'shortName' in s && s.shortName === set.shortName)) {
        return acc;
      }
    }

    if ('id' in set) {
      if (acc.some((s) => 'id' in s && s.id === set.id)) {
        return acc;
      }
    }
    acc.push(set); // Optimization
    return acc;
  }, [] as ApiStickerSetInfo[]);
  return setsWithoutDuplicates;
}

export function selectForwardsContainVoiceMessages<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds, fromChatId } = selectTabState(global, tabId).forwardMessages;
  if (!messageIds) return false;
  const chatMessages = selectChatMessages(global, fromChatId!);
  return messageIds.some((messageId) => {
    const message = chatMessages[messageId];
    return Boolean(message.content.voice) || message.content.video?.isRound;
  });
}
