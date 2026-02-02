// Helix Desktop - Tray Menu Definition

use tauri::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    AppHandle, Emitter, Runtime,
};

// Menu item IDs
pub const MENU_SHOW_HIDE: &str = "show_hide";
pub const MENU_NEW_CHAT: &str = "new_chat";
pub const MENU_SETTINGS: &str = "settings";
pub const MENU_QUIT: &str = "quit";

/// Create the tray menu
pub fn create_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let show_hide = MenuItem::with_id(app, MENU_SHOW_HIDE, "Show/Hide Helix", true, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, MENU_NEW_CHAT, "New Chat", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, MENU_SETTINGS, "Settings", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_hide, &new_chat, &settings, &separator, &quit])?;

    Ok(menu)
}

/// Handle menu item events
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id.as_ref() {
        MENU_SHOW_HIDE => {
            super::toggle_window(app);
        }
        MENU_NEW_CHAT => {
            // Show window and emit new chat event to frontend
            super::show_window(app);
            let _ = app.emit("tray:new-chat", ());
        }
        MENU_SETTINGS => {
            // Show window and navigate to settings
            super::show_window(app);
            let _ = app.emit("tray:open-settings", ());
        }
        MENU_QUIT => {
            // Clean shutdown
            app.exit(0);
        }
        _ => {}
    }
}

/// Update menu item text (e.g., for Show/Hide based on window state)
#[allow(dead_code)]
pub fn update_show_hide_text<R: Runtime>(app: &AppHandle<R>, is_visible: bool) {
    // Note: Tauri 2 doesn't have direct menu item text update
    // This would require rebuilding the menu
    let _ = (app, is_visible);
}
