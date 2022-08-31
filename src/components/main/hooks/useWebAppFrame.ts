import useWindowSize from '../../../hooks/useWindowSize';
import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

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
  eventType: 'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_request_phone' | 'web_app_close' | 'iframe_ready';
  eventData: null;
};

type WebAppOutboundEvent = {
  eventType: 'viewport_changed';
  eventData: {
    height: number;
    width?: number;
    is_expanded?: boolean;
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
  eventType: 'main_button_pressed' | 'back_button_pressed' | 'settings_button_pressed';
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

const useWebAppFrame = (isOpen: boolean, isSimpleView: boolean, onEvent: (event: WebAppInboundEvent) => void) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLIFrameElement>(null);
  const ignoreEventsRef = useRef<boolean>(false);
  const windowSize = useWindowSize();

  const reloadFrame = useCallback((url: string) => {
    if (!ref.current) return;
    const frame = ref.current;
    frame.src = 'about:blank';
    frame.addEventListener('load', () => {
      frame.src = url;
    }, { once: true });
  }, []);

  const sendEvent = useCallback((event: WebAppOutboundEvent) => {
    if (!ref.current?.contentWindow) return;
    ref.current.contentWindow.postMessage(JSON.stringify(event), '*');
  }, []);

  const sendViewport = useCallback(() => {
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
      },
    });
  }, [sendEvent]);

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
      if (data.eventType === 'web_app_request_viewport') {
        sendViewport();
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
      onEvent(data);
    } catch (err) {
      // Ignore other messages
    }
  }, [isSimpleView, onEvent, sendCustomStyle, sendTheme, sendViewport]);

  useEffect(() => {
    if (windowSize) {
      sendViewport();
    }
  }, [sendViewport, windowSize]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (isOpen && ref.current?.contentWindow) {
      sendViewport();
      ignoreEventsRef.current = false;
    }
  }, [isOpen, sendViewport]);

  return {
    ref, sendEvent, reloadFrame, sendViewport, sendTheme,
  };
};

export default useWebAppFrame;
