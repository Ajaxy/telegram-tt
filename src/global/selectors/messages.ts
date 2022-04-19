import { GlobalState, MessageListType, Thread } from '../types';
import {
  ApiChat,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiUser,
  MAIN_THREAD_ID,
} from '../../api/types';

import { LOCAL_MESSAGE_ID_BASE, REPLIES_USER_ID, SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import {
  selectChat, selectChatBot, selectIsChatWithBot, selectIsChatWithSelf,
} from './chats';
import { selectIsUserOrChatContact, selectUser, selectUserStatus } from './users';
import {
  getSendingState,
  isChatChannel,
  isMessageLocal,
  isUserId,
  isForwardedMessage,
  getCanPostInChat,
  isUserRightBanned,
  getHasAdminRight,
  isChatBasicGroup,
  isCommonBoxChat,
  isServiceNotificationMessage,
  isOwnMessage,
  isActionMessage,
  isChatGroup,
  isChatSuperGroup,
  getMessageVideo,
  getMessageWebPageVideo,
  getMessagePhoto,
  getMessageAudio,
  getMessageVoice,
  getMessageDocument,
  getMessageWebPagePhoto,
} from '../helpers';
import { findLast } from '../../util/iteratees';
import { selectIsStickerFavorite } from './symbols';
import { getServerTime } from '../../util/serverTime';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

const MESSAGE_EDIT_ALLOWED_TIME = 172800; // 48 hours

export function selectCurrentMessageList(global: GlobalState) {
  const { messageLists } = global.messages;

  if (messageLists.length) {
    return messageLists[messageLists.length - 1];
  }

  return undefined;
}

export function selectCurrentChat(global: GlobalState) {
  const { chatId } = selectCurrentMessageList(global) || {};

  return chatId ? selectChat(global, chatId) : undefined;
}

export function selectChatMessages(global: GlobalState, chatId: string) {
  return global.messages.byChatId[chatId]?.byId;
}

export function selectScheduledMessages(global: GlobalState, chatId: string) {
  return global.scheduledMessages.byChatId[chatId]?.byId;
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

export function selectListedIds(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'listedIds');
}

export function selectOutlyingIds(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'outlyingIds');
}

export function selectCurrentMessageIds(
  global: GlobalState, chatId: string, threadId: number, messageListType: MessageListType,
) {
  switch (messageListType) {
    case 'thread':
      return selectViewportIds(global, chatId, threadId);
    case 'pinned':
      return selectPinnedIds(global, chatId);
    case 'scheduled':
      return selectScheduledIds(global, chatId);
  }

  return undefined;
}

export function selectViewportIds(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'viewportIds');
}

export function selectPinnedIds(global: GlobalState, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'pinnedIds');
}

export function selectScheduledIds(global: GlobalState, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds');
}

export function selectScrollOffset(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'scrollOffset');
}

export function selectReplyingToId(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'replyingToId');
}

export function selectEditingId(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'editingId');
}

export function selectEditingDraft(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'editingDraft');
}

export function selectEditingScheduledId(global: GlobalState, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledId');
}

export function selectEditingScheduledDraft(global: GlobalState, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledDraft');
}

export function selectDraft(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'draft');
}

export function selectNoWebPage(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'noWebPage');
}

export function selectThreadInfo(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'threadInfo');
}

export function selectFirstMessageId(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'firstMessageId');
}

export function selectReplyStack(global: GlobalState, chatId: string, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'replyStack');
}

export function selectThreadOriginChat(global: GlobalState, chatId: string, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return selectChat(global, chatId);
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) {
    return undefined;
  }

  return selectChat(global, threadInfo.originChannelId || chatId);
}

export function selectThreadTopMessageId(global: GlobalState, chatId: string, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) {
    return undefined;
  }

  return threadInfo.topMessageId;
}

export function selectThreadByMessage(global: GlobalState, chatId: string, message: ApiMessage) {
  const messageInfo = global.messages.byChatId[chatId];
  if (!messageInfo) {
    return undefined;
  }

  const { replyToMessageId, replyToTopMessageId } = message;
  if (!replyToMessageId && !replyToTopMessageId) {
    return undefined;
  }

  return Object.values<Thread>(messageInfo.threadsById).find((thread) => {
    return thread.threadInfo && (
      (replyToMessageId && replyToMessageId === thread.threadInfo.topMessageId)
      || (replyToTopMessageId && replyToTopMessageId === thread.threadInfo.topMessageId)
    );
  });
}

