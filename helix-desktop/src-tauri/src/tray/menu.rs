// Helix Desktop - Enhanced Tray Menu Definition (Phase J2)
//
// Rich system tray menu with gateway status, agent/channel submenus,
// quick actions, and dynamic updates.

use tauri::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Runtime,
};

// ── Menu item IDs ──────────────────────────────────────────────────────────────

// Header
pub const MENU_HEADER: &str = "header";
pub const MENU_GATEWAY_STATUS: &str = "gateway-status";

// Quick Actions
pub const MENU_NEW_CHAT: &str = "new-chat";
pub const MENU_TALK_MODE: &str = "talk-mode";

// Submenus (parent IDs)
pub const SUBMENU_AGENTS: &str = "agents-submenu";
pub const SUBMENU_CHANNELS: &str = "channels-submenu";

// Quick Links
pub const MENU_SETTINGS: &str = "settings";
pub const MENU_APPROVALS: &str = "approvals";

// System
pub const MENU_SHOW_WINDOW: &str = "show-window";
pub const MENU_RESTART_GATEWAY: &str = "restart-gateway";
pub const MENU_QUIT: &str = "quit";

// Prefixes for dynamic items within submenus
pub const AGENT_PREFIX: &str = "agent:";
pub const CHANNEL_PREFIX: &str = "channel:";

// ── Data types for dynamic tray state ──────────────────────────────────────────

/// Represents the state used to build (or rebuild) the tray menu.
#[derive(Debug, Clone, Default)]
pub struct TrayMenuState {
    pub gateway_running: bool,
    pub agents: Vec<(String, String)>,   // (name, status)
    pub channels: Vec<(String, String)>, // (name, status)
    pub pending_approvals: u32,
    pub window_visible: bool,
    pub talk_mode_active: bool,
}

// ── Menu construction ──────────────────────────────────────────────────────────

/// Build the default tray menu with initial (empty) state.
pub fn create_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let state = TrayMenuState::default();
    build_tray_menu(app, &state)
}

/// Build the full tray menu from the provided state.
///
/// Layout:
///   Helix                         (disabled header)
///   Gateway: Running / Stopped    (disabled status indicator)
///   ────────────────
///   New Chat
///   Talk Mode
///   ────────────────
///   Agents >
///   Channels >
///   ────────────────
///   Settings
///   Approvals (N)
///   ────────────────
///   Show Window / Hide Window
///   Restart Gateway
///   ────────────────
///   Quit Helix
pub fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    state: &TrayMenuState,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    // ── Header section ─────────────────────────────────────────────────────
    let header = MenuItem::with_id(app, MENU_HEADER, "Helix", false, None::<&str>)?;

    let gateway_label = if state.gateway_running {
        "Gateway: Running"
    } else {
        "Gateway: Stopped"
    };
    let gateway_status =
        MenuItem::with_id(app, MENU_GATEWAY_STATUS, gateway_label, false, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    // ── Quick actions ──────────────────────────────────────────────────────
    let new_chat = MenuItem::with_id(app, MENU_NEW_CHAT, "New Chat", true, None::<&str>)?;

    let talk_label = if state.talk_mode_active {
        "Talk Mode (on)"
    } else {
        "Talk Mode"
    };
    let talk_mode = MenuItem::with_id(app, MENU_TALK_MODE, talk_label, true, None::<&str>)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    // ── Agents submenu ─────────────────────────────────────────────────────
    let agents_submenu = build_agents_submenu(app, &state.agents)?;

    // ── Channels submenu ───────────────────────────────────────────────────
    let channels_submenu = build_channels_submenu(app, &state.channels)?;

    let sep3 = PredefinedMenuItem::separator(app)?;

    // ── Quick links ────────────────────────────────────────────────────────
    let settings = MenuItem::with_id(app, MENU_SETTINGS, "Settings", true, None::<&str>)?;

    let approvals_label = if state.pending_approvals > 0 {
        format!("Approvals ({})", state.pending_approvals)
    } else {
        "Approvals".to_string()
    };
    let approvals =
        MenuItem::with_id(app, MENU_APPROVALS, &approvals_label, true, None::<&str>)?;

    let sep4 = PredefinedMenuItem::separator(app)?;

    // ── System section ─────────────────────────────────────────────────────
    let show_hide_label = if state.window_visible {
        "Hide Window"
    } else {
        "Show Window"
    };
    let show_window =
        MenuItem::with_id(app, MENU_SHOW_WINDOW, show_hide_label, true, None::<&str>)?;
    let restart_gateway =
        MenuItem::with_id(app, MENU_RESTART_GATEWAY, "Restart Gateway", true, None::<&str>)?;

    let sep5 = PredefinedMenuItem::separator(app)?;

    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit Helix", true, None::<&str>)?;

    // ── Assemble ───────────────────────────────────────────────────────────
    let menu = Menu::with_items(
        app,
        &[
            &header,
            &gateway_status,
            &sep1,
            &new_chat,
            &talk_mode,
            &sep2,
            &agents_submenu,
            &channels_submenu,
            &sep3,
            &settings,
            &approvals,
            &sep4,
            &show_window,
            &restart_gateway,
            &sep5,
            &quit,
        ],
    )?;

    Ok(menu)
}

