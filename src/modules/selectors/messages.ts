import { GlobalState, MessageListType, Thread } from '../../global/types';
import {
  ApiChat,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiUser,
  MAIN_THREAD_ID,
} from '../../api/types';

import { LOCAL_MESSAGE_ID_BASE } from '../../config';
import {
  selectChat, selectIsChatWithBot, selectIsChatWithSelf,
} from './chats';
import { selectIsUserOrChatContact, selectUser } from './users';
import {
  getSendingState,
  isChatChannel,
  isMessageLocal,
  isChatPrivate,
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
} from '../helpers';
import { findLast } from '../../util/iteratees';
import { selectIsStickerFavorite } from './symbols';

const MESSAGE_EDIT_ALLOWED_TIME_MS = 172800000; // 48 hours

export function selectCurrentMessageList(global: GlobalState) {
  const { messageLists } = global.messages;

  if (messageLists && messageLists.length) {
    return messageLists[messageLists.length - 1];
  }

  return undefined;
}

export function selectCurrentChat(global: GlobalState) {
  const { chatId } = selectCurrentMessageList(global) || {};

  return chatId ? selectChat(global, chatId) : undefined;
}

export function selectChatMessages(global: GlobalState, chatId: number) {
  const messages = global.messages.byChatId[chatId];

  return messages ? messages.byId : undefined;
}

export function selectScheduledMessages(global: GlobalState, chatId: number) {
  const messages = global.scheduledMessages.byChatId[chatId];

  return messages ? messages.byId : undefined;
}

export function selectThreadParam<K extends keyof Thread>(
  global: GlobalState,
  chatId: number,
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

export function selectListedIds(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'listedIds');
}

export function selectOutlyingIds(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'outlyingIds');
}

export function selectCurrentMessageIds(
  global: GlobalState, chatId: number, threadId: number, messageListType: MessageListType,
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

export function selectViewportIds(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'viewportIds');
}

export function selectPinnedIds(global: GlobalState, chatId: number) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'pinnedIds');
}

export function selectScheduledIds(global: GlobalState, chatId: number) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds');
}

export function selectScrollOffset(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'scrollOffset');
}

export function selectReplyingToId(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'replyingToId');
}

export function selectEditingId(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'editingId');
}

export function selectEditingScheduledId(global: GlobalState, chatId: number) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledId');
}

export function selectDraft(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'draft');
}

export function selectNoWebPage(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'noWebPage');
}

export function selectThreadInfo(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'threadInfo');
}

export function selectFirstMessageId(global: GlobalState, chatId: number, threadId: number) {
  return selectThreadParam(global, chatId, threadId, 'firstMessageId');
}

export function selectThreadOriginChat(global: GlobalState, chatId: number, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return selectChat(global, chatId);
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) {
    return undefined;
  }

  return selectChat(global, threadInfo.originChannelId || chatId);
}

export function selectThreadTopMessageId(global: GlobalState, chatId: number, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) {
    return undefined;
  }

  return threadInfo.topMessageId;
}

