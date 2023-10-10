import React, {
  useCallback, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type {
  ApiChat, ApiMessage, ApiPeer, ApiTopic, ApiTypingStatus, ApiUser,
} from '../../../../api/types';
import type { Thread } from '../../../../global/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import type { LangFn } from '../../../../hooks/useLang';

import { ANIMATION_END_DELAY, CHAT_HEIGHT_PX } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageRoundVideo,
  getMessageSenderName,
  getMessageSticker,
  getMessageVideo,
  isActionMessage,
  isChatChannel,
} from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';
import { renderActionMessageText } from '../../../common/helpers/renderActionMessageText';
import renderText from '../../../common/helpers/renderText';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { ChatAnimationTypes } from './useChatAnimationType';

import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useLang from '../../../../hooks/useLang';
import useMedia from '../../../../hooks/useMedia';

import ChatForumLastMessage from '../../../common/ChatForumLastMessage';
import MessageSummary from '../../../common/MessageSummary';
import TypingStatus from '../../../common/TypingStatus';

const ANIMATION_DURATION = 200;

export default function useChatListEntry({
  chat,
  lastMessage,
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
}: {
  chat?: ApiChat;
  lastMessage?: ApiMessage;
  chatId: string;
  typingStatus?: ApiTypingStatus;
  draft?: Thread['draft'];
  actionTargetMessage?: ApiMessage;
  actionTargetUserIds?: string[];
  lastMessageTopic?: ApiTopic;
  lastMessageSender?: ApiPeer;
  actionTargetChatId?: string;
  observeIntersection?: ObserveFn;
  isTopic?: boolean;

  animationType: ChatAnimationTypes;
  orderDiff: number;
  withInterfaceAnimations?: boolean;
}) {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isAction = lastMessage && isActionMessage(lastMessage);

  useEnsureMessage(chatId, isAction ? lastMessage.replyToMessageId : undefined, actionTargetMessage);

  const mediaThumbnail = lastMessage && !getMessageSticker(lastMessage)
    ? getMessageMediaThumbDataUri(lastMessage)
    : undefined;
  const mediaBlobUrl = useMedia(lastMessage ? getMessageMediaHash(lastMessage, 'micro') : undefined);
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
    if (typingStatus && lastMessage && typingStatus.timestamp > lastMessage.date * 1000) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (draft?.text.length && (!chat?.isForum || isTopic)) {
      return (
        <p className="last-message" dir={lang.isRtl ? 'auto' : 'ltr'}>
          <span className="draft">{lang('Draft')}</span>
          {renderTextWithEntities({
            text: draft.text,
            entities: draft.entities,
            isSimple: true,
            withTranslucentThumbs: true,
          })}
        </p>
      );
    }

    if (!lastMessage) {
      return undefined;
    }

    if (isAction) {
      const isChat = chat && (isChatChannel(chat) || lastMessage.senderId === lastMessage.chatId);

      return (
        <p className="last-message shared-canvas-container" dir={lang.isRtl ? 'auto' : 'ltr'}>
          {renderActionMessageText(
            lang,
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

    const senderName = getMessageSenderName(lang, chatId, lastMessageSender);

    return (
      <p className="last-message shared-canvas-container" dir={lang.isRtl ? 'auto' : 'ltr'}>
        {senderName && (
          <>
            <span className="sender-name">{renderText(senderName)}</span>
            <span className="colon">:</span>
          </>
        )}
        {lastMessage.forwardInfo && (<i className="icon icon-share-filled chat-prefix-icon" />)}
        {Boolean(lastMessage.replyToStoryId) && (<i className="icon icon-story-reply chat-prefix-icon" />)}
        {renderSummary(lang, lastMessage, observeIntersection, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
      </p>
    );
  }, [
    actionTargetChatId, actionTargetMessage, actionTargetUsers, chat, chatId, draft, isAction,
    isRoundVideo, isTopic, lang, lastMessage, lastMessageSender, lastMessageTopic, mediaBlobUrl, mediaThumbnail,
    observeIntersection, typingStatus,
  ]);

  function renderSubtitle() {
    if (chat?.isForum && !isTopic) {
      return (
        <ChatForumLastMessage
          chat={chat}
          renderLastMessage={renderLastMessageOrTyping}
          observeIntersection={observeIntersection}
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
  lang: LangFn, message: ApiMessage, observeIntersection?: ObserveFn, blobUrl?: string, isRoundVideo?: boolean,
) {
  const messageSummary = (
    <MessageSummary
      lang={lang}
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
