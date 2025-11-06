import type { FC } from '@teact';
import { memo, useCallback } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import { StoryViewerOrigin } from '../../../types';

import { UNMUTE_TIMESTAMP } from '../../../config';
import { getIsChatMuted } from '../../../global/helpers/notifications';
import {
  selectChat,
  selectIsChatPinned,
  selectNotifyDefaults,
  selectNotifyException,
  selectUser,
} from '../../../global/selectors';
import { onDragEnter, onDragLeave } from '../../../util/dragNDropHandlers.ts';
import { isUserId } from '../../../util/entities/ids';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import GroupChatInfo from '../../common/GroupChatInfo';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';
import MuteChatModal from '../MuteChatModal.async';

type OwnProps = {
  chatId: string;
  withUsername?: boolean;
  withOpenAppButton?: boolean;
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
  chat,
  user,
  isPinned,
  isMuted,
  canChangeFolder,
  withOpenAppButton,
  onClick,
}) => {
  const { requestMainWebView, updateChatMutedState, openQuickPreview } = getActions();
  const lang = useLang();

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

  const handleUnmute = useLastCallback(() => {
    updateChatMutedState({ chatId, mutedUntil: UNMUTE_TIMESTAMP });
  });

  const contextActions = useChatContextActions({
    chat,
    user,
    isPinned,
    isMuted,
    canChangeFolder,
    handleMute,
    handleUnmute,
    handleChatFolderChange,
  }, true);

  const handleClick = useLastCallback((e: React.MouseEvent) => {
    if (e.altKey && chat && !chat.isForum) {
      e.preventDefault();
      openQuickPreview({ id: chatId });
      return;
    }
    onClick(chatId);
  });

  const handleOpenApp = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();

    const theme = extractCurrentThemeParams();
    requestMainWebView({
      botId: chatId,
      peerId: chatId,
      theme,
    });
  });

  const handleDragEnter = useLastCallback((e) => {
    e.preventDefault();

    onDragEnter(() => {
      onClick(chatId);
    }, true);
  });

  const buttonRef = useSelectWithEnter(() => {
    onClick(chatId);
  });

  return (
    <ListItem
      className="chat-item-clickable search-result"
      contextActions={contextActions}
      buttonRef={buttonRef}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={onDragLeave}
    >
      {isUserId(chatId) ? (
        <PrivateChatInfo
          userId={chatId}
          withUsername={withUsername}
          withStory
          avatarSize="medium"
          storyViewerOrigin={StoryViewerOrigin.SearchResult}
        />
      ) : (
        <GroupChatInfo
          chatId={chatId}
          withUsername={withUsername}
          avatarSize="medium"
          withStory
          storyViewerOrigin={StoryViewerOrigin.SearchResult}
        />
      )}
      {withOpenAppButton && user?.hasMainMiniApp && (
        <Button
          className="search-result-miniapp-button"
          pill
          fluid
          size="tiny"
          onClick={handleOpenApp}
        >
          {lang('BotChatMiniAppOpen')}
        </Button>
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
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const user = selectUser(global, chatId);
    const isPinned = selectIsChatPinned(global, chatId);
    const isMuted = chat && getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id));

    return {
      chat,
      user,
      isPinned,
      isMuted,
      canChangeFolder: Boolean(global.chatFolders.orderedIds?.length),
    };
  },
)(LeftSearchResultChat));
