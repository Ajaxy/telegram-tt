use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use serde_json::json;
use tauri::{Emitter, LogicalPosition, Manager, webview::DownloadEvent};
use url::Url;
use uuid::Uuid;

mod deeplink;
use deeplink::Deeplink;

mod tray;
mod window;
use crate::window::{WINDOW_STATES, WindowState};

#[cfg(target_os = "macos")]
mod mac;

#[derive(Debug)]
pub struct AppStateStruct {
  pub notification_count: i32,
  pub is_muted: bool,
}

impl Default for AppStateStruct {
  fn default() -> Self {
    Self {
      notification_count: 0,
      is_muted: false,
    }
  }
}

pub type AppState = Mutex<AppStateStruct>;

pub const TRAFFIC_LIGHT_POSITION_OVERLAY_LEGACY: LogicalPosition<f64> = LogicalPosition::new(12.0, 26.0);
pub const TRAFFIC_LIGHT_POSITION_OVERLAY_26: LogicalPosition<f64> = LogicalPosition::new(12.0, 30.0);
pub const TRAFFIC_LIGHT_POSITION_DEFAULT: LogicalPosition<f64> = LogicalPosition::new(12.0, 12.0);

pub static TRAFFIC_LIGHT_POSITION_OVERLAY: LazyLock<LogicalPosition<f64>> = LazyLock::new(|| {
  if let tauri_plugin_os::Version::Semantic(major, _, _) = tauri_plugin_os::version() {
      if major >= 26 {
          return TRAFFIC_LIGHT_POSITION_OVERLAY_26;
      }
  }
  TRAFFIC_LIGHT_POSITION_OVERLAY_LEGACY
});

pub const WINDOW_WIDTH: f64 = 1088.0;
pub const WINDOW_HEIGHT: f64 = 700.0;
pub const WINDOW_MIN_WIDTH: f64 = 360.0;
pub const WINDOW_MIN_HEIGHT: f64 = 200.0;

pub static LAST_URL: LazyLock<std::sync::Mutex<String>> =
  LazyLock::new(|| std::sync::Mutex::new(BASE_URL.to_string()));

pub const DEFAULT_WINDOW_TITLE: &str = match std::option_env!("APP_TITLE") {
  Some(title) => title,
  None => "Telegram Air",
};

pub const BASE_URL: &str = match std::option_env!("BASE_URL") {
  Some(url) => url,
  None => "http://localhost:1234",
};

pub const WITH_UPDATER: &str = match std::option_env!("WITH_UPDATER") {
  Some(str) => str,
  None => "false",
};

pub(crate) fn strip_hash_from_url(url: &str) -> String {
  if let Ok(mut parsed_url) = Url::parse(url) {
    parsed_url.set_fragment(None);
    parsed_url.to_string()
  } else {
    url.to_string()
  }
}

pub(crate) fn save_window_url(app: &tauri::AppHandle, window_label: &str) {
  if let Some(webview_window) = app.get_webview_window(window_label) {
    if let Ok(current_url) = webview_window.url() {
      let url_without_hash = strip_hash_from_url(current_url.as_str());
      if let Ok(mut last_url) = LAST_URL.lock() {
        *last_url = url_without_hash;
      }
    }
  }
}

pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      let active_windows = app.windows();
      if active_windows.len() >= 1 {
        let window = active_windows.values().next().unwrap();
        window.set_focus().unwrap_or_default();
      } else {
        open_new_window(app.clone(), BASE_URL.to_string()).unwrap();
      }
    }))
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_process::init());

  let app = app.on_window_event(|window, event| match event {
    tauri::WindowEvent::CloseRequested { api, .. } => {
      let active_windows = window.app_handle().windows();

      if active_windows.len() == 1 {
        // Save current URL before hiding the last window
        save_window_url(&window.app_handle(), window.label());

        #[cfg(target_os = "macos")]
        window.app_handle().hide().unwrap_or_default();
        #[cfg(not(target_os = "macos"))]
        window.hide().unwrap_or_default();
        api.prevent_close();
      }
    }
    tauri::WindowEvent::ThemeChanged(_) => {
      #[cfg(target_os = "macos")]
      if let Some(base_window) = window.app_handle().get_window(window.label()) {
        if let Ok(mut states) = WINDOW_STATES.lock() {
          if let Some(state) = states.get_mut(window.label()) {
            let title = if state.is_overlay {
              "".to_string()
            } else {
              state.title.clone()
            };
            let traffic_position = if state.is_overlay {
              *TRAFFIC_LIGHT_POSITION_OVERLAY
            } else {
              TRAFFIC_LIGHT_POSITION_DEFAULT
            };
            mac::update_window_title(base_window.clone(), title, traffic_position);
          }
        }
      }
    }
    tauri::WindowEvent::Destroyed => {
      if let Ok(mut states) = WINDOW_STATES.lock() {
        states.remove(window.label());
      }
    }
    _ => {}
  });

  let app = app.setup(|app| {
    // Manage app state
    app.manage(AppState::new(AppStateStruct::default()));

    let _main_window = open_new_window(app.handle().clone(), BASE_URL.to_string())
      .expect("Failed to open main window");

    let deeplink = Deeplink::init();
    if let Err(err) = deeplink.setup(app.handle()) {
      log::error!("Failed to setup deeplink: {:?}", err);
    }

    if WITH_UPDATER == "true" {
      app
        .handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
    }

    crate::tray::TrayManager::init(app.handle().clone())?;

    Ok(())
  });

  let app = app.invoke_handler(tauri::generate_handler![
    mark_title_bar_overlay,
    set_notifications_count,
    set_window_title,
    open_new_window_cmd,
    save_current_url,
    set_menu_translations
  ]);

  app
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
#[cfg(target_os = "macos")]
fn mark_title_bar_overlay(window: tauri::WebviewWindow, is_overlay: bool) {
  use crate::mac;

  if let Ok(mut states) = WINDOW_STATES.lock() {
    if let Some(state) = states.get_mut(window.label()) {
      state.is_overlay = is_overlay;
    }
  }

  if is_overlay {
    window
      .set_title_bar_style(tauri::utils::TitleBarStyle::Overlay)
      .unwrap_or_default();

    if let Some(base_window) = window.app_handle().get_window(window.label()) {
      // Empty title keeps original behaviour but triggers the reposition.
      mac::update_window_title(
        base_window.clone(),
        "".to_string(),
        *TRAFFIC_LIGHT_POSITION_OVERLAY,
      );
    }
  } else {
    window
      .set_title_bar_style(tauri::utils::TitleBarStyle::Visible)
      .unwrap_or_default();

    // Determine the title we should restore.
    let mut title_to_set = DEFAULT_WINDOW_TITLE.to_string();
    if let Ok(states) = WINDOW_STATES.lock() {
      if let Some(state) = states.get(window.label()) {
        title_to_set = state.title.clone();
      }
    }

    if let Some(base_window) = window.app_handle().get_window(window.label()) {
      mac::update_window_title(
        base_window.clone(),
        title_to_set,
        TRAFFIC_LIGHT_POSITION_DEFAULT,
      );
    }
  }
}

