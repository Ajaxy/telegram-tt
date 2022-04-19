import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { MAIN_THREAD_ID } from '../../../api/types';

import { ARCHIVED_FOLDER_ID, MAX_ACTIVE_PINNED_CHATS } from '../../../config';
import { pick } from '../../../util/iteratees';
import { closeMessageNotifications, notifyAboutMessage } from '../../../util/notifications';
import { getMessageRecentReaction } from '../../helpers';
import {
  updateChat,
  updateChatListIds,
  updateChatListType,
  replaceThreadParam,
  leaveChat,
} from '../../reducers';
import {
  selectChat,
  selectCommonBoxChatId,
  selectIsChatListed,
  selectChatListType,
  selectCurrentMessageList,
} from '../../selectors';

const TYPING_STATUS_CLEAR_DELAY = 6000; // 6 seconds
// Enough to animate and mark as read in Message List
const CURRENT_CHAT_UNREAD_DELAY = 1500;

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updateChat': {
      setGlobal(updateChat(global, update.id, update.chat, update.newProfilePhoto));

      if (!update.noTopChatsRequest && !selectIsChatListed(global, update.id)) {
        // Chat can appear in dialogs list.
        actions.loadTopChats();
      }

      if (update.chat.id) {
        closeMessageNotifications({
          chatId: update.chat.id,
          lastReadInboxMessageId: update.chat.lastReadInboxMessageId,
        });
      }

      return undefined;
    }

    case 'updateChatJoin': {
      const listType = selectChatListType(global, update.id);
      if (!listType) {
        return undefined;
      }

      global = updateChatListIds(global, listType, [update.id]);
      global = updateChat(global, update.id, { isNotJoined: false });
      setGlobal(global);

      const chat = selectChat(global, update.id);
      if (chat) {
        actions.requestChatUpdate({ chatId: chat.id });
      }

      return undefined;
    }

    case 'updateChatLeave': {
      return leaveChat(global, update.id);
    }

    case 'updateChatInbox': {
      return updateChat(global, update.id, update.chat);
    }

    case 'updateChatTypingStatus': {
      const { id, typingStatus } = update;
      setGlobal(updateChat(global, id, { typingStatus }));

      setTimeout(() => {
        global = getGlobal();
        const chat = selectChat(global, id);
        if (chat && typingStatus && chat.typingStatus && chat.typingStatus.timestamp === typingStatus.timestamp) {
          setGlobal(updateChat(global, id, { typingStatus: undefined }));
        }
      }, TYPING_STATUS_CLEAR_DELAY);

      return undefined;
    }

    case 'newMessage': {
      const { message } = update;
      const { chatId: currentChatId, threadId, type: messageListType } = selectCurrentMessageList(global) || {};

      if (message.senderId === global.currentUserId && !message.isFromScheduled) {
        return undefined;
      }

      const chat = selectChat(global, update.chatId);
      if (!chat) {
        return undefined;
      }

      const isActiveChat = (
        messageListType === 'thread'
        && threadId === MAIN_THREAD_ID
        && update.chatId === currentChatId
      );

      if (isActiveChat) {
        setTimeout(() => {
          actions.requestChatUpdate({ chatId: update.chatId });
        }, CURRENT_CHAT_UNREAD_DELAY);
      } else {
        setGlobal(updateChat(global, update.chatId, {
          unreadCount: chat.unreadCount ? chat.unreadCount + 1 : 1,
          ...(update.message.hasUnreadMention && {
            unreadMentionsCount: chat.unreadMentionsCount ? chat.unreadMentionsCount + 1 : 1,
          }),
        }));
      }

      notifyAboutMessage({
        chat,
        message,
      });

      return undefined;
    }

    case 'updateMessage': {
      const { message } = update;
      const chat = selectChat(global, update.chatId);
      if (!chat) {
        return undefined;
      }

      if (getMessageRecentReaction(message)) {
        notifyAboutMessage({
          chat,
          message,
          isReaction: true,
        });
      }

      return undefined;
    }

    case 'updateCommonBoxMessages':
    case 'updateChannelMessages': {
      const { ids, messageUpdate } = update;
      if (messageUpdate.hasUnreadMention !== false) {
        return undefined;
      }

      ids.forEach((id) => {
        const chatId = ('channelId' in update ? update.channelId : selectCommonBoxChatId(global, id))!;
        const chat = selectChat(global, chatId);
        if (chat?.unreadMentionsCount) {
          global = updateChat(global, chatId, {
            unreadMentionsCount: chat.unreadMentionsCount - 1,
          });
        }
      });

      return global;
    }

    case 'updateChatFullInfo': {
      const { fullInfo } = update;
      const targetChat = global.chats.byId[update.id];
      if (!targetChat) {
        return undefined;
      }

      return updateChat(global, update.id, {
        fullInfo: {
          ...targetChat.fullInfo,
          ...fullInfo,
        },
      });
    }

    case 'updatePinnedChatIds': {
      const { ids, folderId } = update;
      const listType = folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';

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

    case 'updateChatListType': {
      const { id, folderId } = update;

      return updateChatListType(global, id, folderId);
    }

    case 'updateChatFolder': {
      const { id, folder } = update;
      const { byId: chatFoldersById, orderedIds } = global.chatFolders;

      const newChatFoldersById = folder
        ? { ...chatFoldersById, [id]: folder }
        : pick(
          chatFoldersById,
          Object.keys(chatFoldersById).map(Number).filter((folderId) => folderId !== id),
        );

      const newOrderedIds = folder
        ? orderedIds && orderedIds.includes(id) ? orderedIds : [...(orderedIds || []), id]
        : orderedIds ? orderedIds.filter((orderedId) => orderedId !== id) : undefined;

      return {
        ...global,
        chatFolders: {
          ...global.chatFolders,
          byId: newChatFoldersById,
          orderedIds: newOrderedIds,
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
      const targetChat = global.chats.byId[update.id];
      const { replacedMembers, addedMember, deletedMemberId } = update;
      if (!targetChat) {
        return undefined;
      }

      let shouldUpdate = false;
      let members = targetChat.fullInfo?.members
        ? [...targetChat.fullInfo.members]
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

        return updateChat(global, update.id, {
          membersCount: members.length,
          fullInfo: {
            ...targetChat.fullInfo,
            members,
            adminMembers,
          },
        });
      }

      return undefined;
    }

    case 'deleteProfilePhotos': {
      const { chatId, ids } = update;
      const chat = global.chats.byId[chatId];

      if (chat?.photos) {
        return updateChat(global, chatId, {
          photos: chat.photos.filter((photo) => !ids.includes(photo.id)),
        });
      }

      return undefined;
    }

    case 'draftMessage': {
      const {
        chatId, formattedText, date, replyingToId,
      } = update;
      const chat = global.chats.byId[chatId];
      if (!chat) {
        return undefined;
      }

      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'draft', formattedText);
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'replyingToId', replyingToId);
      global = updateChat(global, chatId, { draftDate: date });
      return global;
    }

    case 'showInvite': {
      const { data } = update;

      actions.showDialog({ data });

      return undefined;
    }

    case 'updatePendingJoinRequests': {
      const { chatId, requestsPending, recentRequesterIds } = update;
      const chat = global.chats.byId[chatId];
      if (!chat) {
        return undefined;
      }

      global = updateChat(global, chatId, {
        fullInfo: {
          ...chat.fullInfo,
          requestsPending,
          recentRequesterIds,
        },
      });
      setGlobal(global);

      actions.loadChatJoinRequests({ chatId });
    }
  }

  return undefined;
});
