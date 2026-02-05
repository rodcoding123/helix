// Authentication commands - detect existing Claude Code CLI

use std::fs;
use std::process::Command;
use serde::{Deserialize, Serialize};
use chrono::Utc;

/// Claude Code credentials structure (from ~/.claude/.credentials.json)
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCredentialsFile {
    claude_ai_oauth: Option<ClaudeOAuth>,
    #[allow(dead_code)]
    organization_uuid: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeOAuth {
    #[allow(dead_code)]
    access_token: String,
    #[allow(dead_code)]
    refresh_token: Option<String>,
    expires_at: Option<i64>,
    #[allow(dead_code)]
    scopes: Option<Vec<String>>,
    subscription_type: Option<String>,
    #[allow(dead_code)]
    rate_limit_tier: Option<String>,
}

/// Info about detected Claude Code installation
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeInfo {
    /// Claude Code CLI is installed and available in PATH
    pub cli_available: bool,
    /// Claude Code directory exists (~/.claude)
    pub installed: bool,
    /// User is authenticated (has valid credentials)
    pub authenticated: bool,
    /// Subscription type (max, pro, etc.)
    pub subscription_type: Option<String>,
    /// Token expiration timestamp
    pub expires_at: Option<i64>,
    /// CLI path if found
    pub cli_path: Option<String>,
}

/// Check if Claude Code CLI is available
fn check_claude_cli() -> Option<String> {
    // On Windows, try multiple variants since npm installs as .cmd wrapper
    #[cfg(target_os = "windows")]
    {
        // First check common installation locations directly
        if let Some(home) = dirs::home_dir() {
            // Check .local/bin (common for Claude Code)
            let local_bin = home.join(".local").join("bin").join("claude.exe");
            if local_bin.exists() {
                return Some(local_bin.to_string_lossy().to_string());
            }

            // Check npm global install locations
            let npm_roaming = home.join("AppData").join("Roaming").join("npm");
            for name in &["claude.cmd", "claude.exe", "claude"] {
                let path = npm_roaming.join(name);
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }

        // Fall back to where command with multiple variants
        for variant in &["claude.exe", "claude.cmd", "claude"] {
            if let Some(path) = find_in_path("where", variant) {
                return Some(path);
            }
        }
        None
    }

    #[cfg(not(target_os = "windows"))]
    {
        find_in_path("which", "claude")
    }
}

/// Helper to find a command in PATH
fn find_in_path(finder: &str, cmd: &str) -> Option<String> {
    Command::new(finder)
        .arg(cmd)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                String::from_utf8(output.stdout)
                    .ok()
                    .map(|s| s.lines().next().unwrap_or("").trim().to_string())
                    .filter(|s| !s.is_empty())
            } else {
                None
            }
        })
}

/// Detect if Claude Code is installed and authenticated
/// This checks both the CLI availability and credential status
#[tauri::command]
pub fn detect_claude_code() -> Result<ClaudeCodeInfo, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let claude_dir = home.join(".claude");
    let credentials_path = claude_dir.join(".credentials.json");

    // Debug logging
    eprintln!("[HELIX DEBUG] Home dir: {:?}", home);
    eprintln!("[HELIX DEBUG] Claude dir: {:?}, exists: {}", claude_dir, claude_dir.exists());
    eprintln!("[HELIX DEBUG] Credentials path: {:?}, exists: {}", credentials_path, credentials_path.exists());

    // Check if Claude Code CLI is available
    let cli_path = check_claude_cli();
    let cli_available = cli_path.is_some();
    eprintln!("[HELIX DEBUG] CLI path: {:?}, available: {}", cli_path, cli_available);

    // Check if Claude Code directory exists
    if !claude_dir.exists() {
        return Ok(ClaudeCodeInfo {
            cli_available,
            cli_path,
            installed: false,
            authenticated: false,
            subscription_type: None,
            expires_at: None,
        });
    }

    // Check if credentials file exists
    if !credentials_path.exists() {
        return Ok(ClaudeCodeInfo {
            cli_available,
            cli_path,
            installed: true,
            authenticated: false,
            subscription_type: None,
            expires_at: None,
        });
    }

    // Read and parse credentials
    let content = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Failed to read credentials: {}", e))?;

    let creds: ClaudeCredentialsFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse credentials: {}", e))?;

    match creds.claude_ai_oauth {
        Some(oauth) => {
            // Check if token is expired
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);

            let is_expired = oauth.expires_at
                .map(|exp| exp < now_ms)
                .unwrap_or(false);

            if is_expired {
                return Ok(ClaudeCodeInfo {
                    cli_available,
                    cli_path,
                    installed: true,
                    authenticated: false, // Token expired
                    subscription_type: oauth.subscription_type,
                    expires_at: oauth.expires_at,
                });
            }

            Ok(ClaudeCodeInfo {
                cli_available,
                cli_path,
                installed: true,
                authenticated: true,
                subscription_type: oauth.subscription_type,
                expires_at: oauth.expires_at,
            })
        }
        None => Ok(ClaudeCodeInfo {
            cli_available,
            cli_path,
            installed: true,
            authenticated: false,
            subscription_type: None,
            expires_at: None,
        }),
    }
}

