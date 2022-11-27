import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ApiSticker } from '../../api/types';

import { IS_WEBM_SUPPORTED } from '../../util/environment';
import * as mediaLoader from '../../util/mediaLoader';
import buildClassName from '../../util/buildClassName';
import generateIdFor from '../../util/generateIdFor';
import { getStickerPreviewHash } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';

import useMedia from '../../hooks/useMedia';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useThumbnail from '../../hooks/useThumbnail';
import useMediaTransition from '../../hooks/useMediaTransition';
import useFlag from '../../hooks/useFlag';
import useBoundsInSharedCanvas from '../../hooks/useBoundsInSharedCanvas';

import AnimatedSticker from './AnimatedSticker';
import OptimizedVideo from '../ui/OptimizedVideo';

import styles from './StickerView.module.scss';

type OwnProps = {
  containerRef: React.RefObject<HTMLDivElement>;
  sticker: ApiSticker;
  thumbClassName?: string;
  fullMediaHash?: string;
  fullMediaClassName?: string;
  isSmall?: boolean;
  size?: number;
  customColor?: [number, number, number];
  loopLimit?: number;
  shouldLoop?: boolean;
  shouldPreloadPreview?: boolean;
  forceOnHeavyAnimation?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  noLoad?: boolean;
  noPlay?: boolean;
  withSharedAnimation?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  withTranslucentThumb?: boolean; // With shared canvas thumbs are opaque by default to provide better transition effect
  cacheBuster?: number;
  onVideoEnded?: AnyToVoidFunction;
  onAnimatedStickerLoop?: AnyToVoidFunction;
};

const SHARED_PREFIX = 'shared';
const STICKER_SIZE = 24;
const ID_STORE = {};

const StickerView: FC<OwnProps> = ({
  containerRef,
  sticker,
  thumbClassName,
  fullMediaHash,
  fullMediaClassName,
  isSmall,
  size = STICKER_SIZE,
  customColor,
  loopLimit,
  shouldLoop = false,
  shouldPreloadPreview,
  forceOnHeavyAnimation,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  noLoad,
  noPlay,
  withSharedAnimation,
  withTranslucentThumb,
  sharedCanvasRef,
  cacheBuster,
  onVideoEnded,
  onAnimatedStickerLoop,
}) => {
  const {
    id, isLottie, stickerSetInfo, emoji,
  } = sticker;
  const isUnsupportedVideo = sticker.isVideo && !IS_WEBM_SUPPORTED;
  const isVideo = sticker.isVideo && !isUnsupportedVideo;
  const isStatic = !isLottie && !isVideo;
  const previewMediaHash = getStickerPreviewHash(sticker.id);

  const isIntersectingForLoading = useIsIntersecting(containerRef, observeIntersectionForLoading);
  const shouldLoad = isIntersectingForLoading && !noLoad;
  const isIntersectingForPlaying = (
    useIsIntersecting(containerRef, observeIntersectionForPlaying)
    && isIntersectingForLoading
  );
  const shouldPlay = isIntersectingForPlaying && !noPlay;

  const thumbDataUri = useThumbnail(sticker);
  // Use preview instead of thumb but only if it's already loaded
  const [preloadedPreviewData] = useState(mediaLoader.getFromMemory(previewMediaHash));
  const thumbData = preloadedPreviewData || thumbDataUri;

  const shouldForcePreview = isUnsupportedVideo || (isStatic && isSmall);
  fullMediaHash ||= shouldForcePreview ? previewMediaHash : `sticker${id}`;

  // If preloaded preview is forced, it will render as thumb, so no need to load it again
  const shouldSkipFullMedia = Boolean(fullMediaHash === previewMediaHash && preloadedPreviewData);

  const fullMediaData = useMedia(fullMediaHash, !shouldLoad || shouldSkipFullMedia, undefined, cacheBuster);
  // If Lottie data is loaded we will only render thumb if it's good enough (from preview)
  const [isPlayerReady, markPlayerReady] = useFlag(Boolean(isLottie && fullMediaData && !preloadedPreviewData));
  const isFullMediaReady = fullMediaData && (isStatic || isPlayerReady);

  const isThumbOpaque = sharedCanvasRef && !withTranslucentThumb;
  const thumbClassNames = useMediaTransition(thumbData && !isFullMediaReady);
  const fullMediaClassNames = useMediaTransition(isFullMediaReady);
  const noTransition = isLottie && preloadedPreviewData;

  const bounds = useBoundsInSharedCanvas(containerRef, sharedCanvasRef);
  const realSize = bounds.size || size;

  // Preload preview for Message Input and local message
  useMedia(previewMediaHash, !shouldLoad || !shouldPreloadPreview, undefined, cacheBuster);

  const randomIdPrefix = useMemo(() => generateIdFor(ID_STORE, true), []);
  const idKey = [
    (withSharedAnimation ? SHARED_PREFIX : randomIdPrefix), id, realSize, customColor?.join(','),
  ].filter(Boolean).join('_');

  return (
    <>
      <img
        src={thumbData}
        className={buildClassName(
          styles.thumb,
          noTransition && styles.noTransition,
          isThumbOpaque && styles.thumb_opaque,
          thumbClassName,
          thumbClassNames,
        )}
        alt=""
      />
      {isLottie ? (
        <AnimatedSticker
          key={idKey}
          animationId={idKey}
          size={realSize}
          className={buildClassName(
            styles.media,
            (noTransition || isThumbOpaque) && styles.noTransition,
            fullMediaClassName,
            fullMediaClassNames,
          )}
          tgsUrl={fullMediaData}
          play={shouldPlay}
          color={customColor}
          noLoop={!shouldLoop}
          forceOnHeavyAnimation={forceOnHeavyAnimation}
          isLowPriority={isSmall && !selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSetInfo)}
          sharedCanvas={sharedCanvasRef?.current || undefined}
          sharedCanvasCoords={bounds.coords}
          onLoad={markPlayerReady}
          onLoop={onAnimatedStickerLoop}
          onEnded={onAnimatedStickerLoop}
        />
      ) : isVideo ? (
        <OptimizedVideo
          canPlay={shouldPlay && shouldLoop}
          className={buildClassName(styles.media, fullMediaClassName, fullMediaClassNames)}
          src={fullMediaData}
          playsInline
          muted
          loop={!loopLimit}
          disablePictureInPicture
          onReady={markPlayerReady}
          onEnded={onVideoEnded}
        />
      ) : (
        <img
          className={buildClassName(styles.media, fullMediaClassName, fullMediaClassNames)}
          src={fullMediaData}
          alt={emoji}
        />
      )}
    </>
  );
};

export default memo(StickerView);
