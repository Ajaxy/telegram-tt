import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useRef } from '../../lib/teact/teact';

import type { ApiMessageEntityCustomEmoji } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { MenuItemContextAction } from './ListItem';

import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useScrollToActiveTab from '../../hooks/useScrollToActiveTab';

import Tab from './Tab';

import './SquareTabList.scss';

export type TabWithProperties = {
  id?: number;
  title: TeactNode;
  icon?: IconName;
  badgeCount?: number;
  isBlocked?: boolean;
  isBadgeActive?: boolean;
  contextActions?: MenuItemContextAction[];
  emoticon?: string | ApiMessageEntityCustomEmoji;
  customEmojiDocumentId?: string;
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

const SquareTabList = ({
  tabs,
  activeTab,
  className,
  tabClassName,
  contextRootElementSelector,
  ref,
  onSwitchTab,
}: OwnProps) => {
  const internalRef = useRef<HTMLDivElement>();
  const containerRef = ref || internalRef;
  const previousActiveTab = usePreviousDeprecated(activeTab);

  const lang = useLang();

  useHorizontalScroll(containerRef, undefined, true);
  useScrollToActiveTab(containerRef, activeTab);

  return (
    <div
      className={buildClassName('SquareTabList', 'no-scrollbar', className)}
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

export default memo(SquareTabList);
