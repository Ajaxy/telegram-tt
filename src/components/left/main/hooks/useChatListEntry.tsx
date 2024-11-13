import React, {
  useCallback, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type {
  ApiChat, ApiMessage, ApiPeer, ApiTopic, ApiTypingStatus, ApiUser,
  StatefulMediaContent,
} from '../../../../api/types';
import type { ApiDraft } from '../../../../global/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import { ANIMATION_END_DELAY, CHAT_HEIGHT_PX } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  getExpiredMessageDescription,
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageRoundVideo,
  getMessageSenderName,
  getMessageSticker,
  getMessageVideo,
  isActionMessage,
  isChatChannel,
  isExpiredMessage,
} from '../../../../global/helpers';
import { getMessageReplyInfo } from '../../../../global/helpers/replies';
import buildClassName from '../../../../util/buildClassName';
import { renderActionMessageText } from '../../../common/helpers/renderActionMessageText';
import renderText from '../../../common/helpers/renderText';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { ChatAnimationTypes } from './useChatAnimationType';

import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useEnsureStory from '../../../../hooks/useEnsureStory';
import useMedia from '../../../../hooks/useMedia';
import useOldLang from '../../../../hooks/useOldLang';

import ChatForumLastMessage from '../../../common/ChatForumLastMessage';
import MessageSummary from '../../../common/MessageSummary';
import TypingStatus from '../../../common/TypingStatus';

const ANIMATION_DURATION = 200;

