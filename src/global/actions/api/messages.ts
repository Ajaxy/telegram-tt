import type {
  ApiAttachment,
  ApiChat,
  ApiError,
  ApiInputMessageReplyInfo,
  ApiInputReplyInfo,
  ApiInputStoryReplyInfo,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiOnProgress,
  ApiPeer,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiVideo,
} from '../../../api/types';
import type { MessageKey } from '../../../util/messageKey';
import type { RequiredGlobalActions } from '../../index';
import type {
  ActionReturnType, ApiDraft, GlobalState, TabArgs,
} from '../../types';
import { MAIN_THREAD_ID, MESSAGE_DELETED } from '../../../api/types';
import { LoadMoreDirection, type ThreadId } from '../../../types';

import {
  GIF_MIME_TYPE,
  MAX_MEDIA_FILES_FOR_ALBUM,
  MESSAGE_LIST_SLICE,
  RE_TELEGRAM_LINK,
  SERVICE_NOTIFICATIONS_USER_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { copyTextToClipboard } from '../../../util/clipboard';
import { isDeepLink } from '../../../util/deepLinkParser';
import { ensureProtocol } from '../../../util/ensureProtocol';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import {
  areSortedArraysIntersecting,
  buildCollectionByKey,
  omit,
  partition,
  split,
  unique,
} from '../../../util/iteratees';
import { translate } from '../../../util/langProvider';
import { getMessageKey, isLocalMessageId } from '../../../util/messageKey';
import { debounce, onTickEnd, rafPromise } from '../../../util/schedulers';
import { IS_IOS } from '../../../util/windowEnvironment';
import { callApi, cancelApiProgress } from '../../../api/gramjs';
import {
  getIsSavedDialog,
  getUserFullName,
  isChatChannel,
  isChatSuperGroup,
  isDeletedUser,
  isMessageLocal,
  isServiceNotificationMessage,
  isUserBot,
} from '../../helpers';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addChats,
  addUsers,
  removeOutlyingList,
  removeRequestedMessageTranslation,
  replaceScheduledMessages,
  replaceSettings,
  replaceThreadParam,
  replaceUserStatuses,
  safeReplacePinnedIds,
  safeReplaceViewportIds,
  updateChat,
  updateChatFullInfo,
  updateChatMessage,
  updateListedIds,
  updateMessageTranslation,
  updateOutlyingLists,
  updateRequestedMessageTranslation,
  updateSponsoredMessage,
  updateThreadInfo,
  updateThreadUnreadFromForwardedMessage,
  updateTopic,
  updateUploadByMessageKey,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatFullInfo,
  selectChatLastMessageId,
  selectChatMessage,
  selectCurrentChat,
  selectCurrentMessageList,
  selectCurrentViewedStory,
  selectDraft,
  selectEditingId,
  selectEditingMessage,
  selectEditingScheduledId,
  selectFirstMessageId,
  selectFirstUnreadId,
  selectFocusedMessageId,
  selectForwardsCanBeSentToChat,
  selectForwardsContainVoiceMessages,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectLanguageCode,
  selectListedIds,
  selectMessageReplyInfo,
  selectNoWebPage,
  selectOutlyingListByMessageId,
  selectPeerStory,
  selectPinnedIds,
  selectRealLastReadId,
  selectScheduledMessage,
  selectSendAs,
  selectSponsoredMessage,
  selectTabState,
  selectThreadIdFromMessage,
  selectTranslationLanguage,
  selectUser,
  selectUserFullInfo,
  selectUserStatus,
  selectViewportIds,
} from '../../selectors';
import { deleteMessages } from '../apiUpdaters/messages';

const AUTOLOGIN_TOKEN_KEY = 'autologin_token';

const uploadProgressCallbacks = new Map<MessageKey, ApiOnProgress>();

const runDebouncedForMarkRead = debounce((cb) => cb(), 500, false);

addActionHandler('loadViewportMessages', (global, actions, payload): ActionReturnType => {
  const {
    direction = LoadMoreDirection.Around,
    isBudgetPreload = false,
    shouldForceRender = false,
    onLoaded,
    onError,
    tabId = getCurrentTabId(),
  } = payload || {};

  let { chatId, threadId } = payload || {};

  if (!chatId || !threadId) {
    const currentMessageList = selectCurrentMessageList(global, tabId);
    if (!currentMessageList) {
      onError?.();
      return;
    }

    chatId = currentMessageList.chatId;
    threadId = currentMessageList.threadId;
  }

  const chat = selectChat(global, chatId);
  // TODO Revise if `chat.isRestricted` check is needed
  if (!chat || chat.isRestricted) {
    onError?.();
    return;
  }

  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  const listedIds = selectListedIds(global, chatId, threadId);

  if (!viewportIds || !viewportIds.length || direction === LoadMoreDirection.Around) {
    const offsetId = selectFocusedMessageId(global, chatId, tabId) || selectRealLastReadId(global, chatId, threadId);
    const isOutlying = Boolean(offsetId && listedIds && !listedIds.includes(offsetId));
    const historyIds = (isOutlying
      ? selectOutlyingListByMessageId(global, chatId, threadId, offsetId!)
      : listedIds) || [];
    const {
      newViewportIds, areSomeLocal, areAllLocal,
    } = getViewportSlice(historyIds, offsetId, LoadMoreDirection.Around);

    if (areSomeLocal) {
      global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds, tabId);
    }

    if (!areAllLocal) {
      onTickEnd(() => {
        void loadViewportMessages(
          global, chat, threadId!, offsetId, LoadMoreDirection.Around, isOutlying, isBudgetPreload, onLoaded, tabId,
        );
      });
    } else {
      onLoaded?.();
    }
  } else {
    const offsetId = direction === LoadMoreDirection.Backwards ? viewportIds[0] : viewportIds[viewportIds.length - 1];

    // Prevent requests with local offsets
    if (isLocalMessageId(offsetId)) return;

    // Prevent unnecessary requests in threads
    if (offsetId === threadId && direction === LoadMoreDirection.Backwards) return;

    const isOutlying = Boolean(listedIds && !listedIds.includes(offsetId));
    const historyIds = (isOutlying
      ? selectOutlyingListByMessageId(global, chatId, threadId, offsetId) : listedIds)!;
    const {
      newViewportIds, areSomeLocal, areAllLocal,
    } = getViewportSlice(historyIds, offsetId, direction);

    if (areSomeLocal) {
      global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds, tabId);
    }

    onTickEnd(() => {
      void loadWithBudget(
        global,
        actions,
        areAllLocal,
        isOutlying,
        isBudgetPreload,
        chat,
        threadId!,
        direction,
        offsetId,
        onLoaded,
        tabId,
      );
    });

    if (isBudgetPreload) {
      return;
    }
  }

  setGlobal(global, { forceOnHeavyAnimation: shouldForceRender });
});

