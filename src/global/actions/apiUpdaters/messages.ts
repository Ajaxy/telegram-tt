import type {
  ApiMediaExtendedPreview, ApiMessage, ApiReactions,
  MediaContent,
} from '../../../api/types';
import type { ActiveEmojiInteraction, ThreadId } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type {
  ActionReturnType, GlobalState, RequiredGlobalState,
} from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { isUserId } from '../../../util/entities/ids';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import {
  buildCollectionByKey, omit, unique,
} from '../../../util/iteratees';
import { getMessageKey, isLocalMessageId } from '../../../util/keys/messageKey';
import { notifyAboutMessage } from '../../../util/notifications';
import { onTickEnd } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import {
  addPaidReaction,
  checkIfHasUnreadReactions,
  createApiMessageFromTypingDraft,
  getIsSavedDialog,
  getMessageContent,
  getMessageText,
  groupMessageIdsByThreadId,
  isActionMessage,
  isMessageLocal,
} from '../../helpers';
import { getMessageReplyInfo, getStoryReplyInfo } from '../../helpers/replies';
import {
  addActionHandler,
  getGlobal,
  setGlobal,
} from '../../index';
import {
  addMessages,
  addViewportId,
  clearMessageSummary,
  clearMessageTranslation,
  deleteChatMessages,
  deleteChatScheduledMessages,
  deletePeerPhoto,
  deleteQuickReply,
  deleteQuickReplyMessages,
  deleteTopic,
  removeChatFromChatLists,
  replaceWebPage,
  updateChatLastMessageId,
  updateChatMediaLoadingState,
  updateChatMessage,
  updateListedIds,
  updateMessageTranslations,
  updatePeerFullInfo,
  updatePoll,
  updatePollVote,
  updateQuickReplies,
  updateQuickReplyMessage,
  updateScheduledMessage,
} from '../../reducers';
import { addUnreadReactions, removeUnreadReactions } from '../../reducers/reactions';
import { updateTabState } from '../../reducers/tabs';
import {
  replaceThreadLocalStateParam,
  replaceThreadReadStateParam,
  updateThreadInfo,
  updateThreadInfoLastMessageId,
  updateThreadInfoMessagesCount,
  updateThreadReadState,
} from '../../reducers/threads';
import {
  selectCanAnimateSnapEffect,
  selectChat,
  selectChatLastMessageId,
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCommonBoxChatId,
  selectCurrentMessageList,
  selectFirstUnreadId,
  selectIsChatListed,
  selectIsChatWithSelf,
  selectIsMessageInCurrentMessageList,
  selectIsServiceChatReady,
  selectIsViewportNewest,
  selectListedIds,
  selectPerformanceSettingsValue,
  selectPinnedIds,
  selectScheduledIds,
  selectScheduledMessage,
  selectTabState,
  selectTopic,
  selectTopicFromMessage,
  selectViewportIds,
} from '../../selectors';
import {
  selectSavedDialogIdFromMessage,
  selectThread,
  selectThreadByMessage,
  selectThreadIdFromMessage,
  selectThreadInfo,
  selectThreadLocalStateParam,
  selectThreadReadState,
} from '../../selectors/threads';

