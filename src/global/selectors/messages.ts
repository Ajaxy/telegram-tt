import type {
  ApiChat,
  ApiInputMessageReplyInfo,
  ApiMessage,
  ApiMessageEntityCustomEmoji,
  ApiMessageForwardInfo,
  ApiMessageOutgoingStatus,
  ApiPeer, ApiSponsoredMessage,
  ApiStickerSetInfo,
} from '../../api/types';
import type {
  ChatTranslatedMessages,
  MessageListType,
  TabThread,
  Thread,
  ThreadId,
} from '../../types';
import type { IAllowedAttachmentOptions } from '../helpers';
import type {
  GlobalState, TabArgs,
} from '../types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import {
  ANONYMOUS_USER_ID, API_GENERAL_ID_LIMIT, GENERAL_TOPIC_ID, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { findLast } from '../../util/iteratees';
import { getMessageKey, isLocalMessageId } from '../../util/keys/messageKey';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { getServerTime } from '../../util/serverTime';
import { IS_TRANSLATION_SUPPORTED } from '../../util/windowEnvironment';
import {
  canSendReaction,
  getAllowedAttachmentOptions,
  getCanPostInChat,
  getHasAdminRight,
  getIsSavedDialog,
  getMessageAudio,
  getMessageDocument,
  getMessageLink,
  getMessagePaidMedia,
  getMessagePhoto,
  getMessageVideo,
  getMessageVoice,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getSendingState,
  hasMessageTtl,
  isActionMessage,
  isChatBasicGroup,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isCommonBoxChat,
  isExpiredMessage,
  isForwardedMessage,
  isMessageDocumentSticker,
  isMessageFailed,
  isMessageLocal,
  isMessageTranslatable,
  isOwnMessage,
  isServiceNotificationMessage,
  isUserId,
  isUserRightBanned,
} from '../helpers';
import { getMessageReplyInfo } from '../helpers/replies';
import {
  selectChat,
  selectChatFullInfo,
  selectChatLastMessageId,
  selectIsChatWithSelf,
  selectRequestedChatTranslationLanguage,
} from './chats';
import { selectPeer } from './peers';
import { selectPeerStory } from './stories';
import { selectIsStickerFavorite } from './symbols';
import { selectTabState } from './tabs';
import { selectTopic } from './topics';
import {
  selectBot, selectIsCurrentUserPremium, selectUser, selectUserStatus,
} from './users';

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
  threadId: ThreadId,
  key: K,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).tabThreads[chatId]?.[threadId]?.[key];
}

export function selectThreadParam<T extends GlobalState, K extends keyof Thread>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  key: K,
) {
  return selectThread(global, chatId, threadId)?.[key];
}

export function selectThread<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
) {
  const messageInfo = global.messages.byChatId[chatId];
  if (!messageInfo) {
    return undefined;
  }

  const thread = messageInfo.threadsById[threadId];
  if (!thread) {
    return undefined;
  }

  return thread;
}

export function selectListedIds<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'listedIds');
}

export function selectOutlyingListByMessageId<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, messageId: number,
) {
  const outlyingLists = selectOutlyingLists(global, chatId, threadId);
  if (!outlyingLists) {
    return undefined;
  }

  return outlyingLists.find((list) => {
    return list[0] <= messageId && list[list.length - 1] >= messageId;
  });
}

export function selectOutlyingLists<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
) {
  return selectThreadParam(global, chatId, threadId, 'outlyingLists');
}

export function selectCurrentMessageIds<T extends GlobalState>(
  global: T,
  chatId: string, threadId: ThreadId, messageListType: MessageListType,
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
  global: T, chatId: string, threadId: ThreadId, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'viewportIds', tabId);
}

export function selectPinnedIds<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'pinnedIds');
}

export function selectScheduledIds<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'scheduledIds');
}

export function selectScrollOffset<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'scrollOffset', tabId);
}

export function selectLastScrollOffset<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'lastScrollOffset');
}

export function selectEditingId<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'editingId');
}

export function selectEditingDraft<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'editingDraft');
}

export function selectEditingScheduledId<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledId');
}

export function selectEditingScheduledDraft<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledDraft');
}

export function selectDraft<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'draft');
}

export function selectNoWebPage<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'noWebPage');
}

export function selectThreadInfo<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'threadInfo');
}

export function selectFirstMessageId<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadParam(global, chatId, threadId, 'firstMessageId');
}

