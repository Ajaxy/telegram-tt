import type { FC } from '../../lib/teact/teact';
import React, { memo, useRef } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiSticker } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getStickerMediaHash } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import * as mediaLoader from '../../util/mediaLoader';
import { IS_WEBM_SUPPORTED } from '../../util/windowEnvironment';

import useColorFilter from '../../hooks/stickers/useColorFilter';
import useCoordsInSharedCanvas from '../../hooks/useCoordsInSharedCanvas';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useMountAfterHeavyAnimation from '../../hooks/useMountAfterHeavyAnimation';
import useThumbnail from '../../hooks/useThumbnail';
import useUniqueId from '../../hooks/useUniqueId';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

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
  const isUnsupportedVideo = sticker.isVideo && !IS_WEBM_SUPPORTED;
  const isVideo = sticker.isVideo && !isUnsupportedVideo;
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
  const shouldForcePreview = isUnsupportedVideo || (isStatic ? isSmall : noPlay);
  const shouldLoadPreview = !customColor && !cachedPreview && (!isReadyToMountFullMedia || shouldForcePreview);
  const previewMediaData = useMedia(previewMediaHash, !shouldLoadPreview);
  const withPreview = shouldLoadPreview || cachedPreview;

  const shouldSkipFullMedia = Boolean(shouldForcePreview || (
    fullMediaHash === previewMediaHash && (cachedPreview || previewMediaData)
  ));
  const fullMediaData = useMedia(fullMediaHash || `sticker${id}`, !shouldLoad || shouldSkipFullMedia);
  const shouldRenderFullMedia = isReadyToMountFullMedia && fullMediaData && !isVideoBroken;
  const [isPlayerReady, markPlayerReady] = useFlag();
  const isFullMediaReady = shouldRenderFullMedia && (isStatic || isPlayerReady);

  const thumbDataUri = useThumbnail(sticker);
  const thumbData = cachedPreview || previewMediaData || thumbDataUri;
  const isThumbOpaque = sharedCanvasRef && !withTranslucentThumb;

  const thumbClassNames = useMediaTransition(thumbData && !isFullMediaReady);
  const fullMediaClassNames = useMediaTransition(isFullMediaReady);
  const noTransition = isLottie && withPreview;

  const coords = useCoordsInSharedCanvas(containerRef, sharedCanvasRef);

  // Preload preview for Message Input and local message
  useMedia(previewMediaHash, !shouldLoad || !shouldPreloadPreview);

  const randomIdPrefix = useUniqueId();
  const renderId = [
    (withSharedAnimation ? SHARED_PREFIX : randomIdPrefix),
    id,
    size,
    (withSharedAnimation ? customColor : undefined),
    dpr,
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
      {shouldRenderFullMedia && (isLottie ? (
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
          canPlay={shouldPlay}
          className={buildClassName(styles.media, fullMediaClassName, fullMediaClassNames, 'sticker-media')}
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