const ANIMATION_DELAY = 350;
const SNAP_ANIMATION_DELAY = 1000;
const VIDEO_PROCESSING_NOTIFICATION_DELAY = 1000;
let lastVideoProcessingNotificationTime = 0;

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'newMessage': {
      const {
        chatId, id, message, shouldForceReply, wasDrafted, poll, webPage,
      } = update;
      global = updateWithLocalMedia(global, chatId, id, true, message);
      global = updateListedAndViewportIds(global, message);

      const newMessage = selectChatMessage(global, chatId, id)!;
      const replyInfo = getMessageReplyInfo(newMessage);
      const storyReplyInfo = getStoryReplyInfo(newMessage);
      const chat = selectChat(global, chatId);
      if (chat?.isForum
        && replyInfo?.isForumTopic
        && !selectTopicFromMessage(global, newMessage)
        && replyInfo.replyToMsgId) {
        actions.loadTopicById({ chatId, topicId: replyInfo.replyToMsgId });
      }

      const isLocal = isMessageLocal(message);

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        // Force update for last message on drafted messages to prevent flickering
        if (isLocal && wasDrafted) {
          global = updateChatLastMessage(global, chatId, newMessage);
        }

        const threadId = selectThreadIdFromMessage(global, newMessage);
        global = updateChatMediaLoadingState(global, newMessage, chatId, threadId, tabId);

        if (selectIsMessageInCurrentMessageList(global, chatId, message, tabId)) {
          if (isLocal && message.isOutgoing && !(message.content?.action) && !storyReplyInfo?.storyId
            && !message.content?.storyData) {
            const currentMessageList = selectCurrentMessageList(global, tabId);
            if (currentMessageList) {
              // We do not use `actions.focusLastMessage` as it may be set with a delay (see below)
              actions.focusMessage({
                chatId,
                threadId: currentMessageList.threadId,
                messageId: message.id,
                noHighlight: true,
                isResizingContainer: true,
                tabId,
              });
            }
          }

          // @perf Wait until scroll animation finishes or simply rely on delivery status update
          // (which is itself delayed)
          if (!isLocal) {
            setTimeout(() => {
              global = getGlobal();
              if (shouldForceReply) {
                actions.updateDraftReplyInfo({
                  replyToMsgId: id,
                  tabId,
                });
              }
              global = updateChatLastMessage(global, chatId, newMessage);
              setGlobal(global);
            }, ANIMATION_DELAY);
          }
        } else {
          global = updateChatLastMessage(global, chatId, newMessage);
        }
      });

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      if (webPage) {
        global = replaceWebPage(global, webPage.id, webPage);
      }

      if (message.reportDeliveryUntilDate && message.reportDeliveryUntilDate > getServerTime()) {
        actions.reportMessageDelivery({ chatId, messageId: id });
      }

      if (chat?.isBotForum && !newMessage.isOutgoing && !isLocal) {
        const threadId = selectThreadIdFromMessage(global, newMessage);
        const typingDraftStore = selectThreadLocalStateParam(global, chatId, threadId, 'typingDraftIdByRandomId');
        const localDraftIds = Object.values(typingDraftStore || {});
        global = deleteChatMessages(global, chatId, localDraftIds);
        global = replaceThreadLocalStateParam(global, chatId, threadId, 'typingDraftIdByRandomId', undefined);
      }

      setGlobal(global);

      // Reload dialogs if chat is not present in the list
      if (!isLocal && !chat?.isNotJoined && !selectIsChatListed(global, chatId)) {
        actions.loadTopChats();
      }

      if (!isLocal && selectIsChatWithSelf(global, chatId)) {
        const savedDialogId = selectSavedDialogIdFromMessage(global, newMessage);
        if (savedDialogId && !selectIsChatListed(global, savedDialogId, 'saved')) {
          actions.requestSavedDialogUpdate({ chatId: savedDialogId });
        }
      }

      break;
    }

    case 'updateChatLastMessage': {
      const { id, lastMessage } = update;

      global = updateChatLastMessage(global, id, lastMessage, true);
      global = addMessages(global, [lastMessage]);
      setGlobal(global);
      break;
    }

    case 'updateStartEmojiInteraction': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { chatId: currentChatId } = selectCurrentMessageList(global, tabId) || {};

        if (currentChatId !== update.id) return;
        const message = selectChatMessage(global, currentChatId, update.messageId);

        if (!message) return;

        // Workaround for a weird behavior when interaction is received after watching reaction
        if (getMessageText(message)?.text !== update.emoji) return;

        const tabState = selectTabState(global, tabId);
        global = updateTabState(global, {
          activeEmojiInteractions: [...(tabState.activeEmojiInteractions || []), {
            id: Math.random(),
            animatedEffect: update.emoji,
            messageId: update.messageId,
          } as ActiveEmojiInteraction],
        }, tabId);
      });

      setGlobal(global);

      break;
    }

    case 'newScheduledMessage': {
      const {
        chatId, id, message, poll, webPage,
      } = update;

      global = updateWithLocalMedia(global, chatId, id, true, message, true);

      const scheduledIds = selectScheduledIds(global, chatId, MAIN_THREAD_ID) || [];
      global = replaceThreadLocalStateParam(
        global, chatId, MAIN_THREAD_ID, 'scheduledIds', unique([...scheduledIds, id]),
      );

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadLocalStateParam(
          global, chatId, threadId, 'scheduledIds', unique([...threadScheduledIds, id]),
        );
      }

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      if (webPage) {
        global = replaceWebPage(global, webPage.id, webPage);
      }

      global = updatePeerFullInfo(global, chatId, {
        hasScheduledMessages: true,
      });

      setGlobal(global);

      break;
    }

    case 'updateScheduledMessage': {
      const {
        chatId, id, message, poll, webPage, isFromNew,
      } = update;

      const currentMessage = selectScheduledMessage(global, chatId, id);
      if (!currentMessage) {
        if (isFromNew) {
          actions.apiUpdate({
            '@type': 'newScheduledMessage',
            id: update.id,
            chatId: update.chatId,
            message: update.message as ApiMessage,
            poll: update.poll,
            webPage: update.webPage,
          });
        }
        return;
      }

      global = updateWithLocalMedia(global, chatId, id, false, message, true);
      const ids = Object.keys(selectChatScheduledMessages(global, chatId) || {}).map(Number).sort((a, b) => b - a);
      global = replaceThreadLocalStateParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', ids);

      const threadId = selectThreadIdFromMessage(global, currentMessage);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadLocalStateParam(
          global, chatId, threadId, 'scheduledIds', [...threadScheduledIds].sort((a, b) => b - a),
        );
      }
      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      if (webPage) {
        global = replaceWebPage(global, webPage.id, webPage);
      }

      setGlobal(global);

      break;
    }

    case 'updateMessage': {
      const {
        chatId, id, message, poll, webPage, isFromNew, isFull, shouldForceReply,
      } = update;

      const currentMessage = selectChatMessage(global, chatId, id);

      if (message.reactions) {
        global = updateReactions(
          global, actions, {
            chatId,
            id,
            reactions: message.reactions,
          },
        );
      }

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      if (webPage) {
        global = replaceWebPage(global, webPage.id, webPage);
      }

      if (!currentMessage) {
        if (isFromNew && isFull) {
          actions.apiUpdate({
            '@type': 'newMessage',
            id: update.id,
            chatId: update.chatId,
            message: update.message,
            poll: update.poll,
            webPage: update.webPage,
            shouldForceReply,
          });
        }

        // If update contains the full message, store it
        if (update.isFull) {
          global = addMessages(global, [update.message]);
        }
        setGlobal(global);
        return;
      }

      if (message.content?.text?.text !== currentMessage?.content?.text?.text) {
        global = clearMessageTranslation(global, chatId, id);
        global = clearMessageSummary(global, chatId, id);
      }

      global = updateWithLocalMedia(global, chatId, id, false, message);

      setGlobal(global);

      break;
    }

    case 'updateQuickReplyMessage': {
      const { id, message, poll, webPage } = update;

      global = updateQuickReplyMessage(global, id, message);

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      if (webPage) {
        global = replaceWebPage(global, webPage.id, webPage);
      }

      setGlobal(global);

      break;
    }

    case 'deleteQuickReplyMessages': {
      const { messageIds } = update;

      global = deleteQuickReplyMessages(global, messageIds);
      setGlobal(global);

      break;
    }

    case 'updateQuickReplies': {
      const { quickReplies } = update;
      const byId = buildCollectionByKey(quickReplies, 'id');

      global = updateQuickReplies(global, byId);
      setGlobal(global);
      break;
    }

    case 'deleteQuickReply': {
      global = deleteQuickReply(global, update.quickReplyId);
      setGlobal(global);
      break;
    }

    case 'updateVideoProcessingPending': {
      const {
        chatId, localId, newScheduledMessageId,
      } = update;

      global = deleteChatMessages(global, chatId, [localId]);
      global = updatePeerFullInfo(global, chatId, {
        hasScheduledMessages: true,
      });

      setGlobal(global);

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const currentMessageList = selectCurrentMessageList(global, tabId);
        if (currentMessageList?.chatId !== chatId) return;

        const now = Date.now();
        if (now - lastVideoProcessingNotificationTime < VIDEO_PROCESSING_NOTIFICATION_DELAY) {
          return;
        }
        lastVideoProcessingNotificationTime = now;

        actions.showNotification({
          message: {
            key: 'VideoConversionText',
          },
          title: {
            key: 'VideoConversionTitle',
          },
          tabId,
        });

        actions.focusMessage({
          chatId,
          messageId: newScheduledMessageId,
          messageListType: 'scheduled',
          tabId,
        });
      });

      break;
    }

    case 'updateMessageSendSucceeded': {
      const {
        chatId, localId, message, poll,
      } = update;

      global = updateListedAndViewportIds(global, message);

      const currentMessage = selectChatMessage(global, chatId, localId);

      global = deleteChatMessages(global, chatId, [localId]);

      // Edge case for "Send When Online"
      if (message.isScheduled) {
        global = deleteChatScheduledMessages(global, chatId, [localId]);
      }

      global = updateChatMessage(global, chatId, message.id, {
        ...currentMessage,
        ...message,
        previousLocalId: localId,
        isDeleting: undefined,
      });

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      global = {
        ...global,
        fileUploads: {
          byMessageKey: omit(global.fileUploads.byMessageKey, [getMessageKey(message)]),
        },
      };

      const newMessage = selectChatMessage(global, chatId, message.id)!;
      global = updateChatLastMessage(global, chatId, newMessage);

      const thread = selectThreadByMessage(global, message);
      // For some reason Telegram requires to manually mark outgoing thread messages read
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global, tabId) || {};
        if (currentChatId !== chatId
          || (thread?.threadInfo?.threadId || MAIN_THREAD_ID) !== currentThreadId) {
          return;
        }

        actions.markMessageListRead({ maxId: message.id, tabId });
      });
      if (thread?.threadInfo?.threadId) {
        global = replaceThreadReadStateParam(
          global, chatId, thread.threadInfo.threadId, 'lastReadInboxMessageId', message.id,
        );
        global = updateThreadInfoLastMessageId(global, chatId, thread.threadInfo.threadId, message.id);
      }

      const chat = selectChat(global, chatId);
      // Reload dialogs if chat is not present in the list
      if (!chat?.isNotJoined && !selectIsChatListed(global, chatId)) {
        actions.loadTopChats();
      }

      if (selectIsChatWithSelf(global, chatId)) {
        const savedDialogId = selectSavedDialogIdFromMessage(global, newMessage);
        if (savedDialogId && !selectIsChatListed(global, savedDialogId, 'saved')) {
          actions.requestSavedDialogUpdate({ chatId: savedDialogId });
        }
      }

      setGlobal(global);

      break;
    }

    case 'updateScheduledMessageSendSucceeded': {
      const {
        chatId, localId, message, poll,
      } = update;
      const scheduledIds = selectScheduledIds(global, chatId, MAIN_THREAD_ID) || [];
      global = replaceThreadLocalStateParam(
        global, chatId, MAIN_THREAD_ID, 'scheduledIds', [...scheduledIds, message.id],
      );

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadLocalStateParam(
          global, chatId, threadId, 'scheduledIds', [...threadScheduledIds, message.id],
        );
      }

      const currentMessage = selectScheduledMessage(global, chatId, localId);

      global = deleteChatScheduledMessages(global, chatId, [localId]);
      global = updateScheduledMessage(global, chatId, message.id, {
        ...currentMessage,
        ...message,
        previousLocalId: localId,
        isDeleting: undefined,
      });

      if (poll) {
        global = updatePoll(global, poll.id, poll);
      }

      setGlobal(global);
      break;
    }

    case 'updatePinnedIds': {
      const { chatId, isPinned, messageIds } = update;

      const messageIdsByThreadId = groupMessageIdsByThreadId(global, chatId, messageIds, false);

      Object.entries(messageIdsByThreadId).forEach(([threadId, ids]) => {
        const pinnedIds = selectPinnedIds(global, chatId, threadId) || [];
        const newPinnedIds = isPinned
          ? unique(pinnedIds.concat(ids)).sort((a, b) => b - a)
          : pinnedIds.filter((id) => !ids.includes(id));
        global = replaceThreadLocalStateParam(global, chatId, threadId, 'pinnedIds', newPinnedIds);
      });
      setGlobal(global);

      break;
    }

    case 'updateThreadInfo': {
      const {
        threadInfo,
      } = update;

      global = updateThreadInfo(global, threadInfo);
      setGlobal(global);

      break;
    }

    case 'updateThreadReadState': {
      const {
        chatId, threadId, readState,
      } = update;

      global = updateThreadReadState(global, chatId, threadId, readState);
      setGlobal(global);

      break;
    }

    case 'resetMessages': {
      const { id: chatId } = update;
      const messagesById = selectChatMessages(global, chatId);

      if (messagesById && !isUserId(chatId)) {
        const tabId = getCurrentTabId();
        global = deleteChatMessages(global, chatId, Object.keys(messagesById).map(Number));
        setGlobal(global);
        actions.loadFullChat({ chatId, force: true });
        actions.loadViewportMessages({ chatId, threadId: MAIN_THREAD_ID, tabId });
      }

      break;
    }

    case 'deleteMessages': {
      const { ids, chatId } = update;

      deleteMessages(global, chatId, ids, actions);
      break;
    }

    case 'deleteScheduledMessages': {
      const { ids, newIds, chatId } = update;

      const hadVideoProcessing = ids?.some((id) => (
        selectScheduledMessage(global, chatId, id)?.isVideoProcessingPending
      ));
      const processedVideoId = newIds?.find((id) => {
        const message = selectChatMessage(global, chatId, id);
        return message?.content.video;
      });

      if (hadVideoProcessing && processedVideoId) {
        Object.values(global.byTabId).forEach(({ id: tabId }) => {
          actions.showNotification({
            message: {
              key: 'VideoConversionDone',
            },
            actionText: {
              key: 'VideoConversionView',
            },
            action: {
              action: 'focusMessage',
              payload: {
                chatId,
                messageId: processedVideoId,
                tabId,
              },
            },
            tabId,
          });
        });
      }

      deleteScheduledMessages(chatId, ids, actions, global);
      break;
    }

    case 'deleteHistory': {
      const { chatId } = update;
      const chatMessages = global.messages.byChatId[chatId];
      if (chatId === SERVICE_NOTIFICATIONS_USER_ID) {
        global = {
          ...global,
          serviceNotifications: global.serviceNotifications.map((notification) => ({
            ...notification,
            isDeleted: true,
          })),
        };
        setGlobal(global);
      }

      if (chatMessages) {
        const ids = Object.keys(chatMessages.byId).map(Number);
        global = getGlobal();
        deleteMessages(global, chatId, ids, actions);
      } else {
        actions.requestChatUpdate({ chatId });
      }

      global = getGlobal();
      global = removeChatFromChatLists(global, chatId);
      setGlobal(global);

      break;
    }

    case 'deleteSavedHistory': {
      const { chatId } = update;
      const currentUserId = global.currentUserId!;
      global = removeChatFromChatLists(global, chatId, 'saved');
      setGlobal(global);

      global = getGlobal();
      deleteThread(global, currentUserId, chatId, actions);

      break;
    }

    case 'deleteParticipantHistory': {
      const { chatId, peerId } = update;

      global = getGlobal();
      deleteParticipantHistory(global, chatId, peerId, actions);

      break;
    }

    case 'updateCommonBoxMessages': {
      const { ids, messageUpdate } = update;

      ids.forEach((id) => {
        const chatId = selectCommonBoxChatId(global, id);
        if (chatId) {
          global = updateChatMessage(global, chatId, id, messageUpdate);
        }
      });

      setGlobal(global);

      break;
    }

    case 'updateChannelMessages': {
      const { channelId, ids, messageUpdate } = update;

      ids.forEach((id) => {
        global = updateChatMessage(global, channelId, id, messageUpdate);
      });

      setGlobal(global);

      break;
    }

    case 'updateMessagePoll': {
      const { pollId, pollUpdate } = update;

      global = updatePoll(global, pollId, pollUpdate);

      setGlobal(global);
      break;
    }

    case 'updateMessagePollVote': {
      const { pollId, peerId, options } = update;
      global = updatePollVote(global, pollId, peerId, options);
      setGlobal(global);

      break;
    }

    case 'updateServiceNotification': {
      const { message } = update;

      if (selectIsServiceChatReady(global)) {
        actions.createServiceNotification({ message });
      }

      break;
    }

    case 'updateMessageReactions': {
      const { chatId, id, threadId, reactions } = update;

      global = updateReactions(global, actions, {
        chatId, id, threadId, reactions,
      });
      setGlobal(global);
      break;
    }

    case 'updateMessageExtendedMedia': {
      const {
        chatId, id, extendedMedia, isBought,
      } = update;
      const message = selectChatMessage(global, chatId, id);
      const chat = selectChat(global, update.chatId);

      if (!chat || !message) return;

      if (message.content.invoice) {
        const media = extendedMedia[0];
        if ('mediaType' in media && media.mediaType === 'extendedMediaPreview') {
          if (!message.content.invoice) return;
          global = updateChatMessage(global, chatId, id, {
            content: {
              ...message.content,
              invoice: {
                ...message.content.invoice,
                extendedMedia: media,
              },
            },
          });
          setGlobal(global);
        } else {
          const content = media as MediaContent;
          global = updateChatMessage(global, chatId, id, {
            content: {
              ...content,
            },
          });
          setGlobal(global);
        }
      }

      if (message.content.paidMedia) {
        const paidMediaUpdate = isBought ? { isBought, extendedMedia }
          : { extendedMedia: extendedMedia as ApiMediaExtendedPreview[], isBought: undefined };

        global = updateChatMessage(global, chatId, id, {
          content: {
            ...message.content,
            paidMedia: {
              ...message.content.paidMedia,
              ...paidMediaUpdate,
            },
          },
        });
        setGlobal(global);
      }

      break;
    }

    case 'updateTranscribedAudio': {
      const { transcriptionId, text, isPending } = update;

      global = {
        ...global,
        transcriptions: {
          ...global.transcriptions,
          [transcriptionId]: {
            ...(global.transcriptions[transcriptionId] || {}),
            transcriptionId,
            text,
            isPending,
          },
        },
      };
      setGlobal(global);
      break;
    }

    case 'updateMessageSendFailed': {
      const { chatId, localId, error } = update;

      if (error.match(/CHAT_SEND_.+?FORBIDDEN/)) {
        Object.values(global.byTabId).forEach(({ id: tabId }) => {
          actions.showAllowedMessageTypesNotification({ chatId, tabId });
        });
      }

      global = updateChatMessage(global, chatId, localId, { sendingState: 'messageSendingStateFailed' });
      setGlobal(global);
      break;
    }

    case 'updateScheduledMessageSendFailed': {
      const { chatId, localId, error } = update;

      if (error.match(/CHAT_SEND_.+?FORBIDDEN/)) {
        Object.values(global.byTabId).forEach(({ id: tabId }) => {
          actions.showAllowedMessageTypesNotification({ chatId, tabId });
        });
      }

      global = updateScheduledMessage(global, chatId, localId, { sendingState: 'messageSendingStateFailed' });
      setGlobal(global);
      break;
    }

    case 'updateMessageTranslations': {
      const {
        chatId, messageIds, toLanguageCode, translations,
      } = update;

      global = updateMessageTranslations(global, chatId, messageIds, toLanguageCode, translations);

      setGlobal(global);
      break;
    }

    case 'failedMessageTranslations': {
      const { chatId, messageIds, toLanguageCode } = update;

      global = updateMessageTranslations(global, chatId, messageIds, toLanguageCode, []);

      setGlobal(global);
      break;
    }

    case 'updateChatTypingDraft': {
      const { id, chatId, threadId = MAIN_THREAD_ID, text } = update;
      const thread = selectThread(global, chatId, threadId);
      if (!thread) return undefined;

      let typingDraftStore = selectThreadLocalStateParam(global, chatId, threadId, 'typingDraftIdByRandomId');
      const messageId = typingDraftStore?.[id];

      const isUpdatingDraft = Boolean(messageId);
      const updatingMessage = isUpdatingDraft ? selectChatMessage(global, chatId, messageId) : undefined;

      const rescheduleDraftRemoval = () => {
        // Clear typing draft after timeout
        setTimeout(() => {
          global = getGlobal();
          const currentTypingDraftStore = selectThreadLocalStateParam(
            global, chatId, threadId, 'typingDraftIdByRandomId',
          );
          if (currentTypingDraftStore?.[id]) {
            const currentMessageId = currentTypingDraftStore[id];
            const currentMessage = selectChatMessage(global, chatId, currentMessageId);
            // Already deleted or replaced with a new message
            if (!currentMessage || getServerTime() - currentMessage.editDate! < global.appConfig.typingDraftTtl) return;

            const newTypingDraftIds = omit(currentTypingDraftStore, [id]);
            global = replaceThreadLocalStateParam(
              global, chatId, threadId, 'typingDraftIdByRandomId', newTypingDraftIds,
            );
            global = deleteChatMessages(global, chatId, [currentMessageId]);
            setGlobal(global);
          }
        }, global.appConfig.typingDraftTtl * 1000);
      };

      if (isUpdatingDraft && updatingMessage) {
        global = updateChatMessage(global, chatId, messageId, {
          content: {
            text,
          },
          editDate: getServerTime(),
        });
        rescheduleDraftRemoval();
        return global;
      }

      // Let worker know that we have new local message
      callApi('incrementLocalMessagesCounter');

      const lastMessageId = selectChatLastMessageId(global, chatId);

      const newMessage = createApiMessageFromTypingDraft({
        lastMessageId: lastMessageId || 0,
        chatId,
        threadId,
        text,
      });

      actions.apiUpdate({
        '@type': 'newMessage',
        chatId,
        id: newMessage.id,
        message: newMessage,
      });

      typingDraftStore = {
        ...typingDraftStore,
        [id]: newMessage.id,
      };
      global = replaceThreadLocalStateParam(global, chatId, threadId, 'typingDraftIdByRandomId', typingDraftStore);

      rescheduleDraftRemoval();

      return global;
    }
  }
});

