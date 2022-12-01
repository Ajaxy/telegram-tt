import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { ApiMessageEntityTypes } from '../../api/types';

import { getPropertyHexColor } from '../../util/themeStyle';
import { hexToRgb } from '../../util/switchTheme';
import buildClassName from '../../util/buildClassName';
import safePlay from '../../util/safePlay';
import { selectIsAlwaysHighPriorityEmoji, selectIsDefaultEmojiStatusPack } from '../../global/selectors';

import useEnsureCustomEmoji from '../../hooks/useEnsureCustomEmoji';
import useCustomEmoji from './hooks/useCustomEmoji';

import StickerView from './StickerView';

import styles from './CustomEmoji.module.scss';
import svgPlaceholder from '../../assets/square.svg';
import blankImg from '../../assets/blank.png';

type OwnProps = {
  ref?: React.RefObject<HTMLDivElement>;
  documentId: string;
  children?: TeactNode;
  size?: number;
  className?: string;
  loopLimit?: number;
  style?: string;
  isBig?: boolean;
  withGridFix?: boolean;
  withSharedAnimation?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: React.RefObject<HTMLCanvasElement>;
  withTranslucentThumb?: boolean;
  shouldPreloadPreview?: boolean;
  forceOnHeavyAnimation?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const STICKER_SIZE = 20;

const CustomEmoji: FC<OwnProps> = ({
  ref,
  documentId,
  size = STICKER_SIZE,
  isBig,
  className,
  loopLimit,
  style,
  withGridFix,
  withSharedAnimation,
  sharedCanvasRef,
  sharedCanvasHqRef,
  withTranslucentThumb,
  shouldPreloadPreview,
  forceOnHeavyAnimation,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  // An alternative to `withGlobal` to avoid adding numerous global containers
  const customEmoji = useCustomEmoji(documentId);
  useEnsureCustomEmoji(documentId);

  const loopCountRef = useRef(0);
  const [shouldLoop, setShouldLoop] = useState(true);

  const [customColor, setCustomColor] = useState<[number, number, number] | undefined>();
  const hasCustomColor = customEmoji && selectIsDefaultEmojiStatusPack(getGlobal(), customEmoji.stickerSetInfo);

  useEffect(() => {
    if (!hasCustomColor) {
      setCustomColor(undefined);
      return;
    }
    const hexColor = getPropertyHexColor(getComputedStyle(containerRef.current!), '--emoji-status-color');
    if (!hexColor) {
      setCustomColor(undefined);
      return;
    }
    const customColorRgb = hexToRgb(hexColor);
    setCustomColor([customColorRgb.r, customColorRgb.g, customColorRgb.b]);
  }, [hasCustomColor]);

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

  const isHq = customEmoji?.stickerSetInfo && selectIsAlwaysHighPriorityEmoji(getGlobal(), customEmoji.stickerSetInfo);

  return (
    <div
      ref={containerRef}
      className={buildClassName(
        styles.root,
        className,
        'custom-emoji',
        'emoji',
        hasCustomColor && 'custom-color',
        withGridFix && styles.withGridFix,
      )}
      onClick={onClick}
      data-entity-type={ApiMessageEntityTypes.CustomEmoji}
      data-document-id={documentId}
      data-alt={customEmoji?.emoji}
      style={style}
    >
      <img className={styles.highlightCatch} src={blankImg} alt={customEmoji?.emoji} draggable={false} />
      {!customEmoji ? (
        <img className={styles.thumb} src={svgPlaceholder} alt="Emoji" />
      ) : (
        <StickerView
          containerRef={containerRef}
          sticker={customEmoji}
          isSmall={!isBig}
          size={size}
          customColor={customColor}
          thumbClassName={styles.thumb}
          fullMediaClassName={styles.media}
          shouldLoop={shouldLoop}
          loopLimit={loopLimit}
          shouldPreloadPreview={shouldPreloadPreview}
          forceOnHeavyAnimation={forceOnHeavyAnimation}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withSharedAnimation={withSharedAnimation}
          sharedCanvasRef={isHq ? sharedCanvasHqRef : sharedCanvasRef}
          withTranslucentThumb={withTranslucentThumb}
          onVideoEnded={handleVideoEnded}
          onAnimatedStickerLoop={handleStickerLoop}
        />
      )}
    </div>
  );
};

export default memo(CustomEmoji);
