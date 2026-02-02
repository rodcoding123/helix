// File system commands

use std::fs;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    // Validate path is within allowed directories
    validate_path(&path)?;

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Validate path is within allowed directories
    validate_path(&path)?;

    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    validate_path(&path)?;

    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry.metadata().ok();

        result.push(DirectoryEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_directory: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: metadata
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn file_exists(path: String) -> Result<bool, String> {
    validate_path(&path)?;
    Ok(PathBuf::from(&path).exists())
}

#[tauri::command]
pub fn ensure_directory(path: String) -> Result<(), String> {
    validate_path(&path)?;

    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

fn validate_path(path: &str) -> Result<(), String> {
    let path_buf = PathBuf::from(path);

    // Get home directory
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let helix_dir = home.join(".helix");

    // Canonicalize paths for comparison (if they exist)
    let canonical_path = if path_buf.exists() {
        path_buf.canonicalize().ok()
    } else {
        // For non-existent paths, check the parent
        path_buf.parent().and_then(|p| p.canonicalize().ok())
    };

    let canonical_helix = helix_dir.canonicalize().ok();

    // Allow access only to .helix directory
    match (canonical_path, canonical_helix) {
        (Some(p), Some(h)) if p.starts_with(&h) => Ok(()),
        // If helix dir doesn't exist yet, allow creating it
        (None, None) if path.contains(".helix") => Ok(()),
        _ => {
            // Also allow if path contains .helix (for first-time setup)
            if path.contains(".helix") {
                Ok(())
            } else {
                Err("Access denied: path outside .helix directory".to_string())
            }
        }
    }
}
