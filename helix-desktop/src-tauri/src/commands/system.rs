// System information and utility commands

use std::fs;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub platform: String,
    pub node_version: Option<String>,
    pub helix_version: String,
}

#[derive(Serialize)]
pub struct HelixPaths {
    pub home: String,
    pub helix_dir: String,
    pub config_path: String,
    pub psychology_dir: String,
    pub logs_dir: String,
    pub sessions_dir: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        platform: get_platform(),
        node_version: get_node_version(),
        helix_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub fn get_helix_paths() -> Result<HelixPaths, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let helix_dir = home.join(".helix");

    Ok(HelixPaths {
        home: home.to_string_lossy().to_string(),
        helix_dir: helix_dir.to_string_lossy().to_string(),
        config_path: helix_dir.join("config.json").to_string_lossy().to_string(),
        psychology_dir: helix_dir.join("psychology").to_string_lossy().to_string(),
        logs_dir: helix_dir.join("logs").to_string_lossy().to_string(),
        sessions_dir: helix_dir.join("sessions").to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn is_first_run() -> Result<bool, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let onboarded_marker = home.join(".helix").join(".onboarded");

    Ok(!onboarded_marker.exists())
}

#[tauri::command]
pub fn mark_onboarded() -> Result<(), String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let helix_dir = home.join(".helix");
    fs::create_dir_all(&helix_dir)
        .map_err(|e| format!("Failed to create .helix directory: {}", e))?;

    let onboarded_marker = helix_dir.join(".onboarded");
    fs::write(&onboarded_marker, "")
        .map_err(|e| format!("Failed to create marker file: {}", e))?;

    Ok(())
}

fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

fn get_node_version() -> Option<String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    let node = "node.exe";
    #[cfg(not(target_os = "windows"))]
    let node = "node";

    Command::new(node)
        .arg("--version")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|s| s.trim().to_string())
}
