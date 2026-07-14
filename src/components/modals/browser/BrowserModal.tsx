import Color from 'colorjs.io';
import {
  memo, useEffect,
  useMemo, useRef,
  useSignal, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiAttachBot, ApiChat, ApiUser, ApiWebPageFull } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { Point, Size, ThemeKey } from '../../../types';
import type { BrowserTab } from '../../../types/browser';
import type { WebAppOutboundEvent } from '../../../types/webapp';

import {
  INSTANT_VIEW_FONT_SIZE_ADJUST_DEFAULT,
  INSTANT_VIEW_FONT_SIZE_ADJUST_MAX,
  INSTANT_VIEW_FONT_SIZE_ADJUST_MIN,
  INSTANT_VIEW_FONT_SIZE_ADJUST_STEP,
  RESIZE_HANDLE_CLASS_NAME,
} from '../../../config';
import { getWebAppKey } from '../../../global/helpers/bots';
import {
  selectCurrentChat, selectFullWebPage, selectTheme, selectUser,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { copyTextToClipboard } from '../../../util/clipboard';
import { getColorLuma } from '../../../util/colors';
import { formatPercent } from '../../../util/textFormat';
import windowSize from '../../../util/windowSize';

import useInterval from '../../../hooks/schedulers/useInterval';
import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useDraggable from '../../../hooks/useDraggable';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import InstantViewTab from './InstantViewTab';
import MinimizedBrowserModal from './MinimizedBrowserModal';
import MoreAppsTabContent from './MoreAppsTabContent';
import WebAppTab from './WebAppTab';

import styles from './BrowserModal.module.scss';

type BrowserModalTab = {
  bot?: ApiUser;
  browserTab: BrowserTab;
  webPage?: ApiWebPageFull;
  key: string;
  isOpen: boolean;
};

type MoreMenuButtonProps = {
  isOpen?: boolean;
  onTrigger: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
};

export type OwnProps = {
  modal?: TabState['browser'];
};

type StateProps = {
  chat?: ApiChat;
  bot?: ApiUser;
  attachBot?: ApiAttachBot;
  theme?: ThemeKey;
  cachedSize?: Size;
  cachedPosition?: Point;
  instantViewFontSizeAdjust: number;
};

const PROLONG_INTERVAL = 45000; // 45s
const LUMA_THRESHOLD = 128;
const IV_FONT_SIZE_ADJUST_PRECISION = 10;
const IV_FONT_SIZE_ADJUST_TO_PERCENTAGE = 100;

const MINIMIZED_STATE_SIZE = { width: 300, height: 40 };
const DEFAULT_MAXIMIZED_STATE_SIZE = { width: 420, height: 730 };
const MAXIMIZED_STATE_MINIMUM_SIZE = { width: 300, height: 300 };

const BrowserModal = ({
  modal,
  chat,
  bot,
  attachBot,
  theme,
  cachedSize,
  cachedPosition,
  instantViewFontSizeAdjust,
}: OwnProps & StateProps) => {
  const {
    closeBrowserTab,
    closeBrowserModal,
    prolongWebView,
    toggleAttachBot,
    openChat,
    openUrl,
    showNotification,
    setSharedSettingOption,
    changeBrowserModalState,
    openBrowserTab,
    updateWebApp,
    openMoreAppsTab,
    closeMoreAppsTab,
    updateBrowserCachedPosition,
    updateBrowserCachedSize,
  } = getActions();

  const [getMaximizedStateSize, setMaximizedStateSize] = useSignal(cachedSize || DEFAULT_MAXIMIZED_STATE_SIZE);

  function getSize() {
    if (modal?.modalState === 'fullScreen') return windowSize.get();
    if (modal?.modalState === 'maximized') return getMaximizedStateSize();
    return MINIMIZED_STATE_SIZE;
  }
  function getMinimumSize() {
    if (modal?.modalState === 'maximized') return MAXIMIZED_STATE_MINIMUM_SIZE;
    return undefined;
  }

  const {
    openedTabs, activeTabKey, openedOrderedKeys, sessionKeys, isMoreAppsTabActive,
  } = modal || {};
  const activeBrowserTab = activeTabKey ? openedTabs?.[activeTabKey] : undefined;
  const activeWebApp = activeBrowserTab?.type === 'webApp' ? activeBrowserTab.webApp : undefined;
  const instantViewFontSizePercentage = getInstantViewFontSizePercentage(instantViewFontSizeAdjust);
  const {
    isBackButtonVisible, headerColor, backgroundColor, isSettingsButtonVisible,
  } = activeWebApp || {};

  const tabs = useMemo(() => {
    return openedOrderedKeys?.reduce<BrowserModalTab[]>((acc, key) => {
      const browserTab = openedTabs![key];
      if (!browserTab) return acc;
      const global = getGlobal();
      const tabBot = browserTab.type === 'webApp' ? global.users.byId[browserTab.webApp.botId] : undefined;
      const webPage = browserTab.type === 'instantView' ? selectFullWebPage(global, browserTab.webPageId) : undefined;
      acc.push({
        bot: tabBot,
        browserTab,
        webPage,
        key,
        isOpen: key === activeTabKey,
      });
      return acc;
    }, []);
  }, [openedOrderedKeys, openedTabs, activeTabKey]);
  const activeTab = tabs?.find((tab) => tab.isOpen);
  const activeInstantViewUrl = activeTab?.browserTab.type === 'instantView' ? activeTab.webPage?.url : undefined;

  const { isMobile } = useAppLayout();
  const isOpen = modal?.isModalOpen || false;
  const isMaximizedState = modal?.modalState === 'maximized';
  const isMinimizedState = modal?.modalState === 'minimized';
  const isFullScreen = modal?.modalState === 'fullScreen';
  const shouldSkipNextMaximizedSizeCacheRef = useRef(false);

  if (isFullScreen) {
    shouldSkipNextMaximizedSizeCacheRef.current = true;
  }

  const supportMultiTabMode = !isMobile;
  const ref = useRef<HTMLDivElement>();
  const headerRef = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();

  const getTriggerElement = useLastCallback(() => ref.current!);

  const getRootElement = useLastCallback(
    () => ref.current!,
  );

  const getMenuElement = useLastCallback(
    () => menuRef.current!,
  );

  const {
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);

  const headerElement = headerRef.current;
  const containerElement = ref.current;

  useEffect(() => {
    setIsDraggingEnabled(Boolean(supportMultiTabMode && headerElement && containerElement && !isFullScreen));
  }, [supportMultiTabMode, headerElement, containerElement, isFullScreen]);

  useEffect(() => {
    changeBrowserModalState({ state: 'maximized' });
  }, [supportMultiTabMode]);

  const {
    isDragging,
    isResizing,
    style: draggableStyle,
    size,
    position,
  } = useDraggable(
    ref,
    headerRef,
    isDraggingEnabled,
    getSize(),
    isFullScreen,
    getMinimumSize(),
    cachedPosition,
  );

  const x = position?.x;
  const y = position?.y;
  useEffect(() => {
    if (!isDragging && x !== undefined && y !== undefined) {
      updateBrowserCachedPosition({ position: { x, y } });
    }
  }, [isDragging, x, y]);

  useEffect(() => {
    if (!isDragging && size && isMaximizedState) {
      if (shouldSkipNextMaximizedSizeCacheRef.current) {
        shouldSkipNextMaximizedSizeCacheRef.current = false;
        return;
      }

      updateBrowserCachedSize({ size });
    }
  }, [isDragging, isMaximizedState, size]);

  const currentSize = size || getSize();

  const currentWidth = currentSize.width;
  const currentHeight = currentSize.height;

  useEffect(() => {
    if (isResizing) {
      setMaximizedStateSize({ width: currentWidth, height: currentHeight });
    }
  }, [currentHeight, currentWidth, isResizing, setMaximizedStateSize]);

  const oldLang = useOldLang();
  const lang = useLang();

  const openTabsCount = openedTabs ? Object.values(openedTabs).length : 0;
  const hasWebViewToProlong = useMemo(() => {
    return openedTabs && Object.values(openedTabs).some((tab) => {
      return tab.type === 'webApp' && Boolean(tab.webApp.queryId);
    });
  }, [openedTabs]);

  useInterval(() => {
    if (!openedTabs) return;
    Object.entries(openedTabs).forEach(([key, tab]) => {
      if (tab.type !== 'webApp') return;
      const { webApp } = tab;
      const { queryId: webAppQueryId } = webApp;
      const peerId = webApp.isJoinChat ? webApp.peerId : (webApp.peerId || chat?.id);
      if (!webAppQueryId || !peerId) return;

      prolongWebView({
        key,
        botId: webApp.botId,
        queryId: webAppQueryId,
        peerId,
        replyInfo: webApp.replyInfo,
      });
    });
  }, hasWebViewToProlong ? PROLONG_INTERVAL : undefined, true);

  // eslint-disable-next-line no-null/no-null
  const sendEventCallbackRef = useRef<((event: WebAppOutboundEvent) => void) | null>(null);
  // eslint-disable-next-line no-null/no-null
  const reloadFrameCallbackRef = useRef<((url: string) => void) | null>(null);

  const registerSendEventCallback = useLastCallback((callback: (event: WebAppOutboundEvent) => void) => {
    sendEventCallbackRef.current = callback;
  });

  const sendEvent = useLastCallback((event: WebAppOutboundEvent) => {
    if (sendEventCallbackRef.current) {
      sendEventCallbackRef.current(event);
    }
  });

  const registerReloadFrameCallback = useLastCallback((callback: (url: string) => void) => {
    reloadFrameCallbackRef.current = callback;
  });

  const reloadFrame = useLastCallback((url: string) => {
    if (reloadFrameCallbackRef.current) {
      reloadFrameCallbackRef.current(url);
    }
  });

  const handleSettingsButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'settings_button_pressed',
    });
  });

  const handleRefreshClick = useLastCallback(() => {
    if (!activeWebApp) return;

    reloadFrame(activeWebApp.url);
  });

  const handleModalClose = useLastCallback(() => {
    closeBrowserModal();
  });

  const handleCloseMoreAppsTab = useLastCallback(() => {
    closeMoreAppsTab();
  });

  const handleTabClose = useLastCallback(() => {
    if (openTabsCount > 1 && activeTabKey) {
      closeBrowserTab({ key: activeTabKey });
    } else {
      closeBrowserModal();
    }
  });

  const handleToggleClick = useLastCallback(() => {
    if (attachBot) {
      const key = getWebAppKey(activeWebApp!);
      updateWebApp({
        key,
        update: {
          isRemoveModalOpen: true,
        },
      });
      return;
    }

    toggleAttachBot({
      botId: bot!.id,
      isEnabled: true,
    });
  });

  const handleBackClick = useLastCallback(() => {
    if (isBackButtonVisible) {
      sendEvent({
        eventType: 'back_button_pressed',
      });
    } else {
      handleModalClose();
    }
  });

  const handleCollapseClick = useLastCallback(() => {
    changeBrowserModalState({ state: 'minimized' });
  });

  const handleFullscreenClick = useLastCallback(() => {
    changeBrowserModalState({ state: 'fullScreen' });
  });

  const handleOpenMoreAppsTabClick = useLastCallback(() => {
    openMoreAppsTab();
  });

  const handleTabClick = useLastCallback((tab: BrowserModalTab) => {
    openBrowserTab({ tab: tab.browserTab });
  });

  const handleDecreaseInstantViewFontSize = useLastCallback(() => {
    updateInstantViewFontSizeAdjust(-INSTANT_VIEW_FONT_SIZE_ADJUST_STEP);
  });

  const handleIncreaseInstantViewFontSize = useLastCallback(() => {
    updateInstantViewFontSizeAdjust(INSTANT_VIEW_FONT_SIZE_ADJUST_STEP);
  });

  const handleOpenInstantViewUrl = useLastCallback(() => {
    if (!activeInstantViewUrl) return;

    handleContextMenuClose();
    openUrl({ url: activeInstantViewUrl, shouldSkipModal: true, ignoreDeepLinks: true });
  });

  const handleCopyInstantViewUrl = useLastCallback(() => {
    if (!activeInstantViewUrl) return;

    copyTextToClipboard(activeInstantViewUrl);
    showNotification({ message: lang('LinkCopied') });
    handleContextMenuClose();
  });

  const handleInstantViewTabClose = useLastCallback(() => {
    handleContextMenuClose();
    handleTabClose();
  });

  const openBotChat = useLastCallback(() => {
    openChat({
      id: bot!.id,
    });
  });

  const MoreMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }: MoreMenuButtonProps) => (
      <Button
        className={
          buildClassName(
            supportMultiTabMode ? styles.tabMoreButton : styles.moreButton,
            isMenuOpen && 'active',
          )
        }
        round
        ripple={!isMobile}
        size={supportMultiTabMode ? 'tiny' : 'smaller'}
        color="translucent"
        onClick={onTrigger}
        ariaLabel={lang('AriaMoreButton')}
        iconName="more"
      />
    );
  }, [isMobile, lang, supportMultiTabMode]);

  function updateInstantViewFontSizeAdjust(delta: number) {
    if (activeBrowserTab?.type !== 'instantView') return;

    setSharedSettingOption({
      instantViewFontSizeAdjust: getLimitedInstantViewFontSizeAdjust(instantViewFontSizeAdjust + delta),
    });
  }

  function renderWebAppMenuItems() {
    return (
      <>
        {chat && bot && chat.id !== bot.id && (
          <MenuItem icon="bots" onClick={openBotChat}>{oldLang('BotWebViewOpenBot')}</MenuItem>
        )}
        <MenuItem icon="reload" onClick={handleRefreshClick}>{oldLang('WebApp.ReloadPage')}</MenuItem>
        {isSettingsButtonVisible && (
          <MenuItem icon="settings" onClick={handleSettingsButtonClick}>
            {oldLang('Settings')}
          </MenuItem>
        )}
        {bot?.isAttachBot && (
          <MenuItem
            icon={attachBot ? 'stop' : 'install'}
            onClick={handleToggleClick}
            destructive={Boolean(attachBot)}
          >
            {oldLang(attachBot ? 'WebApp.RemoveBot' : 'WebApp.AddToAttachmentAdd')}
          </MenuItem>
        )}
      </>
    );
  }

  function renderInstantViewMenuItems() {
    const isMinimumFontSize = instantViewFontSizeAdjust <= INSTANT_VIEW_FONT_SIZE_ADJUST_MIN;
    const isMaximumFontSize = instantViewFontSizeAdjust >= INSTANT_VIEW_FONT_SIZE_ADJUST_MAX;

    return (
      <>
        <div className={styles.fontSizeRow}>
          <button
            type="button"
            className={styles.fontSizeButton}
            aria-label={lang('MediaZoomOut')}
            title={lang('MediaZoomOut')}
            disabled={isMinimumFontSize}
            onClick={handleDecreaseInstantViewFontSize}
          >
            <Icon name="char" character="A" />
          </button>
          <span className={styles.fontSizeValue}>{formatPercent(instantViewFontSizePercentage, 0)}</span>
          <button
            type="button"
            className={buildClassName(styles.fontSizeButton, styles.fontSizeButtonLarge)}
            aria-label={lang('MediaZoomIn')}
            title={lang('MediaZoomIn')}
            disabled={isMaximumFontSize}
            onClick={handleIncreaseInstantViewFontSize}
          >
            <Icon name="char" character="A" />
          </button>
        </div>
        <MenuItem icon="open-in-new-tab" disabled={!activeInstantViewUrl} onClick={handleOpenInstantViewUrl}>
          {lang('ChatListOpenInNewTab')}
        </MenuItem>
        <MenuItem icon="copy" disabled={!activeInstantViewUrl} onClick={handleCopyInstantViewUrl}>
          {lang('CopyLink')}
        </MenuItem>
        <MenuItem icon="close" onClick={handleInstantViewTabClose}>
          {oldLang('Close')}
        </MenuItem>
      </>
    );
  }

  function renderMenuItems() {
    if (activeBrowserTab?.type === 'instantView') return renderInstantViewMenuItems();

    return renderWebAppMenuItems();
  }

  function renderMoreMenu() {
    return (
      <Menu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        ref={menuRef}
        className={buildClassName(
          supportMultiTabMode ? styles.webAppTabMoreMenu : 'web-app-more-menu',
          'with-menu-transitions',
        )}
        getTriggerElement={getTriggerElement}
        getMenuElement={getMenuElement}
        getRootElement={getRootElement}
        autoClose={activeBrowserTab?.type !== 'instantView'}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
      >
        {renderMenuItems()}
      </Menu>
    );
  }

  function renderDropdownMoreMenu() {
    return (
      <DropdownMenu
        className={buildClassName(
          supportMultiTabMode ? styles.webAppTabMoreMenu : 'web-app-more-menu',
          'with-menu-transitions',
        )}
        trigger={MoreMenuButton}
        positionX={supportMultiTabMode ? 'left' : 'right'}
      >
        {renderMenuItems()}
      </DropdownMenu>
    );
  }

  const backButtonClassName = buildClassName(
    styles.closeIcon,
    isBackButtonVisible && styles.stateBack,
  );

  const headerTextVar = useMemo(() => {
    if (isMoreAppsTabActive) return 'color-text';
    if (!headerColor) return undefined;
    const luma = getColorLuma(new Color(headerColor));
    const adaptedLuma = theme === 'dark' ? 255 - luma : luma;
    return adaptedLuma > LUMA_THRESHOLD ? 'color-text' : 'color-background';
  }, [headerColor, theme, isMoreAppsTabActive]);
  function renderTabCurveBorder(className: string) {
    return (
      <svg
        className={className}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          className={styles.tabButtonCurvePath}
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M16 16V0C16 12 12 16 0 16H16Z"
        />
      </svg>
    );
  }

  function renderActiveTab(key: string) {
    const isActiveTabWebApp = activeTab?.browserTab.type === 'webApp';
    const style = buildStyle(
      headerTextVar && `--color-header-text: var(--${headerTextVar})`,
      headerColor && `--active-tab-background: ${headerColor}`,
    );
    return (
      <div
        key={key}
        className={styles.tabButtonWrapper}
        style={style}
      >
        {renderTabCurveBorder(styles.tabButtonLeftCurve)}
        <div
          className={styles.tabButton}
        >
          <div className={styles.avatarContainer}>
            {isActiveTabWebApp ? (
              <>
                <Avatar
                  size="mini"
                  peer={bot}
                />
                <MoreMenuButton onTrigger={handleContextMenu} isOpen={isContextMenuOpen} />
              </>
            ) : (
              <>
                <div className={styles.tabIcon}>
                  <Icon name="boost" />
                </div>
                <MoreMenuButton onTrigger={handleContextMenu} isOpen={isContextMenuOpen} />
              </>
            )}
          </div>
          {getBrowserTabTitle(activeTab, attachBot)}
          <div className={styles.tabRightMask} />
          <Button
            className={styles.tabCloseButton}
            round
            color="translucent"
            size="tiny"
            iconName="close"
            iconClassName={styles.tabCloseIcon}
            ariaLabel={oldLang('Close')}
            onClick={handleTabClose}
          />
        </div>
        {renderTabCurveBorder(styles.tabButtonRightCurve)}
      </div>
    );
  }

  function renderMoreAppsTab() {
    return (
      <div
        className={styles.tabButtonWrapper}
      >
        {renderTabCurveBorder(styles.tabButtonLeftCurve)}
        <div
          className={styles.tabButton}
        >
          <div className={styles.moreAppsTabIcon}>
            <Icon className={styles.icon} name="add" />
          </div>
          {lang('OpenApp')}
          <div className={styles.tabRightMask} />
          <Button
            className={styles.tabCloseButton}
            round
            color="translucent"
            size="tiny"
            iconName="close"
            iconClassName={styles.tabCloseIcon}
            ariaLabel={oldLang('Close')}
            onClick={handleCloseMoreAppsTab}
          />
        </div>
        {renderTabCurveBorder(styles.tabButtonRightCurve)}
      </div>
    );
  }

  function renderMoreAppsButton() {
    return (
      <Button
        className={buildClassName(
          styles.moreAppsButton,
          'no-drag',
        )}
        round
        color="translucent"
        size="tiny"
        onClick={handleOpenMoreAppsTabClick}
        iconName="add"
        iconClassName={styles.icon}
      />
    );
  }

  const containerRef = useRef<HTMLDivElement>();
  useHorizontalScroll(containerRef, !isOpen || isMinimizedState || !(containerRef.current));

  function renderTabs() {
    return (
      <div
        className={styles.tabs}
        ref={containerRef}
      >
        {tabs?.map((tab) => (
          tab.isOpen ? (
            renderActiveTab(tab.key)
          ) : tab.browserTab.type === 'instantView' ? (
            <div
              key={tab.key}
              className={buildClassName(styles.tabIcon, styles.tabAvatar)}
              onClick={() => handleTabClick(tab)}
            >
              <Icon name="boost" />
            </div>
          ) : (
            <Avatar
              key={tab.key}
              className={styles.tabAvatar}
              size="mini"
              peer={tab.bot}

              onClick={() => handleTabClick(tab)}
            />
          )
        ))}
        {isMoreAppsTabActive && renderMoreAppsTab()}
      </div>
    );
  }

  function renderHeader() {
    return (
      <div
        ref={headerRef}
      >
        {!supportMultiTabMode
          ? renderSinglePageModeHeader()
          : (isMaximizedState ? renderMultiTabHeader() : <MinimizedBrowserModal />)}
      </div>
    );
  }

  function renderMultiTabHeader() {
    return (
      <div
        className={buildClassName(
          'modal-header',
          'multiTab',
        )}
        style={buildStyle(
          headerTextVar && `--color-header-text: var(--${headerTextVar})`,
        )}
      >
        <Button
          className={styles.headerButton}
          round
          color="translucent"
          size="tiny"
          ariaLabel={oldLang(isBackButtonVisible ? 'Back' : 'Close')}
          onClick={handleBackClick}
        >
          <div className={backButtonClassName} />
        </Button>
        {renderTabs()}
        {activeBrowserTab && renderMoreMenu()}

        <div className={styles.toolBar}>
          {!isMoreAppsTabActive && renderMoreAppsButton()}

          {!isMoreAppsTabActive && activeWebApp && (
            <Button
              className={buildClassName(
                styles.windowStateButton,
                styles.fullscreenButton,
                'no-drag',
              )}
              round
              color="translucent"
              size="tiny"
              onClick={handleFullscreenClick}
              iconName="expand-modal"
              iconClassName={styles.stateIcon}
            />
          )}

          <Button
            className={buildClassName(
              styles.windowStateButton,
              'no-drag',
            )}
            round
            color="translucent"
            size="tiny"
            onClick={handleCollapseClick}
            iconClassName={styles.stateIcon}
            iconName="collapse-modal"
          />
        </div>
      </div>
    );
  }

  function renderSinglePageModeHeader() {
    return (
      <div
        className="modal-header"
        style={buildStyle(
          headerColor && `background-color: ${headerColor}`,
          headerTextVar && `--color-header-text: var(--${headerTextVar})`,
        )}
      >
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={oldLang(isBackButtonVisible ? 'Back' : 'Close')}
          onClick={handleBackClick}
        >
          <div className={backButtonClassName} />
        </Button>
        <div className="modal-title">{getBrowserTabTitle(activeTab, attachBot)}</div>
        {!isMoreAppsTabActive && activeWebApp && renderDropdownMoreMenu()}
      </div>
    );
  }

  function buildResizeHandleClass(handleClassName: string) {
    return buildClassName(RESIZE_HANDLE_CLASS_NAME, handleClassName);
  }

  function renderResizeHandles() {
    return (
      <>
        <div className={buildResizeHandleClass('top')} />
        <div className={buildResizeHandleClass('bottom')} />
        <div className={buildResizeHandleClass('left')} />
        <div className={buildResizeHandleClass('right')} />
        <div className={buildResizeHandleClass('topLeft')} />
        <div className={buildResizeHandleClass('topRight')} />
        <div className={buildResizeHandleClass('bottomLeft')} />
        <div className={buildResizeHandleClass('bottomRight')} />
      </>
    );
  }

  return (
    <Modal
      dialogRef={ref}
      className={buildClassName(
        styles.root,
        supportMultiTabMode && styles.multiTab,
        isMinimizedState && styles.minimized,
        isFullScreen && styles.fullScreen,
      )}
      dialogClassName="browser-modal-dialog"
      dialogStyle={supportMultiTabMode ? draggableStyle : undefined}
      dialogContent={isDraggingEnabled && !isMinimizedState ? renderResizeHandles() : undefined}
      isOpen={isOpen}
      isLowStackPriority
      onClose={handleModalClose}
      header={renderHeader()}
      style={`background-color: ${backgroundColor || 'var(--color-background)'}`}
      noBackdrop
      noBackdropClose
    >
      {isFullScreen && activeWebApp && renderMoreMenu()}
      {openedTabs && sessionKeys?.map((key) => {
        const browserTab = openedTabs[key];
        if (!browserTab) return undefined;

        return browserTab.type === 'webApp' ? (
          <WebAppTab
            key={key}
            modal={modal}
            isActive={key === activeTabKey}
            registerSendEventCallback={registerSendEventCallback}
            registerReloadFrameCallback={registerReloadFrameCallback}
            webApp={browserTab.webApp}
            isTransforming={isDragging || isResizing}
            onContextMenuButtonClick={handleContextMenu}
            isMultiTabSupported={supportMultiTabMode}
            modalHeight={currentHeight}
          />
        ) : (
          <InstantViewTab
            key={key}
            webPageId={browserTab.webPageId}
            fontSizeAdjust={instantViewFontSizeAdjust}
            isActive={key === activeTabKey}
          />
        );
      })}
      {isMoreAppsTabActive && (<MoreAppsTabContent />)}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const activeBrowserTab = modal?.activeTabKey ? modal.openedTabs[modal.activeTabKey] : undefined;
    const activeWebApp = activeBrowserTab?.type === 'webApp' ? activeBrowserTab.webApp : undefined;
    const { botId: activeBotId } = activeWebApp || {};

    const attachBot = activeBotId ? global.attachMenu.bots[activeBotId] : undefined;
    const bot = activeBotId ? selectUser(global, activeBotId) : undefined;
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);
    const { browserCachedPosition, browserCachedSize, instantViewFontSizeAdjust } = selectSharedSettings(global);

    return {
      attachBot,
      bot,
      chat,
      theme,
      cachedPosition: browserCachedPosition,
      cachedSize: browserCachedSize,
      instantViewFontSizeAdjust,
    };
  },
)(BrowserModal));

function getBrowserTabTitle(tab?: BrowserModalTab, attachBot?: ApiAttachBot) {
  if (!tab) return undefined;

  if (tab.browserTab.type === 'webApp') {
    return attachBot?.shortName ?? tab.bot?.firstName;
  }

  return tab.webPage?.title || tab.webPage?.siteName || tab.webPage?.displayUrl;
}

function getLimitedInstantViewFontSizeAdjust(fontSizeAdjust: number) {
  return Math.max(
    INSTANT_VIEW_FONT_SIZE_ADJUST_MIN,
    Math.min(
      INSTANT_VIEW_FONT_SIZE_ADJUST_MAX,
      Math.round(fontSizeAdjust * IV_FONT_SIZE_ADJUST_PRECISION) / IV_FONT_SIZE_ADJUST_PRECISION,
    ),
  );
}

function getInstantViewFontSizePercentage(fontSizeAdjust: number) {
  return Math.round(
    (fontSizeAdjust / INSTANT_VIEW_FONT_SIZE_ADJUST_DEFAULT) * IV_FONT_SIZE_ADJUST_TO_PERCENTAGE,
  );
}
