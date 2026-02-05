use anyhow::Result;
use clap::Parser;
use helix_shared::SupabaseClient;
use tracing::{info, error};
use tracing_subscriber;
use uuid::Uuid;

mod pattern_detection;
mod clustering;

use pattern_detection::PatternDetector;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// User ID to synthesize memories for
    #[arg(short, long)]
    user_id: Uuid,

    /// Number of recent memories to analyze
    #[arg(short, long, default_value_t = 100)]
    limit: i32,

    /// Minimum confidence score threshold
    #[arg(short, long, default_value_t = 0.7)]
    confidence: f32,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    info!("Starting memory synthesis for user {}", args.user_id);

    let client = SupabaseClient::new().await?;
    let detector = PatternDetector::new(client.clone(), args.confidence);

    match detector.synthesize_patterns(args.user_id, args.limit).await {
        Ok(count) => {
            info!("Successfully created {} synthesis patterns", count);
            Ok(())
        }
        Err(e) => {
            error!("Memory synthesis failed: {}", e);
            Err(e)
        }
    }
}