async function loadWithBudget<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  areAllLocal: boolean, isOutlying: boolean, isBudgetPreload: boolean,
  chat: ApiChat, threadId: ThreadId, direction: LoadMoreDirection, offsetId?: number,
  onLoaded?: NoneToVoidFunction,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (!areAllLocal) {
    await loadViewportMessages(
      global, chat, threadId, offsetId, direction, isOutlying, isBudgetPreload, onLoaded, tabId,
    );
  }

  if (!isBudgetPreload) {
    actions.loadViewportMessages({
      chatId: chat.id, threadId, direction, isBudgetPreload: true, onLoaded, tabId,
    });
  }
}

addActionHandler('loadMessage', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, replyOriginForId, threadUpdate,
  } = payload!;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const message = await loadMessage(global, chat, messageId, replyOriginForId);
  if (message && threadUpdate) {
    const { lastMessageId, isDeleting } = threadUpdate;
    global = getGlobal();

    global = updateThreadUnreadFromForwardedMessage(
      global,
      message,
      chatId,
      lastMessageId,
      isDeleting,
    );
    setGlobal(global);
  }
});

addActionHandler('sendMessage', (global, actions, payload): ActionReturnType => {
  const { messageList, tabId = getCurrentTabId() } = payload;

  const { storyId, peerId: storyPeerId } = selectCurrentViewedStory(global, tabId);
  const isStoryReply = Boolean(storyId && storyPeerId);

  if (!messageList && !isStoryReply) {
    return undefined;
  }

  let { chatId, threadId, type } = messageList || {};
  if (isStoryReply) {
    chatId = storyPeerId!;
    threadId = MAIN_THREAD_ID;
    type = 'thread';
  }

  payload = omit(payload, ['tabId']);

  if (type === 'scheduled' && !payload.scheduledAt) {
    return updateTabState(global, {
      contentToBeScheduled: payload,
    }, tabId);
  }

  const chat = selectChat(global, chatId!)!;
  const draft = selectDraft(global, chatId!, threadId!);
  const draftReplyInfo = !isStoryReply ? draft?.replyInfo : undefined;

  const storyReplyInfo = isStoryReply ? {
    type: 'story',
    peerId: storyPeerId!,
    storyId: storyId!,
  } satisfies ApiInputStoryReplyInfo : undefined;

  const messageReplyInfo = selectMessageReplyInfo(global, chatId!, threadId!, draftReplyInfo);

  const replyInfo = storyReplyInfo || messageReplyInfo;
  const lastMessageId = selectChatLastMessageId(global, chatId!);

  const params = {
    ...payload,
    chat,
    replyInfo,
    noWebPage: selectNoWebPage(global, chatId!, threadId!),
    sendAs: selectSendAs(global, chatId!),
    lastMessageId,
  };

  if (!isStoryReply) {
    actions.clearWebPagePreview({ tabId });
  }

  const isSingle = !payload.attachments || payload.attachments.length <= 1;
  const isGrouped = !isSingle && payload.shouldGroupMessages;

  if (isSingle) {
    const { attachments, ...restParams } = params;
    sendMessage(global, {
      ...restParams,
      attachment: attachments ? attachments[0] : undefined,
      wasDrafted: Boolean(draft),
    });
  } else if (isGrouped) {
    const {
      text, entities, attachments, ...commonParams
    } = params;
    const byType = splitAttachmentsByType(attachments!);

    byType.forEach((group, groupIndex) => {
      const groupedAttachments = split(group as ApiAttachment[], MAX_MEDIA_FILES_FOR_ALBUM);
      for (let i = 0; i < groupedAttachments.length; i++) {
        const [firstAttachment, ...restAttachments] = groupedAttachments[i];
        const groupedId = `${Date.now()}${groupIndex}${i}`;

        const isFirst = i === 0 && groupIndex === 0;

        sendMessage(global, {
          ...commonParams,
          text: isFirst ? text : undefined,
          entities: isFirst ? entities : undefined,
          attachment: firstAttachment,
          groupedId: restAttachments.length > 0 ? groupedId : undefined,
          wasDrafted: Boolean(draft),
        });

        restAttachments.forEach((attachment: ApiAttachment) => {
          sendMessage(global, {
            ...commonParams,
            attachment,
            groupedId,
          });
        });
      }
    });
  } else {
    const {
      text, entities, attachments, replyInfo: replyToForFirstMessage, ...commonParams
    } = params;

    if (text) {
      sendMessage(global, {
        ...commonParams,
        text,
        entities,
        replyInfo: replyToForFirstMessage,
        wasDrafted: Boolean(draft),
      });
    }

    attachments?.forEach((attachment: ApiAttachment) => {
      sendMessage(global, {
        ...commonParams,
        attachment,
      });
    });
  }

  return undefined;
});

addActionHandler('sendInviteMessages', async (global, actions, payload): Promise<void> => {
  const { chatId, userIds, tabId = getCurrentTabId() } = payload;
  const chatFullInfo = selectChatFullInfo(global, chatId);
  if (!chatFullInfo?.inviteLink) {
    return undefined;
  }
  const userFullNames: string[] = [];
  await Promise.all(userIds.map((userId) => {
    const chat = selectChat(global, userId);
    if (!chat) {
      return undefined;
    }
    const userFullName = getUserFullName(selectUser(global, userId));
    if (userFullName) {
      userFullNames.push(userFullName);
    }
    return sendMessage(global, {
      chat,
      text: chatFullInfo.inviteLink,
    });
  }));
  return actions.showNotification({
    message: translate('Conversation.ShareLinkTooltip.Chat.One', userFullNames.join(', ')),
    tabId,
  });
});

