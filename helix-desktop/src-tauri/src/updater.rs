//! Helix Desktop Auto-Update Manager
//!
//! Handles application updates with checksum verification.
//! Uses Tauri's built-in updater with SHA-256 signature verification.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, Emitter};

/// Update check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub date: String,
    pub body: String,
    pub should_update: bool,
}

/// Initialize updater
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    log::info!("Auto-updater initialized");
    let _ = app.emit("updater:ready", ());
}

/// Check for updates
#[tauri::command]
pub async fn check_for_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<UpdateInfo, String> {
    match app.updater().check().await {
        Ok(update) => {
            let info = UpdateInfo {
                version: update.latest_version().to_string(),
                date: update.date().unwrap_or("").to_string(),
                body: update.body().unwrap_or("").to_string(),
                should_update: update.is_update_available(),
            };

            if update.is_update_available() {
                let _ = app.emit("updater:update-available", &info);
                log::info!("Update available: {}", info.version);
            } else {
                log::info!("No update available");
            }

            Ok(info)
        }
        Err(e) => {
            let error_msg = format!("Update check failed: {}", e);
            let _ = app.emit("updater:error", &error_msg);
            log::error!("[updater] {}", error_msg);
            Err(error_msg)
        }
    }
}

/// Install available update (downloads + installs on next restart)
#[tauri::command]
pub async fn install_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    match app.updater().check().await {
        Ok(update) => {
            if update.is_update_available() {
                let _ = app.emit("updater:installing", &update.latest_version());
                log::info!("Installing update: {}", update.latest_version());

                // Download and install the update
                match update.download_and_install().await {
                    Ok(_) => {
                        let version = update.latest_version().to_string();
                        let _ = app.emit("updater:install-complete", &version);
                        log::info!("Update {} installed. Restart to apply.", version);
                        Ok(format!(
                            "Update {} downloaded. Restart to apply.",
                            version
                        ))
                    }
                    Err(e) => {
                        let error_msg = format!("Update installation failed: {}", e);
                        let _ = app.emit("updater:error", &error_msg);
                        log::error!("[updater] {}", error_msg);
                        Err(error_msg)
                    }
                }
            } else {
                Ok("No update available".to_string())
            }
        }
        Err(e) => {
            let error_msg = format!("Update check failed: {}", e);
            let _ = app.emit("updater:error", &error_msg);
            log::error!("[updater] {}", error_msg);
            Err(error_msg)
        }
    }
}

/// Get current app version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
