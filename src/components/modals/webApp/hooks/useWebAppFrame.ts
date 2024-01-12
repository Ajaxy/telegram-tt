import { useCallback, useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { WebAppInboundEvent, WebAppOutboundEvent } from '../../../../types/webapp';

import { extractCurrentThemeParams } from '../../../../util/themeStyle';

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

const useWebAppFrame = (
  ref: React.RefObject<HTMLIFrameElement>,
  isOpen: boolean,
  isSimpleView: boolean,
  onEvent: (event: WebAppInboundEvent) => void,
  onLoad?: () => void,
) => {
  const {
    showNotification,
    setWebAppPaymentSlug,
    openInvoice,
    closeWebApp,
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

    try {
      const data = JSON.parse(event.data) as WebAppInboundEvent;
      const { eventType, eventData } = data;
      // Handle some app requests here to simplify hook usage
      if (eventType === 'web_app_ready') {
        onLoad?.();
      }

      if (eventType === 'web_app_close') {
        closeWebApp();
      }

      if (eventType === 'web_app_request_viewport') {
        sendViewport(windowSize.isResizing);
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

        showNotification({
          message: 'Clipboard access is not supported in this client yet',
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
          slug: eventData.slug,
        });
      }

      if (eventType === 'web_app_open_link') {
        const linkUrl = eventData.url;
        window.open(linkUrl, '_blank', 'noreferrer');
      }

      onEvent(data);
    } catch (err) {
      // Ignore other messages
    }
  }, [isSimpleView, sendEvent, onEvent, sendCustomStyle, sendTheme, sendViewport, onLoad, windowSize.isResizing]);

  useEffect(() => {
    const { width, height, isResizing } = windowSize;
    if (lastFrameSizeRef.current && lastFrameSizeRef.current.width === width
      && lastFrameSizeRef.current.height === height && !lastFrameSizeRef.current.isResizing) return;
    lastFrameSizeRef.current = { width, height, isResizing };
    sendViewport(isResizing);
  }, [sendViewport, windowSize]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (isOpen && ref.current?.contentWindow) {
      sendViewport();
      ignoreEventsRef.current = false;
    } else {
      lastFrameSizeRef.current = undefined;
    }
  }, [isOpen, sendViewport, ref]);

  return {
    sendEvent, reloadFrame, sendViewport, sendTheme,
  };
};

export default useWebAppFrame;