/// Run a command via Claude Code CLI (uses the user's authenticated session)
/// This is the proper way to use Claude Code - via subprocess, not token extraction
#[tauri::command]
pub async fn run_claude_code(prompt: String, working_dir: Option<String>) -> Result<String, String> {
    let cli_path = check_claude_cli()
        .ok_or_else(|| "Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code".to_string())?;

    let mut cmd = Command::new(&cli_path);

    // Use print mode for non-interactive output
    cmd.arg("--print");
    cmd.arg(&prompt);

    // Set working directory if provided
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to run Claude Code: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 in output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Claude Code error: {}", stderr))
    }
}

// ============================================================================
// OpenClaw OAuth Integration (Phase 1: OAuth Local Authority Foundation)
// ============================================================================

/// Result of running an OpenClaw OAuth flow
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthFlowResult {
    /// Whether the flow succeeded
    pub success: bool,

    /// Which provider (anthropic, openai-codex, etc.)
    pub provider: String,

    /// Token type (oauth, setup-token)
    pub token_type: String,

    /// Path where credentials were stored
    pub stored_in_path: String,

    /// Error message if unsuccessful
    pub error: Option<String>,
}

/// Result of checking for stored credentials
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckCredentialsResult {
    /// Whether credentials are stored for this provider
    pub stored: bool,

    /// Error message if check failed
    pub error: Option<String>,
}

/// Get the path to OpenClaw's auth profiles directory
fn get_auth_profiles_path() -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;

    let auth_profiles = home
        .join(".openclaw")
        .join("agents")
        .join("main")
        .join("agent")
        .join("auth-profiles.json");

    Ok(auth_profiles.to_string_lossy().to_string())
}

