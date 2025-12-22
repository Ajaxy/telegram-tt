import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { ApiMessageEntityCustomEmoji } from '../../api/types';
import type { MenuItemContextAction } from './ListItem';

import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import { IS_ANDROID, IS_IOS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import Tab from './Tab';

import './TabList.scss';

export type TabWithProperties = {
  id?: number;
  title: TeactNode;
  badgeCount?: number;
  isBlocked?: boolean;
  isBadgeActive?: boolean;
  contextActions?: MenuItemContextAction[];
  emoticon?: string | ApiMessageEntityCustomEmoji;
  noTitleAnimations?: boolean;
};

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  className?: string;
  tabClassName?: string;
  contextRootElementSelector?: string;
  ref?: ElementRef<HTMLDivElement>;
  onSwitchTab: (index: number) => void;
};

const TAB_SCROLL_THRESHOLD_PX = 16;
// Should match duration from `--slide-transition` CSS variable
const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

const TabList = ({
  tabs,
  activeTab,
  className,
  tabClassName,
  contextRootElementSelector,
  ref,
  onSwitchTab,
}: OwnProps) => {
  let containerRef = useRef<HTMLDivElement>();
  if (ref) {
    containerRef = ref;
  }
  const previousActiveTab = usePreviousDeprecated(activeTab);

  const lang = useLang();

  useHorizontalScroll(containerRef, undefined, true);

  // Scroll container to place active tab in the center
  useEffect(() => {
    const container = containerRef.current!;
    const { scrollWidth, offsetWidth, scrollLeft } = container;
    if (scrollWidth <= offsetWidth) {
      return;
    }

    const activeTabElement = container.childNodes[activeTab] as HTMLElement | null;
    if (!activeTabElement) {
      return;
    }

    const { offsetLeft: activeTabOffsetLeft, offsetWidth: activeTabOffsetWidth } = activeTabElement;
    const newLeft = activeTabOffsetLeft - (offsetWidth / 2) + (activeTabOffsetWidth / 2);

    // Prevent scrolling by only a couple of pixels, which doesn't look smooth
    if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
      return;
    }

    animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
  }, [activeTab]);

  return (
    <div
      className={buildClassName('TabList', 'no-scrollbar', className)}
      ref={containerRef}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.id}
          title={tab.title}
          isActive={i === activeTab}
          isBlocked={tab.isBlocked}
          badgeCount={tab.badgeCount}
          isBadgeActive={tab.isBadgeActive}
          previousActiveTab={previousActiveTab}
          onClick={onSwitchTab}
          clickArg={i}
          contextActions={tab.contextActions}
          contextRootElementSelector={contextRootElementSelector}
          className={tabClassName}
        />
      ))}
    </div>
  );
};

export default memo(TabList);
