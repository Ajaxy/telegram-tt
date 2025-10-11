import { memo, useRef } from '../../lib/teact/teact';

import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  getMessageHtmlId,
  getMessageIsSpoiler,
  getMessageVideo,
  getVideoMediaHash,
} from '../../global/helpers';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import stopEvent from '../../util/stopEvent';

import useMessageMediaHash from '../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../hooks/media/useThumbnail';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';

import OptimizedVideo from '../ui/OptimizedVideo';
import MediaSpoiler from './MediaSpoiler';

import './Media.scss';

type OwnProps = {
  message: ApiMessage;
  idPrefix?: string;
  isProtected?: boolean;
  canAutoPlay?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (messageId: number, chatId: string) => void;
};

const Media = ({
  message,
  idPrefix = 'shared-media',
  isProtected,
  canAutoPlay,
  observeIntersection,
  onClick,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const [isHovering, markMouseOver, markMouseOut] = useFlag();

  const thumbDataUri = useThumbnail(message);
  const mediaHash = useMessageMediaHash(message, 'pictogram');
  const mediaBlobUrl = useMedia(mediaHash, !isIntersecting);
  const transitionClassNames = useMediaTransitionDeprecated(mediaBlobUrl);

  const video = getMessageVideo(message);
  const fullGiftHash = video?.isGif ? getVideoMediaHash(video, 'full') : undefined;
  const fullGifBlobUrl = useMedia(fullGiftHash, !isIntersecting);

  const hasSpoiler = getMessageIsSpoiler(message);
  const [isSpoilerShown, , hideSpoiler] = useFlag(hasSpoiler);

  const handleClick = useLastCallback(() => {
    hideSpoiler();
    onClick!(message.id, message.chatId);
  });

  return (
    <div
      ref={ref}
      id={`${idPrefix}${getMessageHtmlId(message.id)}`}
      className="Media scroll-item"
      onClick={onClick ? handleClick : undefined}
      onMouseOver={!IS_TOUCH_ENV ? markMouseOver : undefined}
      onMouseOut={!IS_TOUCH_ENV ? markMouseOut : undefined}
    >
      <img
        src={thumbDataUri}
        className="media-miniature"
        alt=""
        draggable={!isProtected}
        decoding="async"
        onContextMenu={isProtected ? stopEvent : undefined}
      />
      {fullGifBlobUrl ? (
        <OptimizedVideo
          canPlay={isIntersecting && !hasSpoiler && isHovering && Boolean(canAutoPlay)}
          src={fullGifBlobUrl}
          className={buildClassName('full-media', 'media-miniature', transitionClassNames)}
          muted
          loop
          playsInline
          draggable={false}
          disablePictureInPicture
          onContextMenu={isProtected ? stopEvent : undefined}
        />
      ) : (
        <img
          src={mediaBlobUrl}
          className={buildClassName('full-media', 'media-miniature', transitionClassNames)}
          alt=""
          draggable={false}
          decoding="async"
          onContextMenu={isProtected ? stopEvent : undefined}
        />
      )}
      {hasSpoiler && (
        <MediaSpoiler
          thumbDataUri={mediaBlobUrl || thumbDataUri}
          isVisible={isSpoilerShown}
          className="media-spoiler"
        />
      )}
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
      {isProtected && <span className="protector" />}
    </div>
  );
};

export default memo(Media);
