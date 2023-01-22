import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBotCommand, ApiChat } from '../../api/types';
import type { IAnchorPosition } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { REPLIES_USER_ID } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';
import {
  selectChat,
  selectNotifySettings,
  selectNotifyExceptions,
  selectUser,
  selectChatBot,
  selectIsPremiumPurchaseBlocked,
  selectCurrentMessageList,
} from '../../global/selectors';
import {
  isUserId,
  getCanDeleteChat,
  selectIsChatMuted,
  getCanAddContact,
  isChatChannel,
  isChatGroup,
  getCanManageTopic,
  isUserRightBanned,
  getHasAdminRight,
} from '../../global/helpers';
import useShowTransition from '../../hooks/useShowTransition';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useLang from '../../hooks/useLang';

import Portal from '../ui/Portal';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import DeleteChatModal from '../common/DeleteChatModal';
import ReportModal from '../common/ReportModal';

import './HeaderMenuContainer.scss';

const BOT_BUTTONS: Record<string, { icon: string; label: string }> = {
  settings: {
    icon: 'bots',
    label: 'BotSettings',
  },
  privacy: {
    icon: 'info',
    label: 'Privacy',
  },
  help: {
    icon: 'help',
    label: 'BotHelp',
  },
};

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
  withForumActions?: boolean;
  canLeave?: boolean;
  canEnterVoiceChat?: boolean;
  canCreateVoiceChat?: boolean;
  pendingJoinRequests?: number;
  onSubscribeChannel: () => void;
  onSearchClick: () => void;
  onAsMessagesClick: () => void;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
  onJoinRequestsClick?: () => void;
};

type StateProps = {
  chat?: ApiChat;
  botCommands?: ApiBotCommand[];
  isPrivate?: boolean;
  isMuted?: boolean;
  isTopic?: boolean;
  isForum?: boolean;
  canAddContact?: boolean;
  canReportChat?: boolean;
  canDeleteChat?: boolean;
  canGiftPremium?: boolean;
  canCreateTopic?: boolean;
  canEditTopic?: boolean;
  hasLinkedChat?: boolean;
  isChatInfoShown?: boolean;
};

const CLOSE_MENU_ANIMATION_DURATION = 200;

