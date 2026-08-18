import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiChatFolder,
  ApiDraft,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiNotifyPeerType,
  ApiPeer,
  ApiPeerNotifySettings,
  ApiTopic,
  ApiTypeStory,
  ApiTypingStatus,
  ApiUser,
  ApiUserStatus,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';
import type { CommunityMember } from './hooks/useChatListEntry';
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
  selectChatLastMessage,
  selectChatLastMessageId,
  selectChatMessage,
  selectCurrentMessageList,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsForumPanelClosed,
  selectIsForumPanelOpen,
  selectMonoforumChannel,
  selectNotifyDefaults,
  selectNotifyException,
  selectOutgoingStatus,
  selectPeer,
  selectPeerStory,
  selectSender,
  selectTabState,
  selectTopicFromMessage,
  selectTopicsInfo,
  selectUser,
  selectUserStatus,
} from '../../../global/selectors';
import { selectDraft, selectThreadLocalStateParam } from '../../../global/selectors/threads';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatCountdown } from '../../../util/dates/oldDateFormat';
import { isUserId } from '../../../util/entities/ids';
import { getChatFolderIds } from '../../../util/folderManager';
import { mapValues } from '../../../util/iteratees';
import memoized from '../../../util/memoized';
import { createLocationHash } from '../../../util/routing';

import { useSelectorSignal } from '../../../hooks/data/useSelector';
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
  onDragEnter?: (chatId: string) => void;
  onDragLeave?: NoneToVoidFunction;
  onReorderAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  monoforumChannel?: ApiChat;
  lastMessageStory?: ApiTypeStory;
  topicsInfo?: TopicsInfo;
  isMuted?: boolean;
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  lastMessageSender?: ApiPeer;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  draft?: ApiDraft;
  isSelected?: boolean;
  isSelectedForum?: boolean;
  isForumPanelOpen?: boolean;
  canScrollDown?: boolean;
  canChangeFolder?: boolean;
  lastMessageTopic?: ApiTopic;
  typingStatusByPeerId?: Record<string, ApiTypingStatus>;
  withInterfaceAnimations?: boolean;
  lastMessageId?: number;
  lastMessage?: ApiMessage;
  communityMembers?: CommunityMember[];
  communityUnreadCount?: number;
  currentUserId: string;
  isSynced?: boolean;
  isAccountFrozen?: boolean;
  chatFolderIds?: number[];
  orderedFolderIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
  areTagsEnabled?: boolean;
};

const AUTO_DELETE_STORY_GAP_PERCENT = 15;

