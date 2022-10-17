import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { IS_WEBM_SUPPORTED } from '../../util/environment';
import renderText from './helpers/renderText';
import safePlay from '../../util/safePlay';
import { getPropertyHexColor } from '../../util/themeStyle';
import { hexToRgb } from '../../util/switchTheme';
import buildClassName from '../../util/buildClassName';
import { selectIsAlwaysHighPriorityEmoji, selectIsDefaultEmojiStatusPack } from '../../global/selectors';

import useMedia from '../../hooks/useMedia';
import useEnsureCustomEmoji from '../../hooks/useEnsureCustomEmoji';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useThumbnail from '../../hooks/useThumbnail';
import useCustomEmoji from './hooks/useCustomEmoji';

import AnimatedSticker from './AnimatedSticker';

import styles from './CustomEmoji.module.scss';

type OwnProps = {
  documentId: string;
  children?: TeactNode;
  className?: string;
  loopLimit?: number;
  withGridFix?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const STICKER_SIZE = 24;

const CustomEmoji: FC<OwnProps> = ({
  documentId,
  children,
  className,
  loopLimit,
  withGridFix,
  observeIntersection,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // An alternative to `withGlobal` to avoid adding numerous global containers
  const customEmoji = useCustomEmoji(documentId);
  const isUnsupportedVideo = customEmoji?.isVideo && !IS_WEBM_SUPPORTED;
  const mediaHash = customEmoji && `sticker${customEmoji.id}${isUnsupportedVideo ? '?size=m' : ''}`;
  const mediaData = useMedia(mediaHash);
  const thumbDataUri = useThumbnail(customEmoji);
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

  useEffect(() => {
    if (!customEmoji?.isVideo) return;
    const video = ref.current?.querySelector('video');
    if (!video || isIntersecting === !video.paused) return;

    if (isIntersecting) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, [customEmoji, isIntersecting]);

  useEffect(() => {
    if (!loopLimit) return undefined;
    const video = ref.current?.querySelector('video');
    if (!mediaData || !video) return undefined;

    const returnToStart = () => {
      loopCountRef.current += 1;
      if (loopCountRef.current >= loopLimit) {
        setShouldLoop(false);
        video.currentTime = 0;
      } else {
        video.play();
      }
    };

    video.addEventListener('ended', returnToStart);
    return () => video.removeEventListener('ended', returnToStart);
  }, [loopLimit, mediaData]);

  const handleStickerLoop = useCallback(() => {
    if (!loopLimit) return;
    loopCountRef.current += 1;
    // Sticker plays 1 more time after disabling loop
    if (loopCountRef.current >= loopLimit - 1) {
      setShouldLoop(false);
    }
  }, [loopLimit]);

  const content = useMemo(() => {
    if (!customEmoji || (!thumbDataUri && !mediaData)) {
      return (children && renderText(children, ['emoji']));
    }

    if (!mediaData) {
      return (
        <img className={styles.media} src={thumbDataUri} alt={customEmoji.emoji} />
      );
    }

    if (isUnsupportedVideo || (!customEmoji.isVideo && !customEmoji.isLottie)) {
      return (
        <img className={styles.media} src={mediaData} alt={customEmoji.emoji} />
      );
    }

    if (customEmoji.isVideo) {
      return (
        <video
          className={styles.media}
          playsInline
          muted
          loop={!loopLimit}
          autoPlay={isIntersecting}
          src={mediaData}
          disablePictureInPicture
        />
      );
    }

    return (
      <AnimatedSticker
        key={mediaData}
        className={styles.sticker}
        size={STICKER_SIZE}
        tgsUrl={mediaData}
        play={isIntersecting}
        color={customColor}
        noLoop={!shouldLoop}
        isLowPriority={!selectIsAlwaysHighPriorityEmoji(getGlobal(), customEmoji.stickerSetInfo)}
        onLoop={handleStickerLoop}
      />
    );
  }, [
    children, customColor, customEmoji, handleStickerLoop, isIntersecting, loopLimit, mediaData, shouldLoop,
    thumbDataUri,
  ]);

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
      )}
      onClick={onClick}
    >
      {content}
    </div>
  );
};

export default memo(CustomEmoji);
