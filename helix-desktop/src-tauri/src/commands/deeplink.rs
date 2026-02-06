// Deep Link commands - handle helix:// URL scheme
//
// Phase J, Task J1: Deep Linking support for Helix Desktop.
//
// The Rust side validates incoming deep link URLs and forwards them to the
// frontend via Tauri events.  The bulk of the routing logic lives in the
// React `useDeepLink` hook which parses the URL and navigates accordingly.

use tauri::{AppHandle, Emitter};
use serde::Serialize;

/// Supported deep link action types derived from the URL path.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkInfo {
    /// The original URL string
    pub url: String,
    /// Whether the URL passed validation
    pub valid: bool,
    /// Optional error message if validation failed
    pub error: Option<String>,
}

/// Handle an incoming deep link URL.
///
/// Validates that the URL uses the `helix://` scheme, then emits a
/// `deep-link` event to the frontend so the React router can navigate
/// to the appropriate view.
///
/// Returns a [`DeepLinkInfo`] indicating whether the URL was accepted.
#[tauri::command]
pub async fn handle_deep_link(url: String, app: AppHandle) -> Result<DeepLinkInfo, String> {
    // Validate the URL starts with helix://
    if !url.starts_with("helix://") {
        return Ok(DeepLinkInfo {
            url: url.clone(),
            valid: false,
            error: Some("Invalid deep link scheme: expected helix://".to_string()),
        });
    }

    // Basic URL structure validation - must have at least a host/path component
    let after_scheme = &url["helix://".len()..];
    if after_scheme.is_empty() {
        return Ok(DeepLinkInfo {
            url: url.clone(),
            valid: false,
            error: Some("Empty deep link path".to_string()),
        });
    }

    // Extract the action type (first path segment) for logging
    let action = after_scheme
        .split('?')
        .next()
        .unwrap_or("")
        .split('/')
        .next()
        .unwrap_or("unknown");

    log::info!("Deep link received: action={}, url={}", action, url);

    // Emit event to frontend for routing
    app.emit("deep-link", url.clone())
        .map_err(|e| format!("Failed to emit deep-link event: {}", e))?;

    Ok(DeepLinkInfo {
        url,
        valid: true,
        error: None,
    })
}

/// Get the URL that was used to launch the app (cold start deep link).
///
/// On a cold start triggered by a deep link, this command returns the
/// originating URL so the frontend can navigate on mount.  If the app was
/// launched normally (e.g. from the Start menu or Dock), returns `None`.
///
/// Note: The actual cold-start URL capture depends on the Tauri deep-link
/// plugin which stores the launch URL.  This command provides a safe
/// wrapper that returns `None` when the plugin is not active or when the
/// app was started without a deep link.
#[tauri::command]
pub async fn get_launch_deep_link() -> Result<Option<String>, String> {
    // Check environment for launch URL (set by OS when app is launched via deep link)
    // On Windows this comes from the command-line args, on macOS from the NSAppleEventManager.
    // Tauri's deep-link plugin populates this when configured.
    //
    // For now return None - the deep-link plugin integration will populate this
    // when tauri-plugin-deep-link is added to Cargo.toml and configured.
    let args: Vec<String> = std::env::args().collect();

    // Check if any CLI argument looks like a helix:// deep link
    for arg in args.iter().skip(1) {
        if arg.starts_with("helix://") {
            log::info!("App launched with deep link: {}", arg);
            return Ok(Some(arg.clone()));
        }
    }

    Ok(None)
}
