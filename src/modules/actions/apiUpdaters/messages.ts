import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import {
  ApiUpdate, ApiMessage, ApiPollResult, ApiThreadInfo, MAIN_THREAD_ID,
} from '../../../api/types';

import { unique } from '../../../util/iteratees';
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
} from '../../reducers';
import { GlobalActions, GlobalState } from '../../../global/types';
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
  isMessageInCurrentMessageList,
  selectScheduledIds,
  selectCurrentMessageList,
  selectViewportIds,
  selectFirstUnreadId,
  selectChat,
} from '../../selectors';
import { getMessageContent, isChatPrivate, isMessageLocal } from '../../helpers';

const ANIMATION_DELAY = 350;

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'newMessage': {
      const { chatId, id, message } = update;
      global = updateWithLocalMedia(global, chatId, id, message);
      global = updateListedAndViewportIds(global, message as ApiMessage);

      if (message.threadInfo) {
        global = updateThreadInfo(
          global,
          message.threadInfo.chatId,
          message.threadInfo.threadId,
          message.threadInfo,
        );
      }

      setGlobal(global);

      const newMessage = selectChatMessage(global, chatId, id)!;

      if (isMessageInCurrentMessageList(global, chatId, message as ApiMessage)) {
        if (message.isOutgoing && !(message.content && message.content.action)) {
          const currentMessageList = selectCurrentMessageList(global);
          if (currentMessageList) {
            // We do not use `actions.focusLastMessage` as it may be set with a delay (see below)
            actions.focusMessage({
              chatId,
              threadId: currentMessageList.threadId,
              messageId: message.id,
              noHighlight: true,
            });
          }
        }

        const { threadInfo } = selectThreadByMessage(global, chatId, message as ApiMessage) || {};
        if (threadInfo) {
          actions.requestThreadInfoUpdate({ chatId, threadId: threadInfo.threadId });
        }

        // @perf Wait until scroll animation finishes or simply rely on delivery status update (which is itself delayed)
        if (!isMessageLocal(message as ApiMessage)) {
          setTimeout(() => {
            setGlobal(updateChatLastMessage(getGlobal(), chatId, newMessage));
          }, ANIMATION_DELAY);
        }
      } else {
        setGlobal(updateChatLastMessage(getGlobal(), chatId, newMessage));
      }

      // Edge case: New message in an old (not loaded) chat.
      if (!selectIsChatListed(global, chatId)) {
        actions.loadTopChats();
      }

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
      if (!currentMessage) {
        return;
      }

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
      global = updateChatLastMessage(global, chatId, newMessage);

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
      const ids = Object.keys(selectScheduledMessages(global, chatId) || {}).map(Number).sort((a, b) => b - a);
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', ids);
      setGlobal(global);

      break;
    }

    case 'updateMessageSendSucceeded': {
      const { chatId, localId, message } = update;

      global = updateListedAndViewportIds(global, message as ApiMessage);

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

      if (messagesById && !isChatPrivate(chatId)) {
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
      if (chatMessages) {
        const ids = Object.keys(chatMessages.byId).map(Number);
        deleteMessages(chatId, ids, actions, global);
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

      if (message && message.content.poll) {
        const updatedPoll = { ...message.content.poll, ...pollUpdate };

        // Workaround for poll update bug: `chosen` option gets reset when someone votes after current user
        const { results: updatedResults } = updatedPoll.results || {};
        if (updatedResults && !updatedResults.some(((result) => result.isChosen))) {
          const { results } = message.content.poll.results;
          const chosenAnswers = results && results.filter((result) => result.isChosen);
          if (chosenAnswers) {
            chosenAnswers.forEach((chosenAnswer) => {
              const chosenAnswerIndex = updatedResults.findIndex((result) => result.option === chosenAnswer.option);
              if (chosenAnswerIndex >= 0) {
                updatedPoll.results.results![chosenAnswerIndex].isChosen = true;
              }
            });
          }
        }

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
        const targetOption = newResults.find((result) => result.option === option);
        const targetOptionIndex = newResults.findIndex((result) => result.option === option);
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
  }
});

function updateWithLocalMedia(
  global: GlobalState, chatId: number, id: number, message: Partial<ApiMessage>, isScheduled = false,
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

function updateListedAndViewportIds(global: GlobalState, message: ApiMessage) {
  const { id, chatId } = message;

  const chat = selectChat(global, chatId);
  const isUnreadChatNotLoaded = chat && chat.unreadCount && !selectListedIds(global, chatId, MAIN_THREAD_ID);
  if (isUnreadChatNotLoaded) {
    return global;
  }

  global = updateListedIds(global, chatId, MAIN_THREAD_ID, [id]);

  if (selectIsViewportNewest(global, chatId, MAIN_THREAD_ID)) {
    // Always keep the first uread message in the viewport list
    const firstUnreadId = selectFirstUnreadId(global, chatId, MAIN_THREAD_ID);
    const newGlobal = addViewportId(global, chatId, MAIN_THREAD_ID, id);
    const newViewportIds = selectViewportIds(newGlobal, chatId, MAIN_THREAD_ID);

    if (!firstUnreadId || newViewportIds!.includes(firstUnreadId)) {
      global = newGlobal;
    }
  }

  const { threadInfo, firstMessageId } = selectThreadByMessage(global, chatId, message) || {};

  if (!firstMessageId && isMessageLocal(message)) {
    return global;
  }

  if (threadInfo) {
    global = updateListedIds(global, chatId, threadInfo.threadId, [id]);

    if (selectIsViewportNewest(global, chatId, threadInfo.threadId)) {
      global = addViewportId(global, chatId, threadInfo.threadId, id);

      if (!firstMessageId) {
        global = replaceThreadParam(global, chatId, threadInfo.threadId, 'firstMessageId', message.id);
      }

      if (!threadInfo.lastMessageId) {
        global = replaceThreadParam(global, chatId, threadInfo.threadId, 'threadInfo', {
          ...threadInfo,
          lastMessageId: message.id,
        });
      }
    }
  }

  return global;
}

function updateChatLastMessage(
  global: GlobalState,
  chatId: number,
  message: ApiMessage,
  force = false,
) {
  const { chats } = global;
  const currentLastMessage = chats.byId[chatId] && chats.byId[chatId].lastMessage;

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

function findLastMessage(global: GlobalState, chatId: number) {
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

function deleteMessages(chatId: number | undefined, ids: number[], actions: GlobalActions, global: GlobalState) {
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

    setGlobal(global);

    actions.requestChatUpdate({ chatId });

    const threadIdsToUpdate: number[] = [];

    ids.forEach((id) => {
      const message = selectChatMessage(global, chatId, id);
      if (!message) {
        return;
      }

      const { threadInfo } = selectThreadByMessage(global, chatId, message) || {};
      if (threadInfo) {
        threadIdsToUpdate.push(threadInfo.threadId);
      }
    });

    unique(threadIdsToUpdate).forEach((threadId) => {
      actions.requestThreadInfoUpdate({ chatId, threadId });
    });

    setTimeout(() => {
      setGlobal(deleteChatMessages(getGlobal(), chatId, ids));
    }, ANIMATION_DELAY);

    return;
  }

  // Common box update

  const chatsIdsToUpdate: number[] = [];

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
  chatId: number | undefined, ids: number[], actions: GlobalActions, global: GlobalState,
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
