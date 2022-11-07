import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type {
  ApiChat,
  ApiMessage, ApiPollResult, ApiReactions, ApiThreadInfo,
} from '../../../api/types';
import type { ActiveEmojiInteraction, GlobalActions, GlobalState } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { unique } from '../../../util/iteratees';
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
  selectScheduledMessages,
  selectIsMessageInCurrentMessageList,
  selectScheduledIds,
  selectCurrentMessageList,
  selectViewportIds,
  selectFirstUnreadId,
  selectChat,
  selectIsChatWithBot,
  selectIsServiceChatReady,
  selectLocalAnimatedEmojiEffect,
  selectLocalAnimatedEmoji,
} from '../../selectors';
import {
  getMessageContent, isUserId, isMessageLocal, getMessageText, checkIfHasUnreadReactions,
} from '../../helpers';
import { onTickEnd } from '../../../util/schedulers';
import { updateUnreadReactions } from '../../reducers/reactions';

const ANIMATION_DELAY = 350;

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'newMessage': {
      const {
        chatId, id, message, shouldForceReply,
      } = update;
      global = updateWithLocalMedia(global, chatId, id, message);
      global = updateListedAndViewportIds(global, actions, message as ApiMessage);

      if (message.threadInfo) {
        global = updateThreadInfo(
          global,
          message.threadInfo.chatId,
          message.threadInfo.threadId,
          message.threadInfo,
        );
      }

      const newMessage = selectChatMessage(global, chatId, id)!;

      const isLocal = isMessageLocal(message as ApiMessage);
      if (selectIsMessageInCurrentMessageList(global, chatId, message as ApiMessage)) {
        if (isLocal && message.isOutgoing && !(message.content?.action)) {
          const currentMessageList = selectCurrentMessageList(global);
          if (currentMessageList) {
            // We do not use `actions.focusLastMessage` as it may be set with a delay (see below)
            actions.focusMessage({
              chatId,
              threadId: currentMessageList.threadId,
              messageId: message.id,
              noHighlight: true,
              isResizingContainer: true,
            });
          }
        }

        const { threadInfo } = selectThreadByMessage(global, chatId, message as ApiMessage) || {};
        if (threadInfo) {
          actions.requestThreadInfoUpdate({ chatId, threadId: threadInfo.threadId });
        }

        // @perf Wait until scroll animation finishes or simply rely on delivery status update (which is itself delayed)
        if (!isLocal) {
          setTimeout(() => {
            let delayedGlobal = getGlobal();
            if (shouldForceReply) {
              delayedGlobal = replaceThreadParam(delayedGlobal, chatId, MAIN_THREAD_ID, 'replyingToId', id);
            }
            setGlobal(updateChatLastMessage(delayedGlobal, chatId, newMessage));
          }, ANIMATION_DELAY);
        }
      } else {
        global = updateChatLastMessage(global, chatId, newMessage);
      }

      setGlobal(global);

      // Edge case: New message in an old (not loaded) chat.
      if (!selectIsChatListed(global, chatId)) {
        actions.loadTopChats();
      }

      break;
    }

    case 'updateStartEmojiInteraction': {
      const { chatId: currentChatId } = selectCurrentMessageList(global) || {};

      if (currentChatId !== update.id) return;
      const message = selectChatMessage(global, currentChatId, update.messageId);

      if (!message) return;

      // Workaround for a weird behavior when interaction is received after watching reaction
      if (getMessageText(message) !== update.emoji) return;

      const localEmoji = selectLocalAnimatedEmoji(global, update.emoji);

      global = {
        ...global,
        activeEmojiInteractions: [...(global.activeEmojiInteractions || []), {
          id: global.activeEmojiInteractions?.length || 0,
          animatedEffect: localEmoji ? selectLocalAnimatedEmojiEffect(localEmoji) : update.emoji,
          messageId: update.messageId,
        } as ActiveEmojiInteraction],
      };

      setGlobal(global);

      break;
    }

    case 'newScheduledMessage': {
      const { chatId, id, message } = update;

      global = updateWithLocalMedia(global, chatId, id, message, true);

      const scheduledIds = selectScheduledIds(global, chatId) || [];
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', unique([...scheduledIds, id]));

      setGlobal(global);

      break;
    }

    case 'updateMessage': {
      const { chatId, id, message } = update;

      const currentMessage = selectChatMessage(global, chatId, id);

      const chat = selectChat(global, chatId);

      global = updateWithLocalMedia(global, chatId, id, message);

      const newMessage = selectChatMessage(global, chatId, id)!;
      if (message.threadInfo) {
        global = updateThreadInfo(
          global,
          message.threadInfo.chatId,
          message.threadInfo.threadId,
          message.threadInfo,
        );
      }
      if (currentMessage) {
        global = updateChatLastMessage(global, chatId, newMessage);
      }

      if (message.reactions && chat) {
        global = updateReactions(global, chatId, id, message.reactions, chat, message.isOutgoing, currentMessage);
      }

      setGlobal(global);

      // Scroll down if bot message height is changed with an updated inline keyboard.
      // A drawback: this will scroll down even if the previous scroll was not at bottom.
      if (
        currentMessage
        && chat
        && !message.isOutgoing
        && chat.lastMessage?.id === message.id
        && selectIsChatWithBot(global, chat)
        && selectIsMessageInCurrentMessageList(global, chatId, message as ApiMessage)
        && selectIsViewportNewest(global, chatId, message.threadInfo?.threadId || MAIN_THREAD_ID)
      ) {
        actions.focusLastMessage();
      }

      break;
    }

    case 'updateScheduledMessage': {
      const { chatId, id, message } = update;

      const currentMessage = selectScheduledMessage(global, chatId, id);
      if (!currentMessage) {
        return;
      }

      global = updateWithLocalMedia(global, chatId, id, message, true);
      const ids = Object.keys(selectScheduledMessages(global, chatId) || {}).map(Number).sort((a, b) => b - a);
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', ids);
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

      const thread = selectThreadByMessage(global, chatId, message);
      // For some reason Telegram requires to manually mark outgoing thread messages read
      if (thread?.threadInfo) {
        actions.markMessageListRead({ maxId: message.id });

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
      const scheduledIds = selectScheduledIds(global, chatId) || [];
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', [...scheduledIds, message.id]);

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

      const currentPinnedIds = selectPinnedIds(global, chatId) || [];
      const newPinnedIds = isPinned
        ? [...currentPinnedIds, ...messageIds].sort((a, b) => b - a)
        : currentPinnedIds.filter((id) => !messageIds.includes(id));

      setGlobal(replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'pinnedIds', newPinnedIds));

      break;
    }

    case 'updateThreadInfo': {
      const {
        chatId, threadId, threadInfo, firstMessageId,
      } = update;

      const currentThreadInfo = selectThreadInfo(global, chatId, threadId);
      const newTheadInfo = {
        ...currentThreadInfo,
        ...threadInfo,
      };

      if (!newTheadInfo.threadId) {
        return;
      }

      global = updateThreadInfo(global, chatId, threadId, newTheadInfo as ApiThreadInfo);

      if (firstMessageId) {
        global = replaceThreadParam(global, chatId, threadId, 'firstMessageId', firstMessageId);
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
        actions.loadFullChat({ chatId, force: true });
      }

      break;
    }

    case 'deleteMessages': {
      const { ids, chatId } = update;

      deleteMessages(chatId, ids, actions, global);
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
        setGlobal({
          ...global,
          serviceNotifications: global.serviceNotifications.map((notification) => ({
            ...notification,
            isDeleted: true,
          })),
        });
      }

      if (chatMessages) {
        const ids = Object.keys(chatMessages.byId).map(Number);
        deleteMessages(chatId, ids, actions, getGlobal());
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

        setGlobal(updateChatMessage(
          global,
          message.chatId,
          message.id,
          {
            content: {
              ...message.content,
              poll: updatedPoll,
            },
          },
        ));
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

      setGlobal(updateChatMessage(
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
      ));

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

      setGlobal(updateReactions(global, chatId, id, reactions, chat, message.isOutgoing, message));
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
        setGlobal(updateChatMessage(global, chatId, id, {
          content: {
            ...message.content,
            invoice: {
              ...message.content.invoice,
              extendedMedia: preview,
            },
          },
        }));
      } else if (media) {
        setGlobal(updateChatMessage(global, chatId, id, {
          content: {
            ...media,
          },
        }));
      }

      break;
    }

    case 'updateTranscribedAudio': {
      const { transcriptionId, text, isPending } = update;

      setGlobal({
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
      });
      break;
    }
  }
});

