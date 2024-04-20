import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAttachBot, ApiChat, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { ThemeKey } from '../../../types';
import type { PopupOptions, WebAppInboundEvent } from '../../../types/webapp';

import { TME_LINK_PREFIX } from '../../../config';
import { convertToApiChatType } from '../../../global/helpers';
import {
  selectCurrentChat, selectTabState, selectTheme, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { getColorLuma } from '../../../util/colors';
import { hexToRgb } from '../../../util/switchTheme';
import { extractCurrentThemeParams, validateHexColor } from '../../../util/themeStyle';
import { callApi } from '../../../api/gramjs';
import renderText from '../../common/helpers/renderText';

import useInterval from '../../../hooks/schedulers/useInterval';
import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevious from '../../../hooks/usePrevious';
import useSyncEffect from '../../../hooks/useSyncEffect';
import usePopupLimit from './hooks/usePopupLimit';
import useWebAppFrame from './hooks/useWebAppFrame';

import Icon from '../../common/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import Spinner from '../../ui/Spinner';

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
const POPUP_SEQUENTIAL_LIMIT = 3;
const LUMA_THRESHOLD = 128;
const POPUP_RESET_DELAY = 2000; // 2s
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
    setWebAppPaymentSlug,
    switchBotInline,
    sharePhoneWithBot,
  } = getActions();
  const [mainButton, setMainButton] = useState<WebAppButton | undefined>();
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false);
  const [isSettingsButtonVisible, setIsSettingsButtonVisible] = useState(false);

  const [backgroundColor, setBackgroundColor] = useState<string>();
  const [headerColor, setHeaderColor] = useState<string>();

  const [shouldConfirmClosing, setShouldConfirmClosing] = useState(false);
  const [isCloseModalOpen, openCloseModal, hideCloseModal] = useFlag(false);
  const [isRemoveModalOpen, openRemoveModal, hideRemoveModal] = useFlag(false);

  const [isLoaded, markLoaded, markUnloaded] = useFlag(false);

  const [popupParameters, setPopupParameters] = useState<PopupOptions | undefined>();
  const [isRequestingPhone, setIsRequestingPhone] = useState(false);
  const [isRequesingWriteAccess, setIsRequestingWriteAccess] = useState(false);
  const {
    unlockPopupsAt, handlePopupOpened, handlePopupClosed,
  } = usePopupLimit(POPUP_SEQUENTIAL_LIMIT, POPUP_RESET_DELAY);

  const { isMobile } = useAppLayout();

  useEffect(() => {
    const themeParams = extractCurrentThemeParams();
    setBackgroundColor(themeParams.bg_color);
    setHeaderColor(themeParams.bg_color);
  }, []);

  // eslint-disable-next-line no-null/no-null
  const frameRef = useRef<HTMLIFrameElement>(null);

  const lang = useLang();
  const {
    url, buttonText, queryId, replyInfo,
  } = webApp || {};
  const isOpen = Boolean(url);
  const isSimple = Boolean(buttonText);

  const {
    reloadFrame, sendEvent, sendViewport, sendTheme,
  } = useWebAppFrame(frameRef, isOpen, isSimple, handleEvent, markLoaded);

  const shouldShowMainButton = mainButton?.isVisible && mainButton.text.trim().length > 0;

  useInterval(() => {
    prolongWebView({
      botId: bot!.id,
      queryId: queryId!,
      peerId: chat!.id,
      replyInfo,
    });
  }, queryId ? PROLONG_INTERVAL : undefined, true);

  const handleMainButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'main_button_pressed',
    });
  });

  const handleSettingsButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'settings_button_pressed',
    });
  });

  const handleRefreshClick = useLastCallback(() => {
    reloadFrame(webApp!.url);
  });

  const handleClose = useLastCallback(() => {
    if (shouldConfirmClosing) {
      openCloseModal();
    } else {
      closeWebApp();
    }
  });

  const handleAppPopupClose = useLastCallback((buttonId?: string) => {
    setPopupParameters(undefined);
    handlePopupClosed();
    sendEvent({
      eventType: 'popup_closed',
      eventData: {
        button_id: buttonId,
      },
    });
  });

  const handleAppPopupModalClose = useLastCallback(() => {
    handleAppPopupClose();
  });

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

  const handleRemoveAttachBot = useLastCallback(() => {
    toggleAttachBot({
      botId: bot!.id,
      isEnabled: false,
    });
    closeWebApp();
  });

  const handleToggleClick = useLastCallback(() => {
    if (attachBot) {
      openRemoveModal();
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
      handleClose();
    }
  });

  const handleRejectPhone = useLastCallback(() => {
    setIsRequestingPhone(false);
    handlePopupClosed();
    sendEvent({
      eventType: 'phone_requested',
      eventData: {
        status: 'cancelled',
      },
    });
  });

  const handleAcceptPhone = useLastCallback(() => {
    sharePhoneWithBot({ botId: bot!.id });
    setIsRequestingPhone(false);
    handlePopupClosed();
    sendEvent({
      eventType: 'phone_requested',
      eventData: {
        status: 'sent',
      },
    });
  });

  const handleRejectWriteAccess = useLastCallback(() => {
    sendEvent({
      eventType: 'write_access_requested',
      eventData: {
        status: 'cancelled',
      },
    });
    setIsRequestingWriteAccess(false);
    handlePopupClosed();
  });

  const handleAcceptWriteAccess = useLastCallback(async () => {
    const result = await callApi('allowBotSendMessages', { bot: bot! });
    if (!result) {
      handleRejectWriteAccess();
      return;
    }

    sendEvent({
      eventType: 'write_access_requested',
      eventData: {
        status: 'allowed',
      },
    });
    setIsRequestingWriteAccess(false);
    handlePopupClosed();
  });

  async function handleRequestWriteAccess() {
    const canWrite = await callApi('fetchBotCanSendMessage', {
      bot: bot!,
    });

    if (canWrite) {
      sendEvent({
        eventType: 'write_access_requested',
        eventData: {
          status: 'allowed',
        },
      });
    }

    setIsRequestingWriteAccess(!canWrite);
  }

  async function handleInvokeCustomMethod(requestId: string, method: string, parameters: string) {
    const result = await callApi('invokeWebViewCustomMethod', {
      bot: bot!,
      customMethod: method,
      parameters,
    });

    sendEvent({
      eventType: 'custom_method_invoked',
      eventData: {
        req_id: requestId,
        ...result,
      },
    });
  }

  const openBotChat = useLastCallback(() => {
    openChat({
      id: bot!.id,
    });
    closeWebApp();
  });

  useEffect(() => {
    if (!isOpen) {
      const themeParams = extractCurrentThemeParams();

      setShouldConfirmClosing(false);
      hideCloseModal();
      hideRemoveModal();
      setPopupParameters(undefined);
      setIsRequestingPhone(false);
      setIsRequestingWriteAccess(false);
      setMainButton(undefined);
      setIsBackButtonVisible(false);
      setIsSettingsButtonVisible(false);
      setBackgroundColor(themeParams.bg_color);
      setHeaderColor(themeParams.bg_color);
      markUnloaded();
    }
  }, [isOpen]);

  function handleEvent(event: WebAppInboundEvent) {
    const { eventType, eventData } = event;
    if (eventType === 'web_app_open_tg_link' && !isPaymentModalOpen) {
      const linkUrl = TME_LINK_PREFIX + eventData.path_full;
      openTelegramLink({ url: linkUrl });
      closeWebApp();
    }

    if (eventType === 'web_app_setup_back_button') {
      setIsBackButtonVisible(eventData.is_visible);
    }

    if (eventType === 'web_app_setup_settings_button') {
      setIsSettingsButtonVisible(eventData.is_visible);
    }

    if (eventType === 'web_app_set_background_color') {
      const themeParams = extractCurrentThemeParams();
      const color = validateHexColor(eventData.color) ? eventData.color : themeParams.bg_color;
      setBackgroundColor(color);
    }

    if (eventType === 'web_app_set_header_color') {
      if (eventData.color_key) {
        const themeParams = extractCurrentThemeParams();
        const key = eventData.color_key;
        const newColor = themeParams[key];
        const color = validateHexColor(newColor) ? newColor : headerColor;
        setHeaderColor(color);
      }

      if (eventData.color) {
        const color = validateHexColor(eventData.color) ? eventData.color : headerColor;
        setHeaderColor(color);
      }
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
      setShouldConfirmClosing(eventData.need_confirmation);
    }

    if (eventType === 'web_app_open_popup') {
      if (popupParameters || !eventData.message.trim().length || !eventData.buttons?.length
      || eventData.buttons.length > 3 || isRequestingPhone || isRequesingWriteAccess
      || unlockPopupsAt > Date.now()) {
        handleAppPopupClose(undefined);
        return;
      }

      setPopupParameters(eventData);
      handlePopupOpened();
    }

    if (eventType === 'web_app_switch_inline_query') {
      const filter = eventData.chat_types?.map(convertToApiChatType).filter(Boolean);
      const isSamePeer = !filter?.length;

      switchBotInline({
        botId: bot!.id,
        query: eventData.query,
        filter,
        isSamePeer,
      });

      closeWebApp();
    }

    if (eventType === 'web_app_request_phone') {
      if (popupParameters || isRequesingWriteAccess || unlockPopupsAt > Date.now()) {
        handleRejectPhone();
        return;
      }

      setIsRequestingPhone(true);
      handlePopupOpened();
    }

    if (eventType === 'web_app_request_write_access') {
      if (popupParameters || isRequestingPhone || unlockPopupsAt > Date.now()) {
        handleRejectWriteAccess();
        return;
      }

      handleRequestWriteAccess();
      handlePopupOpened();
    }

    if (eventType === 'web_app_invoke_custom_method') {
      const { method, params, req_id: requestId } = eventData;
      handleInvokeCustomMethod(requestId, method, JSON.stringify(params));
    }
  }

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={buildClassName(styles.moreButton, isMenuOpen && 'active')}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <Icon name="more" />
      </Button>
    );
  }, [isMobile]);

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

  function renderHeader() {
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
        <DropdownMenu
          className="web-app-more-menu with-menu-transitions"
          trigger={MoreMenuButton}
          positionX="right"
        >
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
        </DropdownMenu>
      </div>
    );
  }

  const prevMainButtonColor = usePrevious(mainButton?.color, true);
  const prevMainButtonTextColor = usePrevious(mainButton?.textColor, true);
  const prevMainButtonIsActive = usePrevious(mainButton && Boolean(mainButton.isActive), true);
  const prevMainButtonText = usePrevious(mainButton?.text, true);

  const mainButtonCurrentColor = mainButton?.color || prevMainButtonColor;
  const mainButtonCurrentTextColor = mainButton?.textColor || prevMainButtonTextColor;
  const mainButtonCurrentIsActive = mainButton?.isActive !== undefined ? mainButton.isActive : prevMainButtonIsActive;
  const mainButtonCurrentText = mainButton?.text || prevMainButtonText;

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
      header={renderHeader()}
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
      <ConfirmDialog
        isOpen={isRequestingPhone}
        onClose={handleRejectPhone}
        title={lang('ShareYouPhoneNumberTitle')}
        text={lang('AreYouSureShareMyContactInfoBot')}
        confirmHandler={handleAcceptPhone}
        confirmLabel={lang('ContactShare')}
      />
      <ConfirmDialog
        isOpen={isRequesingWriteAccess}
        onClose={handleRejectWriteAccess}
        title={lang('lng_bot_allow_write_title')}
        text={lang('lng_bot_allow_write')}
        confirmHandler={handleAcceptWriteAccess}
        confirmLabel={lang('lng_bot_allow_write_confirm')}
      />
      {popupParameters && (
        <Modal
          isOpen={Boolean(popupParameters)}
          title={popupParameters.title || NBSP}
          onClose={handleAppPopupModalClose}
          hasCloseButton
          className={
            buildClassName(styles.webAppPopup, !popupParameters.title?.trim().length && styles.withoutTitle)
          }
        >
          {popupParameters.message}
          <div className="dialog-buttons mt-2">
            {popupParameters.buttons.map((button) => (
              <Button
                key={button.id || button.type}
                className="confirm-dialog-button"
                color={button.type === 'destructive' ? 'danger' : 'primary'}
                isText
                size="smaller"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => handleAppPopupClose(button.id)}
              >
                {button.text || lang(DEFAULT_BUTTON_TEXT[button.type])}
              </Button>
            ))}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={isCloseModalOpen}
        onClose={hideCloseModal}
        title={lang('lng_bot_close_warning_title')}
        text={lang('lng_bot_close_warning')}
        confirmHandler={closeWebApp}
        confirmIsDestructive
        confirmLabel={lang('lng_bot_close_warning_sure')}
      />
      <ConfirmDialog
        isOpen={isRemoveModalOpen}
        onClose={hideRemoveModal}
        title={lang('BotRemoveFromMenuTitle')}
        textParts={renderText(lang('BotRemoveFromMenu', bot?.firstName), ['simple_markdown'])}
        confirmHandler={handleRemoveAttachBot}
        confirmIsDestructive
      />
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
