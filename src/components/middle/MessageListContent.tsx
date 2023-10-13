import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { MessageListType } from '../../global/types';
import type { Signal } from '../../util/signals';
import type { MessageDateGroup } from './helpers/groupMessages';
import type { PinnedIntersectionChangedCallback } from './hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../api/types';

import { SCHEDULED_WHEN_ONLINE } from '../../config';
import {
  getMessageHtmlId,
  getMessageOriginalId,
  isActionMessage,
  isMainThread,
  isOwnMessage,
  isServiceNotificationMessage,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatHumanDate } from '../../util/dateFormat';
import { compact } from '../../util/iteratees';
import { isAlbum } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useDerivedSignal from '../../hooks/useDerivedSignal';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useMessageObservers from './hooks/useMessageObservers';
import useScrollHooks from './hooks/useScrollHooks';

import ActionMessage from './ActionMessage';
import Message from './message/Message';
import SponsoredMessage from './message/SponsoredMessage';
import MessageListBotInfo from './MessageListBotInfo';

interface OwnProps {
  isCurrentUserPremium?: boolean;
  chatId: string;
  threadId: number;
  messageIds: number[];
  messageGroups: MessageDateGroup[];
  getContainerHeight: Signal<number | undefined>;
  isViewportNewest: boolean;
  isUnread: boolean;
  withUsers: boolean;
  isChannelChat: boolean | undefined;
  isComments?: boolean;
  noAvatars: boolean;
  containerRef: RefObject<HTMLDivElement>;
  anchorIdRef: { current: string | undefined };
  memoUnreadDividerBeforeIdRef: { current: number | undefined };
  memoFirstUnreadIdRef: { current: number | undefined };
  type: MessageListType;
  isReady: boolean;
  threadTopMessageId: number | undefined;
  hasLinkedChat: boolean | undefined;
  isSchedule: boolean;
  shouldRenderBotInfo?: boolean;
  noAppearanceAnimation: boolean;
  onFabToggle: AnyToVoidFunction;
  onNotchToggle: AnyToVoidFunction;
  onPinnedIntersectionChange: PinnedIntersectionChangedCallback;
}

const UNREAD_DIVIDER_CLASS = 'unread-divider';