addActionHandler('editMessage', (global, actions, payload): ActionReturnType => {
  const {
    messageList, text, entities, attachments, tabId = getCurrentTabId(),
  } = payload;

  if (!messageList) {
    return;
  }

  let currentMessageKey: MessageKey | undefined;
  const progressCallback = attachments ? (progress: number, messageKey: MessageKey) => {
    if (!uploadProgressCallbacks.has(messageKey)) {
      currentMessageKey = messageKey;
      uploadProgressCallbacks.set(messageKey, progressCallback!);
    }

    global = getGlobal();
    global = updateUploadByMessageKey(global, messageKey, progress);
    setGlobal(global);
  } : undefined;

  const { chatId, threadId, type: messageListType } = messageList;
  const chat = selectChat(global, chatId);
  const message = selectEditingMessage(global, chatId, threadId, messageListType);
  if (!chat || !message) {
    return;
  }

  actions.setEditingId({ messageId: undefined, tabId });

  (async () => {
    await callApi('editMessage', {
      chat,
      message,
      attachment: attachments ? attachments[0] : undefined,
      text,
      entities,
      noWebPage: selectNoWebPage(global, chatId, threadId),
    }, progressCallback);

    if (progressCallback && currentMessageKey) {
      global = getGlobal();
      global = updateUploadByMessageKey(global, currentMessageKey, undefined);
      setGlobal(global);

      uploadProgressCallbacks.delete(currentMessageKey);
    }
  })();
});

addActionHandler('cancelUploadMedia', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId } = payload!;

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return;

  const progressCallback = message && uploadProgressCallbacks.get(getMessageKey(message));
  if (progressCallback) {
    cancelApiProgress(progressCallback);
  }

  if (isMessageLocal(message)) {
    actions.apiUpdate({
      '@type': 'deleteMessages',
      ids: [messageId],
      chatId,
    });
  }
});

addActionHandler('saveDraft', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId, text,
  } = payload;
  if (!text) {
    return;
  }

  const currentDraft = selectDraft(global, chatId, threadId);

  const newDraft: ApiDraft = {
    text,
    replyInfo: currentDraft?.replyInfo,
  };

  saveDraft({
    global, chatId, threadId, draft: newDraft,
  });
});

addActionHandler('clearDraft', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId = MAIN_THREAD_ID, isLocalOnly, shouldKeepReply,
  } = payload;
  const currentDraft = selectDraft(global, chatId, threadId);
  if (!currentDraft) {
    return;
  }

  const currentReplyInfo = currentDraft.replyInfo;

  const newDraft: ApiDraft | undefined = shouldKeepReply && currentReplyInfo ? {
    replyInfo: currentReplyInfo,
  } : undefined;

  saveDraft({
    global, chatId, threadId, draft: newDraft, isLocalOnly,
  });
});

addActionHandler('updateDraftReplyInfo', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), ...update } = payload;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId } = currentMessageList;

  const currentDraft = selectDraft(global, chatId, threadId);

  const updatedReplyInfo = {
    type: 'message',
    ...currentDraft?.replyInfo,
    ...update,
  } as ApiInputMessageReplyInfo;

  if (!updatedReplyInfo.replyToMsgId) return;

  const newDraft: ApiDraft = {
    ...currentDraft,
    replyInfo: updatedReplyInfo,
  };

  saveDraft({
    global, chatId, threadId, draft: newDraft, isLocalOnly: true, noLocalTimeUpdate: true,
  });
});

addActionHandler('resetDraftReplyInfo', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }
  const { chatId, threadId } = currentMessageList;

  const currentDraft = selectDraft(global, chatId, threadId);
  const newDraft: ApiDraft | undefined = !currentDraft?.text ? undefined : {
    ...currentDraft,
    replyInfo: undefined,
  };

  saveDraft({
    global, chatId, threadId, draft: newDraft, isLocalOnly: Boolean(newDraft),
  });
});

async function saveDraft<T extends GlobalState>({
  global, chatId, threadId, draft, isLocalOnly, noLocalTimeUpdate,
} : {
  global: T; chatId: string; threadId: ThreadId; draft?: ApiDraft; isLocalOnly?: boolean; noLocalTimeUpdate?: boolean;
}) {
  const chat = selectChat(global, chatId);
  const user = selectUser(global, chatId);
  if (!chat || (user && isDeletedUser(user))) return;

  const replyInfo = selectMessageReplyInfo(global, chatId, threadId, draft?.replyInfo);

  const newDraft: ApiDraft | undefined = draft ? {
    ...draft,
    replyInfo,
    date: Math.floor(Date.now() / 1000),
    isLocal: true,
  } : undefined;

  global = replaceThreadParam(global, chatId, threadId, 'draft', newDraft);
  if (!noLocalTimeUpdate) {
    global = updateChat(global, chatId, { draftDate: newDraft?.date });
  }

  setGlobal(global);

  if (isLocalOnly) return;

  const result = await callApi('saveDraft', {
    chat,
    draft: newDraft,
  });

  if (result && newDraft) {
    newDraft.isLocal = false;
  }

  global = getGlobal();
  global = replaceThreadParam(global, chatId, threadId, 'draft', newDraft);
  global = updateChat(global, chatId, { draftDate: newDraft?.date });

  setGlobal(global);
}

addActionHandler('toggleMessageWebPage', (global, actions, payload): ActionReturnType => {
  const { chatId, threadId, noWebPage } = payload!;

  return replaceThreadParam(global, chatId, threadId, 'noWebPage', noWebPage);
});

