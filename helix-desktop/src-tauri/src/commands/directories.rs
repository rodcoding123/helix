/// Directories Command Module
/// Provides application path management

use tauri::AppHandle;

#[tauri::command]
pub async fn get_cache_dir(_app: AppHandle) -> Result<String, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to determine cache directory".to_string())?
        .join("helix");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    cache_dir
        .to_str()
        .map(|s: &str| s.to_string())
        .ok_or("Cache path is not valid UTF-8".to_string())
}

#[tauri::command]
pub async fn get_data_dir(_app: AppHandle) -> Result<String, String> {
    let data_dir = dirs::data_dir()
        .ok_or("Failed to determine data directory".to_string())?
        .join("helix");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    data_dir
        .to_str()
        .map(|s: &str| s.to_string())
        .ok_or("Data path is not valid UTF-8".to_string())
}

#[tauri::command]
pub async fn get_app_dir(_app: AppHandle) -> Result<String, String> {
    let app_dir = dirs::config_dir()
        .ok_or("Failed to determine app directory".to_string())?
        .join("helix");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    app_dir
        .to_str()
        .map(|s: &str| s.to_string())
        .ok_or("App path is not valid UTF-8".to_string())
}

#[tauri::command]
pub async fn get_config_dir(_app: AppHandle) -> Result<String, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Failed to determine config directory".to_string())?
        .join("helix");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    config_dir
        .to_str()
        .map(|s: &str| s.to_string())
        .ok_or("Config path is not valid UTF-8".to_string())
}
