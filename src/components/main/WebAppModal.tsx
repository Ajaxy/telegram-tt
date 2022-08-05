import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiAttachMenuBot, ApiChat, ApiUser } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { ThemeKey } from '../../types';

import windowSize from '../../util/windowSize';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentChat, selectTheme, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { extractCurrentThemeParams, validateHexColor } from '../../util/themeStyle';

import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useOnChange from '../../hooks/useOnChange';
import type { WebAppInboundEvent } from './hooks/useWebAppFrame';
import useWebAppFrame from './hooks/useWebAppFrame';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Spinner from '../ui/Spinner';

import './WebAppModal.scss';

type WebAppButton = {
  isVisible: boolean;
  isActive: boolean;
  text: string;
  color: string;
  textColor: string;
  isProgressVisible: boolean;
};

export type OwnProps = {
  webApp?: GlobalState['webApp'];
};

type StateProps = {
  chat?: ApiChat;
  bot?: ApiUser;
  attachMenuBot?: ApiAttachMenuBot;
  theme?: ThemeKey;
  isPaymentModalOpen?: boolean;
  paymentStatus?: GlobalState['payment']['status'];
};

const MAIN_BUTTON_ANIMATION_TIME = 250;
const PROLONG_INTERVAL = 45000; // 45s
const ANIMATION_WAIT = 400;
const LINK_PREFIX = 'https://t.me/';
const SANDBOX_ATTRIBUTES = [
  'allow-scripts',
  'allow-same-origin',
  'allow-popups',
  'allow-forms',
  'allow-modals',
  'allow-storage-access-by-user-activation',
].join(' ');