addActionHandler('pinMessage', (global, actions, payload): ActionReturnType => {
  const {
    messageId, isUnpin, isOneSide, isSilent, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectCurrentChat(global, tabId);
  if (!chat) {
    return;
  }

  void callApi('pinMessage', {
    chat, messageId, isUnpin, isOneSide, isSilent,
  });
});

addActionHandler('unpinAllMessages', async (global, actions, payload): Promise<void> => {
  const { chatId, threadId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  await callApi('unpinAllMessages', { chat, threadId });

  global = getGlobal();
  const pinnedIds = selectPinnedIds(global, chatId, threadId);
  pinnedIds?.forEach((id) => {
    global = updateChatMessage(global, chatId, id, { isPinned: false });
  });
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'pinnedIds', []);
  setGlobal(global);
});

addActionHandler('deleteMessages', (global, actions, payload): ActionReturnType => {
  const { messageIds, shouldDeleteForAll, tabId = getCurrentTabId() } = payload!;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }
  const { chatId, threadId } = currentMessageList;
  const chat = selectChat(global, chatId)!;
  const messageIdsToDelete = messageIds.filter((id) => {
    const message = selectChatMessage(global, chatId, id);
    return message && !isMessageLocal(message);
  });

  // Only local messages
  if (!messageIdsToDelete.length && messageIds.length) {
    deleteMessages(global, isChatChannel(chat) ? chatId : undefined, messageIds, actions);
    return;
  }

  void callApi('deleteMessages', { chat, messageIds: messageIdsToDelete, shouldDeleteForAll });

  const editingId = selectEditingId(global, chatId, threadId);
  if (editingId && messageIds.includes(editingId)) {
    actions.setEditingId({ messageId: undefined, tabId });
  }
});

addActionHandler('deleteScheduledMessages', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }

  const { chatId } = currentMessageList;
  const chat = selectChat(global, chatId)!;

  void callApi('deleteScheduledMessages', { chat, messageIds });

  const editingId = selectEditingScheduledId(global, chatId);
  if (editingId && messageIds.includes(editingId)) {
    actions.setEditingId({ messageId: undefined, tabId });
  }
});

addActionHandler('deleteHistory', async (global, actions, payload): Promise<void> => {
  const { chatId, shouldDeleteForAll, tabId = getCurrentTabId() } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  await callApi('deleteHistory', { chat, shouldDeleteForAll });

  global = getGlobal();
  const activeChat = selectCurrentMessageList(global, tabId);
  if (activeChat && activeChat.chatId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }

  // Delete chat from folders
  const folders = global.chatFolders.byId;
  Object.values(folders).forEach((folder) => {
    if (folder.includedChatIds.includes(chatId) || folder.pinnedChatIds?.includes(chatId)) {
      const newIncludedChatIds = folder.includedChatIds.filter((id) => id !== chatId);
      const newPinnedChatIds = folder.pinnedChatIds?.filter((id) => id !== chatId);

      const updatedFolder = {
        ...folder,
        includedChatIds: newIncludedChatIds,
        pinnedChatIds: newPinnedChatIds,
      };

      callApi('editChatFolder', {
        id: folder.id,
        folderUpdate: updatedFolder,
      });
    }
  });
});

addActionHandler('deleteSavedHistory', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  await callApi('deleteSavedHistory', { chat });

  global = getGlobal();
  const activeChat = selectCurrentMessageList(global, tabId);
  if (activeChat && activeChat.threadId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }
});

addActionHandler('reportMessages', async (global, actions, payload): Promise<void> => {
  const {
    messageIds, reason, description, tabId = getCurrentTabId(),
  } = payload!;
  const currentMessageList = selectCurrentMessageList(global, tabId);
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
      ? translate('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
    tabId,
  });
});

addActionHandler('sendMessageAction', async (global, actions, payload): Promise<void> => {
  const { action, chatId, threadId } = payload!;
  if (global.connectionState !== 'connectionStateReady') return;
  if (selectIsChatWithSelf(global, chatId)) return;

  const chat = selectChat(global, chatId)!;
  if (!chat) return;
  const user = selectUser(global, chatId);
  if (user && (isUserBot(user) || isDeletedUser(user))) return;

  await callApi('sendMessageAction', {
    peer: chat, threadId, action,
  });
});

addActionHandler('markMessageListRead', (global, actions, payload): ActionReturnType => {
  const { maxId, tabId = getCurrentTabId() } = payload!;

  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return undefined;
  }

  const { chatId, threadId } = currentMessageList;
  const chat = selectChat(global, chatId);
  if (!chat || getIsSavedDialog(chatId, threadId, global.currentUserId)) {
    return undefined;
  }

  runDebouncedForMarkRead(() => {
    void callApi('markMessageListRead', {
      chat, threadId, maxId,
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

  const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
  const minId = selectFirstUnreadId(global, chatId, threadId);

  if (threadId !== MAIN_THREAD_ID && !chat.isForum) {
    global = updateThreadInfo(global, chatId, threadId, {
      lastReadInboxMessageId: maxId,
    });
    return global;
  }

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
    return updateTopic(global, chatId, Number(threadId), {
      unreadCount: newTopicUnreadCount,
    });
  }

  return updateChat(global, chatId, {
    lastReadInboxMessageId: maxId,
    unreadCount: Math.max(0, chat.unreadCount - readCount),
  });
});

addActionHandler('markMessagesRead', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload!;

  const chat = selectCurrentChat(global, tabId);
  if (!chat) {
    return;
  }

  void callApi('markMessagesRead', { chat, messageIds });
});

addActionHandler('loadWebPagePreview', async (global, actions, payload): Promise<void> => {
  const { text, tabId = getCurrentTabId() } = payload;

  const webPagePreview = await callApi('fetchWebPagePreview', { text });

  global = getGlobal();
  global = updateTabState(global, {
    webPagePreview,
  }, tabId);
  setGlobal(global);
});

addActionHandler('clearWebPagePreview', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (!selectTabState(global, tabId).webPagePreview) {
    return undefined;
  }

  return updateTabState(global, {
    webPagePreview: undefined,
  }, tabId);
});

addActionHandler('sendPollVote', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, options } = payload!;
  const chat = selectChat(global, chatId);

  if (chat) {
    void callApi('sendPollVote', { chat, messageId, options });
  }
});

