// Helix Desktop - Tauri Backend

mod commands;
mod config;
mod gateway;
mod tray;
mod updater;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

use crate::config::ConfigWatcher;
use crate::gateway::GatewayMonitor;

/// Application state shared across the app
pub struct AppState {
    pub gateway_monitor: Arc<RwLock<GatewayMonitor>>,
    pub config_watcher: Arc<RwLock<ConfigWatcher>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        // .plugin(tauri_plugin_updater::Builder::new().build()) // Enable when signing keys are set up
        .manage(AppState {
            gateway_monitor: Arc::new(RwLock::new(GatewayMonitor::new())),
            config_watcher: Arc::new(RwLock::new(ConfigWatcher::new())),
        })
        .setup(|app| {
            // Initialize configuration
            commands::config::init(app.handle())?;

            // Start gateway monitor
            commands::gateway::init(app.handle())?;

            // Initialize system tray (desktop only)
            #[cfg(desktop)]
            {
                let _ = tray::init(app.handle());
            }

            // Start gateway health monitoring
            let state = app.state::<AppState>();
            let monitor = state.gateway_monitor.blocking_read();
            monitor.start(app.handle().clone());

            // Start config file watcher
            {
                let mut watcher = state.config_watcher.blocking_write();
                if let Err(e) = watcher.start(app.handle().clone()) {
                    log::warn!("Failed to start config watcher: {}", e);
                }
            }

            // Auto-start OpenClaw gateway
            if let Err(e) = commands::gateway::auto_start_gateway(app.handle()) {
                log::warn!("Failed to auto-start gateway: {}", e);
            }

            // Initialize auto-updater (disabled until signing keys are configured)
            // updater::init(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Gateway commands
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::gateway_status,
            commands::gateway::get_gateway_url,

            // Config commands
            commands::config::get_config,
            commands::config::set_config,
            commands::config::get_config_path,

            // Keyring commands
            commands::keyring::store_secret,
            commands::keyring::get_secret,
            commands::keyring::delete_secret,
            commands::keyring::has_secret,

            // File commands
            commands::files::read_file,
            commands::files::write_file,
            commands::files::list_directory,
            commands::files::file_exists,
            commands::files::ensure_directory,

            // System commands
            commands::system::get_system_info,
            commands::system::get_helix_paths,
            commands::system::is_first_run,
            commands::system::mark_onboarded,

            // Auth commands (Claude Code CLI detection)
            commands::auth::detect_claude_code,
            commands::auth::run_claude_code,

            // Discord logging
            commands::discord::send_webhook,
            commands::discord::test_webhook,

            // Psychology layer commands
            commands::psychology::get_soul,
            commands::psychology::update_soul,
            commands::psychology::get_layer,
            commands::psychology::get_all_layers,
            commands::psychology::update_layer,
            commands::psychology::run_decay,
            commands::psychology::run_synthesis,
            commands::psychology::restore_from_decay,
            commands::psychology::get_layer_status,

            // Config watcher commands
            config::watcher::start_config_watcher,
            config::watcher::stop_config_watcher,
            config::watcher::is_config_watcher_active,

            // Scheduler commands (Layer 5 jobs)
            commands::scheduler::get_scheduler_config,
            commands::scheduler::set_scheduler_config,
            commands::scheduler::get_scheduled_jobs,
            commands::scheduler::get_job,
            commands::scheduler::create_job,
            commands::scheduler::pause_job,
            commands::scheduler::resume_job,
            commands::scheduler::delete_job,
            commands::scheduler::trigger_job,
            commands::scheduler::complete_job,
            commands::scheduler::fail_job,
            commands::scheduler::get_scheduler_health,

            // Phase C: Clipboard operations
            commands::clipboard::copy_to_clipboard,
            commands::clipboard::paste_from_clipboard,

            // Phase C: Directory operations
            commands::directories::get_cache_dir,
            commands::directories::get_data_dir,
            commands::directories::get_app_dir,
            commands::directories::get_config_dir,

            // Updater commands (disabled until signing keys are configured)
            // updater::check_for_update,
            // updater::install_update,
            // updater::get_app_version,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Helix");
}
