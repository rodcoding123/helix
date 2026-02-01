// Helix Desktop - Gateway Health Monitor

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::sync::RwLock;
use tokio::time::interval;

/// Gateway connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus {
    /// Gateway is not running
    Stopped,
    /// Gateway is starting up
    Starting,
    /// Gateway is running and healthy
    Running,
    /// Gateway is unhealthy (not responding)
    Unhealthy,
    /// Gateway is being restarted
    Restarting,
}

impl Default for GatewayStatus {
    fn default() -> Self {
        Self::Stopped
    }
}

/// Gateway status event payload
#[derive(Debug, Clone, Serialize)]
pub struct GatewayStatusEvent {
    pub status: GatewayStatus,
    pub message: Option<String>,
    pub timestamp: u64,
}

/// Gateway health monitor
pub struct GatewayMonitor {
    status: Arc<RwLock<GatewayStatus>>,
    gateway_port: Arc<RwLock<u16>>,
    running: Arc<AtomicBool>,
    auto_restart: Arc<AtomicBool>,
    max_retries: u32,
    health_check_interval: Duration,
    unhealthy_threshold: u32,
}

impl Default for GatewayMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl GatewayMonitor {
    /// Create a new gateway monitor
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(GatewayStatus::Stopped)),
            gateway_port: Arc::new(RwLock::new(9876)),
            running: Arc::new(AtomicBool::new(false)),
            auto_restart: Arc::new(AtomicBool::new(true)),
            max_retries: 3,
            health_check_interval: Duration::from_secs(30),
            unhealthy_threshold: 3,
        }
    }

    /// Set the gateway port to monitor
    pub async fn set_port(&self, port: u16) {
        *self.gateway_port.write().await = port;
    }

    /// Get current gateway status
    pub async fn get_status(&self) -> GatewayStatus {
        *self.status.read().await
    }

    /// Set gateway status and emit event
    async fn set_status<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        status: GatewayStatus,
        message: Option<String>,
    ) {
        let mut current = self.status.write().await;
        if *current != status {
            *current = status;

            let event = GatewayStatusEvent {
                status,
                message,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            };

            let _ = app.emit("gateway:status", &event);
        }
    }

    /// Enable or disable auto-restart
    pub fn set_auto_restart(&self, enabled: bool) {
        self.auto_restart.store(enabled, Ordering::SeqCst);
    }

    /// Start the health monitoring loop
    pub fn start<R: Runtime + 'static>(&self, app: AppHandle<R>) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let status = self.status.clone();
        let port = self.gateway_port.clone();
        let running = self.running.clone();
        let auto_restart = self.auto_restart.clone();
        let check_interval = self.health_check_interval;
        let unhealthy_threshold = self.unhealthy_threshold;
        let max_retries = self.max_retries;

        tauri::async_runtime::spawn(async move {
            let mut interval = interval(check_interval);
            let mut consecutive_failures = 0u32;
            let mut restart_attempts = 0u32;

            while running.load(Ordering::SeqCst) {
                interval.tick().await;

                let current_status = *status.read().await;

                // Skip health checks if gateway is stopped or starting
                if current_status == GatewayStatus::Stopped
                    || current_status == GatewayStatus::Starting
                    || current_status == GatewayStatus::Restarting
                {
                    consecutive_failures = 0;
                    continue;
                }

                let current_port = *port.read().await;
                let is_healthy = check_gateway_health(current_port).await;

                if is_healthy {
                    consecutive_failures = 0;
                    restart_attempts = 0;

                    let mut s = status.write().await;
                    if *s == GatewayStatus::Unhealthy {
                        *s = GatewayStatus::Running;
                        let _ = app.emit(
                            "gateway:status",
                            GatewayStatusEvent {
                                status: GatewayStatus::Running,
                                message: Some("Gateway recovered".to_string()),
                                timestamp: current_timestamp(),
                            },
                        );
                    }
                } else {
                    consecutive_failures += 1;

                    if consecutive_failures >= unhealthy_threshold {
                        let mut s = status.write().await;
                        if *s != GatewayStatus::Unhealthy {
                            *s = GatewayStatus::Unhealthy;
                            let _ = app.emit(
                                "gateway:status",
                                GatewayStatusEvent {
                                    status: GatewayStatus::Unhealthy,
                                    message: Some(format!(
                                        "Gateway not responding after {} checks",
                                        consecutive_failures
                                    )),
                                    timestamp: current_timestamp(),
                                },
                            );
                        }
                        drop(s);

                        // Attempt auto-restart if enabled
                        if auto_restart.load(Ordering::SeqCst) && restart_attempts < max_retries {
                            restart_attempts += 1;
                            let _ = app.emit(
                                "gateway:restart-requested",
                                serde_json::json!({
                                    "attempt": restart_attempts,
                                    "max_retries": max_retries
                                }),
                            );
                        }
                    }
                }
            }
        });
    }

    /// Stop the health monitoring loop
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Notify that gateway has started
    pub async fn notify_started<R: Runtime>(&self, app: &AppHandle<R>) {
        self.set_status(app, GatewayStatus::Running, Some("Gateway started".to_string()))
            .await;
    }

    /// Notify that gateway is starting
    pub async fn notify_starting<R: Runtime>(&self, app: &AppHandle<R>) {
        self.set_status(app, GatewayStatus::Starting, Some("Gateway starting...".to_string()))
            .await;
    }

    /// Notify that gateway has stopped
    pub async fn notify_stopped<R: Runtime>(&self, app: &AppHandle<R>) {
        self.set_status(app, GatewayStatus::Stopped, Some("Gateway stopped".to_string()))
            .await;
    }

    /// Notify that gateway is restarting
    pub async fn notify_restarting<R: Runtime>(&self, app: &AppHandle<R>) {
        self.set_status(
            app,
            GatewayStatus::Restarting,
            Some("Gateway restarting...".to_string()),
        )
        .await;
    }
}

/// Check if the gateway is healthy by attempting a WebSocket connection
async fn check_gateway_health(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client.get(&url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => {
            // Try TCP connection as fallback
            tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port))
                .await
                .is_ok()
        }
    }
}

/// Get current timestamp in milliseconds
fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Create a global gateway monitor instance
pub fn create_monitor() -> GatewayMonitor {
    GatewayMonitor::new()
}
