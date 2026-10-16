import {
  memo, useCallback, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiDraft,
  ApiTypingStatus,
  ApiUser,
  ApiUserStatus,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';
import { MAIN_THREAD_ID } from '../../../api/types';
import { StoryViewerOrigin, type TopicsInfo } from '../../../types';

import { ALL_FOLDER_ID, UNMUTE_TIMESTAMP } from '../../../config';
import {
  getPeerColorKey,
  groupStatefulContent,
  isChatCommunity,
  isUserOnline,
} from '../../../global/helpers';
import { getIsChatMuted } from '../../../global/helpers/notifications';
import {
  selectCanAnimateInterface,
  selectChat,
  selectChatFullInfo,
  selectChatLastMessageInfo,
  selectCurrentMessageList,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsForumPanelClosed,
  selectIsForumPanelOpen,
  selectMonoforumChannel,
  selectNotifyDefaults,
  selectNotifyException,
  selectTabState,
  selectTopicsInfo,
  selectUser,
  selectUserStatus,
} from '../../../global/selectors';
import { selectDraft, selectThreadLocalStateParam } from '../../../global/selectors/threads';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatCountdown } from '../../../util/dates/duration';
import { isUserId } from '../../../util/entities/ids';
import { getChatFolderIds } from '../../../util/folderManager';
import { createLocationHash } from '../../../util/routing';

import { useSelectorSignal, useShallowSelector } from '../../../hooks/data/useSelector';
import useAppLayout from '../../../hooks/useAppLayout';
import useChatContextActions from '../../../hooks/useChatContextActions';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import { useFastClick } from '../../../hooks/useFastClick';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { getPeerColorClass } from '../../../hooks/usePeerColor';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useChatListEntry from './hooks/useChatListEntry';
import useCommunityMembers from './hooks/useCommunityMembers';

import Avatar from '../../common/Avatar';
import DeleteChatModal from '../../common/DeleteChatModal';
import FullNameTitle from '../../common/FullNameTitle';
import AutoDeleteIcon from '../../common/icons/AutoDeleteIcon';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import LastMessageMeta from '../../common/LastMessageMeta';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';
import MuteChatModal from '../MuteChatModal.async';
import ChatBadge from './ChatBadge';
import ChatCallStatus from './ChatCallStatus';
import ChatTags from './ChatTags';

import './Chat.scss';

type OwnProps = {
  chatId: string;
  folderId?: number;
  orderDiff: number;
  shiftDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
  offsetTop?: number;
  isSavedDialog?: boolean;
  isPreview?: boolean;
  previewMessageId?: number;
  className?: string;
  withTags?: boolean;
  noCommunityChevron?: boolean;
  isInCommunityPanel?: boolean;
  isFoldersSidebarShown?: boolean;
  observeIntersection?: ObserveFn;
  onReorderAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  monoforumChannel?: ApiChat;
  topicsInfo?: TopicsInfo;
  isMuted?: boolean;
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  draft?: ApiDraft;
  isSelected?: boolean;
  isSelectedForum?: boolean;
  isForumPanelOpen?: boolean;
  canScrollDown?: boolean;
  canChangeFolder?: boolean;
  typingStatusByPeerId?: Record<string, ApiTypingStatus>;
  withInterfaceAnimations?: boolean;
  communityFullInfo?: ApiChatFullInfo;
  currentUserId: string;
  isSynced?: boolean;
  isAccountFrozen?: boolean;
  chatFolderIds?: number[];
  orderedFolderIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
  areTagsEnabled?: boolean;
};

const AUTO_DELETE_STORY_GAP_PERCENT = 15;

