import type { FC } from '../../../lib/teact/teact';
import React, { useMemo, useRef } from '../../../lib/teact/teact';

import type {
  ApiChat,
  ApiMessage, ApiPeer, ApiReplyInfo,
} from '../../../api/types';
import type { ChatTranslatedMessages } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IconName } from '../../../types/icons';

import {
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageRoundVideo,
  getSenderTitle,
  isActionMessage,
  isChatChannel,
  isChatGroup,
  isMessageTranslatable,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import freezeWhenClosed from '../../../util/hoc/freezeWhenClosed';
import { getPictogramDimensions } from '../helpers/mediaDimensions';
import { getPeerColorClass } from '../helpers/peerColor';
import renderText from '../helpers/renderText';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import { useFastClick } from '../../../hooks/useFastClick';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';
import useThumbnail from '../../../hooks/useThumbnail';
import useMessageTranslation from '../../middle/message/hooks/useMessageTranslation';

import ActionMessage from '../../middle/ActionMessage';
import Icon from '../Icon';
import MediaSpoiler from '../MediaSpoiler';
import MessageSummary from '../MessageSummary';
import EmojiIconBackground from './EmojiIconBackground';

import './EmbeddedMessage.scss';

type OwnProps = {
  className?: string;
  replyInfo?: ApiReplyInfo;
  message?: ApiMessage;
  sender?: ApiPeer;
  senderChat?: ApiChat;
  forwardSender?: ApiPeer;
  title?: string;
  customText?: string;
  noUserColors?: boolean;
  isProtected?: boolean;
  isInComposer?: boolean;
  chatTranslations?: ChatTranslatedMessages;
  requestedChatTranslationLanguage?: string;
  isOpen?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick: NoneToVoidFunction;
};

const NBSP = '\u00A0';
const EMOJI_SIZE = 17;

const EmbeddedMessage: FC<OwnProps> = ({
  className,
  message,
  replyInfo,
  sender,
  senderChat,
  forwardSender,
  title,
  customText,
  isProtected,
  isInComposer,
  noUserColors,
  chatTranslations,
  requestedChatTranslationLanguage,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIsIntersecting(ref, observeIntersectionForLoading);

  const wrappedMedia = useMemo(() => {
    const replyMedia = replyInfo?.type === 'message' && replyInfo.replyMedia;
    if (!replyMedia) return undefined;
    return {
      content: replyMedia,
    };
  }, [replyInfo]);

  const mediaBlobUrl = useMedia(message && getMessageMediaHash(message, 'pictogram'), !isIntersecting);
  const mediaThumbnail = useThumbnail(message || wrappedMedia);
  const isRoundVideo = Boolean(message && getMessageRoundVideo(message));
  const isSpoiler = Boolean(message && getMessageIsSpoiler(message));
  const isQuote = Boolean(replyInfo?.type === 'message' && replyInfo.isQuote);
  const replyForwardInfo = replyInfo?.type === 'message' ? replyInfo.replyFrom : undefined;

  const shouldTranslate = message && isMessageTranslatable(message);
  const { translatedText } = useMessageTranslation(
    chatTranslations, message?.chatId, shouldTranslate ? message?.id : undefined, requestedChatTranslationLanguage,
  );

  const lang = useLang();

  const senderTitle = sender ? getSenderTitle(lang, sender)
    : (replyForwardInfo?.hiddenUserName || message?.forwardInfo?.hiddenUserName);
  const senderChatTitle = senderChat ? getSenderTitle(lang, senderChat) : undefined;
  const forwardSenderTitle = forwardSender ? getSenderTitle(lang, forwardSender)
    : message?.forwardInfo?.hiddenUserName;
  const areSendersSame = sender && sender.id === forwardSender?.id;

  const { handleClick, handleMouseDown } = useFastClick(onClick);

  function renderTextContent() {
    if (replyInfo?.type === 'message' && replyInfo.quoteText) {
      return renderTextWithEntities({
        text: replyInfo.quoteText.text,
        entities: replyInfo.quoteText.entities,
        noLineBreaks: isInComposer,
      });
    }

    if (!message) {
      return customText || NBSP;
    }

    if (isActionMessage(message)) {
      return (
        <ActionMessage
          message={message}
          isEmbedded
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
        />
      );
    }

    return (
      <MessageSummary
        lang={lang}
        message={message}
        noEmoji={Boolean(mediaThumbnail)}
        translatedText={translatedText}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        emojiSize={EMOJI_SIZE}
      />
    );
  }

  function renderSender() {
    if (title) {
      return renderText(title);
    }

    if (!senderTitle) {
      return NBSP;
    }

    let icon: IconName | undefined;
    if (senderChat) {
      if (isChatChannel(senderChat)) {
        icon = 'channel-filled';
      }

      if (isChatGroup(senderChat)) {
        icon = 'group-filled';
      }
    }

    const isChatSender = senderChat && senderChat.id === sender?.id;
    const isReplyToQuote = isInComposer && Boolean(replyInfo && 'quoteText' in replyInfo && replyInfo?.quoteText);

    return (
      <>
        {!isChatSender && (
          <span className="embedded-sender">
            {renderText(isReplyToQuote ? lang('ReplyToQuote', senderTitle) : senderTitle)}
          </span>
        )}
        {icon && <Icon name={icon} className="embedded-chat-icon" />}
        {icon && senderChatTitle && renderText(senderChatTitle)}
      </>
    );
  }

  return (
    <div
      ref={ref}
      className={buildClassName(
        'EmbeddedMessage',
        className,
        getPeerColorClass(sender, noUserColors, true),
        isQuote && 'is-quote',
        mediaThumbnail && 'with-thumb',
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {mediaThumbnail && renderPictogram(mediaThumbnail, mediaBlobUrl, isRoundVideo, isProtected, isSpoiler)}
      {sender?.color?.backgroundEmojiId && (
        <EmojiIconBackground
          emojiDocumentId={sender.color.backgroundEmojiId}
          className="EmbeddedMessage--background-icons"
        />
      )}
      <div className="message-text">
        <p className={buildClassName('embedded-text-wrapper', isQuote && 'multiline')}>
          {renderTextContent()}
        </p>
        <div className="message-title">
          {renderSender()}
          {forwardSenderTitle && !areSendersSame && (
            <>
              <Icon name={forwardSender ? 'share-filled' : 'forward'} className="embedded-origin-icon" />
              {renderText(forwardSenderTitle)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function renderPictogram(
  thumbDataUri: string,
  blobUrl?: string,
  isRoundVideo?: boolean,
  isProtected?: boolean,
  isSpoiler?: boolean,
) {
  const { width, height } = getPictogramDimensions();

  const srcUrl = blobUrl || thumbDataUri;

  return (
    <div className={buildClassName('embedded-thumb', isRoundVideo && 'round')}>
      {!isSpoiler && (
        <img
          src={srcUrl}
          width={width}
          height={height}
          alt=""
          className="pictogram"
          draggable={false}
        />
      )}
      <MediaSpoiler thumbDataUri={srcUrl} isVisible={Boolean(isSpoiler)} width={width} height={height} />
      {isProtected && <span className="protector" />}
    </div>
  );
}

export const ClosableEmbeddedMessage = freezeWhenClosed(EmbeddedMessage);

export default EmbeddedMessage;
