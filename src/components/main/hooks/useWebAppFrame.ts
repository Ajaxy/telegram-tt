import useWindowSize from '../../../hooks/useWindowSize';
import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';
import { extractCurrentThemeParams } from '../../../util/themeStyle';

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
  eventType: 'open_tg_link';
  eventData: string;
} | {
  eventType: 'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_close' | 'iframe_ready';
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
    };
  };
} | {
  eventType: 'set_custom_style';
  eventData: string;
} | {
  eventType: 'main_button_pressed';
};

const SCROLLBAR_STYLE = `* {
  scrollbar-width: thin;
  scrollbar-color: rgba(90,90,90,0.3) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background-color: transparent;
}

*::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background-color: rgba(90, 90, 90, 0.3);
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
        sendCustomStyle(SCROLLBAR_STYLE);
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
