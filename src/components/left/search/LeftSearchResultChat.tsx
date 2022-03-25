import React, {
  FC, memo, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import { ApiChat, ApiUser } from '../../../api/types';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import { isUserId, getPrivateChatUserId, selectIsChatMuted } from '../../../global/helpers';
import {
  selectChat, selectUser, selectIsChatPinned, selectNotifySettings, selectNotifyExceptions,
} from '../../../global/selectors';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import GroupChatInfo from '../../common/GroupChatInfo';
import DeleteChatModal from '../../common/DeleteChatModal';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';

type OwnProps = {
  chatId: string;
  withUsername?: boolean;
  onClick: (id: string) => void;
};

type StateProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isPinned?: boolean;
  isMuted?: boolean;
  canChangeFolder?: boolean;
};

const LeftSearchResultChat: FC<OwnProps & StateProps> = ({
  chatId,
  withUsername,
  onClick,
  chat,
  user,
  isPinned,
  isMuted,
  canChangeFolder,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();

  const contextActions = useChatContextActions({
    chat,
    user,
    isPinned,
    isMuted,
    canChangeFolder,
    handleDelete: openDeleteModal,
    handleChatFolderChange: openChatFolderModal,
  }, true);

  const handleClick = useCallback(() => {
    onClick(chatId);
  }, [chatId, onClick]);

  const buttonRef = useSelectWithEnter(handleClick);

  if (!chat) {
    return undefined;
  }

  return (
    <ListItem
      className="chat-item-clickable search-result"
      onClick={handleClick}
      contextActions={contextActions}
      buttonRef={buttonRef}
    >
      {isUserId(chatId) ? (
        <PrivateChatInfo userId={chatId} withUsername={withUsername} avatarSize="large" />
      ) : (
        <GroupChatInfo chatId={chatId} withUsername={withUsername} avatarSize="large" />
      )}
      <DeleteChatModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        chat={chat}
      />
      <ChatFolderModal
        isOpen={isChatFolderModalOpen}
        onClose={closeChatFolderModal}
        chatId={chatId}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const privateChatUserId = chat && getPrivateChatUserId(chat);
    const user = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
    const isPinned = selectIsChatPinned(global, chatId);
    const isMuted = chat
      ? selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global))
      : undefined;

    return {
      chat,
      user,
      isPinned,
      isMuted,
      canChangeFolder: Boolean(global.chatFolders.orderedIds?.length),
    };
  },
)(LeftSearchResultChat));