#[tauri::command]
#[cfg(not(target_os = "macos"))]
#[allow(unused_variables)]
fn mark_title_bar_overlay(window: tauri::WebviewWindow, is_overlay: bool) {
  // noop
}

#[tauri::command]
fn set_notifications_count(
  window: tauri::WebviewWindow,
  amount: i32,
  is_muted: bool,
  state: tauri::State<'_, AppState>,
) {
  // Update app state
  if let Ok(mut app_state) = state.lock() {
    app_state.notification_count = amount;
    app_state.is_muted = is_muted;
  }

  crate::tray::set_notifications_count(&window, amount, is_muted);
}

#[tauri::command]
fn set_menu_translations(translations: HashMap<String, String>) {
  crate::tray::set_menu_translations(translations);
}

#[tauri::command]
fn set_window_title(window: tauri::WebviewWindow, title: String) {
  if let Ok(mut states) = WINDOW_STATES.lock() {
    if let Some(state) = states.get_mut(window.label()) {
      state.title = title.clone();
      if !state.is_overlay {
        window.set_title(&title).unwrap_or_default();
      }
    }
  }
}

#[tauri::command]
async fn open_new_window_cmd(app: tauri::AppHandle, url: String) -> bool {
  open_new_window(app, url).is_ok()
}

#[tauri::command]
fn save_current_url(window: tauri::WebviewWindow) {
  if let Ok(current_url) = window.url() {
    let url_without_hash = strip_hash_from_url(current_url.as_str());
    if let Ok(mut last_url) = LAST_URL.lock() {
      *last_url = url_without_hash;
    }
  }
}

pub(crate) fn open_new_window(
  app: tauri::AppHandle,
  url: String,
) -> Result<tauri::WebviewWindow, tauri::Error> {
  let window_label = Uuid::new_v4().to_string();
  let new_window_builder = tauri::WebviewWindowBuilder::new(
    &app,
    window_label.clone(),
    tauri::WebviewUrl::App(url.into()),
  )
  .additional_browser_args("--autoplay-policy=no-user-gesture-required")
  .fullscreen(false)
  .resizable(true)
  .title(DEFAULT_WINDOW_TITLE)
  .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
  .min_inner_size(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)
  .disable_drag_drop_handler() // Required for Drag & Drop on Windows
  .initialization_script(&format!(
    "window.tauri = {{ version: '{}' }};",
    env!("CARGO_PKG_VERSION")
  ))
  .on_download(|window, event| {
    match event {
      #[allow(unused_variables)]
      DownloadEvent::Requested { destination, .. } => {
        // On macOS, Webview does not provide basic download logic
        #[cfg(target_os = "macos")]
        if let Some(filename) = destination.file_name() {
          if let Ok(downloads_dir) = window.app_handle().path().download_dir() {
            let new_destination = downloads_dir.join(filename);
            *destination = new_destination;
          }
        }
      }
      DownloadEvent::Finished { url, success, .. } => {
        window
          .emit_to(
            window.label(),
            "download-finished",
            json!({
              "url": url.to_string(),
              "success": success
            }),
          )
          .unwrap_or_default();
      }
      _ => {}
    };
    true
  });

  if let Ok(mut states) = WINDOW_STATES.lock() {
    let new_state = WindowState {
      title: DEFAULT_WINDOW_TITLE.to_string(),
      is_overlay: cfg!(target_os = "macos"),
    };
    states.insert(window_label.to_string(), new_state);
  }

  #[cfg(target_os = "macos")]
  let new_window_builder = new_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);
  #[cfg(target_os = "macos")]
  let new_window_builder = new_window_builder.title("");

  let window = new_window_builder.build()?;

  #[cfg(target_os = "macos")]
  if let Some(base_window) = app.get_window(&window_label) {
    mac::setup_traffic_light_positioner(&base_window, *TRAFFIC_LIGHT_POSITION_OVERLAY);
  }

  // Apply stored notification count to the new window
  if let Some(state) = app.try_state::<AppState>() {
    if let Ok(app_state) = state.lock() {
      crate::tray::set_notifications_count(
        &window,
        app_state.notification_count,
        app_state.is_muted,
      );
    }
  }

  Ok(window)
}
