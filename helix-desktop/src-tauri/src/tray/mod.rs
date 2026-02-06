// Helix Desktop - System Tray Module (Phase J2 Enhanced)

pub mod menu;

use tauri::{
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::tray::menu::{build_tray_menu, create_tray_menu, TrayMenuState};

// ── Tray icon ID ───────────────────────────────────────────────────────────────

/// The well-known ID for the Helix tray icon so we can look it up later.
const TRAY_ID: &str = "helix-tray";

// ── Initialization ─────────────────────────────────────────────────────────────

/// Initialize the system tray with the default menu.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<TrayIcon<R>, Box<dyn std::error::Error>> {
    let menu = create_tray_menu(app)?;

    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(false)
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

// ── Tray icon events ───────────────────────────────────────────────────────────

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

// ── Window helpers ─────────────────────────────────────────────────────────────

/// Show the main window.
pub fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Hide the main window.
#[allow(dead_code)]
pub fn hide_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Toggle window visibility.
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

// ── Dynamic tray update (Tauri command) ────────────────────────────────────────

/// Rebuild the system tray menu with updated state from the frontend.
///
/// The frontend calls this command whenever gateway status, agent list,
/// channel list, or pending approvals change.
///
/// Arguments:
/// - `gateway_status` - "running" | "stopped" (case-insensitive)
/// - `agents` - list of `[name, status]` pairs
/// - `channels` - list of `[name, status]` pairs
/// - `pending_approvals` - number of pending approval items
#[tauri::command]
pub async fn update_tray_menu(
    app: tauri::AppHandle,
    gateway_status: String,
    agents: Vec<(String, String)>,
    channels: Vec<(String, String)>,
    pending_approvals: u32,
) -> Result<(), String> {
    // Determine window visibility for the Show/Hide label
    let window_visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);

    let state = TrayMenuState {
        gateway_running: gateway_status.eq_ignore_ascii_case("running"),
        agents,
        channels,
        pending_approvals,
        window_visible,
        talk_mode_active: false, // Frontend can extend this later
    };

    // Build the new menu
    let menu = build_tray_menu(&app, &state).map_err(|e| {
        log::error!("Failed to build tray menu: {}", e);
        format!("Failed to build tray menu: {}", e)
    })?;

    // Find the existing tray icon and swap its menu
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu)).map_err(|e| {
            log::error!("Failed to set tray menu: {}", e);
            format!("Failed to set tray menu: {}", e)
        })?;
    } else {
        log::warn!("Tray icon '{}' not found; cannot update menu", TRAY_ID);
        return Err(format!("Tray icon '{}' not found", TRAY_ID));
    }

    Ok(())
}
