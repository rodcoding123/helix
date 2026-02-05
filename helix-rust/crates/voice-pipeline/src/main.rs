use anyhow::Result;
use axum::{
    extract::State,
    routing::post,
    Router,
    response::IntoResponse,
    http::StatusCode,
    Json,
    body::Bytes,
};
use clap::Parser;
use helix_shared::SupabaseClient;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tracing::{info, error};
use tracing_subscriber;
use uuid::Uuid;
use chrono::Utc;

mod audio_processing;
mod deepgram_client;

use audio_processing::AudioProcessor;
use deepgram_client::DeepgramClient;

#[derive(Clone)]
struct AppState {
    audio_processor: Arc<AudioProcessor>,
    deepgram: Arc<DeepgramClient>,
    supabase: SupabaseClient,
}

#[derive(Serialize)]
struct TranscriptionResponse {
    success: bool,
    transcript: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct TranscribeRequest {
    user_id: String,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value_t = 18791)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let audio_processor = Arc::new(AudioProcessor::new());
    let deepgram = Arc::new(DeepgramClient::new()?);
    let supabase = SupabaseClient::new().await?;

    let state = AppState {
        audio_processor,
        deepgram,
        supabase,
    };

    let app = Router::new()
        .route("/transcribe", post(transcribe))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", args.port)).await?;
    info!("Voice pipeline server listening on port {}", args.port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn transcribe(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<TranscribeRequest>,
    body: Bytes,
) -> impl IntoResponse {
    let audio_bytes = body.to_vec();

    let user_id_parsed: Option<Uuid> = Uuid::parse_str(&params.user_id).ok();

    let user_id = match user_id_parsed {
        Some(id) => id,
        None => {
            return (StatusCode::BAD_REQUEST, Json(TranscriptionResponse {
                success: false,
                transcript: None,
                error: Some("Invalid user_id format".to_string()),
            }));
        }
    };

    info!("Processing voice recording for user {}", user_id);

    // 1. Process audio
    let pcm = match state.audio_processor.process_audio(&audio_bytes, "webm") {
        Ok(pcm) => pcm,
        Err(e) => {
            error!("Audio processing failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(TranscriptionResponse {
                success: false,
                transcript: None,
                error: Some(e.to_string()),
            }));
        }
    };

    let wav_bytes = match state.audio_processor.to_wav_bytes(&pcm) {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("WAV conversion failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(TranscriptionResponse {
                success: false,
                transcript: None,
                error: Some(e.to_string()),
            }));
        }
    };

    // 2. Transcribe with Deepgram
    let transcript = match state.deepgram.transcribe_audio(&wav_bytes).await {
        Ok(text) => text,
        Err(e) => {
            error!("Transcription failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(TranscriptionResponse {
                success: false,
                transcript: None,
                error: Some(e.to_string()),
            }));
        }
    };

    // 3. Store in Supabase
    let recording_id = Uuid::new_v4();
    if let Err(e) = sqlx::query(
        "INSERT INTO voice_recordings (id, user_id, transcript, audio_data, created_at)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(recording_id)
    .bind(user_id)
    .bind(&transcript)
    .bind(&wav_bytes)
    .bind(Utc::now())
    .execute(state.supabase.pool())
    .await {
        error!("Failed to store recording: {}", e);
    }

    (StatusCode::OK, Json(TranscriptionResponse {
        success: true,
        transcript: Some(transcript),
        error: None,
    }))
}
