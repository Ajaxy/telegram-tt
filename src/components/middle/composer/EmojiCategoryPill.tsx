import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';

import Button from '../../ui/Button';

import styles from './EmojiCategoryPill.module.scss';

export type PillCategory = {
  id: string;
  name: string;
  icon: IconName;
};

type OwnProps = {
  categories: PillCategory[];
  activeCategoryIndex?: number;
  isActive?: boolean;
  className?: string;
  onCategorySelect: (index: number) => void;
};

const BUTTON_WIDTH = 2.25 * REM;

const EmojiCategoryPill = ({
  categories,
  activeCategoryIndex,
  isActive,
  className,
  onCategorySelect,
}: OwnProps) => {
  const stripRef = useRef<HTMLDivElement>();

  useHorizontalScroll(stripRef, undefined, true, true);

  useEffect(() => {
    requestMeasure(() => {
      const strip = stripRef.current;
      if (!strip) {
        return;
      }

      if (!isActive) {
        animateHorizontalScroll(strip, 0);
        return;
      }

      if (activeCategoryIndex === undefined) {
        return;
      }

      const newLeft = activeCategoryIndex * BUTTON_WIDTH - strip.offsetWidth / 2 + BUTTON_WIDTH / 2;
      animateHorizontalScroll(strip, newLeft);
    });
  }, [isActive, activeCategoryIndex]);

  return (
    <div className={buildClassName(styles.root, className, isActive && styles.expanded)}>
      <div ref={stripRef} className={buildClassName(styles.strip, 'no-scrollbar')}>
        {categories.map((category, index) => (
          <Button
            key={category.id}
            className={buildClassName(
              'symbol-set-button',
              styles.categoryButton,
              index === 0 && styles.firstCategory,
              isActive && index === activeCategoryIndex && 'activated',
            )}
            round
            faded
            color="translucent"
            tabIndex={!isActive && index !== 0 ? -1 : undefined}
            onClick={() => onCategorySelect(index)}
            ariaLabel={category.name}
            iconName={category.icon}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(EmojiCategoryPill);
