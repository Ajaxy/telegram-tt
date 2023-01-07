import React, { useLayoutEffect, useMemo, useRef } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { AnimationLevel } from '../../../../types';
import type { LangFn } from '../../../../hooks/useLang';
import type {
  ApiChat, ApiTopic, ApiMessage, ApiTypingStatus, ApiUser,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import type { Thread } from '../../../../global/types';

import { ANIMATION_END_DELAY, CHAT_HEIGHT_PX } from '../../../../config';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import {
  getMessageMediaHash,
  getMessageMediaThumbDataUri, getMessageRoundVideo,
  getMessageSenderName, getMessageSticker, getMessageVideo, isActionMessage, isChatChannel,
} from '../../../../global/helpers';
import { renderActionMessageText } from '../../../common/helpers/renderActionMessageText';
import renderText from '../../../common/helpers/renderText';
import buildClassName from '../../../../util/buildClassName';
import useLang from '../../../../hooks/useLang';
import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useMedia from '../../../../hooks/useMedia';
import { ChatAnimationTypes } from './useChatAnimationType';
import { fastRaf } from '../../../../util/schedulers';

import MessageSummary from '../../../common/MessageSummary';
import ChatForumLastMessage from '../../../common/ChatForumLastMessage';
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
  animationLevel,
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
  lastMessageSender?: ApiUser | ApiChat;
  actionTargetChatId?: string;
  observeIntersection?: ObserveFn;
  isTopic?: boolean;

  animationType: ChatAnimationTypes;
  orderDiff: number;
  animationLevel?: AnimationLevel;
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

  function renderLastMessageOrTyping() {
    if (typingStatus && lastMessage && typingStatus.timestamp > lastMessage.date * 1000) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (draft?.text.length) {
      return (
        <p className="last-message" dir={lang.isRtl ? 'auto' : 'ltr'}>
          <span className="draft">{lang('Draft')}</span>
          {renderTextWithEntities(draft.text, draft.entities, undefined, undefined, undefined, undefined, true)}
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
        {renderSummary(lang, lastMessage, observeIntersection, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
      </p>
    );
  }

  // Sets animation excess values when `orderDiff` changes and then resets excess values to animate
  useLayoutEffect(() => {
    const element = ref.current;

    if (animationLevel === 0 || !element) {
      return;
    }

    // TODO Refactor animation: create `useListAnimation` that owns `orderDiff` and `animationType`
    if (animationType === ChatAnimationTypes.Opacity) {
      element.style.opacity = '0';

      fastRaf(() => {
        element.classList.add('animate-opacity');
        element.style.opacity = '1';
      });
    } else if (animationType === ChatAnimationTypes.Move) {
      element.style.transform = `translate3d(0, ${-orderDiff * CHAT_HEIGHT_PX}px, 0)`;

      fastRaf(() => {
        element.classList.add('animate-transform');
        element.style.transform = '';
      });
    } else {
      return;
    }

    setTimeout(() => {
      fastRaf(() => {
        element.classList.remove('animate-opacity', 'animate-transform');
        element.style.opacity = '';
        element.style.transform = '';
      });
    }, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [animationLevel, orderDiff, animationType]);

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
    />
  );

  if (!blobUrl) {
    return messageSummary;
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" className={buildClassName('media-preview--image', isRoundVideo && 'round')} />
      {getMessageVideo(message) && <i className="icon-play" />}
      {messageSummary}
    </span>
  );
}
