import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAttachBot, ApiBotAppSettings, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { BotAppPermissions, ThemeKey } from '../../../types';
import type {
  PopupOptions,
  WebApp,
  WebAppInboundEvent,
  WebAppModalStateType,
  WebAppOutboundEvent,
} from '../../../types/webapp';

import { TME_LINK_PREFIX } from '../../../config';
import { convertToApiChatType } from '../../../global/helpers';
import { getWebAppKey } from '../../../global/helpers/bots';
import {
  selectBotAppPermissions,
  selectTabState,
  selectTheme,
  selectUser,
  selectUserFullInfo,
  selectWebApp,
} from '../../../global/selectors';
import { getGeolocationStatus, IS_GEOLOCATION_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle.ts';
import download from '../../../util/download';
import { extractCurrentThemeParams, validateHexColor } from '../../../util/themeStyle';
import { callApi } from '../../../api/gramjs';
import renderText from '../../common/helpers/renderText';

import { getIsWebAppsFullscreenSupported } from '../../../hooks/useAppLayout';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useFullscreen, { checkIfFullscreen } from '../../../hooks/window/useFullscreen';
import usePopupLimit from './hooks/usePopupLimit';
import useWebAppFrame from './hooks/useWebAppFrame';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Modal from '../../ui/Modal';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';

import styles from './WebAppModalTabContent.module.scss';

type WebAppButton = {
  isVisible: boolean;
  isActive: boolean;
  text: string;
  color: string;
  textColor: string;
  isProgressVisible: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
};

export type OwnProps = {
  modal?: TabState['webApps'];
  webApp?: WebApp;
  registerSendEventCallback: (callback: (event: WebAppOutboundEvent) => void) => void;
  registerReloadFrameCallback: (callback: (url: string) => void) => void;
  onContextMenuButtonClick: (e: React.MouseEvent) => void;
  isTransforming?: boolean;
  isMultiTabSupported?: boolean;
  modalHeight: number;
};

type StateProps = {
  bot?: ApiUser;
  currentUser?: ApiUser;
  botAppSettings?: ApiBotAppSettings;
  attachBot?: ApiAttachBot;
  theme?: ThemeKey;
  isPaymentModalOpen?: boolean;
  paymentStatus?: TabState['payment']['status'];
  modalState?: WebAppModalStateType;
  botAppPermissions?: BotAppPermissions;
};

const MAIN_BUTTON_ANIMATION_TIME = 250;
const ANIMATION_WAIT = 400;
const COLLAPSING_WAIT = 350;
const POPUP_SEQUENTIAL_LIMIT = 3;
const POPUP_RESET_DELAY = 2000; // 2s
const APP_NAME_DISPLAY_DURATION = 3800;
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

const NBSP = '\u00A0';

const WebAppModalTabContent: FC<OwnProps & StateProps> = ({
  modal,
  webApp,
  bot,
  theme,
  isPaymentModalOpen,
  paymentStatus,
  registerSendEventCallback,
  registerReloadFrameCallback,
  isTransforming,
  modalState,
  isMultiTabSupported,
  onContextMenuButtonClick,
  botAppPermissions,
  botAppSettings,
  modalHeight,
}) => {
  const {
    closeActiveWebApp,
    sendWebViewData,
    toggleAttachBot,
    openTelegramLink,
    setWebAppPaymentSlug,
    switchBotInline,
    sharePhoneWithBot,
    updateWebApp,
    resetPaymentStatus,
    openChatWithInfo,
    showNotification,
    openEmojiStatusAccessModal,
    openLocationAccessModal,
    changeWebAppModalState,
    closeWebAppModal,
    openPreparedInlineMessageModal,
  } = getActions();
  const [mainButton, setMainButton] = useState<WebAppButton | undefined>();
  const [secondaryButton, setSecondaryButton] = useState<WebAppButton | undefined>();

  const [isLoaded, markLoaded, markUnloaded] = useFlag(false);

  const [popupParameters, setPopupParameters] = useState<PopupOptions | undefined>();
  const [isRequestingPhone, setIsRequestingPhone] = useState(false);
  const [isRequestingWriteAccess, setIsRequestingWriteAccess] = useState(false);
  const [requestedFileDownload, setRequestedFileDownload] = useState<{ url: string; fileName: string } | undefined>();
  const [bottomBarColor, setBottomBarColor] = useState<string | undefined>();
  const {
    unlockPopupsAt, handlePopupOpened, handlePopupClosed,
  } = usePopupLimit(POPUP_SEQUENTIAL_LIMIT, POPUP_RESET_DELAY);

  const containerRef = useRef<HTMLDivElement>();

  const headerButtonRef = useRef<HTMLDivElement>();

  const headerButtonCaptionRef = useRef<HTMLDivElement>();

  const isFullscreen = modalState === 'fullScreen';
  const isMinimizedState = modalState === 'minimized';

  const exitFullScreenCallback = useLastCallback(() => {
    setTimeout(() => {
      changeWebAppModalState({ state: 'maximized' });
    }, COLLAPSING_WAIT);
  });

  const fullscreenElementRef = useRef<HTMLElement>();

  useEffect(() => {
    fullscreenElementRef.current = document.querySelector('#portals') as HTMLElement;
  }, []);

  const [, setFullscreen, exitFullscreen] = useFullscreen(fullscreenElementRef, exitFullScreenCallback);

  const activeWebApp = modal?.activeWebAppKey ? modal.openedWebApps[modal.activeWebAppKey] : undefined;
  const { appName: activeWebAppName, backgroundColor } = activeWebApp || {};
  const {
    url, buttonText, isBackButtonVisible,
  } = webApp || {};

  const {
    placeholderPath,
  } = botAppSettings || {};

  const isCloseModalOpen = Boolean(webApp?.isCloseModalOpen);
  const isRemoveModalOpen = Boolean(webApp?.isRemoveModalOpen);

  const webAppKey = webApp && getWebAppKey(webApp);
  const activeWebAppKey = activeWebApp && getWebAppKey(activeWebApp);

  const isActive = (activeWebApp && webApp) && activeWebAppKey === webAppKey;

  const isAvailable = IS_GEOLOCATION_SUPPORTED;
  const isAccessRequested = botAppPermissions?.geolocation !== undefined;
  const isAccessGranted = Boolean(botAppPermissions?.geolocation);

  const updateCurrentWebApp = useLastCallback((updatedPartialWebApp: Partial<WebApp>) => {
    if (!webAppKey) return;
    updateWebApp({ key: webAppKey, update: updatedPartialWebApp });
  });

  const themeParams = useMemo(() => {
    return extractCurrentThemeParams();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    setBottomBarColor(themeParams.secondary_bg_color);
  }, [themeParams]);

  const themeBackgroundColor = themeParams.bg_color;
  const [backgroundColorFromEvent, setBackgroundColorFromEvent] = useState<string | undefined>();
  const backgroundColorFromSettings = theme === 'light' ? botAppSettings?.backgroundColor
    : botAppSettings?.backgroundDarkColor;

  useEffect(() => {
    const color = backgroundColorFromEvent || backgroundColorFromSettings || themeBackgroundColor;

    updateCurrentWebApp({ backgroundColor: color });
  }, [themeBackgroundColor, backgroundColorFromEvent, backgroundColorFromSettings]);

  const themeHeaderColor = themeParams.bg_color;
  const [headerColorFromEvent, setHeaderColorFromEvent] = useState<string | undefined>();
  const headerColorFromSettings = theme === 'light' ? botAppSettings?.headerColor
    : botAppSettings?.headerDarkColor;

  useEffect(() => {
    const color = headerColorFromEvent || headerColorFromSettings || themeHeaderColor;

    updateCurrentWebApp({ headerColor: color });
  }, [themeHeaderColor, headerColorFromEvent, headerColorFromSettings]);

  const frameRef = useRef<HTMLIFrameElement>();

  const oldLang = useOldLang();
  const lang = useLang();
  const isOpen = modal?.isModalOpen || false;
  const isSimple = Boolean(buttonText);

  const {
    reloadFrame, sendEvent, sendFullScreenChanged, sendViewport, sendSafeArea, sendTheme,
  } = useWebAppFrame(frameRef, isOpen, isFullscreen, isSimple, handleEvent, webApp, markLoaded);

  useEffect(() => {
    if (isActive) registerSendEventCallback(sendEvent);
  }, [sendEvent, registerSendEventCallback, isActive]);

  useEffect(() => {
    if (isActive) registerReloadFrameCallback(reloadFrame);
  }, [reloadFrame, registerReloadFrameCallback, isActive]);

  const isMainButtonVisible = isLoaded && mainButton?.isVisible && mainButton.text.trim().length > 0;
  const isSecondaryButtonVisible = isLoaded && secondaryButton?.isVisible && secondaryButton.text.trim().length > 0;

  const handleHideCloseModal = useLastCallback(() => {
    updateCurrentWebApp({ isCloseModalOpen: false });
  });
  const handleConfirmCloseModal = useLastCallback(() => {
    updateCurrentWebApp({ shouldConfirmClosing: false, isCloseModalOpen: false });
    setTimeout(() => {
      closeActiveWebApp();
    }, ANIMATION_WAIT);
  });

  const handleHideRemoveModal = useLastCallback(() => {
    updateCurrentWebApp({ isRemoveModalOpen: false });
  });

  const handleMainButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'main_button_pressed',
    });
  });

  const handleSecondaryButtonClick = useLastCallback(() => {
    sendEvent({
      eventType: 'secondary_button_pressed',
    });
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

  const sendThemeCallback = useLastCallback(() => {
    sendTheme();
  });

  // Notify view that theme changed
  useSyncEffect(() => {
    setTimeout(() => {
      sendThemeCallback();
    }, ANIMATION_WAIT);
  }, [theme]);

  const setFullscreenCallback = useLastCallback(() => {
    if (!checkIfFullscreen() && isActive) {
      setFullscreen?.();
    }
  });

  const exitIfFullscreenCallback = useLastCallback(() => {
    if (checkIfFullscreen() && isActive) {
      exitFullscreen?.();
    }
  });

  const sendFullScreenChangedCallback = useLastCallback(
    (value: boolean) => {
      if (isActive) sendFullScreenChanged(value);
    },
  );

  useEffect(() => {
    if (isFullscreen) {
      setFullscreenCallback();
      sendFullScreenChangedCallback(true);
    } else {
      exitIfFullscreenCallback();
      sendFullScreenChangedCallback(false);
    }
  }, [isFullscreen]);

  const visibilityChangedCallBack = useLastCallback((visibility: boolean) => {
    sendEvent({
      eventType: 'visibility_changed',
      eventData: {
        is_visible: visibility,
      },
    });
  });

  useEffect(() => {
    if (isLoaded) {
      visibilityChangedCallBack(Boolean(isActive));
    }
  }, [isActive, isLoaded]);

  useEffectWithPrevDeps(([prevModalState]) => {
    if (modalState === 'minimized') {
      visibilityChangedCallBack(false);
    }
    if (modalState && prevModalState === 'minimized') {
      visibilityChangedCallBack(true);
    }
  }, [modalState]);

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
      resetPaymentStatus();
    }
  }, [isPaymentModalOpen, paymentStatus, sendEvent, webApp?.slug]);

  const handleRemoveAttachBot = useLastCallback(() => {
    toggleAttachBot({
      botId: bot!.id,
      isEnabled: false,
    });
    closeActiveWebApp();
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

  const handleRejectFileDownload = useLastCallback((shouldCloseActive?: boolean) => {
    if (shouldCloseActive) {
      setRequestedFileDownload(undefined);
      handlePopupClosed();
    }

    sendEvent({
      eventType: 'file_download_requested',
      eventData: {
        status: 'cancelled',
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
    if (!bot) return;
    const result = await callApi('allowBotSendMessages', { bot });
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
    if (!bot) return;
    const canWrite = await callApi('fetchBotCanSendMessage', {
      bot,
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

  async function handleCheckDownloadFile(fileUrl: string, fileName: string) {
    const canDownload = await callApi('checkBotDownloadFileParams', {
      bot: bot!,
      url: fileUrl,
      fileName,
    });

    if (!canDownload) {
      sendEvent({
        eventType: 'file_download_requested',
        eventData: {
          status: 'cancelled',
        },
      });
      return;
    }

    setRequestedFileDownload({ url: fileUrl, fileName });
    handlePopupOpened();
  }

  const handleDownloadFile = useLastCallback(() => {
    if (!requestedFileDownload) return;
    setRequestedFileDownload(undefined);
    handlePopupClosed();

    download(requestedFileDownload.url, requestedFileDownload.fileName);
    sendEvent({
      eventType: 'file_download_requested',
      eventData: {
        status: 'downloading',
      },
    });
  });

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

  useEffect(() => {
    if (!isOpen) {
      setPopupParameters(undefined);
      setIsRequestingPhone(false);
      setIsRequestingWriteAccess(false);
      setMainButton(undefined);
      setSecondaryButton(undefined);
      updateCurrentWebApp({
        isSettingsButtonVisible: false,
        shouldConfirmClosing: false,
        isBackButtonVisible: false,
        isCloseModalOpen: false,
        isRemoveModalOpen: false,
      });
      markUnloaded();
    }
  }, [isOpen]);

  const handleOpenChat = useLastCallback(() => {
    openChatWithInfo({ id: bot!.id });
  });

  function handleEvent(event: WebAppInboundEvent) {
    const { eventType, eventData } = event;

    if (eventType === 'web_app_request_fullscreen') {
      if (getIsWebAppsFullscreenSupported()) {
        changeWebAppModalState({ state: 'fullScreen' });
      } else {
        sendEvent({
          eventType: 'fullscreen_failed',
          eventData: {
            error: 'UNSUPPORTED',
          },
        });
      }
    }

    if (eventType === 'web_app_exit_fullscreen') {
      exitIfFullscreenCallback();
    }

    if (eventType === 'web_app_open_tg_link') {
      changeWebAppModalState({ state: 'minimized' });

      const linkUrl = TME_LINK_PREFIX + eventData.path_full;
      openTelegramLink({ url: linkUrl, shouldIgnoreCache: eventData.force_request });
    }

    if (eventType === 'web_app_setup_back_button') {
      updateCurrentWebApp({ isBackButtonVisible: eventData.is_visible });
    }

    if (eventType === 'web_app_setup_settings_button') {
      updateCurrentWebApp({ isSettingsButtonVisible: eventData.is_visible });
    }

    if (eventType === 'web_app_set_background_color') {
      setBackgroundColorFromEvent(validateHexColor(eventData.color) ? eventData.color : undefined);
    }

    if (eventType === 'web_app_set_header_color') {
      const key = eventData.color_key;
      setHeaderColorFromEvent(eventData.color || (key ? themeParams[key] : undefined));
    }

    if (eventType === 'web_app_set_bottom_bar_color') {
      setBottomBarColor(eventData.color);
    }

    if (eventType === 'web_app_data_send') {
      closeActiveWebApp();
      sendWebViewData({
        bot: bot!,
        buttonText: buttonText!,
        data: eventData.data,
      });
    }

    if (eventType === 'web_app_setup_main_button') {
      const color = eventData.color;
      const textColor = eventData.text_color;
      setMainButton({
        isVisible: eventData.is_visible && Boolean(eventData.text?.trim().length),
        isActive: eventData.is_active,
        text: eventData.text,
        color,
        textColor,
        isProgressVisible: eventData.is_progress_visible,
      });
    }

    if (eventType === 'web_app_setup_secondary_button') {
      const color = eventData.color;
      const textColor = eventData.text_color;
      setSecondaryButton({
        isVisible: eventData.is_visible && Boolean(eventData.text?.trim().length),
        isActive: eventData.is_active,
        text: eventData.text,
        color,
        textColor,
        isProgressVisible: eventData.is_progress_visible,
        position: eventData.position,
      });
    }

    if (eventType === 'web_app_setup_closing_behavior') {
      updateCurrentWebApp({ shouldConfirmClosing: true });
    }

    if (eventType === 'web_app_open_popup') {
      if (popupParameters || !eventData.message.trim().length || !eventData.buttons?.length
        || eventData.buttons.length > 3 || isRequestingPhone || isRequestingWriteAccess
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

      closeActiveWebApp();
    }

    if (eventType === 'web_app_request_phone') {
      if (popupParameters || isRequestingWriteAccess || unlockPopupsAt > Date.now()) {
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

    if (eventType === 'web_app_request_file_download') {
      if (requestedFileDownload || unlockPopupsAt > Date.now()) {
        handleRejectFileDownload();
        return;
      }
      handleCheckDownloadFile(eventData.url, eventData.file_name);
    }

    if (eventType === 'web_app_send_prepared_message') {
      if (!bot || !webAppKey) return;
      const { id } = eventData;
      openPreparedInlineMessageModal({ botId: bot.id, messageId: id, webAppKey });
    }

    if (eventType === 'web_app_request_emoji_status_access') {
      if (!bot) return;
      openEmojiStatusAccessModal({ bot, webAppKey });
    }

    if (eventType === 'web_app_check_location') {
      const handleGeolocationCheck = () => {
        sendEvent({
          eventType: 'location_checked',
          eventData: {
            available: isAvailable,
            access_requested: isAccessRequested,
            access_granted: isAccessGranted,
          },
        });
      };

      handleGeolocationCheck();
    }

    if (eventType === 'web_app_request_location') {
      const handleRequestLocation = async () => {
        const geolocationData = await getGeolocationStatus();
        const { accessRequested, accessGranted, geolocation } = geolocationData;

        if (!accessGranted || !accessRequested) {
          sendEvent({
            eventType: 'location_requested',
            eventData: {
              available: false,
            },
          });
          showNotification({ message: oldLang('PermissionNoLocationPosition') });
          handleAppPopupClose(undefined);
          return;
        }

        if (isAvailable) {
          if (isAccessRequested) {
            sendEvent({
              eventType: 'location_requested',
              eventData: {
                available: Boolean(botAppPermissions?.geolocation),
                latitude: geolocation?.latitude,
                longitude: geolocation?.longitude,
                altitude: geolocation?.altitude,
                course: geolocation?.heading,
                speed: geolocation?.speed,
                horizontal_accuracy: geolocation?.accuracy,
                vertical_accuracy: geolocation?.altitudeAccuracy,
              },
            });
          } else {
            openLocationAccessModal({ bot, webAppKey });
          }
        } else {
          showNotification({ message: oldLang('PermissionNoLocationPosition') });
          handleAppPopupClose(undefined);
        }
      };

      handleRequestLocation();
    }

    if (eventType === 'web_app_open_location_settings') {
      handleOpenChat();
    }
  }

  const mainButtonCurrentColor = useCurrentOrPrev(mainButton?.color, true);
  const mainButtonCurrentTextColor = useCurrentOrPrev(mainButton?.textColor, true);
  const mainButtonCurrentIsActive = useCurrentOrPrev(mainButton && Boolean(mainButton.isActive), true);
  const mainButtonCurrentText = useCurrentOrPrev(mainButton?.text, true);

  const secondaryButtonCurrentPosition = useCurrentOrPrev(secondaryButton?.position, true);
  const secondaryButtonCurrentColor = useCurrentOrPrev(secondaryButton?.color, true);
  const secondaryButtonCurrentTextColor = useCurrentOrPrev(secondaryButton?.textColor, true);
  const secondaryButtonCurrentIsActive = useCurrentOrPrev(secondaryButton && Boolean(secondaryButton.isActive), true);
  const secondaryButtonCurrentText = useCurrentOrPrev(secondaryButton?.text, true);

  const [shouldDecreaseWebFrameSize, setShouldDecreaseWebFrameSize] = useState(false);
  const [shouldHideMainButton, setShouldHideMainButton] = useState(true);
  const [shouldHideSecondaryButton, setShouldHideSecondaryButton] = useState(true);
  const [shouldShowMainButton, setShouldShowMainButton] = useState(false);
  const [shouldShowSecondaryButton, setShouldShowSecondaryButton] = useState(false);

  const [shouldShowAppNameInFullscreen, setShouldShowAppNameInFullscreen] = useState(false);

  const [backButtonTextWidth, setBackButtonTextWidth] = useState(0);

  // Notify view that height changed
  useSyncEffect(() => {
    setTimeout(() => {
      sendViewport();
      sendSafeArea();
    }, isTransforming ? 0 : ANIMATION_WAIT);
  }, [shouldShowSecondaryButton, shouldHideSecondaryButton,
    shouldShowMainButton, shouldShowMainButton,
    secondaryButton?.position, sendViewport, isTransforming, modalHeight,
    sendSafeArea]);

  const isVerticalLayout = secondaryButtonCurrentPosition === 'top' || secondaryButtonCurrentPosition === 'bottom';
  const isHorizontalLayout = !isVerticalLayout;

  const rowsCount = (isVerticalLayout && shouldShowMainButton && shouldShowSecondaryButton) ? 2
    : shouldShowMainButton || shouldShowSecondaryButton ? 1 : 0;

  const hideDirection = (isHorizontalLayout
    && (!shouldHideMainButton && !shouldHideSecondaryButton)) ? 'horizontal' : 'vertical';

  const mainButtonChangeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const mainButtonFastTimeout = useRef<ReturnType<typeof setTimeout>>();
  const secondaryButtonChangeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const secondaryButtonFastTimeout = useRef<ReturnType<typeof setTimeout>>();
  const appNameDisplayTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isFullscreen && isOpen && Boolean(activeWebAppName)) {
      setShouldShowAppNameInFullscreen(true);

      if (appNameDisplayTimeout.current) {
        clearTimeout(appNameDisplayTimeout.current);
      }

      appNameDisplayTimeout.current = setTimeout(() => {
        setShouldShowAppNameInFullscreen(false);
        appNameDisplayTimeout.current = undefined;
      }, APP_NAME_DISPLAY_DURATION);
    } else {
      setShouldShowAppNameInFullscreen(false);

      if (appNameDisplayTimeout.current) {
        clearTimeout(appNameDisplayTimeout.current);
        appNameDisplayTimeout.current = undefined;
      }
    }

    return () => {
      if (appNameDisplayTimeout.current) {
        clearTimeout(appNameDisplayTimeout.current);
      }
    };
  }, [isFullscreen, isOpen, activeWebAppName]);

  useEffect(() => {
    if (mainButtonChangeTimeout.current) clearTimeout(mainButtonChangeTimeout.current);
    if (mainButtonFastTimeout.current) clearTimeout(mainButtonFastTimeout.current);

    if (isMainButtonVisible) {
      mainButtonFastTimeout.current = setTimeout(() => {
        setShouldShowMainButton(true);
      }, 35);
      setShouldHideMainButton(false);
      mainButtonChangeTimeout.current = setTimeout(() => {
        setShouldDecreaseWebFrameSize(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }

    if (!isMainButtonVisible) {
      setShouldShowMainButton(false);
      mainButtonChangeTimeout.current = setTimeout(() => {
        setShouldHideMainButton(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }
  }, [isMainButtonVisible]);

  useEffect(() => {
    if (secondaryButtonChangeTimeout.current) clearTimeout(secondaryButtonChangeTimeout.current);
    if (secondaryButtonFastTimeout.current) clearTimeout(secondaryButtonFastTimeout.current);

    if (isSecondaryButtonVisible) {
      secondaryButtonFastTimeout.current = setTimeout(() => {
        setShouldShowSecondaryButton(true);
      }, 35);
      setShouldHideSecondaryButton(false);
      secondaryButtonChangeTimeout.current = setTimeout(() => {
        setShouldDecreaseWebFrameSize(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }

    if (!isSecondaryButtonVisible) {
      setShouldShowSecondaryButton(false);
      secondaryButtonChangeTimeout.current = setTimeout(() => {
        setShouldHideSecondaryButton(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }
  }, [isSecondaryButtonVisible]);

  useEffect(() => {
    if (!shouldShowSecondaryButton && !shouldShowMainButton) {
      setShouldDecreaseWebFrameSize(false);
    }
  }, [setShouldDecreaseWebFrameSize, shouldShowSecondaryButton, shouldShowMainButton]);

  const frameStyle = buildStyle(
    `background-color: ${backgroundColor || 'var(--color-background)'}`,
    isTransforming && 'pointer-events: none;',
  );

  const handleBackClick = useLastCallback(() => {
    if (isBackButtonVisible) {
      sendEvent({
        eventType: 'back_button_pressed',
      });
    } else {
      exitIfFullscreenCallback();
      sendFullScreenChanged(false);
      changeWebAppModalState({ state: 'maximized' });
      closeWebAppModal();
    }
  });

  const handleCollapseClick = useLastCallback(() => {
    exitIfFullscreenCallback();
  });

  const handleShowContextMenu = useLastCallback((e: React.MouseEvent) => {
    onContextMenuButtonClick(e);
  });

  const backIconClass = buildClassName(
    styles.closeIcon,
    isBackButtonVisible && styles.stateBack,
  );
  const backButtonCaption = shouldShowAppNameInFullscreen ? activeWebAppName
    : oldLang(isBackButtonVisible ? 'Back' : 'Close');

  const hasHeaderElement = headerButtonCaptionRef?.current;

  useEffect(() => {
    const width = headerButtonCaptionRef?.current?.clientWidth || 0;
    setBackButtonTextWidth(width);
  }, [backButtonCaption, hasHeaderElement]);

  function getBackButtonActiveKey() {
    if (shouldShowAppNameInFullscreen) return 0;
    return isBackButtonVisible ? 1 : 2;
  }

  function renderFullscreenBackButtonCaption() {
    return (
      <span
        className={styles.buttonCaptionContainer}
        style={
          `width: ${backButtonTextWidth}px;`
        }
      >
        <Transition
          activeKey={getBackButtonActiveKey()}
          name="slideFade"
        >
          <div
            ref={headerButtonCaptionRef}
            className={styles.backButtonCaption}
          >
            {backButtonCaption}
          </div>
        </Transition>
      </span>
    );
  }

  function renderFullscreenHeaderPanel() {
    return (
      <div className={styles.headerPanel}>
        <div ref={headerButtonRef} className={styles.headerButton} onClick={handleBackClick}>
          <div className={styles.backIconContainer}>
            <div className={backIconClass} />
          </div>
          {renderFullscreenBackButtonCaption()}
        </div>
        <div className={styles.headerSplitButton}>
          <div
            className={buildClassName(
              styles.headerButton,
              styles.left,
            )}
            tabIndex={0}
            role="button"
            aria-label={lang('WebAppCollapse')}
            onClick={handleCollapseClick}
          >
            <Icon
              name="down"
              className={styles.icon}
            />
          </div>
          <div
            className={buildClassName(
              styles.headerButton,
              styles.right,
            )}
            tabIndex={0}
            role="button"
            aria-haspopup="menu"
            aria-label={lang('AriaMoreButton')}
            onClick={handleShowContextMenu}
          >
            <Icon
              name="more"
              className={buildClassName(
                styles.icon,
                styles.moreIcon,
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderDefaultPlaceholder() {
    const className = buildClassName(styles.loadingPlaceholder, styles.defaultPlaceholderGrid, isLoaded && styles.hide);
    return (
      <div className={className}>
        <div className={styles.placeholderSquare} />
        <div className={styles.placeholderSquare} />
        <div className={styles.placeholderSquare} />
        <div className={styles.placeholderSquare} />
      </div>
    );
  }

  function renderPlaceholder() {
    if (!placeholderPath) {
      return renderDefaultPlaceholder();
    }
    return (
      <svg
        className={buildClassName(styles.loadingPlaceholder, isLoaded && styles.hide)}
        viewBox="0 0 512 512"
      >
        <path className={styles.placeholderPath} d={placeholderPath} />
      </svg>
    );
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName(
        styles.root,
        !isActive && styles.hidden,
        isMultiTabSupported && styles.multiTab,
      )}
    >
      {isFullscreen && getIsWebAppsFullscreenSupported() && renderFullscreenHeaderPanel()}
      {!isMinimizedState && renderPlaceholder()}
      <iframe
        className={buildClassName(
          styles.frame,
          shouldDecreaseWebFrameSize && styles.withButton,
          !isLoaded && styles.hide,
        )}
        style={frameStyle}
        src={url}
        title={lang('AriaMiniApp', { bot: bot?.firstName })}
        sandbox={SANDBOX_ATTRIBUTES}
        allow="camera; microphone; geolocation; clipboard-write;"
        allowFullScreen
        ref={frameRef}
      />
      {!isMinimizedState && (
        <div
          style={`background-color: ${bottomBarColor};`}
          className={buildClassName(
            styles.buttonsContainer,
            secondaryButtonCurrentPosition === 'left' && styles.leftToRight,
            secondaryButtonCurrentPosition === 'right' && styles.rightToLeft,
            secondaryButtonCurrentPosition === 'top' && styles.topToBottom,
            secondaryButtonCurrentPosition === 'bottom' && styles.bottomToTop,
            hideDirection === 'horizontal' && styles.hideHorizontal,
            rowsCount === 1 && styles.oneRow,
            rowsCount === 2 && styles.twoRows,
          )}
        >
          <Button
            className={buildClassName(
              styles.secondaryButton,
              shouldShowSecondaryButton && !shouldHideSecondaryButton && styles.visible,
              shouldHideSecondaryButton && styles.hidden,
            )}
            fluid
            style={`background-color: ${secondaryButtonCurrentColor}; color: ${secondaryButtonCurrentTextColor}`}
            disabled={!secondaryButtonCurrentIsActive && !secondaryButton?.isProgressVisible}
            nonInteractive={secondaryButton?.isProgressVisible}
            onClick={handleSecondaryButtonClick}
          >
            {!secondaryButton?.isProgressVisible && secondaryButtonCurrentText}
            {secondaryButton?.isProgressVisible
              && <Spinner className={styles.mainButtonSpinner} color="blue" />}
          </Button>
          <Button
            className={buildClassName(
              styles.mainButton,
              shouldShowMainButton && !shouldHideMainButton && styles.visible,
              shouldHideMainButton && styles.hidden,
            )}
            fluid
            style={`background-color: ${mainButtonCurrentColor}; color: ${mainButtonCurrentTextColor}`}
            disabled={!mainButtonCurrentIsActive && !mainButton?.isProgressVisible}
            nonInteractive={mainButton?.isProgressVisible}
            onClick={handleMainButtonClick}
          >
            {!mainButton?.isProgressVisible && mainButtonCurrentText}
            {mainButton?.isProgressVisible && <Spinner className={styles.mainButtonSpinner} color="white" />}
          </Button>
        </div>
      )}
      {popupParameters && (
        <Modal
          isOpen={Boolean(popupParameters)}
          title={popupParameters.title || NBSP}
          className={
            buildClassName(styles.webAppPopup, !popupParameters.title?.trim().length && styles.withoutTitle)
          }
          hasAbsoluteCloseButton
          onClose={handleAppPopupModalClose}
        >
          {popupParameters.message}
          <div className="dialog-buttons mt-2">
            {popupParameters.buttons.map((button) => (
              <Button
                key={button.id || button.type}
                className="confirm-dialog-button"
                color={button.type === 'destructive' ? 'danger' : 'primary'}
                isText
                onClick={() => handleAppPopupClose(button.id)}
              >
                {button.text || oldLang(DEFAULT_BUTTON_TEXT[button.type])}
              </Button>
            ))}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={isRequestingPhone}
        onClose={handleRejectPhone}
        title={lang('ShareYouPhoneNumberTitle')}
        textParts={lang(
          'AreYouSureShareMyContactInfoBot',
          undefined,
          { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'emoji'],
          })}
        confirmHandler={handleAcceptPhone}
        confirmLabel={lang('ContactShare')}
      />
      <ConfirmDialog
        isOpen={isRequestingWriteAccess}
        onClose={handleRejectWriteAccess}
        title={oldLang('lng_bot_allow_write_title')}
        text={oldLang('lng_bot_allow_write')}
        confirmHandler={handleAcceptWriteAccess}
        confirmLabel={oldLang('lng_bot_allow_write_confirm')}
      />
      <ConfirmDialog
        isOpen={Boolean(requestedFileDownload)}
        title={oldLang('BotDownloadFileTitle')}
        textParts={lang('BotDownloadFileDescription', {
          bot: bot?.firstName,
          filename: requestedFileDownload?.fileName,
        }, {
          withNodes: true,
          withMarkdown: true,
        })}
        confirmLabel={oldLang('BotDownloadFileButton')}
        onClose={handleRejectFileDownload}
        confirmHandler={handleDownloadFile}
      />

      <ConfirmDialog
        isOpen={isCloseModalOpen}
        onClose={handleHideCloseModal}
        title={oldLang('lng_bot_close_warning_title')}
        text={oldLang('lng_bot_close_warning')}
        confirmHandler={handleConfirmCloseModal}
        confirmIsDestructive
        confirmLabel={oldLang('lng_bot_close_warning_sure')}
      />
      <ConfirmDialog
        isOpen={isRemoveModalOpen}
        onClose={handleHideRemoveModal}
        title={oldLang('BotRemoveFromMenuTitle')}
        textParts={renderText(oldLang('BotRemoveFromMenu', bot?.firstName), ['simple_markdown'])}
        confirmHandler={handleRemoveAttachBot}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const activeWebApp = modal?.activeWebAppKey ? selectWebApp(global, modal.activeWebAppKey) : undefined;
    const { botId: activeBotId } = activeWebApp || {};
    const modalState = modal?.modalState;

    const attachBot = activeBotId ? global.attachMenu.bots[activeBotId] : undefined;
    const bot = activeBotId ? selectUser(global, activeBotId) : undefined;
    const userFullInfo = activeBotId ? selectUserFullInfo(global, activeBotId) : undefined;
    const botAppSettings = userFullInfo?.botInfo?.appSettings;
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
    const theme = selectTheme(global);
    const { isPaymentModalOpen, status: regularPaymentStatus } = selectTabState(global).payment;
    const { status: starsPaymentStatus, inputInvoice: starsInputInvoice } = selectTabState(global).starsPayment;
    const botAppPermissions = bot ? selectBotAppPermissions(global, bot.id) : undefined;

    const paymentStatus = starsPaymentStatus || regularPaymentStatus;

    return {
      attachBot,
      bot,
      currentUser,
      theme,
      isPaymentModalOpen: isPaymentModalOpen || Boolean(starsInputInvoice),
      paymentStatus,
      modalState,
      botAppPermissions,
      botAppSettings,
    };
  },
)(WebAppModalTabContent));
