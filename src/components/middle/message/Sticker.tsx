import type { FC } from '../../../lib/teact/teact';
import React, { useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { ApiMediaFormat } from '../../../api/types';

import { getStickerMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { IS_WEBM_SUPPORTED } from '../../../util/windowEnvironment';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useOverlayPosition from './hooks/useOverlayPosition';

import AnimatedSticker from '../../common/AnimatedSticker';
import StickerView from '../../common/StickerView';
import Portal from '../../ui/Portal';

import styles from './Sticker.module.scss';

// https://github.com/telegramdesktop/tdesktop/blob/master/Telegram/SourceFiles/history/view/media/history_view_sticker.cpp#L42
const EFFECT_SIZE_MULTIPLIER = 1 + 0.245 * 2;

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  shouldLoop?: boolean;
  shouldPlayEffect?: boolean;
  withEffect?: boolean;
  onStopEffect?: VoidFunction;
};

const Sticker: FC<OwnProps> = ({
  message, observeIntersection, observeIntersectionForPlaying, shouldLoop,
  shouldPlayEffect, withEffect, onStopEffect,
}) => {
  const { showNotification, openStickerSet } = getActions();

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const effectRef = useRef<HTMLDivElement>(null);

  const sticker = message.content.sticker!;
  const { stickerSetInfo, isVideo, hasEffect } = sticker;
  const isMirrored = !message.isOutgoing;

  const mediaHash = sticker.isPreloadedGlobally ? undefined : (
    getStickerMediaHash(sticker, isVideo && !IS_WEBM_SUPPORTED ? 'pictogram' : 'inline')!
  );

  const canLoad = useIsIntersecting(ref, observeIntersection);
  const canPlay = useIsIntersecting(ref, observeIntersectionForPlaying);
  const mediaHashEffect = `sticker${sticker.id}?size=f`;
  const effectBlobUrl = useMedia(
    mediaHashEffect,
    !canLoad || !hasEffect || !withEffect,
    ApiMediaFormat.BlobUrl,
  );
  const [isPlayingEffect, startPlayingEffect, stopPlayingEffect] = useFlag();

  const handleEffectEnded = useLastCallback(() => {
    stopPlayingEffect();
    onStopEffect?.();
  });

  useEffect(() => {
    if (hasEffect && withEffect && canPlay && shouldPlayEffect) {
      startPlayingEffect();
    }
  }, [hasEffect, canPlay, shouldPlayEffect, startPlayingEffect, withEffect]);

  const shouldRenderEffect = hasEffect && withEffect && effectBlobUrl && isPlayingEffect;
  useOverlayPosition({
    anchorRef: ref,
    overlayRef: effectRef,
    isMirrored,
    isDisabled: !shouldRenderEffect,
  });

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
        return;
      }
    }
    openModal();
  });

  const isMemojiSticker = 'isMissing' in stickerSetInfo;
  const { width, height } = getStickerDimensions(sticker, isMobile);
  const className = buildClassName(
    'media-inner',
    styles.root,
    isMemojiSticker && styles.inactive,
    hasEffect && isMirrored && styles.mirrored,
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
      {shouldRenderEffect && (
        <Portal>
          <AnimatedSticker
            ref={effectRef}
            key={mediaHashEffect}
            className={buildClassName(styles.effect, isMirrored && styles.mirrored)}
            tgsUrl={effectBlobUrl}
            size={width * EFFECT_SIZE_MULTIPLIER}
            play
            isLowPriority
            noLoop
            onEnded={handleEffectEnded}
          />
        </Portal>
      )}
    </div>
  );
};

export default Sticker;
