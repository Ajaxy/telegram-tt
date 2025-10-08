import { useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiChat, ApiTopic, ApiUser } from '../api/types';
import type { MenuItemContextAction } from '../components/ui/ListItem';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import { getCanDeleteChat, isChatArchived, isChatChannel, isChatGroup } from '../global/helpers';
import { IS_TAURI } from '../util/browser/globalEnvironment';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../util/browser/windowEnvironment';
import { isUserId } from '../util/entities/ids';
import { compact } from '../util/iteratees';
import useLang from './useLang';

const useChatContextActions = ({
  chat,
  user,
  folderId,
  isPinned,
  isMuted,
  canChangeFolder,
  isSavedDialog,
  currentUserId,
  isPreview,
  topics,
  handleDelete,
  handleMute,
  handleUnmute,
  handleChatFolderChange,
  handleReport,
}: {
  chat: ApiChat | undefined;
  user: ApiUser | undefined;
  folderId?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  canChangeFolder?: boolean;
  isSavedDialog?: boolean;
  currentUserId?: string;
  isPreview?: boolean;
  topics?: Record<number, ApiTopic>;
  handleDelete?: NoneToVoidFunction;
  handleMute?: NoneToVoidFunction;
  handleUnmute?: NoneToVoidFunction;
  handleChatFolderChange: NoneToVoidFunction;
  handleReport?: NoneToVoidFunction;
}, isInSearch = false) => {
  const lang = useLang();

  const { isSelf } = user || {};
  const isServiceNotifications = user?.id === SERVICE_NOTIFICATIONS_USER_ID;

  const deleteTitle = useMemo(() => {
    if (!chat) return undefined;

    if (isSavedDialog) {
      return lang('Delete');
    }

    if (isUserId(chat.id)) {
      return lang('DeleteChat');
    }

    if (getCanDeleteChat(chat)) {
      return lang('DeleteChat');
    }

    if (isChatChannel(chat)) {
      return lang('ChannelLeave');
    }

    return lang('GroupLeaveGroup');
  }, [chat, isSavedDialog, lang]);

  return useMemo(() => {
    if (!chat || isPreview) {
      return undefined;
    }

    const {
      toggleChatPinned,
      toggleSavedDialogPinned,
      toggleChatArchived,
      markChatMessagesRead,
      markChatUnread,
      openChatInNewTab,
      openQuickPreview,
    } = getActions();

    const actionOpenInNewTab = IS_OPEN_IN_NEW_TAB_SUPPORTED && {
      title: IS_TAURI ? lang('ChatListOpenInNewWindow') : lang('ChatListOpenInNewTab'),
      icon: 'open-in-new-tab',
      handler: () => {
        if (isSavedDialog) {
          openChatInNewTab({ chatId: currentUserId!, threadId: chat.id });
        } else {
          openChatInNewTab({ chatId: chat.id });
        }
      },
    };

    const actionQuickPreview = !isSavedDialog && !chat.isForum && {
      title: lang('QuickPreview'),
      icon: 'eye-outline',
      handler: () => {
        openQuickPreview({
          id: chat.id,
        });
      },
    };

    const togglePinned = () => {
      if (isSavedDialog) {
        toggleSavedDialogPinned({ id: chat.id });
      } else {
        toggleChatPinned({ id: chat.id, folderId: folderId! });
      }
    };

    const actionPin = isPinned
      ? {
        title: lang('ChatListUnpinFromTop'),
        icon: 'unpin',
        handler: togglePinned,
      }
      : {
        title: lang('ChatListPinToTop'),
        icon: 'pin',
        handler: togglePinned,
      };

    const actionDelete = {
      title: deleteTitle,
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    };

    if (isSavedDialog) {
      return compact([actionOpenInNewTab, actionQuickPreview, actionPin, actionDelete]) as MenuItemContextAction[];
    }

    const actionAddToFolder = canChangeFolder ? {
      title: lang('ChatListContextAddToFolder'),
      icon: 'folder',
      handler: handleChatFolderChange,
    } : undefined;

    const actionMute = isMuted
      ? {
        title: lang('ChatsUnmute'),
        icon: 'unmute',
        handler: handleUnmute,
      }
      : {
        title: `${lang('ChatsMute')}...`,
        icon: 'mute',
        handler: handleMute,
      };

    if (isInSearch) {
      return compact([
        actionOpenInNewTab, actionQuickPreview, actionPin, actionAddToFolder, actionMute,
      ]) as MenuItemContextAction[];
    }

    const actionMaskAsRead = (
      chat.unreadCount || chat.hasUnreadMark || Object.values(topics || {}).some(({ unreadCount }) => unreadCount)
    )
      ? {
        title: lang('ChatListContextMaskAsRead'),
        icon: 'readchats',
        handler: () => markChatMessagesRead({ id: chat.id }),
      } : undefined;
    const actionMarkAsUnread = !(chat.unreadCount || chat.hasUnreadMark) && !chat.isForum
      ? { title: lang('ChatListContextMaskAsUnread'), icon: 'unread', handler: () => markChatUnread({ id: chat.id }) }
      : undefined;

    const actionArchive = isChatArchived(chat)
      ? { title: lang('Unarchive'), icon: 'unarchive', handler: () => toggleChatArchived({ id: chat.id }) }
      : { title: lang('Archive'), icon: 'archive', handler: () => toggleChatArchived({ id: chat.id }) };

    const canReport = handleReport && !user && (isChatChannel(chat) || isChatGroup(chat));
    const actionReport = canReport
      ? { title: lang('ReportPeerReport'), icon: 'flag', handler: handleReport }
      : undefined;

    const isInFolder = folderId !== undefined;

    return compact([
      actionOpenInNewTab,
      actionQuickPreview,
      actionAddToFolder,
      actionMaskAsRead,
      actionMarkAsUnread,
      actionPin,
      !isSelf && actionMute,
      !isSelf && !isServiceNotifications && !isInFolder && actionArchive,
      actionReport,
      actionDelete,
    ]) as MenuItemContextAction[];
  }, [
    chat, user, canChangeFolder, lang, handleChatFolderChange, isPinned, isInSearch, isMuted, currentUserId,
    handleDelete, handleMute, handleReport, folderId, isSelf, isServiceNotifications, isSavedDialog, deleteTitle,
    isPreview, topics, handleUnmute,
  ]);
};

export default useChatContextActions;
