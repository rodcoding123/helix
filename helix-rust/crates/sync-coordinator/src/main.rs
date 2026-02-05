use anyhow::Result;
use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
    routing::get,
    Router,
};
use clap::Parser;
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use helix_shared::SupabaseClient;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;
use tracing_subscriber;
use uuid::Uuid;

mod vector_clock;
mod conflict_resolution;

use vector_clock::VectorClock;
use conflict_resolution::SyncEntity;

#[derive(Clone)]
struct AppState {
    supabase: SupabaseClient,
    broadcast_tx: broadcast::Sender<SyncMessage>,
    connected_clients: Arc<DashMap<String, ClientInfo>>,
}

#[derive(Clone, Debug)]
struct ClientInfo {
    device_id: String,
    user_id: Uuid,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum SyncMessage {
    Delta {
        entity_type: String,
        entity_id: Uuid,
        data: serde_json::Value,
        vector_clock: VectorClock,
        device_id: String,
    },
    Conflict {
        entity_id: Uuid,
        local: SyncEntity,
        remote: SyncEntity,
    },
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value_t = 18792)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let supabase = SupabaseClient::new().await?;
    let (broadcast_tx, _) = broadcast::channel(100);
    let connected_clients = Arc::new(DashMap::new());

    let state = AppState {
        supabase,
        broadcast_tx,
        connected_clients,
    };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", args.port)).await?;
    info!("Sync coordinator listening on port {}", args.port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    let device_id = Uuid::new_v4().to_string();
    info!("Client connected: {}", device_id);

    // Broadcast task
    let broadcast_task = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap();
            if sender.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                break;
            }
        }
    });

    // Receive task
    while let Some(Ok(msg)) = receiver.next().await {
        if let axum::extract::ws::Message::Text(text) = msg {
            if let Ok(sync_msg) = serde_json::from_str::<SyncMessage>(&text) {
                // Broadcast to all other clients
                let _ = state.broadcast_tx.send(sync_msg);
            }
        }
    }

    info!("Client disconnected: {}", device_id);
    broadcast_task.abort();
}
