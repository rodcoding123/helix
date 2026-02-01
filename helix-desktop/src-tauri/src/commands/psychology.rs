// Psychology layer commands for Helix seven-layer architecture

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

/// Response for soul content
#[derive(Serialize)]
pub struct SoulResponse {
    pub content: String,
    #[serde(rename = "lastModified")]
    pub last_modified: u64,
}

/// Response for a layer
#[derive(Serialize)]
pub struct LayerResponse {
    pub layer: String,
    pub data: serde_json::Value,
    #[serde(rename = "lastModified")]
    pub last_modified: u64,
}

/// Psychology configuration that maps to the GUI settings
#[derive(Deserialize, Serialize, Clone)]
pub struct MemoryDecayConfig {
    pub enabled: bool,
    pub mode: String,        // "soft" or "hard"
    pub rate: f64,           // 0.0 to 1.0
    #[serde(rename = "minimumIntensity")]
    pub minimum_intensity: f64,
    #[serde(rename = "trustDecayEnabled")]
    pub trust_decay_enabled: bool,
    #[serde(rename = "preserveHighSalience")]
    pub preserve_high_salience: bool,
}

/// Layer file mappings
const LAYER_FILES: &[(&str, &[&str])] = &[
    ("narrative", &["psychology/psyeval.json"]),
    ("emotional", &["psychology/emotional_tags.json"]),
    ("relational", &["psychology/attachments.json", "psychology/trust_map.json"]),
    ("prospective", &["identity/goals.json", "identity/feared_self.json", "identity/possible_selves.json"]),
    ("integration", &[]),  // Scripts, not JSON files
    ("transformation", &["transformation/current_state.json", "transformation/history.json"]),
    ("purpose", &["purpose/ikigai.json", "purpose/wellness.json", "purpose/meaning_sources.json"]),
];

fn get_helix_dir() -> Result<PathBuf, String> {
    // Check for HELIX_PROJECT_DIR env var first
    if let Ok(dir) = std::env::var("HELIX_PROJECT_DIR") {
        return Ok(PathBuf::from(dir));
    }

    // Fall back to current directory or ~/.helix
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    Ok(home.join(".helix"))
}

fn get_file_modified_time(path: &PathBuf) -> u64 {
    path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_soul() -> Result<SoulResponse, String> {
    let helix_dir = get_helix_dir()?;
    let soul_path = helix_dir.join("soul").join("HELIX_SOUL.md");

    let content = fs::read_to_string(&soul_path)
        .map_err(|e| format!("Failed to read soul file: {}", e))?;

    let last_modified = get_file_modified_time(&soul_path);

    Ok(SoulResponse {
        content,
        last_modified,
    })
}

#[tauri::command]
pub fn update_soul(content: String) -> Result<(), String> {
    let helix_dir = get_helix_dir()?;
    let soul_path = helix_dir.join("soul").join("HELIX_SOUL.md");

    // Ensure directory exists
    if let Some(parent) = soul_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create soul directory: {}", e))?;
    }

    fs::write(&soul_path, content)
        .map_err(|e| format!("Failed to write soul file: {}", e))
}

#[tauri::command]
pub fn get_layer(layer: String) -> Result<LayerResponse, String> {
    let helix_dir = get_helix_dir()?;

    // Find the layer files
    let files: Vec<&str> = LAYER_FILES
        .iter()
        .find(|(name, _)| *name == layer)
        .map(|(_, files)| files.to_vec())
        .ok_or_else(|| format!("Unknown layer: {}", layer))?;

    if files.is_empty() {
        return Ok(LayerResponse {
            layer,
            data: serde_json::json!({}),
            last_modified: 0,
        });
    }

    // Merge all files for this layer
    let mut merged_data = serde_json::Map::new();
    let mut latest_modified = 0u64;

    for file_rel in files {
        let file_path = helix_dir.join(file_rel);

        if file_path.exists() {
            let content = fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read {}: {}", file_rel, e))?;

            let data: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse {}: {}", file_rel, e))?;

            // Get file name without extension as key
            let key = PathBuf::from(file_rel)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();

            merged_data.insert(key, data);

            let modified = get_file_modified_time(&file_path);
            if modified > latest_modified {
                latest_modified = modified;
            }
        }
    }

    Ok(LayerResponse {
        layer,
        data: serde_json::Value::Object(merged_data),
        last_modified: latest_modified,
    })
}

