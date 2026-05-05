import type { TeactNode } from '../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { IAnchorPosition } from '../../types';
import type { MenuItemContextAction } from './ListItem';
import type { TabWithProperties } from './SquareTabList';

export type { TabWithProperties };

import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useFlag from '../../hooks/useFlag';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';
import useScrollToActiveTab from '../../hooks/useScrollToActiveTab';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';

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
  withFadeMask?: boolean;
  fadeMaskClassName?: string;
  onSwitchTab: (index: number) => void;
  renderExtra?: (tab: TabWithProperties, index: number) => TeactNode;
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
  withFadeMask,
  fadeMaskClassName,
  renderExtra,
  onSwitchTab,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const clipPathContainerRef = useRef<HTMLDivElement>();
  const [clipPath, setClipPath] = useState<string>('');
  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>();
  const [menuTabIndex, setMenuTabIndex] = useState<number | undefined>();
  const menuTargetRef = useRef<HTMLElement>();

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

  useScrollToActiveTab(containerRef, activeTab);

  const handleTabClick = useLastCallback((index: number) => {
    onSwitchTab(index);
  });

  const handleContextMenu = useLastCallback((index: number, e: React.MouseEvent) => {
    const actions = tabs[index]?.contextActions;
    if (!actions?.length) return;
    e.preventDefault();
    menuTargetRef.current = e.currentTarget as HTMLElement;
    setMenuTabIndex(index);
    setMenuAnchor({ x: e.clientX, y: e.clientY });
    openMenu();
  });

  const handleMenuClose = useLastCallback(() => {
    closeMenu();
  });

  const handleMenuHide = useLastCallback(() => {
    setMenuAnchor(undefined);
    setMenuTabIndex(undefined);
  });

  const getTriggerElement = useLastCallback(() => menuTargetRef.current);
  const getRootElement = useLastCallback(() => containerRef.current);
  const getMenuElement = useLastCallback(
    () => containerRef.current?.querySelector<HTMLElement>('.TabList-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  if (!tabs.length) return undefined;

  const hasContextActions = tabs.some((tab) => tab.contextActions?.length);

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
        onContextMenu={hasContextActions ? (e) => handleContextMenu(index, e) : undefined}
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
        {typeof tab.title === 'string' ? renderText(tab.title) : tab.title}
        {renderExtra?.(tab, index)}
        {tab.isBlocked && <Icon name="lock-badge" className={styles.lockIcon} />}
      </div>
    );
  };

  const contextActions = menuTabIndex !== undefined ? tabs[menuTabIndex]?.contextActions : undefined;

  const tabListElement = (
    <div
      ref={containerRef}
      className={buildClassName(
        'TabList',
        styles.container,
        withFadeMask && styles.withFadeMask,
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

  const menuElement = contextActions && menuAnchor !== undefined && (
    <Menu
      isOpen={isMenuOpen}
      anchor={menuAnchor}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
      className="TabList-context-menu"
      autoClose
      onClose={handleMenuClose}
      onCloseAnimationEnd={handleMenuHide}
      withPortal
    >
      {contextActions.map((action: MenuItemContextAction) => (
        ('isSeparator' in action) ? (
          <MenuSeparator key={action.key || `separator-${contextActions.indexOf(action)}`} />
        ) : (
          <MenuItem
            key={action.title}
            icon={action.icon}
            destructive={action.destructive}
            disabled={!action.handler}
            onClick={action.handler}
          >
            {renderText(action.title)}
          </MenuItem>
        )
      ))}
    </Menu>
  );

  if (!withFadeMask) {
    return (
      <>
        {tabListElement}
        {menuElement}
      </>
    );
  }

  return (
    <>
      <div className={buildClassName(styles.fadeMaskWrapper, fadeMaskClassName)}>
        {tabListElement}
      </div>
      {menuElement}
    </>
  );
};

export default memo(TabList);
