import type { ElementRef } from '../../lib/teact/teact';
import { memo, useMemo, useRef } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiSticker } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getStickerMediaHash } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import { IS_ANDROID, IS_IOS, IS_WEBM_SUPPORTED } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import * as mediaLoader from '../../util/mediaLoader';

import useThumbnail from '../../hooks/media/useThumbnail';
import useColorFilter from '../../hooks/stickers/useColorFilter';
import useCoordsInSharedCanvas from '../../hooks/useCoordsInSharedCanvas';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useMountAfterHeavyAnimation from '../../hooks/useMountAfterHeavyAnimation';
import useUniqueId from '../../hooks/useUniqueId';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import OptimizedVideo from '../ui/OptimizedVideo';
import AnimatedSticker from './AnimatedSticker';

import styles from './StickerView.module.scss';

type OwnProps = {
  containerRef: ElementRef<HTMLDivElement>;
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
  skipPreview?: boolean;
  forceAlways?: boolean;
  forceOnHeavyAnimation?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  noLoad?: boolean;
  noPlay?: boolean;
  forceAnimatedStickerOnEnd?: boolean;
  noVideoOnMobile?: boolean;
  withSharedAnimation?: boolean;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  withTranslucentThumb?: boolean; // With shared canvas thumbs are opaque by default to provide better transition effect
  onVideoEnded?: AnyToVoidFunction;
  onAnimatedStickerLoop?: AnyToVoidFunction;
  onAnimatedStickerFrame?: (frame: number) => void;
  onAnimatedStickerLoad?: AnyToVoidFunction;
};

const SHARED_PREFIX = 'shared';
const STICKER_SIZE = 24;