addActionHandler('cancelPollVote', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId } = payload!;
  const chat = selectChat(global, chatId);

  if (chat) {
    void callApi('sendPollVote', { chat, messageId, options: [] });
  }
});

addActionHandler('closePoll', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  const poll = selectChatMessage(global, chatId, messageId)?.content.poll;
  if (chat && poll) {
    void callApi('closePoll', { chat, messageId, poll });
  }
});

addActionHandler('loadPollOptionResults', async (global, actions, payload): Promise<void> => {
  const {
    chat, messageId, option, offset, limit, shouldResetVoters, tabId = getCurrentTabId(),
  } = payload!;

  const result = await callApi('loadPollOptionResults', {
    chat, messageId, option, offset, limit,
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));

  const tabState = selectTabState(global, tabId);
  const { pollResults } = tabState;
  const { voters } = tabState.pollResults;

  global = updateTabState(global, {
    pollResults: {
      ...pollResults,
      voters: {
        ...voters,
        [option]: unique([
          ...(!shouldResetVoters && voters?.[option] ? voters[option] : []),
          ...result.votes.map((vote) => vote.peerId),
        ]),
      },
      offsets: {
        ...(pollResults.offsets ? pollResults.offsets : {}),
        [option]: result.nextOffset || '',
      },
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadExtendedMedia', (global, actions, payload): ActionReturnType => {
  const { chatId, ids } = payload;
  const chat = selectChat(global, chatId);
  if (chat) {
    void callApi('fetchExtendedMedia', { chat, ids });
  }
});

addActionHandler('forwardMessages', (global, actions, payload): ActionReturnType => {
  const {
    isSilent, scheduledAt, tabId = getCurrentTabId(),
  } = payload;

  const {
    fromChatId, messageIds, toChatId, withMyScore, noAuthors, noCaptions, toThreadId = MAIN_THREAD_ID,
  } = selectTabState(global, tabId).forwardMessages;

  const isCurrentUserPremium = selectIsCurrentUserPremium(global);
  const isToMainThread = toThreadId === MAIN_THREAD_ID;

  const fromChat = fromChatId ? selectChat(global, fromChatId) : undefined;
  const toChat = toChatId ? selectChat(global, toChatId) : undefined;

  const messages = fromChatId && messageIds
    ? messageIds
      .sort((a, b) => a - b)
      .map((id) => selectChatMessage(global, fromChatId, id)).filter(Boolean)
    : undefined;

  if (!fromChat || !toChat || !messages || (toThreadId && !isToMainThread && !toChat.isForum)) {
    return;
  }

  const sendAs = selectSendAs(global, toChatId!);
  const draft = selectDraft(global, toChatId!, toThreadId || MAIN_THREAD_ID);
  const lastMessageId = selectChatLastMessageId(global, toChat.id);

  const [realMessages, serviceMessages] = partition(messages, (m) => !isServiceNotificationMessage(m));
  if (realMessages.length) {
    (async () => {
      await rafPromise(); // Wait one frame for any previous `sendMessage` to be processed
      callApi('forwardMessages', {
        fromChat,
        toChat,
        toThreadId,
        messages: realMessages,
        isSilent,
        scheduledAt,
        sendAs,
        withMyScore,
        noAuthors,
        noCaptions,
        isCurrentUserPremium,
        wasDrafted: Boolean(draft),
        lastMessageId,
      });
    })();
  }

  serviceMessages
    .forEach((message) => {
      const { text, entities } = message.content.text || {};
      const { sticker, poll } = message.content;

      const replyInfo = selectMessageReplyInfo(global, toChat.id, toThreadId);

      void sendMessage(global, {
        chat: toChat,
        replyInfo,
        text,
        entities,
        sticker,
        poll,
        isSilent,
        scheduledAt,
        sendAs,
        lastMessageId,
      });
    });

  global = getGlobal();
  global = updateTabState(global, {
    forwardMessages: {},
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadScheduledHistory', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchScheduledHistory', { chat });
  if (!result) {
    return;
  }

  const { messages } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  global = getGlobal();
  global = replaceScheduledMessages(global, chat.id, byId);
  global = replaceThreadParam(global, chat.id, MAIN_THREAD_ID, 'scheduledIds', ids);
  if (chat?.isForum) {
    const scheduledPerThread: Record<ThreadId, number[]> = {};
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
});

addActionHandler('sendScheduledMessages', (global, actions, payload): ActionReturnType => {
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

addActionHandler('rescheduleMessage', (global, actions, payload): ActionReturnType => {
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

addActionHandler('transcribeAudio', async (global, actions, payload): Promise<void> => {
  const { messageId, chatId } = payload;

  const chat = selectChat(global, chatId);

  if (!chat) return;

  global = updateChatMessage(global, chatId, messageId, {
    transcriptionId: '',
  });

  setGlobal(global);

  const result = await callApi('transcribeAudio', { chat, messageId });

  global = getGlobal();
  global = updateChatMessage(global, chatId, messageId, {
    transcriptionId: result,
    isTranscriptionError: !result,
  });

  setGlobal(global);
});

addActionHandler('loadCustomEmojis', async (global, actions, payload): Promise<void> => {
  const { ids, ignoreCache } = payload;
  const newCustomEmojiIds = ignoreCache ? ids
    : unique(ids.filter((documentId) => !global.customEmojis.byId[documentId]));
  const customEmoji = await callApi('fetchCustomEmoji', {
    documentId: newCustomEmojiIds,
  });
  if (!customEmoji) return;

  global = getGlobal();
  global = {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(customEmoji, 'id'),
      },
    },
  };
  setGlobal(global);
});

async function loadViewportMessages<T extends GlobalState>(
  global: T,
  chat: ApiChat,
  threadId: ThreadId,
  offsetId: number | undefined,
  direction: LoadMoreDirection,
  isOutlying = false,
  isBudgetPreload = false,
  onLoaded?: NoneToVoidFunction,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const chatId = chat.id;

  let addOffset: number | undefined;
  let sliceSize = MESSAGE_LIST_SLICE;
  switch (direction) {
    case LoadMoreDirection.Backwards:
      if (offsetId) {
        addOffset = -1;
        sliceSize += 1;
      } else {
        addOffset = undefined;
      }
      break;
    case LoadMoreDirection.Around:
      addOffset = -(Math.round(MESSAGE_LIST_SLICE / 2) + 1);
      break;
    case LoadMoreDirection.Forwards:
      addOffset = -(MESSAGE_LIST_SLICE + 1);
      if (offsetId) {
        sliceSize += 1;
      }
      break;
  }

  global = getGlobal();

  const currentUserId = global.currentUserId!;
  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const result = await callApi('fetchMessages', {
    chat: selectChat(global, realChatId)!,
    offsetId,
    addOffset,
    limit: sliceSize,
    threadId,
    isSavedDialog,
  });

  if (!result) {
    return;
  }

  const {
    messages, users, chats, count,
  } = result;

  global = getGlobal();

  const localMessages = chatId === SERVICE_NOTIFICATIONS_USER_ID
    ? global.serviceNotifications.filter(({ isDeleted }) => !isDeleted).map(({ message }) => message)
    : [];
  const allMessages = ([] as ApiMessage[]).concat(messages, localMessages);
  const byId = buildCollectionByKey(allMessages, 'id');
  const ids = Object.keys(byId).map(Number);

  if (threadId !== MAIN_THREAD_ID && !getIsSavedDialog(chatId, threadId, global.currentUserId)) {
    const threadFirstMessageId = selectFirstMessageId(global, chatId, threadId);
    if ((!ids[0] || threadFirstMessageId === ids[0]) && threadFirstMessageId !== threadId) {
      ids.unshift(Number(threadId));
    }
  }

  global = addChatMessagesById(global, chatId, byId);
  global = isOutlying
    ? updateOutlyingLists(global, chatId, threadId, ids)
    : updateListedIds(global, chatId, threadId, ids);

  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));

  let listedIds = selectListedIds(global, chatId, threadId);
  const outlyingList = offsetId ? selectOutlyingListByMessageId(global, chatId, threadId, offsetId) : undefined;

  if (isOutlying && listedIds && outlyingList) {
    if (!outlyingList.length || areSortedArraysIntersecting(listedIds, outlyingList)) {
      global = updateListedIds(global, chatId, threadId, outlyingList);
      listedIds = selectListedIds(global, chatId, threadId);
      global = removeOutlyingList(global, chatId, threadId, outlyingList);
      isOutlying = false;
    }
  }

  if (!isBudgetPreload) {
    const historyIds = isOutlying && outlyingList ? outlyingList : listedIds;
    if (historyIds) {
      const { newViewportIds } = getViewportSlice(historyIds, offsetId, direction);
      global = safeReplaceViewportIds(global, chatId, threadId, newViewportIds!, tabId);
    }
  }

  if (count) {
    global = updateThreadInfo(global, chat.id, threadId, {
      messagesCount: count,
    });
  }

  setGlobal(global);
  onLoaded?.();
}

async function loadMessage<T extends GlobalState>(
  global: T, chat: ApiChat, messageId: number, replyOriginForId?: number,
) {
  const result = await callApi('fetchMessage', { chat, messageId });
  if (!result) {
    return undefined;
  }

  if (result === MESSAGE_DELETED) {
    if (replyOriginForId) {
      global = getGlobal();
      const replyMessage = selectChatMessage(global, chat.id, replyOriginForId);
      global = updateChatMessage(global, chat.id, replyOriginForId, {
        ...replyMessage,
        replyInfo: undefined,
      });
      setGlobal(global);
    }

    return undefined;
  }

  global = getGlobal();
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
  const isAround = direction === LoadMoreDirection.Around;
  const indexForDirection = isBackwards ? index : (index + 1) || length;
  const sliceSize = isAround ? Math.round(MESSAGE_LIST_SLICE / 2) : MESSAGE_LIST_SLICE;
  const from = indexForDirection - sliceSize;
  const to = indexForDirection + sliceSize - 1;
  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  let areSomeLocal;
  let areAllLocal;
  switch (direction) {
    case LoadMoreDirection.Backwards:
      areSomeLocal = indexForDirection >= 0;
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

async function sendMessage<T extends GlobalState>(global: T, params: {
  chat: ApiChat;
  text?: string;
  entities?: ApiMessageEntity[];
  replyInfo?: ApiInputReplyInfo;
  attachment?: ApiAttachment;
  sticker?: ApiSticker;
  story?: ApiStory | ApiStorySkipped;
  gif?: ApiVideo;
  poll?: ApiNewPoll;
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiPeer;
  groupedId?: string;
  wasDrafted?: boolean;
  lastMessageId?: number;
}) {
  let currentMessageKey: MessageKey | undefined;
  const progressCallback = params.attachment ? (progress: number, messageKey: MessageKey) => {
    if (!uploadProgressCallbacks.has(messageKey)) {
      currentMessageKey = messageKey;
      uploadProgressCallbacks.set(messageKey, progressCallback!);
    }

    global = getGlobal();
    global = updateUploadByMessageKey(global, messageKey, progress);
    setGlobal(global);
  } : undefined;

  // @optimization
  if (params.replyInfo || IS_IOS) {
    await rafPromise();
  }

  await callApi('sendMessage', params, progressCallback);

  if (progressCallback && currentMessageKey) {
    global = getGlobal();
    global = updateUploadByMessageKey(global, currentMessageKey, undefined);
    setGlobal(global);

    uploadProgressCallbacks.delete(currentMessageKey);
  }
}

addActionHandler('loadPinnedMessages', async (global, actions, payload): Promise<void> => {
  const { chatId, threadId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat || getIsSavedDialog(chatId, threadId, global.currentUserId)) {
    return;
  }

  const result = await callApi('fetchPinnedMessages', { chat, threadId });
  if (!result) {
    return;
  }

  const { messages, chats, users } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number).sort((a, b) => b - a);

  global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = safeReplacePinnedIds(global, chat.id, threadId, ids);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));
  setGlobal(global);
});

addActionHandler('loadSeenBy', async (global, actions, payload): Promise<void> => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchSeenBy', { chat, messageId });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateChatMessage(global, chatId, messageId, {
    seenByDates: result,
  });
  setGlobal(global);
});

addActionHandler('saveDefaultSendAs', (global, actions, payload): ActionReturnType => {
  const { chatId, sendAsId } = payload;
  const chat = selectChat(global, chatId);
  const sendAsChat = selectChat(global, sendAsId) || selectUser(global, sendAsId);
  if (!chat || !sendAsChat) {
    return undefined;
  }

  void callApi('saveDefaultSendAs', { sendAs: sendAsChat, chat });

  return updateChatFullInfo(global, chatId, { sendAsId });
});

addActionHandler('loadSendAs', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchSendAs', { chat });
  if (!result) {
    global = getGlobal();
    global = updateChat(global, chatId, {
      sendAsPeerIds: [],
    });
    setGlobal(global);

    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = updateChat(global, chatId, { sendAsPeerIds: result.sendAs });
  setGlobal(global);
});

addActionHandler('loadSponsoredMessages', async (global, actions, payload): Promise<void> => {
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

addActionHandler('viewSponsoredMessage', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  const message = selectSponsoredMessage(global, chatId);
  if (!chat || !message) {
    return;
  }

  void callApi('viewSponsoredMessage', { chat, random: message.randomId });
});

addActionHandler('clickSponsoredMessage', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  const message = selectSponsoredMessage(global, chatId);
  if (!chat || !message) {
    return;
  }

  void callApi('clickSponsoredMessage', { chat, random: message.randomId });
});

addActionHandler('fetchUnreadMentions', async (global, actions, payload): Promise<void> => {
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

addActionHandler('markMentionsRead', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload;

  const chat = selectCurrentChat(global, tabId);
  if (!chat) return;

  const unreadMentions = (chat.unreadMentions || []).filter((id) => !messageIds.includes(id));
  global = updateChat(global, chat.id, {
    unreadMentions,
  });

  setGlobal(global);

  actions.markMessagesRead({ messageIds, tabId });
});

addActionHandler('focusNextMention', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const chat = selectCurrentChat(global, tabId);

  if (!chat?.unreadMentions) return;

  actions.focusMessage({ chatId: chat.id, messageId: chat.unreadMentions[0], tabId });
});

addActionHandler('readAllMentions', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const chat = selectCurrentChat(global, tabId);
  if (!chat) return undefined;

  callApi('readAllMentions', { chat });

  return updateChat(global, chat.id, {
    unreadMentionsCount: undefined,
    unreadMentions: undefined,
  });
});

