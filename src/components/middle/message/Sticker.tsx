import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { NO_STICKER_SET_ID } from '../../../config';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';
import { getMessageMediaFormat, getMessageMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useFlag from '../../../hooks/useFlag';
import useWebpThumbnail from '../../../hooks/useWebpThumbnail';
import safePlay from '../../../util/safePlay';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getActions } from '../../../global';
import useLang from '../../../hooks/useLang';

import AnimatedSticker from '../../common/AnimatedSticker';
import StickerSetModal from '../../common/StickerSetModal.async';

import './Sticker.scss';

// eslint-disable-next-line max-len
// https://github.com/telegramdesktop/tdesktop/blob/master/Telegram/SourceFiles/history/view/media/history_view_sticker.cpp#L42
const EFFECT_SIZE_MULTIPLIER = 1 + 0.245 * 2;

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  shouldLoop?: boolean;
  lastSyncTime?: number;
  shouldPlayEffect?: boolean;
  onPlayEffect?: VoidFunction;
  onStopEffect?: VoidFunction;
};

const Sticker: FC<OwnProps> = ({
  message, observeIntersection, observeIntersectionForPlaying, shouldLoop, lastSyncTime,
  shouldPlayEffect, onPlayEffect, onStopEffect,
}) => {
  const { showNotification } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isModalOpen, openModal, closeModal] = useFlag();

  const sticker = message.content.sticker!;
  const {
    isLottie, stickerSetId, isVideo, hasEffect,
  } = sticker;
  const canDisplayVideo = IS_WEBM_SUPPORTED;
  const isMemojiSticker = stickerSetId === NO_STICKER_SET_ID;

  const [isPlayingEffect, startPlayingEffect, stopPlayingEffect] = useFlag();
  const shouldLoad = useIsIntersecting(ref, observeIntersection);
  const shouldPlay = useIsIntersecting(ref, observeIntersectionForPlaying);

  const mediaHash = sticker.isPreloadedGlobally ? `sticker${sticker.id}` : getMessageMediaHash(message, 'inline')!;
  const mediaHashEffect = `sticker${sticker.id}?size=f`;

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

  const effectBlobUrl = useMedia(
    mediaHashEffect,
    !shouldLoad || !hasEffect,
    ApiMediaFormat.BlobUrl,
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
    hasEffect && !message.isOutgoing && 'reversed',
  );

  const handleEffectEnded = useCallback(() => {
    stopPlayingEffect();
    onStopEffect?.();
  }, [onStopEffect, stopPlayingEffect]);

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

  useEffect(() => {
    if (hasEffect && shouldPlay && shouldPlayEffect) {
      startPlayingEffect();
      onPlayEffect?.();
    }
  }, [hasEffect, shouldPlayEffect, onPlayEffect, shouldPlay, startPlayingEffect]);

  const handleClick = useCallback(() => {
    if (hasEffect) {
      if (isPlayingEffect) {
        showNotification({
          message: lang('PremiumStickerTooltip'),
          action: openModal,
          actionText: lang('ViewAction'),
        });
        return;
      } else {
        startPlayingEffect();
        onPlayEffect?.();
        return;
      }
    }
    openModal();
  }, [hasEffect, isPlayingEffect, lang, onPlayEffect, openModal, showNotification, startPlayingEffect]);

  return (
    <div ref={ref} className={stickerClassName} onClick={!isMemojiSticker ? handleClick : undefined}>
      {(!isMediaReady || (isVideo && !canDisplayVideo)) && (
        <img
          src={previewUrl}
          width={width}
          height={height}
          alt=""
          className={thumbClassName}
        />
      )}
      {!isLottie && !isVideo && (
        <img
          src={mediaData as string}
          width={width}
          height={height}
          alt=""
          className={buildClassName('full-media', transitionClassNames)}
        />
      )}
      {isVideo && canDisplayVideo && isMediaReady && (
        <video
          src={mediaData as string}
          width={width}
          height={height}
          autoPlay={shouldPlay}
          playsInline
          disablePictureInPicture
          loop={shouldLoop}
          muted
        />
      )}
      {isLottie && isMediaLoaded && (
        <AnimatedSticker
          key={mediaHash}
          className={buildClassName('full-media', transitionClassNames)}
          tgsUrl={mediaData}
          size={width}
          play={shouldPlay}
          noLoop={!shouldLoop}
          onLoad={markLottieLoaded}
        />
      )}
      {hasEffect && shouldLoad && isPlayingEffect && (
        <AnimatedSticker
          key={mediaHashEffect}
          className="effect-sticker"
          tgsUrl={effectBlobUrl}
          size={width * EFFECT_SIZE_MULTIPLIER}
          play
          isLowPriority
          noLoop
          onEnded={handleEffectEnded}
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
