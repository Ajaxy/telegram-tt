import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiDraft, ApiMessage, ApiMessageOutgoingStatus,
  ApiPeer, ApiTopic, ApiTypeStory, ApiTypingStatus,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';

import { UNMUTE_TIMESTAMP } from '../../../config';
import { groupStatefulContent } from '../../../global/helpers';
import { getIsChatMuted } from '../../../global/helpers/notifications';
import {
  selectCanAnimateInterface,
  selectCanDeleteTopic,
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectDraft,
  selectNotifyDefaults,
  selectNotifyException,
  selectOutgoingStatus,
  selectPeerStory,
  selectSender,
  selectThreadInfo,
  selectThreadParam,
  selectTopics,
} from '../../../global/selectors';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { createLocationHash } from '../../../util/routing';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useChatListEntry from './hooks/useChatListEntry';
import useTopicContextActions from './hooks/useTopicContextActions';

import Icon from '../../common/icons/Icon';
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
  onReorderAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  chat: ApiChat;
  isChatMuted?: boolean;
  canDelete?: boolean;
  lastMessage?: ApiMessage;
  lastMessageStory?: ApiTypeStory;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  lastMessageSender?: ApiPeer;
  typingStatus?: ApiTypingStatus;
  draft?: ApiDraft;
  canScrollDown?: boolean;
  wasTopicOpened?: boolean;
  withInterfaceAnimations?: boolean;
  topics?: Record<number, ApiTopic>;
};

const Topic: FC<OwnProps & StateProps> = ({
  topic,
  isSelected,
  chatId,
  chat,
  isChatMuted,
  style,
  lastMessage,
  lastMessageStory,
  canScrollDown,
  lastMessageOutgoingStatus,
  observeIntersection,
  canDelete,
  lastMessageSender,
  animationType,
  withInterfaceAnimations,
  orderDiff,
  typingStatus,
  draft,
  wasTopicOpened,
  topics,
  onReorderAnimationEnd,
}) => {
  const {
    openThread,
    deleteTopic,
    scrollMessageListToBottom,
    setViewForumAsMessages,
    updateTopicMutedState,
    openQuickPreview,
  } = getActions();

  const lang = useOldLang();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();

  const {
    isPinned, isClosed, notifySettings,
  } = topic;
  const isMuted = Boolean(notifySettings.mutedUntil || (notifySettings.mutedUntil === undefined && isChatMuted));

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

  const handleUnmute = useLastCallback(() => {
    updateTopicMutedState({ chatId, topicId: topic.id, mutedUntil: UNMUTE_TIMESTAMP });
  });

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    draft,
    lastMessageSender,
    lastMessageTopic: topic,
    observeIntersection,
    isTopic: true,
    typingStatus,
    topics,
    statefulMediaContent: groupStatefulContent({ story: lastMessageStory }),

    animationType,
    withInterfaceAnimations,
    orderDiff,
    onReorderAnimationEnd,
  });

  const handleOpenTopic = useLastCallback((e: React.MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      openQuickPreview({ id: chatId, threadId: topic.id });
      return;
    }

    openThread({ chatId, threadId: topic.id, shouldReplaceHistory: true });
    setViewForumAsMessages({ chatId, isEnabled: false });

    if (canScrollDown) {
      scrollMessageListToBottom();
    }
  });

  const contextActions = useTopicContextActions({
    topic,
    chat,
    isChatMuted,
    wasOpened: wasTopicOpened,
    canDelete,
    handleDelete: handleOpenDeleteModal,
    handleMute,
    handleUnmute,
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
          {Boolean(notifySettings.mutedUntil) && <Icon name="muted" />}
          <div className="separator" />
          {isClosed && (
            <Icon name="lock-badge" className={styles.closedIcon} />
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
            topics={topics}
            isSelected={isSelected}
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

    const lastMessage = selectChatMessage(global, chatId, topic.lastMessageId);
    const { isOutgoing } = lastMessage || {};
    const lastMessageSender = lastMessage && selectSender(global, lastMessage);
    const typingStatus = selectThreadParam(global, chatId, topic.id, 'typingStatus');
    const draft = selectDraft(global, chatId, topic.id);
    const threadInfo = selectThreadInfo(global, chatId, topic.id);
    const wasTopicOpened = Boolean(threadInfo?.lastReadInboxMessageId);
    const topics = selectTopics(global, chatId);

    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

    const storyData = lastMessage?.content.storyData;
    const lastMessageStory = storyData && selectPeerStory(global, storyData.peerId, storyData.id);

    const isChatMuted = chat && getIsChatMuted(
      chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id),
    );

    return {
      chat,
      lastMessage,
      lastMessageSender,
      typingStatus,
      isChatMuted,
      canDelete: selectCanDeleteTopic(global, chatId, topic.id),
      withInterfaceAnimations: selectCanAnimateInterface(global),
      draft,
      ...(isOutgoing && lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, lastMessage),
      }),
      canScrollDown: isSelected && chat?.id === currentChatId && currentThreadId === topic.id,
      wasTopicOpened,
      topics,
      lastMessageStory,
    };
  },
)(Topic));
