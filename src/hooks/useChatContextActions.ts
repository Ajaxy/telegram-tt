import { useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import { ApiChat, ApiUser } from '../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import {
  isChatArchived, getCanDeleteChat, isUserId, isChatChannel, isChatGroup,
} from '../global/helpers';
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
  handleReport,
}: {
  chat: ApiChat | undefined;
  user: ApiUser | undefined;
  folderId?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  canChangeFolder?: boolean;
  handleDelete: () => void;
  handleChatFolderChange: () => void;
  handleReport?: () => void;
}, isInSearch = false) => {
  const lang = useLang();

  const { isSelf } = user || {};
  const isServiceNotifications = user?.id === SERVICE_NOTIFICATIONS_USER_ID;

  return useMemo(() => {
    if (!chat) {
      return undefined;
    }

    const {
      toggleChatPinned,
      updateChatMutedState,
      toggleChatArchived,
      toggleChatUnread,
    } = getActions();

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

    const canReport = handleReport && (isChatChannel(chat) || isChatGroup(chat) || (user && !user.isSelf));
    const actionReport = canReport
      ? { title: lang('ReportPeer.Report'), icon: 'flag', handler: handleReport }
      : undefined;

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
      !isSelf && !isServiceNotifications && !isInFolder && actionArchive,
      actionReport,
      actionDelete,
    ]);
  }, [
    chat, user, canChangeFolder, lang, handleChatFolderChange, isPinned, isInSearch, isMuted,
    handleDelete, handleReport, folderId, isSelf, isServiceNotifications,
  ]);
};

export default useChatContextActions;
