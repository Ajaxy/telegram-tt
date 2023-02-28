import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
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

import { MAIN_THREAD_ID } from '../../../api/types';
import { IS_MULTITAB_SUPPORTED } from '../../../util/environment';
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
  selectTopicFromMessage,
  selectThreadParam, selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { createLocationHash } from '../../../util/routing';

import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import useChatListEntry from './hooks/useChatListEntry';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useAppLayout from '../../../hooks/useAppLayout';

import ListItem from '../../ui/ListItem';
import Avatar from '../../common/Avatar';
import LastMessageMeta from '../../common/LastMessageMeta';
import DeleteChatModal from '../../common/DeleteChatModal';
import ReportModal from '../../common/ReportModal';
import FullNameTitle from '../../common/FullNameTitle';
import ChatFolderModal from '../ChatFolderModal.async';
import ChatCallStatus from './ChatCallStatus';
import Badge from './Badge';
import AvatarBadge from './AvatarBadge';

import './Chat.scss';

type OwnProps = {
  chatId: string;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
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
  isSelectedForum?: boolean;
  canScrollDown?: boolean;
  canChangeFolder?: boolean;
  lastSyncTime?: number;
  lastMessageTopic?: ApiTopic;
  typingStatus?: ApiTypingStatus;
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
  offsetTop,
  draft,
  animationLevel,
  isSelected,
  isSelectedForum,
  canScrollDown,
  canChangeFolder,
  lastSyncTime,
  lastMessageTopic,
  typingStatus,
  onDragEnter,
}) => {
  const {
    openChat,
    focusLastMessage,
    loadTopics,
    openForumPanel,
  } = getActions();

  const { isMobile } = useAppLayout();
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
    if (isForum) {
      openForumPanel({ chatId });
      return;
    }

    openChat({ id: chatId, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  }, [isForum, openChat, chatId, isSelected, canScrollDown, openForumPanel, focusLastMessage]);

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
    if (isIntersecting && lastSyncTime && isForum && chat && chat.listedTopicIds === undefined) {
      loadTopics({ chatId });
    }
  }, [chat, chatId, isForum, isIntersecting, lastSyncTime, loadTopics]);

  if (!chat) {
    return undefined;
  }

  const className = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isForum && 'forum',
    isSelected && 'selected',
    isSelectedForum && 'selected-forum',
  );

  return (
    <ListItem
      ref={ref}
      className={className}
      href={IS_MULTITAB_SUPPORTED ? `#${createLocationHash(chatId, 'thread', MAIN_THREAD_ID)}` : undefined}
      style={`top: ${offsetTop}px`}
      ripple={!isForum && !isMobile}
      contextActions={contextActions}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      withPortalForMenu
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
        <AvatarBadge chatId={chatId} />
        {chat.isCallActive && chat.isCallNotEmpty && (
          <ChatCallStatus isMobile={isMobile} isSelected={isSelected} isActive={animationLevel !== 0} />
        )}
      </div>
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            peer={user || chat}
            withEmojiStatus
            isSavedMessages={chatId === user?.id && user?.isSelf}
            observeIntersection={observeIntersection}
            key={!isMobile && isEmojiStatusColored ? `${isSelected}` : undefined}
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
    const isSelected = chatId === currentChatId && currentThreadId === MAIN_THREAD_ID;
    const isSelectedForum = chatId === selectTabState(global).forumPanelChatId;

    const user = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
    const userStatus = privateChatUserId ? selectUserStatus(global, privateChatUserId) : undefined;
    const lastMessageTopic = chat.lastMessage && selectTopicFromMessage(global, chat.lastMessage);

    const typingStatus = selectThreadParam(global, chatId, MAIN_THREAD_ID, 'typingStatus');

    const statusEmoji = user?.emojiStatus && global.customEmojis.byId[user.emojiStatus.documentId];

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      lastMessageSender,
      actionTargetUserIds,
      actionTargetChatId,
      actionTargetMessage,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      animationLevel: global.settings.byKey.animationLevel,
      isSelected,
      isSelectedForum,
      canScrollDown: isSelected && messageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      lastSyncTime: global.lastSyncTime,
      ...(isOutgoing && chat.lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, chat.lastMessage),
      }),
      user,
      userStatus,
      lastMessageTopic,
      typingStatus,
      isEmojiStatusColored: statusEmoji?.shouldUseTextColor,
    };
  },
)(Chat));
