import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiFormattedText, ApiMessage, ApiMessageOutgoingStatus,
  ApiPeer, ApiTopic, ApiTypingStatus,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';

import { getMessageAction } from '../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectCanDeleteTopic,
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectDraft,
  selectOutgoingStatus,
  selectThreadInfo,
  selectThreadParam,
  selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { createLocationHash } from '../../../util/routing';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/windowEnvironment';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useChatListEntry from './hooks/useChatListEntry';
import useTopicContextActions from './hooks/useTopicContextActions';

import LastMessageMeta from '../../common/LastMessageMeta';
import TopicIcon from '../../common/TopicIcon';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import MuteChatModal from '../MuteChatModal.async';
import ChatBadge from './ChatBadge';

import styles from './Topic.module.scss';

type OwnProps = {
  chatId: string;
  topic: ApiTopic;
  isSelected: boolean;
  style: string;
  observeIntersection?: ObserveFn;

  orderDiff: number;
  animationType: ChatAnimationTypes;
};

type StateProps = {
  chat: ApiChat;
  canDelete?: boolean;
  lastMessage?: ApiMessage;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  actionTargetMessage?: ApiMessage;
  actionTargetUserIds?: string[];
  lastMessageSender?: ApiPeer;
  actionTargetChatId?: string;
  typingStatus?: ApiTypingStatus;
  draft?: ApiFormattedText;
  canScrollDown?: boolean;
  wasTopicOpened?: boolean;
  withInterfaceAnimations?: boolean;
};

const Topic: FC<OwnProps & StateProps> = ({
  topic,
  isSelected,
  chatId,
  chat,
  style,
  lastMessage,
  canScrollDown,
  lastMessageOutgoingStatus,
  observeIntersection,
  canDelete,
  actionTargetMessage,
  actionTargetUserIds,
  actionTargetChatId,
  lastMessageSender,
  animationType,
  withInterfaceAnimations,
  orderDiff,
  typingStatus,
  draft,
  wasTopicOpened,
}) => {
  const { openChat, deleteTopic, focusLastMessage } = getActions();

  const lang = useLang();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();

  const {
    isPinned, isClosed,
  } = topic;
  const isMuted = topic.isMuted || (topic.isMuted === undefined && chat.isMuted);

  const handleOpenDeleteModal = useLastCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  });

  const handleDelete = useLastCallback(() => {
    deleteTopic({ chatId: chat.id, topicId: topic.id });
  });

  const handleMute = useLastCallback(() => {
    markRenderMuteModal();
    openMuteModal();
  });

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    draft,
    actionTargetMessage,
    actionTargetUserIds,
    actionTargetChatId,
    lastMessageSender,
    lastMessageTopic: topic,
    observeIntersection,
    isTopic: true,
    typingStatus,

    animationType,
    withInterfaceAnimations,
    orderDiff,
  });

  const handleOpenTopic = useLastCallback(() => {
    openChat({ id: chatId, threadId: topic.id, shouldReplaceHistory: true });

    if (canScrollDown) {
      focusLastMessage();
    }
  });

  const contextActions = useTopicContextActions({
    topic,
    chat,
    wasOpened: wasTopicOpened,
    canDelete,
    handleDelete: handleOpenDeleteModal,
    handleMute,
  });

  return (
    <ListItem
      className={buildClassName(
        styles.root,
        'Chat',
        isSelected && 'selected',
        'chat-item-clickable',
      )}
      onClick={handleOpenTopic}
      style={style}
      href={IS_OPEN_IN_NEW_TAB_SUPPORTED ? `#${createLocationHash(chatId, 'thread', topic.id)}` : undefined}
      contextActions={contextActions}
      withPortalForMenu
      ref={ref}
    >
      <div className="info">
        <div className="info-row">
          <div className={buildClassName('title')}>
            <TopicIcon topic={topic} className={styles.topicIcon} observeIntersection={observeIntersection} />
            <h3 dir="auto" className="fullName">{renderText(topic.title)}</h3>
          </div>
          {topic.isMuted && <i className="icon icon-muted" />}
          <div className="separator" />
          {isClosed && (
            <i className={buildClassName(
              'icon',
              'icon-lock-badge',
              styles.closedIcon,
            )}
            />
          )}
          {lastMessage && (
            <LastMessageMeta
              message={lastMessage}
              outgoingStatus={lastMessageOutgoingStatus}
            />
          )}
        </div>
        <div className="subtitle">
          {renderSubtitle()}
          <ChatBadge
            chat={chat}
            isPinned={isPinned}
            isMuted={isMuted}
            topic={topic}
            wasTopicOpened={wasTopicOpened}
          />
        </div>
      </div>
      {shouldRenderDeleteModal && (
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onCloseAnimationEnd={unmarkRenderDeleteModal}
          confirmIsDestructive
          confirmHandler={handleDelete}
          text={lang('lng_forum_topic_delete_sure')}
          confirmLabel={lang('Delete')}
        />
      )}
      {shouldRenderMuteModal && (
        <MuteChatModal
          isOpen={isMuteModalOpen}
          onClose={closeMuteModal}
          onCloseAnimationEnd={unmarkRenderMuteModal}
          chatId={chatId}
          topicId={topic.id}
        />
      )}
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, topic, isSelected }) => {
    const chat = selectChat(global, chatId);

    const lastMessage = selectChatMessage(global, chatId, topic.lastMessageId)!;
    const { senderId, replyToMessageId, isOutgoing } = lastMessage || {};
    const lastMessageSender = senderId
      ? (selectUser(global, senderId) || selectChat(global, senderId)) : undefined;
    const lastMessageAction = lastMessage ? getMessageAction(lastMessage) : undefined;
    const actionTargetMessage = lastMessageAction && replyToMessageId
      ? selectChatMessage(global, chatId, replyToMessageId)
      : undefined;
    const { targetUserIds: actionTargetUserIds, targetChatId: actionTargetChatId } = lastMessageAction || {};
    const typingStatus = selectThreadParam(global, chatId, topic.id, 'typingStatus');
    const draft = selectDraft(global, chatId, topic.id);
    const threadInfo = selectThreadInfo(global, chatId, topic.id);
    const wasTopicOpened = Boolean(threadInfo?.lastReadInboxMessageId);

    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

    return {
      chat,
      lastMessage,
      actionTargetUserIds,
      actionTargetChatId,
      actionTargetMessage,
      lastMessageSender,
      typingStatus,
      canDelete: selectCanDeleteTopic(global, chatId, topic.id),
      withInterfaceAnimations: selectCanAnimateInterface(global),
      draft,
      ...(isOutgoing && lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, lastMessage),
      }),
      canScrollDown: isSelected && chat?.id === currentChatId && currentThreadId === topic.id,
      wasTopicOpened,
    };
  },
)(Topic));