function updateReactions<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  {
    chatId, id, threadId, reactions,
  }: {
    chatId: string;
    id: number;
    threadId?: ThreadId;
    reactions: ApiReactions;
  },
): T {
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, id);

  if (!chat || !message) {
    // Simplified logic to update counter only
    const hasUnread = checkIfHasUnreadReactions(global, reactions);
    if (hasUnread) {
      global = addUnreadReactions({ global, chatId, ids: [id] });
    } else {
      // Reload unread reactions to update counter
      actions.loadUnreadReactions({ chatId, threadId });
    }
    return global;
  }

  const currentReactions = message?.reactions;

  // `updateMessageReactions` happens with an interval, so we try to avoid redundant global state updates
  if (currentReactions && areDeepEqual(reactions, currentReactions)) {
    return global;
  }

  const localPaidReaction = currentReactions?.results.find((r) => r.localAmount);
  // Save local count on update, but reset if we sent reaction
  if (localPaidReaction?.localAmount) {
    const { localIsPrivate: isPrivate, localAmount, localPeerId } = localPaidReaction;
    reactions.results = addPaidReaction(reactions.results, localAmount, isPrivate, localPeerId);
  }

  global = updateChatMessage(global, chatId, id, { reactions });

  if (!message.isOutgoing) {
    return global;
  }

  const { reaction, isOwn, isUnread } = reactions.recentReactions?.[0] ?? {};
  const reactionEffectsEnabled = selectPerformanceSettingsValue(global, 'reactionEffects');
  if (reactionEffectsEnabled && message && reaction && isUnread && !isOwn) {
    const messageKey = getMessageKey(message);
    // Start reaction only in master tab
    actions.startActiveReaction({ containerId: messageKey, reaction, tabId: getCurrentTabId() });
  }

  const hasUnreadReactionsForMessageInChat = message.reactions && checkIfHasUnreadReactions(global, message.reactions);
  const hasUnreadReactionsInNewReactions = checkIfHasUnreadReactions(global, reactions);

  // Only notify about added reactions, not removed ones
  if (hasUnreadReactionsInNewReactions && !hasUnreadReactionsForMessageInChat) {
    global = addUnreadReactions({ global, chatId, ids: [id] });

    const newMessage = selectChatMessage(global, chatId, id);

    if (!chat || !newMessage) return global;

    onTickEnd(() => {
      notifyAboutMessage({
        chat,
        message: newMessage,
        isReaction: true,
      });
    });
  }

  if (!hasUnreadReactionsInNewReactions && hasUnreadReactionsForMessageInChat) {
    global = removeUnreadReactions({ global, chatId, ids: [id] });
  }

  return global;
}

