import React, {
  FC, memo, useRef, useEffect,
} from '../../lib/teact/teact';

import fastSmoothScrollHorizontal from '../../util/fastSmoothScrollHorizontal';
import usePrevious from '../../hooks/usePrevious';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';

import Tab from './Tab';

import './TabList.scss';

export type TabWithProperties = {
  title: string;
  badgeCount?: number;
  isBadgeActive?: boolean;
};

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  big?: boolean;
  onSwitchTab: (index: number) => void;
};

const TAB_SCROLL_THRESHOLD_PX = 16;

const TabList: FC<OwnProps> = ({
  tabs, activeTab, big, onSwitchTab,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveTab = usePrevious(activeTab);

  useHorizontalScroll(containerRef);

  // Scroll container to place active tab in the center
  useEffect(() => {
    const container = containerRef.current!;
    if (container.scrollWidth <= container.offsetWidth) {
      return;
    }

    const activeTabElement = container.querySelector('.Tab.active') as HTMLElement | null;
    if (activeTabElement) {
      const newLeft = activeTabElement.offsetLeft - (container.offsetWidth / 2) + (activeTabElement.offsetWidth / 2);

      // Prevent scrolling by only a couple of pixels, which doesn't look smooth
      if (Math.abs(newLeft - container.scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
        return;
      }

      fastSmoothScrollHorizontal(container, newLeft);
    }
  }, [activeTab]);

  const lang = useLang();

  return (
    <div
      className={`TabList no-selection no-scrollbar ${big ? 'big' : ''}`}
      ref={containerRef}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.title}
          title={lang(tab.title)}
          active={i === activeTab}
          badgeCount={tab.badgeCount}
          isBadgeActive={tab.isBadgeActive}
          previousActiveTab={previousActiveTab}
          onClick={onSwitchTab}
          clickArg={i}
        />
      ))}
    </div>
  );
};

export default memo(TabList);
