import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { TabWithProperties } from './SquareTabList';

export type { TabWithProperties };

import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';

import Icon from '../common/icons/Icon';

import styles from './TabList.module.scss';

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  className?: string;
  onSwitchTab: (index: number) => void;
};

const TabList = ({
  tabs,
  activeTab,
  className,
  onSwitchTab,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const clipPathContainerRef = useRef<HTMLDivElement>();
  const [clipPath, setClipPath] = useState<string>('');

  useHorizontalScroll(containerRef, !tabs.length, true);

  const updateClipPath = useLastCallback(() => {
    const clipPathContainer = clipPathContainerRef.current;
    const activeTabEl = activeTab >= 0 && clipPathContainer?.childNodes[activeTab] as HTMLElement | undefined;

    if (clipPathContainer && activeTabEl && clipPathContainer.offsetWidth > 0) {
      const { offsetLeft, offsetWidth } = activeTabEl;
      const containerWidth = clipPathContainer.offsetWidth;
      const left = (offsetLeft / containerWidth * 100).toFixed(1);
      const right = ((containerWidth - (offsetLeft + offsetWidth)) / containerWidth * 100).toFixed(1);

      setClipPath(`inset(0.25rem ${right}% 0.25rem ${left}% round 1.25rem)`);
    }
  });

  useEffect(() => {
    updateClipPath();
  }, [activeTab, tabs]);

  useResizeObserver(clipPathContainerRef, updateClipPath);

  const handleTabClick = useLastCallback((index: number) => {
    onSwitchTab(index);
  });

  if (!tabs.length) return undefined;

  const renderTab = (tab: TabWithProperties, index: number) => (
    <div
      key={tab.id ?? index}
      className={styles.tab}
      onClick={() => handleTabClick(index)}
    >
      {tab.title}
      {tab.isBlocked && <Icon name="lock-badge" className={styles.lockIcon} />}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.container, className, clipPath && styles.ready)}
    >
      {tabs.map(renderTab)}

      <div
        ref={clipPathContainerRef}
        className={styles.activeIndicator}
        style={clipPath ? `clip-path: ${clipPath}` : undefined}
        aria-hidden
      >
        {tabs.map(renderTab)}
      </div>
    </div>
  );
};

export default memo(TabList);
