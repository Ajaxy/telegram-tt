import type { FC } from '../../../lib/teact/teact';
import React, { useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { ApiMediaFormat } from '../../../api/types';

import { getMessageMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { IS_WEBM_SUPPORTED } from '../../../util/windowEnvironment';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import usePrevious from '../../../hooks/usePrevious';

import AnimatedSticker from '../../common/AnimatedSticker';
import StickerView from '../../common/StickerView';

import './Sticker.scss';

// https://github.com/telegramdesktop/tdesktop/blob/master/Telegram/SourceFiles/history/view/media/history_view_sticker.cpp#L42
const EFFECT_SIZE_MULTIPLIER = 1 + 0.245 * 2;

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  shouldLoop?: boolean;
  shouldPlayEffect?: boolean;
  withEffect?: boolean;
  onPlayEffect?: VoidFunction;
  onStopEffect?: VoidFunction;
};

const Sticker: FC<OwnProps> = ({
  message, observeIntersection, observeIntersectionForPlaying, shouldLoop,
  shouldPlayEffect, withEffect, onPlayEffect, onStopEffect,
}) => {
  const { showNotification, openStickerSet } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();

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
  );
  const [isPlayingEffect, startPlayingEffect, stopPlayingEffect] = useFlag();

  const handleEffectEnded = useLastCallback(() => {
    stopPlayingEffect();
    onStopEffect?.();
  });

  const previousShouldPlayEffect = usePrevious(shouldPlayEffect);

  useEffect(() => {
    if (hasEffect && withEffect && canPlay && (shouldPlayEffect || previousShouldPlayEffect)) {
      startPlayingEffect();
      onPlayEffect?.();
    }
  }, [hasEffect, canPlay, onPlayEffect, shouldPlayEffect, previousShouldPlayEffect, startPlayingEffect, withEffect]);

  const openModal = useLastCallback(() => {
    openStickerSet({
      stickerSetInfo: sticker.stickerSetInfo,
    });
  });

  const handleClick = useLastCallback(() => {
    if (hasEffect) {
      if (isPlayingEffect || !withEffect) {
        showNotification({
          message: lang('PremiumStickerTooltip'),
          action: {
            action: 'openStickerSet',
            payload: {
              stickerSetInfo: sticker.stickerSetInfo,
            },
          },
          actionText: lang('ViewAction'),
        });
        return;
      } else if (withEffect) {
        startPlayingEffect();
        onPlayEffect?.();
        return;
      }
    }
    openModal();
  });

  const isMemojiSticker = 'isMissing' in stickerSetInfo;
  const { width, height } = getStickerDimensions(sticker, isMobile);
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
        withSharedAnimation
      />
      {hasEffect && withEffect && canLoad && isPlayingEffect && (
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
