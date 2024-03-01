import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBotCommand, ApiChat } from '../../api/types';
import type { IAnchorPosition, ThreadId } from '../../types';
import type { IconName } from '../../types/icons';
import { MAIN_THREAD_ID } from '../../api/types';

import { REPLIES_USER_ID } from '../../config';
import {
  getCanAddContact,
  getCanDeleteChat,
  getCanManageTopic,
  getHasAdminRight,
  getIsSavedDialog,
  isChatChannel,
  isChatGroup,
  isUserId,
  isUserRightBanned,
  selectIsChatMuted,
} from '../../global/helpers';
import {
  selectBot,
  selectCanManage, selectCanTranslateChat,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsChatWithSelf,
  selectIsPremiumPurchaseBlocked,
  selectIsRightColumnShown, selectNotifyExceptions,
  selectNotifySettings,
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useShowTransition from '../../hooks/useShowTransition';

import DeleteChatModal from '../common/DeleteChatModal';
import ReportModal from '../common/ReportModal';
import MuteChatModal from '../left/MuteChatModal.async';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import Portal from '../ui/Portal';

import './HeaderMenuContainer.scss';

const BOT_BUTTONS: Record<string, { icon: IconName; label: string }> = {
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
  threadId: ThreadId;
  isOpen: boolean;
  withExtraActions: boolean;
  anchor: IAnchorPosition;
  isChannel?: boolean;
  canStartBot?: boolean;
  canSubscribe?: boolean;
  canSearch?: boolean;
  canCall?: boolean;
  canMute?: boolean;
  canViewStatistics?: boolean;
  canViewBoosts?: boolean;
  canShowBoostModal?: boolean;
  withForumActions?: boolean;
  canLeave?: boolean;
  canEnterVoiceChat?: boolean;
  canCreateVoiceChat?: boolean;
  pendingJoinRequests?: number;
  canTranslate?: boolean;
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
  isForumAsMessages?: true;
  canAddContact?: boolean;
  canReportChat?: boolean;
  canDeleteChat?: boolean;
  canGiftPremium?: boolean;
  canCreateTopic?: boolean;
  canEditTopic?: boolean;
  hasLinkedChat?: boolean;
  isChatInfoShown?: boolean;
  isRightColumnShown?: boolean;
  canManage?: boolean;
  canTranslate?: boolean;
  isBlocked?: boolean;
  isBot?: boolean;
  isChatWithSelf?: boolean;
  savedDialog?: ApiChat;
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
  isForumAsMessages,
  isChatInfoShown,
  canStartBot,
  canSubscribe,
  canSearch,
  canCall,
  canMute,
  canViewStatistics,
  canViewBoosts,
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
  canManage,
  isRightColumnShown,
  canTranslate,
  isBlocked,
  isBot,
  isChatWithSelf,
  savedDialog,
  canShowBoostModal,
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
    requestMasterAndJoinGroupCall,
    createGroupCall,
    openLinkedChat,
    openAddContactDialog,
    requestMasterAndRequestCall,
    toggleStatistics,
    openBoostStatistics,
    openGiftPremiumModal,
    openThreadWithInfo,
    openCreateTopicPanel,
    openEditTopicPanel,
    openChat,
    toggleManagement,
    togglePeerTranslations,
    blockUser,
    unblockUser,
    setViewForumAsMessages,
    openBoostModal,
  } = getActions();

  const { isMobile } = useAppLayout();
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [shouldCloseFast, setShouldCloseFast] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const { x, y } = anchor;

  useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const isViewGroupInfoShown = usePrevDuringAnimation(
    (!isChatInfoShown && isForum) ? true : undefined, CLOSE_MENU_ANIMATION_DURATION,
  );

  const handleReport = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsReportModalOpen(true);
  });

  const closeReportModal = useLastCallback(() => {
    setIsReportModalOpen(false);
    onClose();
  });

  const closeMuteModal = useLastCallback(() => {
    setIsMuteModalOpen(false);
    onClose();
  });

  const handleDelete = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  });

  const closeMenu = useLastCallback(() => {
    setIsMenuOpen(false);
    onClose();
  });

  const handleViewGroupInfo = useLastCallback(() => {
    openThreadWithInfo({ chatId, threadId });
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const closeDeleteModal = useLastCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  });

  const handleStartBot = useLastCallback(() => {
    sendBotCommand({ command: '/start' });
  });

  const handleRestartBot = useLastCallback(() => {
    restartBot({ chatId });
  });

  const handleUnmuteClick = useLastCallback(() => {
    updateChatMutedState({ chatId, isMuted: false });
    closeMenu();
  });

  const handleMuteClick = useLastCallback(() => {
    markRenderMuteModal();
    setIsMuteModalOpen(true);
    setIsMenuOpen(false);
  });

  const handleCreateTopicClick = useLastCallback(() => {
    openCreateTopicPanel({ chatId });
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const handleEditClick = useLastCallback(() => {
    toggleManagement({ force: true });
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const handleEditTopicClick = useLastCallback(() => {
    openEditTopicPanel({ chatId, topicId: Number(threadId) });
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const handleViewAsTopicsClick = useLastCallback(() => {
    openChat({ id: undefined });
    setViewForumAsMessages({ chatId, isEnabled: false });
    closeMenu();
  });

  const handleEnterVoiceChatClick = useLastCallback(() => {
    if (canCreateVoiceChat) {
      // TODO Show popup to schedule
      createGroupCall({
        chatId,
      });
    } else {
      requestMasterAndJoinGroupCall({
        chatId,
      });
    }
    closeMenu();
  });

  const handleLinkedChatClick = useLastCallback(() => {
    openLinkedChat({ id: chatId });
    closeMenu();
  });

  const handleGiftPremiumClick = useLastCallback(() => {
    openGiftPremiumModal({ forUserId: chatId });
    closeMenu();
  });

  const handleAddContactClick = useLastCallback(() => {
    openAddContactDialog({ userId: chatId });
    closeMenu();
  });

  const handleSubscribe = useLastCallback(() => {
    onSubscribeChannel();
    closeMenu();
  });

  const handleVideoCall = useLastCallback(() => {
    requestMasterAndRequestCall({ userId: chatId, isVideo: true });
    closeMenu();
  });

  const handleCall = useLastCallback(() => {
    requestMasterAndRequestCall({ userId: chatId });
    closeMenu();
  });

  const handleSearch = useLastCallback(() => {
    onSearchClick();
    closeMenu();
  });

  const handleStatisticsClick = useLastCallback(() => {
    toggleStatistics();
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const handleBoostClick = useLastCallback(() => {
    if (canViewBoosts) {
      openBoostStatistics({ chatId });
      setShouldCloseFast(!isRightColumnShown);
    } else {
      openBoostModal({ chatId });
    }
    closeMenu();
  });

  const handleEnableTranslations = useLastCallback(() => {
    togglePeerTranslations({ chatId, isEnabled: true });
    closeMenu();
  });

  const handleSelectMessages = useLastCallback(() => {
    enterMessageSelectMode();
    closeMenu();
  });

  const handleOpenAsMessages = useLastCallback(() => {
    onAsMessagesClick();
    closeMenu();
  });

  const handleBlock = useLastCallback(() => {
    blockUser({ userId: chatId });
    closeMenu();
  });

  const handleUnblock = useLastCallback(() => {
    unblockUser({ userId: chatId });
    closeMenu();
  });

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

  const deleteTitle = useMemo(() => {
    if (!chat) return undefined;

    if (savedDialog) {
      return lang('Delete');
    }

    if (isPrivate) {
      return lang('DeleteChatUser');
    }

    if (canDeleteChat) {
      return lang('GroupInfo.DeleteAndExit');
    }

    if (isChannel) {
      return lang('LeaveChannel');
    }

    return lang('Group.LeaveGroup');
  }, [canDeleteChat, chat, isChannel, isPrivate, savedDialog, lang]);

  return (
    <Portal>
      <div className="HeaderMenuContainer">
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${x}px;top: ${y}px;`}
          onClose={closeMenu}
          shouldCloseFast={shouldCloseFast}
        >
          {isMobile && canSearch && (
            <MenuItem
              icon="search"
              onClick={handleSearch}
            >
              {lang('Search')}
            </MenuItem>
          )}
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
          {canManage && !canEditTopic && (
            <MenuItem
              icon="edit"
              onClick={handleEditClick}
            >
              {lang('Edit')}
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
          {isMobile && !withForumActions && isForum && !isTopic && (
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
          {withForumActions && !isTopic && !isForumAsMessages && (
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
          {withExtraActions && canSubscribe && (
            <MenuItem
              icon={isChannel ? 'channel' : 'group'}
              onClick={handleSubscribe}
            >
              {lang(isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup')}
            </MenuItem>
          )}
          {canShowBoostModal && !canViewBoosts && (
            <MenuItem
              icon="boost-outline"
              onClick={handleBoostClick}
            >
              {lang(isChannel ? 'BoostingBoostChannelMenu' : 'BoostingBoostGroupMenu')}
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
          {isMobile && canCall && (
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
          {canMute && (isMuted ? (
            <MenuItem
              icon="unmute"
              onClick={handleUnmuteClick}
            >
              {lang('ChatsUnmute')}
            </MenuItem>
          )
            : (
              <MenuItem
                icon="mute"
                onClick={handleMuteClick}
              >
                {lang('ChatsMute')}...
              </MenuItem>
            )
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
          {canViewBoosts && (
            <MenuItem
              icon="boost-outline"
              onClick={handleBoostClick}
            >
              {lang('Boosts')}
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
          {canTranslate && (
            <MenuItem
              icon="language"
              onClick={handleEnableTranslations}
            >
              {lang('lng_context_translate')}
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
          {isBot && (
            <MenuItem
              icon={isBlocked ? 'bots' : 'hand-stop'}
              onClick={isBlocked ? handleRestartBot : handleBlock}
            >
              {isBlocked ? lang('BotRestart') : lang('Bot.Stop')}
            </MenuItem>
          )}
          {isPrivate && !isChatWithSelf && !isBot && (
            <MenuItem
              icon={isBlocked ? 'user' : 'hand-stop'}
              onClick={isBlocked ? handleUnblock : handleBlock}
            >
              {isBlocked ? lang('Unblock') : lang('BlockUser')}
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
                {deleteTitle}
              </MenuItem>
            </>
          )}
        </Menu>
        {chat && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            chat={savedDialog || chat}
            isSavedDialog={Boolean(savedDialog)}
          />
        )}
        {canMute && shouldRenderMuteModal && chat?.id && (
          <MuteChatModal
            isOpen={isMuteModalOpen}
            onClose={closeMuteModal}
            onCloseAnimationEnd={unmarkRenderMuteModal}
            chatId={chat.id}
          />
        )}
        {canReportChat && chat?.id && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={closeReportModal}
            subject="peer"
            peerId={chat.id}
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
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const canReportChat = isMainThread && (isChatChannel(chat) || isChatGroup(chat) || (user && !user.isSelf));
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

    const chatBot = chatId !== REPLIES_USER_ID ? selectBot(global, chatId) : undefined;
    const userFullInfo = isPrivate ? selectUserFullInfo(global, chatId) : undefined;
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, chatId) : undefined;
    const fullInfo = userFullInfo || chatFullInfo;
    const canGiftPremium = Boolean(
      userFullInfo?.premiumGifts?.length
      && !selectIsPremiumPurchaseBlocked(global),
    );

    const topic = chat?.topics?.[threadId];
    const canCreateTopic = chat.isForum && (
      chat.isCreator || !isUserRightBanned(chat, 'manageTopics') || getHasAdminRight(chat, 'manageTopics')
    );
    const canEditTopic = topic && getCanManageTopic(chat, topic);
    const canManage = selectCanManage(global, chatId);
    // Context menu item should only be displayed if user hid translation panel
    const canTranslate = selectCanTranslateChat(global, chatId) && fullInfo?.isTranslationDisabled;

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
    const savedDialog = isSavedDialog ? selectChat(global, String(threadId)) : undefined;

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      isPrivate,
      isTopic: chat?.isForum && !isMainThread,
      isForum: chat?.isForum,
      isForumAsMessages: chat?.isForumAsMessages,
      canAddContact,
      canReportChat,
      canDeleteChat: getCanDeleteChat(chat),
      canGiftPremium,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      botCommands: chatBot ? userFullInfo?.botInfo?.commands : undefined,
      isChatInfoShown: selectTabState(global).isChatInfoShown
        && currentChatId === chatId && currentThreadId === threadId,
      canCreateTopic,
      canEditTopic,
      canManage,
      isRightColumnShown: selectIsRightColumnShown(global),
      canTranslate,
      isBlocked: userFullInfo?.isBlocked,
      isBot: Boolean(chatBot),
      isChatWithSelf,
      savedDialog,
    };
  },
)(HeaderMenuContainer));
