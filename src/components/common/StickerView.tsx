import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiSticker } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getStickerPreviewHash } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import * as mediaLoader from '../../util/mediaLoader';
import { IS_ANDROID, IS_WEBM_SUPPORTED } from '../../util/windowEnvironment';

import useColorFilter from '../../hooks/stickers/useColorFilter';
import useCoordsInSharedCanvas from '../../hooks/useCoordsInSharedCanvas';
import useFlag from '../../hooks/useFlag';
import useHeavyAnimationCheck, { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useThumbnail from '../../hooks/useThumbnail';
import useUniqueId from '../../hooks/useUniqueId';

import OptimizedVideo from '../ui/OptimizedVideo';
import AnimatedSticker from './AnimatedSticker';

import styles from './StickerView.module.scss';

type OwnProps = {
  containerRef: React.RefObject<HTMLDivElement>;
  sticker: ApiSticker;
  thumbClassName?: string;
  fullMediaHash?: string;
  fullMediaClassName?: string;
  isSmall?: boolean;
  size?: number;
  customColor?: string;
  loopLimit?: number;
  shouldLoop?: boolean;
  shouldPreloadPreview?: boolean;
  forceAlways?: boolean;
  forceOnHeavyAnimation?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  noLoad?: boolean;
  noPlay?: boolean;
  withSharedAnimation?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  withTranslucentThumb?: boolean; // With shared canvas thumbs are opaque by default to provide better transition effect
  onVideoEnded?: AnyToVoidFunction;
  onAnimatedStickerLoop?: AnyToVoidFunction;
};

const SHARED_PREFIX = 'shared';
const STICKER_SIZE = 24;

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
  forceAlways,
  forceOnHeavyAnimation,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  noLoad,
  noPlay,
  withSharedAnimation,
  withTranslucentThumb,
  sharedCanvasRef,
  onVideoEnded,
  onAnimatedStickerLoop,
}) => {
  const {
    id, isLottie, stickerSetInfo, emoji,
  } = sticker;
  const [isVideoBroken, markVideoBroken] = useFlag();
  const isUnsupportedVideo = sticker.isVideo && (!IS_WEBM_SUPPORTED || isVideoBroken);
  const isVideo = sticker.isVideo && !isUnsupportedVideo;
  const isStatic = !isLottie && !isVideo;
  const previewMediaHash = getStickerPreviewHash(sticker.id);

  const filterStyle = useColorFilter(customColor);

  const isIntersectingForLoading = useIsIntersecting(containerRef, observeIntersectionForLoading);
  const shouldLoad = isIntersectingForLoading && !noLoad;
  const isIntersectingForPlaying = (
    useIsIntersecting(containerRef, observeIntersectionForPlaying)
    && isIntersectingForLoading
  );
  const shouldPlay = isIntersectingForPlaying && !noPlay;

  const thumbDataUri = useThumbnail(sticker);
  // Use preview instead of thumb but only if it's already loaded or when playing an animation is disabled
  const previewMediaDataFromCache: string | undefined = mediaLoader.getFromMemory(previewMediaHash);
  const previewMediaData = useMedia(previewMediaHash, Boolean(previewMediaDataFromCache || !noPlay));
  const thumbData = customColor ? thumbDataUri : (previewMediaData || thumbDataUri);

  const shouldForcePreview = isUnsupportedVideo || (isStatic && isSmall);
  fullMediaHash ||= shouldForcePreview ? previewMediaHash : `sticker${id}`;

  // If preloaded preview is forced, it will render as thumb, so no need to load it again
  const shouldSkipFullMedia = Boolean(fullMediaHash === previewMediaHash && previewMediaData);

  const fullMediaData = useMedia(fullMediaHash, !shouldLoad || shouldSkipFullMedia);
  // If Lottie data is loaded we will only render thumb if it's good enough (from preview)
  const [isPlayerReady, markPlayerReady] = useFlag(Boolean(isLottie && fullMediaData && !previewMediaData));
  // Delay mounting on Android until heavy animation ends
  const [isReadyToMount, markReadyToMount, unmarkReadyToMount] = useFlag(!IS_ANDROID || !isHeavyAnimating());
  useHeavyAnimationCheck(unmarkReadyToMount, markReadyToMount, isReadyToMount);
  const isFullMediaReady = isReadyToMount && fullMediaData && (isStatic || isPlayerReady);

  const isThumbOpaque = sharedCanvasRef && !withTranslucentThumb;
  const thumbClassNames = useMediaTransition(thumbData && !isFullMediaReady);
  const fullMediaClassNames = useMediaTransition(isFullMediaReady);
  const noTransition = isLottie && previewMediaData;

  const coords = useCoordsInSharedCanvas(containerRef, sharedCanvasRef);

  // Preload preview for Message Input and local message
  useMedia(previewMediaHash, !shouldLoad || !shouldPreloadPreview);

  const randomIdPrefix = useUniqueId();
  const renderId = [
    (withSharedAnimation ? SHARED_PREFIX : randomIdPrefix),
    id,
    size,
    (withSharedAnimation ? customColor : undefined),
  ].filter(Boolean).join('_');

  return (
    <>
      <img
        src={thumbData}
        className={buildClassName(
          styles.thumb,
          noTransition && styles.noTransition,
          isThumbOpaque && styles.thumbOpaque,
          thumbClassName,
          thumbClassNames,
          'sticker-media',
        )}
        alt=""
        draggable={false}
      />
      {isReadyToMount && (isLottie ? (
        <AnimatedSticker
          key={renderId}
          renderId={renderId}
          size={size}
          className={buildClassName(
            styles.media,
            (noTransition || isThumbOpaque) && styles.noTransition,
            fullMediaClassName,
            fullMediaClassNames,
          )}
          tgsUrl={fullMediaData}
          play={shouldPlay}
          noLoop={!shouldLoop}
          forceOnHeavyAnimation={forceAlways || forceOnHeavyAnimation}
          forceAlways={forceAlways}
          isLowPriority={isSmall && !selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSetInfo)}
          sharedCanvas={sharedCanvasRef?.current || undefined}
          sharedCanvasCoords={coords}
          onLoad={markPlayerReady}
          onLoop={onAnimatedStickerLoop}
          onEnded={onAnimatedStickerLoop}
          color={customColor}
        />
      ) : isVideo ? (
        <OptimizedVideo
          canPlay={shouldPlay && shouldLoop}
          className={buildClassName(styles.media, fullMediaClassName, fullMediaClassNames, 'sticker-media')}
          src={fullMediaData}
          playsInline
          muted
          loop={!loopLimit}
          isPriority={forceAlways}
          disablePictureInPicture
          onReady={markPlayerReady}
          onBroken={markVideoBroken}
          onEnded={onVideoEnded}
          style={filterStyle}
        />
      ) : (
        <img
          className={buildClassName(styles.media, fullMediaClassName, fullMediaClassNames, 'sticker-media')}
          src={fullMediaData}
          alt={emoji}
          style={filterStyle}
          draggable={false}
        />
      ))}
    </>
  );
};

export default memo(StickerView);
