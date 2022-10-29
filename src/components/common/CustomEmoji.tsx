import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { IS_WEBM_SUPPORTED } from '../../util/environment';
import renderText from './helpers/renderText';
import { getPropertyHexColor } from '../../util/themeStyle';
import { hexToRgb } from '../../util/switchTheme';
import buildClassName from '../../util/buildClassName';
import { getStickerPreviewHash } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji, selectIsDefaultEmojiStatusPack } from '../../global/selectors';
import safePlay from '../../util/safePlay';

import useMedia from '../../hooks/useMedia';
import useEnsureCustomEmoji from '../../hooks/useEnsureCustomEmoji';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useThumbnail from '../../hooks/useThumbnail';
import useCustomEmoji from './hooks/useCustomEmoji';
import useMediaTransition from '../../hooks/useMediaTransition';

import AnimatedSticker from './AnimatedSticker';
import OptimizedVideo from '../ui/OptimizedVideo';

import styles from './CustomEmoji.module.scss';

type OwnProps = {
  documentId: string;
  children?: TeactNode;
  size?: number;
  className?: string;
  loopLimit?: number;
  withGridFix?: boolean;
  withPreview?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const STICKER_SIZE = 24;

const CustomEmoji: FC<OwnProps> = ({
  documentId,
  children,
  size = STICKER_SIZE,
  className,
  loopLimit,
  withGridFix,
  withPreview,
  observeIntersection,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // An alternative to `withGlobal` to avoid adding numerous global containers
  const customEmoji = useCustomEmoji(documentId);
  const isUnsupportedVideo = customEmoji?.isVideo && !IS_WEBM_SUPPORTED;
  const mediaHash = customEmoji && `sticker${customEmoji.id}`;
  const mediaData = useMedia(mediaHash);

  const shouldLoadPreview = !mediaData && (withPreview || isUnsupportedVideo);
  const previewMediaHash = shouldLoadPreview && customEmoji && getStickerPreviewHash(customEmoji.id);
  const previewMediaData = useMedia(previewMediaHash);
  const thumbDataUri = useThumbnail(customEmoji);

  const shouldDisplayPreview = Boolean(mediaData ? isUnsupportedVideo : previewMediaData);
  const transitionClassNames = useMediaTransition(shouldDisplayPreview ? previewMediaData : mediaData);

  const loopCountRef = useRef(0);
  const [shouldLoop, setShouldLoop] = useState(true);
  const [customColor, setCustomColor] = useState<[number, number, number] | undefined>();

  const hasCustomColor = customEmoji && selectIsDefaultEmojiStatusPack(getGlobal(), customEmoji.stickerSetInfo);

  useEffect(() => {
    if (!hasCustomColor || !ref.current) {
      setCustomColor(undefined);
      return;
    }
    const hexColor = getPropertyHexColor(getComputedStyle(ref.current), '--emoji-status-color');
    if (!hexColor) {
      setCustomColor(undefined);
      return;
    }
    const customColorRgb = hexToRgb(hexColor);
    setCustomColor([customColorRgb.r, customColorRgb.g, customColorRgb.b]);
  }, [hasCustomColor]);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  useEnsureCustomEmoji(documentId);

  const handleVideoEnded = useCallback((e) => {
    if (!loopLimit) return;

    loopCountRef.current += 1;

    if (loopCountRef.current >= loopLimit) {
      setShouldLoop(false);
      e.currentTarget.currentTime = 0;
    } else {
      // Loop manually
      safePlay(e.currentTarget);
    }
  }, [loopLimit]);

  const handleStickerLoop = useCallback(() => {
    if (!loopLimit) return;

    loopCountRef.current += 1;

    // Sticker plays 1 more time after disabling loop
    if (loopCountRef.current >= loopLimit - 1) {
      setShouldLoop(false);
    }
  }, [loopLimit]);

  function renderContent() {
    if (!customEmoji || (!thumbDataUri && !mediaData)) {
      return (children && renderText(children, ['emoji']));
    }

    if (!mediaData && !previewMediaData) {
      return (
        <img className={styles.media} src={thumbDataUri} alt={customEmoji.emoji} />
      );
    }

    if (shouldDisplayPreview || isUnsupportedVideo || (!customEmoji.isVideo && !customEmoji.isLottie)) {
      return (
        <img className={styles.media} src={previewMediaData || mediaData} alt={customEmoji.emoji} />
      );
    }

    if (customEmoji.isVideo) {
      return (
        <OptimizedVideo
          canPlay={isIntersecting && shouldLoop}
          className={styles.media}
          src={mediaData}
          playsInline
          muted
          loop={!loopLimit}
          disablePictureInPicture
          onEnded={handleVideoEnded}
        />
      );
    }

    return (
      <AnimatedSticker
        size={size}
        key={mediaData}
        className={styles.sticker}
        tgsUrl={mediaData}
        play={isIntersecting}
        color={customColor}
        noLoop={!shouldLoop}
        isLowPriority={!selectIsAlwaysHighPriorityEmoji(getGlobal(), customEmoji.stickerSetInfo)}
        onLoop={handleStickerLoop}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        className,
        'custom-emoji',
        'emoji',
        hasCustomColor && 'custom-color',
        withGridFix && styles.withGridFix,
        ...transitionClassNames,
      )}
      onClick={onClick}
    >
      {renderContent()}
    </div>
  );
};

export default memo(CustomEmoji);
