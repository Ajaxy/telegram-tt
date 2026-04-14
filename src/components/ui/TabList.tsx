import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { TabWithProperties } from './SquareTabList';

export type { TabWithProperties };

import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';

import styles from './TabList.module.scss';

const EMOJI_SIZE = 20;

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  className?: string;
  tabClassName?: string;
  indicatorClassName?: string;
  centered?: boolean;
  stretched?: boolean;
  itemAlignment?: 'vertical' | 'horizontal';
  onSwitchTab: (index: number) => void;
};

const TabList = ({
  tabs,
  activeTab,
  className,
  tabClassName,
  indicatorClassName,
  centered,
  stretched,
  itemAlignment,
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

      setClipPath(`inset(0.25rem ${right}% 0.25rem ${left}% round var(--tab-radius))`);
    } else if (activeTab < 0) {
      setClipPath('inset(0 100% 0 100%)');
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

  const renderTab = (tab: TabWithProperties, index: number) => {
    const stringEmoticon = typeof tab.emoticon === 'string' ? tab.emoticon : undefined;
    const customEmoji = typeof tab.emoticon === 'object' ? tab.emoticon : undefined;

    return (
      <div
        key={tab.id ?? index}
        className={buildClassName(
          styles.tab,
          tabClassName,
          itemAlignment === 'vertical' && styles.vertical,
          stretched && styles.stretched,
        )}
        onClick={() => handleTabClick(index)}
      >
        {stringEmoticon && <span className={styles.tabEmoji}>{stringEmoticon}</span>}
        {customEmoji && (
          <CustomEmoji
            documentId={customEmoji.documentId}
            className={styles.tabEmoji}
            size={EMOJI_SIZE}
            shouldNotLoop
          />
        )}
        {tab.icon && <Icon name={tab.icon} className={styles.tabIcon} />}
        {tab.title}
        {tab.isBlocked && <Icon name="lock-badge" className={styles.lockIcon} />}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={buildClassName(
        styles.container,
        centered && styles.centered,
        itemAlignment === 'vertical' && styles.vertical,
        className,
        clipPath && styles.ready,
      )}
    >
      {tabs.map(renderTab)}

      <div
        ref={clipPathContainerRef}
        className={buildClassName(styles.activeIndicator,
          centered && styles.centered,
          stretched && styles.stretched,
          indicatorClassName)}
        style={clipPath ? `clip-path: ${clipPath}` : undefined}
        aria-hidden
      >
        {tabs.map(renderTab)}
      </div>
    </div>
  );
};

export default memo(TabList);
