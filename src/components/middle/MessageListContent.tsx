import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { MessageListType } from '../../global/types';

import { SCHEDULED_WHEN_ONLINE } from '../../config';
import buildClassName from '../../util/buildClassName';
import { compact } from '../../util/iteratees';
import { formatHumanDate } from '../../util/dateFormat';
import {
  getMessageHtmlId, getMessageOriginalId, isActionMessage, isOwnMessage, isServiceNotificationMessage,
} from '../../global/helpers';
import useLang from '../../hooks/useLang';
import type { MessageDateGroup } from './helpers/groupMessages';
import { isAlbum } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';
import useScrollHooks from './hooks/useScrollHooks';
import useMessageObservers from './hooks/useMessageObservers';

import Message from './message/Message';
import SponsoredMessage from './message/SponsoredMessage';
import ActionMessage from './ActionMessage';
import { getActions } from '../../global';

interface OwnProps {
  isCurrentUserPremium?: boolean;
  chatId: string;
  messageIds: number[];
  messageGroups: MessageDateGroup[];
  isViewportNewest: boolean;
  isUnread: boolean;
  withUsers: boolean;
  noAvatars: boolean;
  containerRef: RefObject<HTMLDivElement>;
  anchorIdRef: { current: string | undefined };
  memoUnreadDividerBeforeIdRef: { current: number | undefined };
  memoFirstUnreadIdRef: { current: number | undefined };
  threadId: number;
  type: MessageListType;
  isReady: boolean;
  areReactionsInMeta: boolean;
  isScrollingRef: { current: boolean | undefined };
  isScrollPatchNeededRef: { current: boolean | undefined };
  threadTopMessageId: number | undefined;
  hasLinkedChat: boolean | undefined;
  isSchedule: boolean;
  noAppearanceAnimation: boolean;
  onFabToggle: AnyToVoidFunction;
  onNotchToggle: AnyToVoidFunction;
}

const UNREAD_DIVIDER_CLASS = 'unread-divider';

const MessageListContent: FC<OwnProps> = ({
  isCurrentUserPremium,
  chatId,
  messageIds,
  messageGroups,
  isViewportNewest,
  isUnread,
  withUsers,
  areReactionsInMeta,
  noAvatars,
  containerRef,
  anchorIdRef,
  memoUnreadDividerBeforeIdRef,
  memoFirstUnreadIdRef,
  threadId,
  type,
  isReady,
  isScrollingRef,
  isScrollPatchNeededRef,
  threadTopMessageId,
  hasLinkedChat,
  isSchedule,
  noAppearanceAnimation,
  onFabToggle,
  onNotchToggle,
}) => {
  const { openHistoryCalendar } = getActions();

  const {
    observeIntersectionForMedia,
    observeIntersectionForReading,
    observeIntersectionForAnimatedStickers,
  } = useMessageObservers(type, containerRef, memoFirstUnreadIdRef);

  const {
    backwardsTriggerRef,
    forwardsTriggerRef,
    fabTriggerRef,
  } = useScrollHooks(
    type,
    containerRef,
    messageIds,
    isViewportNewest,
    isUnread,
    onFabToggle,
    onNotchToggle,
    isReady,
    isScrollingRef,
    isScrollPatchNeededRef,
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
            observeIntersectionForReading={observeIntersectionForReading}
            observeIntersectionForLoading={observeIntersectionForMedia}
            observeIntersectionForPlaying={observeIntersectionForAnimatedStickers}
            memoFirstUnreadIdRef={memoFirstUnreadIdRef}
            appearanceOrder={messageCountToAnimate - ++appearanceIndex}
            isLastInList={isLastInList}
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

        return compact([
          message.id === memoUnreadDividerBeforeIdRef.current && unreadDivider,
          <Message
            key={key}
            message={message}
            observeIntersectionForBottom={observeIntersectionForReading}
            observeIntersectionForMedia={observeIntersectionForMedia}
            observeIntersectionForAnimatedStickers={observeIntersectionForAnimatedStickers}
            album={album}
            noAvatars={noAvatars}
            withAvatar={position.isLastInGroup && withUsers && !isOwn && !(message.id === threadTopMessageId)}
            withSenderName={position.isFirstInGroup && withUsers && !isOwn}
            areReactionsInMeta={areReactionsInMeta}
            threadId={threadId}
            messageListType={type}
            noComments={hasLinkedChat === false}
            appearanceOrder={messageCountToAnimate - ++appearanceIndex}
            isFirstInGroup={position.isFirstInGroup}
            isLastInGroup={position.isLastInGroup}
            isFirstInDocumentGroup={position.isFirstInDocumentGroup}
            isLastInDocumentGroup={position.isLastInDocumentGroup}
            isLastInList={position.isLastInList}
            memoFirstUnreadIdRef={memoFirstUnreadIdRef}
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
      <div ref={backwardsTriggerRef} key="backwards-trigger" className="backwards-trigger" />
      {dateGroups.flat()}
      {!isCurrentUserPremium && isViewportNewest && (
        <SponsoredMessage key={chatId} chatId={chatId} containerRef={containerRef} />
      )}
      <div
        ref={forwardsTriggerRef}
        key="forwards-trigger"
        className="forwards-trigger"
      />
      <div
        ref={fabTriggerRef}
        key="fab-trigger"
        className="fab-trigger"
      />
    </div>
  );
};

export default memo(MessageListContent);
