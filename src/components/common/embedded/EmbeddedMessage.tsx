import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { useMemo, useRef } from '../../../lib/teact/teact';

import type {
  ApiChat,
  ApiInputSuggestedPostInfo,
  ApiMessage, ApiPeer, ApiReplyInfo, MediaContainer,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatTranslatedMessages } from '../../../types';
import type { IconName } from '../../../types/icons';

import { TON_CURRENCY_CODE } from '../../../config';
import {
  getMessageIsSpoiler,
  getMessageRoundVideo,
  isChatChannel,
  isChatGroup,
  isMessageTranslatable,
} from '../../../global/helpers';
import { getMediaContentTypeDescription } from '../../../global/helpers/messageSummary';
import { getPeerTitle } from '../../../global/helpers/peers';
import buildClassName from '../../../util/buildClassName';
import { formatScheduledDateTime } from '../../../util/dates/dateFormat';
import { isUserId } from '../../../util/entities/ids';
import freezeWhenClosed from '../../../util/hoc/freezeWhenClosed';
import { formatStarsAsIcon, formatTonAsIcon } from '../../../util/localization/format';
import { getPictogramDimensions } from '../helpers/mediaDimensions';
import renderText from '../helpers/renderText';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import useMessageMediaHash from '../../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../../hooks/media/useThumbnail';
import { useFastClick } from '../../../hooks/useFastClick';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useMessageTranslation from '../../middle/message/hooks/useMessageTranslation';

import RippleEffect from '../../ui/RippleEffect';
import Icon from '../icons/Icon';
import MediaSpoiler from '../MediaSpoiler';
import MessageSummary from '../MessageSummary';
import PeerColorWrapper from '../PeerColorWrapper';

import './EmbeddedMessage.scss';

type OwnProps = {
  className?: string;
  replyInfo?: ApiReplyInfo;
  suggestedPostInfo?: ApiInputSuggestedPostInfo;
  message?: ApiMessage;
  sender?: ApiPeer;
  senderChat?: ApiChat;
  forwardSender?: ApiPeer;
  composerForwardSenders?: ApiPeer[];
  title?: string;
  customText?: string;
  noUserColors?: boolean;
  isProtected?: boolean;
  isInComposer?: boolean;
  chatTranslations?: ChatTranslatedMessages;
  requestedChatTranslationLanguage?: string;
  isOpen?: boolean;
  isMediaNsfw?: boolean;
  noCaptions?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick: ((e: React.MouseEvent) => void);
};

const NBSP = '\u00A0';
const EMOJI_SIZE = 17;

