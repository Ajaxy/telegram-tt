import { memo } from '../../../lib/teact/teact';

import type { TabWithProperties } from '../../ui/TabList';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import TabList from '../../ui/TabList';

import styles from './ChatFolderTabList.module.scss';

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  isHidden?: boolean;
  className?: string;
  onSwitchTab: (index: number) => void;
};

const ChatFolderTabList = ({
  tabs,
  activeTab,
  isHidden,
  className,
  onSwitchTab,
}: OwnProps) => {
  const renderExtra = useLastCallback((tab: TabWithProperties) => {
    if (!tab.badgeCount) return undefined;
    return (
      <span className={buildClassName(styles.badge, tab.isBadgeActive && styles.badgeActive)}>
        {tab.badgeCount}
      </span>
    );
  });

  return (
    <div className={buildClassName(styles.root, isHidden && styles.hidden)}>
      <TabList
        tabs={tabs}
        activeTab={activeTab}
        withFadeMask
        renderExtra={renderExtra}
        className={buildClassName(styles.tabList, className)}
        onSwitchTab={onSwitchTab}
      />
    </div>
  );
};

export default memo(ChatFolderTabList);
