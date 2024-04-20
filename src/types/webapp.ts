export type PopupOptions = {
  title: string;
  message: string;
  buttons: {
    id: string;
    type: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text: string;
  }[];
};

type WebAppEvent<T, D> = D extends null ? {
  eventType: T;
  eventData?: undefined;
} : {
  eventType: T;
  eventData: D;
};

export type WebAppInboundEvent =
  WebAppEvent<'iframe_ready', {
    reload_supported?: boolean;
  }> |
  WebAppEvent<'web_app_data_send', {
    data: string;
  }> |
  WebAppEvent<'web_app_setup_main_button', {
    is_visible: boolean;
    is_active: boolean;
    text: string;
    color: string;
    text_color: string;
    is_progress_visible: boolean;
  }> |
  WebAppEvent<'web_app_setup_back_button', {
    is_visible: boolean;
  }> |
  WebAppEvent<'web_app_setup_settings_button', {
    is_visible: boolean;
  }> |
  WebAppEvent<'web_app_open_link', {
    url: string;
    try_instant_view?: boolean;
  }> |
  WebAppEvent<'web_app_open_tg_link', {
    path_full: string;
  }> |
  WebAppEvent<'web_app_open_invoice', {
    slug: string;
  }> |
  WebAppEvent<'web_app_trigger_haptic_feedback', {
    type: 'impact' | 'notification' | 'selection_change';
    impact_style?: 'light' | 'medium' | 'heavy';
    notification_type?: 'error' | 'success' | 'warning';
  }> |
  WebAppEvent<'web_app_set_background_color', {
    color: string;
  }> |
  WebAppEvent<'web_app_set_header_color', {
    color_key?: 'bg_color' | 'secondary_bg_color';
    color?: string;
  }> |
  WebAppEvent<'web_app_open_popup', PopupOptions> |
  WebAppEvent<'web_app_setup_closing_behavior', {
    need_confirmation: boolean;
  }> |
  WebAppEvent<'web_app_open_scan_qr_popup', {
    text?: string;
  }> |
  WebAppEvent<'web_app_read_text_from_clipboard', {
    req_id: string;
  }> |
  WebAppEvent<'web_app_switch_inline_query', {
    query: string;
    chat_types: ('users' | 'bots' | 'groups' | 'channels')[];
  }> |
  WebAppEvent<'web_app_invoke_custom_method', {
    req_id: string;
    method: string;
    params: object;
  }> |
  WebAppEvent<'web_app_biometry_request_access', {
    reason: string;
  }> |
  WebAppEvent<'web_app_biometry_request_auth', {
    reason: string;
  }> |
  WebAppEvent<'web_app_biometry_update_token', {
    token: string;
  }> |
  WebAppEvent<'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_request_phone' | 'web_app_close' | 'web_app_close_scan_qr_popup'
  | 'web_app_request_write_access' | 'web_app_request_phone' | 'iframe_will_reload'
  | 'web_app_biometry_get_info' | 'web_app_biometry_open_settings', null>;

export type WebAppOutboundEvent =
  WebAppEvent<'viewport_changed', {
    height: number;
    width?: number;
    is_expanded?: boolean;
    is_state_stable?: boolean;
  }> |
  WebAppEvent<'theme_changed', {
    theme_params: {
      bg_color: string;
      text_color: string;
      hint_color: string;
      link_color: string;
      button_color: string;
      button_text_color: string;
      secondary_bg_color: string;
    };
  }> |
  WebAppEvent<'set_custom_style', string> |
  WebAppEvent<'invoice_closed', {
    slug: string;
    status: 'paid' | 'cancelled' | 'pending' | 'failed';
  }> |
  WebAppEvent<'phone_requested', {
    phone_number: string;
  }> |
  WebAppEvent<'popup_closed', {
    button_id?: string;
  }> |
  WebAppEvent<'qr_text_received', {
    data: string;
  }> |
  WebAppEvent<'clipboard_text_received', {
    req_id: string;
    data: string | null;
  }> |
  WebAppEvent<'write_access_requested', {
    status: 'allowed' | 'cancelled';
  }> |
  WebAppEvent<'phone_requested', {
    status: 'sent' | 'cancelled';
  }> |
  WebAppEvent<'custom_method_invoked', {
    req_id: string;
  } & ({
    result: object;
  } | {
    error: string;
  })> |
  WebAppEvent<'biometry_info_received', {
    available: false;
  } | {
    available: true;
    type: 'finger' | 'face' | 'unknown';
    access_requested: boolean;
    access_granted: boolean;
    token_saved: boolean;
    device_id: string;
  }> |
  WebAppEvent<'biometry_auth_requested', {
    status: 'authorized';
    token: string;
  } | {
    status: 'failed';
  }> |
  WebAppEvent<'biometry_token_updated', {
    status: 'updated' | 'removed' | 'failed';
  }> |
  WebAppEvent<'main_button_pressed' | 'back_button_pressed' | 'settings_button_pressed' | 'scan_qr_popup_closed'
  | 'reload_iframe', null>;
