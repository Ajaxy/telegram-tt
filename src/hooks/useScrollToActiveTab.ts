import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

import animateHorizontalScroll from '../util/animateHorizontalScroll';

const TAB_SCROLL_THRESHOLD_PX = 16;
const SCROLL_DURATION = 300;

export default function useScrollToActiveTab(
  containerRef: ElementRef<HTMLDivElement>,
  activeTab: number,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollWidth, offsetWidth, scrollLeft } = container;
    if (scrollWidth <= offsetWidth) return;

    const activeTabElement = container.childNodes[activeTab] as HTMLElement | undefined;
    if (!activeTabElement) return;

    const { offsetLeft, offsetWidth: tabWidth } = activeTabElement;
    const newLeft = offsetLeft - (offsetWidth / 2) + (tabWidth / 2);

    if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) return;

    animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
  }, [activeTab, containerRef]);
}
