import React, { FC, useRef } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';

import { MEMOJI_STICKER_ID } from '../../../config';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';
import { getMessageMediaFormat, getMessageMediaHash } from '../../../modules/helpers';
import buildClassName from '../../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useFlag from '../../../hooks/useFlag';
import useWebpThumbnail from '../../../hooks/useWebpThumbnail';

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
  const { isAnimated, stickerSetId } = sticker;
  const isMemojiSticker = stickerSetId === MEMOJI_STICKER_ID;

  const shouldLoad = useIsIntersecting(ref, observeIntersection);
  const shouldPlay = useIsIntersecting(ref, observeIntersectionForPlaying);

  const mediaHash = sticker.isPreloadedGlobally ? `sticker${sticker.id}` : getMessageMediaHash(message, 'inline')!;
  const thumbDataUri = useWebpThumbnail(message);
  const mediaData = useMedia(
    mediaHash,
    !shouldLoad,
    getMessageMediaFormat(message, 'inline', true),
    lastSyncTime,
  );

  const isMediaLoaded = Boolean(mediaData);
  const [isAnimationLoaded, markAnimationLoaded] = useFlag(isMediaLoaded);
  const isMediaReady = isAnimated ? isAnimationLoaded : isMediaLoaded;
  const transitionClassNames = useMediaTransition(isMediaReady);

  const { width, height } = getStickerDimensions(sticker);
  const thumbClassName = buildClassName('thumbnail', !thumbDataUri && 'empty');

  const stickerClassName = buildClassName(
    'Sticker media-inner',
    isMemojiSticker && 'inactive',
  );

  return (
    <div ref={ref} className={stickerClassName} onClick={!isMemojiSticker ? openModal : undefined}>
      {!isMediaReady && (
        <img
          id={`sticker-thumb-${message.id}`}
          src={thumbDataUri}
          width={width}
          height={height}
          alt=""
          className={thumbClassName}
        />
      )}
      {!isAnimated && (
        <img
          id={`sticker-${message.id}`}
          src={mediaData as string}
          width={width}
          height={height}
          alt=""
          className={buildClassName('full-media', transitionClassNames)}
        />
      )}
      {isAnimated && isMediaLoaded && (
        <AnimatedSticker
          key={mediaHash}
          className={buildClassName('full-media', transitionClassNames)}
          id={mediaHash}
          animationData={mediaData as AnyLiteral}
          size={width}
          play={shouldPlay}
          noLoop={!shouldLoop}
          onLoad={markAnimationLoaded}
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