const Chat = ({
  chatId,
  folderId,
  orderDiff,
  shiftDiff,
  animationType,
  isPinned,
  topicsInfo,
  observeIntersection,
  chat,
  monoforumChannel,
  isMuted,
  user,
  userStatus,
  offsetTop,
  draft,
  withInterfaceAnimations,
  isSelected,
  isSelectedForum,
  isForumPanelOpen,
  canScrollDown,
  canChangeFolder,
  typingStatusByPeerId,
  communityFullInfo,
  isSavedDialog,
  currentUserId,
  isPreview,
  previewMessageId,
  className,
  isSynced,
  isAccountFrozen,
  chatFolderIds,
  orderedFolderIds,
  chatFoldersById,
  areTagsEnabled,
  withTags,
  noCommunityChevron,
  isInCommunityPanel,
  isFoldersSidebarShown,
  onReorderAnimationEnd,
}: OwnProps & StateProps) => {
  const {
    openChat,
    openSavedDialog,
    toggleChatInfo,
    focusMessage,
    loadTopics,
    openForumPanel,
    closeForumPanel,
    setShouldCloseRightColumn,
    reportMessages,
    openFrozenAccountModal,
    updateChatMutedState,
    openQuickPreview,
    scrollMessageListToBottom,
    openCommunityPanel,
    loadFullCommunity,
  } = getActions();

  const lang = useLang();

  // The row itself acts on the same fast-click phase, so a plain `onClick` here
  // would let the chat open first and delay the panel
  const {
    handleClick: handleChevronClick,
    handleMouseDown: handleChevronMouseDown,
  } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (chat?.linkedCommunityId) {
      openCommunityPanel({ communityId: chat.linkedCommunityId });
    }
  });

  const { isMobile } = useAppLayout();
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();

  const { isForum, isForumAsMessages, isMonoforum } = chat || {};
  const isCommunity = Boolean(chat && isChatCommunity(chat));

  const listedTopicIds = topicsInfo?.listedTopicIds;
  const shouldForceNonForumView = chat?.isBotForum && listedTopicIds && !listedTopicIds.length;

  const {
    members: communityMembers, unreadCount: communityUnreadCount, lastMessageChatId = chatId,
  } = useCommunityMembers(communityFullInfo?.linkedPeers) || {};

  const lastMessageInfoSelector = useCallback((global: GlobalState) => selectChatLastMessageInfo(global, {
    chatId, lastMessageChatId, isSavedDialog, previewMessageId,
  }), [chatId, lastMessageChatId, isSavedDialog, previewMessageId]);
  const {
    lastMessage, lastMessageId, lastMessageSender, lastMessageOutgoingStatus, lastMessageTopic, lastMessageStory,
  } = useShallowSelector(lastMessageInfoSelector);

  useEnsureMessage(isSavedDialog ? currentUserId : lastMessageChatId, lastMessageId, lastMessage);

  const tagFolderIds = useMemo(() => {
    const chatFolderIdsSet = new Set(chatFolderIds);

    return orderedFolderIds?.filter((id) => {
      if (!chatFolderIdsSet.has(id)) return undefined;

      const isActive = id === folderId;
      const isAll = id === ALL_FOLDER_ID;

      const folder = chatFoldersById?.[id];
      const hasColor = folder?.color !== undefined && folder.color !== -1;

      return !isActive && !isAll && hasColor;
    });
  }, [orderedFolderIds, folderId, chatFoldersById, chatFolderIds]);

  const isTagsMode = areTagsEnabled && withTags;
  const shouldRenderTags = isTagsMode && Boolean(tagFolderIds?.length);

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    communityMembers,
    typingStatusByPeerId,
    draft,
    statefulMediaContent: groupStatefulContent({ story: lastMessageStory }),
    lastMessageTopic,
    lastMessageSender,
    observeIntersection,
    animationType,
    withInterfaceAnimations,
    orderDiff,
    shiftDiff,
    isSavedDialog,
    isPreview,
    onReorderAnimationEnd,
    topicIds: listedTopicIds,
    hasTags: shouldRenderTags,
    shouldForceNonForumView,
  });

  const getIsForumPanelClosed = useSelectorSignal(selectIsForumPanelClosed);

  const openChatEntry = useLastCallback(() => {
    if (!isPreview && isCommunity) {
      openCommunityPanel({ communityId: chatId });
      return false;
    }

    const noForumTopicPanel = (isMobile && isForumAsMessages) || shouldForceNonForumView;

    if (isMobile) {
      setShouldCloseRightColumn({ value: true });
    }

    if (isPreview) {
      focusMessage({
        chatId,
        messageId: previewMessageId!,
      });
      return false;
    }

    if (isSavedDialog) {
      openSavedDialog({ chatId, noForumTopicPanel: true }, { forceOnHeavyAnimation: true });

      if (isMobile) {
        toggleChatInfo({ force: false });
      }
      return false;
    }

    if (isForum) {
      if (isForumPanelOpen) {
        closeForumPanel(undefined, { forceOnHeavyAnimation: true });

        return false;
      } else {
        if (!noForumTopicPanel) {
          openForumPanel({ chatId }, { forceOnHeavyAnimation: true });
        }

        if (!isForumAsMessages && !shouldForceNonForumView) return false;
      }
    }

    openChat({ id: chatId, noForumTopicPanel, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    return true;
  });

  const handleClick = useLastCallback((e: React.MouseEvent) => {
    if (e.altKey && !isSavedDialog && !isForum && !isPreview && !isCommunity) {
      e.preventDefault();
      openQuickPreview({ id: chatId });
      return;
    }

    if (!isPreview && isCommunity) {
      // The row is a link to a chat view, which a community does not have
      e.preventDefault();
    }

    if (openChatEntry() && isSelected && canScrollDown && e.detail <= 1) {
      scrollMessageListToBottom();
    }
  });

  const handleDelete = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }

    markRenderDeleteModal();
    openDeleteModal();
  });

  const handleMute = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }

    markRenderMuteModal();
    openMuteModal();
  });

  const handleUnmute = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }

    updateChatMutedState({ chatId, mutedUntil: UNMUTE_TIMESTAMP });
  });

  const handleChatFolderChange = useLastCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  });

  const handleReport = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }

    if (!chat) return;
    reportMessages({ chatId: chat.id, messageIds: [] });
  });

  const contextActions = useChatContextActions({
    chat,
    user,
    handleDelete,
    handleMute,
    handleUnmute,
    handleChatFolderChange,
    handleReport,
    folderId,
    isPinned,
    isMuted,
    canChangeFolder,
    isSavedDialog,
    currentUserId,
    isPreview,
    isInCommunityPanel,
    topicIds: listedTopicIds,
  });

  const isIntersecting = useIsIntersecting(ref, chat ? observeIntersection : undefined);

  // Load the forum topics to display unread count badge
  useEffect(() => {
    if (isIntersecting && isForum && isSynced && (!topicsInfo || topicsInfo.isCache)) {
      loadTopics({ chatId });
    }
  }, [chatId, topicsInfo, isSynced, isForum, isIntersecting]);

  // Refresh visible community members, including details restored from cache
  useEffect(() => {
    if (isIntersecting && isCommunity && isSynced && (!communityFullInfo || communityFullInfo.isCache)) {
      loadFullCommunity({ communityId: chatId });
    }
  }, [chatId, communityFullInfo, isSynced, isCommunity, isIntersecting]);

  const isOnline = user && userStatus && isUserOnline(user, userStatus);
  const { hasShownClass: isAvatarOnlineShown } = useShowTransitionDeprecated(isOnline);

  const href = useMemo(() => {
    if (!IS_OPEN_IN_NEW_TAB_SUPPORTED) return undefined;
    // A community opens a left-column panel, not a chat view, so it has no link
    if (isCommunity) return undefined;

    if (isSavedDialog) {
      return `#${createLocationHash(currentUserId, 'thread', chatId)}`;
    }

    return `#${createLocationHash(chatId, 'thread', MAIN_THREAD_ID)}`;
  }, [isCommunity, chatId, currentUserId, isSavedDialog]);

  if (!chat) {
    return undefined;
  }

  const peer = user || chat;
  const avatarPeer = isMonoforum ? monoforumChannel : peer;
  const historyTtlText = chat.ttlPeriod && !isSavedDialog ? formatCountdown(lang, chat.ttlPeriod) : undefined;
  const autoDeleteInfoText = historyTtlText
    ? lang('AutoDeleteSetInfo', { time: historyTtlText })
    : undefined;
  const shouldShowAutoDeleteBadge = !isAvatarOnlineShown && !chat.subscriptionUntil && Boolean(autoDeleteInfoText);
  const avatarColorClassName = shouldShowAutoDeleteBadge
    ? getPeerColorClass(getPeerColorKey(avatarPeer, true)!)
    : undefined;
  const hasActiveCall = Boolean(chat.isCallActive && chat.isCallNotEmpty);
  const hasAvatarCornerBadge = isAvatarOnlineShown || Boolean(chat.subscriptionUntil)
    || shouldShowAutoDeleteBadge || hasActiveCall;

  const chatClassName = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isForum && !shouldForceNonForumView && 'forum',
    isSelected && 'selected',
    isSelectedForum && 'selected-forum',
    isPreview && 'standalone',
    isCommunity && 'community',
    areTagsEnabled && withTags && 'chat-item-with-tags',
    className,
  );

  return (
    <ListItem
      ref={ref}
      className={chatClassName}
      href={href}
      style={offsetTop !== undefined ? `top: ${offsetTop}px` : undefined}
      ripple={!isForum && !isMobile}
      contextActions={contextActions}
      withPortalForMenu
      onClick={handleClick}
      onFileHoverOpen={openChatEntry}
    >
      <div className={buildClassName('status', 'status-clickable')}>
        <div className="avatar-wrapper">
          <Avatar
            peer={avatarPeer}
            isSavedMessages={user?.isSelf}
            isSavedDialog={isSavedDialog}
            size={isPreview ? 'medium' : 'large'}
            asMessageBubble={isMonoforum}
            withStory={!user?.isSelf && !isMonoforum}
            withStoryGap={isAvatarOnlineShown || Boolean(chat.subscriptionUntil) || shouldShowAutoDeleteBadge}
            storyGapPercent={shouldShowAutoDeleteBadge ? AUTO_DELETE_STORY_GAP_PERCENT : undefined}
            storyViewerOrigin={StoryViewerOrigin.ChatList}
            storyViewerMode="single-peer"
          />
          <div className="avatar-badge-wrapper">
            <div
              className={buildClassName('avatar-online', 'avatar-badge', isAvatarOnlineShown && 'avatar-online-shown')}
            />
            {!isAvatarOnlineShown && Boolean(chat.subscriptionUntil) && (
              <StarIcon type="gold" className="avatar-badge avatar-subscription" size="adaptive" />
            )}
            {shouldShowAutoDeleteBadge && (
              <AutoDeleteIcon
                period={chat.ttlPeriod!}
                peer={avatarPeer!}
                className={buildClassName('avatar-badge', avatarColorClassName)}
                ariaLabel={autoDeleteInfoText}
              />
            )}
          </div>
          <ChatBadge
            chat={chat}
            isMuted={isMuted}
            shouldShowOnlyMostImportant
            forceHidden={getIsForumPanelClosed}
            forceUnreadCount={communityUnreadCount}
            isSelected={isSelected}
            isOnAvatar
          />
          {!noCommunityChevron && !hasAvatarCornerBadge && Boolean(chat.linkedCommunityId) && (
            <div
              className="avatar-community-chevron"
              role="button"
              tabIndex={0}
              aria-label={lang('CommunityOpenPanel')}
              onClick={handleChevronClick}
              onMouseDown={handleChevronMouseDown}
            >
              <Icon name="down" />
            </div>
          )}
        </div>
        {hasActiveCall && (
          <ChatCallStatus isMobile={isMobile} isSelected={isSelected} isActive={withInterfaceAnimations} />
        )}
      </div>
      <div className={buildClassName('info', isTagsMode && 'has-tags')}>
        <div className="info-row">
          <FullNameTitle
            peer={avatarPeer!}
            isMonoforum={isMonoforum}
            monoforumBadgeClassName="monoforum-badge"
            withEmojiStatus
            isSavedMessages={chatId === user?.id && user?.isSelf}
            isSavedDialog={isSavedDialog}
            observeIntersection={observeIntersection}
            withStatusTextColor={isSelected}
          />
          {isMuted && !isSavedDialog && <Icon name="muted" />}
          <div className="separator" />
          {lastMessage && (
            <LastMessageMeta
              message={lastMessage}
              outgoingStatus={!isSavedDialog ? lastMessageOutgoingStatus : undefined}
              draftDate={draft?.date}
            />
          )}
        </div>
        <div className="subtitle">
          {renderSubtitle()}
          {!isPreview && (
            <ChatBadge
              chat={chat}
              isPinned={isPinned}
              isMuted={isMuted}
              isSavedDialog={isSavedDialog}
              hasMiniApp={user?.hasMainMiniApp}
              forceUnreadCount={communityUnreadCount}
              isSelected={isSelected}
              transitionClassName="chat-badge-transition"
            />
          )}
        </div>
        {shouldRenderTags && (
          <ChatTags
            itemClassName="chat-tag"
            orderedFolderIds={tagFolderIds}
            chatFoldersById={chatFoldersById}
            isFoldersSidebarShown={isFoldersSidebarShown}
          />
        )}
      </div>
      {shouldRenderDeleteModal && (
        <DeleteChatModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onCloseAnimationEnd={unmarkRenderDeleteModal}
          chat={chat}
          isSavedDialog={isSavedDialog}
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
  (global, {
    chatId, isSavedDialog, isPreview,
  }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const user = selectUser(global, chatId);
    if (!chat) {
      return {
        currentUserId: global.currentUserId!,
      } as Complete<StateProps>;
    }

    const chatFolderIds = getChatFolderIds(chatId);
    const { areTagsEnabled } = global.chatFolders;
    const isPremium = selectIsCurrentUserPremium(global);

    const isCommunity = isChatCommunity(chat);

    const {
      chatId: currentChatId,
      threadId: currentThreadId,
      type: currentMessageListType,
    } = selectCurrentMessageList(global) || {};
    const isSelected = !isPreview && chatId === currentChatId && (isSavedDialog
      ? chatId === currentThreadId : currentThreadId === MAIN_THREAD_ID);
    const isSelectedForum = (chat.isForum && chatId === currentChatId)
      || chatId === selectTabState(global).forumPanelChatId;

    const userStatus = selectUserStatus(global, chatId);

    const typingStatusByPeerId = selectThreadLocalStateParam(global, chatId, MAIN_THREAD_ID, 'typingStatusByPeerId');

    const topicsInfo = selectTopicsInfo(global, chatId);

    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    const monoforumChannel = selectMonoforumChannel(global, chatId);

    return {
      chat,
      communityFullInfo: isCommunity ? selectChatFullInfo(global, chatId) : undefined,
      isMuted: getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id)),
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      isSelected,
      isSelectedForum,
      isForumPanelOpen: selectIsForumPanelOpen(global),
      canScrollDown: isSelected && currentMessageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      user,
      userStatus,
      typingStatusByPeerId,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      currentUserId: global.currentUserId!,
      topicsInfo,
      isSynced: global.isSynced,
      isAccountFrozen,
      monoforumChannel,
      chatFolderIds,
      orderedFolderIds: global.chatFolders.orderedIds,
      chatFoldersById: global.chatFolders.byId,
      areTagsEnabled: areTagsEnabled && isPremium,
    };
  },
)(Chat));
