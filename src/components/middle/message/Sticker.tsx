import React, { FC, useEffect, useRef } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';

import { NO_STICKER_SET_ID } from '../../../config';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';
import { getMessageHtmlId, getMessageMediaFormat, getMessageMediaHash } from '../../../modules/helpers';
import buildClassName from '../../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useFlag from '../../../hooks/useFlag';
import useWebpThumbnail from '../../../hooks/useWebpThumbnail';
import safePlay from '../../../util/safePlay';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';

import AnimatedSticker from '../../common/AnimatedSticker';
import StickerSetModal from '../../common/StickerSetModal.async';

import './Sticker.scss';

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  shouldLoop?: boolean;
  lastSyncTime?: number;
};

const Sticker: FC<OwnProps> = ({
  message, observeIntersection, observeIntersectionForPlaying, shouldLoop, lastSyncTime,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isModalOpen, openModal, closeModal] = useFlag();

  const sticker = message.content.sticker!;
  const { isLottie, stickerSetId, isVideo } = sticker;
  const canDisplayVideo = IS_WEBM_SUPPORTED;
  const isMemojiSticker = stickerSetId === NO_STICKER_SET_ID;

  const shouldLoad = useIsIntersecting(ref, observeIntersection);
  const shouldPlay = useIsIntersecting(ref, observeIntersectionForPlaying);

  const mediaHash = sticker.isPreloadedGlobally ? `sticker${sticker.id}` : getMessageMediaHash(message, 'inline')!;
  const previewMediaHash = isVideo && !canDisplayVideo && (
    sticker.isPreloadedGlobally ? `sticker${sticker.id}?size=m` : getMessageMediaHash(message, 'pictogram'));
  const previewBlobUrl = useMedia(previewMediaHash);
  const thumbDataUri = useWebpThumbnail(message);
  const previewUrl = previewBlobUrl || thumbDataUri;

  const mediaData = useMedia(
    mediaHash,
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
    lastSyncTime,
  );

  const isMediaLoaded = Boolean(mediaData);
  const [isLottieLoaded, markLottieLoaded] = useFlag(isMediaLoaded);
  const isMediaReady = isLottie ? isLottieLoaded : isMediaLoaded;
  const transitionClassNames = useMediaTransition(isMediaReady);

  const { width, height } = getStickerDimensions(sticker);
  const thumbClassName = buildClassName('thumbnail', !thumbDataUri && 'empty');

  const stickerClassName = buildClassName(
    'Sticker media-inner',
    isMemojiSticker && 'inactive',
  );

  useEffect(() => {
    if (!isVideo || !ref.current) return;
    const video = ref.current.querySelector('video');
    if (!video) return;
    if (shouldPlay) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, [isVideo, shouldPlay]);

  return (
    <div ref={ref} className={stickerClassName} onClick={!isMemojiSticker ? openModal : undefined}>
      {(!isMediaReady || (isVideo && !canDisplayVideo)) && (
        <img
          id={`sticker-thumb-${getMessageHtmlId(message.id)}`}
          src={previewUrl}
          width={width}
          height={height}
          alt=""
          className={thumbClassName}
        />
      )}
      {!isLottie && !isVideo && (
        <img
          id={`sticker-${getMessageHtmlId(message.id)}`}
          src={mediaData as string}
          width={width}
          height={height}
          alt=""
          className={buildClassName('full-media', transitionClassNames)}
        />
      )}
      {isVideo && canDisplayVideo && isMediaReady && (
        <video
          id={`sticker-${getMessageHtmlId(message.id)}`}
          src={mediaData as string}
          width={width}
          height={height}
          autoPlay={shouldPlay}
          playsInline
          loop={shouldLoop}
          muted
        />
      )}
      {isLottie && isMediaLoaded && (
        <AnimatedSticker
          key={mediaHash}
          className={buildClassName('full-media', transitionClassNames)}
          id={mediaHash}
          animationData={mediaData}
          size={width}
          play={shouldPlay}
          noLoop={!shouldLoop}
          onLoad={markLottieLoaded}
        />
      )}
      <StickerSetModal
        isOpen={isModalOpen}
        fromSticker={sticker}
        onClose={closeModal}
      />
    </div>
  );
};

export default Sticker;