const HeaderMenuContainer: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  withExtraActions,
  anchor,
  isChannel,
  botCommands,
  withForumActions,
  isTopic,
  isForum,
  isChatInfoShown,
  canStartBot,
  canRestartBot,
  canSubscribe,
  canSearch,
  canCall,
  canMute,
  canViewStatistics,
  pendingJoinRequests,
  canLeave,
  canEnterVoiceChat,
  canCreateVoiceChat,
  chat,
  isPrivate,
  isMuted,
  canReportChat,
  canDeleteChat,
  canGiftPremium,
  hasLinkedChat,
  canAddContact,
  canCreateTopic,
  canEditTopic,
  onJoinRequestsClick,
  onSubscribeChannel,
  onSearchClick,
  onAsMessagesClick,
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
    requestCall,
    toggleStatistics,
    openGiftPremiumModal,
    openChatWithInfo,
    openCreateTopicPanel,
    openEditTopicPanel,
    openChat,
  } = getActions();

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { x, y } = anchor;

  useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const isViewGroupInfoShown = usePrevDuringAnimation(
    (!isChatInfoShown && isForum) ? true : undefined, CLOSE_MENU_ANIMATION_DURATION,
  );

  const handleReport = useCallback(() => {
    setIsMenuOpen(false);
    setIsReportModalOpen(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const handleViewGroupInfo = useCallback(() => {
    openChatWithInfo({ id: chatId, threadId });
    closeMenu();
  }, [chatId, closeMenu, openChatWithInfo, threadId]);

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

  const handleCreateTopicClick = useCallback(() => {
    openCreateTopicPanel({ chatId });
    closeMenu();
  }, [openCreateTopicPanel, chatId, closeMenu]);

  const handleEditTopicClick = useCallback(() => {
    openEditTopicPanel({ chatId, topicId: threadId });
    closeMenu();
  }, [openEditTopicPanel, chatId, threadId, closeMenu]);

  const handleViewAsTopicsClick = useCallback(() => {
    openChat({ id: undefined });
    closeMenu();
  }, [closeMenu, openChat]);

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

  const handleGiftPremiumClick = useCallback(() => {
    openGiftPremiumModal({ forUserId: chatId });
    closeMenu();
  }, [openGiftPremiumModal, chatId, closeMenu]);

  const handleAddContactClick = useCallback(() => {
    openAddContactDialog({ userId: chatId });
    closeMenu();
  }, [openAddContactDialog, chatId, closeMenu]);

  const handleSubscribe = useCallback(() => {
    onSubscribeChannel();
    closeMenu();
  }, [closeMenu, onSubscribeChannel]);

  const handleVideoCall = useCallback(() => {
    requestCall({ userId: chatId, isVideo: true });
    closeMenu();
  }, [chatId, closeMenu, requestCall]);

  const handleCall = useCallback(() => {
    requestCall({ userId: chatId });
    closeMenu();
  }, [chatId, closeMenu, requestCall]);

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

  const handleOpenAsMessages = useCallback(() => {
    onAsMessagesClick();
    closeMenu();
  }, [closeMenu, onAsMessagesClick]);

  useEffect(() => {
    disableScrolling();

    return enableScrolling;
  }, []);

  const lang = useLang();

  const botButtons = useMemo(() => {
    return botCommands?.map(({ command }) => {
      const cmd = BOT_BUTTONS[command];
      if (!cmd) return undefined;
      const handleClick = () => {
        sendBotCommand({ command: `/${command}` });
        closeMenu();
      };

      return (
        <MenuItem
          key={command}
          icon={cmd.icon}
          // eslint-disable-next-line react/jsx-no-bind
          onClick={handleClick}
        >
          {lang(cmd.label)}
        </MenuItem>
      );
    });
  }, [botCommands, closeMenu, lang, sendBotCommand]);

  return (
    <Portal>
      <div className="HeaderMenuContainer">
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${x}px;top: ${y}px;`}
          onClose={closeMenu}
        >
          {withForumActions && canCreateTopic && (
            <>
              <MenuItem
                icon="comments"
                onClick={handleCreateTopicClick}
              >
                {lang('lng_forum_create_topic')}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          {isViewGroupInfoShown && (
            <MenuItem
              icon="info"
              onClick={handleViewGroupInfo}
            >
              {isTopic ? lang('lng_context_view_topic') : lang('lng_context_view_group')}
            </MenuItem>
          )}
          {canEditTopic && (
            <MenuItem
              icon="edit"
              onClick={handleEditTopicClick}
            >
              {lang('lng_forum_topic_edit')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && !withForumActions && isForum && !isTopic && (
            <MenuItem
              icon="forums"
              onClick={handleViewAsTopicsClick}
            >
              {lang('Chat.ContextViewAsTopics')}
            </MenuItem>
          )}
          {withForumActions && Boolean(pendingJoinRequests) && (
            <MenuItem
              icon="user"
              onClick={onJoinRequestsClick}
            >
              {isChannel ? lang('SubscribeRequests') : lang('MemberRequests')}
              <div className="right-badge">{pendingJoinRequests}</div>
            </MenuItem>
          )}
          {withForumActions && !isTopic && (
            <MenuItem
              icon="message"
              onClick={handleOpenAsMessages}
            >
              {lang('lng_forum_view_as_messages')}
            </MenuItem>
          )}
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
          {canCall && (
            <MenuItem
              icon="video-outlined"
              onClick={handleVideoCall}
            >
              {lang('VideoCall')}
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
          {!withForumActions && (
            <MenuItem
              icon="select"
              onClick={handleSelectMessages}
            >
              {lang('ReportSelectMessages')}
            </MenuItem>
          )}
          {canViewStatistics && (
            <MenuItem
              icon="stats"
              onClick={handleStatisticsClick}
            >
              {lang('Statistics')}
            </MenuItem>
          )}
          {canReportChat && (
            <MenuItem
              icon="flag"
              onClick={handleReport}
            >
              {lang('ReportPeer.Report')}
            </MenuItem>
          )}
          {botButtons}
          {canGiftPremium && (
            <MenuItem
              icon="gift"
              onClick={handleGiftPremiumClick}
            >
              {lang('GiftPremium')}
            </MenuItem>
          )}
          {canLeave && (
            <>
              <MenuSeparator />
              <MenuItem
                destructive
                icon="delete"
                onClick={handleDelete}
              >
                {lang(isPrivate
                  ? 'DeleteChatUser'
                  : (canDeleteChat ? 'GroupInfo.DeleteAndExit' : (isChannel ? 'LeaveChannel' : 'Group.LeaveGroup')))}
              </MenuItem>
            </>
          )}
        </Menu>
        {chat && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            chat={chat}
          />
        )}
        {canReportChat && chat?.id && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={closeReportModal}
            subject="peer"
            chatId={chat.id}
          />
        )}
      </div>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat || chat.isRestricted) {
      return {};
    }
    const isPrivate = isUserId(chat.id);
    const user = isPrivate ? selectUser(global, chatId) : undefined;
    const canAddContact = user && getCanAddContact(user);
    const isMainThread = threadId === MAIN_THREAD_ID;
    const canReportChat = isMainThread && (isChatChannel(chat) || isChatGroup(chat) || (user && !user.isSelf));
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

    const chatBot = chatId !== REPLIES_USER_ID ? selectChatBot(global, chatId) : undefined;
    const canGiftPremium = Boolean(
      global.lastSyncTime
      && user?.fullInfo?.premiumGifts?.length
      && !selectIsPremiumPurchaseBlocked(global),
    );

    const topic = chat?.topics?.[threadId];
    const canCreateTopic = chat.isForum && (
      chat.isCreator || !isUserRightBanned(chat, 'manageTopics') || getHasAdminRight(chat, 'manageTopics')
    );
    const canEditTopic = topic && getCanManageTopic(chat, topic);

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      isPrivate,
      isTopic: chat?.isForum && !isMainThread,
      isForum: chat?.isForum,
      canAddContact,
      canReportChat,
      canDeleteChat: getCanDeleteChat(chat),
      canGiftPremium,
      hasLinkedChat: Boolean(chat?.fullInfo?.linkedChatId),
      botCommands: chatBot?.fullInfo?.botInfo?.commands,
      isChatInfoShown: global.isChatInfoShown && currentChatId === chatId && currentThreadId === threadId,
      canCreateTopic,
      canEditTopic,
    };
  },
)(HeaderMenuContainer));
