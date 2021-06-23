import { useMemo } from '../lib/teact/teact';
import { getDispatch } from '../lib/teact/teactn';

import { ApiChat, ApiUser } from '../api/types';

import {
  isChatArchived, getCanDeleteChat, isChatPrivate, isChatChannel,
} from '../modules/helpers';
import useLang from './useLang';

export default ({
  chat,
  privateChatUser,
  handleDelete,
  folderId,
  isPinned,
  isMuted,
}: {
  chat: ApiChat | undefined;
  privateChatUser: ApiUser | undefined;
  handleDelete: () => void;
  folderId?: number;
  isPinned?: boolean;
  isMuted?: boolean;
}) => {
  const lang = useLang();

  const {
    toggleChatPinned,
    updateChatMutedState,
    toggleChatArchived,
    toggleChatUnread,
  } = getDispatch();

  return useMemo(() => {
    if (!chat) {
      return undefined;
    }

    const isChatWithSelf = privateChatUser && privateChatUser.isSelf;

    const actionUnreadMark = chat.unreadCount || chat.hasUnreadMark
      ? { title: lang('MarkAsRead'), icon: 'readchats', handler: () => toggleChatUnread({ id: chat.id }) }
      : { title: lang('MarkAsUnread'), icon: 'unread', handler: () => toggleChatUnread({ id: chat.id }) };

    const actionPin = isPinned
      ? {
        title: lang('UnpinFromTop'),
        icon: 'unpin',
        handler: () => toggleChatPinned({ id: chat.id, folderId }),
      }
      : { title: lang('PinToTop'), icon: 'pin', handler: () => toggleChatPinned({ id: chat.id, folderId }) };

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
      title: isChatPrivate(chat.id)
        ? lang('Delete')
        : lang(getCanDeleteChat(chat)
          ? 'DeleteChat'
          : (isChatChannel(chat) ? 'LeaveChannel' : 'Group.LeaveGroup')),
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    };

    return [
      actionUnreadMark,
      actionPin,
      ...(!isChatWithSelf ? [
        actionMute,
        actionArchive,
      ] : []),
      actionDelete,
    ];
  }, [
    chat, privateChatUser, lang, isPinned, handleDelete, toggleChatUnread, toggleChatPinned, folderId,
    updateChatMutedState, toggleChatArchived, isMuted,
  ]);
};