export function selectReplyStack<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'replyStack', tabId);
}

export function selectThreadMessagesCount(global: GlobalState, chatId: string, threadId: ThreadId) {
  const chat = selectChat(global, chatId);
  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!chat || !threadInfo || threadInfo.messagesCount === undefined) return undefined;
  // In forum topics first message is ignored, but not in General
  if (chat.isForum && threadId !== GENERAL_TOPIC_ID) return threadInfo.messagesCount - 1;
  return threadInfo.messagesCount;
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
  global: T, chatId: string, threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  if (!viewportIds || !viewportIds.length) {
    return true;
  }

  const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

  let lastMessageId: number;

  if (threadId === MAIN_THREAD_ID) {
    const id = selectChatLastMessageId(global, chatId);
    if (!id) {
      return true;
    }
    lastMessageId = id;
  } else if (isSavedDialog) {
    const id = selectChatLastMessageId(global, String(threadId), 'saved');
    if (!id) {
      return true;
    }
    lastMessageId = id;
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo || !threadInfo.lastMessageId) {
      if (!threadInfo?.threadId) return undefined;
      // No messages in thread, except for the thread message itself
      lastMessageId = Number(threadInfo?.threadId);
    } else {
      lastMessageId = threadInfo.lastMessageId;
    }
  }

  // Edge case: outgoing `lastMessage` is updated with a delay to optimize animation
  if (isLocalMessageId(lastMessageId) && !selectChatMessage(global, chatId, lastMessageId)) {
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

export function selectQuickReplyMessage<T extends GlobalState>(global: T, messageId: number) {
  return global.quickReplies.messagesById[messageId];
}

export function selectEditingMessage<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, messageListType: MessageListType,
) {
  if (messageListType === 'scheduled') {
    const messageId = selectEditingScheduledId(global, chatId);
    return messageId ? selectScheduledMessage(global, chatId, messageId) : undefined;
  } else {
    const messageId = selectEditingId(global, chatId, threadId);
    return messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  }
}

export function selectFocusedMessageId<T extends GlobalState>(
  global: T, chatId: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { chatId: focusedChatId, messageId } = selectTabState(global, tabId).focusedMessage || {};

  return focusedChatId === chatId ? messageId : undefined;
}

export function selectIsMessageFocused<T extends GlobalState>(
  global: T, message: ApiMessage, currentThreadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const focusedId = selectFocusedMessageId(global, message.chatId, tabId);
  const threadId = selectTabState(global, tabId).focusedMessage?.threadId;

  if (currentThreadId !== threadId) return false;

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

export function selectSender<T extends GlobalState>(global: T, message: ApiMessage): ApiPeer | undefined {
  const { senderId } = message;
  const chat = selectChat(global, message.chatId);
  if (!senderId) {
    return chat;
  }

  if (chat && isChatChannel(chat) && !chat.areProfilesShown) return chat;

  return selectPeer(global, senderId);
}

export function getSendersFromSelectedMessages<T extends GlobalState>(
  global: T,
  chatId: string,
  messageIds: number[],
) {
  return messageIds.map((id) => {
    const message = selectChatMessage(global, chatId, id);
    return message && selectSender(global, message);
  }).filter(Boolean);
}

export function selectSenderFromMessage<T extends GlobalState>(
  global: T,
  chatId: string,
  messageId: number,
): ApiPeer | undefined {
  const message = selectChatMessage(global, chatId, messageId);

  return message && selectSender(global, message);
}

export function selectSenderFromHeader<T extends GlobalState>(
  global: T,
  header: ApiMessageForwardInfo,
) {
  const { fromId } = header;
  if (fromId) {
    return selectPeer(global, fromId);
  }

  return undefined;
}

export function selectForwardedSender<T extends GlobalState>(
  global: T, message: ApiMessage,
): ApiPeer | undefined {
  const isStoryForward = Boolean(message.content.storyData);
  if (isStoryForward) {
    const peerId = message.content.storyData!.peerId;
    return selectPeer(global, peerId);
  }

  const { forwardInfo } = message;
  if (!forwardInfo) {
    return undefined;
  }

  if (forwardInfo.isChannelPost && forwardInfo.fromChatId) {
    return selectChat(global, forwardInfo.fromChatId);
  }

  if (forwardInfo.hiddenUserName) {
    return undefined;
  }

  if (forwardInfo.fromId) {
    return selectPeer(global, forwardInfo.fromId);
  }

  if (forwardInfo.savedFromPeerId) {
    return selectPeer(global, forwardInfo.savedFromPeerId);
  }

  return undefined;
}

export function selectPoll<T extends GlobalState>(global: T, pollId: string) {
  return global.messages.pollById[pollId];
}

export function selectPollFromMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  if (!message.content.pollId) return undefined;
  return selectPoll(global, message.content.pollId);
}