#[tauri::command]
pub fn get_all_layers() -> Result<HashMap<String, LayerResponse>, String> {
    let mut result = HashMap::new();

    for (layer_name, _) in LAYER_FILES {
        match get_layer(layer_name.to_string()) {
            Ok(response) => {
                result.insert(layer_name.to_string(), response);
            }
            Err(e) => {
                log::warn!("Failed to load layer {}: {}", layer_name, e);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn update_layer(layer: String, data: serde_json::Value) -> Result<(), String> {
    let helix_dir = get_helix_dir()?;

    // Find the layer files
    let files: Vec<&str> = LAYER_FILES
        .iter()
        .find(|(name, _)| *name == layer)
        .map(|(_, files)| files.to_vec())
        .ok_or_else(|| format!("Unknown layer: {}", layer))?;

    if files.is_empty() {
        return Err("Cannot update integration layer directly".to_string());
    }

    // For single-file layers, write directly
    // For multi-file layers, expect data to be keyed by file name
    if files.len() == 1 {
        let file_path = helix_dir.join(files[0]);

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Failed to serialize data: {}", e))?;

        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to write file: {}", e))
    } else {
        // Multi-file layer: data should be an object with keys matching file stems
        let data_obj = data.as_object()
            .ok_or_else(|| "Data must be an object for multi-file layers".to_string())?;

        for file_rel in files {
            let file_path = helix_dir.join(file_rel);

            let key = PathBuf::from(file_rel)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();

            if let Some(file_data) = data_obj.get(&key) {
                if let Some(parent) = file_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                }

                let content = serde_json::to_string_pretty(file_data)
                    .map_err(|e| format!("Failed to serialize data: {}", e))?;

                fs::write(&file_path, content)
                    .map_err(|e| format!("Failed to write {}: {}", file_rel, e))?;
            }
        }

        Ok(())
    }
}

#[tauri::command]
pub fn run_decay(dry_run: bool) -> Result<String, String> {
    let helix_dir = get_helix_dir()?;
    let script_path = helix_dir.join("scripts").join("decay.py");

    if !script_path.exists() {
        return Err("decay.py script not found".to_string());
    }

    let mut cmd = std::process::Command::new("python3");
    cmd.arg(&script_path);

    if dry_run {
        cmd.env("HELIX_DRY_RUN", "true");
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to run decay script: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn run_synthesis(dry_run: bool) -> Result<String, String> {
    let helix_dir = get_helix_dir()?;
    let script_path = helix_dir.join("scripts").join("synthesis.py");

    if !script_path.exists() {
        return Err("synthesis.py script not found".to_string());
    }

    let mut cmd = std::process::Command::new("python3");
    cmd.arg(&script_path);

    if dry_run {
        cmd.env("HELIX_DRY_RUN", "true");
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to run synthesis script: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn restore_from_decay() -> Result<String, String> {
    let helix_dir = get_helix_dir()?;
    let script_path = helix_dir.join("scripts").join("decay.py");

    if !script_path.exists() {
        return Err("decay.py script not found".to_string());
    }

    let output = std::process::Command::new("python3")
        .arg(&script_path)
        .arg("--restore")
        .output()
        .map_err(|e| format!("Failed to run restore: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn get_layer_status() -> Result<Vec<LayerStatus>, String> {
    let helix_dir = get_helix_dir()?;
    let mut status = Vec::new();

    for (layer_name, files) in LAYER_FILES {
        let mut layer_status = LayerStatus {
            id: layer_name.to_string(),
            name: get_layer_display_name(layer_name),
            status: "inactive".to_string(),
            file_count: 0,
            total_files: files.len(),
            last_modified: None,
        };

        let mut found_files = 0;
        let mut latest_modified = 0u64;

        for file_rel in *files {
            let file_path = helix_dir.join(file_rel);
            if file_path.exists() {
                found_files += 1;
                let modified = get_file_modified_time(&file_path);
                if modified > latest_modified {
                    latest_modified = modified;
                }
            }
        }

        layer_status.file_count = found_files;

        if found_files == files.len() && !files.is_empty() {
            layer_status.status = "healthy".to_string();
            layer_status.last_modified = Some(latest_modified);
        } else if found_files > 0 {
            layer_status.status = "warning".to_string();
            layer_status.last_modified = Some(latest_modified);
        } else if files.is_empty() {
            // Integration layer has no files - check if scripts exist
            let decay_exists = helix_dir.join("scripts/decay.py").exists();
            let synthesis_exists = helix_dir.join("scripts/synthesis.py").exists();

            if decay_exists && synthesis_exists {
                layer_status.status = "healthy".to_string();
            } else if decay_exists || synthesis_exists {
                layer_status.status = "warning".to_string();
            }
        }

        status.push(layer_status);
    }

    Ok(status)
}

#[derive(Serialize)]
pub struct LayerStatus {
    pub id: String,
    pub name: String,
    pub status: String,  // healthy, warning, error, inactive
    pub file_count: usize,
    pub total_files: usize,
    #[serde(rename = "lastModified")]
    pub last_modified: Option<u64>,
}

fn get_layer_display_name(id: &str) -> String {
    match id {
        "narrative" => "Narrative Core",
        "emotional" => "Emotional Memory",
        "relational" => "Relational Memory",
        "prospective" => "Prospective Self",
        "integration" => "Integration Rhythms",
        "transformation" => "Transformation",
        "purpose" => "Purpose Engine",
        _ => id,
    }.to_string()
}