const EmbeddedMessage: FC<OwnProps> = ({
  className,
  message,
  replyInfo,
  suggestedPostInfo,
  sender,
  senderChat,
  forwardSender,
  composerForwardSenders,
  title,
  customText,
  isProtected,
  isInComposer,
  noUserColors,
  chatTranslations,
  requestedChatTranslationLanguage,
  isMediaNsfw,
  noCaptions,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>();
  const isIntersecting = useIsIntersecting(ref, observeIntersectionForLoading);

  const containedMedia: MediaContainer | undefined = useMemo(() => {
    const media = (replyInfo?.type === 'message' && replyInfo.replyMedia) || message?.content;
    if (!media) {
      return undefined;
    }

    return {
      content: media,
    };
  }, [message, replyInfo]);

  const gif = containedMedia?.content?.video?.isGif ? containedMedia.content.video : undefined;
  const isVideoThumbnail = Boolean(gif && !gif.previewPhotoSizes?.length);

  const mediaHash = useMessageMediaHash(containedMedia, isVideoThumbnail ? 'full' : 'pictogram');
  const mediaBlobUrl = useMedia(mediaHash, !isIntersecting);
  const mediaThumbnail = useThumbnail(containedMedia);

  const isRoundVideo = Boolean(containedMedia && getMessageRoundVideo(containedMedia));
  const isSpoiler = Boolean(containedMedia && getMessageIsSpoiler(containedMedia)) || isMediaNsfw;
  const isQuote = Boolean(replyInfo?.type === 'message' && replyInfo.isQuote);
  const replyForwardInfo = replyInfo?.type === 'message' ? replyInfo.replyFrom : undefined;

  const shouldTranslate = message && isMessageTranslatable(message);
  const { translatedText } = useMessageTranslation(
    chatTranslations, message?.chatId, shouldTranslate ? message?.id : undefined, requestedChatTranslationLanguage,
  );

  const oldLang = useOldLang();
  const lang = useLang();

  const senderTitle = sender ? getPeerTitle(oldLang, sender)
    : (replyForwardInfo?.hiddenUserName || message?.forwardInfo?.hiddenUserName);

  const forwardSendersTitle = useMemo(() => {
    if (!composerForwardSenders) return undefined;

    const peerTitles = composerForwardSenders.map((peer) => getPeerTitle(lang, peer)).filter(Boolean);
    return lang.conjunction(peerTitles);
  }, [composerForwardSenders, lang]);

  const senderChatTitle = senderChat ? getPeerTitle(oldLang, senderChat) : undefined;
  const forwardSenderTitle = forwardSender ? getPeerTitle(oldLang, forwardSender)
    : message?.forwardInfo?.hiddenUserName;
  const areSendersSame = sender && sender.id === forwardSender?.id;

  const { handleClick, handleMouseDown } = useFastClick(onClick);

  function renderTextContent() {
    const isFree = !(suggestedPostInfo?.price?.amount);
    if (suggestedPostInfo) {
      if (isFree && !suggestedPostInfo.scheduleDate) {
        return lang('ComposerEmbeddedMessageSuggestedPostDescription');
      }
      const priceText = suggestedPostInfo.price
        ? (suggestedPostInfo.price.currency === TON_CURRENCY_CODE
          ? formatTonAsIcon(lang, suggestedPostInfo.price.amount, {
            className: 'suggested-price-ton-icon',
            shouldConvertFromNanos: true,
          })
          : formatStarsAsIcon(lang, suggestedPostInfo.price.amount, {
            className: 'suggested-price-star-icon',
          }))
        : '';
      const scheduleText = suggestedPostInfo.scheduleDate
        ? formatScheduledDateTime(suggestedPostInfo.scheduleDate, lang, oldLang)
        : '';
      if (priceText && !scheduleText) {
        return (
          <span className="suggested-post-price-wrapper">
            {
              lang('TitleSuggestedPostAmountForAnyTime',
                { amount: priceText },
                {
                  withNodes: true,
                  withMarkdown: true,
                })
            }
          </span>
        );
      }
      return (
        <span className="suggested-post-price-wrapper">
          {priceText}
          {scheduleText ? ` • ${scheduleText}` : ''}
        </span>
      );
    }

    if (replyInfo?.type === 'message' && replyInfo.quoteText) {
      return renderTextWithEntities({
        text: replyInfo.quoteText.text,
        entities: replyInfo.quoteText.entities,
        asPreview: true,
        emojiSize: EMOJI_SIZE,
      });
    }

    if (!message) {
      return customText || renderMediaContentType(containedMedia) || NBSP;
    }

    if (noCaptions) {
      return lang('EmbeddedMessageNoCaption');
    }

    return (
      <MessageSummary
        message={message}
        noEmoji={Boolean(mediaThumbnail)}
        translatedText={translatedText}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        emojiSize={EMOJI_SIZE}
      />
    );
  }

  function renderMediaContentType(media?: MediaContainer) {
    if (!media || media.content.text) return NBSP;
    const description = getMediaContentTypeDescription(lang, media.content, {});
    if (!description) return NBSP;
    return (
      <span>
        {renderText(description)}
      </span>
    );
  }

  function checkShouldRenderSenderTitle() {
    if (!senderChat) return true;
    if (isUserId(senderChat?.id)) return true;
    if (senderChat.id === sender?.id) return false;
    return true;
  }
  function renderSender() {
    if (title) {
      return renderText(title);
    }

    if (suggestedPostInfo && replyInfo) {
      return lang('TitleSuggestedChanges');
    }

    if (suggestedPostInfo) {
      return lang('ComposerEmbeddedMessageSuggestedPostTitle');
    }

    if (!senderTitle && !forwardSendersTitle) {
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

    const isReplyToQuote = isInComposer && Boolean(replyInfo && 'quoteText' in replyInfo && replyInfo?.quoteText);

    return (
      <span className="embedded-sender-wrapper">
        {checkShouldRenderSenderTitle() && (
          <span className="embedded-sender">
            {!composerForwardSenders && senderTitle
              && renderText(isReplyToQuote ? oldLang('ReplyToQuote', senderTitle) : senderTitle)}
            {forwardSendersTitle && renderText(lang('ComposerTitleForwardFrom', {
              users: forwardSendersTitle,
            }, {
              withNodes: true,
              withMarkdown: true,
            }))}
          </span>
        )}
        {icon && <Icon name={icon} className="embedded-chat-icon" />}
        {icon && senderChatTitle && (
          <span className="embedded-sender-chat">
            {renderText(senderChatTitle)}
          </span>
        )}
      </span>
    );
  }

  function renderForwardSender() {
    return forwardSenderTitle && !areSendersSame && (
      <span className="embedded-forward-sender-wrapper">
        <Icon name={forwardSender ? 'share-filled' : 'forward'} className="embedded-origin-icon" />
        <span className="forward-sender-title">
          {renderText(forwardSenderTitle)}
        </span>
      </span>
    );
  }

  return (
    <PeerColorWrapper
      peer={sender}
      emojiIconClassName="EmbeddedMessage--background-icons"
      ref={ref}
      shouldReset
      isReply={Boolean(replyInfo)}
      noUserColors={noUserColors}
      className={buildClassName(
        'EmbeddedMessage',
        className,
        isQuote && 'is-quote',
        mediaThumbnail && 'with-thumb',
        'no-selection',
        composerForwardSenders && 'is-input-forward',
        suggestedPostInfo && 'is-suggested-post',
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <div className="hover-effect" />
      <RippleEffect />
      {mediaThumbnail && renderPictogram(
        mediaThumbnail, mediaBlobUrl, isVideoThumbnail, isRoundVideo, isProtected, isSpoiler,
      )}
      <div className="message-text">
        <p className={buildClassName('embedded-text-wrapper', isQuote && 'multiline')}>
          {renderTextContent()}
        </p>
        <div className="message-title">
          {renderSender()}
          {renderForwardSender()}
        </div>
      </div>
    </PeerColorWrapper>
  );
};

function renderPictogram(
  thumbDataUri: string,
  blobUrl?: string,
  isFullVideo?: boolean,
  isRoundVideo?: boolean,
  isProtected?: boolean,
  isSpoiler?: boolean,
) {
  const { width, height } = getPictogramDimensions();

  const srcUrl = blobUrl || thumbDataUri;
  const shouldRenderVideo = isFullVideo && blobUrl;

  return (
    <div className={buildClassName('embedded-thumb', isRoundVideo && 'round')}>
      {!isSpoiler && !shouldRenderVideo && (
        <img
          src={srcUrl}
          width={width}
          height={height}
          alt=""
          className="pictogram"
          draggable={false}
        />
      )}
      {!isSpoiler && shouldRenderVideo && (
        <video
          src={blobUrl}
          width={width}
          height={height}
          playsInline
          disablePictureInPicture
          className="pictogram"
        />
      )}
      <MediaSpoiler
        thumbDataUri={shouldRenderVideo ? thumbDataUri : srcUrl}
        isVisible={Boolean(isSpoiler)}
        width={width}
        height={height}
      />
      {isProtected && <span className="protector" />}
    </div>
  );
}

export const ClosableEmbeddedMessage = freezeWhenClosed(EmbeddedMessage);

export default EmbeddedMessage;
