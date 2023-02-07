import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiAttachBot, ApiChat, ApiUser } from '../../api/types';
import type { TabState } from '../../global/types';
import type { ThemeKey } from '../../types';
import type { PopupOptions, WebAppInboundEvent } from './hooks/useWebAppFrame';

import { TME_LINK_PREFIX } from '../../config';
import {
  selectCurrentChat, selectTabState, selectTheme, selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { extractCurrentThemeParams, validateHexColor } from '../../util/themeStyle';

import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useSyncEffect from '../../hooks/useSyncEffect';
import useWebAppFrame from './hooks/useWebAppFrame';
import usePrevious from '../../hooks/usePrevious';
import useFlag from '../../hooks/useFlag';
import useAppLayout from '../../hooks/useAppLayout';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Spinner from '../ui/Spinner';
import ConfirmDialog from '../ui/ConfirmDialog';

import styles from './WebAppModal.module.scss';

type WebAppButton = {
  isVisible: boolean;
  isActive: boolean;
  text: string;
  color: string;
  textColor: string;
  isProgressVisible: boolean;
};

export type OwnProps = {
  webApp?: TabState['webApp'];
};

type StateProps = {
  chat?: ApiChat;
  bot?: ApiUser;
  attachBot?: ApiAttachBot;
  theme?: ThemeKey;
  isPaymentModalOpen?: boolean;
  paymentStatus?: TabState['payment']['status'];
};

const NBSP = '\u00A0';

const MAIN_BUTTON_ANIMATION_TIME = 250;
const PROLONG_INTERVAL = 45000; // 45s
const ANIMATION_WAIT = 400;
const SANDBOX_ATTRIBUTES = [
  'allow-scripts',
  'allow-same-origin',
  'allow-popups',
  'allow-forms',
  'allow-modals',
  'allow-storage-access-by-user-activation',
].join(' ');

const DEFAULT_BUTTON_TEXT: Record<string, string> = {
  ok: 'OK',
  cancel: 'Cancel',
  close: 'Close',
};

const WebAppModal: FC<OwnProps & StateProps> = ({
  webApp,
  chat,
  bot,
  attachBot,
  theme,
  isPaymentModalOpen,
  paymentStatus,
}) => {
  const {
    closeWebApp,
    sendWebViewData,
    prolongWebView,
    toggleAttachBot,
    openTelegramLink,
    openChat,
    openInvoice,
    setWebAppPaymentSlug,
    showNotification,
  } = getActions();
  const [mainButton, setMainButton] = useState<WebAppButton | undefined>();
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(extractCurrentThemeParams().bg_color);
  const [headerColor, setHeaderColor] = useState(extractCurrentThemeParams().bg_color);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isCloseModalOpen, openCloseModal, closeCloseModal] = useFlag(false);
  const [isLoaded, markLoaded, markUnloaded] = useFlag(false);
  const [popupParams, setPopupParams] = useState<PopupOptions | undefined>();
  const { isMobile } = useAppLayout();
  const prevPopupParams = usePrevious(popupParams);
  const renderingPopupParams = popupParams || prevPopupParams;

  // eslint-disable-next-line no-null/no-null
  const frameRef = useRef<HTMLIFrameElement>(null);

  const lang = useLang();
  const {
    url, buttonText, queryId, replyToMessageId, threadId,
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

    if (eventType === 'web_app_open_tg_link' && !isPaymentModalOpen) {
      const linkUrl = TME_LINK_PREFIX + eventData.path_full;
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

    if (eventType === 'web_app_setup_closing_behavior') {
      setConfirmClose(eventData.need_confirmation);
    }

    if (eventType === 'web_app_open_popup') {
      if (!eventData.message.trim().length || !eventData.buttons?.length || eventData.buttons.length > 3) return;
      setPopupParams(eventData);
    }

    if (eventType === 'web_app_open_scan_qr_popup') {
      showNotification({
        message: 'Scan QR code is not supported in this client yet',
      });
    }
  }, [
    bot, buttonText, closeWebApp, openInvoice, openTelegramLink, sendWebViewData, setWebAppPaymentSlug,
    isPaymentModalOpen, showNotification,
  ]);

  const {
    reloadFrame, sendEvent, sendViewport, sendTheme,
  } = useWebAppFrame(frameRef, isOpen, isSimple, handleEvent, markLoaded);

  const shouldShowMainButton = mainButton?.isVisible && mainButton.text.trim().length > 0;

  useInterval(() => {
    prolongWebView({
      botId: bot!.id,
      queryId: queryId!,
      peerId: chat!.id,
      replyToMessageId,
      threadId,
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

  const handleClose = useCallback(() => {
    if (confirmClose) {
      openCloseModal();
    } else {
      closeWebApp();
    }
  }, [confirmClose, openCloseModal, closeWebApp]);

  const handlePopupClose = useCallback((buttonId?: string) => {
    setPopupParams(undefined);
    sendEvent({
      eventType: 'popup_closed',
      eventData: {
        button_id: buttonId,
      },
    });
  }, [sendEvent]);

  const handlePopupModalClose = useCallback(() => {
    handlePopupClose();
  }, [handlePopupClose]);

  // Notify view that height changed
  useSyncEffect(() => {
    setTimeout(() => {
      sendViewport();
    }, ANIMATION_WAIT);
  }, [mainButton?.isVisible, sendViewport]);

  // Notify view that theme changed
  useSyncEffect(() => {
    setTimeout(() => {
      sendTheme();
    }, ANIMATION_WAIT);
  }, [theme, sendTheme]);

  useSyncEffect(([prevIsPaymentModalOpen]) => {
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
  }, [isPaymentModalOpen, paymentStatus, sendEvent, setWebAppPaymentSlug, webApp]);

  const handleToggleClick = useCallback(() => {
    toggleAttachBot({
      botId: bot!.id,
      isEnabled: !attachBot,
    });
  }, [bot, attachBot, toggleAttachBot]);

  const handleBackClick = useCallback(() => {
    if (isBackButtonVisible) {
      sendEvent({
        eventType: 'back_button_pressed',
      });
    } else {
      handleClose();
    }
  }, [handleClose, isBackButtonVisible, sendEvent]);

  const openBotChat = useCallback(() => {
    openChat({
      id: bot!.id,
    });
    closeWebApp();
  }, [bot, closeWebApp, openChat]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClose(false);
      closeCloseModal();
      setPopupParams(undefined);
      markUnloaded();
    }
  }, [closeCloseModal, isOpen, markUnloaded]);

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, [isMobile]);

  const backButtonClassName = buildClassName(
    styles.closeIcon,
    isBackButtonVisible && styles.stateBack,
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
          {attachBot?.hasSettings && (
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
        </DropdownMenu>
      </div>
    );
  }, [
    lang, handleBackClick, bot, MoreMenuButton, chat, openBotChat, handleRefreshClick, attachBot,
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
      className={styles.root}
      isOpen={isOpen}
      onClose={handleClose}
      header={header}
      hasCloseButton
      style={`background-color: ${backgroundColor}`}
    >
      <Spinner className={buildClassName(styles.loadingSpinner, isLoaded && styles.hide)} />
      {isOpen && (
        <>
          <iframe
            className={buildClassName(styles.frame, shouldDecreaseWebFrameSize && styles.withButton)}
            src={url}
            title={`${bot?.firstName} Web App`}
            sandbox={SANDBOX_ATTRIBUTES}
            allow="camera; microphone; geolocation;"
            allowFullScreen
            ref={frameRef}
          />
          <Button
            className={buildClassName(
              styles.mainButton,
              shouldShowMainButton && styles.visible,
              shouldHideButton && styles.hidden,
            )}
            style={`background-color: ${mainButtonCurrentColor}; color: ${mainButtonCurrentTextColor}`}
            disabled={!mainButtonCurrentIsActive}
            onClick={handleMainButtonClick}
          >
            {mainButtonCurrentText}
            {mainButton?.isProgressVisible && <Spinner className={styles.mainButtonSpinner} color="white" />}
          </Button>
        </>
      )}
      {confirmClose && (
        <ConfirmDialog
          isOpen={isCloseModalOpen}
          onClose={closeCloseModal}
          title={lang('lng_bot_close_warning_title')}
          text={lang('lng_bot_close_warning')}
          confirmHandler={closeWebApp}
          confirmIsDestructive
          confirmLabel={lang('lng_bot_close_warning_sure')}
        />
      )}
      {renderingPopupParams && (
        <Modal
          isOpen={Boolean(popupParams)}
          title={renderingPopupParams.title || NBSP}
          onClose={handlePopupModalClose}
          hasCloseButton
          className={
            buildClassName(styles.webAppPopup, !renderingPopupParams.title?.trim().length && styles.withoutTitle)
          }
        >
          {renderingPopupParams.message}
          <div className="dialog-buttons mt-2">
            {renderingPopupParams.buttons.map((button) => (
              <Button
                key={button.id || button.type}
                className="confirm-dialog-button"
                color={button.type === 'destructive' ? 'danger' : 'primary'}
                isText
                size="smaller"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => handlePopupClose(button.id)}
              >
                {button.text || lang(DEFAULT_BUTTON_TEXT[button.type])}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { webApp }): StateProps => {
    const { botId } = webApp || {};
    const attachBot = botId ? global.attachMenu.bots[botId] : undefined;
    const bot = botId ? selectUser(global, botId) : undefined;
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);
    const { isPaymentModalOpen, status } = selectTabState(global).payment;

    return {
      attachBot,
      bot,
      chat,
      theme,
      isPaymentModalOpen,
      paymentStatus: status,
    };
  },
)(WebAppModal));