/// Run OpenClaw OAuth flow for a provider
///
/// Executes: `openclaw models auth <flow> --provider <provider>`
/// This delegates to OpenClaw's CLI which handles the actual OAuth flow.
///
/// **BYOK Pattern**: Credentials stored locally, never transmitted to Helix servers.
#[tauri::command]
pub async fn run_openclaw_oauth(provider: String, flow: String) -> Result<OAuthFlowResult, String> {
    // Validate inputs
    let valid_providers = vec!["anthropic", "openai-codex"];
    if !valid_providers.contains(&provider.as_str()) {
        return Err(format!("Unsupported provider: {}", provider));
    }

    // Build OpenClaw CLI command
    let mut cmd = Command::new("openclaw");
    cmd.arg("models").arg("auth");

    match flow.as_str() {
        "setup-token" => {
            // Anthropic setup-token flow: openclaw models auth setup-token --provider anthropic
            cmd.arg("setup-token")
                .arg("--provider")
                .arg(&provider);
        }
        "pkce" => {
            // OpenAI PKCE flow: openclaw models auth login --provider openai-codex
            cmd.arg("login")
                .arg("--provider")
                .arg(&provider);
        }
        _ => {
            return Err(format!("Unsupported flow: {}", flow));
        }
    }

    // Execute OpenClaw subprocess
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute openclaw: {}", e))?;

    let auth_profiles_path = get_auth_profiles_path()?;

    if output.status.success() {
        Ok(OAuthFlowResult {
            success: true,
            provider: provider.clone(),
            token_type: flow.clone(),
            stored_in_path: auth_profiles_path,
            error: None,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(stderr)
    }
}

/// Check if credentials are stored for a provider
///
/// Reads auth-profiles.json and checks if the provider has credentials.
/// Returns early if file doesn't exist (graceful fallback).
#[tauri::command]
pub fn check_oauth_credentials(provider: String) -> Result<CheckCredentialsResult, String> {
    let auth_profiles_path = get_auth_profiles_path()?;

    // Check if file exists (may not if user hasn't authenticated yet)
    if !std::path::Path::new(&auth_profiles_path).exists() {
        return Ok(CheckCredentialsResult {
            stored: false,
            error: None,
        });
    }

    // Read auth-profiles.json
    let content = fs::read_to_string(&auth_profiles_path)
        .map_err(|e| format!("Failed to read auth profiles: {}", e))?;

    // Parse JSON
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid auth profiles JSON: {}", e))?;

    // Check if provider has credentials
    let stored = json
        .get("profiles")
        .and_then(|profiles| profiles.get(&provider))
        .is_some();

    Ok(CheckCredentialsResult {
        stored,
        error: None,
    })
}

// ============================================================================
// Supabase Authentication (Unified Auth System)
// ============================================================================

/// Supabase login response
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseLoginResponse {
    pub success: bool,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub tier: Option<String>,
    pub error: Option<String>,
}

/// Supabase signup response
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseSignupResponse {
    pub success: bool,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub tier: Option<String>,
    pub error: Option<String>,
}

/// Instance registration response
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceRegistrationResponse {
    pub success: bool,
    pub error: Option<String>,
}

/// Heartbeat response
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatResponse {
    pub success: bool,
    pub error: Option<String>,
}

/// Supabase user tier
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupabaseSubscription {
    user_id: String,
    tier: String,
}

/// Get Supabase credentials from environment
fn get_supabase_credentials() -> Result<(String, String), String> {
    let anon_key = std::env::var("SUPABASE_ANON_KEY")
        .or_else(|_| std::env::var("SUPABASE_ANON_KEY"))
        .map_err(|_| "SUPABASE_ANON_KEY environment variable not set".to_string())?;

    let service_role_key = std::env::var("SUPABASE_SERVICE_ROLE_KEY")
        .or_else(|_| std::env::var("SUPABASE_SERVICE_ROLE_KEY"))
        .map_err(|_| "SUPABASE_SERVICE_ROLE_KEY environment variable not set".to_string())?;

    Ok((anon_key, service_role_key))
}

/// Get Supabase URL from environment or use default
fn get_supabase_url() -> Result<String, String> {
    Ok(std::env::var("SUPABASE_URL")
        .unwrap_or_else(|_| "https://helix-backend.supabase.co".to_string()))
}

/// Log in with Supabase (email/password)
///
/// Authenticates user via Supabase Auth and retrieves their subscription tier.
/// Returns user_id, email, and tier (awaken, phantom, overseer, architect).
#[tauri::command]
pub async fn supabase_login(
    email: String,
    password: String,
) -> Result<SupabaseLoginResponse, String> {
    let (anon_key, _) = get_supabase_credentials()?;
    let supabase_url = get_supabase_url()?;

    let client = reqwest::Client::new();

    // Step 1: Authenticate with Supabase
    let auth_response = client
        .post(&format!("{}/auth/v1/token?grant_type=password", supabase_url))
        .header("apikey", &anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": email,
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Supabase: {}", e))?;

    if !auth_response.status().is_success() {
        return Ok(SupabaseLoginResponse {
            success: false,
            error: Some("Invalid email or password".to_string()),
            ..Default::default()
        });
    }

    let auth_data: serde_json::Value = auth_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse auth response: {}", e))?;

    let user_id = auth_data
        .get("user")
        .and_then(|u| u.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| "Missing user ID in response".to_string())?
        .to_string();

    let access_token = auth_data
        .get("access_token")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "Missing access token".to_string())?;

    // Step 2: Fetch subscription tier
    let tier = match client
        .get(&format!(
            "{}/rest/v1/subscriptions?user_id=eq.{}",
            supabase_url, user_id
        ))
        .header("apikey", &anon_key)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(data) = resp.json::<Vec<SupabaseSubscription>>().await {
                data.first()
                    .map(|s| s.tier.clone())
                    .unwrap_or("awaken".to_string())
            } else {
                "awaken".to_string()
            }
        }
        Err(_) => "awaken".to_string(),
    };

    Ok(SupabaseLoginResponse {
        success: true,
        user_id: Some(user_id),
        email: Some(email),
        tier: Some(tier),
        error: None,
    })
}

