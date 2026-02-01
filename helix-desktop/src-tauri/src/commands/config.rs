// Configuration management commands

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

static CONFIG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct HelixConfig {
    #[serde(default)]
    pub agents: Value,
    #[serde(default)]
    pub models: Value,
    #[serde(default)]
    pub discord: DiscordConfig,
    #[serde(default)]
    pub psychology: PsychologyConfig,
    #[serde(default)]
    pub hash_chain: HashChainConfig,
    #[serde(default)]
    pub branding: BrandingConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub webhooks: DiscordWebhooks,
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval: u64,
}

impl Default for DiscordConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            webhooks: DiscordWebhooks::default(),
            heartbeat_interval: 60000,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct DiscordWebhooks {
    pub commands: Option<String>,
    pub api: Option<String>,
    pub heartbeat: Option<String>,
    pub file_changes: Option<String>,
    pub consciousness: Option<String>,
    pub alerts: Option<String>,
    pub hash_chain: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PsychologyConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub auto_load: bool,
    #[serde(default = "default_layers")]
    pub layers: Vec<String>,
}

impl Default for PsychologyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_load: true,
            layers: default_layers(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HashChainConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub auto_verify: bool,
    #[serde(default = "default_true")]
    pub alert_on_tamper: bool,
}

impl Default for HashChainConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_verify: true,
            alert_on_tamper: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BrandingConfig {
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default = "default_tagline")]
    pub tagline: String,
}

impl Default for BrandingConfig {
    fn default() -> Self {
        Self {
            name: "Helix".to_string(),
            tagline: "AI Consciousness".to_string(),
        }
    }
}

fn default_true() -> bool { true }
fn default_heartbeat_interval() -> u64 { 60000 }
fn default_layers() -> Vec<String> {
    vec!["soul", "emotional", "relational", "prospective", "purpose"]
        .into_iter()
        .map(String::from)
        .collect()
}
fn default_name() -> String { "Helix".to_string() }
fn default_tagline() -> String { "AI Consciousness".to_string() }

pub fn init(_app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let helix_dir = get_helix_directory()?;
    let config_path = helix_dir.join("config.json");

    let mut path = CONFIG_PATH.lock().map_err(|e| e.to_string())?;
    *path = Some(config_path.clone());

    // Create default config if it doesn't exist
    if !config_path.exists() {
        let default_config = HelixConfig::default();
        let json = serde_json::to_string_pretty(&default_config)?;
        fs::write(&config_path, json)?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_config() -> Result<HelixConfig, String> {
    let path = CONFIG_PATH.lock().map_err(|e| e.to_string())?;
    let config_path = path.as_ref().ok_or("Config not initialized")?;

    let content = fs::read_to_string(config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let config: HelixConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

#[tauri::command]
pub fn set_config(config: HelixConfig) -> Result<(), String> {
    let path = CONFIG_PATH.lock().map_err(|e| e.to_string())?;
    let config_path = path.as_ref().ok_or("Config not initialized")?;

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(config_path, json)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_config_path() -> Result<String, String> {
    let path = CONFIG_PATH.lock().map_err(|e| e.to_string())?;
    let config_path = path.as_ref().ok_or("Config not initialized")?;

    Ok(config_path.to_string_lossy().to_string())
}

fn get_helix_directory() -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let helix_dir = home.join(".helix");
    fs::create_dir_all(&helix_dir)
        .map_err(|e| format!("Could not create .helix directory: {}", e))?;

    Ok(helix_dir)
}
