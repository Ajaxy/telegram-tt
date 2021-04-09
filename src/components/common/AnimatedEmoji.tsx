import React, {
  FC, useCallback, useRef, useState,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';

import { STICKER_SIZE_TWO_FA } from '../../config';
import { getStickerDimensions } from './helpers/mediaDimensions';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useTransitionForMedia from '../../hooks/useTransitionForMedia';
import useFlag from '../../hooks/useFlag';

import AnimatedSticker from './AnimatedSticker';

import './AnimatedEmoji.scss';

type OwnProps = {
  sticker: ApiSticker;
  observeIntersection?: ObserveFn;
  isInline?: boolean;
  lastSyncTime?: number;
};

const QUALITY = 1;
const RESIZE_FACTOR = 0.5;

const AnimatedEmoji: FC<OwnProps> = ({
  sticker, isInline = false, observeIntersection, lastSyncTime,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isAnimationLoaded, markAnimationLoaded] = useFlag();
  const localMediaHash = `sticker${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !isIntersecting, ApiMediaFormat.BlobUrl, lastSyncTime);
  const { transitionClassNames } = useTransitionForMedia(previewBlobUrl, 'slow');

  const mediaData = useMedia(localMediaHash, !isIntersecting, ApiMediaFormat.Lottie, lastSyncTime);
  const isMediaLoaded = Boolean(mediaData);

  const [playKey, setPlayKey] = useState(String(Math.random()));
  const handleClick = useCallback(() => {
    setPlayKey(String(Math.random()));
  }, []);

  let width: number;
  if (isInline) {
    width = getStickerDimensions(sticker).width * RESIZE_FACTOR;
  } else {
    width = STICKER_SIZE_TWO_FA;
  }

  const style = `width: ${width}px; height: ${width}px;`;

  return (
    <div
      ref={ref}
      className="AnimatedEmoji media-inner"
      // @ts-ignore
      style={style}
      onClick={handleClick}
    >
      {previewBlobUrl && !isAnimationLoaded && (
        <img src={previewBlobUrl} className={transitionClassNames} alt="" />
      )}
      {isMediaLoaded && (
        <AnimatedSticker
          key={localMediaHash}
          id={localMediaHash}
          animationData={mediaData as AnyLiteral}
          size={width}
          quality={QUALITY}
          play={isIntersecting && playKey}
          noLoop
          onLoad={markAnimationLoaded}
        />
      )}
    </div>
  );
};

export default AnimatedEmoji;
