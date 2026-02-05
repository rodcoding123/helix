use anyhow::Result;
use axum::{
    extract::{State, Json},
    routing::post,
    Router,
    response::IntoResponse,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use helix_shared::SupabaseClient;
use uuid::Uuid;
use tracing::{info, error};
use sqlx::Row;

use crate::wasm_runtime::WasmSandbox;

#[derive(Clone)]
struct AppState {
    sandbox: Arc<WasmSandbox>,
    supabase: SupabaseClient,
}

#[derive(Deserialize)]
struct ExecuteRequest {
    skill_id: Uuid,
    input: serde_json::Value,
}

#[derive(Serialize)]
struct ExecuteResponse {
    success: bool,
    output: Option<serde_json::Value>,
    error: Option<String>,
}

pub async fn start_rpc_server(port: u16) -> Result<()> {
    let sandbox = Arc::new(WasmSandbox::new()?);
    let supabase = SupabaseClient::new().await?;

    let state = AppState { sandbox, supabase };

    let app = Router::new()
        .route("/execute", post(execute_skill))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("Skill sandbox RPC server listening on port {}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn execute_skill(
    State(state): State<AppState>,
    Json(req): Json<ExecuteRequest>,
) -> impl IntoResponse {
    info!("Executing skill {}", req.skill_id);

    // 1. Fetch skill WASM from Supabase
    let wasm_bytes = match fetch_skill_wasm(&state.supabase, req.skill_id).await {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("Failed to fetch skill WASM: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(ExecuteResponse {
                success: false,
                output: None,
                error: Some(e.to_string()),
            }));
        }
    };

    // 2. Execute in sandbox
    match state.sandbox.execute(&wasm_bytes, req.input).await {
        Ok(output) => {
            (StatusCode::OK, Json(ExecuteResponse {
                success: true,
                output: Some(output),
                error: None,
            }))
        }
        Err(e) => {
            error!("Skill execution failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ExecuteResponse {
                success: false,
                output: None,
                error: Some(e.to_string()),
            }))
        }
    }
}

async fn fetch_skill_wasm(client: &SupabaseClient, skill_id: Uuid) -> Result<Vec<u8>> {
    let row = sqlx::query(
        "SELECT wasm_bytecode FROM skills WHERE id = $1"
    )
    .bind(skill_id)
    .fetch_one(client.pool())
    .await?;

    let bytes: Vec<u8> = row.try_get("wasm_bytecode")?;
    Ok(bytes)
}
