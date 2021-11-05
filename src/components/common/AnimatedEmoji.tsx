import React, {
  FC, useCallback, useRef, useState,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';

import { LIKE_STICKER_ID } from './helpers/mediaDimensions';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useFlag from '../../hooks/useFlag';

import AnimatedSticker from './AnimatedSticker';

import './AnimatedEmoji.scss';

type OwnProps = {
  sticker: ApiSticker;
  observeIntersection?: ObserveFn;
  size?: 'large' | 'medium' | 'small';
  lastSyncTime?: number;
  forceLoadPreview?: boolean;
};

const QUALITY = 1;
const WIDTH = {
  large: 160,
  medium: 128,
  small: 104,
};

const AnimatedEmoji: FC<OwnProps> = ({
  sticker,
  size = 'medium',
  observeIntersection,
  lastSyncTime,
  forceLoadPreview,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isAnimationLoaded, markAnimationLoaded] = useFlag();
  const localMediaHash = `sticker${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const thumbDataUri = sticker.thumbnail?.dataUri;
  const previewBlobUrl = useMedia(
    `${localMediaHash}?size=m`,
    !isIntersecting && !forceLoadPreview,
    ApiMediaFormat.BlobUrl,
    lastSyncTime,
  );
  const transitionClassNames = useMediaTransition(previewBlobUrl);

  const mediaData = useMedia(localMediaHash, !isIntersecting, ApiMediaFormat.Lottie, lastSyncTime);
  const isMediaLoaded = Boolean(mediaData);

  const [playKey, setPlayKey] = useState(String(Math.random()));
  const handleClick = useCallback(() => {
    setPlayKey(String(Math.random()));
  }, []);

  const width = WIDTH[size];
  const style = `width: ${width}px; height: ${width}px;`;

  return (
    <div
      ref={ref}
      className="AnimatedEmoji media-inner"
      // @ts-ignore
      style={style}
      onClick={handleClick}
    >
      {!isAnimationLoaded && thumbDataUri && (
        <img src={thumbDataUri} className={sticker.id === LIKE_STICKER_ID ? 'like-sticker-thumb' : undefined} alt="" />
      )}
      {!isAnimationLoaded && previewBlobUrl && (
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