function updateReactions(
  global: GlobalState,
  chatId: string,
  id: number,
  reactions: ApiReactions,
  chat: ApiChat,
  isOutgoing?: boolean,
  message?: ApiMessage,
) {
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
  global: GlobalState, chatId: string, id: number, message: Partial<ApiMessage>, isScheduled = false,
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

function updateThreadUnread(global: GlobalState, actions: GlobalActions, message: ApiMessage, isDeleting?: boolean) {
  const { chatId } = message;

  const { threadInfo } = selectThreadByMessage(global, chatId, message) || {};

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

function updateListedAndViewportIds(global: GlobalState, actions: GlobalActions, message: ApiMessage) {
  const { id, chatId } = message;

  const { threadInfo, firstMessageId } = selectThreadByMessage(global, chatId, message) || {};

  const chat = selectChat(global, chatId);
  const isUnreadChatNotLoaded = chat?.unreadCount && !selectListedIds(global, chatId, MAIN_THREAD_ID);

  global = updateThreadUnread(global, actions, message);

  if (threadInfo) {
    if (firstMessageId || !isMessageLocal(message)) {
      global = updateListedIds(global, chatId, threadInfo.threadId, [id]);

      if (selectIsViewportNewest(global, chatId, threadInfo.threadId)) {
        global = addViewportId(global, chatId, threadInfo.threadId, id);

        if (!firstMessageId) {
          global = replaceThreadParam(global, chatId, threadInfo.threadId, 'firstMessageId', message.id);
        }
      }
    }

    global = replaceThreadParam(global, chatId, threadInfo.threadId, 'threadInfo', {
      ...threadInfo,
      lastMessageId: message.id,
      messagesCount: threadInfo.messagesCount + 1,
    });
  }

  if (isUnreadChatNotLoaded) {
    return global;
  }

  global = updateListedIds(global, chatId, MAIN_THREAD_ID, [id]);

  if (selectIsViewportNewest(global, chatId, MAIN_THREAD_ID)) {
    // Always keep the first unread message in the viewport list
    const firstUnreadId = selectFirstUnreadId(global, chatId, MAIN_THREAD_ID);
    const candidateGlobal = addViewportId(global, chatId, MAIN_THREAD_ID, id);
    const newViewportIds = selectViewportIds(candidateGlobal, chatId, MAIN_THREAD_ID);

    if (!firstUnreadId || newViewportIds!.includes(firstUnreadId)) {
      global = candidateGlobal;
    }
  }

  return global;
}

function updateChatLastMessage(
  global: GlobalState,
  chatId: string,
  message: ApiMessage,
  force = false,
) {
  const { chats } = global;
  const currentLastMessage = chats.byId[chatId]?.lastMessage;

  if (currentLastMessage && !force) {
    const isSameOrNewer = (
      currentLastMessage.id === message.id || currentLastMessage.id === message.previousLocalId
    ) || message.id > currentLastMessage.id;

    if (!isSameOrNewer) {
      return global;
    }
  }

  return updateChat(global, chatId, { lastMessage: message });
}

function findLastMessage(global: GlobalState, chatId: string) {
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

function deleteMessages(chatId: string | undefined, ids: number[], actions: GlobalActions, global: GlobalState) {
  // Channel update

  if (chatId) {
    ids.forEach((id) => {
      global = updateChatMessage(global, chatId, id, {
        isDeleting: true,
      });

      const newLastMessage = findLastMessage(global, chatId);
      if (newLastMessage) {
        global = updateChatLastMessage(global, chatId, newLastMessage, true);
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

      const { threadInfo } = selectThreadByMessage(global, chatId, message) || {};
      if (threadInfo) {
        threadIdsToUpdate.push(threadInfo.threadId);
      }
    });

    setGlobal(global);

    setTimeout(() => {
      setGlobal(deleteChatMessages(getGlobal(), chatId, ids));

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
        setGlobal(deleteChatMessages(getGlobal(), commonBoxChatId, [id]));
      }, ANIMATION_DELAY);
    }
  });

  setGlobal(global);

  unique(chatsIdsToUpdate).forEach((id) => {
    actions.requestChatUpdate({ chatId: id });
  });
}

function deleteScheduledMessages(
  chatId: string | undefined, ids: number[], actions: GlobalActions, global: GlobalState,
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
    global = deleteChatScheduledMessages(getGlobal(), chatId, ids);
    const scheduledMessages = selectScheduledMessages(global, chatId);
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'scheduledIds', Object.keys(scheduledMessages || {}).map(Number),
    );
    setGlobal(global);
  }, ANIMATION_DELAY);
}
