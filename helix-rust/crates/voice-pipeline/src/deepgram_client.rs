use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize)]
struct TranscriptionRequest {
    audio: Vec<u8>,
}

#[derive(Deserialize)]
struct TranscriptionResponse {
    results: Results,
}

#[derive(Deserialize)]
struct Results {
    channels: Vec<Channel>,
}

#[derive(Deserialize)]
struct Channel {
    alternatives: Vec<Alternative>,
}

#[derive(Deserialize)]
struct Alternative {
    transcript: String,
    confidence: f32,
}

pub struct DeepgramClient {
    api_key: String,
    client: Client,
}

impl DeepgramClient {
    pub fn new() -> Result<Self> {
        let api_key = env::var("DEEPGRAM_API_KEY")
            .context("DEEPGRAM_API_KEY not set")?;

        Ok(Self {
            api_key,
            client: Client::new(),
        })
    }

    pub async fn transcribe_audio(&self, audio_bytes: &[u8]) -> Result<String> {
        let url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true";

        let response = self.client
            .post(url)
            .header("Authorization", format!("Token {}", self.api_key))
            .header("Content-Type", "audio/wav")
            .body(audio_bytes.to_vec())
            .send()
            .await
            .context("Failed to send request to Deepgram")?;

        let result: TranscriptionResponse = response.json().await
            .context("Failed to parse Deepgram response")?;

        let transcript = result.results.channels
            .first()
            .and_then(|ch| ch.alternatives.first())
            .map(|alt| alt.transcript.clone())
            .unwrap_or_default();

        Ok(transcript)
    }
}