export default function useChatListEntry({
  chat,
  topics,
  lastMessage,
  statefulMediaContent,
  chatId,
  typingStatus,
  draft,
  actionTargetMessage,
  actionTargetUserIds,
  lastMessageTopic,
  lastMessageSender,
  actionTargetChatId,
  observeIntersection,
  animationType,
  orderDiff,
  withInterfaceAnimations,
  isTopic,
  isSavedDialog,
  isPreview,
}: {
  chat?: ApiChat;
  topics?: Record<number, ApiTopic>;
  lastMessage?: ApiMessage;
  statefulMediaContent: StatefulMediaContent | undefined;
  chatId: string;
  typingStatus?: ApiTypingStatus;
  draft?: ApiDraft;
  actionTargetMessage?: ApiMessage;
  actionTargetUserIds?: string[];
  lastMessageTopic?: ApiTopic;
  lastMessageSender?: ApiPeer;
  actionTargetChatId?: string;
  observeIntersection?: ObserveFn;
  isTopic?: boolean;
  isSavedDialog?: boolean;
  isPreview?: boolean;

  animationType: ChatAnimationTypes;
  orderDiff: number;
  withInterfaceAnimations?: boolean;
}) {
  const oldLang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isAction = lastMessage && isActionMessage(lastMessage);

  const replyToMessageId = lastMessage && getMessageReplyInfo(lastMessage)?.replyToMsgId;
  useEnsureMessage(chatId, isAction ? replyToMessageId : undefined, actionTargetMessage);

  const storyData = lastMessage?.content.storyData;
  const shouldTryLoadingStory = statefulMediaContent && !statefulMediaContent.story;

  useEnsureStory(shouldTryLoadingStory ? storyData?.peerId : undefined, storyData?.id, statefulMediaContent?.story);

  const mediaContent = statefulMediaContent?.story || lastMessage;
  const mediaHasPreview = mediaContent && !getMessageSticker(mediaContent);

  const mediaThumbnail = mediaHasPreview ? getMessageMediaThumbDataUri(mediaContent) : undefined;
  const mediaBlobUrl = useMedia(mediaHasPreview ? getMessageMediaHash(mediaContent, 'micro') : undefined);
  const isRoundVideo = Boolean(lastMessage && getMessageRoundVideo(lastMessage));

  const actionTargetUsers = useMemo(() => {
    if (!actionTargetUserIds) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    return actionTargetUserIds.map((userId) => usersById[userId]).filter(Boolean);
  }, [actionTargetUserIds]);

  const renderLastMessageOrTyping = useCallback(() => {
    if (!isSavedDialog && !isPreview
        && typingStatus && lastMessage && typingStatus.timestamp > lastMessage.date * 1000) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    const isDraftReplyToTopic = draft && draft.replyInfo?.replyToMsgId === lastMessageTopic?.id;
    const isEmptyLocalReply = draft?.replyInfo && !draft.text && draft.isLocal;

    const canDisplayDraft = !chat?.isForum && !isSavedDialog && !isPreview && draft && !isEmptyLocalReply
      && (!isTopic || !isDraftReplyToTopic);

    if (canDisplayDraft) {
      return (
        <p className="last-message" dir={oldLang.isRtl ? 'auto' : 'ltr'}>
          <span className="draft">{oldLang('Draft')}</span>
          {renderTextWithEntities({
            text: draft.text?.text || '',
            entities: draft.text?.entities,
            isSimple: true,
            withTranslucentThumbs: true,
          })}
        </p>
      );
    }

    if (!lastMessage) {
      return undefined;
    }

    if (isExpiredMessage(lastMessage)) {
      return (
        <p className="last-message shared-canvas-container" dir={oldLang.isRtl ? 'auto' : 'ltr'}>
          {getExpiredMessageDescription(oldLang, lastMessage)}
        </p>
      );
    }

    if (isAction) {
      const isChat = chat && (isChatChannel(chat) || lastMessage.senderId === lastMessage.chatId);

      return (
        <p className="last-message shared-canvas-container" dir={oldLang.isRtl ? 'auto' : 'ltr'}>
          {renderActionMessageText(
            oldLang,
            lastMessage,
            !isChat ? lastMessageSender as ApiUser : undefined,
            isChat ? chat : undefined,
            actionTargetUsers,
            actionTargetMessage,
            actionTargetChatId,
            lastMessageTopic,
            { isEmbedded: true },
            undefined,
            undefined,
          )}
        </p>
      );
    }

    const senderName = getMessageSenderName(oldLang, chatId, lastMessageSender);

    return (
      <p className="last-message shared-canvas-container" dir={oldLang.isRtl ? 'auto' : 'ltr'}>
        {senderName && (
          <>
            <span className="sender-name">{renderText(senderName)}</span>
            <span className="colon">:</span>
          </>
        )}
        {!isSavedDialog && lastMessage.forwardInfo && (<i className="icon icon-share-filled chat-prefix-icon" />)}
        {lastMessage.replyInfo?.type === 'story' && (<i className="icon icon-story-reply chat-prefix-icon" />)}
        {renderSummary(lastMessage, observeIntersection, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
      </p>
    );
  }, [
    actionTargetChatId, actionTargetMessage, actionTargetUsers, chat, chatId, draft, isAction,
    isRoundVideo, isTopic, oldLang, lastMessage, lastMessageSender, lastMessageTopic, mediaBlobUrl, mediaThumbnail,
    observeIntersection, typingStatus, isSavedDialog, isPreview,
  ]);

  function renderSubtitle() {
    if (chat?.isForum && !isTopic) {
      return (
        <ChatForumLastMessage
          chat={chat}
          renderLastMessage={renderLastMessageOrTyping}
          observeIntersection={observeIntersection}
          topics={topics}
        />
      );
    }

    return renderLastMessageOrTyping();
  }

  // Sets animation excess values when `orderDiff` changes and then resets excess values to animate
  useLayoutEffect(() => {
    const element = ref.current;

    if (!withInterfaceAnimations || !element) {
      return;
    }

    // TODO Refactor animation: create `useListAnimation` that owns `orderDiff` and `animationType`
    if (animationType === ChatAnimationTypes.Opacity) {
      element.style.opacity = '0';

      requestMutation(() => {
        element.classList.add('animate-opacity');
        element.style.opacity = '1';
      });
    } else if (animationType === ChatAnimationTypes.Move) {
      element.style.transform = `translate3d(0, ${-orderDiff * CHAT_HEIGHT_PX}px, 0)`;

      requestMutation(() => {
        element.classList.add('animate-transform');
        element.style.transform = '';
      });
    } else {
      return;
    }

    setTimeout(() => {
      requestMutation(() => {
        element.classList.remove('animate-opacity', 'animate-transform');
        element.style.opacity = '';
        element.style.transform = '';
      });
    }, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [withInterfaceAnimations, orderDiff, animationType]);

  return {
    renderSubtitle,
    ref,
  };
}

function renderSummary(
  message: ApiMessage, observeIntersection?: ObserveFn, blobUrl?: string, isRoundVideo?: boolean,
) {
  const messageSummary = (
    <MessageSummary
      message={message}
      noEmoji={Boolean(blobUrl)}
      observeIntersectionForLoading={observeIntersection}
      inChatList
    />
  );

  if (!blobUrl) {
    return messageSummary;
  }

  const isSpoiler = getMessageIsSpoiler(message);

  return (
    <span className="media-preview">
      <img
        src={blobUrl}
        alt=""
        className={
          buildClassName('media-preview--image', isRoundVideo && 'round', isSpoiler && 'media-preview-spoiler')
        }
        draggable={false}
      />
      {getMessageVideo(message) && <i className="icon icon-play" />}
      {messageSummary}
    </span>
  );
}