export function selectTopicFromMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const { chatId } = message;
  const chat = selectChat(global, chatId);
  if (!chat?.isForum) return undefined;

  const threadId = selectThreadIdFromMessage(global, message);
  return selectTopic(global, chatId, threadId);
}

const MAX_MESSAGES_TO_DELETE_OWNER_TOPIC = 10;
export function selectCanDeleteOwnerTopic<T extends GlobalState>(global: T, chatId: string, topicId: number) {
  const topic = selectTopic(global, chatId, topicId);
  if (topic && !topic.isOwner) return false;

  const thread = selectThread(global, chatId, topicId);
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

export function selectSavedDialogIdFromMessage<T extends GlobalState>(
  global: T, message: ApiMessage,
): string | undefined {
  const {
    chatId, senderId, forwardInfo, savedPeerId,
  } = message;

  if (savedPeerId) return savedPeerId;

  if (chatId !== global.currentUserId) {
    return undefined;
  }

  if (forwardInfo?.savedFromPeerId) {
    return forwardInfo.savedFromPeerId;
  }

  if (forwardInfo?.fromId) {
    return forwardInfo.fromId;
  }

  if (forwardInfo?.hiddenUserName) {
    return ANONYMOUS_USER_ID;
  }

  return senderId;
}

export function selectThreadIdFromMessage<T extends GlobalState>(global: T, message: ApiMessage): ThreadId {
  const savedDialogId = selectSavedDialogIdFromMessage(global, message);
  if (savedDialogId) {
    return savedDialogId;
  }

  const chat = selectChat(global, message.chatId);
  const { content } = message;
  const { replyToMsgId, replyToTopId, isForumTopic } = getMessageReplyInfo(message) || {};
  if ('action' in content && content.action?.type === 'topicCreate') {
    return message.id;
  }

  if (!chat?.isForum) {
    if (chat && isChatBasicGroup(chat)) return MAIN_THREAD_ID;

    if (chat && isChatSuperGroup(chat)) {
      return replyToTopId || replyToMsgId || MAIN_THREAD_ID;
    }
    return MAIN_THREAD_ID;
  }
  if (!isForumTopic) return GENERAL_TOPIC_ID;
  return replyToTopId || replyToMsgId || GENERAL_TOPIC_ID;
}

export function selectCanReplyToMessage<T extends GlobalState>(global: T, message: ApiMessage, threadId: ThreadId) {
  const chat = selectChat(global, message.chatId);
  if (!chat || chat.isRestricted || chat.isForbidden) return false;

  const isLocal = isMessageLocal(message);
  const isServiceNotification = isServiceNotificationMessage(message);

  if (isLocal || isServiceNotification) return false;

  const threadInfo = selectThreadInfo(global, message.chatId, threadId);
  const isMessageThread = Boolean(!threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
  const chatFullInfo = selectChatFullInfo(global, chat.id);
  const topic = selectTopic(global, chat.id, threadId);
  const canPostInChat = getCanPostInChat(chat, topic, isMessageThread, chatFullInfo);
  if (!canPostInChat) return false;

  const messageTopic = selectTopicFromMessage(global, message);
  return !messageTopic || !messageTopic.isClosed || messageTopic.isOwner || getHasAdminRight(chat, 'manageTopics');
}

export function selectCanForwardMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const isLocal = isMessageLocal(message);
  const isServiceNotification = isServiceNotificationMessage(message);
  const isAction = isActionMessage(message);
  const hasTtl = hasMessageTtl(message);
  const { content } = message;
  const story = content.storyData
    ? selectPeerStory(global, content.storyData.peerId, content.storyData.id)
    : (content.webPage?.story
      ? selectPeerStory(global, content.webPage.story.peerId, content.webPage.story.id)
      : undefined
    );
  const isChatProtected = selectIsChatProtected(global, message.chatId);
  const isStoryForwardForbidden = story && ('isDeleted' in story || ('noForwards' in story && story.noForwards));
  const canForward = (
    !isLocal && !isAction && !isChatProtected && !isStoryForwardForbidden
    && (message.isForwardingAllowed || isServiceNotification) && !hasTtl
  );

  return canForward;
}

// This selector is slow and not to be used within lists (e.g. Message component)
export function selectAllowedMessageActionsSlow<T extends GlobalState>(
  global: T, message: ApiMessage, threadId: ThreadId,
) {
  const chat = selectChat(global, message.chatId);
  if (!chat || chat.isRestricted) {
    return {};
  }

  const isPrivate = isUserId(chat.id);
  const isChatWithSelf = selectIsChatWithSelf(global, message.chatId);
  const isBasicGroup = isChatBasicGroup(chat);
  const isSuperGroup = isChatSuperGroup(chat);
  const isChannel = isChatChannel(chat);
  const isBotChat = Boolean(selectBot(global, chat.id));
  const isLocal = isMessageLocal(message);
  const isFailed = isMessageFailed(message);
  const isServiceNotification = isServiceNotificationMessage(message);
  const isOwn = isOwnMessage(message);
  const isForwarded = isForwardedMessage(message);
  const isAction = isActionMessage(message);
  const hasTtl = hasMessageTtl(message);
  const { content } = message;
  const isDocumentSticker = isMessageDocumentSticker(message);
  const isBoostMessage = message.content.action?.type === 'chatBoost';

  const hasChatPinPermission = (chat.isCreator
    || (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
    || getHasAdminRight(chat, 'pinMessages'));

  const hasPinPermission = isPrivate || hasChatPinPermission;

  // https://github.com/telegramdesktop/tdesktop/blob/335095a332607c41a8d20b47e61f5bbd66366d4b/Telegram/SourceFiles/data/data_peer.cpp#L653
  const canEditMessagesIndefinitely = (() => {
    if (isPrivate) return isChatWithSelf;
    if (isBasicGroup) return false;
    if (isSuperGroup) return hasChatPinPermission;
    if (isChannel) return chat.isCreator || getHasAdminRight(chat, 'editMessages');
    return false;
  })();

  const isMessageEditable = (
    (
      canEditMessagesIndefinitely
      || getServerTime() - message.date < (global.config?.editTimeLimit || Infinity)
    ) && !(
      content.sticker || content.contact || content.pollId || content.action
      || (content.video?.isRound) || content.location || content.invoice || content.giveaway || content.giveawayResults
      || isDocumentSticker
    )
    && !isForwarded
    && !message.viaBotId
    && !chat.isForbidden
  );

  const isSavedDialog = getIsSavedDialog(chat.id, threadId, global.currentUserId);

  const canReply = selectCanReplyToMessage(global, message, threadId);
  const canReplyGlobally = canReply || (!isSavedDialog && !isLocal && !isServiceNotification
    && (isSuperGroup || isBasicGroup || isChatChannel(chat)));

  let canPin = !isLocal && !isServiceNotification && !isAction && hasPinPermission && !isSavedDialog;
  let canUnpin = false;

  const pinnedMessageIds = selectPinnedIds(global, chat.id, threadId);

  if (canPin) {
    canUnpin = Boolean(pinnedMessageIds && pinnedMessageIds.includes(message.id));
    canPin = !canUnpin;
  }

  const canNotDeleteBoostMessage = isBoostMessage && isOwn
    && !chat.isCreator && !getHasAdminRight(chat, 'deleteMessages');

  const canDelete = (!isLocal || isFailed) && !isServiceNotification && !canNotDeleteBoostMessage && (
    isPrivate
    || isOwn
    || isBasicGroup
    || chat.isCreator
    || getHasAdminRight(chat, 'deleteMessages')
  );

  const canReport = !isPrivate && !isOwn;

  const canDeleteForAll = canDelete && !chat.isForbidden && (
    (isPrivate && !isChatWithSelf && !isBotChat)
    || (isBasicGroup && (
      isOwn || getHasAdminRight(chat, 'deleteMessages') || chat.isCreator
    ))
  );

  const hasMessageEditRight = isOwn || (isChannel && (chat.isCreator || getHasAdminRight(chat, 'editMessages')));

  const canEdit = !isLocal && !isAction && isMessageEditable && hasMessageEditRight;

  const hasSticker = Boolean(message.content.sticker);
  const hasFavoriteSticker = hasSticker && selectIsStickerFavorite(global, message.content.sticker!);
  const canFaveSticker = !isAction && hasSticker && !hasFavoriteSticker;
  const canUnfaveSticker = !isAction && hasFavoriteSticker;
  const canCopy = !isAction;
  const canCopyLink = !isLocal && !isAction && (isChannel || isSuperGroup);
  const canSelect = !isLocal && !isAction;

  const canDownload = Boolean(content.webPage?.document || content.webPage?.video || content.webPage?.photo
      || content.audio || content.voice || content.photo || content.video || content.document || content.sticker)
    && !hasTtl;

  const canSaveGif = message.content.video?.isGif;

  const poll = content.pollId ? selectPoll(global, content.pollId) : undefined;
  const canRevote = !poll?.summary.closed && !poll?.summary.quiz && poll?.results.results?.some((r) => r.isChosen);
  const canClosePoll = hasMessageEditRight && poll && !poll.summary.closed && !isForwarded;

  const noOptions = [
    canReply,
    canReplyGlobally,
    canEdit,
    canPin,
    canUnpin,
    canReport,
    canDelete,
    canDeleteForAll,
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
    canReplyGlobally,
    canEdit,
    canPin,
    canUnpin,
    canReport,
    canDelete,
    canDeleteForAll,
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

export function selectCanDeleteMessages<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  messageIds: number[],
) {
  const chatMessages = selectChatMessages(global, chatId);

  if (messageIds.length > API_GENERAL_ID_LIMIT) {
    return {};
  }

  const messageActions = messageIds
    .map((id) => chatMessages[id] && selectAllowedMessageActionsSlow(global, chatMessages[id], threadId))
    .filter(Boolean);

  return {
    canDelete: messageActions.every((actions) => actions.canDelete),
    canDeleteForAll: messageActions.every((actions) => actions.canDeleteForAll),
  };
}

export function selectCanDeleteSelectedMessages<T extends GlobalState>(
  global: T,
  messageIds?: number[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds: selectedMessageIds } = selectTabState(global, tabId).selectedMessages || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  const messageIdList = messageIds?.length ? messageIds : selectedMessageIds;
  if (!chatId || !threadId || !messageIdList) {
    return {};
  }

  return selectCanDeleteMessages(global, chatId, threadId, messageIdList);
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
    .map((id) => chatMessages[id] && selectAllowedMessageActionsSlow(global, chatMessages[id], threadId))
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
    .map((id) => chatMessages[id] && selectAllowedMessageActionsSlow(global, chatMessages[id], threadId))
    .filter(Boolean);

  return messageActions.some((actions) => actions.canDownload);
}

export function selectActiveDownloads<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).activeDownloads;
}

export function selectUploadProgress<T extends GlobalState>(global: T, message: ApiMessage) {
  return global.fileUploads.byMessageKey[getMessageKey(message)]?.progress;
}

export function selectRealLastReadId<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  if (threadId === MAIN_THREAD_ID) {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return undefined;
    }

    // `lastReadInboxMessageId` is empty for new chats
    if (!chat.lastReadInboxMessageId) {
      return undefined;
    }

    const lastMessageId = selectChatLastMessageId(global, chatId);

    if (!lastMessageId || chat.unreadCount) {
      return chat.lastReadInboxMessageId;
    }

    return lastMessageId;
  } else {
    const threadInfo = selectThreadInfo(global, chatId, threadId);
    if (!threadInfo) {
      return undefined;
    }

    if (!threadInfo.lastReadInboxMessageId) {
      return Number(threadInfo.threadId);
    }

    // Some previously read messages may be deleted
    return Math.min(threadInfo.lastReadInboxMessageId, threadInfo.lastMessageId || Infinity);
  }
}

