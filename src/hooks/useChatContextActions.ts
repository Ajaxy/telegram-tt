import { useMemo } from '../lib/teact/teact';
import { getDispatch } from '../lib/teact/teactn';
import { ApiChat, ApiUser } from '../api/types';
import { isChatArchived, getCanDeleteChat, isChatPrivate } from '../modules/helpers';

export default ({
  chat,
  privateChatUser,
  handleDelete,
  folderId,
  isPinned,
}: {
  chat: ApiChat | undefined;
  privateChatUser: ApiUser | undefined;
  handleDelete: () => void;
  folderId?: number;
  isPinned?: boolean;
}) => {
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
      ? { title: 'Mark as Read', icon: 'readchats', handler: () => toggleChatUnread({ id: chat.id }) }
      : { title: 'Mark as Unread', icon: 'unread', handler: () => toggleChatUnread({ id: chat.id }) };

    const actionPin = isPinned
      ? { title: 'Unpin', icon: 'unpin', handler: () => toggleChatPinned({ id: chat.id, folderId }) }
      : { title: 'Pin', icon: 'pin', handler: () => toggleChatPinned({ id: chat.id, folderId }) };

    const actionMute = chat.isMuted
      ? { title: 'Unmute', icon: 'unmute', handler: () => updateChatMutedState({ chatId: chat.id, isMuted: false }) }
      : { title: 'Mute', icon: 'mute', handler: () => updateChatMutedState({ chatId: chat.id, isMuted: true }) };

    const actionArchive = isChatArchived(chat)
      ? { title: 'Unarchive', icon: 'unarchive', handler: () => toggleChatArchived({ id: chat.id }) }
      : { title: 'Archive', icon: 'archive', handler: () => toggleChatArchived({ id: chat.id }) };

    const actionDelete = {
      title: isChatPrivate(chat.id) ? 'Delete' : (getCanDeleteChat(chat) ? 'Delete and Leave' : 'Leave'),
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
    chat, privateChatUser, handleDelete, folderId, isPinned,
    toggleChatPinned, updateChatMutedState, toggleChatArchived, toggleChatUnread,
  ]);
};
