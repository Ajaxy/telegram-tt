import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import useWindowSize from '../../../hooks/useWindowSize';

export type PopupOptions = {
  title: string;
  message: string;
  buttons: {
    id: string;
    type: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text: string;
  }[];
};

export type WebAppInboundEvent = {
  eventType: 'web_app_data_send';
  eventData: {
    data: string;
  };
} | {
  eventType: 'web_app_setup_main_button';
  eventData: {
    is_visible: boolean;
    is_active: boolean;
    text: string;
    color: string;
    text_color: string;
    is_progress_visible: boolean;
  };
} | {
  eventType: 'web_app_setup_back_button';
  eventData: {
    is_visible: boolean;
  };
} | {
  eventType: 'web_app_open_link';
  eventData: {
    url: string;
    try_instant_view?: boolean;
  };
} | {
  eventType: 'web_app_open_tg_link';
  eventData: {
    path_full: string;
  };
} | {
  eventType: 'web_app_open_invoice';
  eventData: {
    slug: string;
  };
} | {
  eventType: 'web_app_trigger_haptic_feedback';
  eventData: {
    type: 'impact' | 'notification' | 'selection_change';
    impact_style?: 'light' | 'medium' | 'heavy';
    notification_type?: 'error' | 'success' | 'warning';
  };
} | {
  eventType: 'web_app_set_background_color';
  eventData: {
    color: string;
  };
} | {
  eventType: 'web_app_set_header_color';
  eventData: {
    color_key: 'bg_color' | 'secondary_bg_color';
  };
} | {
  eventType: 'web_app_open_popup';
  eventData: PopupOptions;
} | {
  eventType: 'web_app_setup_closing_behavior';
  eventData: {
    need_confirmation: boolean;
  };
} | {
  eventType: 'web_app_open_scan_qr_popup';
  eventData: {
    text?: string;
  };
} | {
  eventType: 'web_app_read_text_from_clipboard';
  eventData: {
    req_id: string;
  };
} | {
  eventType: 'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_request_phone' | 'web_app_close' | 'iframe_ready' | 'web_app_close_scan_qr_popup';
  eventData: null;
};

type WebAppOutboundEvent = {
  eventType: 'viewport_changed';
  eventData: {
    height: number;
    width?: number;
    is_expanded?: boolean;
    is_state_stable?: boolean;
  };
} | {
  eventType: 'theme_changed';
  eventData: {
    theme_params: {
      bg_color: string;
      text_color: string;
      hint_color: string;
      link_color: string;
      button_color: string;
      button_text_color: string;
      secondary_bg_color: string;
    };
  };
} | {
  eventType: 'set_custom_style';
  eventData: string;
} | {
  eventType: 'invoice_closed';
  eventData: {
    slug: string;
    status: 'paid' | 'cancelled' | 'pending' | 'failed';
  };
} | {
  eventType: 'phone_requested';
  eventData: {
    phone_number: string;
  };
} | {
  eventType: 'popup_closed';
  eventData: {
    button_id?: string;
  };
} | {
  eventType: 'qr_text_received';
  eventData: {
    data: string;
  };
} | {
  eventType: 'clipboard_text_received';
  eventData: {
    req_id: string;
    data: string | null;
  };
} | {
  eventType: 'main_button_pressed' | 'back_button_pressed' | 'settings_button_pressed' | 'scan_qr_popup_closed';
};

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

const useWebAppFrame = (
  ref: React.RefObject<HTMLIFrameElement>,
  isOpen: boolean,
  isSimpleView: boolean,
  onEvent: (event: WebAppInboundEvent) => void,
  onLoad?: () => void,
) => {
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

  const reloadFrame = useCallback((url: string) => {
    if (!ref.current) return;
    const frame = ref.current;
    frame.src = 'about:blank';
    frame.addEventListener('load', () => {
      frame.src = url;
    }, { once: true });
  }, [ref]);

  const sendEvent = useCallback((event: WebAppOutboundEvent) => {
    if (!ref.current?.contentWindow) return;
    ref.current.contentWindow.postMessage(JSON.stringify(event), '*');
  }, [ref]);

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
      // Handle some app requests here to simplify hook usage
      if (data.eventType === 'web_app_ready') {
        onLoad?.();
      }

      if (data.eventType === 'web_app_request_viewport') {
        sendViewport(windowSize.isResizing);
      }

      if (data.eventType === 'web_app_request_theme') {
        sendTheme();
      }

      if (data.eventType === 'iframe_ready') {
        const scrollbarColor = getComputedStyle(document.body).getPropertyValue('--color-scrollbar');
        sendCustomStyle(SCROLLBAR_STYLE.replace(/%SCROLLBAR_COLOR%/g, scrollbarColor));
      }

      if (data.eventType === 'web_app_data_send') {
        if (!isSimpleView) return; // Allowed only in simple view
        ignoreEventsRef.current = true;
      }

      if (data.eventType === 'web_app_read_text_from_clipboard') {
        const { req_id: requestId } = data.eventData;
        // eslint-disable-next-line no-null/no-null -- Required by spec
        window.navigator.clipboard.readText().catch(() => null).then((text) => {
          sendEvent({
            eventType: 'clipboard_text_received',
            eventData: {
              req_id: requestId,
              data: text,
            },
          });
        });
      }
      onEvent(data);
    } catch (err) {
      // Ignore other messages
    }
  }, [isSimpleView, onEvent, sendCustomStyle, sendEvent, sendTheme, sendViewport, onLoad, windowSize.isResizing]);

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
