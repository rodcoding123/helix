// Gateway management commands - spawns openclaw-helix gateway

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

/// Default OpenClaw gateway port
const DEFAULT_GATEWAY_PORT: u16 = 18789;
/// Local development token for gateway auth
const LOCAL_GATEWAY_TOKEN: &str = "helix-desktop-local";

pub struct GatewayProcess {
    child: Option<Child>,
    port: u16,
    url: String,
}

impl GatewayProcess {
    pub fn new() -> Self {
        Self {
            child: None,
            port: DEFAULT_GATEWAY_PORT,
            url: format!("ws://127.0.0.1:{}", DEFAULT_GATEWAY_PORT),
        }
    }
}

static GATEWAY: Mutex<Option<GatewayProcess>> = Mutex::new(None);

pub fn init(_app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut gateway = GATEWAY.lock().map_err(|e| e.to_string())?;
    *gateway = Some(GatewayProcess::new());
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
    pub url: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct GatewayStarted {
    pub port: u16,
    pub url: String,
}

#[tauri::command]
pub fn start_gateway(app: AppHandle) -> Result<GatewayStarted, String> {
    let mut gateway_lock = GATEWAY.lock().map_err(|e| e.to_string())?;
    let gateway = gateway_lock.as_mut().ok_or("Gateway not initialized")?;

    if gateway.child.is_some() {
        return Err("Gateway already running".to_string());
    }

    // Use default OpenClaw port or find available if taken
    let port = if is_port_available(DEFAULT_GATEWAY_PORT) {
        DEFAULT_GATEWAY_PORT
    } else {
        find_available_port().map_err(|e| e.to_string())?
    };

    // Get openclaw path
    let openclaw_path = get_openclaw_path(&app)?;
    let openclaw_dir = get_openclaw_directory()?;

    log::info!("Starting OpenClaw gateway from: {:?}", openclaw_path);
    log::info!("Working directory: {:?}", openclaw_dir);

    // Build arguments based on executable type
    let openclaw_mjs = openclaw_dir.join("openclaw.mjs");
    let args: Vec<String> = if openclaw_path.to_string_lossy() == "node" && openclaw_mjs.exists() {
        // Running via node + openclaw.mjs
        vec![
            openclaw_mjs.to_string_lossy().to_string(),
            "gateway".to_string(),
            "--port".to_string(),
            port.to_string(),
            "--bind".to_string(),
            "loopback".to_string(),
            "--token".to_string(),
            LOCAL_GATEWAY_TOKEN.to_string(),
        ]
    } else if openclaw_path.to_string_lossy() == "npx" {
        // Running via npx (global fallback)
        vec![
            "openclaw".to_string(),
            "gateway".to_string(),
            "--port".to_string(),
            port.to_string(),
            "--bind".to_string(),
            "loopback".to_string(),
            "--token".to_string(),
            LOCAL_GATEWAY_TOKEN.to_string(),
        ]
    } else {
        // Direct executable (bundled or bin symlink)
        vec![
            "gateway".to_string(),
            "--port".to_string(),
            port.to_string(),
            "--bind".to_string(),
            "loopback".to_string(),
            "--token".to_string(),
            LOCAL_GATEWAY_TOKEN.to_string(),
        ]
    };

    log::info!("Gateway command: {:?} {:?}", openclaw_path, args);

    // Spawn gateway process
    let child = Command::new(&openclaw_path)
        .args(&args)
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}. Make sure openclaw-helix is built.", e))?;

    let url = format!("ws://127.0.0.1:{}", port);

    gateway.child = Some(child);
    gateway.port = port;
    gateway.url = url.clone();

    let result = GatewayStarted { port, url: url.clone() };

    // Emit event to frontend
    let _ = app.emit("gateway:started", result.clone());

    Ok(result)
}

