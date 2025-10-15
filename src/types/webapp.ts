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

interface WebAppInboundEventMap {
  iframe_ready: { reload_supported?: boolean };
  web_app_data_send: { data: string };
  web_app_setup_main_button: WebAppButtonOptions;
  web_app_setup_secondary_button: WebAppButtonOptions;
  web_app_setup_back_button: { is_visible: boolean };
  web_app_setup_settings_button: { is_visible: boolean };
  web_app_open_link: { url: string; try_instant_view?: boolean };
  web_app_open_tg_link: { path_full: string; force_request?: boolean };
  web_app_open_invoice: { slug: string };
  web_app_trigger_haptic_feedback: {
    type: 'impact' | 'notification' | 'selection_change';
    impact_style?: 'light' | 'medium' | 'heavy';
    notification_type?: 'error' | 'success' | 'warning';
  };
  web_app_set_bottom_bar_color: { color: string };
  web_app_set_background_color: { color: string };
  web_app_set_header_color: { color_key?: 'bg_color' | 'secondary_bg_color'; color?: string };
  web_app_open_popup: PopupOptions;
  web_app_setup_closing_behavior: { need_confirmation: boolean };
  web_app_open_scan_qr_popup: { text?: string };
  web_app_read_text_from_clipboard: { req_id: string };
  web_app_switch_inline_query: {
    query: string;
    chat_types: ('users' | 'bots' | 'groups' | 'channels')[];
  };
  web_app_invoke_custom_method: { req_id: string; method: string; params: object };
  web_app_biometry_request_access: { reason: string };
  web_app_biometry_request_auth: { reason: string };
  web_app_biometry_update_token: { token: string };
  web_app_set_emoji_status: { custom_emoji_id: string; duration?: number };
  web_app_verify_age: { passed: boolean; age?: number };
  web_app_request_file_download: { url: string; file_name: string };
  web_app_send_prepared_message: { id: string };
  web_app_device_storage_save_key: {
    req_id: string;
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    value: unknown | null;
  };
  web_app_device_storage_get_key: {
    req_id: string;
    key: string;
  };
  web_app_device_storage_clear: {
    req_id: string;
  };
  web_app_secure_storage_save_key: {
    req_id: string;
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    value: unknown | null;
  };
  web_app_secure_storage_get_key: {
    req_id: string;
    key: string;
  };
  web_app_secure_storage_restore_key: {
    req_id: string;
    key: string;
  };
  web_app_secure_storage_clear: {
    req_id: string;
  };
  web_app_start_accelerometer: {
    refresh_rate?: number;
  };
  web_app_start_gyroscope: {
    refresh_rate?: number;
  };
  web_app_start_device_orientation: {
    refresh_rate?: number;
    need_absolute?: boolean;
  };

  // No payload
  web_app_request_viewport: null;
  web_app_request_theme: null;
  web_app_ready: null;
  web_app_expand: null;
  web_app_request_phone: null;
  web_app_close: null;
  web_app_close_scan_qr_popup: null;
  web_app_request_write_access: null;
  iframe_will_reload: null;
  web_app_biometry_get_info: null;
  web_app_biometry_open_settings: null;
  web_app_request_emoji_status_access: null;
  web_app_check_location: null;
  web_app_request_location: null;
  web_app_open_location_settings: null;
  web_app_request_fullscreen: null;
  web_app_exit_fullscreen: null;
  web_app_request_safe_area: null;
  web_app_request_content_safe_area: null;
  web_app_stop_accelerometer: null;
  web_app_stop_gyroscope: null;
  web_app_stop_device_orientation: null;
  web_app_add_to_home_screen: null;
  web_app_check_home_screen: null;
}

