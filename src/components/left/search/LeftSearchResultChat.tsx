import React, {
  FC, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiUser } from '../../../api/types';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import { isUserId, getPrivateChatUserId, selectIsChatMuted } from '../../../modules/helpers';
import {
  selectChat, selectUser, selectIsChatPinned, selectNotifySettings, selectNotifyExceptions,
} from '../../../modules/selectors';
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
};

const LeftSearchResultChat: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  user,
  isPinned,
  isMuted,
  withUsername,
  onClick,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();

  const contextActions = useChatContextActions({
    chat,
    user,
    isPinned,
    isMuted,
    handleDelete: openDeleteModal,
    handleChatFolderChange: openChatFolderModal,
  }, true);

  const handleClick = () => {
    onClick(chatId);
  };

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
    };
  },
)(LeftSearchResultChat));
