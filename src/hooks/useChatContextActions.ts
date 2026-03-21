import { useCallback, useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import type { MenuItemContextAction } from '../components/ui/ListItem';
import type { GlobalState } from '../global/types';
import { type ApiChat, type ApiUser, MAIN_THREAD_ID } from '../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import { getCanDeleteChat, isChatArchived, isChatChannel, isChatGroup } from '../global/helpers';
import { selectThreadReadState } from '../global/selectors/threads';
import { IS_TAURI } from '../util/browser/globalEnvironment';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../util/browser/windowEnvironment';
import { isUserId } from '../util/entities/ids';
import { buildCollectionByCallback, compact } from '../util/iteratees';
import useSelector, { useShallowSelector } from './data/useSelector';
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
  topicIds,
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
  topicIds?: number[];
  handleDelete?: NoneToVoidFunction;
  handleMute?: NoneToVoidFunction;
  handleUnmute?: NoneToVoidFunction;
  handleChatFolderChange: NoneToVoidFunction;
  handleReport?: NoneToVoidFunction;
}, isInSearch = false) => {
  const {
    toggleChatPinned,
    toggleSavedDialogPinned,
    toggleChatArchived,
    markChatMessagesRead,
    markChatUnread,
    openChatInNewTab,
    openQuickPreview,
  } = getActions();

  const lang = useLang();

  const { isSelf } = user || {};
  const isServiceNotifications = user?.id === SERVICE_NOTIFICATIONS_USER_ID;

  const topicsReadStateSelector = useCallback((global: GlobalState) => {
    if (!chat?.id) return undefined;
    return buildCollectionByCallback(topicIds || [], (tId) => (
      [tId, selectThreadReadState(global, chat?.id, tId)]
    ));
  }, [chat?.id, topicIds]);
  const topicsReadStates = useShallowSelector(topicsReadStateSelector);

  const chatReadStateSelector = useCallback((global: GlobalState) => {
    if (!chat?.id) return undefined;
    return selectThreadReadState(global, chat.id, MAIN_THREAD_ID);
  }, [chat?.id]);
  const chatReadState = useSelector(chatReadStateSelector);

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

  const preparedActions = useMemo(() => {
    if (!chat || isPreview) {
      return undefined;
    }

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
    } satisfies MenuItemContextAction;

    const actionQuickPreview = !isSavedDialog && !chat.isForum && {
      title: lang('QuickPreview'),
      icon: 'eye-outline',
      handler: () => {
        openQuickPreview({
          id: chat.id,
        });
      },
    } satisfies MenuItemContextAction;

    const togglePinned = () => {
      if (isSavedDialog) {
        toggleSavedDialogPinned({ id: chat.id });
      } else {
        toggleChatPinned({ id: chat.id, folderId: folderId! });
      }
    };

    const actionPin: MenuItemContextAction = isPinned
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

    const actionDelete = deleteTitle ? {
      title: deleteTitle,
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    } satisfies MenuItemContextAction : undefined;

    if (isSavedDialog) {
      return compact([actionOpenInNewTab, actionQuickPreview, actionPin, actionDelete]) as MenuItemContextAction[];
    }

    const actionAddToFolder = canChangeFolder ? {
      title: lang('ChatListContextAddToFolder'),
      icon: 'folder',
      handler: handleChatFolderChange,
    } satisfies MenuItemContextAction : undefined;

    const actionMute: MenuItemContextAction = isMuted
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

    const actionMarkAsRead = (
      chatReadState?.unreadCount || chatReadState?.hasUnreadMark
      || Object.values(topicsReadStates || {}).some((readState) => readState?.unreadCount)
    ) ? {
      title: lang('ChatListContextMarkAsRead'),
      icon: 'readchats',
      handler: () => markChatMessagesRead({ id: chat.id }),
    } satisfies MenuItemContextAction
      : undefined;
    const actionMarkAsUnread = !(chatReadState?.unreadCount || chatReadState?.hasUnreadMark) && !chat.isForum
      ? {
        title: lang('ChatListContextMarkAsUnread'), icon: 'unread', handler: () => markChatUnread({ id: chat.id }),
      } satisfies MenuItemContextAction
      : undefined;

    const actionArchive: MenuItemContextAction = isChatArchived(chat)
      ? { title: lang('Unarchive'), icon: 'unarchive', handler: () => toggleChatArchived({ id: chat.id }) }
      : { title: lang('Archive'), icon: 'archive', handler: () => toggleChatArchived({ id: chat.id }) };

    const canReport = handleReport && !user && (isChatChannel(chat) || isChatGroup(chat));
    const actionReport = canReport
      ? { title: lang('ReportPeerReport'), icon: 'flag', handler: handleReport } satisfies MenuItemContextAction
      : undefined;

    const isInFolder = folderId !== undefined;

    return compact<MenuItemContextAction>([
      actionOpenInNewTab,
      actionQuickPreview,
      actionAddToFolder,
      actionMarkAsRead,
      actionMarkAsUnread,
      actionPin,
      !isSelf && actionMute,
      !isSelf && !isServiceNotifications && !isInFolder && actionArchive,
      actionReport,
      actionDelete,
    ]);
  }, [
    chat, isPreview, lang, isSavedDialog, isPinned, deleteTitle, handleDelete, canChangeFolder,
    handleChatFolderChange, isMuted, handleUnmute, handleMute, isInSearch, chatReadState, topicsReadStates,
    handleReport, user, folderId, isSelf, isServiceNotifications, currentUserId,
  ]);

  return preparedActions;
};

export default useChatContextActions;
