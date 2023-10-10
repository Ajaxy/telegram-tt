import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import { StoryViewerOrigin } from '../../../types';

import { getPrivateChatUserId, isUserId, selectIsChatMuted } from '../../../global/helpers';
import {
  selectChat, selectIsChatPinned, selectNotifyExceptions,
  selectNotifySettings, selectUser,
} from '../../../global/selectors';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import GroupChatInfo from '../../common/GroupChatInfo';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';
import MuteChatModal from '../MuteChatModal.async';

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
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();

  const handleChatFolderChange = useCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  }, [markRenderChatFolderModal, openChatFolderModal]);

  const handleMute = useCallback(() => {
    markRenderMuteModal();
    openMuteModal();
  }, [markRenderMuteModal, openMuteModal]);

  const contextActions = useChatContextActions({
    chat,
    user,
    isPinned,
    isMuted,
    canChangeFolder,
    handleMute,
    handleChatFolderChange,
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
        <PrivateChatInfo
          userId={chatId}
          withUsername={withUsername}
          withStory
          avatarSize="large"
          storyViewerOrigin={StoryViewerOrigin.SearchResult}
        />
      ) : (
        <GroupChatInfo
          chatId={chatId}
          withUsername={withUsername}
          avatarSize="large"
          withStory
          storyViewerOrigin={StoryViewerOrigin.SearchResult}
        />
      )}
      {shouldRenderMuteModal && (
        <MuteChatModal
          isOpen={isMuteModalOpen}
          onClose={closeMuteModal}
          onCloseAnimationEnd={unmarkRenderMuteModal}
          chatId={chatId}
        />
      )}
      {shouldRenderChatFolderModal && (
        <ChatFolderModal
          isOpen={isChatFolderModalOpen}
          onClose={closeChatFolderModal}
          onCloseAnimationEnd={unmarkRenderChatFolderModal}
          chatId={chatId}
        />
      )}
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
