import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getStickerDimensions } from '../../common/helpers/mediaDimensions';
import { getMessageMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getActions } from '../../../global';

import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import StickerView from '../../common/StickerView';
import AnimatedSticker from '../../common/AnimatedSticker';

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
  const { showNotification, openStickerSet } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const sticker = message.content.sticker!;
  const { stickerSetInfo, isVideo, hasEffect } = sticker;

  const mediaHash = sticker.isPreloadedGlobally ? undefined : (
    getMessageMediaHash(message, isVideo && !IS_WEBM_SUPPORTED ? 'pictogram' : 'inline')!
  );

  const canLoad = useIsIntersecting(ref, observeIntersection);
  const canPlay = useIsIntersecting(ref, observeIntersectionForPlaying);
  const mediaHashEffect = `sticker${sticker.id}?size=f`;
  const effectBlobUrl = useMedia(
    mediaHashEffect,
    !canLoad || !hasEffect,
    ApiMediaFormat.BlobUrl,
    lastSyncTime,
  );
  const [isPlayingEffect, startPlayingEffect, stopPlayingEffect] = useFlag();

  const handleEffectEnded = useCallback(() => {
    stopPlayingEffect();
    onStopEffect?.();
  }, [onStopEffect, stopPlayingEffect]);

  useEffect(() => {
    if (hasEffect && canPlay && shouldPlayEffect) {
      startPlayingEffect();
      onPlayEffect?.();
    }
  }, [hasEffect, canPlay, onPlayEffect, shouldPlayEffect, startPlayingEffect]);

  const openModal = useCallback(() => {
    openStickerSet({
      stickerSetInfo: sticker.stickerSetInfo,
    });
  }, [openStickerSet, sticker]);

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

  const isMemojiSticker = 'isMissing' in stickerSetInfo;
  const { width, height } = getStickerDimensions(sticker);
  const className = buildClassName(
    'Sticker media-inner',
    isMemojiSticker && 'inactive',
    hasEffect && !message.isOutgoing && 'reversed',
  );

  return (
    <div
      ref={ref}
      className={className}
      style={`width: ${width}px; height: ${height}px;`}
      onClick={!isMemojiSticker ? handleClick : undefined}
    >
      <StickerView
        containerRef={ref}
        sticker={sticker}
        fullMediaHash={mediaHash}
        fullMediaClassName="full-media"
        size={width}
        shouldLoop={shouldLoop}
        noLoad={!canLoad}
        noPlay={!canPlay}
        cacheBuster={lastSyncTime}
      />
      {hasEffect && canLoad && isPlayingEffect && (
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
    </div>
  );
};

export default Sticker;
