import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { ApiUpdate, MAIN_THREAD_ID } from '../../../api/types';

import { ARCHIVED_FOLDER_ID, MAX_ACTIVE_PINNED_CHATS } from '../../../config';
import { pick } from '../../../util/iteratees';
import { showNewMessageNotification } from '../../../util/notifications';
import { updateAppBadge } from '../../../util/appBadge';
import {
  updateChat,
  replaceChatListIds,
  updateChatListIds,
  updateChatListType,
  replaceThreadParam,
} from '../../reducers';
import {
  selectChat,
  selectCommonBoxChatId,
  selectIsChatListed,
  selectChatListType,
  selectCurrentMessageList,
  selectCountNotMutedUnread,
  selectNotifySettings,
} from '../../selectors';
import { throttle } from '../../../util/schedulers';

const TYPING_STATUS_CLEAR_DELAY = 6000; // 6 seconds
// Enough to animate and mark as read in Message List
const CURRENT_CHAT_UNREAD_DELAY = 1500;

const runThrottledForUpdateAppBadge = throttle((cb) => cb(), 500, true);

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'updateChat': {
      if (!update.noTopChatsRequest && !selectIsChatListed(global, update.id)) {
        // Chat can appear in dialogs list.
        actions.loadTopChats();
      }

      const newGlobal = updateChat(global, update.id, update.chat, update.newProfilePhoto);
      setGlobal(newGlobal);

      runThrottledForUpdateAppBadge(() => updateAppBadge(selectCountNotMutedUnread(getGlobal())));
      break;
    }

    case 'updateChatJoin': {
      const listType = selectChatListType(global, update.id);
      if (!listType) {
        break;
      }

      global = updateChatListIds(global, listType, [update.id]);
      global = updateChat(global, update.id, { isNotJoined: false });
      setGlobal(global);

      const chat = selectChat(global, update.id);
      if (chat) {
        actions.requestChatUpdate({ chatId: chat.id });
      }
      break;
    }

    case 'updateChatLeave': {
      const listType = selectChatListType(global, update.id);
      if (!listType) {
        break;
      }

      const { [listType]: listIds } = global.chats.listIds;

      if (listIds) {
        global = replaceChatListIds(global, listType, listIds.filter((listId) => listId !== update.id));
      }

      global = updateChat(global, update.id, { isNotJoined: true });
      setGlobal(global);

      break;
    }

    case 'updateChatInbox': {
      setGlobal(updateChat(global, update.id, update.chat));

      runThrottledForUpdateAppBadge(() => updateAppBadge(selectCountNotMutedUnread(getGlobal())));

      break;
    }

    case 'updateChatTypingStatus': {
      const { id, typingStatus } = update;
      setGlobal(updateChat(global, id, { typingStatus }));

      setTimeout(() => {
        const newGlobal = getGlobal();
        const chat = selectChat(newGlobal, id);
        if (chat && typingStatus && chat.typingStatus && chat.typingStatus.timestamp === typingStatus.timestamp) {
          setGlobal(updateChat(newGlobal, id, { typingStatus: undefined }));
        }
      }, TYPING_STATUS_CLEAR_DELAY);

      break;
    }

    case 'newMessage': {
      const { message } = update;
      const { chatId: currentChatId, threadId, type: messageListType } = selectCurrentMessageList(global) || {};

      if (message.senderId === global.currentUserId && !message.isFromScheduled) {
        return;
      }

      const chat = selectChat(global, update.chatId);
      if (!chat) {
        return;
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

      updateAppBadge(selectCountNotMutedUnread(getGlobal()));

      const { hasWebNotifications } = selectNotifySettings(global);
      if (hasWebNotifications) {
        showNewMessageNotification({
          chat,
          message,
          isActiveChat,
        });
      }

      break;
    }

    case 'updateCommonBoxMessages':
    case 'updateChannelMessages': {
      const { ids, messageUpdate } = update;
      if (messageUpdate.hasUnreadMention !== false) {
        return;
      }

      ids.forEach((id) => {
        const chatId = 'channelId' in update ? update.channelId : selectCommonBoxChatId(global, id);
        const chat = selectChat(global, chatId);
        if (chat && chat.unreadMentionsCount) {
          global = updateChat(global, chatId, {
            unreadMentionsCount: chat.unreadMentionsCount - 1,
          });
        }
      });

      setGlobal(global);

      break;
    }

    case 'updateChatFullInfo': {
      const { fullInfo } = update;
      const targetChat = global.chats.byId[update.id];
      if (!targetChat) {
        return;
      }

      setGlobal(updateChat(global, update.id, {
        fullInfo: {
          ...targetChat.fullInfo,
          ...fullInfo,
        },
      }));

      break;
    }

    case 'updatePinnedChatIds': {
      const { ids, folderId } = update;

      const listType = folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';

      global = {
        ...global,
        chats: {
          ...global.chats,
          orderedPinnedIds: {
            ...global.chats.orderedPinnedIds,
            [listType]: ids.length ? ids : undefined,
          },
        },
      };

      setGlobal(global);

      break;
    }

    case 'updateChatPinned': {
      const { id, isPinned } = update;
      const listType = selectChatListType(global, id);
      if (listType) {
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

        global = {
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

      setGlobal(global);

      break;
    }

    case 'updateChatListType': {
      const { id, folderId } = update;

      setGlobal(updateChatListType(global, id, folderId));

      break;
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

      setGlobal({
        ...global,
        chatFolders: {
          ...global.chatFolders,
          byId: newChatFoldersById,
          orderedIds: newOrderedIds,
        },
      });

      break;
    }

    case 'updateChatFoldersOrder': {
      const { orderedIds } = update;

      setGlobal({
        ...global,
        chatFolders: {
          ...global.chatFolders,
          orderedIds,
        },
      });

      break;
    }

    case 'updateRecommendedChatFolders': {
      const { folders } = update;

      setGlobal({
        ...global,
        chatFolders: {
          ...global.chatFolders,
          recommended: folders,
        },
      });

      break;
    }

    case 'updateChatMembers': {
      const targetChat = global.chats.byId[update.id];
      const { replacedMembers, addedMember, deletedMemberId } = update;
      if (!targetChat) {
        return;
      }

      let shouldUpdate = false;
      let members = targetChat.fullInfo && targetChat.fullInfo.members
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

        setGlobal(updateChat(global, update.id, {
          membersCount: members.length,
          fullInfo: {
            ...targetChat.fullInfo,
            members,
            adminMembers,
          },
        }));
      }

      break;
    }

    case 'deleteProfilePhotos': {
      const { chatId, ids } = update;
      const chat = global.chats.byId[chatId];

      if (chat && chat.photos) {
        setGlobal(updateChat(global, chatId, {
          photos: chat.photos.filter((photo) => !ids.includes(photo.id)),
        }));
      }
      break;
    }

    case 'draftMessage': {
      const {
        chatId, formattedText, date, replyingToId,
      } = update;
      const chat = global.chats.byId[chatId];

      if (chat) {
        global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'draft', formattedText);
        global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'replyingToId', replyingToId);
        global = updateChat(global, chatId, { draftDate: date });

        setGlobal(global);
      }
      break;
    }

    case 'showInvite': {
      const { data } = update;

      actions.showDialog({ data });
      break;
    }
  }
});