const StickerView = ({
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
  skipPreview,
  forceAlways,
  forceOnHeavyAnimation,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  noLoad,
  noPlay,
  noVideoOnMobile,
  forceAnimatedStickerOnEnd,
  withSharedAnimation,
  withTranslucentThumb,
  sharedCanvasRef,
  onVideoEnded,
  onAnimatedStickerLoop,
  onAnimatedStickerFrame,
  onAnimatedStickerLoad,
}: OwnProps) => {
  const {
    id, isLottie, stickerSetInfo, emoji,
  } = sticker;
  const [isVideoBroken, markVideoBroken] = useFlag();
  const isUnsupportedVideo = sticker.isVideo && (
    !IS_WEBM_SUPPORTED
    || (noVideoOnMobile && (IS_IOS || IS_ANDROID))
  );
  const isVideo = sticker.isVideo;
  const isStatic = !isLottie && !isVideo;
  const previewMediaHash = getStickerMediaHash(sticker, 'preview');

  const dpr = useDevicePixelRatio();

  const filterStyle = useColorFilter(customColor);

  const isIntersectingForLoading = useIsIntersecting(containerRef, observeIntersectionForLoading);
  const shouldLoad = isIntersectingForLoading && !noLoad;
  const isIntersectingForPlaying = (
    useIsIntersecting(containerRef, observeIntersectionForPlaying)
    && isIntersectingForLoading
  );
  const shouldPlay = isIntersectingForPlaying && !noPlay;
  const hasIntersectedForPlayingRef = useRef(isIntersectingForPlaying);
  if (!hasIntersectedForPlayingRef.current && isIntersectingForPlaying) {
    hasIntersectedForPlayingRef.current = true;
  }

  const cachedPreview = mediaLoader.getFromMemory(previewMediaHash);
  const isReadyToMountFullMedia = useMountAfterHeavyAnimation(hasIntersectedForPlayingRef.current);
  const shouldForcePreview = !skipPreview && (isUnsupportedVideo || (isStatic ? isSmall : noPlay));
  const shouldLoadPreview = !skipPreview && !customColor && !cachedPreview
    && (!isReadyToMountFullMedia || shouldForcePreview);
  const previewMediaData = useMedia(previewMediaHash, !shouldLoadPreview);
  const withPreview = !skipPreview && (shouldLoadPreview || cachedPreview);

  const shouldSkipLoadingFullMedia = Boolean(shouldForcePreview || (
    fullMediaHash === previewMediaHash && (cachedPreview || previewMediaData)
  ));
  const fullMediaData = useMedia(fullMediaHash || `sticker${id}`, !shouldLoad || shouldSkipLoadingFullMedia);
  const shouldRenderFullMedia = isReadyToMountFullMedia && Boolean(fullMediaData) && !isVideoBroken;
  const [isPlayerReady, markPlayerReady] = useFlag();
  const isFullMediaReady = shouldRenderFullMedia && (isStatic || isPlayerReady);

  const thumbDataUri = useThumbnail(sticker.thumbnail);
  const thumbData = !skipPreview ? (cachedPreview || previewMediaData || thumbDataUri) : undefined;
  const isThumbOpaque = sharedCanvasRef && !withTranslucentThumb;

  const noCrossTransition = Boolean(isLottie && withPreview);
  const { ref: thumbRef } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(thumbData && !isFullMediaReady),
    noCloseTransition: noCrossTransition,
  });
  const { ref: fullMediaRef } = useMediaTransition<HTMLElement>({
    hasMediaData: isFullMediaReady,
    noOpenTransition: noCrossTransition,
  });

  const coords = useCoordsInSharedCanvas(containerRef, sharedCanvasRef);

  // Preload preview for Message Input and local message
  useMedia(previewMediaHash, !shouldLoad || !shouldPreloadPreview);

  const randomIdPrefix = useUniqueId();
  const renderId = useMemo(() => ([
    (withSharedAnimation ? SHARED_PREFIX : randomIdPrefix),
    id,
    size,
    (withSharedAnimation ? customColor : undefined),
    dpr,
  ].filter(Boolean).join('_')
  ), [id, size, customColor, dpr, withSharedAnimation, randomIdPrefix]);

  const handleAnimatedStickerLoad = useLastCallback(() => {
    onAnimatedStickerLoad?.();
    markPlayerReady();
  });

  return (
    <>
      <img
        ref={thumbRef}
        src={thumbData}
        className={buildClassName(
          styles.thumb,
          noCrossTransition && styles.noTransition,
          isThumbOpaque && styles.thumbOpaque,
          thumbClassName,
          'sticker-media',
        )}
        style={filterStyle}
        alt=""
        draggable={false}
      />
      {shouldRenderFullMedia && (isLottie ? (
        <AnimatedSticker
          ref={fullMediaRef as ElementRef<HTMLDivElement>}
          key={renderId}
          renderId={renderId}
          size={size}
          className={buildClassName(
            styles.media,
            (noCrossTransition || isThumbOpaque) && styles.noTransition,
            fullMediaClassName,
          )}
          tgsUrl={fullMediaData}
          play={shouldPlay}
          seekToEnd={forceAnimatedStickerOnEnd}
          noLoop={!shouldLoop}
          forceOnHeavyAnimation={forceAlways || forceOnHeavyAnimation}
          forceAlways={forceAlways}
          isLowPriority={isSmall && !selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSetInfo)}
          sharedCanvas={sharedCanvasRef?.current || undefined}
          sharedCanvasCoords={coords}
          onLoad={handleAnimatedStickerLoad}
          onLoop={onAnimatedStickerLoop}
          onEnded={onAnimatedStickerLoop}
          onFrame={onAnimatedStickerFrame}
          color={customColor}
        />
      ) : isVideo ? (
        <OptimizedVideo
          ref={fullMediaRef as ElementRef<HTMLVideoElement>}
          canPlay={shouldPlay}
          className={buildClassName(styles.media, fullMediaClassName, 'sticker-media')}
          src={fullMediaData}
          playsInline
          muted
          loop={shouldLoop && !loopLimit}
          isPriority={forceAlways}
          disablePictureInPicture
          onReady={markPlayerReady}
          onBroken={markVideoBroken}
          onEnded={onVideoEnded}
          style={filterStyle}
        />
      ) : (
        <img
          ref={fullMediaRef as ElementRef<HTMLImageElement>}
          className={buildClassName(styles.media, fullMediaClassName, 'sticker-media')}
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
