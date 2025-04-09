import React, {
  useCallback, useLayoutEffect, useRef,
} from '../../../../lib/teact/teact';

import type {
  ApiChat, ApiDraft, ApiMessage, ApiPeer, ApiTopic, ApiTypingStatus,
  StatefulMediaContent,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import { ANIMATION_END_DELAY, CHAT_HEIGHT_PX } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageRoundVideo,
  getMessageSticker,
  getMessageVideo,
} from '../../../../global/helpers';
import { getMessageSenderName } from '../../../../global/helpers/peers';
import buildClassName from '../../../../util/buildClassName';
import renderText from '../../../common/helpers/renderText';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { ChatAnimationTypes } from './useChatAnimationType';

import useEnsureStory from '../../../../hooks/useEnsureStory';
import useMedia from '../../../../hooks/useMedia';
import useOldLang from '../../../../hooks/useOldLang';

import ChatForumLastMessage from '../../../common/ChatForumLastMessage';
import Icon from '../../../common/icons/Icon';
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
  lastMessageTopic,
  lastMessageSender,
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
  lastMessageTopic?: ApiTopic;
  lastMessageSender?: ApiPeer;
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

  const storyData = lastMessage?.content.storyData;
  const shouldTryLoadingStory = statefulMediaContent && !statefulMediaContent.story;

  useEnsureStory(shouldTryLoadingStory ? storyData?.peerId : undefined, storyData?.id, statefulMediaContent?.story);

  const mediaContent = statefulMediaContent?.story || lastMessage;
  const mediaHasPreview = mediaContent && !getMessageSticker(mediaContent);

  const mediaThumbnail = mediaHasPreview ? getMessageMediaThumbDataUri(mediaContent) : undefined;
  const mediaBlobUrl = useMedia(mediaHasPreview ? getMessageMediaHash(mediaContent, 'micro') : undefined);
  const isRoundVideo = Boolean(lastMessage && getMessageRoundVideo(lastMessage));

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
            asPreview: true,
            withTranslucentThumbs: true,
          })}
        </p>
      );
    }

    if (!lastMessage) {
      return undefined;
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
        {!isSavedDialog && lastMessage.forwardInfo && (<Icon name="share-filled" className="chat-prefix-icon" />)}
        {lastMessage.replyInfo?.type === 'story' && (<Icon name="story-reply" className="chat-prefix-icon" />)}
        {renderSummary(lastMessage, observeIntersection, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
      </p>
    );
  }, [
    chat, chatId, draft, isRoundVideo, isTopic, oldLang, lastMessage, lastMessageSender, lastMessageTopic,
    mediaBlobUrl, mediaThumbnail, observeIntersection, typingStatus, isSavedDialog, isPreview,
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
      {getMessageVideo(message) && <Icon name="play" />}
      {messageSummary}
    </span>
  );
}