export function selectFirstUnreadId<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
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

  const outlyingLists = selectOutlyingLists(global, chatId, threadId);
  const listedIds = selectListedIds(global, chatId, threadId);
  const byId = selectChatMessages(global, chatId);
  if (!byId || !(outlyingLists?.length || listedIds)) {
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
        // For some reason outgoing topic actions are not marked as read, thus we need to mark them as read
        // when the edit message hits the viewport
        && ((!byId[id].isOutgoing || byId[id].content.action?.isTopicAction) || byId[id].isFromScheduled)
        && id > lastReadServiceNotificationId
      );
    });
  }

  if (outlyingLists?.length) {
    const found = outlyingLists.map((list) => findAfterLastReadId(list)).filter(Boolean)[0];
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

export function selectIsForwardModalOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { isShareMessageModalShown } = selectTabState(global, tabId);
  return Boolean(isShareMessageModalShown);
}

export function selectCommonBoxChatId<T extends GlobalState>(global: T, messageId: number) {
  const fromLastMessage = Object.values(global.chats.byId).find((chat) => (
    isCommonBoxChat(chat) && selectChatLastMessageId(global, chat.id) === messageId
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
  global: T, chatId: string, threadId: ThreadId = MAIN_THREAD_ID,
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

  const messageId = findLast(viewportIds, (id) => {
    const message = chatMessages[id];
    return message && selectShouldDisplayReplyKeyboard(global, message);
  });

  const replyHideMessageId = findLast(viewportIds, (id) => {
    const message = chatMessages[id];
    return message && selectShouldHideReplyKeyboard(global, message);
  });

  if (messageId && replyHideMessageId && replyHideMessageId > messageId) {
    return undefined;
  }

  return messageId ? chatMessages[messageId] : undefined;
}

function selectShouldHideReplyKeyboard<T extends GlobalState>(global: T, message: ApiMessage) {
  const {
    shouldHideKeyboardButtons,
    isHideKeyboardSelective,
    isMentioned,
  } = message;
  if (!shouldHideKeyboardButtons) return false;

  const replyToMessageId = getMessageReplyInfo(message)?.replyToMsgId;

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
  } = message;
  if (!keyboardButtons || shouldHideKeyboardButtons) return false;

  const replyToMessageId = getMessageReplyInfo(message)?.replyToMsgId;

  if (isKeyboardSelective) {
    if (isMentioned) return true;
    if (!replyToMessageId) return false;

    const replyMessage = selectChatMessage(global, message.chatId, replyToMessageId);
    return Boolean(replyMessage?.senderId === global.currentUserId);
  }

  return true;
}

export function selectCanAutoLoadMedia<T extends GlobalState>(
  global: T, message: ApiMessage | ApiSponsoredMessage,
) {
  const chat = selectChat(global, message.chatId);
  if (!chat) {
    return undefined;
  }

  const sender = 'id' in message ? selectSender(global, message) : undefined;

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
  sender?: ApiPeer;
}) {
  const isMediaFromContact = Boolean(sender && (
    selectIsChatWithSelf(global, sender.id) || selectUser(global, sender.id)?.isContact
  ));

  return Boolean(
    (isMediaFromContact && canAutoLoadMediaFromContacts)
    || (!isMediaFromContact && canAutoLoadMediaInPrivateChats && isUserId(chat.id))
    || (canAutoLoadMediaInGroups && isChatGroup(chat))
    || (canAutoLoadMediaInChannels && isChatChannel(chat)),
  );
}