/// Build the "Agents" submenu from a list of (name, status) pairs.
fn build_agents_submenu<R: Runtime>(
    app: &AppHandle<R>,
    agents: &[(String, String)],
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let submenu = Submenu::with_id(app, SUBMENU_AGENTS, "Agents", true)?;

    if agents.is_empty() {
        let placeholder = MenuItem::with_id(
            app,
            "agent:none",
            "No agents configured",
            false,
            None::<&str>,
        )?;
        submenu.append(&placeholder)?;
    } else {
        for (name, status) in agents {
            let (indicator, status_text) = format_status_indicator(status);
            let label = format!("{} {} ({})", indicator, name, status_text);
            let id = format!("{}{}", AGENT_PREFIX, name);
            let item = MenuItem::with_id(app, &id, &label, false, None::<&str>)?;
            submenu.append(&item)?;
        }
    }

    Ok(submenu)
}

/// Build the "Channels" submenu from a list of (name, status) pairs.
fn build_channels_submenu<R: Runtime>(
    app: &AppHandle<R>,
    channels: &[(String, String)],
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let submenu = Submenu::with_id(app, SUBMENU_CHANNELS, "Channels", true)?;

    if channels.is_empty() {
        let placeholder = MenuItem::with_id(
            app,
            "channel:none",
            "No channels configured",
            false,
            None::<&str>,
        )?;
        submenu.append(&placeholder)?;
    } else {
        for (name, status) in channels {
            let (indicator, status_text) = format_status_indicator(status);
            let label = format!("{} {} ({})", indicator, name, status_text);
            let id = format!("{}{}", CHANNEL_PREFIX, name);
            let item = MenuItem::with_id(app, &id, &label, false, None::<&str>)?;
            submenu.append(&item)?;
        }
    }

    Ok(submenu)
}

/// Map a status string to a bullet indicator and display text.
///
/// Returns `("filled-circle", "display-text")`.
/// Active / connected statuses get a filled circle, others get an open circle.
fn format_status_indicator(status: &str) -> (&'static str, &'static str) {
    match status.to_lowercase().as_str() {
        "active" | "running" => ("\u{25CF}", "active"),       // ●
        "connected" => ("\u{25CF}", "connected"),              // ●
        "idle" | "standby" => ("\u{25CB}", "idle"),            // ○
        "disconnected" | "offline" => ("\u{25CB}", "disconnected"), // ○
        "error" | "failed" => ("\u{25CB}", "error"),           // ○
        _ => ("\u{25CB}", "idle"),                              // ○
    }
}

// ── Menu event handling ────────────────────────────────────────────────────────

/// Handle all tray menu item click events.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id.as_ref();

    match id {
        // ── Quick actions ──────────────────────────────────────────────────
        MENU_NEW_CHAT => {
            super::show_window(app);
            let _ = app.emit("tray:new-chat", ());
        }
        MENU_TALK_MODE => {
            let _ = app.emit("tray:toggle-talk-mode", ());
        }

        // ── Quick links ────────────────────────────────────────────────────
        MENU_SETTINGS => {
            super::show_window(app);
            let _ = app.emit("tray:open-settings", ());
        }
        MENU_APPROVALS => {
            super::show_window(app);
            let _ = app.emit("tray:open-approvals", ());
        }

        // ── System ─────────────────────────────────────────────────────────
        MENU_SHOW_WINDOW => {
            super::toggle_window(app);
        }
        MENU_RESTART_GATEWAY => {
            let _ = app.emit("tray:restart-gateway", ());
        }
        MENU_QUIT => {
            app.exit(0);
        }

        // ── Disabled / informational items (no-op) ─────────────────────────
        MENU_HEADER | MENU_GATEWAY_STATUS => {}

        // ── Dynamic agent / channel items (informational, no-op) ───────────
        other => {
            if other.starts_with(AGENT_PREFIX) || other.starts_with(CHANNEL_PREFIX) {
                // Currently informational only; could emit events in the future
            } else {
                log::debug!("Unhandled tray menu event: {}", other);
            }
        }
    }
}