export function updateWithLocalMedia(
  global: RequiredGlobalState,
  chatId: string,
  id: number,
  isNew: boolean,
  messageUpdate: Partial<ApiMessage>,
  isScheduled = false,
) {
  const currentMessage = isScheduled
    ? selectScheduledMessage(global, chatId, id)
    : selectChatMessage(global, chatId, id);

  if (!currentMessage && !isNew) return global;

  // Preserve locally uploaded media.
  if (currentMessage && messageUpdate.content && !isLocalMessageId(id)) {
    const {
      photo, video, sticker, document,
    } = getMessageContent(currentMessage);

    if (photo && messageUpdate.content.photo) {
      messageUpdate.content.photo.blobUrl ??= photo.blobUrl;
      messageUpdate.content.photo.thumbnail ??= photo.thumbnail;
    } else if (video && messageUpdate.content.video) {
      messageUpdate.content.video.blobUrl ??= video.blobUrl;
    } else if (sticker && messageUpdate.content.sticker) {
      messageUpdate.content.sticker.isPreloadedGlobally ??= sticker.isPreloadedGlobally;
    } else if (document && messageUpdate.content.document) {
      messageUpdate.content.document.previewBlobUrl ??= document.previewBlobUrl;
    }
  }

  const newMessage = currentMessage ? { ...currentMessage, ...messageUpdate } : messageUpdate;

  return isScheduled
    ? updateScheduledMessage(global, chatId, id, newMessage)
    : updateChatMessage(global, chatId, id, newMessage);
}

