import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiDraft,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiPeer,
  ApiTopic,
  ApiTypeStory,
  ApiTypingStatus,
  ApiUser,
  ApiUserStatus,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';
import { MAIN_THREAD_ID } from '../../../api/types';
import { StoryViewerOrigin } from '../../../types';

import {
  groupStatefulContent,
  isUserId,
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
  selectDraft,
  selectIsForumPanelClosed,
  selectIsForumPanelOpen,
  selectNotifyDefaults,
  selectNotifyException,
  selectOutgoingStatus,
  selectPeer,
  selectPeerStory,
  selectSender,
  selectTabState,
  selectThreadParam,
  selectTopicFromMessage,
  selectTopicsInfo,
  selectUser,
  selectUserStatus,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { createLocationHash } from '../../../util/routing';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/windowEnvironment';

import useSelectorSignal from '../../../hooks/data/useSelectorSignal';
import useAppLayout from '../../../hooks/useAppLayout';
import useChatContextActions from '../../../hooks/useChatContextActions';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useChatListEntry from './hooks/useChatListEntry';

import Avatar from '../../common/Avatar';
import DeleteChatModal from '../../common/DeleteChatModal';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import LastMessageMeta from '../../common/LastMessageMeta';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';
import MuteChatModal from '../MuteChatModal.async';
import ChatBadge from './ChatBadge';
import ChatCallStatus from './ChatCallStatus';

import './Chat.scss';

type OwnProps = {
  chatId: string;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
  offsetTop?: number;
  isSavedDialog?: boolean;
  isPreview?: boolean;
  previewMessageId?: number;
  className?: string;
  observeIntersection?: ObserveFn;
  onDragEnter?: (chatId: string) => void;
};

type StateProps = {
  chat?: ApiChat;
  lastMessageStory?: ApiTypeStory;
  listedTopicIds?: number[];
  topics?: Record<number, ApiTopic>;
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
  typingStatus?: ApiTypingStatus;
  withInterfaceAnimations?: boolean;
  lastMessageId?: number;
  lastMessage?: ApiMessage;
  currentUserId: string;
  isSynced?: boolean;
};

const Chat: FC<OwnProps & StateProps> = ({
  chatId,
  folderId,
  orderDiff,
  animationType,
  isPinned,
  listedTopicIds,
  topics,
  observeIntersection,
  chat,
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
  typingStatus,
  lastMessageId,
  lastMessage,
  isSavedDialog,
  currentUserId,
  isPreview,
  previewMessageId,
  className,
  isSynced,
  onDragEnter,
}) => {
  const {
    openChat,
    openSavedDialog,
    toggleChatInfo,
    focusLastMessage,
    focusMessage,
    loadTopics,
    openForumPanel,
    closeForumPanel,
    setShouldCloseRightColumn,
    reportMessages,
  } = getActions();

  const { isMobile } = useAppLayout();
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();

  const { isForum, isForumAsMessages } = chat || {};

  useEnsureMessage(isSavedDialog ? currentUserId : chatId, lastMessageId, lastMessage);

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    typingStatus,
    draft,
    statefulMediaContent: groupStatefulContent({ story: lastMessageStory }),
    lastMessageTopic,
    lastMessageSender,
    observeIntersection,
    animationType,
    withInterfaceAnimations,
    orderDiff,
    isSavedDialog,
    isPreview,
    topics,
  });

  const getIsForumPanelClosed = useSelectorSignal(selectIsForumPanelClosed);

  const handleClick = useLastCallback(() => {
    const noForumTopicPanel = isMobile && isForumAsMessages;

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

        if (!isForumAsMessages) return;
      }
    }

    openChat({ id: chatId, noForumTopicPanel, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  });

  const handleDragEnter = useLastCallback((e) => {
    e.preventDefault();
    onDragEnter?.(chatId);
  });

  const handleDelete = useLastCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  });

  const handleMute = useLastCallback(() => {
    markRenderMuteModal();
    openMuteModal();
  });

  const handleChatFolderChange = useLastCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  });

  const handleReport = useLastCallback(() => {
    if (!chat) return;
    reportMessages({ chatId: chat.id, messageIds: [] });
  });

  const contextActions = useChatContextActions({
    chat,
    user,
    handleDelete,
    handleMute,
    handleChatFolderChange,
    handleReport,
    folderId,
    isPinned,
    isMuted,
    canChangeFolder,
    isSavedDialog,
    currentUserId,
    isPreview,
  });

  const isIntersecting = useIsIntersecting(ref, chat ? observeIntersection : undefined);

  // Load the forum topics to display unread count badge
  useEffect(() => {
    if (isIntersecting && isForum && isSynced && listedTopicIds === undefined) {
      loadTopics({ chatId });
    }
  }, [chatId, listedTopicIds, isSynced, isForum, isIntersecting]);

  const isOnline = user && userStatus && isUserOnline(user, userStatus);
  const { hasShownClass: isAvatarOnlineShown } = useShowTransitionDeprecated(isOnline);

  const href = useMemo(() => {
    if (!IS_OPEN_IN_NEW_TAB_SUPPORTED) return undefined;

    if (isSavedDialog) {
      return `#${createLocationHash(currentUserId, 'thread', chatId)}`;
    }

    return `#${createLocationHash(chatId, 'thread', MAIN_THREAD_ID)}`;
  }, [chatId, currentUserId, isSavedDialog]);

  if (!chat) {
    return undefined;
  }

  const peer = user || chat;

  const chatClassName = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isForum && 'forum',
    isSelected && 'selected',
    isSelectedForum && 'selected-forum',
    isPreview && 'standalone',
    className,
  );

  return (
    <ListItem
      ref={ref}
      className={chatClassName}
      href={href}
      style={`top: ${offsetTop}px`}
      ripple={!isForum && !isMobile}
      contextActions={contextActions}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      withPortalForMenu
    >
      <div className={buildClassName('status', 'status-clickable')}>
        <Avatar
          peer={peer}
          isSavedMessages={user?.isSelf}
          isSavedDialog={isSavedDialog}
          size={isPreview ? 'medium' : 'large'}
          withStory={!user?.isSelf}
          withStoryGap={isAvatarOnlineShown || Boolean(chat.subscriptionUntil)}
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
          <ChatBadge
            chat={chat}
            isMuted={isMuted}
            shouldShowOnlyMostImportant
            forceHidden={getIsForumPanelClosed}
            topics={topics}
            isSelected={isSelected}
          />
        </div>
        {chat.isCallActive && chat.isCallNotEmpty && (
          <ChatCallStatus isMobile={isMobile} isSelected={isSelected} isActive={withInterfaceAnimations} />
        )}
      </div>
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            peer={peer}
            withEmojiStatus
            isSavedMessages={chatId === user?.id && user?.isSelf}
            isSavedDialog={isSavedDialog}
            observeIntersection={observeIntersection}
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
              topics={topics}
              isSelected={isSelected}
            />
          )}
        </div>
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
    chatId, isSavedDialog, isPreview, previewMessageId,
  }): StateProps => {
    const chat = selectChat(global, chatId);
    const user = selectUser(global, chatId);
    if (!chat) {
      return {
        currentUserId: global.currentUserId!,
      };
    }

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
      type: messageListType,
    } = selectCurrentMessageList(global) || {};
    const isSelected = !isPreview && chatId === currentChatId && (isSavedDialog
      ? chatId === currentThreadId : currentThreadId === MAIN_THREAD_ID);
    const isSelectedForum = (chat.isForum && chatId === currentChatId)
      || chatId === selectTabState(global).forumPanelChatId;

    const userStatus = selectUserStatus(global, chatId);
    const lastMessageTopic = lastMessage && selectTopicFromMessage(global, lastMessage);

    const typingStatus = selectThreadParam(global, chatId, MAIN_THREAD_ID, 'typingStatus');

    const topicsInfo = selectTopicsInfo(global, chatId);

    const storyData = lastMessage?.content.storyData;
    const lastMessageStory = storyData && selectPeerStory(global, storyData.peerId, storyData.id);

    return {
      chat,
      isMuted: getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id)),
      lastMessageSender,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      isSelected,
      isSelectedForum,
      isForumPanelOpen: selectIsForumPanelOpen(global),
      canScrollDown: isSelected && messageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      ...(isOutgoing && lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, lastMessage),
      }),
      user,
      userStatus,
      lastMessageTopic,
      typingStatus,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      lastMessage,
      lastMessageId,
      currentUserId: global.currentUserId!,
      listedTopicIds: topicsInfo?.listedTopicIds,
      topics: topicsInfo?.topicsById,
      isSynced: global.isSynced,
      lastMessageStory,
    };
  },
)(Chat));