addActionHandler('openUrl', (global, actions, payload): ActionReturnType => {
  const { url, shouldSkipModal, tabId = getCurrentTabId() } = payload;
  const urlWithProtocol = ensureProtocol(url)!;
  const isStoriesViewerOpen = Boolean(selectTabState(global, tabId).storyViewer.peerId);

  if (isDeepLink(urlWithProtocol)) {
    if (isStoriesViewerOpen) {
      actions.closeStoryViewer({ tabId });
    }

    actions.openTelegramLink({ url, tabId });
    return;
  }

  const { appConfig, config } = global;
  if (appConfig) {
    const parsedUrl = new URL(urlWithProtocol);

    if (config?.autologinToken && appConfig.autologinDomains.includes(parsedUrl.hostname)) {
      parsedUrl.searchParams.set(AUTOLOGIN_TOKEN_KEY, config.autologinToken);
      window.open(parsedUrl.href, '_blank', 'noopener');
      return;
    }

    if (appConfig.urlAuthDomains.includes(parsedUrl.hostname)) {
      if (isStoriesViewerOpen) {
        actions.closeStoryViewer({ tabId });
      }

      actions.requestLinkUrlAuth({ url, tabId });
      return;
    }
  }

  const shouldDisplayModal = !urlWithProtocol.match(RE_TELEGRAM_LINK) && !shouldSkipModal;

  if (shouldDisplayModal) {
    actions.toggleSafeLinkModal({ url: urlWithProtocol, tabId });
  } else {
    window.open(urlWithProtocol, '_blank', 'noopener');
  }
});

