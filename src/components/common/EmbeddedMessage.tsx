import React, { FC, useRef } from '../../lib/teact/teact';

import { ApiUser, ApiMessage, ApiChat } from '../../api/types';

import {
  getMessageMediaHash,
  isActionMessage,
  getSenderTitle,
  getMessageRoundVideo,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import { getPictogramDimensions } from './helpers/mediaDimensions';
import buildClassName from '../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useWebpThumbnail from '../../hooks/useWebpThumbnail';
import useLang from '../../hooks/useLang';
import { renderMessageSummary } from './helpers/renderMessageText';

import ActionMessage from '../middle/ActionMessage';

import './EmbeddedMessage.scss';

type OwnProps = {
  observeIntersection?: ObserveFn;
  className?: string;
  message?: ApiMessage;
  sender?: ApiUser | ApiChat;
  title?: string;
  customText?: string;
  isProtected?: boolean;
  onClick: NoneToVoidFunction;
};

const NBSP = '\u00A0';

const EmbeddedMessage: FC<OwnProps> = ({
  className,
  message,
  sender,
  title,
  customText,
  isProtected,
  observeIntersection,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaBlobUrl = useMedia(message && getMessageMediaHash(message, 'pictogram'), !isIntersecting);
  const mediaThumbnail = useWebpThumbnail(message);
  const isRoundVideo = Boolean(message && getMessageRoundVideo(message));

  const lang = useLang();

  const senderTitle = sender && getSenderTitle(lang, sender);

  return (
    <div
      ref={ref}
      className={buildClassName('EmbeddedMessage', className)}
      onClick={message ? onClick : undefined}
    >
      {mediaThumbnail && renderPictogram(mediaThumbnail, mediaBlobUrl, isRoundVideo, isProtected)}
      <div className="message-text">
        <p dir="auto">
          {!message ? (
            customText || NBSP
          ) : isActionMessage(message) ? (
            <ActionMessage message={message} isEmbedded />
          ) : (
            renderMessageSummary(lang, message, Boolean(mediaThumbnail))
          )}
        </p>
        <div className="message-title" dir="auto">{renderText(senderTitle || title || NBSP)}</div>
      </div>
    </div>
  );
};

function renderPictogram(
  thumbDataUri: string,
  blobUrl?: string,
  isRoundVideo?: boolean,
  isProtected?: boolean,
) {
  const { width, height } = getPictogramDimensions();

  return (
    <>
      <img
        src={blobUrl || thumbDataUri}
        width={width}
        height={height}
        alt=""
        className={isRoundVideo ? 'round' : ''}
        draggable={!isProtected}
      />
      {isProtected && <span className="protector" />}
    </>
  );
}

export default EmbeddedMessage;
