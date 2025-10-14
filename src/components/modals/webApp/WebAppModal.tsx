import { type MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect,
  useMemo, useRef,
  useSignal, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiAttachBot, ApiChat, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { Point, Size, ThemeKey } from '../../../types';
import type { WebApp, WebAppOutboundEvent } from '../../../types/webapp';

import { RESIZE_HANDLE_CLASS_NAME } from '../../../config';
import { getWebAppKey } from '../../../global/helpers/bots';
import {
  selectCurrentChat, selectTheme, selectUser,
  selectWebApp,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { getColorLuma, hex2rgbaObj } from '../../../util/colors';
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
import MinimizedWebAppModal from './MinimizedWebAppModal';
import MoreAppsTabContent from './MoreAppsTabContent';
import WebAppModalTabContent from './WebAppModalTabContent';

import styles from './WebAppModal.module.scss';

type WebAppModalTab = {
  bot?: ApiUser;
  webApp: WebApp;
  isOpen: boolean;
};

export type OwnProps = {
  modal?: TabState['webApps'];
};

type StateProps = {
  chat?: ApiChat;
  bot?: ApiUser;
  attachBot?: ApiAttachBot;
  theme?: ThemeKey;
  cachedSize?: Size;
  cachedPosition?: Point;
};

const PROLONG_INTERVAL = 45000; // 45s
const LUMA_THRESHOLD = 128;

const MINIMIZED_STATE_SIZE = { width: 300, height: 40 };
const DEFAULT_MAXIMIZED_STATE_SIZE = { width: 420, height: 730 };
const MAXIMIZED_STATE_MINIMUM_SIZE = { width: 300, height: 300 };

const WebAppModal: FC<OwnProps & StateProps> = ({
  modal,
  chat,
  bot,
  attachBot,
  theme,
  cachedSize,
  cachedPosition,
}) => {
  const {
    closeActiveWebApp,
    closeWebAppModal,
    prolongWebView,
    toggleAttachBot,
    openChat,
    changeWebAppModalState,
    openWebAppTab,
    updateWebApp,
    openMoreAppsTab,
    closeMoreAppsTab,
    updateMiniAppCachedPosition,
    updateMiniAppCachedSize,
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
    openedWebApps, activeWebAppKey, openedOrderedKeys, sessionKeys, isMoreAppsTabActive,
  } = modal || {};
  const activeWebApp = activeWebAppKey ? openedWebApps?.[activeWebAppKey] : undefined;
  const {
    isBackButtonVisible, headerColor, backgroundColor, isSettingsButtonVisible,
  } = activeWebApp || {};

  const tabs = useMemo(() => {
    return openedOrderedKeys?.map((key) => {
      const webApp = openedWebApps![key];
      return {
        bot: getGlobal().users.byId[webApp.botId],
        webApp,
        isOpen: Boolean(activeWebApp && (key === getWebAppKey(activeWebApp))),
      };
    });
  }, [openedOrderedKeys, openedWebApps, activeWebApp]);

  const { isMobile } = useAppLayout();
  const isOpen = modal?.isModalOpen || false;
  const isMaximizedState = modal?.modalState === 'maximized';
  const isMinimizedState = modal?.modalState === 'minimized';
  const isFullScreen = modal?.modalState === 'fullScreen';

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
    changeWebAppModalState({ state: 'maximized' });
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
      updateMiniAppCachedPosition({ position: { x, y } });
    }
  }, [isDragging, x, y]);

  useEffect(() => {
    if (!isDragging && size && isMaximizedState) {
      updateMiniAppCachedSize({ size });
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
  const {
    queryId,
  } = activeWebApp || {};

  const openTabsCount = openedWebApps ? Object.values(openedWebApps).length : 0;

  useInterval(() => {
    if (!openedWebApps) return;
    Object.keys(openedWebApps).forEach((key) => {
      const webApp = openedWebApps[key];
      if (webApp.queryId) {
        prolongWebView({
          botId: webApp.botId,
          queryId: webApp.queryId,
          peerId: webApp.peerId || chat!.id,
          replyInfo: webApp.replyInfo,
        });
      }
    });
  }, queryId ? PROLONG_INTERVAL : undefined, true);

  // eslint-disable-next-line no-null/no-null
  const sendEventCallback = useRef<((event: WebAppOutboundEvent) => void) | null>(null);
  // eslint-disable-next-line no-null/no-null
  const reloadFrameCallback = useRef<((url: string) => void) | null>(null);

  const registerSendEventCallback = useLastCallback((callback: (event: WebAppOutboundEvent) => void) => {
    sendEventCallback.current = callback;
  });

  const sendEvent = useLastCallback((event: WebAppOutboundEvent) => {
    if (sendEventCallback.current) {
      sendEventCallback.current(event);
    }
  });

  const registerReloadFrameCallback = useLastCallback((callback: (url: string) => void) => {
    reloadFrameCallback.current = callback;
  });

  const reloadFrame = useLastCallback((url: string) => {
    if (reloadFrameCallback.current) {
      reloadFrameCallback.current(url);
    }
  });

  const handleSettingsButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'settings_button_pressed',
    });
  });

  const handleRefreshClick = useLastCallback(() => {
    reloadFrame(activeWebApp!.url);
  });

  const handleModalClose = useLastCallback(() => {
    closeWebAppModal();
  });

  const handleCloseMoreAppsTab = useLastCallback(() => {
    closeMoreAppsTab();
  });

  const handleTabClose = useLastCallback(() => {
    if (openTabsCount > 1) {
      closeActiveWebApp();
    } else {
      closeWebAppModal();
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
    changeWebAppModalState({ state: 'minimized' });
  });

  const handleFullscreenClick = useLastCallback(() => {
    changeWebAppModalState({ state: 'fullScreen' });
  });

  const handleOpenMoreAppsTabClick = useLastCallback(() => {
    openMoreAppsTab();
  });

  const handleTabClick = useLastCallback((tab: WebAppModalTab) => {
    openWebAppTab({ webApp: tab.webApp });
  });

  const openBotChat = useLastCallback(() => {
    openChat({
      id: bot!.id,
    });
  });

  const MoreMenuButton:
  FC<{ onTrigger: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
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
        ariaLabel="More actions"
      >
        <Icon name="more" />
      </Button>
    );
  }, [isMobile, supportMultiTabMode]);

  function renderMenuItems() {
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
        autoClose
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
    const { r, g, b } = hex2rgbaObj(headerColor);
    const luma = getColorLuma([r, g, b]);
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

  function renderActiveTab() {
    const style = buildStyle(
      headerTextVar && `--color-header-text: var(--${headerTextVar})`,
      headerColor && `--active-tab-background: ${headerColor}`,
    );
    return (
      <div
        className={styles.tabButtonWrapper}
        style={style}
      >
        {renderTabCurveBorder(styles.tabButtonLeftCurve)}
        <div
          className={styles.tabButton}
        >
          <div className={styles.avatarContainer}>
            <Avatar
              size="mini"
              peer={bot}
            />
            <MoreMenuButton onTrigger={handleContextMenu} isOpen={isContextMenuOpen} />
          </div>
          {attachBot?.shortName ?? bot?.firstName}
          <div className={styles.tabRightMask} />
          <Button
            className={styles.tabCloseButton}
            round
            color="translucent"
            size="tiny"
            ariaLabel={oldLang('Close')}
            onClick={handleTabClose}
          >
            <Icon className={styles.tabCloseIcon} name="close" />
          </Button>
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
            ariaLabel={oldLang('Close')}
            onClick={handleCloseMoreAppsTab}
          >
            <Icon className={styles.tabCloseIcon} name="close" />
          </Button>
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
      >
        <Icon className={styles.icon} name="add" />
      </Button>
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
            renderActiveTab()
          ) : (
            <Avatar
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
          : (isMaximizedState ? renderMultiTabHeader() : <MinimizedWebAppModal />)}
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
        {renderMoreMenu()}

        <div className={styles.toolBar}>
          {!isMoreAppsTabActive && renderMoreAppsButton()}

          {!isMoreAppsTabActive && (
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
            >
              <Icon className={styles.stateIcon} name="expand-modal" />
            </Button>
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
          >
            <Icon className={styles.stateIcon} name="collapse-modal" />
          </Button>
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
        <div className="modal-title">{attachBot?.shortName ?? bot?.firstName}</div>
        {!isMoreAppsTabActive && renderDropdownMoreMenu()}
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
      {isFullScreen && renderMoreMenu()}
      {openedWebApps && sessionKeys?.map((key) => (
        <WebAppModalTabContent
          key={key}
          modal={modal}
          registerSendEventCallback={registerSendEventCallback}
          registerReloadFrameCallback={registerReloadFrameCallback}
          webApp={openedWebApps[key]}
          isTransforming={isDragging || isResizing}
          onContextMenuButtonClick={handleContextMenu}
          isMultiTabSupported={supportMultiTabMode}
          modalHeight={currentHeight}
        />
      ))}
      {isMoreAppsTabActive && (<MoreAppsTabContent />)}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const activeWebApp = modal?.activeWebAppKey ? selectWebApp(global, modal.activeWebAppKey) : undefined;
    const { botId: activeBotId } = activeWebApp || {};

    const attachBot = activeBotId ? global.attachMenu.bots[activeBotId] : undefined;
    const bot = activeBotId ? selectUser(global, activeBotId) : undefined;
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);
    const { miniAppsCachedPosition, miniAppsCachedSize } = selectSharedSettings(global);

    return {
      attachBot,
      bot,
      chat,
      theme,
      cachedPosition: miniAppsCachedPosition,
      cachedSize: miniAppsCachedSize,
    };
  },
)(WebAppModal));