const MessageListContent: FC<OwnProps> = ({
  isCurrentUserPremium,
  chatId,
  threadId,
  messageIds,
  messageGroups,
  getContainerHeight,
  isViewportNewest,
  isUnread,
  isComments,
  withUsers,
  isChannelChat,
  noAvatars,
  containerRef,
  anchorIdRef,
  memoUnreadDividerBeforeIdRef,
  memoFirstUnreadIdRef,
  type,
  isReady,
  threadTopMessageId,
  hasLinkedChat,
  isSchedule,
  shouldRenderBotInfo,
  noAppearanceAnimation,
  onFabToggle,
  onNotchToggle,
  onPinnedIntersectionChange,
}) => {
  const { openHistoryCalendar } = getActions();

  const getIsReady = useDerivedSignal(isReady);

  const {
    observeIntersectionForReading,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
  } = useMessageObservers(type, containerRef, memoFirstUnreadIdRef, onPinnedIntersectionChange, chatId);

  const {
    withHistoryTriggers,
    backwardsTriggerRef,
    forwardsTriggerRef,
    fabTriggerRef,
  } = useScrollHooks(
    type,
    containerRef,
    messageIds,
    getContainerHeight,
    isViewportNewest,
    isUnread,
    onFabToggle,
    onNotchToggle,
    isReady,
  );

  const lang = useLang();

  const unreadDivider = (
    <div className={buildClassName(UNREAD_DIVIDER_CLASS, 'local-action-message')} key="unread-messages">
      <span>{lang('UnreadMessages')}</span>
    </div>
  );
  const messageCountToAnimate = noAppearanceAnimation ? 0 : messageGroups.reduce((acc, messageGroup) => {
    return acc + messageGroup.senderGroups.flat().length;
  }, 0);
  let appearanceIndex = 0;

  const prevMessageIds = usePrevious(messageIds);
  const isNewMessage = Boolean(
    messageIds && prevMessageIds && messageIds[messageIds.length - 2] === prevMessageIds[prevMessageIds.length - 1],
  );

  const dateGroups = messageGroups.map((
    dateGroup: MessageDateGroup,
    dateGroupIndex: number,
    dateGroupsArray: MessageDateGroup[],
  ) => {
    const senderGroups = dateGroup.senderGroups.map((
      senderGroup,
      senderGroupIndex,
      senderGroupsArray,
    ) => {
      if (
        senderGroup.length === 1
        && !isAlbum(senderGroup[0])
        && isActionMessage(senderGroup[0])
        && !senderGroup[0].content.action?.phoneCall
      ) {
        const message = senderGroup[0]!;
        const isLastInList = (
          senderGroupIndex === senderGroupsArray.length - 1
          && dateGroupIndex === dateGroupsArray.length - 1
        );

        return compact([
          message.id === memoUnreadDividerBeforeIdRef.current && unreadDivider,
          <ActionMessage
            key={message.id}
            message={message}
            threadId={threadId}
            messageListType={type}
            isInsideTopic={Boolean(threadId && threadId !== MAIN_THREAD_ID)}
            observeIntersectionForReading={observeIntersectionForReading}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            memoFirstUnreadIdRef={memoFirstUnreadIdRef}
            appearanceOrder={messageCountToAnimate - ++appearanceIndex}
            isJustAdded={isLastInList && isNewMessage}
            isLastInList={isLastInList}
            onPinnedIntersectionChange={onPinnedIntersectionChange}
          />,
        ]);
      }

      let currentDocumentGroupId: string | undefined;

      return senderGroup.map((
        messageOrAlbum,
        messageIndex,
      ) => {
        const message = isAlbum(messageOrAlbum) ? messageOrAlbum.mainMessage : messageOrAlbum;
        const album = isAlbum(messageOrAlbum) ? messageOrAlbum : undefined;
        const isOwn = isOwnMessage(message);
        const isMessageAlbum = isAlbum(messageOrAlbum);
        const nextMessage = senderGroup[messageIndex + 1];

        if (message.previousLocalId && anchorIdRef.current === getMessageHtmlId(message.previousLocalId)) {
          anchorIdRef.current = getMessageHtmlId(message.id);
        }

        const documentGroupId = !isMessageAlbum && message.groupedId ? message.groupedId : undefined;
        const nextDocumentGroupId = nextMessage && !isAlbum(nextMessage) ? nextMessage.groupedId : undefined;

        const position = {
          isFirstInGroup: messageIndex === 0,
          isLastInGroup: messageIndex === senderGroup.length - 1,
          isFirstInDocumentGroup: Boolean(documentGroupId && documentGroupId !== currentDocumentGroupId),
          isLastInDocumentGroup: Boolean(documentGroupId && documentGroupId !== nextDocumentGroupId),
          isLastInList: (
            messageIndex === senderGroup.length - 1
            && senderGroupIndex === senderGroupsArray.length - 1
            && dateGroupIndex === dateGroupsArray.length - 1
          ),
        };

        currentDocumentGroupId = documentGroupId;

        const originalId = getMessageOriginalId(message);
        // Service notifications saved in cache in previous versions may share the same `previousLocalId`
        const key = isServiceNotificationMessage(message) ? `${message.date}_${originalId}` : originalId;

        const isScheduledMessage = type === 'scheduled';
        const noComments = hasLinkedChat === false || !isChannelChat;
        const noReplies = !noComments || isScheduledMessage || !isMainThread(threadId);
        const isTopicTopMessage = message.id === threadTopMessageId;

        return compact([
          message.id === memoUnreadDividerBeforeIdRef.current && unreadDivider,
          <Message
            key={key}
            message={message}
            observeIntersectionForBottom={observeIntersectionForReading}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            album={album}
            noAvatars={noAvatars}
            withAvatar={position.isLastInGroup && withUsers && !isOwn && (!isTopicTopMessage || !isComments)}
            withSenderName={position.isFirstInGroup && withUsers && !isOwn}
            threadId={threadId}
            messageListType={type}
            noComments={noComments}
            noReplies={noReplies}
            appearanceOrder={messageCountToAnimate - ++appearanceIndex}
            isJustAdded={position.isLastInList && isNewMessage}
            isFirstInGroup={position.isFirstInGroup}
            isLastInGroup={position.isLastInGroup}
            isFirstInDocumentGroup={position.isFirstInDocumentGroup}
            isLastInDocumentGroup={position.isLastInDocumentGroup}
            isLastInList={position.isLastInList}
            memoFirstUnreadIdRef={memoFirstUnreadIdRef}
            onPinnedIntersectionChange={onPinnedIntersectionChange}
            getIsMessageListReady={getIsReady}
          />,
          message.id === threadTopMessageId && (
            <div className="local-action-message" key="discussion-started">
              <span>{lang('DiscussionStarted')}</span>
            </div>
          ),
        ]);
      }).flat();
    });

    return (
      <div
        className="message-date-group"
        key={dateGroup.datetime}
        onMouseDown={preventMessageInputBlur}
        teactFastList
      >
        <div
          className={buildClassName('sticky-date', !isSchedule && 'interactive')}
          key="date-header"
          onMouseDown={preventMessageInputBlur}
          onClick={!isSchedule ? () => openHistoryCalendar({ selectedAt: dateGroup.datetime }) : undefined}
        >
          <span dir="auto">
            {isSchedule && dateGroup.originalDate === SCHEDULED_WHEN_ONLINE && (
              lang('MessageScheduledUntilOnline')
            )}
            {isSchedule && dateGroup.originalDate !== SCHEDULED_WHEN_ONLINE && (
              lang('MessageScheduledOn', formatHumanDate(lang, dateGroup.datetime, undefined, true))
            )}
            {!isSchedule && formatHumanDate(lang, dateGroup.datetime)}
          </span>
        </div>
        {senderGroups.flat()}
      </div>
    );
  });

  return (
    <div className="messages-container" teactFastList>
      {withHistoryTriggers && <div ref={backwardsTriggerRef} key="backwards-trigger" className="backwards-trigger" />}
      {shouldRenderBotInfo && <MessageListBotInfo isInMessageList key={`bot_info_${chatId}`} chatId={chatId} />}
      {dateGroups.flat()}
      {!isCurrentUserPremium && isViewportNewest && (
        <SponsoredMessage key={chatId} chatId={chatId} containerRef={containerRef} />
      )}
      {withHistoryTriggers && (
        <div
          ref={forwardsTriggerRef}
          key="forwards-trigger"
          className="forwards-trigger"
        />
      )}
      <div
        ref={fabTriggerRef}
        key="fab-trigger"
        className="fab-trigger"
      />
    </div>
  );
};

export default memo(MessageListContent);
