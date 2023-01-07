import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  ApiChat,
  ApiUser,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiFormattedText,
  ApiUserStatus,
  ApiTopic,
  ApiTypingStatus,
} from '../../../api/types';
import type { AnimationLevel } from '../../../types';
import type { ChatAnimationTypes } from './hooks';

import { ANIMATION_END_DELAY } from '../../../config';
import { MAIN_THREAD_ID } from '../../../api/types';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import {
  isUserId,
  getPrivateChatUserId,
  getMessageAction,
  selectIsChatMuted,
} from '../../../global/helpers';
import {
  selectChat,
  selectUser,
  selectChatMessage,
  selectOutgoingStatus,
  selectDraft,
  selectCurrentMessageList,
  selectNotifySettings,
  selectNotifyExceptions,
  selectUserStatus,
  selectIsDefaultEmojiStatusPack,
  selectTopicFromMessage,
  selectThreadParam,
  selectIsForumPanelOpen,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { fastRaf } from '../../../util/schedulers';
import buildStyle from '../../../util/buildStyle';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import useChatListEntry from './hooks/useChatListEntry';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import usePrevious from '../../../hooks/usePrevious';

import Avatar from '../../common/Avatar';
import LastMessageMeta from '../../common/LastMessageMeta';
import DeleteChatModal from '../../common/DeleteChatModal';
import ListItem from '../../ui/ListItem';
import Badge from './Badge';
import ChatFolderModal from '../ChatFolderModal.async';
import ChatCallStatus from './ChatCallStatus';
import ReportModal from '../../common/ReportModal';
import FullNameTitle from '../../common/FullNameTitle';

import './Chat.scss';

const TRANSFORM_TO_TOPIC_LIST_ANIMATION_DELAY = 300;

type OwnProps = {
  chatId: string;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
  offsetTopInSmallerMode: number;
  offsetTop: number;
  observeIntersection?: ObserveFn;
  onDragEnter?: (chatId: string) => void;
};

type StateProps = {
  chat?: ApiChat;
  isMuted?: boolean;
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  isEmojiStatusColored?: boolean;
  actionTargetUserIds?: string[];
  actionTargetMessage?: ApiMessage;
  actionTargetChatId?: string;
  lastMessageSender?: ApiUser | ApiChat;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  draft?: ApiFormattedText;
  animationLevel?: AnimationLevel;
  isSelected?: boolean;
  isForumPanelActive?: boolean;
  canScrollDown?: boolean;
  canChangeFolder?: boolean;
  lastSyncTime?: number;
  lastMessageTopic?: ApiTopic;
  typingStatus?: ApiTypingStatus;
  forumPanelChatId?: string;
};

const Chat: FC<OwnProps & StateProps> = ({
  chatId,
  folderId,
  orderDiff,
  animationType,
  isPinned,
  observeIntersection,
  chat,
  isMuted,
  user,
  userStatus,
  isEmojiStatusColored,
  actionTargetUserIds,
  lastMessageSender,
  lastMessageOutgoingStatus,
  actionTargetMessage,
  actionTargetChatId,
  offsetTopInSmallerMode,
  offsetTop,
  draft,
  animationLevel,
  isSelected,
  isForumPanelActive,
  canScrollDown,
  canChangeFolder,
  lastSyncTime,
  lastMessageTopic,
  typingStatus,
  forumPanelChatId,
  onDragEnter,
}) => {
  const {
    openChat,
    openForumPanel,
    closeForumPanel,
    focusLastMessage,
    loadTopics,
  } = getActions();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();
  const [shouldRenderReportModal, markRenderReportModal, unmarkRenderReportModal] = useFlag();

  const { lastMessage, isForum } = chat || {};

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    typingStatus,
    draft,
    actionTargetMessage,
    actionTargetUserIds,
    actionTargetChatId,
    lastMessageTopic,
    lastMessageSender,
    observeIntersection,

    animationType,
    animationLevel,
    orderDiff,
  });

  const handleClick = useCallback(() => {
    if (chat?.isForum) {
      openForumPanel({ chatId });
      return;
    }

    if (forumPanelChatId) closeForumPanel();
    openChat({ id: chatId, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  }, [
    chat?.isForum, forumPanelChatId, closeForumPanel, openChat, chatId, isSelected, canScrollDown, openForumPanel,
    focusLastMessage,
  ]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    onDragEnter?.(chatId);
  }, [chatId, onDragEnter]);

  const handleDelete = useCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  }, [markRenderDeleteModal, openDeleteModal]);

  const handleChatFolderChange = useCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  }, [markRenderChatFolderModal, openChatFolderModal]);

  const handleReport = useCallback(() => {
    markRenderReportModal();
    openReportModal();
  }, [markRenderReportModal, openReportModal]);

  const contextActions = useChatContextActions({
    chat,
    user,
    handleDelete,
    handleChatFolderChange,
    handleReport,
    folderId,
    isPinned,
    isMuted,
    canChangeFolder,
  });

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  // Load the forum topics to display unread count badge
  useEffect(() => {
    if (isIntersecting && lastSyncTime && isForum && chat && chat.topics === undefined) {
      loadTopics({ chatId });
    }
  }, [chat, chatId, isForum, isIntersecting, lastSyncTime, loadTopics]);

  const isOnForumPanel = chatId === forumPanelChatId;
  const prevIsForumPanelActive = usePrevious(isForumPanelActive);
  const isAnimatingRef = useRef(false);

  if (prevIsForumPanelActive !== isForumPanelActive) {
    isAnimatingRef.current = true;
  }

  // Animate changing to smaller chat size when navigating to/from forum topic list
  useLayoutEffect(() => {
    const current = ref.current;

    if (current && isAnimatingRef.current && isForumPanelActive !== prevIsForumPanelActive) {
      current.classList.add('animate-transform');
      current.style.transform = '';
      setTimeout(() => {
        // Wait one more frame for better animation performance
        fastRaf(() => {
          isAnimatingRef.current = false;
          current.classList.remove('animate-transform');
        });
      }, TRANSFORM_TO_TOPIC_LIST_ANIMATION_DELAY + ANIMATION_END_DELAY);
    }
  }, [ref, isForumPanelActive, prevIsForumPanelActive]);

  if (!chat) {
    return undefined;
  }

  const className = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isForum && 'forum',
    isSelected && 'selected',
    isForumPanelActive && 'smaller',
    isOnForumPanel && 'active-forum',
  );

  const chatTop = isForumPanelActive ? (offsetTop - offsetTopInSmallerMode) : offsetTop;
  const offsetAnimate = isForumPanelActive ? offsetTopInSmallerMode : -offsetTopInSmallerMode;

  return (
    <ListItem
      ref={ref}
      className={className}
      style={buildStyle(`top: ${chatTop}px`, isAnimatingRef.current && `transform: translateY(${offsetAnimate}px)`)}
      ripple={!isForum && !IS_SINGLE_COLUMN_LAYOUT}
      contextActions={contextActions}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      shouldUsePortalForMenu={isForumPanelActive}
    >
      <div className="status">
        <Avatar
          chat={chat}
          user={user}
          userStatus={userStatus}
          isSavedMessages={user?.isSelf}
          lastSyncTime={lastSyncTime}
          animationLevel={animationLevel}
          withVideo
          observeIntersection={observeIntersection}
        />
        <div className="status-badge-wrapper">
          <Badge chat={chat} isMuted={isMuted} shouldShowOnlyMostImportant forceHidden={!isForumPanelActive} />
        </div>
        {chat.isCallActive && chat.isCallNotEmpty && (
          <ChatCallStatus isSelected={isSelected} isActive={animationLevel !== 0} />
        )}
      </div>
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            peer={user || chat}
            withEmojiStatus
            isSavedMessages={chatId === user?.id && user?.isSelf}
            observeIntersection={observeIntersection}
            key={!IS_SINGLE_COLUMN_LAYOUT && isEmojiStatusColored ? `${isSelected}` : undefined}
          />
          {isMuted && <i className="icon-muted" />}
          <div className="separator" />
          {chat.lastMessage && (
            <LastMessageMeta
              message={chat.lastMessage}
              outgoingStatus={lastMessageOutgoingStatus}
            />
          )}
        </div>
        <div className="subtitle">
          {renderSubtitle()}
          <Badge chat={chat} isPinned={isPinned} isMuted={isMuted} />
        </div>
      </div>
      {shouldRenderDeleteModal && (
        <DeleteChatModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onCloseAnimationEnd={unmarkRenderDeleteModal}
          chat={chat}
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
      {shouldRenderReportModal && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          onCloseAnimationEnd={unmarkRenderReportModal}
          chatId={chatId}
          subject="peer"
        />
      )}
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    const { senderId, replyToMessageId, isOutgoing } = chat.lastMessage || {};
    const lastMessageSender = senderId
      ? (selectUser(global, senderId) || selectChat(global, senderId)) : undefined;
    const lastMessageAction = chat.lastMessage ? getMessageAction(chat.lastMessage) : undefined;
    const actionTargetMessage = lastMessageAction && replyToMessageId
      ? selectChatMessage(global, chat.id, replyToMessageId)
      : undefined;
    const { targetUserIds: actionTargetUserIds, targetChatId: actionTargetChatId } = lastMessageAction || {};
    const privateChatUserId = getPrivateChatUserId(chat);
    const {
      chatId: currentChatId,
      threadId: currentThreadId,
      type: messageListType,
    } = selectCurrentMessageList(global) || {};
    const isForumPanelActive = selectIsForumPanelOpen(global);
    const isSelected = chatId === currentChatId && currentThreadId === MAIN_THREAD_ID;

    const user = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
    const userStatus = privateChatUserId ? selectUserStatus(global, privateChatUserId) : undefined;
    const statusEmoji = user?.emojiStatus && global.customEmojis.byId[user.emojiStatus.documentId];
    const isEmojiStatusColored = statusEmoji && selectIsDefaultEmojiStatusPack(global, statusEmoji.stickerSetInfo);
    const lastMessageTopic = chat.lastMessage && selectTopicFromMessage(global, chat.lastMessage);

    const typingStatus = selectThreadParam(global, chatId, MAIN_THREAD_ID, 'typingStatus');

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      lastMessageSender,
      actionTargetUserIds,
      actionTargetChatId,
      actionTargetMessage,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      animationLevel: global.settings.byKey.animationLevel,
      isForumPanelActive,
      isSelected,
      canScrollDown: isSelected && messageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      lastSyncTime: global.lastSyncTime,
      ...(isOutgoing && chat.lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, chat.lastMessage),
      }),
      user,
      userStatus,
      isEmojiStatusColored,
      lastMessageTopic,
      typingStatus,
      forumPanelChatId: global.forumPanelChatId,
    };
  },
)(Chat));