#[tauri::command]
pub fn stop_gateway(app: AppHandle) -> Result<(), String> {
    let mut gateway_lock = GATEWAY.lock().map_err(|e| e.to_string())?;
    let gateway = gateway_lock.as_mut().ok_or("Gateway not initialized")?;

    if let Some(mut child) = gateway.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    gateway.port = 0;
    gateway.url = String::new();

    let _ = app.emit("gateway:stopped", ());

    Ok(())
}

#[tauri::command]
pub fn gateway_status() -> Result<GatewayStatus, String> {
    let gateway_lock = GATEWAY.lock().map_err(|e| e.to_string())?;

    match gateway_lock.as_ref() {
        Some(g) if g.child.is_some() => Ok(GatewayStatus {
            running: true,
            port: Some(g.port),
            pid: g.child.as_ref().map(|c| c.id()),
            url: Some(g.url.clone()),
        }),
        _ => Ok(GatewayStatus {
            running: false,
            port: None,
            pid: None,
            url: None,
        }),
    }
}

#[tauri::command]
pub fn get_gateway_url() -> Result<String, String> {
    let gateway_lock = GATEWAY.lock().map_err(|e| e.to_string())?;

    match gateway_lock.as_ref() {
        Some(g) if !g.url.is_empty() => Ok(g.url.clone()),
        _ => Ok(format!("ws://127.0.0.1:{}", DEFAULT_GATEWAY_PORT)),
    }
}

fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