function updateListedAndViewportIds<T extends GlobalState>(
  global: T, message: ApiMessage,
) {
  const { id, chatId } = message;

  const savedDialogId = selectSavedDialogIdFromMessage(global, message);
  const threadId = savedDialogId || selectThreadIdFromMessage(global, message);
  const threadInfo = selectThreadInfo(global, chatId, threadId);

  const mainThreadReadState = selectThreadReadState(global, chatId, MAIN_THREAD_ID);
  const isUnreadChatNotLoaded = mainThreadReadState?.unreadCount && !selectListedIds(global, chatId, MAIN_THREAD_ID);

  if (threadId) {
    global = updateListedIds(global, chatId, threadId, [id]);

    Object.values(global.byTabId).forEach(({ id: tabId }) => {
      if (selectIsViewportNewest(global, chatId, threadId, tabId)) {
        // Always keep the first unread message in the viewport list
        const firstUnreadId = selectFirstUnreadId(global, chatId, threadId);
        const candidateGlobal = addViewportId(global, chatId, threadId, id, tabId);
        const newViewportIds = selectViewportIds(candidateGlobal, chatId, threadId, tabId);

        if (!firstUnreadId || newViewportIds!.includes(firstUnreadId)) {
          global = candidateGlobal;
        }
      }
    });

    if (threadInfo) {
      global = updateThreadInfoLastMessageId(global, chatId, threadId, message.id);

      if (!isMessageLocal(message) && !isActionMessage(message)) {
        const newCount = (threadInfo.messagesCount || 0) + 1;
        global = updateThreadInfoMessagesCount(global, chatId, threadId, newCount);
      }
    }
  }

  if (isUnreadChatNotLoaded) {
    return global;
  }

  global = updateListedIds(global, chatId, MAIN_THREAD_ID, [id]);

  Object.values(global.byTabId).forEach(({ id: tabId }) => {
    if (selectIsViewportNewest(global, chatId, MAIN_THREAD_ID, tabId)) {
      // Always keep the first unread message in the viewport list
      const firstUnreadId = selectFirstUnreadId(global, chatId, MAIN_THREAD_ID);
      const candidateGlobal = addViewportId(global, chatId, MAIN_THREAD_ID, id, tabId);
      const newViewportIds = selectViewportIds(candidateGlobal, chatId, MAIN_THREAD_ID, tabId);

      if (!firstUnreadId || newViewportIds!.includes(firstUnreadId)) {
        global = candidateGlobal;
      }
    }
  });

  return global;
}