export function selectLastServiceNotification<T extends GlobalState>(global: T) {
  const { serviceNotifications } = global;
  const maxId = Math.max(...serviceNotifications.map(({ id }) => id));

  return serviceNotifications.find(({ id, isDeleted }) => !isDeleted && id === maxId);
}

export function selectIsMessageProtected<T extends GlobalState>(global: T, message?: ApiMessage) {
  return Boolean(message && (
    message.isProtected || selectIsChatProtected(global, message.chatId) || hasMessageTtl(message)
    || getMessagePaidMedia(message)
  ));
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
    .every((message) => message && !hasMessageTtl(message)
      && (message.isForwardingAllowed || isServiceNotificationMessage(message)));
}

export function selectSponsoredMessage<T extends GlobalState>(global: T, chatId: string) {
  const message = global.messages.sponsoredByChatId[chatId];

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

  const chatReactions = selectChatFullInfo(global, chatId)?.enabledReactions;
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
  const chatBot = selectBot(global, id);
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

  return sets.reduce((acc, set) => {
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
    return Boolean(message.content.voice) || Boolean(message.content.video?.isRound);
  });
}

export function selectChatTranslations<T extends GlobalState>(
  global: T, chatId: string,
): ChatTranslatedMessages {
  return global.translations.byChatId[chatId];
}