addActionHandler('setForwardChatOrTopic', async (global, actions, payload): Promise<void> => {
  const { chatId, topicId, tabId = getCurrentTabId() } = payload;
  let user = selectUser(global, chatId);
  if (user && selectForwardsContainVoiceMessages(global, tabId)) {
    let fullInfo = selectUserFullInfo(global, chatId);
    if (!fullInfo) {
      const { accessHash } = user;
      const result = await callApi('fetchFullUser', { id: chatId, accessHash });
      global = getGlobal();
      user = result?.user;
      fullInfo = result?.fullInfo;
    }

    if (fullInfo!.noVoiceMessages) {
      actions.showDialog({
        data: {
          message: translate('VoiceMessagesRestrictedByPrivacy', getUserFullName(user)),
        },
        tabId,
      });
      return;
    }
  }

  if (!selectForwardsCanBeSentToChat(global, chatId, tabId)) {
    actions.showAllowedMessageTypesNotification({ chatId, tabId });
    return;
  }

  global = updateTabState(global, {
    forwardMessages: {
      ...selectTabState(global, tabId).forwardMessages,
      toChatId: chatId,
      toThreadId: topicId,
      isModalShown: false,
    },
  }, tabId);
  setGlobal(global);

  actions.openThread({ chatId, threadId: topicId || MAIN_THREAD_ID, tabId });
  actions.closeMediaViewer({ tabId });
  actions.exitMessageSelectMode({ tabId });
});

addActionHandler('forwardToSavedMessages', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  global = updateTabState(global, {
    forwardMessages: {
      ...selectTabState(global, tabId).forwardMessages,
      toChatId: global.currentUserId,
    },
  }, tabId);
  setGlobal(global);

  actions.exitMessageSelectMode({ tabId });
  actions.forwardMessages({ isSilent: true, tabId });
});