/// Sign up with Supabase (email/password)
///
/// Creates a new user account and auto-provisions with tier='awaken' (free).
/// Password must be at least 8 characters.
#[tauri::command]
pub async fn supabase_signup(
    email: String,
    password: String,
) -> Result<SupabaseSignupResponse, String> {
    // Validate password strength
    if password.len() < 8 {
        return Ok(SupabaseSignupResponse {
            success: false,
            error: Some("Password must be at least 8 characters".to_string()),
            ..Default::default()
        });
    }

    let (anon_key, _) = get_supabase_credentials()?;
    let supabase_url = get_supabase_url()?;

    let client = reqwest::Client::new();

    // Create new user account
    let signup_response = client
        .post(&format!("{}/auth/v1/signup", supabase_url))
        .header("apikey", &anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": email,
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Supabase: {}", e))?;

    if !signup_response.status().is_success() {
        let error_text = signup_response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(SupabaseSignupResponse {
            success: false,
            error: Some(error_text),
            ..Default::default()
        });
    }

    let signup_data: serde_json::Value = signup_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse signup response: {}", e))?;

    let user_id = signup_data
        .get("user")
        .and_then(|u| u.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| "Missing user ID in response".to_string())?
        .to_string();

    // Auto-provision with free tier (trigger handles this)
    Ok(SupabaseSignupResponse {
        success: true,
        user_id: Some(user_id),
        email: Some(email),
        tier: Some("awaken".to_string()),
        error: None,
    })
}

/// Register this device instance with Supabase
///
/// Inserts into user_instances table so web dashboard knows about this device.
/// Handles conflicts by updating if instance_id already exists.
#[tauri::command]
pub async fn register_instance(
    user_id: String,
    instance_id: String,
    device_name: String,
    device_type: String,
    platform: String,
) -> Result<InstanceRegistrationResponse, String> {
    let (anon_key, _) = get_supabase_credentials()?;
    let supabase_url = get_supabase_url()?;

    let client = reqwest::Client::new();

    // Insert into user_instances (upsert on conflict)
    let response = client
        .post(&format!("{}/rest/v1/user_instances", supabase_url))
        .header("apikey", &anon_key)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .json(&serde_json::json!({
            "user_id": user_id,
            "instance_id": instance_id,
            "device_name": device_name,
            "device_type": device_type,
            "platform": platform,
            "last_heartbeat": Utc::now().to_rfc3339(),
            "is_online": true
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to register instance: {}", e))?;

    if response.status().is_success() {
        Ok(InstanceRegistrationResponse {
            success: true,
            error: None,
        })
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to register instance".to_string());
        Ok(InstanceRegistrationResponse {
            success: false,
            error: Some(error_text),
        })
    }
}

/// Send heartbeat to keep instance online status fresh
///
/// Call every 60 seconds to keep is_online=true and last_heartbeat updated.
/// This is called periodically by the frontend and doesn't require user context.
#[tauri::command]
pub async fn send_heartbeat(instance_id: String) -> Result<HeartbeatResponse, String> {
    let (anon_key, _) = get_supabase_credentials()?;
    let supabase_url = get_supabase_url()?;

    let client = reqwest::Client::new();

    let response = client
        .patch(&format!(
            "{}/rest/v1/user_instances?instance_id=eq.{}",
            supabase_url, instance_id
        ))
        .header("apikey", &anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "last_heartbeat": Utc::now().to_rfc3339(),
            "is_online": true
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to send heartbeat: {}", e))?;

    if response.status().is_success() {
        Ok(HeartbeatResponse {
            success: true,
            error: None,
        })
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to send heartbeat".to_string());
        Ok(HeartbeatResponse {
            success: false,
            error: Some(error_text),
        })
    }
}

/// Get the system hostname for default device name
///
/// Returns machine hostname (e.g., "MacBook-Pro", "DESKTOP-ABC123")
#[tauri::command]
pub fn get_hostname() -> Result<String, String> {
    hostname::get()
        .map_err(|e| format!("Failed to get hostname: {}", e))
        .map(|h| h.into_string().unwrap_or_else(|_| "Desktop".to_string()))
}