function updateChatLastMessage<T extends GlobalState>(
  global: T,
  chatId: string,
  message: ApiMessage,
  force = false,
) {
  const currentLastMessageId = selectChatLastMessageId(global, chatId);

  const threadId = selectThreadIdFromMessage(global, message);
  global = updateThreadInfoLastMessageId(global, chatId, threadId, message.id);

  const savedDialogId = selectSavedDialogIdFromMessage(global, message);
  if (savedDialogId) {
    global = updateChatLastMessageId(global, savedDialogId, message.id, 'saved');
  }

  if (currentLastMessageId && !force) {
    const isSameOrNewer = (
      currentLastMessageId === message.id || currentLastMessageId === message.previousLocalId
    ) || message.id > currentLastMessageId;

    if (!isSameOrNewer) {
      return global;
    }
  }

  global = updateChatLastMessageId(global, chatId, message.id);

  return global;
}

function findLastMessage<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId = MAIN_THREAD_ID) {
  const byId = selectChatMessages(global, chatId);
  const listedIds = selectListedIds(global, chatId, threadId);

  if (!byId || !listedIds) {
    return undefined;
  }

  let i = listedIds.length;
  while (i--) {
    const message = byId[listedIds[i]];
    if (message && !message.isDeleting) {
      return message;
    }
  }

  return undefined;
}

