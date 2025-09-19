// https://github.com/mountain-loop/yaak/blob/c09083ddec2bd995d7c21493ac50adf27f0f3fca/src-tauri/yaak-mac-window/src/mac.rs
#![allow(deprecated)]
use objc::{msg_send, sel, sel_impl};
use tauri::{Emitter, LogicalPosition, Runtime, Window};

struct UnsafeWindowHandle(*mut std::ffi::c_void);

unsafe impl Send for UnsafeWindowHandle {}

unsafe impl Sync for UnsafeWindowHandle {}

pub(crate) fn update_window_title<R: Runtime>(
  window: Window<R>,
  title: String,
  traffic_position: LogicalPosition<f64>,
) {
  use cocoa::{appkit::NSWindow, base::nil, foundation::NSString};

  unsafe {
    let window_handle = UnsafeWindowHandle(window.ns_window().unwrap());

    let window2 = window.clone();
    let _ = window.run_on_main_thread(move || {
      let win_title = NSString::alloc(nil).init_str(&title);
      let handle = window_handle;
      NSWindow::setTitle_(handle.0 as cocoa::base::id, win_title);
      position_traffic_lights(
        UnsafeWindowHandle(window2.ns_window().expect("Failed to create window handle")),
        traffic_position,
      );
    });
  }
}

fn position_traffic_lights(ns_window_handle: UnsafeWindowHandle, position: LogicalPosition<f64>) {
  use cocoa::appkit::{NSView, NSWindow, NSWindowButton};
  use cocoa::foundation::NSRect;

  let x = position.x;
  let y = position.y;

  let ns_window = ns_window_handle.0 as cocoa::base::id;
  #[allow(unexpected_cfgs)]
  unsafe {
    let close = ns_window.standardWindowButton_(NSWindowButton::NSWindowCloseButton);
    let miniaturize = ns_window.standardWindowButton_(NSWindowButton::NSWindowMiniaturizeButton);
    let zoom = ns_window.standardWindowButton_(NSWindowButton::NSWindowZoomButton);

    let title_bar_container_view = close.superview().superview();

    let close_rect: NSRect = msg_send![close, frame];
    let button_height = close_rect.size.height;

    let title_bar_frame_height = button_height + y;
    let mut title_bar_rect = NSView::frame(title_bar_container_view);
    title_bar_rect.size.height = title_bar_frame_height;
    title_bar_rect.origin.y = NSView::frame(ns_window).size.height - title_bar_frame_height;
    let _: () = msg_send![title_bar_container_view, setFrame: title_bar_rect];

    let window_buttons = vec![close, miniaturize, zoom];
    let space_between = NSView::frame(miniaturize).origin.x - NSView::frame(close).origin.x;

    for (i, button) in window_buttons.into_iter().enumerate() {
      let mut rect: NSRect = NSView::frame(button);
      rect.origin.x = x + (i as f64 * space_between);
      button.setFrameOrigin(rect.origin);
    }
  }
}

#[derive(Debug)]
struct WindowState<R: Runtime> {
  window: Window<R>,
  // Store desired position of traffic lights to avoid capturing external env in callbacks
  traffic_position: LogicalPosition<f64>,
}