export function selectThreadByMessage(global: GlobalState, chatId: number, message: ApiMessage) {
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

export function isMessageInCurrentMessageList(global: GlobalState, chatId: number, message: ApiMessage) {
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

export function selectIsViewportNewest(global: GlobalState, chatId: number, threadId: number) {
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

export function selectChatMessage(global: GlobalState, chatId: number, messageId: number) {
  const chatMessages = selectChatMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectScheduledMessage(global: GlobalState, chatId: number, messageId: number) {
  const chatMessages = selectScheduledMessages(global, chatId);

  return chatMessages ? chatMessages[messageId] : undefined;
}

export function selectEditingMessage(
  global: GlobalState, chatId: number, threadId: number, messageListType: MessageListType,
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

export function selectFocusedMessageId(global: GlobalState, chatId: number) {
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

  return senderId > 0 ? selectUser(global, senderId) : selectChat(global, senderId);
}

export function selectForwardedSender(global: GlobalState, message: ApiMessage): ApiUser | ApiChat | undefined {
  const { forwardInfo } = message;
  if (!forwardInfo) {
    return undefined;
  }

  if (forwardInfo.isChannelPost && forwardInfo.fromChatId) {
    return selectChat(global, forwardInfo.fromChatId);
  } else if (forwardInfo.senderUserId) {
    return selectUser(global, forwardInfo.senderUserId);
  }

  return undefined;
}

export function selectAllowedMessageActions(global: GlobalState, message: ApiMessage, threadId: number) {
  const chat = selectChat(global, message.chatId);
  if (!chat || chat.isRestricted) {
    return {};
  }

  const isPrivate = isChatPrivate(chat.id);
  const isChatWithSelf = selectIsChatWithSelf(global, message.chatId);
  const isBasicGroup = isChatBasicGroup(chat);
  const isSuperGroup = isChatSuperGroup(chat);
  const isChannel = isChatChannel(chat);
  const isServiceNotification = isServiceNotificationMessage(message);

  const isOwn = isOwnMessage(message);
  const isAction = isActionMessage(message);
  const { content } = message;
  const isMessageEditable = (
    (isChatWithSelf || Date.now() - message.date * 1000 < MESSAGE_EDIT_ALLOWED_TIME_MS)
    && !(
      content.sticker || content.contact || content.poll || content.action || content.audio
      || (content.video && content.video.isRound)
    )
    && !isForwardedMessage(message)
    && !message.viaBotId
  );

  const canReply = getCanPostInChat(chat, threadId) && !isServiceNotification;

  const hasPinPermission = isPrivate || (
    chat.isCreator
    || (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
    || getHasAdminRight(chat, 'pinMessages')
  );

  let canPin = !isAction && hasPinPermission;
  let canUnpin = false;

  const pinnedMessageIds = selectPinnedIds(global, chat.id);

  if (canPin) {
    canUnpin = Boolean(pinnedMessageIds && pinnedMessageIds.includes(message.id));
    canPin = !canUnpin;
  }

  const canDelete = isPrivate
    || isOwn
    || isBasicGroup
    || chat.isCreator
    || getHasAdminRight(chat, 'deleteMessages');

  const canDeleteForAll = canDelete && !isServiceNotification && (
    (isPrivate && !isChatWithSelf)
    || (isBasicGroup && (
      isOwn || getHasAdminRight(chat, 'deleteMessages')
    ))
  );

  const canEdit = !isAction && isMessageEditable && (
    isOwn
    || (isChannel && (chat.isCreator || getHasAdminRight(chat, 'editMessages')))
  );

  const canForward = !isAction && !isServiceNotification;

  const hasSticker = Boolean(message.content.sticker);
  const hasFavoriteSticker = hasSticker && selectIsStickerFavorite(global, message.content.sticker!);
  const canFaveSticker = !isAction && hasSticker && !hasFavoriteSticker;
  const canUnfaveSticker = !isAction && hasFavoriteSticker;
  const canCopy = !isAction;
  const canCopyLink = !isAction && (isChannel || isSuperGroup);
  const canSelect = !isAction;
  const noOptions = [
    canReply,
    canEdit,
    canPin,
    canUnpin,
    canDelete,
    canDeleteForAll,
    canForward,
    canFaveSticker,
    canUnfaveSticker,
    canCopy,
    canCopyLink,
    canSelect,
  ].every((ability) => !ability);

  return {
    noOptions,
    canReply,
    canEdit,
    canPin,
    canUnpin,
    canDelete,
    canDeleteForAll,
    canForward,
    canFaveSticker,
    canUnfaveSticker,
    canCopy,
    canCopyLink,
    canSelect,
  };
}

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

export function selectUploadProgress(global: GlobalState, message: ApiMessage) {
  const fileTransfer = global.fileUploads.byMessageLocalId[message.previousLocalId || message.id];

  return fileTransfer ? fileTransfer.progress : undefined;
}

export function selectRealLastReadId(global: GlobalState, chatId: number, threadId: number) {
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
    return threadInfo.lastMessageId
      ? Math.min(threadInfo.lastReadInboxMessageId, threadInfo.lastMessageId)
      : threadInfo.lastReadInboxMessageId;
  }
}

export function selectFirstUnreadId(global: GlobalState, chatId: number, threadId: number) {
  if (threadId === MAIN_THREAD_ID) {
    const chat = selectChat(global, chatId);
    if (!chat || !chat.unreadCount) {
      return undefined;
    }
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo || threadInfo.lastMessageId === threadInfo.lastReadInboxMessageId) {
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

  if (outlyingIds) {
    const found = outlyingIds.find((id) => !lastReadId || (id > lastReadId && byId[id] && !byId[id].isOutgoing));
    if (found) {
      return found;
    }
  }

  if (listedIds) {
    const found = listedIds.find((id) => !lastReadId || (id > lastReadId && byId[id] && !byId[id].isOutgoing));
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
  const { forwardMessages } = global;
  return Boolean(forwardMessages.isModalShown);
}

export function selectCommonBoxChatId(global: GlobalState, messageId: number) {
  const fromLastMessage = Object.values(global.chats.byId).find((chat) => (
    isCommonBoxChat(chat) && chat.lastMessage && chat.lastMessage.id === messageId
  ));
  if (fromLastMessage) {
    return fromLastMessage.id;
  }

  const { byChatId } = global.messages;
  return Number(Object.keys(byChatId).find((chatId) => {
    const chat = selectChat(global, Number(chatId));
    return chat && isCommonBoxChat(chat) && byChatId[chat.id].byId[messageId];
  }));
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

export function selectForwardedMessageIdsByGroupId(global: GlobalState, chatId: number, groupedId: string) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.values(chatMessages)
    .filter((message) => message.groupedId === groupedId && message.forwardInfo)
    .map(({ forwardInfo }) => forwardInfo!.fromMessageId);
}

export function selectMessageIdsByGroupId(global: GlobalState, chatId: number, groupedId: string) {
  const chatMessages = selectChatMessages(global, chatId);
  if (!chatMessages) {
    return undefined;
  }

  return Object.keys(chatMessages)
    .map(Number)
    .filter((id) => chatMessages[id].groupedId === groupedId);
}

export function selectIsDocumentGroupSelected(global: GlobalState, chatId: number, groupedId: string) {
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
  global: GlobalState, chatId: number,
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

export function selectShouldAutoLoadMedia(
  global: GlobalState, message: ApiMessage, chat: ApiChat, sender?: ApiChat | ApiUser,
) {
  const {
    shouldAutoDownloadMediaFromContacts,
    shouldAutoDownloadMediaInPrivateChats,
    shouldAutoDownloadMediaInGroups,
    shouldAutoDownloadMediaInChannels,
  } = global.settings.byKey;

  return Boolean(
    (shouldAutoDownloadMediaInPrivateChats && isChatPrivate(chat.id))
    || (shouldAutoDownloadMediaInGroups && isChatGroup(chat))
    || (shouldAutoDownloadMediaInChannels && isChatChannel(chat))
    || (shouldAutoDownloadMediaFromContacts && sender && (
      sender.id === global.currentUserId
      || selectIsUserOrChatContact(global, sender)
    )),
  );
}

export function selectShouldAutoPlayMedia(global: GlobalState, message: ApiMessage) {
  const video = getMessageVideo(message);
  if (!video) {
    return undefined;
  }

  const {
    shouldAutoPlayVideos,
    shouldAutoPlayGifs,
  } = global.settings.byKey;

  const asGif = video.isGif || video.isRound;

  return (shouldAutoPlayVideos && !asGif) || (shouldAutoPlayGifs && asGif);
}

export function selectShouldLoopStickers(global: GlobalState) {
  return global.settings.byKey.shouldLoopStickers;
}
