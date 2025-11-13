import type { FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiBotCommand, ApiChat, ApiDisallowedGifts,
} from '../../api/types';
import type { IAnchorPosition, ThreadId } from '../../types';
import type { IconName } from '../../types/icons';
import { MAIN_THREAD_ID } from '../../api/types';

import { UNMUTE_TIMESTAMP } from '../../config';
import {
  getCanAddContact,
  getCanDeleteChat,
  getCanManageTopic,
  getHasAdminRight,
  getIsSavedDialog,
  isChatAdmin,
  isChatChannel,
  isChatGroup,
  isSystemBot,
  isUserRightBanned,
} from '../../global/helpers';
import { getIsChatMuted } from '../../global/helpers/notifications';
import {
  selectBot,
  selectCanGift,
  selectCanManage,
  selectCanTranslateChat,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsChatRestricted,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectIsRightColumnShown,
  selectNotifyDefaults,
  selectNotifyException,
  selectTabState,
  selectTopic,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { isUserId } from '../../util/entities/ids';
import { disableScrolling } from '../../util/scrollLock';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import DeleteChatModal from '../common/DeleteChatModal';
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
  canViewMonetization?: boolean;
  canShowBoostModal?: boolean;
  withForumActions?: boolean;
  canLeave?: boolean;
  canEnterVoiceChat?: boolean;
  canCreateVoiceChat?: boolean;
  pendingJoinRequests?: number;
  canTranslate?: boolean;
  channelMonoforumId?: string;
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
  botPrivacyPolicyUrl?: string;
  isPrivate?: boolean;
  isMuted?: boolean;
  isTopic?: boolean;
  isForum?: boolean;
  isForumAsMessages?: true;
  canAddContact?: boolean;
  canDeleteChat?: boolean;
  canReportChat?: boolean;
  canGift?: boolean;
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
  disallowedGifts?: ApiDisallowedGifts;
  isAccountFrozen?: boolean;
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
  botPrivacyPolicyUrl,
  withForumActions,
  isTopic,
  isForum,
  isForumAsMessages,
  isChatInfoShown,
  canStartBot,
  canSubscribe,
  canReportChat,
  canSearch,
  canCall,
  canMute,
  canViewStatistics,
  canViewMonetization,
  canViewBoosts,
  pendingJoinRequests,
  canLeave,
  canEnterVoiceChat,
  canCreateVoiceChat,
  chat,
  isPrivate,
  isMuted,
  canDeleteChat,
  canGift,
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
  disallowedGifts,
  isAccountFrozen,
  channelMonoforumId,
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
    openFrozenAccountModal,
    requestMasterAndRequestCall,
    toggleStatistics,
    openMonetizationStatistics,
    openBoostStatistics,
    openGiftModal,
    openThreadWithInfo,
    openCreateTopicPanel,
    openEditTopicPanel,
    openChat,
    openUrl,
    toggleManagement,
    togglePeerTranslations,
    blockUser,
    unblockUser,
    setViewForumAsMessages,
    openBoostModal,
    reportMessages,
    showNotification,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const { isMobile } = useAppLayout();
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [shouldCloseFast, setShouldCloseFast] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const { x, y } = anchor;

  useShowTransitionDeprecated(isOpen, onCloseAnimationEnd, undefined, false);
  const isViewGroupInfoShown = usePrevDuringAnimation(
    (!isChatInfoShown && isForum) ? true : undefined, CLOSE_MENU_ANIMATION_DURATION,
  );

  const areAllGiftsDisallowed = useMemo(() => {
    if (!disallowedGifts) {
      return undefined;
    }
    return Object.values(disallowedGifts).every(Boolean);
  }, [disallowedGifts]);

  const closeMuteModal = useLastCallback(() => {
    setIsMuteModalOpen(false);
    onClose();
  });

  const handleReport = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      setIsMenuOpen(false);
      reportMessages({ chatId, messageIds: [] });
    }
    onClose();
  });

  const handleDelete = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      onClose();
    } else {
      setIsDeleteModalOpen(true);
    }
    setIsMenuOpen(false);
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
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      sendBotCommand({ command: '/start' });
    }
  });

  const handleRestartBot = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      restartBot({ chatId });
    }
  });

  const handleUnmuteClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      updateChatMutedState({ chatId, mutedUntil: UNMUTE_TIMESTAMP });
    }
    closeMenu();
  });

  const handleMuteClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      closeMenu();
    } else {
      markRenderMuteModal();
      setIsMuteModalOpen(true);
    }
    setIsMenuOpen(false);
  });

  const handleCreateTopicClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      openCreateTopicPanel({ chatId });
      setShouldCloseFast(!isRightColumnShown);
    }
    closeMenu();
  });

  const handleEditClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      toggleManagement({ force: true });
      setShouldCloseFast(!isRightColumnShown);
    }
    closeMenu();
  });

  const handleEditTopicClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      openEditTopicPanel({ chatId, topicId: Number(threadId) });
      setShouldCloseFast(!isRightColumnShown);
    }
    closeMenu();
  });

  const handleViewAsTopicsClick = useLastCallback(() => {
    openChat({ id: undefined });
    setViewForumAsMessages({ chatId, isEnabled: false });
    closeMenu();
  });

  const handleEnterVoiceChatClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else if (canCreateVoiceChat) {
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

  const handleGiftClick = useLastCallback(() => {
    if (areAllGiftsDisallowed && chat) {
      showNotification({ message: lang('SendDisallowError') });
      return;
    }
    openGiftModal({ forUserId: chatId });
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      openGiftModal({ forUserId: chatId });
    }
    closeMenu();
  });

  const handleAddContactClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      openAddContactDialog({ userId: chatId });
    }
    closeMenu();
  });

  const handleSubscribe = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      onSubscribeChannel();
    }
    closeMenu();
  });

  const handleVideoCall = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      requestMasterAndRequestCall({ userId: chatId, isVideo: true });
    }
    closeMenu();
  });

  const handleCall = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      requestMasterAndRequestCall({ userId: chatId });
    }
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

  const handleMonetizationClick = useLastCallback(() => {
    openMonetizationStatistics({ chatId });
    setShouldCloseFast(!isRightColumnShown);
    closeMenu();
  });

  const handleBoostClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else if (canViewBoosts) {
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
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      enterMessageSelectMode();
    }
    closeMenu();
  });

  const handleOpenAsMessages = useLastCallback(() => {
    onAsMessagesClick();
    closeMenu();
  });

  const handleBlock = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      blockUser({ userId: chatId });
    }
    closeMenu();
  });

  const handleUnblock = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
    } else {
      unblockUser({ userId: chatId });
    }
    closeMenu();
  });

  const handleSendChannelMessage = useLastCallback(() => {
    openChat({ id: channelMonoforumId });
    closeMenu();
  });

  useEffect(disableScrolling, []);

  const botButtons = useMemo(() => {
    const commandButtons = botCommands?.map(({ command }) => {
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

          onClick={handleClick}
        >
          {oldLang(cmd.label)}
        </MenuItem>
      );
    });

    const hasPrivacyCommand = botCommands?.some(({ command }) => command === 'privacy');

    const privacyButton = isBot && (
      <MenuItem
        icon="privacy-policy"

        onClick={() => {
          if (hasPrivacyCommand && !botPrivacyPolicyUrl) {
            sendBotCommand({ command: '/privacy' });
          } else {
            openUrl({ url: botPrivacyPolicyUrl || oldLang('BotDefaultPrivacyPolicy') });
          }
          closeMenu();
        }}
      >
        {oldLang('BotPrivacyPolicy')}
      </MenuItem>
    );

    return [...commandButtons || [], privacyButton].filter(Boolean);
  }, [botCommands, oldLang, botPrivacyPolicyUrl, isBot]);

  const deleteTitle = useMemo(() => {
    if (!chat) return undefined;

    if (savedDialog) {
      return oldLang('Delete');
    }

    if (isPrivate) {
      return oldLang('DeleteChatUser');
    }

    if (canDeleteChat) {
      return oldLang('GroupInfo.DeleteAndExit');
    }

    if (isChannel) {
      return oldLang('LeaveChannel');
    }

    return oldLang('Group.LeaveGroup');
  }, [canDeleteChat, chat, isChannel, isPrivate, savedDialog, oldLang]);

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
              {oldLang('Search')}
            </MenuItem>
          )}
          {withForumActions && canCreateTopic && (
            <>
              <MenuItem
                icon="comments"
                onClick={handleCreateTopicClick}
              >
                {oldLang('lng_forum_create_topic')}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          {channelMonoforumId && (
            <MenuItem
              icon="message"
              onClick={handleSendChannelMessage}
            >
              {lang('ChannelSendMessage')}
            </MenuItem>
          )}
          {isViewGroupInfoShown && (
            <MenuItem
              icon="info"
              onClick={handleViewGroupInfo}
            >
              {isTopic ? oldLang('lng_context_view_topic') : oldLang('lng_context_view_group')}
            </MenuItem>
          )}
          {canManage && !canEditTopic && (
            <MenuItem
              icon="edit"
              onClick={handleEditClick}
            >
              {oldLang('Edit')}
            </MenuItem>
          )}
          {canEditTopic && (
            <MenuItem
              icon="edit"
              onClick={handleEditTopicClick}
            >
              {oldLang('lng_forum_topic_edit')}
            </MenuItem>
          )}
          {isMobile && !withForumActions && isForum && !isTopic && (
            <MenuItem
              icon="forums"
              onClick={handleViewAsTopicsClick}
            >
              {oldLang('Chat.ContextViewAsTopics')}
            </MenuItem>
          )}
          {withForumActions && Boolean(pendingJoinRequests) && (
            <MenuItem
              icon="user"
              onClick={onJoinRequestsClick}
            >
              {isChannel ? oldLang('SubscribeRequests') : oldLang('MemberRequests')}
              <div className="right-badge">{pendingJoinRequests}</div>
            </MenuItem>
          )}
          {withForumActions && !isTopic && !isForumAsMessages && (
            <MenuItem
              icon="message"
              onClick={handleOpenAsMessages}
            >
              {oldLang('lng_forum_view_as_messages')}
            </MenuItem>
          )}
          {withExtraActions && canStartBot && (
            <MenuItem
              icon="bots"
              onClick={handleStartBot}
            >
              {oldLang('BotStart')}
            </MenuItem>
          )}
          {withExtraActions && canSubscribe && (
            <MenuItem
              icon={isChannel ? 'channel' : 'group'}
              onClick={handleSubscribe}
            >
              {oldLang(isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup')}
            </MenuItem>
          )}
          {canShowBoostModal && !canViewBoosts && (
            <MenuItem
              icon="boost-outline"
              onClick={handleBoostClick}
            >
              {oldLang(isChannel ? 'BoostingBoostChannelMenu' : 'BoostingBoostGroupMenu')}
            </MenuItem>
          )}
          {canAddContact && (
            <MenuItem
              icon="add-user"
              onClick={handleAddContactClick}
            >
              {oldLang('AddContact')}
            </MenuItem>
          )}
          {isMobile && canCall && (
            <MenuItem
              icon="phone"
              onClick={handleCall}
            >
              {oldLang('Call')}
            </MenuItem>
          )}
          {canCall && (
            <MenuItem
              icon="video-outlined"
              onClick={handleVideoCall}
            >
              {oldLang('VideoCall')}
            </MenuItem>
          )}
          {canMute && (isMuted ? (
            <MenuItem
              icon="unmute"
              onClick={handleUnmuteClick}
            >
              {oldLang('ChatsUnmute')}
            </MenuItem>
          )
            : (
              <MenuItem
                icon="mute"
                onClick={handleMuteClick}
              >
                {oldLang('ChatsMute')}
                ...
              </MenuItem>
            )
          )}
          {(canEnterVoiceChat || canCreateVoiceChat) && (
            <MenuItem
              icon="voice-chat"
              onClick={handleEnterVoiceChatClick}
            >
              {oldLang(canCreateVoiceChat ? 'StartVoipChat' : 'VoipGroupJoinCall')}
            </MenuItem>
          )}
          {hasLinkedChat && (
            <MenuItem
              icon={isChannel ? 'comments' : 'channel'}
              onClick={handleLinkedChatClick}
            >
              {oldLang(isChannel ? 'ViewDiscussion' : 'lng_profile_view_channel')}
            </MenuItem>
          )}
          {!withForumActions && (
            <MenuItem
              icon="select"
              onClick={handleSelectMessages}
            >
              {oldLang('ReportSelectMessages')}
            </MenuItem>
          )}
          {canViewBoosts && (
            <MenuItem
              icon="boost-outline"
              onClick={handleBoostClick}
            >
              {oldLang('Boosts')}
            </MenuItem>
          )}
          {canViewStatistics && (
            <MenuItem
              icon="stats"
              onClick={handleStatisticsClick}
            >
              {oldLang('Statistics')}
            </MenuItem>
          )}
          {isChannel && canViewMonetization && (
            <MenuItem
              icon="cash-circle"
              onClick={handleMonetizationClick}
            >
              {oldLang('lng_channel_earn_title')}
            </MenuItem>
          )}
          {canTranslate && (
            <MenuItem
              icon="language"
              onClick={handleEnableTranslations}
            >
              {oldLang('lng_context_translate')}
            </MenuItem>
          )}
          {canReportChat && (
            <MenuItem
              icon="flag"
              onClick={handleReport}
            >
              {oldLang('ReportPeer.Report')}
            </MenuItem>
          )}
          {botButtons}
          {canGift && (
            <MenuItem
              icon="gift"
              onClick={handleGiftClick}
            >
              {oldLang('ProfileSendAGift')}
            </MenuItem>
          )}
          {isBot && (
            <MenuItem
              icon={isBlocked ? 'bots' : 'hand-stop'}
              onClick={isBlocked ? handleRestartBot : handleBlock}
            >
              {isBlocked ? oldLang('BotRestart') : oldLang('Bot.Stop')}
            </MenuItem>
          )}
          {isPrivate && !isChatWithSelf && !isBot && (
            <MenuItem
              icon={isBlocked ? 'user' : 'hand-stop'}
              onClick={isBlocked ? handleUnblock : handleBlock}
            >
              {isBlocked ? oldLang('Unblock') : oldLang('BlockUser')}
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
      </div>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const isRestricted = selectIsChatRestricted(global, chatId);
    if (!chat || isRestricted) {
      return {} as Complete<StateProps>;
    }
    const isPrivate = isUserId(chat.id);
    const user = isPrivate ? selectUser(global, chatId) : undefined;
    const canAddContact = user && getCanAddContact(user);
    const isMainThread = threadId === MAIN_THREAD_ID;
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};
    const canReportChat = isMainThread && !user && (isChatChannel(chat) || isChatGroup(chat)) && !isChatAdmin(chat);

    const chatBot = !isSystemBot(chatId) ? selectBot(global, chatId) : undefined;
    const userFullInfo = isPrivate ? selectUserFullInfo(global, chatId) : undefined;
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, chatId) : undefined;
    const fullInfo = userFullInfo || chatFullInfo;
    const canGift = selectCanGift(global, chatId);

    const topic = selectTopic(global, chatId, threadId);
    const canCreateTopic = chat.isForum && (
      chat.isCreator || !isUserRightBanned(chat, 'manageTopics') || getHasAdminRight(chat, 'manageTopics')
    );
    const canEditTopic = topic && getCanManageTopic(chat, topic);
    const canManage = selectCanManage(global, chatId);
    // Context menu item should only be displayed if user hid translation panel
    const canTranslate = selectCanTranslateChat(global, chatId) && fullInfo?.isTranslationDisabled;

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
    const savedDialog = isSavedDialog ? selectChat(global, String(threadId)) : undefined;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);
    const chatInfo = selectTabState(global).chatInfo;

    return {
      chat,
      isMuted: getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id)),
      isPrivate,
      isTopic: chat?.isForum && !isMainThread,
      isForum: chat?.isForum,
      isForumAsMessages: chat?.isForumAsMessages,
      canAddContact,
      canDeleteChat: getCanDeleteChat(chat),
      canReportChat,
      canGift,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      botCommands: chatBot ? userFullInfo?.botInfo?.commands : undefined,
      botPrivacyPolicyUrl: chatBot ? userFullInfo?.botInfo?.privacyPolicyUrl : undefined,
      isChatInfoShown: chatInfo.isOpen && currentChatId === chatId && currentThreadId === threadId,
      canCreateTopic,
      canEditTopic,
      canManage,
      isRightColumnShown: selectIsRightColumnShown(global),
      canTranslate,
      isBlocked: userFullInfo?.isBlocked,
      isBot: Boolean(chatBot),
      isChatWithSelf,
      savedDialog,
      disallowedGifts: userFullInfo?.disallowedGifts,
      isAccountFrozen,
    };
  },
)(HeaderMenuContainer));