fn find_available_port() -> std::io::Result<u16> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn get_openclaw_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // Try bundled openclaw first (for production)
    if let Ok(resource_dir) = app.path().resource_dir() {
        #[cfg(target_os = "windows")]
        let openclaw_binary = "openclaw.cmd";
        #[cfg(not(target_os = "windows"))]
        let openclaw_binary = "openclaw";

        let bundled_path = resource_dir.join("openclaw").join(openclaw_binary);
        if bundled_path.exists() {
            return Ok(bundled_path);
        }
    }

    // Development: openclaw-helix is the source, use node to run openclaw.mjs directly
    let openclaw_dir = get_openclaw_directory()?;
    let openclaw_mjs = openclaw_dir.join("openclaw.mjs");

    if openclaw_mjs.exists() {
        // Return full path to node.exe - PATH may not be available in Tauri context
        log::info!("Found openclaw.mjs at: {:?}", openclaw_mjs);

        #[cfg(target_os = "windows")]
        {
            // Try common node installation paths on Windows
            let node_paths = [
                "C:\\Program Files\\nodejs\\node.exe",
                "C:\\Program Files (x86)\\nodejs\\node.exe",
            ];
            for path in node_paths {
                let node_path = std::path::PathBuf::from(path);
                if node_path.exists() {
                    log::info!("Using node at: {:?}", node_path);
                    return Ok(node_path);
                }
            }
            // Fallback to node in PATH
            return Ok(std::path::PathBuf::from("node"));
        }

        #[cfg(not(target_os = "windows"))]
        return Ok(std::path::PathBuf::from("node"));
    }

    #[cfg(target_os = "windows")]
    {
        // Fallback: try node_modules/.bin/openclaw.cmd
        let npx_path = openclaw_dir.join("node_modules").join(".bin").join("openclaw.cmd");
        if npx_path.exists() {
            return Ok(npx_path);
        }
        // Try global npx as last resort
        Ok(std::path::PathBuf::from("npx"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Fallback: try node_modules/.bin/openclaw
        let bin_path = openclaw_dir.join("node_modules").join(".bin").join("openclaw");
        if bin_path.exists() {
            return Ok(bin_path);
        }
        // Try global npx as last resort
        Ok(std::path::PathBuf::from("npx"))
    }
}

fn get_openclaw_directory() -> Result<std::path::PathBuf, String> {
    // Try to find openclaw-helix relative to the executable
    // Release binary is at: helix-desktop/src-tauri/target/release/helix-desktop.exe
    // We need to go up to find: Helix/openclaw-helix
    if let Ok(exe_path) = std::env::current_exe() {
        // From exe: target/release/helix-desktop.exe
        // Go up 4 levels: release -> target -> src-tauri -> helix-desktop -> Helix
        // Then look for openclaw-helix sibling
        if let Some(exe_dir) = exe_path.parent() {
            // Try going up 4 levels (for release build structure)
            let helix_root = exe_dir
                .join("..")     // target
                .join("..")     // src-tauri
                .join("..")     // helix-desktop
                .join("..");    // Helix (root)

            let dev_path = helix_root.join("openclaw-helix");
            if dev_path.exists() {
                log::info!("Found openclaw-helix at (exe relative): {:?}", dev_path);
                return Ok(dev_path.canonicalize().map_err(|e| e.to_string())?);
            }

            // Also try from exe_dir directly (in case structure is different)
            let alt_path = exe_dir.join("..").join("..").join("openclaw-helix");
            if alt_path.exists() {
                log::info!("Found openclaw-helix at (alt): {:?}", alt_path);
                return Ok(alt_path.canonicalize().map_err(|e| e.to_string())?);
            }
        }
    }

    // Try CARGO_MANIFEST_DIR for cargo run scenarios
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_path = std::path::PathBuf::from(&manifest_dir)
            .join("..")
            .join("..")
            .join("openclaw-helix");

        if dev_path.exists() {
            log::info!("Found openclaw-helix at (manifest): {:?}", dev_path);
            return Ok(dev_path.canonicalize().map_err(|e| e.to_string())?);
        }
    }

    // Production: try home directory paths
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    // Try ~/.helix/openclaw-helix
    let helix_openclaw = home.join(".helix").join("openclaw-helix");
    if helix_openclaw.exists() {
        log::info!("Found openclaw-helix at (home): {:?}", helix_openclaw);
        return Ok(helix_openclaw);
    }

    // Try ~/.openclaw
    let openclaw_home = home.join(".openclaw");
    if openclaw_home.exists() {
        log::info!("Found openclaw at: {:?}", openclaw_home);
        return Ok(openclaw_home);
    }

    // Hardcoded fallback for known development path
    let known_dev_path = std::path::PathBuf::from("C:\\Users\\Specter\\Desktop\\Helix\\openclaw-helix");
    if known_dev_path.exists() {
        log::info!("Found openclaw-helix at (hardcoded): {:?}", known_dev_path);
        return Ok(known_dev_path);
    }

    log::warn!("Could not find openclaw-helix directory");
    Err("Could not find openclaw-helix directory".to_string())
}

/// Auto-start gateway on app launch (called from setup)
pub fn auto_start_gateway(app: &AppHandle) -> Result<(), String> {
    // Check if gateway is already running by probing the port
    if !is_port_available(DEFAULT_GATEWAY_PORT) {
        log::info!("Gateway already running on port {}", DEFAULT_GATEWAY_PORT);

        let mut gateway_lock = GATEWAY.lock().map_err(|e| e.to_string())?;
        if let Some(gateway) = gateway_lock.as_mut() {
            gateway.port = DEFAULT_GATEWAY_PORT;
            gateway.url = format!("ws://127.0.0.1:{}", DEFAULT_GATEWAY_PORT);
        }

        let _ = app.emit("gateway:started", GatewayStarted {
            port: DEFAULT_GATEWAY_PORT,
            url: format!("ws://127.0.0.1:{}", DEFAULT_GATEWAY_PORT),
        });

        return Ok(());
    }

    // Start gateway
    match start_gateway(app.clone()) {
        Ok(result) => {
            log::info!("Gateway started successfully on port {}", result.port);
            Ok(())
        }
        Err(e) => {
            log::warn!("Failed to auto-start gateway: {}", e);
            // Don't fail app startup if gateway fails
            // User can start it manually
            Ok(())
        }
    }
}
