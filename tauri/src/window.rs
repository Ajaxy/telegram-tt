use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Clone)]
pub struct WindowState {
  pub title: String,
  pub is_overlay: bool,
}

pub static WINDOW_STATES: LazyLock<std::sync::Mutex<HashMap<String, WindowState>>> =
  LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));
