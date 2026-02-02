// Authentication commands - detect existing Claude Code CLI

use std::fs;
use std::process::Command;
use serde::{Deserialize, Serialize};

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
