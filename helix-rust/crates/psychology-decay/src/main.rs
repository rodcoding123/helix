use anyhow::{Context, Result};
use clap::Parser;
use helix_shared::SupabaseClient;
use sqlx::Row;
use tokio_cron_scheduler::{JobScheduler, Job};
use tracing::{info, error};
use tracing_subscriber;
use chrono::Utc;
use uuid::Uuid;

mod decay_models;

use decay_models::get_model_for_layer;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Run once instead of scheduling
    #[arg(long)]
    once: bool,

    /// Cron schedule (default: hourly)
    #[arg(long, default_value = "0 0 * * * *")]
    schedule: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    if args.once {
        info!("Running decay calculation once");
        let client = SupabaseClient::new().await?;
        calculate_all_decay(&client).await?;
    } else {
        info!("Starting decay calculator with schedule: {}", args.schedule);
        let scheduler = JobScheduler::new().await?;

        let job = Job::new_async(args.schedule.as_str(), move |_uuid, _lock| {
            Box::pin(async {
                info!("Running scheduled decay calculation");
                match SupabaseClient::new().await {
                    Ok(client) => {
                        if let Err(e) = calculate_all_decay(&client).await {
                            error!("Decay calculation failed: {}", e);
                        }
                    }
                    Err(e) => error!("Failed to create Supabase client: {}", e),
                }
            })
        })?;

        scheduler.add(job).await?;
        scheduler.start().await?;

        info!("Scheduler started, press Ctrl+C to stop");
        tokio::signal::ctrl_c().await?;
        info!("Shutting down");
    }

    Ok(())
}

async fn calculate_all_decay(client: &SupabaseClient) -> Result<usize> {
    let rows = sqlx::query(
        "SELECT id, user_id, layer_number, layer_name, data, decay_rate, last_updated
         FROM psychology_layers
         ORDER BY layer_number"
    )
    .fetch_all(client.pool())
    .await
    .context("Failed to fetch psychology layers")?;

    let mut updated = 0;

    for row in rows {
        let layer_id: Uuid = row.get("id");
        let layer_number: i32 = row.get("layer_number");
        let last_updated: chrono::DateTime<Utc> = row.get("last_updated");

        let time_since = Utc::now().signed_duration_since(last_updated);

        let model = get_model_for_layer(layer_number);
        let new_decay = model.calculate_retention(time_since, 1.0);

        // Drop model before await to ensure Send trait
        drop(model);

        sqlx::query(
            "UPDATE psychology_layers
             SET decay_rate = $1, last_updated = $2
             WHERE id = $3"
        )
        .bind(new_decay)
        .bind(Utc::now())
        .bind(layer_id)
        .execute(client.pool())
        .await
        .context("Failed to update decay rate")?;

        updated += 1;
    }

    info!("Updated decay for {} psychology layers", updated);
    Ok(updated)
}
