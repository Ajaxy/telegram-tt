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
  eventType: 'iframe_ready';
  eventData: {
    reload_supported?: boolean;
  };
} | {
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
  eventType: 'web_app_setup_settings_button';
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
    color_key?: 'bg_color' | 'secondary_bg_color';
    color?: string;
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
  eventType: 'web_app_switch_inline_query';
  eventData: {
    query: string;
    chat_types: ('users' | 'bots' | 'groups' | 'channels')[];
  };
} | {
  eventType: 'web_app_invoke_custom_method';
  eventData: {
    req_id: string;
    method: string;
    params: object;
  };
} | {
  eventType: 'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_request_phone' | 'web_app_close' | 'web_app_close_scan_qr_popup'
  | 'web_app_request_write_access' | 'web_app_request_phone' | 'iframe_will_reload';
  eventData: null;
};

export type WebAppOutboundEvent = {
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
  eventType: 'write_access_requested';
  eventData: {
    status: 'allowed' | 'cancelled';
  };
} | {
  eventType: 'phone_requested';
  eventData: {
    status: 'sent' | 'cancelled';
  };
} | {
  eventType: 'custom_method_invoked';
  eventData: {
    req_id: string;
  } & ({
    result: object;
  } | {
    error: string;
  });
} | {
  eventType: 'main_button_pressed' | 'back_button_pressed' | 'settings_button_pressed' | 'scan_qr_popup_closed'
  | 'reload_iframe';
};