export function deleteParticipantHistory<T extends GlobalState>(
  global: T,
  chatId: string,
  peerId: string,
  actions: RequiredGlobalActions,
) {
  const byId = selectChatMessages(global, chatId);

  const messageIds = Object.values(byId).filter((message) => {
    return message.senderId === peerId;
  }).map((message) => message.id);

  if (!messageIds.length) {
    return;
  }

  deleteMessages(global, chatId, messageIds, actions);
}

export function deleteThread<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  actions: RequiredGlobalActions,
) {
  const byId = selectChatMessages(global, chatId);
  if (!byId) {
    return;
  }

  const messageIds = Object.values(byId).filter((message) => {
    const messageThreadId = selectThreadIdFromMessage(global, message);
    return messageThreadId === threadId;
  }).map((message) => message.id);

  if (!messageIds.length) {
    return;
  }

  deleteMessages(global, chatId, messageIds, actions);
}

export function deleteMessages<T extends GlobalState>(
  global: T, chatId: string | undefined, ids: number[], actions: RequiredGlobalActions,
) {
  // Channel update

  if (chatId) {
    const chat = selectChat(global, chatId);
    if (!chat) return;

    const threadIdsToUpdate = new Set<ThreadId>();
    threadIdsToUpdate.add(MAIN_THREAD_ID);

    ids.forEach((id) => {
      global = updateChatMessage(global, chatId, id, {
        isDeleting: true,
      });

      if (selectTopic(global, chatId, id)) {
        global = deleteTopic(global, chatId, id);
      }

      const message = selectChatMessage(global, chatId, id);
      if (!message) {
        return;
      }

      if (message.content.action?.type === 'chatEditPhoto' && message.content.action.photo) {
        global = deletePeerPhoto(global, chatId, message.content.action.photo.id, true);
      }

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId) {
        threadIdsToUpdate.add(threadId);
      }
    });

    actions.requestChatUpdate({ chatId });

    const idsSet = new Set(ids);

    threadIdsToUpdate.forEach((threadId) => {
      if (chat.isForum && threadId !== MAIN_THREAD_ID) {
        // Refresh unread count
        actions.loadTopicById({ chatId, topicId: Number(threadId) });
      }

      const threadInfo = selectThreadInfo(global, chatId, threadId);
      if (!threadInfo?.lastMessageId || !idsSet.has(threadInfo.lastMessageId)) return;

      const newLastMessage = findLastMessage(global, chatId, threadId);

      if (!newLastMessage) {
        return;
      }

      if (threadId === MAIN_THREAD_ID) {
        global = updateChatLastMessage(global, chatId, newLastMessage, true);
      }

      global = updateThreadInfoLastMessageId(global, chatId, threadId, newLastMessage.id);
    });

    setGlobal(global);

    const isAnimatingAsSnap = selectCanAnimateSnapEffect(global);

    setTimeout(() => {
      global = getGlobal();
      // Prevent local deletion of sent messages in case of desync
      const stillDeletedIds = ids.filter((id) => selectChatMessage(global, chatId, id)?.isDeleting);
      global = deleteChatMessages(global, chatId, stillDeletedIds);
      setGlobal(global);
    }, isAnimatingAsSnap ? SNAP_ANIMATION_DELAY : ANIMATION_DELAY);

    return;
  }

  // Common box update

  const chatIdsToUpdate: string[] = [];

  ids.forEach((id) => {
    const commonBoxChatId = selectCommonBoxChatId(global, id);
    if (commonBoxChatId) {
      chatIdsToUpdate.push(commonBoxChatId);

      global = updateChatMessage(global, commonBoxChatId, id, {
        isDeleting: true,
      });

      const newLastMessage = findLastMessage(global, commonBoxChatId);
      if (newLastMessage) {
        global = updateChatLastMessage(global, commonBoxChatId, newLastMessage, true);
      }

      const message = selectChatMessage(global, commonBoxChatId, id);
      if (selectIsChatWithSelf(global, commonBoxChatId) && message) {
        const threadId = selectThreadIdFromMessage(global, message);
        if (getIsSavedDialog(commonBoxChatId, threadId, global.currentUserId)) {
          const newLastSavedDialogMessage = findLastMessage(global, commonBoxChatId, threadId);
          actions.requestSavedDialogUpdate({ chatId: String(threadId) });
          if (newLastSavedDialogMessage) {
            global = updateChatLastMessageId(global, commonBoxChatId, newLastSavedDialogMessage.id, 'saved');
          }
        }
      }

      if (message?.content.action?.type === 'chatEditPhoto' && message.content.action.photo) {
        global = deletePeerPhoto(global, commonBoxChatId, message.content.action.photo.id, true);
      }

      const isAnimatingAsSnap = selectCanAnimateSnapEffect(global);

      setTimeout(() => {
        global = getGlobal();
        global = deleteChatMessages(global, commonBoxChatId, [id]);
        setGlobal(global);
      }, isAnimatingAsSnap ? SNAP_ANIMATION_DELAY : ANIMATION_DELAY);
    }
  });

  setGlobal(global);

  unique(chatIdsToUpdate).forEach((id) => {
    actions.requestChatUpdate({ chatId: id });
  });
}

function deleteScheduledMessages<T extends GlobalState>(
  chatId: string, ids: number[], actions: RequiredGlobalActions, global: T,
) {
  ids.forEach((id) => {
    global = updateScheduledMessage(global, chatId, id, {
      isDeleting: true,
    });
  });

  setGlobal(global);

  const isAnimatingAsSnap = selectCanAnimateSnapEffect(global);

  setTimeout(() => {
    global = getGlobal();
    global = deleteChatScheduledMessages(global, chatId, ids);
    setGlobal(global);
  }, isAnimatingAsSnap ? SNAP_ANIMATION_DELAY : ANIMATION_DELAY);
}