const Chat: FC<OwnProps & StateProps> = ({
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
  lastMessageStory,
  isMuted,
  user,
  userStatus,
  lastMessageSender,
  lastMessageOutgoingStatus,
  offsetTop,
  draft,
  withInterfaceAnimations,
  isSelected,
  isSelectedForum,
  isForumPanelOpen,
  canScrollDown,
  canChangeFolder,
  lastMessageTopic,
  typingStatusByPeerId,
  lastMessageId,
  lastMessage,
  communityMembers,
  communityUnreadCount,
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
  onDragEnter,
  onDragLeave,
  onReorderAnimationEnd,
}) => {
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

  useEnsureMessage(isSavedDialog ? currentUserId : chatId, lastMessageId, lastMessage);

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

  const handleClick = useLastCallback((e: React.MouseEvent) => {
    if (e.altKey && !isSavedDialog && !isForum && !isPreview && !isCommunity) {
      e.preventDefault();
      openQuickPreview({ id: chatId });
      return;
    }

    if (!isPreview && isCommunity) {
      // The row is a link to a chat view, which a community does not have
      e.preventDefault();
      openCommunityPanel({ communityId: chatId });
      return;
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
      return;
    }

    if (isSavedDialog) {
      openSavedDialog({ chatId, noForumTopicPanel: true }, { forceOnHeavyAnimation: true });

      if (isMobile) {
        toggleChatInfo({ force: false });
      }
      return;
    }

    if (isForum) {
      if (isForumPanelOpen) {
        closeForumPanel(undefined, { forceOnHeavyAnimation: true });

        return;
      } else {
        if (!noForumTopicPanel) {
          openForumPanel({ chatId }, { forceOnHeavyAnimation: true });
        }

        if (!isForumAsMessages && !shouldForceNonForumView) return;
      }
    }

    openChat({ id: chatId, noForumTopicPanel, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown && e.detail <= 1) {
      scrollMessageListToBottom();
    }
  });

  const handleDragEnter = useLastCallback((e) => {
    e.preventDefault();
    onDragEnter?.(chatId);
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
      onDragEnter={handleDragEnter}
      onDragLeave={onDragLeave}
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

type CommunitySummary = {
  members: CommunityMember[];
  unreadChatsCount: number;
};

// A community row derives from its member chats: the subtitle lists their names
// (freshest first, highlighting unmuted unread ones) and the badge counts all
// unread ones, mirroring how forums count unread topics. The map is built for
// all communities at once and memoized by store references, so the chat scan
// reruns only when the stores actually change.
const buildCommunitySummariesById = memoized((
  chatsById: Record<string, ApiChat>,
  lastMessageIds: Record<string, number> | undefined,
  messagesByChatId: GlobalState['messages']['byChatId'],
  notifyDefaults: Record<ApiNotifyPeerType, ApiPeerNotifySettings> | undefined,
  notifyExceptions: Record<string, ApiPeerNotifySettings> | undefined,
): Record<string, CommunitySummary> => {
  const membersByCommunityId: Record<string, (CommunityMember & { date: number; hasUnread?: boolean })[]> = {};

  Object.values(chatsById).forEach((memberChat) => {
    const { linkedCommunityId } = memberChat;
    if (!linkedCommunityId || memberChat.isNotJoined) return;

    const lastMessageId = lastMessageIds?.[memberChat.id];
    const lastMessageDate = (lastMessageId && messagesByChatId[memberChat.id]?.byId[lastMessageId]?.date) || 0;
    // The last message may not be loaded yet, so fall back the same way the chat list order does
    const date = Math.max(memberChat.creationDate || 0, lastMessageDate);
    const threadsById = messagesByChatId[memberChat.id]?.threadsById;
    const mainThreadReadState = threadsById?.[MAIN_THREAD_ID]?.readState;
    const hasUnread = memberChat.isForum
      ? Object.values(threadsById || {}).some((thread) => (
        thread?.readState?.unreadCount || thread?.readState?.hasUnreadMark
      ))
      : Boolean(
        mainThreadReadState?.unreadCount || mainThreadReadState?.hasUnreadMark,
      );
    const isMuted = getIsChatMuted(memberChat, notifyDefaults, notifyExceptions?.[memberChat.id]);

    membersByCommunityId[linkedCommunityId] ??= [];
    membersByCommunityId[linkedCommunityId].push({
      id: memberChat.id,
      title: memberChat.title,
      date,
      isUnread: hasUnread && !isMuted,
      hasUnread,
    });
  });

  return mapValues(membersByCommunityId, (members) => ({
    members: members.sort((a, b) => b.date - a.date)
      .map(({ id, title, isUnread }) => ({ id, title, isUnread })),
    unreadChatsCount: members.filter(({ hasUnread }) => hasUnread).length,
  }));
});

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, isSavedDialog, isPreview, previewMessageId,
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

    const lastMessageId = previewMessageId || selectChatLastMessageId(global, chatId, isSavedDialog ? 'saved' : 'all');
    const lastMessage = previewMessageId
      ? selectChatMessage(global, chatId, previewMessageId)
      : selectChatLastMessage(global, chatId, isSavedDialog ? 'saved' : 'all');
    const { isOutgoing, forwardInfo } = lastMessage || {};
    const savedDialogSender = isSavedDialog && forwardInfo?.fromId ? selectPeer(global, forwardInfo.fromId) : undefined;
    const messageSender = lastMessage ? selectSender(global, lastMessage) : undefined;
    const lastMessageSender = savedDialogSender || messageSender;

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
    const lastMessageTopic = lastMessage && selectTopicFromMessage(global, lastMessage);

    const typingStatusByPeerId = selectThreadLocalStateParam(global, chatId, MAIN_THREAD_ID, 'typingStatusByPeerId');

    const topicsInfo = selectTopicsInfo(global, chatId);

    const storyData = lastMessage?.content.storyData;
    const lastMessageStory = storyData && selectPeerStory(global, storyData.peerId, storyData.id);
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    const monoforumChannel = selectMonoforumChannel(global, chatId);

    const communitySummary = isChatCommunity(chat)
      ? buildCommunitySummariesById(
        global.chats.byId,
        global.chats.lastMessageIds.all,
        global.messages.byChatId,
        selectNotifyDefaults(global),
        global.chats.notifyExceptionById,
      )[chatId]
      : undefined;

    return {
      chat,
      communityMembers: communitySummary?.members,
      communityUnreadCount: communitySummary?.unreadChatsCount,
      isMuted: getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id)),
      lastMessageSender,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      isSelected,
      isSelectedForum,
      isForumPanelOpen: selectIsForumPanelOpen(global),
      canScrollDown: isSelected && currentMessageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      lastMessageOutgoingStatus: isOutgoing && lastMessage && !isSavedDialog
        ? selectOutgoingStatus(global, chatId, MAIN_THREAD_ID, lastMessage.id, 'thread')
        : undefined,
      user,
      userStatus,
      lastMessageTopic,
      typingStatusByPeerId,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      lastMessage,
      lastMessageId,
      currentUserId: global.currentUserId!,
      topicsInfo,
      isSynced: global.isSynced,
      lastMessageStory,
      isAccountFrozen,
      monoforumChannel,
      chatFolderIds,
      orderedFolderIds: global.chatFolders.orderedIds,
      chatFoldersById: global.chatFolders.byId,
      areTagsEnabled: areTagsEnabled && isPremium,
    };
  },
)(Chat));
