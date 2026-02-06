// Gateway management commands - spawns helix-runtime gateway

use std::fs;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;
use rand::Rng;
use keyring::Entry;

/// Default OpenClaw gateway port
const DEFAULT_GATEWAY_PORT: u16 = 18789;
/// Keyring service name (matches keyring.rs)
const KEYRING_SERVICE: &str = "helix-desktop";
/// Keyring key for the gateway token
const GATEWAY_TOKEN_KEY: &str = "gateway-token";
/// Fallback file name for token storage when keyring is unavailable
const GATEWAY_TOKEN_FILENAME: &str = "gateway-token";

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

/// Generate a cryptographically secure 256-bit token as a 64-character hex string
fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let mut bytes = [0u8; 32];
    rng.fill(&mut bytes);
    hex::encode(bytes)
}

/// Get the fallback token file path: ~/.helix/gateway-token
fn get_token_file_path() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    Ok(home.join(".helix").join(GATEWAY_TOKEN_FILENAME))
}

/// Try to read a token from the fallback file
fn read_token_from_file() -> Result<Option<String>, String> {
    let path = get_token_file_path()?;
    match fs::read_to_string(&path) {
        Ok(contents) => {
            let token = contents.trim().to_string();
            if token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()) {
                Ok(Some(token))
            } else {
                log::warn!("Gateway token file exists but contains invalid token, will regenerate");
                Ok(None)
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read token file: {}", e)),
    }
}

/// Write a token to the fallback file with restrictive permissions
fn write_token_to_file(token: &str) -> Result<(), String> {
    let path = get_token_file_path()?;

    // Ensure ~/.helix directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .helix directory: {}", e))?;
    }

    // Write token to file
    let mut file = fs::File::create(&path)
        .map_err(|e| format!("Failed to create token file: {}", e))?;
    file.write_all(token.as_bytes())
        .map_err(|e| format!("Failed to write token file: {}", e))?;

    // Set restrictive permissions (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, permissions)
            .map_err(|e| format!("Failed to set token file permissions: {}", e))?;
    }

    log::info!("Gateway token stored in fallback file at {:?}", path);
    Ok(())
}

/// Get or create a cryptographically secure gateway token.
///
/// Token resolution order:
/// 1. OS keyring (service: "helix-desktop", key: "gateway-token")
/// 2. Fallback file at ~/.helix/gateway-token
/// 3. Session-only generated token (last resort, not persisted)
///
/// On first launch, generates a 256-bit random token (64 hex chars),
/// stores it in the keyring, and returns it. The token value is NEVER logged.
fn get_or_create_gateway_token() -> Result<String, String> {
    // 1. Try to read from OS keyring
    match Entry::new(KEYRING_SERVICE, GATEWAY_TOKEN_KEY) {
        Ok(entry) => {
            match entry.get_password() {
                Ok(token) => {
                    if token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()) {
                        log::info!("Gateway token retrieved from OS keyring");
                        return Ok(token);
                    }
                    // Invalid token in keyring - regenerate
                    log::warn!("Invalid gateway token found in keyring, regenerating");
                }
                Err(keyring::Error::NoEntry) => {
                    log::info!("No gateway token in keyring, will generate new one");
                }
                Err(e) => {
                    log::warn!("Keyring read failed: {}, trying fallback file", e);
                    // Fall through to file-based fallback
                    return get_or_create_token_from_file();
                }
            }

            // Generate new token and store in keyring
            let token = generate_token();
            log::info!("Generated new gateway token (256-bit)");

            match entry.set_password(&token) {
                Ok(()) => {
                    log::info!("Gateway token stored in OS keyring");
                    // Also write to file as backup
                    if let Err(e) = write_token_to_file(&token) {
                        log::warn!("Failed to write backup token file: {}", e);
                    }
                    Ok(token)
                }
                Err(e) => {
                    log::warn!("Failed to store token in keyring: {}, using fallback file", e);
                    // Store in file instead
                    write_token_to_file(&token)?;
                    Ok(token)
                }
            }
        }
        Err(e) => {
            log::warn!("Failed to create keyring entry: {}, using fallback", e);
            get_or_create_token_from_file()
        }
    }
}

