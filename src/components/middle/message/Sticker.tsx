import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { ApiMediaFormat } from '../../../api/types';

import { getMediaThumbUri, getStickerMediaHash } from '../../../global/helpers';
import { IS_WEBM_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getStickerDimensions } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useOverlayPosition from './hooks/useOverlayPosition';

import AnimatedSticker from '../../common/AnimatedSticker';
import MediaSpoiler from '../../common/MediaSpoiler';
import SensitiveContentConfirmModal from '../../common/SensitiveContentConfirmModal';
import StickerView from '../../common/StickerView';
import Portal from '../../ui/Portal';

import styles from './Sticker.module.scss';

// https://github.com/telegramdesktop/tdesktop/blob/master/Telegram/SourceFiles/history/view/media/history_view_sticker.cpp#L42
const EFFECT_SIZE_MULTIPLIER = 1 + 0.245 * 2;

type OwnProps = {
  message: ApiMessage;
  shouldLoop?: boolean;
  shouldPlayEffect?: boolean;
  withEffect?: boolean;
  isMediaNsfw?: boolean;
  observeIntersection: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  onStopEffect?: VoidFunction;
};

type StateProps = {
  needsAgeVerification?: boolean;
};

const Sticker: FC<OwnProps & StateProps> = ({
  message,
  shouldLoop,
  shouldPlayEffect,
  withEffect,
  isMediaNsfw,
  onStopEffect,
  observeIntersection,
  observeIntersectionForPlaying,
  needsAgeVerification,
}) => {
  const { showNotification, openStickerSet, updateContentSettings, openAgeVerificationModal } = getActions();

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const ref = useRef<HTMLDivElement>();

  const effectRef = useRef<HTMLDivElement>();

  const sticker = message.content.sticker!;
  const { stickerSetInfo, isVideo, hasEffect } = sticker;
  const isMirrored = !message.isOutgoing;

  const [isNsfwModalOpen, openNsfwModal, closeNsfwModal] = useFlag();
  const [shouldAlwaysShowNsfw, setShouldAlwaysShowNsfw] = useState(false);

  const shouldShowSpoiler = isMediaNsfw;
  const [isSpoilerShown, showSpoiler, hideSpoiler] = useFlag(shouldShowSpoiler);

  useEffect(() => {
    if (shouldShowSpoiler) {
      showSpoiler();
    } else {
      hideSpoiler();
    }
  }, [shouldShowSpoiler]);

  const handleNsfwConfirm = useLastCallback(() => {
    closeNsfwModal();
    hideSpoiler();

    if (shouldAlwaysShowNsfw) {
      updateContentSettings({ isSensitiveEnabled: true });
    }
  });

  const mediaHash = sticker.isPreloadedGlobally ? undefined : (
    getStickerMediaHash(sticker, isVideo && !IS_WEBM_SUPPORTED ? 'pictogram' : 'inline')
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

  const thumbDataUri = getMediaThumbUri(sticker);

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
    if (isSpoilerShown) {
      if (isMediaNsfw) {
        if (needsAgeVerification) {
          openAgeVerificationModal();
          return;
        }
        openNsfwModal();
        return;
      }
      hideSpoiler();
      return;
    }

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
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        width={width}
        height={height}
        className="media-spoiler"
        isNsfw={isMediaNsfw}
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
      <SensitiveContentConfirmModal
        isOpen={isNsfwModalOpen}
        onClose={closeNsfwModal}
        shouldAlwaysShow={shouldAlwaysShowNsfw}
        onAlwaysShowChanged={setShouldAlwaysShowNsfw}
        confirmHandler={handleNsfwConfirm}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const appConfig = global.appConfig;
  const needsAgeVerification = appConfig.needAgeVideoVerification;

  return {
    needsAgeVerification,
  };
})(Sticker));