export function selectMessageTranslations<T extends GlobalState>(
  global: T, chatId: string, toLanguageCode: string,
) {
  return selectChatTranslations(global, chatId)?.byLangCode[toLanguageCode] || {};
}

export function selectRequestedMessageTranslationLanguage<T extends GlobalState>(
  global: T, chatId: string, messageId: number, ...[tabId = getCurrentTabId()]: TabArgs<T>
): string | undefined {
  const requestedInChat = selectTabState(global, tabId).requestedTranslations.byChatId[chatId];
  return requestedInChat?.toLanguage || requestedInChat?.manualMessages?.[messageId];
}
export function selectReplyCanBeSentToChat<T extends GlobalState>(
  global: T,
  toChatId: string,
  fromChatId: string,
  replyInfo: ApiInputMessageReplyInfo,
) {
  if (!replyInfo.replyToMsgId) return false;
  const fromRealChatId = replyInfo?.replyToPeerId ?? fromChatId;
  if (toChatId === fromRealChatId) return true;
  const chatMessages = selectChatMessages(global, fromRealChatId!);
  const message = chatMessages[replyInfo.replyToMsgId];

  return !isExpiredMessage(message);
}
export function selectForwardsCanBeSentToChat<T extends GlobalState>(
  global: T,
  toChatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { messageIds, storyId, fromChatId } = selectTabState(global, tabId).forwardMessages;
  const chat = selectChat(global, toChatId);
  if ((!messageIds && !storyId) || !chat) return false;

  if (storyId) {
    return true;
  }

  const chatFullInfo = selectChatFullInfo(global, toChatId);
  const chatMessages = selectChatMessages(global, fromChatId!);
  const options = getAllowedAttachmentOptions(chat, chatFullInfo);
  return !messageIds!.some((messageId) => сheckMessageSendingDenied(chatMessages[messageId], options));
}
function сheckMessageSendingDenied(message: ApiMessage, options: IAllowedAttachmentOptions) {
  const isVoice = message.content.voice;
  const isRoundVideo = message.content.video?.isRound;
  const isPhoto = message.content.photo;
  const isGif = message.content.video?.isGif;
  const isVideo = message.content.video && !isRoundVideo && !isGif;
  const isAudio = message.content.audio;
  const isDocument = message.content.document;
  const isSticker = message.content.sticker;
  const isPlainText = message.content.text
    && !isVoice && !isRoundVideo && !isSticker && !isDocument && !isAudio && !isVideo && !isPhoto && !isGif;

  return (isVoice && !options.canSendVoices)
    || (isRoundVideo && !options.canSendRoundVideos)
    || (isSticker && !options.canSendStickers)
    || (isDocument && !options.canSendDocuments)
    || (isAudio && !options.canSendAudios)
    || (isVideo && !options.canSendVideos)
    || (isPhoto && !options.canSendPhotos)
    || (isGif && !options.canSendGifs)
    || (isPlainText && !options.canSendPlainText);
}

