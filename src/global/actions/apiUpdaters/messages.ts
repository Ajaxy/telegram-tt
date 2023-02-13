import type { RequiredGlobalActions } from '../../index';
import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type {
  ApiChat,
  ApiMessage, ApiPollResult, ApiReactions, ApiThreadInfo,
} from '../../../api/types';
import type {
  ActiveEmojiInteraction, ActionReturnType, GlobalState, RequiredGlobalState,
} from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { pickTruthy, unique } from '../../../util/iteratees';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { notifyAboutMessage } from '../../../util/notifications';
import {
  updateChat,
  deleteChatMessages,
  updateChatMessage,
  updateListedIds,
  addViewportId,
  updateThreadInfo,
  replaceThreadParam,
  updateScheduledMessage,
  deleteChatScheduledMessages,
  updateThreadUnreadFromForwardedMessage,
  updateTopic,
  deleteTopic,
} from '../../reducers';
import {
  selectChatMessage,
  selectChatMessages,
  selectIsViewportNewest,
  selectListedIds,
  selectChatMessageByPollId,
  selectCommonBoxChatId,
  selectIsChatListed,
  selectThreadInfo,
  selectThreadByMessage,
  selectPinnedIds,
  selectScheduledMessage,
  selectChatScheduledMessages,
  selectIsMessageInCurrentMessageList,
  selectScheduledIds,
  selectCurrentMessageList,
  selectViewportIds,
  selectFirstUnreadId,
  selectChat,
  selectIsServiceChatReady,
  selectThreadIdFromMessage,
  selectTopicFromMessage,
  selectTabState,
} from '../../selectors';
import {
  getMessageContent, isUserId, isMessageLocal, getMessageText, checkIfHasUnreadReactions,
} from '../../helpers';
import { onTickEnd } from '../../../util/schedulers';
import { updateUnreadReactions } from '../../reducers/reactions';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

