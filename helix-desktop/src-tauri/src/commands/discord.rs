// Discord webhook logging commands

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct WebhookPayload {
    pub content: Option<String>,
    pub embeds: Option<Vec<WebhookEmbed>>,
}

#[derive(Serialize, Deserialize)]
pub struct WebhookEmbed {
    pub title: Option<String>,
    pub description: Option<String>,
    pub color: Option<u32>,
    pub timestamp: Option<String>,
    pub fields: Option<Vec<WebhookField>>,
}

#[derive(Serialize, Deserialize)]
pub struct WebhookField {
    pub name: String,
    pub value: String,
    pub inline: Option<bool>,
}

#[derive(Serialize)]
pub struct WebhookTestResult {
    pub success: bool,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn send_webhook(url: String, payload: WebhookPayload) -> Result<(), String> {
    let client = reqwest::Client::new();

    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send webhook: {}", e))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Webhook failed with status: {}",
            response.status()
        ))
    }
}

#[tauri::command]
pub async fn test_webhook(url: String) -> Result<WebhookTestResult, String> {
    let client = reqwest::Client::new();

    let test_payload = WebhookPayload {
        content: None,
        embeds: Some(vec![WebhookEmbed {
            title: Some("Helix Connection Test".to_string()),
            description: Some("This is a test message from Helix Desktop.".to_string()),
            color: Some(0x00ff00), // Green
            timestamp: Some(chrono_now()),
            fields: Some(vec![
                WebhookField {
                    name: "Status".to_string(),
                    value: "Connected".to_string(),
                    inline: Some(true),
                },
                WebhookField {
                    name: "App".to_string(),
                    value: "Helix Desktop".to_string(),
                    inline: Some(true),
                },
            ]),
        }]),
    };

    match client.post(&url).json(&test_payload).send().await {
        Ok(response) => {
            let status = response.status();
            Ok(WebhookTestResult {
                success: status.is_success(),
                status_code: Some(status.as_u16()),
                error: if status.is_success() {
                    None
                } else {
                    Some(format!("HTTP {}", status))
                },
            })
        }
        Err(e) => Ok(WebhookTestResult {
            success: false,
            status_code: None,
            error: Some(e.to_string()),
        }),
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    // Return ISO 8601 format approximation
    let secs = now.as_secs();
    let days = secs / 86400;
    let years = 1970 + (days / 365);
    let remaining_days = days % 365;
    let months = remaining_days / 30 + 1;
    let day = remaining_days % 30 + 1;
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        years, months, day, hours, minutes, seconds
    )
}
