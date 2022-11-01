import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getPropertyHexColor } from '../../util/themeStyle';
import { hexToRgb } from '../../util/switchTheme';
import buildClassName from '../../util/buildClassName';
import safePlay from '../../util/safePlay';
import { selectIsDefaultEmojiStatusPack } from '../../global/selectors';

import useEnsureCustomEmoji from '../../hooks/useEnsureCustomEmoji';
import useCustomEmoji from './hooks/useCustomEmoji';

import StickerView from './StickerView';

import styles from './CustomEmoji.module.scss';
import svgPlaceholder from '../../assets/square.svg';

type OwnProps = {
  ref?: React.RefObject<HTMLDivElement>;
  documentId: string;
  children?: TeactNode;
  size?: number;
  className?: string;
  loopLimit?: number;
  style?: string;
  withSharedAnimation?: boolean;
  withGridFix?: boolean;
  shouldPreloadPreview?: boolean;
  forceOnHeavyAnimation?: boolean;
  observeIntersection?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const STICKER_SIZE = 24;

const CustomEmoji: FC<OwnProps> = ({
  ref,
  documentId,
  size = STICKER_SIZE,
  className,
  loopLimit,
  style,
  withGridFix,
  shouldPreloadPreview,
  forceOnHeavyAnimation,
  withSharedAnimation,
  observeIntersection,
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
    if (!hasCustomColor || !containerRef.current) {
      setCustomColor(undefined);
      return;
    }
    const hexColor = getPropertyHexColor(getComputedStyle(containerRef.current), '--emoji-status-color');
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
      style={style}
    >
      {!customEmoji ? (
        <img className={styles.thumb} src={svgPlaceholder} alt="Emoji" />
      ) : (
        <StickerView
          containerRef={containerRef}
          sticker={customEmoji}
          isSmall
          size={size}
          customColor={customColor}
          thumbClassName={styles.thumb}
          fullMediaClassName={styles.media}
          shouldLoop={shouldLoop}
          loopLimit={loopLimit}
          shouldPreloadPreview={shouldPreloadPreview}
          observeIntersection={observeIntersection}
          forceOnHeavyAnimation={forceOnHeavyAnimation}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withSharedAnimation={withSharedAnimation}
          onVideoEnded={handleVideoEnded}
          onAnimatedStickerLoop={handleStickerLoop}
        />
      )}
    </div>
  );
};

export default memo(CustomEmoji);
