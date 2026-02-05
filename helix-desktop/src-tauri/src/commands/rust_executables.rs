// Rust Executables Integration
// Manages spawning and monitoring of CPU-intensive Rust binaries

use std::collections::HashMap;
use std::process::{Child, Command};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::command;

lazy_static::lazy_static! {
    static ref RUNNING_PROCESSES: Mutex<HashMap<String, Child>> =
        Mutex::new(HashMap::new());
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RustExeStatus {
    pub name: String,
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
}

/// Start Memory Synthesis engine
/// Performs CPU-intensive pattern recognition on memories from Supabase
#[command]
pub async fn start_memory_synthesis(user_id: String) -> Result<String, String> {
    let binary_path = find_binary("memory-synthesis")?;

    let child = Command::new(&binary_path)
        .arg("--user-id")
        .arg(&user_id)
        .spawn()
        .map_err(|e| format!("Failed to spawn memory-synthesis: {}", e))?;

    let pid = child.id();
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    processes.insert("memory-synthesis".to_string(), child);

    Ok(format!(
        "Memory synthesis started with PID {} for user {}",
        pid, user_id
    ))
}

/// Start Skill Execution Sandbox
/// WASM-based secure sandbox for skill execution
#[command]
pub async fn start_skill_sandbox(port: Option<u16>) -> Result<String, String> {
    let binary_path = find_binary("skill-sandbox")?;
    let port_num = port.unwrap_or(18790);

    let child = Command::new(&binary_path)
        .arg("--port")
        .arg(port_num.to_string())
        .spawn()
        .map_err(|e| format!("Failed to spawn skill-sandbox: {}", e))?;

    let pid = child.id();
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    processes.insert("skill-sandbox".to_string(), child);

    Ok(format!(
        "Skill sandbox started on port {} with PID {}",
        port_num, pid
    ))
}

/// Start Voice Processing Pipeline
/// Handles audio processing and voice integration
#[command]
pub async fn start_voice_pipeline(port: Option<u16>) -> Result<String, String> {
    let binary_path = find_binary("voice-pipeline")?;
    let port_num = port.unwrap_or(18791);

    let child = Command::new(&binary_path)
        .arg("--port")
        .arg(port_num.to_string())
        .spawn()
        .map_err(|e| format!("Failed to spawn voice-pipeline: {}", e))?;

    let pid = child.id();
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    processes.insert("voice-pipeline".to_string(), child);

    Ok(format!(
        "Voice pipeline started on port {} with PID {}",
        port_num, pid
    ))
}

/// Start Sync Coordinator
/// Manages synchronization across multiple Helix instances
#[command]
pub async fn start_sync_coordinator(port: Option<u16>) -> Result<String, String> {
    let binary_path = find_binary("sync-coordinator")?;
    let port_num = port.unwrap_or(18792);

    let child = Command::new(&binary_path)
        .arg("--port")
        .arg(port_num.to_string())
        .spawn()
        .map_err(|e| format!("Failed to spawn sync-coordinator: {}", e))?;

    let pid = child.id();
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    processes.insert("sync-coordinator".to_string(), child);

    Ok(format!(
        "Sync coordinator started on port {} with PID {}",
        port_num, pid
    ))
}

/// Start Psychology Decay Calculator
/// Computes memory decay using psychological models
/// Can run once or on schedule (handled by scheduler)
#[command]
pub async fn start_psychology_decay(once: Option<bool>) -> Result<String, String> {
    let binary_path = find_binary("psychology-decay")?;

    let mut cmd = Command::new(&binary_path);

    if once.unwrap_or(false) {
        cmd.arg("--once");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run psychology-decay: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Get status of all Rust executables
/// Returns running status, port, and PID for each binary
#[command]
pub async fn get_rust_exe_status() -> Result<Vec<RustExeStatus>, String> {
    let processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;

    let statuses = vec![
        RustExeStatus {
            name: "memory-synthesis".to_string(),
            running: processes.contains_key("memory-synthesis"),
            port: None,
            pid: None,
        },
        RustExeStatus {
            name: "skill-sandbox".to_string(),
            running: processes.contains_key("skill-sandbox"),
            port: Some(18790),
            pid: None,
        },
        RustExeStatus {
            name: "voice-pipeline".to_string(),
            running: processes.contains_key("voice-pipeline"),
            port: Some(18791),
            pid: None,
        },
        RustExeStatus {
            name: "sync-coordinator".to_string(),
            running: processes.contains_key("sync-coordinator"),
            port: Some(18792),
            pid: None,
        },
        RustExeStatus {
            name: "psychology-decay".to_string(),
            running: false, // One-shot tool, never stays running
            port: None,
            pid: None,
        },
    ];

    Ok(statuses)
}

/// Stop a running Rust executable
/// Kills the process and removes it from tracking
#[command]
pub async fn stop_rust_exe(name: String) -> Result<String, String> {
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = processes.remove(&name) {
        child
            .kill()
            .map_err(|e| format!("Failed to kill {}: {}", name, e))?;
        Ok(format!("Stopped {}", name))
    } else {
        Err(format!("{} is not running", name))
    }
}

/// Stop all running Rust executables
/// Called on shutdown
#[command]
pub async fn stop_all_rust_exes() -> Result<String, String> {
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;

    let mut killed = Vec::new();
    for (name, mut child) in processes.drain() {
        if let Ok(()) = child.kill() {
            killed.push(name);
        }
    }

    if killed.is_empty() {
        Ok("No processes to stop".to_string())
    } else {
        Ok(format!("Stopped processes: {}", killed.join(", ")))
    }
}

/// Find binary path - checks multiple locations
/// 1. Relative path in app bundle (./helix-rust/target/release/)
/// 2. System PATH
fn find_binary(name: &str) -> Result<String, String> {
    let exe_name = if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    // Try relative path first (development/bundled)
    let relative_path = format!("./helix-rust/target/release/{}", exe_name);
    if std::path::Path::new(&relative_path).exists() {
        return Ok(relative_path);
    }

    // Try system PATH
    if let Ok(output) = Command::new("which")
        .arg(&exe_name)
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }

    // Try in current directory (fallback for Windows)
    if std::path::Path::new(&exe_name).exists() {
        return Ok(exe_name);
    }

    Err(format!(
        "Binary {} not found. Tried: ./{}, system PATH",
        name, relative_path
    ))
}
