import type { ApiInputMessageReplyInfo } from '../api/types';

export type WebAppModalStateType = 'fullScreen' | 'maximized' | 'minimized';

export type WebApp = {
  url: string;
  requestUrl?: string;
  botId: string;
  appName?: string;
  buttonText: string;
  peerId?: string;
  queryId?: string;
  slug?: string;
  replyInfo?: ApiInputMessageReplyInfo;
  canSendMessages?: boolean;
  isRemoveModalOpen?: boolean;
  isCloseModalOpen?: boolean;
  shouldConfirmClosing?: boolean;
  headerColor?: string;
  backgroundColor?: string;
  isBackButtonVisible?: boolean;
  isSettingsButtonVisible?: boolean;
  plannedEvents?: WebAppOutboundEvent[];
  sendEvent?: (event: WebAppOutboundEvent) => void;
  reloadFrame?: (url: string) => void;
};

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

export type WebAppButtonOptions = {
  is_visible: boolean;
  is_active: boolean;
  text: string;
  color: string;
  text_color: string;
  is_progress_visible: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
};

export type SafeArea = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type WebAppInboundEvent =
  WebAppEvent<'iframe_ready', {
    reload_supported?: boolean;
  }> |
  WebAppEvent<'web_app_data_send', {
    data: string;
  }> |
  WebAppEvent<'web_app_setup_main_button', WebAppButtonOptions> |
  WebAppEvent<'web_app_setup_secondary_button', WebAppButtonOptions> |
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
    force_request?: boolean;
  }> |
  WebAppEvent<'web_app_open_invoice', {
    slug: string;
  }> |
  WebAppEvent<'web_app_trigger_haptic_feedback', {
    type: 'impact' | 'notification' | 'selection_change';
    impact_style?: 'light' | 'medium' | 'heavy';
    notification_type?: 'error' | 'success' | 'warning';
  }> |
  WebAppEvent<'web_app_set_bottom_bar_color', {
    color: string;
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
  WebAppEvent<'web_app_set_emoji_status', {
    custom_emoji_id: string;
    duration?: number;
  }> |
  WebAppEvent<'web_app_request_file_download', {
    url: string;
    file_name: string;
  }> |
  WebAppEvent<'web_app_send_prepared_message', {
    id: string;
  }> |
  WebAppEvent<'web_app_request_viewport' | 'web_app_request_theme' | 'web_app_ready' | 'web_app_expand'
  | 'web_app_request_phone' | 'web_app_close' | 'web_app_close_scan_qr_popup'
  | 'web_app_request_write_access' | 'iframe_will_reload'
  | 'web_app_biometry_get_info' | 'web_app_biometry_open_settings' | 'web_app_request_emoji_status_access'
  | 'web_app_check_location' | 'web_app_request_location' | 'web_app_open_location_settings'
  | 'web_app_request_fullscreen' | 'web_app_exit_fullscreen'
  | 'web_app_request_safe_area' | 'web_app_request_content_safe_area',
  null>;

export type WebAppOutboundEvent =
  WebAppEvent<'viewport_changed', {
    height: number;
    width?: number;
    is_expanded?: boolean;
    is_state_stable?: boolean;
  }> |
  WebAppEvent<'content_safe_area_changed', SafeArea> |
  WebAppEvent<'safe_area_changed', SafeArea> |
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
  WebAppEvent<'fullscreen_changed', {
    is_fullscreen: boolean;
  }> |
  WebAppEvent<'visibility_changed', {
    is_visible: boolean;
  }> |
  WebAppEvent<'fullscreen_failed', {
    error: 'UNSUPPORTED' | string;
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
  WebAppEvent<'location_checked', {
    available: false;
  } | {
    available: boolean;
    access_requested: boolean;
    access_granted?: boolean;
  }> |
  WebAppEvent<'location_requested', {
    available: boolean;
  } | {
    available: boolean;
    latitude: number;
    longitude: number;
    altitude: number | null;
    course: number | null;
    speed: number | null;
    horizontal_accuracy: number | null;
    vertical_accuracy: number | null;
    course_accuracy: number | null;
    speed_accuracy: number | null;
  }> |
  WebAppEvent<'emoji_status_access_requested', {
    status: 'allowed' | 'cancelled';
  }> |
  WebAppEvent<'access_requested', {
    available: true;
  }> |
  WebAppEvent<'emoji_status_failed', {
    error: 'UNSUPPORTED' | 'USER_DECLINED' | 'SUGGESTED_EMOJI_INVALID'
    | 'DURATION_INVALID' | 'SERVER_ERROR' | 'UNKNOWN_ERROR';
  }> |
  WebAppEvent<'file_download_requested', {
    status: 'cancelled' | 'downloading';
  }> |
  WebAppEvent<'prepared_message_failed', {
    error: 'UNSUPPORTED' | 'MESSAGE_EXPIRED' | 'MESSAGE_SEND_FAILED'
    | 'USER_DECLINED' | 'UNKNOWN_ERROR';
  }> |
  WebAppEvent<'main_button_pressed' |
  'secondary_button_pressed' | 'back_button_pressed' | 'settings_button_pressed' | 'scan_qr_popup_closed'
  | 'reload_iframe' | 'prepared_message_sent' | 'emoji_status_set', null>;