export function selectCanTranslateMessage<T extends GlobalState>(
  global: T, message: ApiMessage, detectedLanguage?: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { canTranslate: isTranslationEnabled, doNotTranslate } = global.settings.byKey;

  const canTranslateLanguage = !detectedLanguage || !doNotTranslate.includes(detectedLanguage);

  const isTranslatable = isMessageTranslatable(message);

  // Separate translations are disabled when chat translation enabled
  const chatRequestedLanguage = selectRequestedChatTranslationLanguage(global, message.chatId, tabId);

  return IS_TRANSLATION_SUPPORTED && isTranslationEnabled && canTranslateLanguage && isTranslatable
    && !chatRequestedLanguage;
}

export function selectTopicLink<T extends GlobalState>(
  global: T, chatId: string, topicId?: ThreadId,
) {
  const chat = selectChat(global, chatId);
  if (!chat || !chat?.isForum) {
    return undefined;
  }

  return getMessageLink(chat, topicId);
}

export function selectMessageReplyInfo<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, additionalReplyInfo?: ApiInputMessageReplyInfo,
) {
  const chat = selectChat(global, chatId);
  if (!chat) return undefined;
  const isMainThread = threadId === MAIN_THREAD_ID;
  if (!additionalReplyInfo && isMainThread) return undefined;

  const replyInfo: ApiInputMessageReplyInfo = {
    type: 'message',
    ...additionalReplyInfo,
    replyToMsgId: additionalReplyInfo?.replyToMsgId || Number(threadId),
    replyToTopId: additionalReplyInfo?.replyToTopId || (!isMainThread ? Number(threadId) : undefined),
  };

  return replyInfo;
}
