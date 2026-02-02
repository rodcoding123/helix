// Helix Desktop - System Tray Module

pub mod menu;

use tauri::{
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::tray::menu::create_tray_menu;

/// Initialize the system tray
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<TrayIcon<R>, Box<dyn std::error::Error>> {
    let menu = create_tray_menu(app)?;

    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .menu_on_left_click(false)
        .tooltip("Helix")
        .on_tray_icon_event(|tray, event| {
            handle_tray_event(tray, event);
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .build(app)?;

    Ok(tray)
}

/// Handle tray icon events (click, double-click, etc.)
fn handle_tray_event<R: Runtime>(tray: &TrayIcon<R>, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click { button, .. } => {
            if button == tauri::tray::MouseButton::Left {
                // Show/focus the main window on left click
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        TrayIconEvent::DoubleClick { .. } => {
            // Double-click also shows the window
            if let Some(window) = tray.app_handle().get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

/// Show the main window
pub fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Hide the main window
pub fn hide_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Toggle window visibility
pub fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
