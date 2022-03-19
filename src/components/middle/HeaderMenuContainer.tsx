import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiChat } from '../../api/types';
import { IAnchorPosition } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';
import {
  selectChat, selectNotifySettings, selectNotifyExceptions, selectUser,
} from '../../global/selectors';
import {
  isUserId, getCanDeleteChat, selectIsChatMuted, getCanAddContact,
} from '../../global/helpers';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import Portal from '../ui/Portal';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import DeleteChatModal from '../common/DeleteChatModal';

import './HeaderMenuContainer.scss';

export type OwnProps = {
  chatId: string;
  threadId: number;
  isOpen: boolean;
  withExtraActions: boolean;
  anchor: IAnchorPosition;
  isChannel?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  canSubscribe?: boolean;
  canSearch?: boolean;
  canCall?: boolean;
  canMute?: boolean;
  canViewStatistics?: boolean;
  canLeave?: boolean;
  canEnterVoiceChat?: boolean;
  canCreateVoiceChat?: boolean;
  onSubscribeChannel: () => void;
  onSearchClick: () => void;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  chat?: ApiChat;
  isPrivate?: boolean;
  isMuted?: boolean;
  canAddContact?: boolean;
  canDeleteChat?: boolean;
  hasLinkedChat?: boolean;
};

const HeaderMenuContainer: FC<OwnProps & StateProps> = ({
  chatId,
  isOpen,
  withExtraActions,
  anchor,
  isChannel,
  canStartBot,
  canRestartBot,
  canSubscribe,
  canSearch,
  canCall,
  canMute,
  canViewStatistics,
  canLeave,
  canEnterVoiceChat,
  canCreateVoiceChat,
  chat,
  isPrivate,
  isMuted,
  canDeleteChat,
  hasLinkedChat,
  canAddContact,
  onSubscribeChannel,
  onSearchClick,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    updateChatMutedState,
    enterMessageSelectMode,
    sendBotCommand,
    restartBot,
    joinGroupCall,
    createGroupCall,
    openLinkedChat,
    openAddContactDialog,
    openCallFallbackConfirm,
    toggleStatistics,
  } = getActions();

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { x, y } = anchor;

  useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  }, [onClose]);

  const handleStartBot = useCallback(() => {
    sendBotCommand({ command: '/start' });
  }, [sendBotCommand]);

  const handleRestartBot = useCallback(() => {
    restartBot({ chatId });
  }, [chatId, restartBot]);

  const handleToggleMuteClick = useCallback(() => {
    updateChatMutedState({ chatId, isMuted: !isMuted });
    closeMenu();
  }, [chatId, closeMenu, isMuted, updateChatMutedState]);

  const handleEnterVoiceChatClick = useCallback(() => {
    if (canCreateVoiceChat) {
      // TODO show popup to schedule
      createGroupCall({
        chatId,
      });
    } else {
      joinGroupCall({
        chatId,
      });
    }
    closeMenu();
  }, [closeMenu, canCreateVoiceChat, chatId, joinGroupCall, createGroupCall]);

  const handleLinkedChatClick = useCallback(() => {
    openLinkedChat({ id: chatId });
    closeMenu();
  }, [chatId, closeMenu, openLinkedChat]);

  const handleAddContactClick = useCallback(() => {
    openAddContactDialog({ userId: chatId });
    closeMenu();
  }, [openAddContactDialog, chatId, closeMenu]);

  const handleSubscribe = useCallback(() => {
    onSubscribeChannel();
    closeMenu();
  }, [closeMenu, onSubscribeChannel]);

  const handleCall = useCallback(() => {
    openCallFallbackConfirm();
    closeMenu();
  }, [closeMenu, openCallFallbackConfirm]);

  const handleSearch = useCallback(() => {
    onSearchClick();
    closeMenu();
  }, [closeMenu, onSearchClick]);

  const handleStatisticsClick = useCallback(() => {
    toggleStatistics();
    closeMenu();
  }, [closeMenu, toggleStatistics]);

  const handleSelectMessages = useCallback(() => {
    enterMessageSelectMode();
    closeMenu();
  }, [closeMenu, enterMessageSelectMode]);

  useEffect(() => {
    disableScrolling();

    return enableScrolling;
  }, []);

  const lang = useLang();

  return (
    <Portal>
      <div className="HeaderMenuContainer">
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${x}px;top: ${y}px;`}
          onClose={closeMenu}
        >
          {withExtraActions && canStartBot && (
            <MenuItem
              icon="bots"
              onClick={handleStartBot}
            >
              {lang('BotStart')}
            </MenuItem>
          )}
          {withExtraActions && canRestartBot && (
            <MenuItem
              icon="bots"
              onClick={handleRestartBot}
            >
              {lang('BotRestart')}
            </MenuItem>
          )}
          {withExtraActions && canSubscribe && (
            <MenuItem
              icon={isChannel ? 'channel' : 'group'}
              onClick={handleSubscribe}
            >
              {lang(isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup')}
            </MenuItem>
          )}
          {canAddContact && (
            <MenuItem
              icon="add-user"
              onClick={handleAddContactClick}
            >
              {lang('AddContact')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && canCall && (
            <MenuItem
              icon="phone"
              onClick={handleCall}
            >
              {lang('Call')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && canSearch && (
            <MenuItem
              icon="search"
              onClick={handleSearch}
            >
              {lang('Search')}
            </MenuItem>
          )}
          {canMute && (
            <MenuItem
              icon={isMuted ? 'unmute' : 'mute'}
              onClick={handleToggleMuteClick}
            >
              {lang(isMuted ? 'ChatsUnmute' : 'ChatsMute')}
            </MenuItem>
          )}
          {(canEnterVoiceChat || canCreateVoiceChat) && (
            <MenuItem
              icon="voice-chat"
              onClick={handleEnterVoiceChatClick}
            >
              {lang(canCreateVoiceChat ? 'StartVoipChat' : 'VoipGroupJoinCall')}
            </MenuItem>
          )}
          {hasLinkedChat && (
            <MenuItem
              icon={isChannel ? 'comments' : 'channel'}
              onClick={handleLinkedChatClick}
            >
              {lang(isChannel ? 'ViewDiscussion' : 'lng_profile_view_channel')}
            </MenuItem>
          )}
          <MenuItem
            icon="select"
            onClick={handleSelectMessages}
          >
            {lang('ReportSelectMessages')}
          </MenuItem>
          {canViewStatistics && (
            <MenuItem
              icon="stats"
              onClick={handleStatisticsClick}
            >
              {lang('Statistics')}
            </MenuItem>
          )}
          {canLeave && (
            <MenuItem
              destructive
              icon="delete"
              onClick={handleDelete}
            >
              {lang(isPrivate
                ? 'DeleteChatUser'
                : (canDeleteChat ? 'GroupInfo.DeleteAndExit' : (isChannel ? 'LeaveChannel' : 'Group.LeaveGroup')))}
            </MenuItem>
          )}
        </Menu>
        {chat && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            chat={chat}
          />
        )}
      </div>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat || chat.isRestricted) {
      return {};
    }
    const isPrivate = isUserId(chat.id);
    const user = isPrivate ? selectUser(global, chatId) : undefined;
    const canAddContact = user && getCanAddContact(user);

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      isPrivate,
      canAddContact,
      canDeleteChat: getCanDeleteChat(chat),
      hasLinkedChat: Boolean(chat?.fullInfo?.linkedChatId),
    };
  },
)(HeaderMenuContainer));