interface WebAppOutboundEventMap {
  viewport_changed: {
    height: number;
    width?: number;
    is_expanded?: boolean;
    is_state_stable?: boolean;
  };
  content_safe_area_changed: SafeArea;
  safe_area_changed: SafeArea;
  theme_changed: {
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
  set_custom_style: string;
  invoice_closed: {
    slug: string;
    status: 'paid' | 'cancelled' | 'pending' | 'failed';
  };
  phone_requested: {
    status: 'sent' | 'cancelled';
  };
  popup_closed: {
    button_id?: string;
  };
  fullscreen_changed: {
    is_fullscreen: boolean;
  };
  visibility_changed: {
    is_visible: boolean;
  };
  fullscreen_failed: {
    error: 'UNSUPPORTED' | (string & {});
  };
  qr_text_received: {
    data: string;
  };
  clipboard_text_received: {
    req_id: string;
    data: string | null;
  };
  write_access_requested: {
    status: 'allowed' | 'cancelled';
  };
  custom_method_invoked: {
    req_id: string;
  } & (
    { result: object } |
    { error: string }
  );
  biometry_info_received:
    | { available: false }
    | {
      available: true;
      type: 'finger' | 'face' | 'unknown';
      access_requested: boolean;
      access_granted: boolean;
      token_saved: boolean;
      device_id: string;
    };
  biometry_auth_requested:
    | { status: 'authorized'; token: string }
    | { status: 'failed' };
  biometry_token_updated: {
    status: 'updated' | 'removed' | 'failed';
  };
  location_checked:
    | { available: false }
    | {
      available: boolean;
      access_requested: boolean;
      access_granted?: boolean;
    };
  location_requested:
    | { available: boolean }
    | {
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
    };
  emoji_status_access_requested: {
    status: 'allowed' | 'cancelled';
  };
  access_requested: {
    available: true;
  };
  emoji_status_failed: {
    error:
      | 'UNSUPPORTED'
      | 'USER_DECLINED'
      | 'SUGGESTED_EMOJI_INVALID'
      | 'DURATION_INVALID'
      | 'SERVER_ERROR'
      | 'UNKNOWN_ERROR';
  };
  file_download_requested: {
    status: 'cancelled' | 'downloading';
  };
  prepared_message_failed: {
    error:
      | 'UNSUPPORTED'
      | 'MESSAGE_EXPIRED'
      | 'MESSAGE_SEND_FAILED'
      | 'USER_DECLINED'
      | 'UNKNOWN_ERROR';
  };
  device_storage_failed: {
    req_id: string;
    error:
      | 'UNSUPPORTED'
      | 'KEY_INVALID'
      | 'VALUE_INVALID'
      | 'QUOTA_EXCEEDED'
      | 'UNKNOWN_ERROR';
  };
  secure_storage_failed: {
    req_id: string;
    error:
      | 'UNSUPPORTED'
      | 'KEY_INVALID'
      | 'VALUE_INVALID'
      | 'QUOTA_EXCEEDED'
      | 'STORAGE_NOT_EMPTY'
      | 'RESTORE_UNAVAILABLE'
      | 'RESTORE_CANCELLED'
      | 'UNKNOWN_ERROR';
  };
  accelerometer_failed: {
    error: 'UNSUPPORTED';
  };
  gyroscope_failed: {
    error: 'UNSUPPORTED';
  };
  device_orientation_failed: {
    error: 'UNSUPPORTED';
  };
  home_screen_failed: {
    error: 'UNSUPPORTED';
  };
  home_screen_checked: {
    status: 'unsupported' | 'unknown' | 'added' | 'missed';
  };
  main_button_pressed: null;
  secondary_button_pressed: null;
  back_button_pressed: null;
  settings_button_pressed: null;
  scan_qr_popup_closed: null;
  reload_iframe: null;
  prepared_message_sent: null;
  emoji_status_set: null;
}

export type WebAppInboundEvent =
  { [K in keyof WebAppInboundEventMap]:
    WebAppEvent<K, WebAppInboundEventMap[K]>
  }[keyof WebAppInboundEventMap];

export type WebAppOutboundEvent =
  { [K in keyof WebAppOutboundEventMap]:
    WebAppEvent<K, WebAppOutboundEventMap[K]>
  }[keyof WebAppOutboundEventMap];