const ANIMATION_DELAY = 350;

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'newMessage': {
      const {
        chatId, id, message, shouldForceReply,
      } = update;
      global = updateWithLocalMedia(global, chatId, id, message);
      global = updateListedAndViewportIds(global, actions, message as ApiMessage);

      if (message.repliesThreadInfo) {
        global = updateThreadInfo(
          global,
          message.repliesThreadInfo.chatId,
          message.repliesThreadInfo.threadId,
          message.repliesThreadInfo,
        );
      }

      const newMessage = selectChatMessage(global, chatId, id)!;
      const chat = selectChat(global, chatId);
      if (chat?.isForum
        && newMessage.isTopicReply
        && !selectTopicFromMessage(global, newMessage)
        && newMessage.replyToMessageId) {
        actions.loadTopicById({ chatId, topicId: newMessage.replyToMessageId });
      }

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const isLocal = isMessageLocal(message as ApiMessage);
        if (selectIsMessageInCurrentMessageList(global, chatId, message as ApiMessage, tabId)) {
          if (isLocal && message.isOutgoing && !(message.content?.action)) {
            const currentMessageList = selectCurrentMessageList(global, tabId);
            if (currentMessageList) {
              // We do not use `actions.focusLastMessage` as it may be set with a delay (see below)
              actions.focusMessage({
                chatId,
                threadId: currentMessageList.threadId,
                messageId: message.id!,
                noHighlight: true,
                isResizingContainer: true,
                tabId,
              });
            }
          }

          const { threadInfo } = selectThreadByMessage(global, message as ApiMessage) || {};
          if (threadInfo) {
            actions.requestThreadInfoUpdate({ chatId, threadId: threadInfo.threadId });
          }

          // @perf Wait until scroll animation finishes or simply rely on delivery status update
          // (which is itself delayed)
          if (!isLocal) {
            setTimeout(() => {
              global = getGlobal();
              if (shouldForceReply) {
                global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'replyingToId', id);
              }
              global = updateChatLastMessage(global, chatId, newMessage);
              setGlobal(global);
            }, ANIMATION_DELAY);
          }
        } else {
          global = updateChatLastMessage(global, chatId, newMessage);
        }
      });

      setGlobal(global);

      // Edge case: New message in an old (not loaded) chat.
      if (!selectIsChatListed(global, chatId)) {
        actions.loadTopChats();
      }

      break;
    }

    case 'updateStartEmojiInteraction': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { chatId: currentChatId } = selectCurrentMessageList(global, tabId) || {};

        if (currentChatId !== update.id) return;
        const message = selectChatMessage(global, currentChatId, update.messageId);

        if (!message) return;

        // Workaround for a weird behavior when interaction is received after watching reaction
        if (getMessageText(message) !== update.emoji) return;

        const tabState = selectTabState(global, tabId);
        global = updateTabState(global, {
          activeEmojiInteractions: [...(tabState.activeEmojiInteractions || []), {
            id: tabState.activeEmojiInteractions?.length || 0,
            animatedEffect: update.emoji,
            messageId: update.messageId,
          } as ActiveEmojiInteraction],
        }, tabId);
      });

      setGlobal(global);

      break;
    }

    case 'newScheduledMessage': {
      const { chatId, id, message } = update;

      global = updateWithLocalMedia(global, chatId, id, message, true);

      const scheduledIds = selectScheduledIds(global, chatId, MAIN_THREAD_ID) || [];
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', unique([...scheduledIds, id]));

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadParam(global, chatId, threadId, 'scheduledIds', unique([...threadScheduledIds, id]));
      }

      setGlobal(global);

      break;
    }

    case 'updateMessage': {
      const { chatId, id, message } = update;

      const currentMessage = selectChatMessage(global, chatId, id);
      const chat = selectChat(global, chatId);

      global = updateWithLocalMedia(global, chatId, id, message);

      const newMessage = selectChatMessage(global, chatId, id)!;
      if (message.repliesThreadInfo) {
        global = updateThreadInfo(
          global,
          message.repliesThreadInfo.chatId,
          message.repliesThreadInfo.threadId,
          message.repliesThreadInfo,
        );
      }

      if (currentMessage) {
        global = updateChatLastMessage(global, chatId, newMessage);
      }

      if (message.reactions && chat) {
        global = updateReactions(global, chatId, id, message.reactions, chat, newMessage.isOutgoing, currentMessage);
      }

      setGlobal(global);

      break;
    }

    case 'updateScheduledMessage': {
      const { chatId, id, message } = update;

      const currentMessage = selectScheduledMessage(global, chatId, id);
      if (!currentMessage) {
        return;
      }

      global = updateWithLocalMedia(global, chatId, id, message, true);
      const ids = Object.keys(selectChatScheduledMessages(global, chatId) || {}).map(Number).sort((a, b) => b - a);
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', ids);

      const threadId = selectThreadIdFromMessage(global, currentMessage);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadParam(global, chatId, threadId, 'scheduledIds', threadScheduledIds.sort((a, b) => b - a));
      }
      setGlobal(global);

      break;
    }

    case 'updateMessageSendSucceeded': {
      const { chatId, localId, message } = update;

      global = updateListedAndViewportIds(global, actions, message as ApiMessage);

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
      });

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
      if (thread?.threadInfo) {
        global = replaceThreadParam(global, chatId, thread.threadInfo.threadId, 'threadInfo', {
          ...thread.threadInfo,
          lastMessageId: message.id,
          lastReadInboxMessageId: message.id,
        });
      }

      setGlobal(global);

      break;
    }

    case 'updateScheduledMessageSendSucceeded': {
      const { chatId, localId, message } = update;
      const scheduledIds = selectScheduledIds(global, chatId, MAIN_THREAD_ID) || [];
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', [...scheduledIds, message.id]);

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId !== MAIN_THREAD_ID) {
        const threadScheduledIds = selectScheduledIds(global, chatId, threadId) || [];
        global = replaceThreadParam(global, chatId, threadId, 'scheduledIds', [...threadScheduledIds, message.id]);
      }

      const currentMessage = selectScheduledMessage(global, chatId, localId);

      global = deleteChatScheduledMessages(global, chatId, [localId]);
      global = updateScheduledMessage(global, chatId, message.id, {
        ...currentMessage,
        ...message,
        previousLocalId: localId,
      });

      setGlobal(global);
      break;
    }

    case 'updatePinnedIds': {
      const { chatId, isPinned, messageIds } = update;

      const messages = pickTruthy(selectChatMessages(global, chatId), messageIds);
      const updatePerThread: Record<number, number[]> = {
        [MAIN_THREAD_ID]: messageIds,
      };
      Object.values(messages).forEach((message) => {
        const threadId = selectThreadIdFromMessage(global, message);
        if (threadId === MAIN_THREAD_ID) return;
        const currentUpdatedInThread = updatePerThread[threadId] || [];
        currentUpdatedInThread.push(message.id);
        updatePerThread[threadId] = currentUpdatedInThread;
      });

      Object.entries(updatePerThread).forEach(([threadId, ids]) => {
        const pinnedIds = selectPinnedIds(global, chatId, MAIN_THREAD_ID) || [];
        const newPinnedIds = isPinned
          ? unique(pinnedIds.concat(ids)).sort((a, b) => b - a)
          : pinnedIds.filter((id) => !ids.includes(id));
        global = replaceThreadParam(global, chatId, Number(threadId), 'pinnedIds', newPinnedIds);
      });
      setGlobal(global);

      break;
    }

    case 'updateThreadInfo': {
      const {
        chatId, threadId, threadInfo, firstMessageId,
      } = update;

      const currentThreadInfo = selectThreadInfo(global, chatId, threadId);
      const newThreadInfo = {
        ...currentThreadInfo,
        ...threadInfo,
      };

      if (!newThreadInfo.threadId) {
        return;
      }

      global = updateThreadInfo(global, chatId, threadId, newThreadInfo as ApiThreadInfo);

      if (firstMessageId) {
        global = replaceThreadParam(global, chatId, threadId, 'firstMessageId', firstMessageId);
      }

      const chat = selectChat(global, chatId);
      if (chat?.isForum && threadInfo.lastReadInboxMessageId !== currentThreadInfo?.lastReadInboxMessageId) {
        actions.loadTopicById({ chatId, topicId: threadId });
      }

      setGlobal(global);

      break;
    }

    case 'resetMessages': {
      const { id: chatId } = update;
      const messagesById = selectChatMessages(global, chatId);

      if (messagesById && !isUserId(chatId)) {
        global = deleteChatMessages(global, chatId, Object.keys(messagesById).map(Number));
        setGlobal(global);
        actions.loadFullChat({ chatId, force: true, tabId: getCurrentTabId() });
      }

      break;
    }

    case 'deleteMessages': {
      const { ids, chatId } = update;

      deleteMessages(global, chatId, ids, actions);
      break;
    }

    case 'deleteScheduledMessages': {
      const { ids, chatId } = update;

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

      const message = selectChatMessageByPollId(global, pollId);

      if (message?.content.poll) {
        const oldResults = message.content.poll.results;
        let newResults = oldResults;
        if (pollUpdate.results?.results) {
          if (!oldResults.results || !pollUpdate.results.isMin) {
            newResults = pollUpdate.results;
          } else if (oldResults.results) {
            newResults = {
              ...pollUpdate.results,
              results: pollUpdate.results.results.map((result) => ({
                ...result,
                isChosen: oldResults.results!.find((r) => r.option === result.option)?.isChosen,
              })),
              isMin: undefined,
            };
          }
        }
        const updatedPoll = { ...message.content.poll, ...pollUpdate, results: newResults };

        global = updateChatMessage(
          global,
          message.chatId,
          message.id,
          {
            content: {
              ...message.content,
              poll: updatedPoll,
            },
          },
        );
        setGlobal(global);
      }
      break;
    }

    case 'updateMessagePollVote': {
      const { pollId, userId, options } = update;
      const message = selectChatMessageByPollId(global, pollId);
      if (!message || !message.content.poll || !message.content.poll.results) {
        break;
      }

      const { poll } = message.content;

      const { recentVoterIds, totalVoters, results } = poll.results;
      const newRecentVoterIds = recentVoterIds ? [...recentVoterIds] : [];
      const newTotalVoters = totalVoters ? totalVoters + 1 : 1;
      const newResults = results ? [...results] : [];

      newRecentVoterIds.push(userId);

      options.forEach((option) => {
        const targetOptionIndex = newResults.findIndex((result) => result.option === option);
        const targetOption = newResults[targetOptionIndex];
        const updatedOption: ApiPollResult = targetOption ? { ...targetOption } : { option, votersCount: 0 };

        updatedOption.votersCount += 1;
        if (userId === global.currentUserId) {
          updatedOption.isChosen = true;
        }

        if (targetOptionIndex) {
          newResults[targetOptionIndex] = updatedOption;
        } else {
          newResults.push(updatedOption);
        }
      });

      global = updateChatMessage(
        global,
        message.chatId,
        message.id,
        {
          content: {
            ...message.content,
            poll: {
              ...poll,
              results: {
                ...poll.results,
                recentVoterIds: newRecentVoterIds,
                totalVoters: newTotalVoters,
                results: newResults,
              },
            },
          },
        },
      );
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
      const { chatId, id, reactions } = update;
      const message = selectChatMessage(global, chatId, id);
      const chat = selectChat(global, update.chatId);

      if (!chat || !message) return;

      global = updateReactions(global, chatId, id, reactions, chat, message.isOutgoing, message);
      setGlobal(global);
      break;
    }

    case 'updateMessageExtendedMedia': {
      const {
        chatId, id, media, preview,
      } = update;
      const message = selectChatMessage(global, chatId, id);
      const chat = selectChat(global, update.chatId);

      if (!chat || !message) return;

      if (preview) {
        if (!message.content.invoice) return;
        global = updateChatMessage(global, chatId, id, {
          content: {
            ...message.content,
            invoice: {
              ...message.content.invoice,
              extendedMedia: preview,
            },
          },
        });
        setGlobal(global);
      } else if (media) {
        global = updateChatMessage(global, chatId, id, {
          content: {
            ...media,
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
  }
});

function updateReactions<T extends GlobalState>(
  global: T,
  chatId: string,
  id: number,
  reactions: ApiReactions,
  chat: ApiChat,
  isOutgoing?: boolean,
  message?: ApiMessage,
): T {
  const currentReactions = message?.reactions;

  // `updateMessageReactions` happens with an interval, so we try to avoid redundant global state updates
  if (currentReactions && areDeepEqual(reactions, currentReactions)) {
    return global;
  }

  global = updateChatMessage(global, chatId, id, { reactions });

  if (!isOutgoing) {
    return global;
  }

  const alreadyHasUnreadReaction = chat.unreadReactions?.includes(id);

  // Only notify about added reactions, not removed ones
  if (checkIfHasUnreadReactions(global, reactions) && !alreadyHasUnreadReaction) {
    global = updateUnreadReactions(global, chatId, {
      unreadReactionsCount: (chat?.unreadReactionsCount || 0) + 1,
      unreadReactions: [...(chat?.unreadReactions || []), id],
    });

    const newMessage = selectChatMessage(global, chatId, id);

    if (!chat || !newMessage) return global;

    onTickEnd(() => {
      notifyAboutMessage({
        chat,
        message: newMessage,
        isReaction: true,
      });
    });
  } else if (alreadyHasUnreadReaction) {
    global = updateUnreadReactions(global, chatId, {
      unreadReactionsCount: (chat?.unreadReactionsCount || 1) - 1,
      unreadReactions: chat?.unreadReactions?.filter((i) => i !== id),
    });
  }

  return global;
}

function updateWithLocalMedia(
  global: RequiredGlobalState, chatId: string, id: number, message: Partial<ApiMessage>, isScheduled = false,
) {
  // Preserve locally uploaded media.
  const currentMessage = isScheduled
    ? selectScheduledMessage(global, chatId, id)
    : selectChatMessage(global, chatId, id);
  if (currentMessage && message.content) {
    const {
      photo, video, sticker, document,
    } = getMessageContent(currentMessage);
    if (photo && message.content.photo) {
      message.content.photo.blobUrl = photo.blobUrl;
      message.content.photo.thumbnail = photo.thumbnail;
    } else if (video && message.content.video) {
      message.content.video.blobUrl = video.blobUrl;
    } else if (sticker && message.content.sticker) {
      message.content.sticker.isPreloadedGlobally = sticker.isPreloadedGlobally;
    } else if (document && message.content.document) {
      message.content.document.previewBlobUrl = document.previewBlobUrl;
    }
  }

  return isScheduled
    ? updateScheduledMessage(global, chatId, id, message)
    : updateChatMessage(global, chatId, id, message);
}

function updateThreadUnread<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, message: ApiMessage, isDeleting?: boolean,
) {
  const { chatId } = message;

  const { threadInfo } = selectThreadByMessage(global, message) || {};

  if (!threadInfo && message.replyToMessageId) {
    const originMessage = selectChatMessage(global, chatId, message.replyToMessageId);
    if (originMessage) {
      global = updateThreadUnreadFromForwardedMessage(global, originMessage, chatId, message.id, isDeleting);
    } else {
      actions.loadMessage({
        chatId,
        messageId: message.replyToMessageId,
        threadUpdate: {
          isDeleting,
          lastMessageId: message.id,
        },
      });
    }
  }

  return global;
}

function updateListedAndViewportIds<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, message: ApiMessage,
) {
  const { id, chatId } = message;

  const { threadInfo, firstMessageId } = selectThreadByMessage(global, message) || {};

  const chat = selectChat(global, chatId);
  const isUnreadChatNotLoaded = chat?.unreadCount && !selectListedIds(global, chatId, MAIN_THREAD_ID);

  global = updateThreadUnread(global, actions, message);

  if (threadInfo) {
    if (firstMessageId || !isMessageLocal(message)) {
      global = updateListedIds(global, chatId, threadInfo.threadId, [id]);

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        if (selectIsViewportNewest(global, chatId, threadInfo.threadId, tabId)) {
          global = addViewportId(global, chatId, threadInfo.threadId, id, tabId);

          if (!firstMessageId) {
            global = replaceThreadParam(global, chatId, threadInfo.threadId, 'firstMessageId', message.id);
          }
        }
      });
    }

    global = replaceThreadParam(global, chatId, threadInfo.threadId, 'threadInfo', {
      ...threadInfo,
      lastMessageId: message.id,
      messagesCount: (threadInfo.messagesCount || 0) + 1,
    });
  }

  if (isUnreadChatNotLoaded) {
    return global;
  }

  global = updateListedIds(global, chatId, MAIN_THREAD_ID, [id]);

  Object.values(global.byTabId).forEach(({ id: tabId }) => {
    if (selectIsViewportNewest(global, chatId, MAIN_THREAD_ID, tabId)) {
      // Always keep the first unread message in the viewport list
      const firstUnreadId = selectFirstUnreadId(global, chatId, MAIN_THREAD_ID, tabId);
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
  const { chats } = global;
  const chat = chats.byId[chatId];
  const currentLastMessage = chat?.lastMessage;

  const topic = chat?.isForum ? selectTopicFromMessage(global, message) : undefined;
  if (topic) {
    global = updateTopic(global, chatId, topic.id, {
      lastMessageId: message.id,
    });
  }

  if (currentLastMessage && !force) {
    const isSameOrNewer = (
      currentLastMessage.id === message.id || currentLastMessage.id === message.previousLocalId
    ) || message.id > currentLastMessage.id;

    if (!isSameOrNewer) {
      return global;
    }
  }

  global = updateChat(global, chatId, { lastMessage: message });

  return global;
}

function findLastMessage<T extends GlobalState>(global: T, chatId: string) {
  const byId = selectChatMessages(global, chatId);
  const listedIds = selectListedIds(global, chatId, MAIN_THREAD_ID);

  if (!byId || !listedIds) {
    return undefined;
  }

  let i = listedIds.length;
  while (i--) {
    const message = byId[listedIds[i]];
    if (!message.isDeleting) {
      return message;
    }
  }

  return undefined;
}

function deleteMessages<T extends GlobalState>(
  global: T, chatId: string | undefined, ids: number[], actions: RequiredGlobalActions,
) {
  // Channel update

  if (chatId) {
    const chat = selectChat(global, chatId);
    if (!chat) return;

    ids.forEach((id) => {
      global = updateChatMessage(global, chatId, id, {
        isDeleting: true,
      });

      const newLastMessage = findLastMessage(global, chatId);
      if (newLastMessage) {
        global = updateChatLastMessage(global, chatId, newLastMessage, true);
      }

      if (chat.topics?.[id]) {
        global = deleteTopic(global, chatId, id);
      }
    });

    actions.requestChatUpdate({ chatId });

    const threadIdsToUpdate: number[] = [];

    ids.forEach((id) => {
      const message = selectChatMessage(global, chatId, id);
      if (!message) {
        return;
      }

      global = updateThreadUnread(global, actions, message, true);

      const threadId = selectThreadIdFromMessage(global, message);
      if (threadId) {
        threadIdsToUpdate.push(threadId);
      }
    });

    setGlobal(global);

    setTimeout(() => {
      global = getGlobal();
      global = deleteChatMessages(global, chatId, ids);
      setGlobal(global);

      unique(threadIdsToUpdate).forEach((threadId) => {
        actions.requestThreadInfoUpdate({ chatId, threadId });
      });
    }, ANIMATION_DELAY);

    return;
  }

  // Common box update

  const chatsIdsToUpdate: string[] = [];

  ids.forEach((id) => {
    const commonBoxChatId = selectCommonBoxChatId(global, id);
    if (commonBoxChatId) {
      chatsIdsToUpdate.push(commonBoxChatId);

      global = updateChatMessage(global, commonBoxChatId, id, {
        isDeleting: true,
      });

      const newLastMessage = findLastMessage(global, commonBoxChatId);
      if (newLastMessage) {
        global = updateChatLastMessage(global, commonBoxChatId, newLastMessage, true);
      }

      setTimeout(() => {
        global = getGlobal();
        global = deleteChatMessages(global, commonBoxChatId, [id]);
        setGlobal(global);
      }, ANIMATION_DELAY);
    }
  });

  setGlobal(global);

  unique(chatsIdsToUpdate).forEach((id) => {
    actions.requestChatUpdate({ chatId: id });
  });
}

function deleteScheduledMessages<T extends GlobalState>(
  chatId: string | undefined, ids: number[], actions: RequiredGlobalActions, global: T,
) {
  if (!chatId) {
    return;
  }

  ids.forEach((id) => {
    global = updateScheduledMessage(global, chatId, id, {
      isDeleting: true,
    });
  });

  setGlobal(global);

  setTimeout(() => {
    global = getGlobal();
    global = deleteChatScheduledMessages(global, chatId, ids);
    const scheduledMessages = selectChatScheduledMessages(global, chatId);
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'scheduledIds', Object.keys(scheduledMessages || {}).map(Number),
    );
    setGlobal(global);
  }, ANIMATION_DELAY);
}
