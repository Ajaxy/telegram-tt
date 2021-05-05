import React, { FC, memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiUser } from '../../../api/types';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import { isChatPrivate, getPrivateChatUserId } from '../../../modules/helpers';
import { selectChat, selectUser, selectIsChatPinned } from '../../../modules/selectors';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import GroupChatInfo from '../../common/GroupChatInfo';
import DeleteChatModal from '../../common/DeleteChatModal';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: number;
  withUsername?: boolean;
  onClick: (id: number) => void;
};

type StateProps = {
  chat?: ApiChat;
  privateChatUser?: ApiUser;
  isPinned?: boolean;
};

const LeftSearchResultChat: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  privateChatUser,
  isPinned,
  withUsername,
  onClick,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();

  const contextActions = useChatContextActions({
    chat,
    privateChatUser,
    isPinned,
    handleDelete: openDeleteModal,
  });

  if (!chat) {
    return undefined;
  }

  return (
    <ListItem
      className="chat-item-clickable search-result"
      onClick={() => onClick(chatId)}
      contextActions={contextActions}
    >
      {isChatPrivate(chatId) ? (
        <PrivateChatInfo userId={chatId} withUsername={withUsername} avatarSize="large" />
      ) : (
        <GroupChatInfo chatId={chatId} withUsername={withUsername} avatarSize="large" />
      )}
      <DeleteChatModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        chat={chat}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const privateChatUserId = chat && getPrivateChatUserId(chat);
    const privateChatUser = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
    const isPinned = selectIsChatPinned(global, chatId);

    return {
      chat,
      privateChatUser,
      isPinned,
    };
  },
)(LeftSearchResultChat));
