import { type MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect,
  useMemo, useRef,
  useSignal, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiAttachBot, ApiChat, ApiUser } from '../../../api/types';
import type { TabState, WebApp } from '../../../global/types';
import type { ThemeKey } from '../../../types';
import type { WebAppOutboundEvent } from '../../../types/webapp';

import { getWebAppKey } from '../../../global/helpers/bots';
import {
  selectCurrentChat, selectTabState, selectTheme, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { getColorLuma } from '../../../util/colors';
import { hexToRgb } from '../../../util/switchTheme';

import useInterval from '../../../hooks/schedulers/useInterval';
import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useDraggable from '../../../hooks/useDraggable';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
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
  isPaymentModalOpen?: boolean;
  paymentStatus?: TabState['payment']['status'];
};

const PROLONG_INTERVAL = 45000; // 45s
const LUMA_THRESHOLD = 128;

const WebAppModal: FC<OwnProps & StateProps> = ({
  modal,
  chat,
  bot,
  attachBot,
  theme,
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
  } = getActions();

  const maximizedStateSize = useMemo(() => {
    return { width: 420, height: 730 };
  }, []);
  const minimizedStateSize = useMemo(() => {
    return { width: 300, height: 40 };
  }, []);
  const [getFrameSize, setFrameSize] = useSignal(
    { width: maximizedStateSize.width, height: maximizedStateSize.height - minimizedStateSize.height },
  );

  function getSize() {
    return modal?.modalState === 'maximized' ? maximizedStateSize : minimizedStateSize;
  }

  const {
    openedWebApps, activeWebApp, openedOrderedKeys, sessionKeys,
  } = modal || {};
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

  const supportMultiTabMode = !isMobile;
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);

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
    setIsDraggingEnabled(Boolean(supportMultiTabMode && headerElement && containerElement));
  }, [supportMultiTabMode, headerElement, containerElement]);

  const {
    isDragging,
    style: draggableStyle,
    size,
  } = useDraggable(ref, headerRef, isDraggingEnabled, getSize());

  const currentSize = size || getSize();

  const currentWidth = currentSize.width;
  const currentHeight = currentSize.height;
  useEffect(() => {
    if (currentHeight === minimizedStateSize.height && currentWidth === minimizedStateSize.width) return;
    if (isMaximizedState) {
      const height = currentHeight - minimizedStateSize.height;
      setFrameSize({ width: currentWidth, height });
    }
  }, [currentWidth, currentHeight, isMaximizedState, minimizedStateSize, setFrameSize]);

  const lang = useOldLang();
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

  const handleTabClose = useLastCallback(() => {
    if (openTabsCount > 1) {
      closeActiveWebApp();
    } else {
      closeWebAppModal();
    }
  });

  const handleToggleClick = useLastCallback(() => {
    if (attachBot) {
      updateWebApp({
        webApp: {
          ...activeWebApp!,
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
    changeWebAppModalState();
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
          <MenuItem icon="bots" onClick={openBotChat}>{lang('BotWebViewOpenBot')}</MenuItem>
        )}
        <MenuItem icon="reload" onClick={handleRefreshClick}>{lang('WebApp.ReloadPage')}</MenuItem>
        {isSettingsButtonVisible && (
          <MenuItem icon="settings" onClick={handleSettingsButtonClick}>
            {lang('Settings')}
          </MenuItem>
        )}
        {bot?.isAttachBot && (
          <MenuItem
            icon={attachBot ? 'stop' : 'install'}
            onClick={handleToggleClick}
            destructive={Boolean(attachBot)}
          >
            {lang(attachBot ? 'WebApp.RemoveBot' : 'WebApp.AddToAttachmentAdd')}
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
    if (!headerColor) return undefined;
    const { r, g, b } = hexToRgb(headerColor);
    const luma = getColorLuma([r, g, b]);
    const adaptedLuma = theme === 'dark' ? 255 - luma : luma;
    return adaptedLuma > LUMA_THRESHOLD ? 'color-text' : 'color-background';
  }, [headerColor, theme]);

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
            ariaLabel={lang('Close')}
            onClick={handleTabClose}
          >
            <Icon className={styles.tabCloseIcon} name="close" />
          </Button>
        </div>
        {renderTabCurveBorder(styles.tabButtonRightCurve)}
      </div>
    );
  }

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(containerRef, !isOpen || !isMaximizedState || !(containerRef.current));

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
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleTabClick(tab)}
            />
          )
        ))}
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
          ariaLabel={lang(isBackButtonVisible ? 'Back' : 'Close')}
          onClick={handleBackClick}
        >
          <div className={backButtonClassName} />
        </Button>
        {renderTabs()}
        {renderMoreMenu()}

        {/* <Button
          round
          color="translucent"
          size="tiny"
        >
          <Icon className={styles.icon} name="add" />
        </Button>
        */}

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
          ariaLabel={lang(isBackButtonVisible ? 'Back' : 'Close')}
          onClick={handleBackClick}
        >
          <div className={backButtonClassName} />
        </Button>
        <div className="modal-title">{attachBot?.shortName ?? bot?.firstName}</div>
        {renderDropdownMoreMenu()}
      </div>
    );
  }

  return (
    <Modal
      dialogRef={ref}
      className={buildClassName(
        styles.root,
        supportMultiTabMode && styles.multiTab,
        !isMaximizedState && styles.minimized,
      )}
      dialogStyle={supportMultiTabMode ? draggableStyle : undefined}
      isOpen={isOpen}
      isLowStackPriority
      onClose={handleModalClose}
      header={renderHeader()}
      style={`background-color: ${backgroundColor || 'var(--color-background)'}`}
      noBackdrop
      noBackdropClose
    >
      {openedWebApps && sessionKeys?.map((key) => (
        <WebAppModalTabContent
          key={key}
          modal={modal}
          registerSendEventCallback={registerSendEventCallback}
          registerReloadFrameCallback={registerReloadFrameCallback}
          webApp={openedWebApps[key]}
          isDragging={isDragging}
          frameSize={supportMultiTabMode ? getFrameSize() : undefined}
          isMultiTabSupported={supportMultiTabMode}
        />
      ))}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const { botId: activeBotId } = modal?.activeWebApp || {};

    const attachBot = activeBotId ? global.attachMenu.bots[activeBotId] : undefined;
    const bot = activeBotId ? selectUser(global, activeBotId) : undefined;
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);
    const { isPaymentModalOpen, status } = selectTabState(global).payment;
    const { isStarPaymentModalOpen } = selectTabState(global);

    return {
      attachBot,
      bot,
      chat,
      theme,
      isPaymentModalOpen: isPaymentModalOpen || isStarPaymentModalOpen,
      paymentStatus: status,
    };
  },
)(WebAppModal));
