import { useMemo } from '../lib/teact/teact';
import { getDispatch } from '../lib/teact/teactn';

import { ApiChat, ApiUser } from '../api/types';

import {
  isChatArchived, getCanDeleteChat, isUserId, isChatChannel,
} from '../modules/helpers';
import { compact } from '../util/iteratees';
import useLang from './useLang';

const useChatContextActions = ({
  chat,
  user,
  folderId,
  isPinned,
  isMuted,
  canChangeFolder,
  handleDelete,
  handleChatFolderChange,
}: {
  chat: ApiChat | undefined;
  user: ApiUser | undefined;
  folderId?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  canChangeFolder?: boolean;
  handleDelete: () => void;
  handleChatFolderChange: () => void;
}, isInSearch = false) => {
  const lang = useLang();

  const { isSelf } = user || {};

  return useMemo(() => {
    if (!chat) {
      return undefined;
    }

    const {
      toggleChatPinned,
      updateChatMutedState,
      toggleChatArchived,
      toggleChatUnread,
    } = getDispatch();

    const actionAddToFolder = canChangeFolder ? {
      title: lang('ChatList.Filter.AddToFolder'),
      icon: 'folder',
      handler: handleChatFolderChange,
    } : undefined;

    const actionPin = isPinned
      ? {
        title: lang('UnpinFromTop'),
        icon: 'unpin',
        handler: () => toggleChatPinned({ id: chat.id, folderId }),
      }
      : { title: lang('PinToTop'), icon: 'pin', handler: () => toggleChatPinned({ id: chat.id, folderId }) };

    if (isInSearch) {
      return compact([actionPin, actionAddToFolder]);
    }

    const actionUnreadMark = chat.unreadCount || chat.hasUnreadMark
      ? { title: lang('MarkAsRead'), icon: 'readchats', handler: () => toggleChatUnread({ id: chat.id }) }
      : { title: lang('MarkAsUnread'), icon: 'unread', handler: () => toggleChatUnread({ id: chat.id }) };

    const actionMute = isMuted
      ? {
        title: lang('ChatList.Unmute'),
        icon: 'unmute',
        handler: () => updateChatMutedState({ chatId: chat.id, isMuted: false }),
      }
      : {
        title: lang('ChatList.Mute'),
        icon: 'mute',
        handler: () => updateChatMutedState({ chatId: chat.id, isMuted: true }),
      };

    const actionArchive = isChatArchived(chat)
      ? { title: lang('Unarchive'), icon: 'unarchive', handler: () => toggleChatArchived({ id: chat.id }) }
      : { title: lang('Archive'), icon: 'archive', handler: () => toggleChatArchived({ id: chat.id }) };

    const actionDelete = {
      title: isUserId(chat.id)
        ? lang('Delete')
        : lang(getCanDeleteChat(chat)
          ? 'DeleteChat'
          : (isChatChannel(chat) ? 'LeaveChannel' : 'Group.LeaveGroup')),
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    };

    const isInFolder = folderId !== undefined;

    return compact([
      actionAddToFolder,
      actionUnreadMark,
      actionPin,
      !isSelf && actionMute,
      !isSelf && !isInFolder && actionArchive,
      actionDelete,
    ]);
  }, [
    chat, canChangeFolder, lang, handleChatFolderChange, isPinned, isInSearch, isMuted, handleDelete, folderId, isSelf,
  ]);
};

export default useChatContextActions;