export function selectIsMessageInCurrentMessageList(global: GlobalState, chatId: string, message: ApiMessage) {
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return false;
  }

  const { threadInfo } = selectThreadByMessage(global, chatId, message) || {};
  return (
    chatId === currentMessageList.chatId
    && (
      (currentMessageList.threadId === MAIN_THREAD_ID)
      || (threadInfo && currentMessageList.threadId === threadInfo.threadId)
    )
  );
}

export function selectIsViewportNewest(global: GlobalState, chatId: string, threadId: number) {
  const viewportIds = selectViewportIds(global, chatId, threadId);
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
  if (lastMessageId >= LOCAL_MESSAGE_ID_BASE && !selectChatMessage(global, chatId, lastMessageId)) {
    return true;
  }

  return viewportIds[viewportIds.length - 1] >= lastMessageId;
}

export function selectChatMessage(global: GlobalState, chatId: string, messageId: number) {
  const chatMessages = selectChatMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectScheduledMessage(global: GlobalState, chatId: string, messageId: number) {
  const chatMessages = selectScheduledMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectEditingMessage(
  global: GlobalState, chatId: string, threadId: number, messageListType: MessageListType,
) {
  if (messageListType === 'scheduled') {
    const messageId = selectEditingScheduledId(global, chatId);
    return messageId ? selectScheduledMessage(global, chatId, messageId) : undefined;
  } else {
    const messageId = selectEditingId(global, chatId, threadId);
    return messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  }
}

export function selectChatMessageByPollId(global: GlobalState, pollId: string) {
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

export function selectFocusedMessageId(global: GlobalState, chatId: string) {
  const { chatId: focusedChatId, messageId } = global.focusedMessage || {};

  return focusedChatId === chatId ? messageId : undefined;
}

export function selectIsMessageFocused(global: GlobalState, message: ApiMessage) {
  const focusedId = selectFocusedMessageId(global, message.chatId);

  return focusedId ? focusedId === message.id || focusedId === message.previousLocalId : false;
}

export function selectIsMessageUnread(global: GlobalState, message: ApiMessage) {
  const { lastReadOutboxMessageId } = selectChat(global, message.chatId) || {};
  return isMessageLocal(message) || !lastReadOutboxMessageId || lastReadOutboxMessageId < message.id;
}

export function selectOutgoingStatus(
  global: GlobalState, message: ApiMessage, isScheduledList = false,
): ApiMessageOutgoingStatus {
  if (!selectIsMessageUnread(global, message) && !isScheduledList) {
    return 'read';
  }

  return getSendingState(message);
}

export function selectSender(global: GlobalState, message: ApiMessage): ApiUser | ApiChat | undefined {
  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  return isUserId(senderId) ? selectUser(global, senderId) : selectChat(global, senderId);
}

export function selectReplySender(global: GlobalState, message: ApiMessage, isForwarded = false) {
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

export function selectForwardedSender(global: GlobalState, message: ApiMessage): ApiUser | ApiChat | undefined {
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

export function selectAllowedMessageActions(global: GlobalState, message: ApiMessage, threadId: number) {
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

  const canEditMessagesIndefinitely = isChatWithSelf
    || (isSuperGroup && getHasAdminRight(chat, 'pinMessages'))
    || (isChannel && getHasAdminRight(chat, 'editMessages'));
  const isMessageEditable = (
    (
      canEditMessagesIndefinitely
      || getServerTime(global.serverTimeOffset) - message.date < MESSAGE_EDIT_ALLOWED_TIME
    ) && !(
      content.sticker || content.contact || content.poll || content.action || content.audio
      || (content.video?.isRound) || content.location
    )
    && !isForwardedMessage(message)
    && !message.viaBotId
    && !chat.isForbidden
  );

  const canReply = !isLocal && !isServiceNotification && !chat.isForbidden && getCanPostInChat(chat, threadId);

  const hasPinPermission = isPrivate || (
    chat.isCreator
    || (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
    || getHasAdminRight(chat, 'pinMessages')
  );

  let canPin = !isLocal && !isServiceNotification && !isAction && hasPinPermission;
  let canUnpin = false;

  const pinnedMessageIds = selectPinnedIds(global, chat.id);

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

  const canForward = !isLocal && !isAction;

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
  };
}

// This selector always returns a new object which can not be safely used in shallow-equal checks
export function selectCanDeleteSelectedMessages(global: GlobalState) {
  const { messageIds: selectedMessageIds } = global.selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
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

export function selectCanReportSelectedMessages(global: GlobalState) {
  const { messageIds: selectedMessageIds } = global.selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  const chatMessages = chatId && selectChatMessages(global, chatId);
  if (!chatMessages || !selectedMessageIds || !threadId) {
    return false;
  }

  const messageActions = selectedMessageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId))
    .filter(Boolean);

  return messageActions.every((actions) => actions.canReport);
}

export function selectCanDownloadSelectedMessages(global: GlobalState) {
  const { messageIds: selectedMessageIds } = global.selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  const chatMessages = chatId && selectChatMessages(global, chatId);
  if (!chatMessages || !selectedMessageIds || !threadId) {
    return false;
  }

  const messageActions = selectedMessageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActions(global, chatMessages[id], threadId))
    .filter(Boolean);

  return messageActions.some((actions) => actions.canDownload);
}

export function selectIsDownloading(global: GlobalState, message: ApiMessage) {
  const activeInChat = global.activeDownloads.byChatId[message.chatId];
  return activeInChat ? activeInChat.includes(message.id) : false;
}

export function selectActiveDownloadIds(global: GlobalState, chatId: string) {
  return global.activeDownloads.byChatId[chatId] || MEMO_EMPTY_ARRAY;
}

export function selectUploadProgress(global: GlobalState, message: ApiMessage) {
  return global.fileUploads.byMessageLocalId[message.previousLocalId || message.id]?.progress;
}

export function selectRealLastReadId(global: GlobalState, chatId: string, threadId: number) {
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

export function selectFirstUnreadId(global: GlobalState, chatId: string, threadId: number) {
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

  const outlyingIds = selectOutlyingIds(global, chatId, threadId);
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

export function selectIsPollResultsOpen(global: GlobalState) {
  const { pollResults } = global;
  return Boolean(pollResults.messageId);
}

export function selectIsForwardModalOpen(global: GlobalState) {
  const { forwardMessages, switchBotInline } = global;
  return Boolean(switchBotInline || forwardMessages.isModalShown);
}

export function selectCommonBoxChatId(global: GlobalState, messageId: number) {
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

export function selectIsInSelectMode(global: GlobalState) {
  const { selectedMessages } = global;

  return Boolean(selectedMessages);
}

export function selectIsMessageSelected(global: GlobalState, messageId: number) {
  const { messageIds } = global.selectedMessages || {};
  if (!messageIds) {
    return false;
  }

  return messageIds.includes(messageId);
}

export function selectForwardedMessageIdsByGroupId(global: GlobalState, chatId: string, groupedId: string) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.values(chatMessages)
    .filter((message) => message.groupedId === groupedId && message.forwardInfo)
    .map(({ forwardInfo }) => forwardInfo!.fromMessageId);
}

export function selectMessageIdsByGroupId(global: GlobalState, chatId: string, groupedId: string) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.keys(chatMessages)
    .map(Number)
    .filter((id) => chatMessages[id].groupedId === groupedId);
}

export function selectIsDocumentGroupSelected(global: GlobalState, chatId: string, groupedId: string) {
  const { messageIds: selectedIds } = global.selectedMessages || {};
  if (!selectedIds) {
    return false;
  }

  const groupIds = selectMessageIdsByGroupId(global, chatId, groupedId);
  return groupIds && groupIds.every((id) => selectedIds.includes(id));
}

export function selectSelectedMessagesCount(global: GlobalState) {
  const { messageIds } = global.selectedMessages || {};

  return messageIds ? messageIds.length : 0;
}

export function selectNewestMessageWithBotKeyboardButtons(
  global: GlobalState, chatId: string,
): ApiMessage | undefined {
  const chat = selectChat(global, chatId);
  if (!chat) {
    return undefined;
  }

  if (!selectIsChatWithBot(global, chat)) {
    return undefined;
  }

  const chatMessages = selectChatMessages(global, chatId);
  const viewportIds = selectViewportIds(global, chatId, MAIN_THREAD_ID);
  if (!chatMessages || !viewportIds) {
    return undefined;
  }

  const messageId = findLast(viewportIds, (id) => {
    return !chatMessages[id].isOutgoing && Boolean(chatMessages[id].keyboardButtons);
  });

  const replyHideMessageId = findLast(viewportIds, (id) => {
    return Boolean(chatMessages[id].shouldHideKeyboardButtons);
  });

  if (messageId && replyHideMessageId && replyHideMessageId > messageId) {
    return undefined;
  }

  return messageId ? chatMessages[messageId] : undefined;
}

export function selectCanAutoLoadMedia(global: GlobalState, message: ApiMessage) {
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

function canAutoLoadMedia({
  global,
  chat,
  sender,
  canAutoLoadMediaFromContacts,
  canAutoLoadMediaInPrivateChats,
  canAutoLoadMediaInGroups,
  canAutoLoadMediaInChannels,
}: {
  global: GlobalState;
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

export function selectCanAutoPlayMedia(global: GlobalState, message: ApiMessage) {
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

export function selectShouldLoopStickers(global: GlobalState) {
  return global.settings.byKey.shouldLoopStickers;
}

export function selectLastServiceNotification(global: GlobalState) {
  const { serviceNotifications } = global;
  const maxId = Math.max(...serviceNotifications.map(({ id }) => id));

  return serviceNotifications.find(({ id }) => id === maxId);
}

export function selectIsMessageProtected(global: GlobalState, message?: ApiMessage) {
  return message ? message.isProtected || selectChat(global, message.chatId)?.isProtected : false;
}

export function selectHasProtectedMessage(global: GlobalState, chatId: string, messageIds?: number[]) {
  if (selectChat(global, chatId)?.isProtected) {
    return true;
  }

  if (!messageIds) {
    return false;
  }

  const messages = selectChatMessages(global, chatId);

  return messageIds.some((messageId) => messages[messageId]?.isProtected);
}

export function selectSponsoredMessage(global: GlobalState, chatId: string) {
  const chat = selectChat(global, chatId);
  const message = chat && isChatChannel(chat) ? global.messages.sponsoredByChatId[chatId] : undefined;

  return message && message.expiresAt >= Math.round(Date.now() / 1000) ? message : undefined;
}

export function selectDefaultReaction(global: GlobalState, chatId: string) {
  if (chatId === SERVICE_NOTIFICATIONS_USER_ID) return undefined;

  const isPrivate = isUserId(chatId);
  const defaultReaction = global.appConfig?.defaultReaction;
  const { availableReactions } = global;
  if (!defaultReaction || !availableReactions?.some(
    (l) => l.reaction === defaultReaction && !l.isInactive,
  )) {
    return undefined;
  }

  if (isPrivate) {
    return defaultReaction;
  }

  const enabledReactions = selectChat(global, chatId)?.fullInfo?.enabledReactions;
  if (!enabledReactions?.includes(defaultReaction)) {
    return undefined;
  }

  return defaultReaction;
}

// Slow, not to be used in `withGlobal`
export function selectVisibleUsers(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const messageIds = selectThreadParam(global, chatId, threadId, 'viewportIds');
  if (!messageIds) {
    return undefined;
  }

  return messageIds.map((messageId) => {
    const { senderId } = selectChatMessage(global, chatId, messageId) || {};
    return senderId ? selectUser(global, senderId) : undefined;
  }).filter(Boolean);
}

export function selectShouldSchedule(global: GlobalState) {
  return selectCurrentMessageList(global)?.type === 'scheduled';
}

export function selectCanScheduleUntilOnline(global: GlobalState, id: string) {
  const isChatWithSelf = selectIsChatWithSelf(global, id);
  const chatBot = id === REPLIES_USER_ID && selectChatBot(global, id);
  return Boolean(
    !isChatWithSelf && !chatBot && isUserId(id) && selectUserStatus(global, id)?.wasOnline,
  );
}
