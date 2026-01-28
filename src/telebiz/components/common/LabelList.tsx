import { memo, useEffect, useRef } from '@teact';

import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import { IS_ANDROID, IS_IOS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';

import Button from '../../../components/ui/Button';

type Label = {
  id: string;
  title: string;
  isActive: boolean;
};

type OwnProps = {
  labels: readonly Label[];
  activeLabel: number;
  className?: string;
  labelClassName?: string;
  activeClassName?: string;
  onSwitchLabel: (index: number) => void;
};

const TAB_SCROLL_THRESHOLD_PX = 16;
// Should match duration from `--slide-transition` CSS variable
const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

const LabelList = ({
  labels,
  activeLabel,
  className,
  labelClassName,
  onSwitchLabel,
  activeClassName,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();

  useHorizontalScroll(containerRef, undefined, true);

  // Scroll container to place active label in the center
  useEffect(() => {
    const container = containerRef.current!;
    const { scrollWidth, offsetWidth, scrollLeft } = container;
    if (scrollWidth <= offsetWidth) {
      return;
    }

    const activeLabelElement = container.childNodes[activeLabel] as HTMLElement | null;
    if (!activeLabelElement) {
      return;
    }

    const { offsetLeft: activeTabOffsetLeft, offsetWidth: activeTabOffsetWidth } = activeLabelElement;
    const newLeft = activeTabOffsetLeft - (offsetWidth / 2) + (activeTabOffsetWidth / 2);

    // Prevent scrolling by only a couple of pixels, which doesn't look smooth
    if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
      return;
    }

    animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
  }, [activeLabel]);

  return (
    <div
      className={buildClassName('LabelList', 'no-scrollbar', className)}
      ref={containerRef}
    >
      {labels.map((label, i) => (
        <Button
          size="tiny"
          color="translucent"
          pill
          fluid
          onClick={() => onSwitchLabel(i)}
          className={buildClassName(
            labelClassName,
            'active',
            label.id === activeLabel.toString() && activeClassName,
          )}
        >
          {label.title}
        </Button>
      ))}
    </div>
  );
};

export default memo(LabelList);