addActionHandler('forwardStory', (global, actions, payload): ActionReturnType => {
  const { toChatId, tabId = getCurrentTabId() } = payload || {};

  const { fromChatId, storyId } = selectTabState(global, tabId).forwardMessages;
  const fromChat = fromChatId ? selectChat(global, fromChatId) : undefined;
  const toChat = toChatId ? selectChat(global, toChatId) : undefined;
  const story = fromChatId && storyId
    ? selectPeerStory(global, fromChatId, storyId)
    : undefined;

  if (!fromChat || !toChat || !story || 'isDeleted' in story) {
    return;
  }

  const lastMessageId = selectChatLastMessageId(global, toChatId);

  const { text, entities } = (story as ApiStory).content.text || {};
  void sendMessage(global, {
    chat: toChat,
    text,
    entities,
    story,
    lastMessageId,
  });

  global = getGlobal();
  global = updateTabState(global, {
    forwardMessages: {},
  }, tabId);
  setGlobal(global);
});

addActionHandler('requestMessageTranslation', (global, actions, payload): ActionReturnType => {
  const {
    chatId, id, toLanguageCode = selectTranslationLanguage(global), tabId = getCurrentTabId(),
  } = payload;

  global = updateRequestedMessageTranslation(global, chatId, id, toLanguageCode, tabId);
  global = replaceSettings(global, {
    translationLanguage: toLanguageCode,
  });

  return global;
});

addActionHandler('showOriginalMessage', (global, actions, payload): ActionReturnType => {
  const {
    chatId, id, tabId = getCurrentTabId(),
  } = payload;

  global = removeRequestedMessageTranslation(global, chatId, id, tabId);

  return global;
});

addActionHandler('markMessagesTranslationPending', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageIds, toLanguageCode = selectLanguageCode(global),
  } = payload;

  messageIds.forEach((id) => {
    global = updateMessageTranslation(global, chatId, id, toLanguageCode, {
      isPending: true,
    });
  });

  return global;
});

addActionHandler('translateMessages', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageIds, toLanguageCode = selectLanguageCode(global),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  actions.markMessagesTranslationPending({ chatId, messageIds, toLanguageCode });

  callApi('translateText', {
    chat,
    messageIds,
    toLanguageCode,
  });

  return global;
});

// https://github.com/telegramdesktop/tdesktop/blob/11906297d82b6ff57b277da5251d2e6eb3d8b6d0/Telegram/SourceFiles/api/api_views.cpp#L22
const SEND_VIEWS_TIMEOUT = 1000;
let viewsIncrementTimeout: number | undefined;
let idsToIncrementViews: Record<string, Set<number>> = {};

function incrementViews() {
  if (viewsIncrementTimeout) {
    clearTimeout(viewsIncrementTimeout);
    viewsIncrementTimeout = undefined;
  }

  // eslint-disable-next-line eslint-multitab-tt/no-getactions-in-actions
  const { loadMessageViews } = getActions();
  Object.entries(idsToIncrementViews).forEach(([chatId, ids]) => {
    loadMessageViews({ chatId, ids: Array.from(ids), shouldIncrement: true });
  });

  idsToIncrementViews = {};
}
addActionHandler('scheduleForViewsIncrement', (global, actions, payload): ActionReturnType => {
  const { ids, chatId } = payload;

  if (!viewsIncrementTimeout) {
    setTimeout(incrementViews, SEND_VIEWS_TIMEOUT);
  }

  if (!idsToIncrementViews[chatId]) {
    idsToIncrementViews[chatId] = new Set();
  }

  ids.forEach((id) => {
    idsToIncrementViews[chatId].add(id);
  });
});

addActionHandler('loadMessageViews', async (global, actions, payload): Promise<void> => {
  const { chatId, ids, shouldIncrement } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('fetchMessageViews', {
    chat,
    ids,
    shouldIncrement,
  });

  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  result.viewsInfo.forEach((update) => {
    global = updateChatMessage(global, chatId, update.id, {
      viewsCount: update.views,
      forwardsCount: update.forwards,
    });

    if (update.threadInfo) {
      global = updateThreadInfo(global, chatId, update.id, update.threadInfo);
    }
  });

  setGlobal(global);
});

addActionHandler('loadOutboxReadDate', async (global, actions, payload): Promise<void> => {
  const { chatId, messageId } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  try {
    const result = await callApi('fetchOutboxReadDate', { chat, messageId });
    if (result?.date) {
      global = getGlobal();
      global = updateChatMessage(global, chatId, messageId, { readDate: result.date });
      setGlobal(global);
    }
  } catch (error) {
    const { message } = error as ApiError;

    if (message === 'USER_PRIVACY_RESTRICTED' || message === 'YOUR_PRIVACY_RESTRICTED') {
      global = getGlobal();

      const user = selectUser(global, chatId);
      if (!user) return;
      const userStatus = selectUserStatus(global, chatId);
      if (!userStatus) return;

      const updateStatus = message === 'USER_PRIVACY_RESTRICTED'
        ? { isReadDateRestricted: true }
        : { isReadDateRestrictedByMe: true };

      global = replaceUserStatuses(global, {
        [chatId]: { ...userStatus, ...updateStatus },
      });
      // Need to reset `readDate` to `undefined` after click on "Show my Read Time" button
      global = updateChatMessage(global, chatId, messageId, { readDate: undefined });
      setGlobal(global);
    }
  }
});

addActionHandler('copyMessageLink', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, shouldIncludeThread, shouldIncludeGrouped, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    actions.showNotification({
      message: translate('ErrorOccurred'),
      tabId,
    });
    return;
  }

  if (!isChatChannel(chat) && !isChatSuperGroup(chat)) {
    actions.showNotification({
      message: translate('lng_filters_link_private_error'),
      tabId,
    });
    return;
  }

  const link = await callApi('exportMessageLink', {
    chat,
    id: messageId,
    shouldIncludeThread,
    shouldIncludeGrouped,
  });

  if (!link) {
    actions.showNotification({
      message: translate('ErrorOccurred'),
      tabId,
    });
    return;
  }

  copyTextToClipboard(link);
  actions.showNotification({
    message: translate('LinkCopied'),
    tabId,
  });
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
  if (mimeType === GIF_MIME_TYPE) return 'gif';
  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType) || SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) return 'media';
  if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) return 'audio';
  if (attachment.voice) return 'voice';
  return 'file';
}
