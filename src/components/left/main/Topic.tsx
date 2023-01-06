import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiChat, ApiFormattedText, ApiTopic, ApiMessage, ApiMessageOutgoingStatus,
  ApiTypingStatus,
  ApiUser,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';
import type { AnimationLevel } from '../../../types';

import {
  selectCanDeleteTopic,
  selectChat,
  selectChatMessage, selectCurrentMessageList,
  selectDraft,
  selectOutgoingStatus, selectThreadInfo, selectThreadParam, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import useChatListEntry from './hooks/useChatListEntry';
import renderText from '../../common/helpers/renderText';
import { getMessageAction } from '../../../global/helpers';
import useTopicContextActions from './hooks/useTopicContextActions';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import LastMessageMeta from '../../common/LastMessageMeta';
import Badge from './Badge';
import ConfirmDialog from '../../ui/ConfirmDialog';
import TopicIcon from '../../common/TopicIcon';

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
  lastMessageSender?: ApiUser | ApiChat;
  actionTargetChatId?: string;
  animationLevel?: AnimationLevel;
  typingStatus?: ApiTypingStatus;
  draft?: ApiFormattedText;
  canScrollDown?: boolean;
  wasTopicOpened?: boolean;
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
  animationLevel,
  orderDiff,
  typingStatus,
  draft,
  wasTopicOpened,
}) => {
  const { openChat, deleteTopic, focusLastMessage } = getActions();

  const lang = useLang();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();

  const {
    isPinned, isClosed,
  } = topic;
  const isMuted = topic.isMuted || (topic.isMuted === undefined && chat.isMuted);

  const handleOpenDeleteModal = useCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  }, [markRenderDeleteModal, openDeleteModal]);

  const handleDelete = useCallback(() => {
    deleteTopic({ chatId: chat.id, topicId: topic.id });
  }, [chat.id, deleteTopic, topic.id]);

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
    animationLevel,
    orderDiff,
  });

  const handleOpenTopic = useCallback(() => {
    openChat({ id: chatId, threadId: topic.id, shouldReplaceHistory: true });

    if (canScrollDown) {
      focusLastMessage();
    }
  }, [openChat, chatId, topic.id, canScrollDown, focusLastMessage]);

  const contextActions = useTopicContextActions(topic, chat, wasTopicOpened, canDelete, handleOpenDeleteModal);

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
      contextActions={contextActions}
      ref={ref}
    >
      <div className="info">
        <div className="info-row">
          <div className={buildClassName('title')}>
            <TopicIcon topic={topic} className={styles.topicIcon} />
            <h3 dir="auto" className="fullName">{renderText(topic.title)}</h3>
          </div>
          {topic.isMuted && <i className="icon-muted" />}
          <div className="separator" />
          {isClosed && (
            <i className={buildClassName(
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
          <Badge
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
      animationLevel: global.settings.byKey.animationLevel,
      draft,
      ...(isOutgoing && lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, lastMessage),
      }),
      canScrollDown: isSelected && chat?.id === currentChatId && currentThreadId === topic.id,
      wasTopicOpened,
    };
  },
)(Topic));
