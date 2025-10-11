import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { ApiSticker } from '../../api/types';
import type { AnimationLevel } from '../../types';

import { ANIMATION_LEVEL_MIN } from '../../config';
import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';

import AnimatedTabItem from './AnimatedTabItem';

import styles from './AnimatedTabList.module.scss';

export type TabItem = {
  id: string;
  title: string;
  sticker?: ApiSticker;
};

type OwnProps = {
  items: TabItem[];
  selectedItemId?: string;
  className?: string;
  animationLevel: AnimationLevel;
  onItemSelect?: (itemId: string) => void;
};

const AnimatedTabList = ({
  items,
  selectedItemId,
  animationLevel,
  onItemSelect,
  className,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const clipPathContainerRef = useRef<HTMLDivElement>();
  const selectedIndex = items.findIndex((item) => item.id === selectedItemId) || 0;
  const [clipPath, setClipPath] = useState<string>('');
  const shouldAnimate = animationLevel > ANIMATION_LEVEL_MIN;

  useHorizontalScroll(containerRef, !items.length, true);

  const updateClipPath = useLastCallback(() => {
    const clipPathContainer = clipPathContainerRef.current;
    const activeTab = selectedIndex >= 0 && clipPathContainer?.childNodes[selectedIndex] as HTMLElement | null;

    if (clipPathContainer && activeTab && clipPathContainer.offsetWidth > 0) {
      const { offsetLeft, offsetWidth } = activeTab;
      const containerWidth = clipPathContainer.offsetWidth;
      const left = (offsetLeft / containerWidth * 100).toFixed(1);
      const right = ((containerWidth - (offsetLeft + offsetWidth)) / containerWidth * 100).toFixed(1);

      const newClipPath = `inset(0 ${right}% 0 ${left}% round 1rem)`;
      setClipPath(newClipPath);
    }
  });

  useEffect(() => {
    updateClipPath();
  }, [selectedIndex, items]);

  useResizeObserver(clipPathContainerRef, updateClipPath);

  if (!items.length) return undefined;

  return (
    <div
      ref={containerRef}
      className={
        buildClassName(
          styles.container,
          'no-scrollbar',
          className,
          clipPath && styles.isVisible,
        )
      }
    >
      {items.map((item) => (
        <AnimatedTabItem
          key={item.id}
          id={item.id}
          title={item.title}
          sticker={item.sticker}
          onClick={onItemSelect}
        />
      ))}

      <div
        ref={clipPathContainerRef}
        className={buildClassName(
          styles.clipPathContainer,
          'clip-path-container',
          !shouldAnimate && styles.noAnimation,
        )}
        style={clipPath ? `clip-path: ${clipPath}` : undefined}
        aria-hidden
      >
        {items.map((item, i) => (
          <AnimatedTabItem
            key={item.id}
            id={item.id}
            title={item.title}
            sticker={item.sticker}
            onClick={onItemSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(AnimatedTabList);