const WebAppModal: FC<OwnProps & StateProps> = ({
  webApp,
  chat,
  bot,
  attachMenuBot,
  theme,
  isPaymentModalOpen,
  paymentStatus,
}) => {
  const {
    closeWebApp,
    sendWebViewData,
    prolongWebView,
    toggleBotInAttachMenu,
    openTelegramLink,
    openChat,
    openInvoice,
    setWebAppPaymentSlug,
  } = getActions();
  const [mainButton, setMainButton] = useState<WebAppButton | undefined>();
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(extractCurrentThemeParams().bg_color);
  const [headerColor, setHeaderColor] = useState(extractCurrentThemeParams().bg_color);
  const lang = useLang();
  const {
    url, buttonText, queryId,
  } = webApp || {};
  const isOpen = Boolean(url);
  const isSimple = !queryId;

  const handleEvent = useCallback((event: WebAppInboundEvent) => {
    const { eventType, eventData } = event;
    if (eventType === 'web_app_close') {
      closeWebApp();
    }

    if (eventType === 'web_app_open_invoice') {
      setWebAppPaymentSlug({
        slug: eventData.slug,
      });
      openInvoice({
        slug: eventData.slug,
      });
    }

    if (eventType === 'web_app_open_tg_link') {
      const linkUrl = LINK_PREFIX + eventData.path_full;
      openTelegramLink({ url: linkUrl });
      closeWebApp();
    }

    if (eventType === 'web_app_open_link') {
      const linkUrl = eventData.url;
      window.open(linkUrl, '_blank', 'noreferrer');
    }

    if (eventType === 'web_app_setup_back_button') {
      setIsBackButtonVisible(eventData.is_visible);
    }

    if (eventType === 'web_app_set_background_color') {
      const themeParams = extractCurrentThemeParams();
      const color = validateHexColor(eventData.color) ? eventData.color : themeParams.bg_color;
      setBackgroundColor(color);
    }

    if (eventType === 'web_app_set_header_color') {
      const themeParams = extractCurrentThemeParams();
      const key = eventData.color_key;
      const newColor = themeParams[key];
      const color = validateHexColor(newColor) ? newColor : themeParams.bg_color;
      setHeaderColor(color);
    }

    if (eventType === 'web_app_data_send') {
      closeWebApp();
      sendWebViewData({
        bot: bot!,
        buttonText: buttonText!,
        data: eventData.data,
      });
    }

    if (eventType === 'web_app_setup_main_button') {
      const themeParams = extractCurrentThemeParams();
      const color = validateHexColor(eventData.color) ? eventData.color : themeParams.button_color;
      const textColor = validateHexColor(eventData.text_color) ? eventData.text_color : themeParams.text_color;
      setMainButton({
        isVisible: eventData.is_visible && Boolean(eventData.text?.trim().length),
        isActive: eventData.is_active,
        text: eventData.text || '',
        color,
        textColor,
        isProgressVisible: eventData.is_progress_visible,
      });
    }
  }, [bot, buttonText, closeWebApp, openInvoice, openTelegramLink, sendWebViewData, setWebAppPaymentSlug]);

  const {
    ref, reloadFrame, sendEvent, sendViewport, sendTheme,
  } = useWebAppFrame(isOpen, isSimple, handleEvent);

  const shouldShowMainButton = mainButton?.isVisible && mainButton.text.trim().length > 0;

  useInterval(() => {
    prolongWebView({
      botId: bot!.id,
      queryId: queryId!,
      peerId: chat!.id,
    });
  }, queryId ? PROLONG_INTERVAL : undefined, true);

  const handleMainButtonClick = useCallback(() => {
    sendEvent({
      eventType: 'main_button_pressed',
    });
  }, [sendEvent]);

  const handleSettingsButtonClick = useCallback(() => {
    sendEvent({
      eventType: 'settings_button_pressed',
    });
  }, [sendEvent]);

  const handleRefreshClick = useCallback(() => {
    reloadFrame(webApp!.url);
  }, [reloadFrame, webApp]);

  // Notify view that height changed
  useOnChange(() => {
    setTimeout(() => {
      sendViewport();
    }, ANIMATION_WAIT);
  }, [mainButton?.isVisible, sendViewport]);

  // Notify view that theme changed
  useOnChange(() => {
    setTimeout(() => {
      sendTheme();
    }, ANIMATION_WAIT);
  }, [theme, sendTheme]);

  // Prevent refresh when rotating device
  useEffect(() => {
    if (!isOpen) return undefined;
    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [isOpen]);

  useOnChange(([prevIsPaymentModalOpen]) => {
    if (isPaymentModalOpen === prevIsPaymentModalOpen) return;
    if (webApp?.slug && !isPaymentModalOpen && paymentStatus) {
      sendEvent({
        eventType: 'invoice_closed',
        eventData: {
          slug: webApp.slug,
          status: paymentStatus,
        },
      });
      setWebAppPaymentSlug({
        slug: undefined,
      });
    }
  }, [isPaymentModalOpen, paymentStatus, sendEvent, setWebAppPaymentSlug, webApp] as const);

  const handleToggleClick = useCallback(() => {
    toggleBotInAttachMenu({
      botId: bot!.id,
      isEnabled: !attachMenuBot,
    });
  }, [bot, attachMenuBot, toggleBotInAttachMenu]);

  const handleBackClick = useCallback(() => {
    if (isBackButtonVisible) {
      sendEvent({
        eventType: 'back_button_pressed',
      });
    } else {
      closeWebApp();
    }
  }, [closeWebApp, isBackButtonVisible, sendEvent]);

  const openBotChat = useCallback(() => {
    openChat({
      id: bot!.id,
    });
    closeWebApp();
  }, [bot, closeWebApp, openChat]);

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  const backButtonClassName = buildClassName(
    'animated-close-icon',
    isBackButtonVisible && 'state-back',
  );

  const header = useMemo(() => {
    return (
      <div className="modal-header" style={`background-color: ${headerColor}`}>
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang(isBackButtonVisible ? 'Back' : 'Close')}
          onClick={handleBackClick}
        >
          <div className={backButtonClassName} />
        </Button>
        <div className="modal-title">{bot?.firstName}</div>
        <DropdownMenu
          className="web-app-more-menu"
          trigger={MoreMenuButton}
          positionX="right"
        >
          {chat && bot && chat.id !== bot.id && (
            <MenuItem icon="bots" onClick={openBotChat}>{lang('BotWebViewOpenBot')}</MenuItem>
          )}
          <MenuItem icon="reload" onClick={handleRefreshClick}>{lang('WebApp.ReloadPage')}</MenuItem>
          {bot?.isAttachMenuBot && (
            <MenuItem
              icon={attachMenuBot ? 'stop' : 'install'}
              onClick={handleToggleClick}
              destructive={Boolean(attachMenuBot)}
            >
              {lang(attachMenuBot ? 'WebApp.RemoveBot' : 'WebApp.AddToAttachmentAdd')}
            </MenuItem>
          )}
          {attachMenuBot?.hasSettings && (
            <MenuItem icon="settings" onClick={handleSettingsButtonClick}>
              {lang('Settings')}
            </MenuItem>
          )}
        </DropdownMenu>
      </div>
    );
  }, [
    lang, handleBackClick, bot, MoreMenuButton, chat, openBotChat, handleRefreshClick, attachMenuBot,
    handleToggleClick, handleSettingsButtonClick, isBackButtonVisible, headerColor, backButtonClassName,
  ]);

  const prevMainButtonColor = usePrevious(mainButton?.color, true);
  const prevMainButtonTextColor = usePrevious(mainButton?.textColor, true);
  const prevMainButtonIsActive = usePrevious(mainButton && Boolean(mainButton.isActive), true);
  const prevMainButtonText = usePrevious(mainButton?.text, true);

  const mainButtonCurrentColor = mainButton?.color || prevMainButtonColor;
  const mainButtonCurrentTextColor = mainButton?.textColor || prevMainButtonTextColor;
  const mainButtonCurrentIsActive = mainButton?.isActive !== undefined ? mainButton.isActive : prevMainButtonIsActive;
  const mainButtonCurrentText = mainButton?.text || prevMainButtonText;

  useEffect(() => {
    if (!isOpen) {
      const themeParams = extractCurrentThemeParams();
      setMainButton(undefined);
      setIsBackButtonVisible(false);
      setBackgroundColor(themeParams.bg_color);
      setHeaderColor(themeParams.bg_color);
    }
  }, [isOpen]);

  const [shouldDecreaseWebFrameSize, setShouldDecreaseWebFrameSize] = useState(false);
  const [shouldHideButton, setShouldHideButton] = useState(true);

  const buttonChangeTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (buttonChangeTimeout.current) clearTimeout(buttonChangeTimeout.current);
    if (!shouldShowMainButton) {
      setShouldDecreaseWebFrameSize(false);
      buttonChangeTimeout.current = setTimeout(() => {
        setShouldHideButton(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    } else {
      setShouldHideButton(false);
      buttonChangeTimeout.current = setTimeout(() => {
        setShouldDecreaseWebFrameSize(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }
  }, [setShouldDecreaseWebFrameSize, shouldShowMainButton]);

  return (
    <Modal
      className="WebAppModal"
      isOpen={isOpen}
      onClose={closeWebApp}
      header={header}
      hasCloseButton
      style={`background-color: ${backgroundColor}`}
    >
      {isOpen && (
        <>
          <iframe
            ref={ref}
            className={buildClassName('web-app-frame', shouldDecreaseWebFrameSize && 'with-button')}
            src={url}
            title={`${bot?.firstName} Web App`}
            sandbox={SANDBOX_ATTRIBUTES}
            allow="camera; microphone; geolocation;"
            allowFullScreen
          />
          <Button
            className={buildClassName(
              'web-app-button',
              shouldShowMainButton && 'visible',
              shouldHideButton && 'hidden',
            )}
            style={`background-color: ${mainButtonCurrentColor}; color: ${mainButtonCurrentTextColor}`}
            disabled={!mainButtonCurrentIsActive}
            onClick={handleMainButtonClick}
          >
            {mainButtonCurrentText}
            {mainButton?.isProgressVisible && <Spinner color="white" />}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { webApp }): StateProps => {
    const { botId } = webApp || {};
    const attachMenuBot = botId ? global.attachMenu.bots[botId] : undefined;
    const bot = botId ? selectUser(global, botId) : undefined;
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);
    const { isPaymentModalOpen, status } = global.payment;

    return {
      attachMenuBot,
      bot,
      chat,
      theme,
      isPaymentModalOpen,
      paymentStatus: status,
    };
  },
)(WebAppModal));
