use anyhow::{Context, Result};
use postgrest::Postgrest;
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;

#[derive(Clone)]
pub struct SupabaseClient {
    rest_client: Postgrest,
    pool: PgPool,
}

impl SupabaseClient {
    pub async fn new() -> Result<Self> {
        let url = env::var("SUPABASE_URL")
            .context("SUPABASE_URL not set")?;
        let key = env::var("SUPABASE_SERVICE_ROLE_KEY")
            .context("SUPABASE_SERVICE_ROLE_KEY not set")?;
        let db_url = env::var("SUPABASE_DB_URL")
            .context("SUPABASE_DB_URL not set")?;

        let rest_client = Postgrest::new(format!("{}/rest/v1", url))
            .insert_header("apikey", &key)
            .insert_header("Authorization", format!("Bearer {}", key));

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .context("Failed to connect to Supabase PostgreSQL")?;

        Ok(Self { rest_client, pool })
    }

    pub fn rest(&self) -> &Postgrest {
        &self.rest_client
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}
