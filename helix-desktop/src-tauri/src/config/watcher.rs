// Config file watcher - monitors ~/.helix/config.json for changes

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Debounce duration for rapid file changes
const DEBOUNCE_MS: u64 = 100;

/// Config file watcher that emits events to the frontend
pub struct ConfigWatcher {
    watcher: Option<RecommendedWatcher>,
    stop_tx: Option<Sender<()>>,
    watching: Arc<Mutex<bool>>,
}

impl ConfigWatcher {
    /// Create a new config watcher
    pub fn new() -> Self {
        Self {
            watcher: None,
            stop_tx: None,
            watching: Arc::new(Mutex::new(false)),
        }
    }

    /// Get the config file path
    pub fn config_path() -> Option<PathBuf> {
        dirs::home_dir().map(|home| home.join(".helix").join("config.json"))
    }

    /// Start watching the config file
    pub fn start(&mut self, app_handle: AppHandle) -> Result<(), String> {
        // Check if already watching
        {
            let watching = self.watching.lock().map_err(|e| e.to_string())?;
            if *watching {
                return Ok(());
            }
        }

        let config_path = Self::config_path()
            .ok_or_else(|| "Could not determine config path".to_string())?;

        // Ensure the directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        // Create stop channel
        let (stop_tx, stop_rx) = channel::<()>();
        self.stop_tx = Some(stop_tx);

        // Create event channel for debouncing
        let (event_tx, event_rx) = channel::<Event>();

        // Create the file watcher
        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = event_tx.send(event);
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        self.watcher = Some(watcher);

        // Watch the config directory (watching parent because config.json might not exist yet)
        if let Some(ref mut w) = self.watcher {
            if let Some(parent) = config_path.parent() {
                w.watch(parent, RecursiveMode::NonRecursive)
                    .map_err(|e| format!("Failed to watch config directory: {}", e))?;
            }
        }

        // Mark as watching
        {
            let mut watching = self.watching.lock().map_err(|e| e.to_string())?;
            *watching = true;
        }

        // Spawn debounce thread
        let watching_flag = Arc::clone(&self.watching);
        let config_path_clone = config_path.clone();

        thread::spawn(move || {
            Self::debounce_loop(
                event_rx,
                stop_rx,
                app_handle,
                config_path_clone,
                watching_flag,
            );
        });

        log::info!("Config watcher started for: {:?}", config_path);
        Ok(())
    }

    /// Stop watching the config file
    pub fn stop(&mut self) -> Result<(), String> {
        // Send stop signal
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }

        // Drop the watcher
        self.watcher = None;

        // Mark as not watching
        {
            let mut watching = self.watching.lock().map_err(|e| e.to_string())?;
            *watching = false;
        }

        log::info!("Config watcher stopped");
        Ok(())
    }

    /// Check if currently watching
    pub fn is_watching(&self) -> bool {
        self.watching
            .lock()
            .map(|w| *w)
            .unwrap_or(false)
    }

    /// Debounce loop that processes file events
    fn debounce_loop(
        event_rx: Receiver<Event>,
        stop_rx: Receiver<()>,
        app_handle: AppHandle,
        config_path: PathBuf,
        watching_flag: Arc<Mutex<bool>>,
    ) {
        let mut last_event: Option<Instant> = None;
        let debounce_duration = Duration::from_millis(DEBOUNCE_MS);

        loop {
            // Check for stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Check if still watching
            if let Ok(watching) = watching_flag.lock() {
                if !*watching {
                    break;
                }
            }

            // Process events with timeout
            match event_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(event) => {
                    // Check if this event is for our config file
                    let is_config_event = event.paths.iter().any(|p| {
                        p.file_name()
                            .map(|n| n == "config.json")
                            .unwrap_or(false)
                    });

                    if is_config_event {
                        let now = Instant::now();
                        let should_emit = match last_event {
                            Some(last) => now.duration_since(last) >= debounce_duration,
                            None => true,
                        };

                        if should_emit {
                            last_event = Some(now);

                            // Emit event to frontend
                            if let Err(e) = app_handle.emit("config:changed", ConfigChangedPayload {
                                path: config_path.to_string_lossy().to_string(),
                                timestamp: chrono_timestamp(),
                            }) {
                                log::error!("Failed to emit config:changed event: {}", e);
                            } else {
                                log::debug!("Emitted config:changed event");
                            }
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Continue loop
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    }
}

impl Default for ConfigWatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for ConfigWatcher {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// Payload for config:changed event
#[derive(serde::Serialize, Clone)]
struct ConfigChangedPayload {
    path: String,
    timestamp: u64,
}

/// Get current timestamp in milliseconds
fn chrono_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// Tauri commands for config watching

/// Start watching the config file
#[tauri::command]
pub async fn start_config_watcher(
    app_handle: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut watcher = state.config_watcher.write().await;
    watcher.start(app_handle)
}

/// Stop watching the config file
#[tauri::command]
pub async fn stop_config_watcher(
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut watcher = state.config_watcher.write().await;
    watcher.stop()
}

/// Check if config watcher is active
#[tauri::command]
pub async fn is_config_watcher_active(
    state: tauri::State<'_, crate::AppState>,
) -> Result<bool, String> {
    let watcher = state.config_watcher.read().await;
    Ok(watcher.is_watching())
}
