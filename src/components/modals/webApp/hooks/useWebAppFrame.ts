/* eslint-disable @typescript-eslint/naming-convention */
import { useCallback, useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { WebApp } from '../../../../global/types';
import type { WebAppInboundEvent, WebAppOutboundEvent } from '../../../../types/webapp';

import { getWebAppKey } from '../../../../global/helpers';
import { extractCurrentThemeParams } from '../../../../util/themeStyle';
import { REM } from '../../../common/helpers/mediaDimensions';

import useLastCallback from '../../../../hooks/useLastCallback';
import useWindowSize from '../../../../hooks/window/useWindowSize';

const SCROLLBAR_STYLE = `* {
  scrollbar-width: thin;
  scrollbar-color: %SCROLLBAR_COLOR% transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background-color: transparent;
}

*::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background-color: %SCROLLBAR_COLOR%;
}

*::-webkit-scrollbar-corner {
  background-color: transparent;
}`;

const RELOAD_TIMEOUT = 500;
const SAFE_AREA_HEIGHT = 3.675 * REM;

const useWebAppFrame = (
  ref: React.RefObject<HTMLIFrameElement>,
  isOpen: boolean,
  isFullscreen: boolean,
  isSimpleView: boolean,
  onEvent: (event: WebAppInboundEvent) => void,
  webApp?: WebApp,
  onLoad?: () => void,
) => {
  const {
    showNotification,
    setWebAppPaymentSlug,
    openInvoice,
    closeWebApp,
    openSuggestedStatusModal,
    updateWebApp,
  } = getActions();

  const isReloadSupported = useRef<boolean>(false);
  const reloadTimeout = useRef<ReturnType<typeof setTimeout>>();
  const ignoreEventsRef = useRef<boolean>(false);
  const lastFrameSizeRef = useRef<{ width: number; height: number; isResizing?: boolean }>();
  const windowSize = useWindowSize();

  useEffect(() => {
    if (!ref.current || !isOpen) return undefined;

    const handleLoad = () => {
      onLoad?.();
    };

    const frame = ref.current;
    frame.addEventListener('load', handleLoad);
    return () => {
      frame.removeEventListener('load', handleLoad);
    };
  }, [onLoad, ref, isOpen]);

  const sendEvent = useCallback((event: WebAppOutboundEvent) => {
    if (!ref.current?.contentWindow) return;
    ref.current.contentWindow.postMessage(JSON.stringify(event), '*');
  }, [ref]);

  const sendFullScreenChanged = useCallback((value: boolean) => {
    sendEvent({
      eventType: 'fullscreen_changed',
      eventData: {
        is_fullscreen: value,
      },
    });
  }, [sendEvent]);

  const forceReloadFrame = useLastCallback((url: string) => {
    if (!ref.current) return;
    const frame = ref.current;
    frame.src = 'about:blank';
    frame.addEventListener('load', () => {
      frame.src = url;
    }, { once: true });
  });

  const reloadFrame = useCallback((url: string) => {
    if (isReloadSupported.current) {
      sendEvent({
        eventType: 'reload_iframe',
      });
      reloadTimeout.current = setTimeout(() => {
        forceReloadFrame(url);
      }, RELOAD_TIMEOUT);
      return;
    }

    forceReloadFrame(url);
  }, [sendEvent]);

  const sendViewport = useCallback((isNonStable?: boolean) => {
    if (!ref.current) {
      return;
    }
    const { width, height } = ref.current.getBoundingClientRect();
    sendEvent({
      eventType: 'viewport_changed',
      eventData: {
        width,
        height,
        is_expanded: true,
        is_state_stable: !isNonStable,
      },
    });
  }, [sendEvent, ref]);

  const sendSafeArea = useCallback(() => {
    if (!ref.current) {
      return;
    }
    const { height } = ref.current.getBoundingClientRect();
    const safeAreaHeight = isFullscreen ? SAFE_AREA_HEIGHT : 0;
    sendEvent({
      eventType: 'safe_area_changed',
      eventData: {
        left: 0,
        right: 0,
        top: 0,
        bottom: height - safeAreaHeight,
      },
    });

    sendEvent({
      eventType: 'content_safe_area_changed',
      eventData: {
        left: 0,
        right: 0,
        top: safeAreaHeight,
        bottom: 0,
      },
    });
  }, [sendEvent, isFullscreen, ref]);

  const sendTheme = useCallback(() => {
    sendEvent({
      eventType: 'theme_changed',
      eventData: {
        theme_params: extractCurrentThemeParams(),
      },
    });
  }, [sendEvent]);

  const sendCustomStyle = useCallback((style: string) => {
    sendEvent({
      eventType: 'set_custom_style',
      eventData: style,
    });
  }, [sendEvent]);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    if (ignoreEventsRef.current) {
      return;
    }
    const contentWindow = ref.current?.contentWindow;
    const sourceWindow = event.source as Window;

    if (contentWindow !== sourceWindow) {
      return;
    }

    try {
      const data = JSON.parse(event.data) as WebAppInboundEvent;
      const { eventType, eventData } = data;
      // Handle some app requests here to simplify hook usage
      if (eventType === 'web_app_ready') {
        onLoad?.();
      }

      if (eventType === 'web_app_close') {
        if (webApp) {
          const key = getWebAppKey(webApp);
          closeWebApp({ key, skipClosingConfirmation: true });
        }
      }

      if (eventType === 'web_app_request_viewport') {
        sendViewport(windowSize.isResizing);
      }

      if (eventType === 'web_app_request_safe_area') {
        sendSafeArea();
      }

      if (eventType === 'web_app_request_content_safe_area') {
        sendSafeArea();
      }

      if (eventType === 'web_app_request_theme') {
        sendTheme();
      }

      if (eventType === 'iframe_ready') {
        const scrollbarColor = getComputedStyle(document.body).getPropertyValue('--color-scrollbar');
        sendCustomStyle(SCROLLBAR_STYLE.replace(/%SCROLLBAR_COLOR%/g, scrollbarColor));
        isReloadSupported.current = Boolean(eventData.reload_supported);
      }

      if (eventType === 'iframe_will_reload') {
        clearTimeout(reloadTimeout.current);
      }

      if (eventType === 'web_app_data_send') {
        if (!isSimpleView) return; // Allowed only in simple view
        ignoreEventsRef.current = true;
      }

      // Clipboard access temporarily disabled to address security concerns
      if (eventType === 'web_app_read_text_from_clipboard') {
        sendEvent({
          eventType: 'clipboard_text_received',
          eventData: {
            req_id: eventData.req_id,
            // eslint-disable-next-line no-null/no-null
            data: null,
          },
        });
      }

      if (eventType === 'web_app_open_scan_qr_popup') {
        showNotification({
          message: 'Scanning QR code is not supported in this client yet',
        });
      }

      if (eventType === 'web_app_open_invoice') {
        setWebAppPaymentSlug({
          slug: eventData.slug,
        });
        openInvoice({
          type: 'slug',
          slug: eventData.slug,
        });
      }

      if (eventType === 'web_app_open_link') {
        const linkUrl = eventData.url;
        window.open(linkUrl, '_blank', 'noreferrer');
      }

      if (eventType === 'web_app_biometry_get_info') {
        sendEvent({
          eventType: 'biometry_info_received',
          eventData: {
            available: false,
          },
        });
      }

      if (eventType === 'web_app_set_emoji_status') {
        const { custom_emoji_id, duration } = eventData;

        if (!custom_emoji_id || typeof custom_emoji_id !== 'string') {
          sendEvent({
            eventType: 'emoji_status_failed',
            eventData: {
              error: 'SUGGESTED_EMOJI_INVALID',
            },
          });
          return;
        }

        if (duration) {
          try {
            BigInt(duration);
          } catch (e) {
            sendEvent({
              eventType: 'emoji_status_failed',
              eventData: {
                error: 'DURATION_INVALID',
              },
            });
            return;
          }
        }

        if (!webApp) {
          sendEvent({
            eventType: 'emoji_status_failed',
            eventData: {
              error: 'UNKNOWN_ERROR',
            },
          });
          return;
        }

        openSuggestedStatusModal({
          webAppKey: getWebAppKey(webApp),
          customEmojiId: custom_emoji_id,
          duration: Number(duration),
          botId: webApp.botId,
        });
      }

      onEvent(data);
    } catch (err) {
      // Ignore other messages
    }
  }, [
    isSimpleView, sendEvent, onEvent, sendCustomStyle, webApp,
    sendTheme, sendViewport, sendSafeArea, onLoad, windowSize.isResizing,
    ref,
  ]);

  useEffect(() => {
    const { width, height, isResizing } = windowSize;
    if (lastFrameSizeRef.current && lastFrameSizeRef.current.width === width
      && lastFrameSizeRef.current.height === height && !lastFrameSizeRef.current.isResizing) return;
    lastFrameSizeRef.current = { width, height, isResizing };
    sendViewport(isResizing);
    sendSafeArea();
  }, [sendViewport, sendSafeArea, windowSize]);

  useEffect(() => {
    if (!webApp?.plannedEvents?.length) return;
    const events = webApp.plannedEvents;
    events.forEach((event) => {
      sendEvent(event);
    });

    updateWebApp({
      key: getWebAppKey(webApp),
      update: {
        plannedEvents: [],
      },
    });
  }, [sendEvent, webApp]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage, ref]);

  useEffect(() => {
    if (isOpen && ref.current?.contentWindow) {
      sendViewport();
      sendSafeArea();
      ignoreEventsRef.current = false;
    } else {
      lastFrameSizeRef.current = undefined;
    }
  }, [isOpen, isFullscreen, sendViewport, sendSafeArea, ref]);

  return {
    sendEvent, sendFullScreenChanged, reloadFrame, sendViewport, sendSafeArea, sendTheme,
  };
};

export default useWebAppFrame;
