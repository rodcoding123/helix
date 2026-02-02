// Auto-updater module - handles application updates using Tauri updater

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// Update information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub release_date: Option<String>,
}

/// Update status for tracking progress
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum UpdateStatus {
    Checking,
    Available { info: UpdateInfo },
    NotAvailable { current_version: String },
    Downloading { progress: f32 },
    ReadyToInstall,
    Installing,
    Error { message: String },
}

/// Check for updates and emit event if available
pub async fn check_for_updates(app_handle: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    // Emit checking status
    let _ = app_handle.emit("update:status", UpdateStatus::Checking);

    // Get the updater
    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    // Check for updates
    match updater.check().await {
        Ok(Some(update)) => {
            let current_version = app_handle
                .package_info()
                .version
                .to_string();

            let info = UpdateInfo {
                current_version,
                latest_version: update.version.clone(),
                release_notes: update.body.clone(),
                download_url: None, // URL is internal to Tauri updater
                release_date: update.date.map(|d| d.to_string()),
            };

            // Emit update available event
            let _ = app_handle.emit("update:available", info.clone());
            let _ = app_handle.emit(
                "update:status",
                UpdateStatus::Available { info: info.clone() },
            );

            log::info!("Update available: {} -> {}", info.current_version, info.latest_version);
            Ok(Some(info))
        }
        Ok(None) => {
            let current_version = app_handle
                .package_info()
                .version
                .to_string();

            let _ = app_handle.emit(
                "update:status",
                UpdateStatus::NotAvailable {
                    current_version: current_version.clone(),
                },
            );

            log::info!("No update available. Current version: {}", current_version);
            Ok(None)
        }
        Err(e) => {
            let message = format!("Failed to check for updates: {}", e);
            let _ = app_handle.emit(
                "update:status",
                UpdateStatus::Error {
                    message: message.clone(),
                },
            );
            log::error!("{}", message);
            Err(message)
        }
    }
}

/// Download and install the update
pub async fn download_and_install(app_handle: &AppHandle) -> Result<(), String> {
    // Get the updater
    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    // Check for updates first
    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    // Emit downloading status
    let _ = app_handle.emit("update:status", UpdateStatus::Downloading { progress: 0.0 });

    // Download and install with progress tracking
    let app_handle_clone = app_handle.clone();

    update
        .download_and_install(
            move |chunk_length, content_length| {
                // Calculate progress
                let progress = content_length
                    .map(|total| (chunk_length as f32 / total as f32) * 100.0)
                    .unwrap_or(0.0);

                let _ = app_handle_clone.emit(
                    "update:status",
                    UpdateStatus::Downloading { progress },
                );
            },
            || {
                // Download complete, ready to install
                log::info!("Update download complete, preparing to install");
            },
        )
        .await
        .map_err(|e| format!("Failed to download/install update: {}", e))?;

    // Emit installing status
    let _ = app_handle.emit("update:status", UpdateStatus::Installing);

    log::info!("Update installed successfully. Restart required.");
    Ok(())
}

/// Initialize updater on app startup
pub fn init(app_handle: &AppHandle) {
    let handle = app_handle.clone();

    // Check for updates asynchronously on startup
    tauri::async_runtime::spawn(async move {
        // Wait a bit for app to fully initialize
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

        if let Err(e) = check_for_updates(&handle).await {
            log::warn!("Startup update check failed: {}", e);
        }
    });

    log::info!("Updater initialized");
}

// Tauri commands

/// Check for application updates
#[tauri::command]
pub async fn check_for_update(app_handle: AppHandle) -> Result<Option<UpdateInfo>, String> {
    check_for_updates(&app_handle).await
}

/// Download and install available update
#[tauri::command]
pub async fn install_update(app_handle: AppHandle) -> Result<(), String> {
    download_and_install(&app_handle).await
}

/// Get current application version
#[tauri::command]
pub fn get_app_version(app_handle: AppHandle) -> String {
    app_handle.package_info().version.to_string()
}