/// Fallback: get or create token from file system
fn get_or_create_token_from_file() -> Result<String, String> {
    // Try to read existing token from file
    match read_token_from_file() {
        Ok(Some(token)) => {
            log::info!("Gateway token retrieved from fallback file");
            return Ok(token);
        }
        Ok(None) => {
            // No valid token in file, generate one
        }
        Err(e) => {
            log::warn!("Failed to read fallback token file: {}", e);
        }
    }

    // Generate and store in file
    let token = generate_token();
    log::info!("Generated new gateway token (256-bit) for file storage");

    match write_token_to_file(&token) {
        Ok(()) => Ok(token),
        Err(e) => {
            // Last resort: session-only token (not persisted)
            log::warn!("Failed to persist token to file: {}. Using session-only token.", e);
            log::warn!("Gateway token will not survive app restart");
            Ok(token)
        }
    }
}

/// Tauri command: Get the current gateway token for frontend use
#[tauri::command]
pub fn get_gateway_token() -> Result<String, String> {
    get_or_create_gateway_token()
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

    // Get or generate a per-device gateway token (never logged)
    let gateway_token = get_or_create_gateway_token()?;

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
            gateway_token.clone(),
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
            gateway_token.clone(),
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
            gateway_token,
        ]
    };

    // Log command without exposing the token value
    let sanitized_args: Vec<String> = args.iter().enumerate().map(|(i, a)| {
        // The token is always the last argument, preceded by "--token"
        if i > 0 && args[i - 1] == "--token" {
            "[REDACTED]".to_string()
        } else {
            a.clone()
        }
    }).collect();
    log::info!("Gateway command: {:?} {:?}", openclaw_path, sanitized_args);

    // Spawn gateway process
    let child = Command::new(&openclaw_path)
        .args(&args)
        .current_dir(&openclaw_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}. Make sure helix-runtime is built.", e))?;

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

    // Development: helix-runtime is the source, use node to run openclaw.mjs directly
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
    // Try to find helix-runtime relative to the executable
    // Release binary is at: helix-desktop/src-tauri/target/release/helix-desktop.exe
    // We need to go up to find: Helix/helix-runtime
    if let Ok(exe_path) = std::env::current_exe() {
        // From exe: target/release/helix-desktop.exe
        // Go up 4 levels: release -> target -> src-tauri -> helix-desktop -> Helix
        // Then look for helix-runtime sibling
        if let Some(exe_dir) = exe_path.parent() {
            // Try going up 4 levels (for release build structure)
            let helix_root = exe_dir
                .join("..")     // target
                .join("..")     // src-tauri
                .join("..")     // helix-desktop
                .join("..");    // Helix (root)

            let dev_path = helix_root.join("helix-runtime");
            if dev_path.exists() {
                log::info!("Found helix-runtime at (exe relative): {:?}", dev_path);
                return Ok(dev_path.canonicalize().map_err(|e| e.to_string())?);
            }

            // Also try from exe_dir directly (in case structure is different)
            let alt_path = exe_dir.join("..").join("..").join("helix-runtime");
            if alt_path.exists() {
                log::info!("Found helix-runtime at (alt): {:?}", alt_path);
                return Ok(alt_path.canonicalize().map_err(|e| e.to_string())?);
            }
        }
    }

    // Try CARGO_MANIFEST_DIR for cargo run scenarios
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_path = std::path::PathBuf::from(&manifest_dir)
            .join("..")
            .join("..")
            .join("helix-runtime");

        if dev_path.exists() {
            log::info!("Found helix-runtime at (manifest): {:?}", dev_path);
            return Ok(dev_path.canonicalize().map_err(|e| e.to_string())?);
        }
    }

    // Production: try home directory paths
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    // Try ~/.helix/helix-runtime
    let helix_openclaw = home.join(".helix").join("helix-runtime");
    if helix_openclaw.exists() {
        log::info!("Found helix-runtime at (home): {:?}", helix_openclaw);
        return Ok(helix_openclaw);
    }

    // Try ~/.openclaw
    let openclaw_home = home.join(".openclaw");
    if openclaw_home.exists() {
        log::info!("Found openclaw at: {:?}", openclaw_home);
        return Ok(openclaw_home);
    }

    // Hardcoded fallback for known development path
    let known_dev_path = std::path::PathBuf::from("C:\\Users\\Specter\\Desktop\\Helix\\helix-runtime");
    if known_dev_path.exists() {
        log::info!("Found helix-runtime at (hardcoded): {:?}", known_dev_path);
        return Ok(known_dev_path);
    }

    log::warn!("Could not find helix-runtime directory");
    Err("Could not find helix-runtime directory".to_string())
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
