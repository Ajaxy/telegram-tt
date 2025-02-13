import type { FC } from '../../lib/teact/teact';
import React, { memo, useRef, useState } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { ApiMessageEntityTypes } from '../../api/types';

import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import safePlay from '../../util/safePlay';

import useDynamicColorListener from '../../hooks/stickers/useDynamicColorListener';
import useLastCallback from '../../hooks/useLastCallback';
import useCustomEmoji from './hooks/useCustomEmoji';

import Sparkles from './Sparkles';
import StickerView from './StickerView';

import styles from './CustomEmoji.module.scss';

import blankImg from '../../assets/blank.png';

type OwnProps = {
  ref?: React.RefObject<HTMLDivElement>;
  documentId: string;
  className?: string;
  style?: string;
  size?: number;
  isBig?: boolean;
  noPlay?: boolean;
  noVideoOnMobile?: boolean;
  loopLimit?: number;
  isSelectable?: boolean;
  withSharedAnimation?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: React.RefObject<HTMLCanvasElement>;
  withTranslucentThumb?: boolean;
  shouldPreloadPreview?: boolean;
  forceOnHeavyAnimation?: boolean;
  forceAlways?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
  onAnimationEnd?: NoneToVoidFunction;
  withSparkles?: boolean;
  sparklesClassName?: string;
  sparklesStyle?: string;
};

const STICKER_SIZE = 20;

const CustomEmoji: FC<OwnProps> = ({
  ref,
  documentId,
  className,
  style,
  size = STICKER_SIZE,
  isBig,
  noPlay,
  noVideoOnMobile,
  loopLimit,
  isSelectable,
  withSharedAnimation,
  sharedCanvasRef,
  sharedCanvasHqRef,
  withTranslucentThumb,
  shouldPreloadPreview,
  forceAlways,
  forceOnHeavyAnimation,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
  onAnimationEnd,
  withSparkles,
  sparklesStyle,
  sparklesClassName,
}) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  // An alternative to `withGlobal` to avoid adding numerous global containers
  const { customEmoji, canPlay } = useCustomEmoji(documentId);

  const loopCountRef = useRef(0);
  const [shouldPlay, setShouldPlay] = useState(true);

  const hasCustomColor = customEmoji?.shouldUseTextColor;
  const customColor = useDynamicColorListener(containerRef, !hasCustomColor);

  const handleVideoEnded = useLastCallback((e) => {
    if (!loopLimit) return;

    loopCountRef.current += 1;

    if (loopCountRef.current >= loopLimit) {
      setShouldPlay(false);
      e.currentTarget.currentTime = 0;
    } else {
      // Loop manually
      safePlay(e.currentTarget);
    }
  });

  const handleStickerLoop = useLastCallback(() => {
    if (!loopLimit) return;

    loopCountRef.current += 1;

    if (loopCountRef.current >= loopLimit) {
      setShouldPlay(false);
    }
  });

  const isHq = customEmoji?.stickerSetInfo && selectIsAlwaysHighPriorityEmoji(getGlobal(), customEmoji.stickerSetInfo);

  return (
    <div
      ref={containerRef}
      className={buildClassName(
        styles.root,
        withSparkles && styles.withSparkles,
        className,
        'custom-emoji',
        'emoji',
      )}
      onClick={onClick}
      onAnimationEnd={onAnimationEnd}
      data-entity-type={ApiMessageEntityTypes.CustomEmoji}
      data-document-id={documentId}
      data-alt={customEmoji?.emoji}
      style={style}
    >
      {withSparkles && (
        <Sparkles
          className={buildClassName(
            styles.sparkles,
            sparklesClassName,
          )}
          style={sparklesStyle}
          preset="button"
        />
      )}
      {isSelectable && (
        <img
          className={styles.highlightCatch}
          src={blankImg}
          alt={customEmoji?.emoji}
          data-entity-type={ApiMessageEntityTypes.CustomEmoji}
          data-document-id={documentId}
          draggable={false}
        />
      )}
      {!customEmoji ? (
        <div className={buildClassName(styles.placeholder)} draggable={false} />
      ) : (
        <StickerView
          containerRef={containerRef}
          sticker={customEmoji}
          isSmall={!isBig}
          size={size}
          noPlay={noPlay || !(shouldPlay && canPlay)}
          noVideoOnMobile={noVideoOnMobile}
          thumbClassName={styles.thumb}
          fullMediaClassName={styles.media}
          shouldLoop
          loopLimit={loopLimit}
          shouldPreloadPreview={shouldPreloadPreview || noPlay || !canPlay}
          forceOnHeavyAnimation={forceOnHeavyAnimation}
          forceAlways={forceAlways}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withSharedAnimation={withSharedAnimation}
          sharedCanvasRef={isHq ? sharedCanvasHqRef : sharedCanvasRef}
          withTranslucentThumb={withTranslucentThumb}
          onVideoEnded={handleVideoEnded}
          onAnimatedStickerLoop={handleStickerLoop}
          customColor={customColor}
        />
      )}
    </div>
  );
};

export default memo(CustomEmoji);