pub fn setup_traffic_light_positioner<R: Runtime>(
  window: &Window<R>,
  traffic_position: LogicalPosition<f64>,
) {
  use cocoa::appkit::NSWindow;
  use cocoa::base::{BOOL, id};
  use cocoa::delegate;
  use cocoa::foundation::NSUInteger;
  use objc::runtime::{Object, Sel};
  use rand::Rng;
  use rand::distr::Alphanumeric;
  use std::ffi::c_void;

  position_traffic_lights(
    UnsafeWindowHandle(window.ns_window().expect("Failed to create window handle")),
    traffic_position,
  );

  // Ensure they stay in place while resizing the window.
  fn with_window_state<R: Runtime, F: FnOnce(&mut WindowState<R>) -> T, T>(this: &Object, func: F) {
    let ptr = unsafe {
      let x: *mut c_void = *this.get_ivar("app_box");
      &mut *(x as *mut WindowState<R>)
    };
    func(ptr);
  }

  #[allow(unexpected_cfgs)]
  unsafe {
    let ns_win = window
      .ns_window()
      .expect("NS Window should exist to mount traffic light delegate.") as id;

    let current_delegate: id = ns_win.delegate();

    extern "C" fn on_window_should_close(this: &Object, _cmd: Sel, sender: id) -> BOOL {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        msg_send![super_del, windowShouldClose: sender]
      }
    }
    extern "C" fn on_window_will_close(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowWillClose: notification];
      }
    }
    extern "C" fn on_window_did_resize<R: Runtime>(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        with_window_state(&*this, |state: &mut WindowState<R>| {
          let id = state
            .window
            .ns_window()
            .expect("NS window should exist on state to handle resize") as id;

          position_traffic_lights(
            UnsafeWindowHandle(id as *mut c_void),
            state.traffic_position,
          );
        });

        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidResize: notification];
      }
    }
    extern "C" fn on_window_did_move(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidMove: notification];
      }
    }
    extern "C" fn on_window_did_change_backing_properties(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidChangeBackingProperties: notification];
      }
    }
    extern "C" fn on_window_did_become_key(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidBecomeKey: notification];
      }
    }
    extern "C" fn on_window_did_resign_key(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidResignKey: notification];
      }
    }
    extern "C" fn on_dragging_entered(this: &Object, _cmd: Sel, notification: id) -> BOOL {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        msg_send![super_del, draggingEntered: notification]
      }
    }
    extern "C" fn on_prepare_for_drag_operation(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) -> BOOL {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        msg_send![super_del, prepareForDragOperation: notification]
      }
    }
    extern "C" fn on_perform_drag_operation(this: &Object, _cmd: Sel, sender: id) -> BOOL {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        msg_send![super_del, performDragOperation: sender]
      }
    }
    extern "C" fn on_conclude_drag_operation(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, concludeDragOperation: notification];
      }
    }
    extern "C" fn on_dragging_exited(this: &Object, _cmd: Sel, notification: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, draggingExited: notification];
      }
    }
    extern "C" fn on_window_will_use_full_screen_presentation_options(
      this: &Object,
      _cmd: Sel,
      window: id,
      proposed_options: NSUInteger,
    ) -> NSUInteger {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        msg_send![super_del, window: window willUseFullScreenPresentationOptions: proposed_options]
      }
    }
    extern "C" fn on_window_did_enter_full_screen<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        with_window_state(&*this, |state: &mut WindowState<R>| {
          state
            .window
            .emit("did-enter-fullscreen", ())
            .expect("Failed to emit event");
        });

        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidEnterFullScreen: notification];
      }
    }
    extern "C" fn on_window_will_enter_full_screen<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        with_window_state(&*this, |state: &mut WindowState<R>| {
          state
            .window
            .emit("will-enter-fullscreen", ())
            .expect("Failed to emit event");
        });

        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowWillEnterFullScreen: notification];
      }
    }
    extern "C" fn on_window_did_exit_full_screen<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        with_window_state(&*this, |state: &mut WindowState<R>| {
          state
            .window
            .emit("did-exit-fullscreen", ())
            .expect("Failed to emit event");

          let id = state.window.ns_window().expect("Failed to emit event") as id;
          position_traffic_lights(
            UnsafeWindowHandle(id as *mut c_void),
            state.traffic_position,
          );
        });

        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidExitFullScreen: notification];
      }
    }
    extern "C" fn on_window_will_exit_full_screen<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        with_window_state(&*this, |state: &mut WindowState<R>| {
          state
            .window
            .emit("will-exit-fullscreen", ())
            .expect("Failed to emit event");
        });

        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowWillExitFullScreen: notification];
      }
    }
    extern "C" fn on_window_did_fail_to_enter_full_screen(this: &Object, _cmd: Sel, window: id) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, windowDidFailToEnterFullScreen: window];
      }
    }
    extern "C" fn on_effective_appearance_did_change<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![super_del, effectiveAppearanceDidChange: notification];
      }
    }
    extern "C" fn on_effective_appearance_did_changed_on_main_thread<R: Runtime>(
      this: &Object,
      _cmd: Sel,
      notification: id,
    ) {
      unsafe {
        let super_del: id = *this.get_ivar("super_delegate");
        let _: () = msg_send![
            super_del,
            effectiveAppearanceDidChangedOnMainThread: notification
        ];
      }
    }

    // Are we de-allocing this properly? (I miss safe Rust :(  )
    let window_label = window.label().to_string();

    let app_state = WindowState {
      window: window.clone(),
      traffic_position,
    };
    let app_box = Box::into_raw(Box::new(app_state)) as *mut c_void;
    let random_str: String = rand::rng()
      .sample_iter(&Alphanumeric)
      .take(20)
      .map(char::from)
      .collect();

    // We need to ensure we have a unique delegate name, otherwise we will panic while trying to create a duplicate
    // delegate with the same name.
    let delegate_name = format!("windowDelegate_{}_{}", window_label, random_str);

    ns_win.setDelegate_(delegate!(&delegate_name, {
            window: id = ns_win,
            app_box: *mut c_void = app_box,
            toolbar: id = cocoa::base::nil,
            super_delegate: id = current_delegate,
            (windowShouldClose:) => on_window_should_close as extern "C" fn(&Object, Sel, id) -> BOOL,
            (windowWillClose:) => on_window_will_close as extern "C" fn(&Object, Sel, id),
            (windowDidResize:) => on_window_did_resize::<R> as extern "C" fn(&Object, Sel, id),
            (windowDidMove:) => on_window_did_move as extern "C" fn(&Object, Sel, id),
            (windowDidChangeBackingProperties:) => on_window_did_change_backing_properties as extern "C" fn(&Object, Sel, id),
            (windowDidBecomeKey:) => on_window_did_become_key as extern "C" fn(&Object, Sel, id),
            (windowDidResignKey:) => on_window_did_resign_key as extern "C" fn(&Object, Sel, id),
            (draggingEntered:) => on_dragging_entered as extern "C" fn(&Object, Sel, id) -> BOOL,
            (prepareForDragOperation:) => on_prepare_for_drag_operation as extern "C" fn(&Object, Sel, id) -> BOOL,
            (performDragOperation:) => on_perform_drag_operation as extern "C" fn(&Object, Sel, id) -> BOOL,
            (concludeDragOperation:) => on_conclude_drag_operation as extern "C" fn(&Object, Sel, id),
            (draggingExited:) => on_dragging_exited as extern "C" fn(&Object, Sel, id),
            (window:willUseFullScreenPresentationOptions:) => on_window_will_use_full_screen_presentation_options as extern "C" fn(&Object, Sel, id, NSUInteger) -> NSUInteger,
            (windowDidEnterFullScreen:) => on_window_did_enter_full_screen::<R> as extern "C" fn(&Object, Sel, id),
            (windowWillEnterFullScreen:) => on_window_will_enter_full_screen::<R> as extern "C" fn(&Object, Sel, id),
            (windowDidExitFullScreen:) => on_window_did_exit_full_screen::<R> as extern "C" fn(&Object, Sel, id),
            (windowWillExitFullScreen:) => on_window_will_exit_full_screen::<R> as extern "C" fn(&Object, Sel, id),
            (windowDidFailToEnterFullScreen:) => on_window_did_fail_to_enter_full_screen as extern "C" fn(&Object, Sel, id),
            (effectiveAppearanceDidChange:) => on_effective_appearance_did_change::<R> as extern "C" fn(&Object, Sel, id),
            (effectiveAppearanceDidChangedOnMainThread:) => on_effective_appearance_did_changed_on_main_thread::<R> as extern "C" fn(&Object, Sel, id)
        }))
  }
}
