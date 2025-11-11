import type { ApiChat, ApiMessage, ApiUpdateChat } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { ARCHIVED_FOLDER_ID, MAX_ACTIVE_PINNED_CHATS, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { isLocalMessageId } from '../../../util/keys/messageKey';
import { closeMessageNotifications, notifyAboutMessage } from '../../../util/notifications';
import { checkIfHasUnreadReactions, isChatChannel } from '../../helpers';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChatListIds,
  addUnreadMentions,
  deleteChatMessages,
  deletePeerPhoto,
  leaveChat,
  removeUnreadMentions,
  replacePeerPhotos,
  replacePinnedTopicIds,
  replaceThreadParam,
  updateChat,
  updateChatFullInfo,
  updateChatListType,
  updatePeerStoriesHidden,
  updateThreadInfo,
  updateTopic,
} from '../../reducers';
import { updateUnreadReactions } from '../../reducers/reactions';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatFullInfo,
  selectChatListType,
  selectChatMessages,
  selectCommonBoxChatId,
  selectCurrentMessageList,
  selectIsChatListed,
  selectPeer,
  selectTabState,
  selectThreadParam,
  selectTopicFromMessage,
} from '../../selectors';

const TYPING_STATUS_CLEAR_DELAY = 6000; // 6 seconds
const INVALIDATE_FULL_CHAT_FIELDS = new Set<keyof ApiChat>([
  'boostLevel', 'isForum', 'isLinkedInDiscussion', 'fakeType', 'restrictionReasons', 'isJoinToSend', 'isJoinRequest',
  'type',
]);

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateChat': {
      const localChat = selectChat(global, update.id);
      const { isForum: prevIsForum, lastReadOutboxMessageId } = localChat || {};

      if (update.chat.lastReadOutboxMessageId && lastReadOutboxMessageId
        && update.chat.lastReadOutboxMessageId < lastReadOutboxMessageId) {
        update = {
          ...update,
          chat: omit(update.chat, ['lastReadInboxMessageId']),
        };
      }

      global = updateChat(global, update.id, update.chat);

      if (localChat?.areStoriesHidden !== update.chat.areStoriesHidden) {
        global = updatePeerStoriesHidden(global, update.id, update.chat.areStoriesHidden || false);
      }

      setGlobal(global);

      const updatedChat = selectChat(global, update.id);
      if (!update.noTopChatsRequest && !selectIsChatListed(global, update.id)
        && !updatedChat?.isNotJoined) {
        // Reload top chats to update chat listing
        actions.loadTopChats();
      }

      if (update.chat.id) {
        closeMessageNotifications({
          chatId: update.chat.id,
          lastReadInboxMessageId: update.chat.lastReadInboxMessageId,
        });
      }

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const { chatId: currentChatId } = selectCurrentMessageList(global, tabId) || {};
        const chatUpdate = update as ApiUpdateChat;
        // The property `isForum` was changed in another client
        if (currentChatId === chatUpdate.id
          && 'isForum' in chatUpdate.chat && prevIsForum !== chatUpdate.chat.isForum) {
          if (prevIsForum) {
            actions.closeForumPanel({ tabId });
          }
          actions.openChat({ id: currentChatId, tabId });
        }
      });

      if (localChat) {
        const chatUpdate = update.chat;
        const changedFields = (Object.keys(chatUpdate) as (keyof ApiChat)[])
          .filter((key) => localChat[key] !== chatUpdate[key]);
        if (changedFields.some((key) => INVALIDATE_FULL_CHAT_FIELDS.has(key))) {
          actions.invalidateFullInfo({ peerId: update.id });
        }
      }

      return undefined;
    }

    case 'updateChatJoin': {
      const listType = selectChatListType(global, update.id);
      const chat = selectChat(global, update.id);

      global = updateChat(global, update.id, { isNotJoined: false });
      setGlobal(global);

      if (chat) {
        actions.requestChatUpdate({ chatId: chat.id });
      }

      actions.loadFullChat({ chatId: update.id, force: true });

      if (!listType) {
        return undefined;
      }

      global = getGlobal();
      global = addChatListIds(global, listType, [update.id]);
      setGlobal(global);

      return undefined;
    }

    case 'updateChatLeave': {
      global = leaveChat(global, update.id);
      const chat = selectChat(global, update.id);
      if (chat && isChatChannel(chat)) {
        const chatMessages = selectChatMessages(global, update.id);
        if (chatMessages) {
          const localMessageIds = Object.keys(chatMessages).map(Number).filter(isLocalMessageId);
          global = deleteChatMessages(global, chat.id, localMessageIds);
        }
      }

      return global;
    }

    case 'updateChatInbox': {
      const { id, threadId, lastReadInboxMessageId, unreadCount } = update;
      const chat = selectChat(global, id);
      if (chat?.isBotForum && threadId) {
        global = updateTopic(global, id, Number(threadId), {
          unreadCount,
        });
        return updateThreadInfo(global, id, threadId, {
          lastReadInboxMessageId,
        });
      } else {
        return updateChat(global, id, {
          lastReadInboxMessageId,
          unreadCount,
        });
      }
    }

    case 'updateChatTypingStatus': {
      const { id, threadId = MAIN_THREAD_ID, typingStatus } = update;
      global = replaceThreadParam(global, id, threadId, 'typingStatus', typingStatus);
      setGlobal(global);

      setTimeout(() => {
        global = getGlobal();
        const currentTypingStatus = selectThreadParam(global, id, threadId, 'typingStatus');
        if (typingStatus && currentTypingStatus && typingStatus.timestamp === currentTypingStatus.timestamp) {
          global = replaceThreadParam(global, id, threadId, 'typingStatus', undefined);
          setGlobal(global);
        }
      }, TYPING_STATUS_CLEAR_DELAY);

      return undefined;
    }

    case 'newMessage': {
      const { message } = update;

      const isOur = message.senderId ? message.senderId === global.currentUserId : message.isOutgoing;
      if (isOur && !message.isFromScheduled) {
        return undefined;
      }

      const isLocal = isLocalMessageId(message.id!);

      const chat = selectChat(global, update.chatId);
      if (!chat) {
        return undefined;
      }

      const hasMention = Boolean(update.message.id && update.message.hasUnreadMention);

      if (!isLocal || chat.id === SERVICE_NOTIFICATIONS_USER_ID) {
        global = updateChat(global, update.chatId, {
          unreadCount: chat.unreadCount ? chat.unreadCount + 1 : 1,
        });

        if (hasMention) {
          global = addUnreadMentions(global, update.chatId, chat, [update.message.id!], true);
        }

        const topic = chat.isForum ? selectTopicFromMessage(global, message as ApiMessage) : undefined;
        if (topic) {
          global = updateTopic(global, update.chatId, topic.id, {
            unreadCount: topic.unreadCount ? topic.unreadCount + 1 : 1,
          });
        }

        // TODO Replace draft with new message
      }

      setGlobal(global);

      notifyAboutMessage({
        chat,
        message,
      });

      return undefined;
    }

    case 'updateCommonBoxMessages':
    case 'updateChannelMessages': {
      const { ids, messageUpdate } = update;

      ids.forEach((id) => {
        const chatId = ('channelId' in update ? update.channelId : selectCommonBoxChatId(global, id))!;
        const chat = selectChat(global, chatId);

        if (messageUpdate.reactions && chat?.unreadReactionsCount
          && !checkIfHasUnreadReactions(global, messageUpdate.reactions)) {
          global = updateUnreadReactions(global, chatId, {
            unreadReactionsCount: Math.max(chat.unreadReactionsCount - 1, 0) || undefined,
            unreadReactions: chat.unreadReactions?.filter((i) => i !== id),
          });
        }

        if (!messageUpdate.hasUnreadMention && chat?.unreadMentionsCount) {
          global = removeUnreadMentions(global, chatId, chat, [id], true);
        }
      });

      return global;
    }

    case 'updateChatFullInfo': {
      return updateChatFullInfo(global, update.id, update.fullInfo);
    }

    case 'updatePinnedChatIds': {
      const { ids, folderId } = update;
      const listType = folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';
      if (!ids) {
        actions.loadPinnedDialogs({ listType });
        return global;
      }

      return {
        ...global,
        chats: {
          ...global.chats,
          orderedPinnedIds: {
            ...global.chats.orderedPinnedIds,
            [listType]: ids.length ? ids : undefined,
          },
        },
      };
    }

    case 'updatePinnedSavedDialogIds': {
      const { ids } = update;

      return {
        ...global,
        chats: {
          ...global.chats,
          orderedPinnedIds: {
            ...global.chats.orderedPinnedIds,
            saved: ids.length ? ids : undefined,
          },
        },
      };
    }

    case 'updateChatPinned': {
      const { id, isPinned } = update;
      const listType = selectChatListType(global, id);
      if (!listType) {
        return undefined;
      }

      const { [listType]: orderedPinnedIds } = global.chats.orderedPinnedIds;

      let newOrderedPinnedIds = orderedPinnedIds || [];
      if (!isPinned) {
        newOrderedPinnedIds = newOrderedPinnedIds.filter((pinnedId) => pinnedId !== id);
      } else if (!newOrderedPinnedIds.includes(id)) {
        // When moving pinned chats to archive, active ordered pinned ids don't get updated
        // (to preserve chat pinned state when it returns from archive)
        // If user already has max pinned chats, we should check for orderedIds
        // that don't point to listed chats
        if (listType === 'active' && newOrderedPinnedIds.length >= MAX_ACTIVE_PINNED_CHATS) {
          const listIds = global.chats.listIds.active;
          newOrderedPinnedIds = newOrderedPinnedIds.filter((pinnedId) => listIds && listIds.includes(pinnedId));
        }

        newOrderedPinnedIds = [id, ...newOrderedPinnedIds];
      }

      return {
        ...global,
        chats: {
          ...global.chats,
          orderedPinnedIds: {
            ...global.chats.orderedPinnedIds,
            [listType]: newOrderedPinnedIds.length ? newOrderedPinnedIds : undefined,
          },
        },
      };
    }

    case 'updateSavedDialogPinned': {
      const { id, isPinned } = update;

      const { saved: orderedPinnedIds } = global.chats.orderedPinnedIds;

      let newOrderedPinnedIds = orderedPinnedIds || [];
      if (!isPinned) {
        newOrderedPinnedIds = newOrderedPinnedIds.filter((pinnedId) => pinnedId !== id);
      } else if (!newOrderedPinnedIds.includes(id)) {
        newOrderedPinnedIds = [id, ...newOrderedPinnedIds];
      }

      return {
        ...global,
        chats: {
          ...global.chats,
          orderedPinnedIds: {
            ...global.chats.orderedPinnedIds,
            saved: newOrderedPinnedIds.length ? newOrderedPinnedIds : undefined,
          },
        },
      };
    }

    case 'updateChatListType': {
      const { id, folderId } = update;

      return updateChatListType(global, id, folderId);
    }

    case 'updateChatFolder': {
      const { id, folder } = update;
      const { byId: chatFoldersById, orderedIds } = global.chatFolders;

      const isDeleted = folder === undefined;

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const tabState = selectTabState(global, tabId);
        const isFolderActive = Object.values(chatFoldersById)[tabState.activeChatFolder - 1]?.id === id;

        if (isFolderActive) {
          global = updateTabState(global, { activeChatFolder: 0 }, tabId);
        }
      });

      const newChatFoldersById = !isDeleted ? { ...chatFoldersById, [id]: folder } : omit(chatFoldersById, [id]);
      const newOrderedIds = !isDeleted
        ? orderedIds?.includes(id) ? orderedIds : [...(orderedIds || []), id]
        : orderedIds?.filter((orderedId) => orderedId !== id);

      return {
        ...global,
        chatFolders: {
          ...global.chatFolders,
          byId: newChatFoldersById,
          orderedIds: newOrderedIds,
          invites: omit(global.chatFolders.invites, [id]),
        },
      };
    }

    case 'updateChatFoldersOrder': {
      const { orderedIds } = update;

      return {
        ...global,
        chatFolders: {
          ...global.chatFolders,
          orderedIds,
        },
      };
    }

    case 'updateRecommendedChatFolders': {
      const { folders } = update;

      return {
        ...global,
        chatFolders: {
          ...global.chatFolders,
          recommended: folders,
        },
      };
    }

    case 'updateChatMembers': {
      const targetChatFullInfo = selectChatFullInfo(global, update.id);
      const { replacedMembers, addedMember, deletedMemberId } = update;
      if (!targetChatFullInfo) {
        return undefined;
      }

      let shouldUpdate = false;
      let members = targetChatFullInfo?.members
        ? [...targetChatFullInfo.members]
        : [];

      if (replacedMembers) {
        members = replacedMembers;
        shouldUpdate = true;
      } else if (addedMember) {
        if (
          !members.length
          || !members.some((m) => m.userId === addedMember.userId)
        ) {
          members.push(addedMember);
          shouldUpdate = true;
        }
      } else if (members.length && deletedMemberId) {
        const deleteIndex = members.findIndex((m) => m.userId === deletedMemberId);
        if (deleteIndex > -1) {
          members.slice(deleteIndex, 1);
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        const adminMembers = members.filter(({ isOwner, isAdmin }) => isOwner || isAdmin);
        // TODO Kicked members?

        global = updateChat(global, update.id, { membersCount: members.length });
        global = updateChatFullInfo(global, update.id, {
          members,
          adminMembersById: buildCollectionByKey(adminMembers, 'userId'),
        });

        return global;
      }

      return undefined;
    }

    case 'draftMessage': {
      const {
        chatId, threadId, draft,
      } = update;
      const chat = global.chats.byId[chatId];
      if (!chat) {
        return undefined;
      }

      global = replaceThreadParam(global, chatId, threadId || MAIN_THREAD_ID, 'draft', draft);
      global = updateChat(global, chatId, { draftDate: draft?.date });
      return global;
    }

    case 'updatePendingJoinRequests': {
      const { chatId, requestsPending, recentRequesterIds } = update;
      const chat = global.chats.byId[chatId];
      if (!chat) {
        return undefined;
      }

      global = updateChatFullInfo(global, chatId, {
        requestsPending,
        recentRequesterIds,
      });
      setGlobal(global);

      actions.loadChatJoinRequests({ chatId });
      return undefined;
    }

    case 'updatePinnedTopic': {
      const { chatId, topicId, isPinned } = update;

      const chat = global.chats.byId[chatId];
      if (!chat) {
        return undefined;
      }

      global = updateTopic(global, chatId, topicId, {
        isPinned,
      });
      setGlobal(global);

      return undefined;
    }

    case 'updatePinnedTopicsOrder': {
      const { chatId, order } = update;

      const chat = global.chats.byId[chatId];
      if (!chat) return undefined;

      global = replacePinnedTopicIds(global, chatId, order);
      setGlobal(global);

      return undefined;
    }

    case 'updateTopic': {
      const { chatId, topicId } = update;

      const chat = selectChat(global, chatId);
      if (!chat?.isForum) return undefined;

      actions.loadTopicById({ chatId, topicId });

      return undefined;
    }

    case 'updateTopics': {
      const { chatId } = update;

      const chat = selectChat(global, chatId);
      if (!chat?.isForum) return undefined;

      actions.loadTopics({ chatId, force: true });

      return undefined;
    }

    case 'updateViewForumAsMessages': {
      const { chatId, isEnabled } = update;

      const chat = selectChat(global, chatId);
      if (!chat?.isForum) return undefined;

      global = updateChat(global, chatId, {
        isForumAsMessages: isEnabled,
      });
      setGlobal(global);
      break;
    }

    case 'updateNewProfilePhoto': {
      const { peerId, photo } = update;

      global = updateChat(global, peerId, {
        avatarPhotoId: photo.id,
      });
      setGlobal(global);

      actions.loadMoreProfilePhotos({ peerId, shouldInvalidateCache: true });

      break;
    }

    case 'updateDeleteProfilePhoto': {
      const { peerId, photoId } = update;

      const peer = selectPeer(global, peerId);
      if (!peer) {
        return undefined;
      }

      if (!photoId || peer.avatarPhotoId === photoId) {
        global = updateChat(global, peerId, {
          avatarPhotoId: undefined,
        });
        global = replacePeerPhotos(global, peerId, undefined);
      } else {
        global = deletePeerPhoto(global, peerId, photoId);
      }
      setGlobal(global);

      actions.loadMoreProfilePhotos({ peerId, shouldInvalidateCache: true });

      break;
    }
  }

  return undefined;
});
