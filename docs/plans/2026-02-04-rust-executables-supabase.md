# Helix Rust Executables - Supabase-Integrated Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** February 4, 2026
**Status:** Ready for Execution
**Scope:** Build 5 production-grade Rust executables for CPU-intensive operations
**Total Duration:** 40-50 hours
**Critical Constraint:** ALL data storage MUST use Supabase PostgreSQL (no local SQLite silos)

---

## Executive Summary

Build 5 Rust executables that serve the integrated Helix environment (web, desktop, mobile all sharing same Supabase database):

1. **Memory Synthesis Engine** - CPU-intensive pattern recognition (replaces expensive Claude API calls)
2. **Psychology Layer Decay Calculator** - Mathematical memory decay computation with scheduled updates
3. **Skill Execution Sandbox** - WASM-based secure sandbox shared across all platforms
4. **Voice Processing Pipeline** - Real-time audio codec processing with Deepgram integration
5. **Real-Time Sync Coordinator** - Multi-instance synchronization with vector clock conflict detection

**User Directive:** "I want you to build all of them, only stop when you finished 100% all tasks."

**Architecture Principle:** Single source of truth = Supabase PostgreSQL. All executables read/write to centralized database. No local data silos.

---

## Current Infrastructure Analysis

**Supabase Schema** (web/supabase/migrations/):

- `memories` table - Episodic, semantic, procedural memory types
- `memory_synthesis` table - Synthesis results and patterns
- `psychology_layers` table - 7-layer psychological architecture data
- `skills` table - Skill definitions and execution history
- `voice_recordings` table - Audio recordings and transcriptions
- `sync_state` table - Vector clocks and conflict resolution

**Existing Desktop App** (helix-desktop/):

- Tauri v2 (React 19 + Rust backend)
- WebSocket gateway connection (port 18789)
- Currently delegates to Node.js for memory synthesis and skill execution

**Gateway RPC Protocol** (OpenClaw WebSocket):

- Port: 18789
- Format: JSON-RPC 2.0
- Methods: `memory.synthesize`, `skills.execute`, `voice.process`, `sync.coordinate`

---

## Project Structure

```
helix-rust/
├── Cargo.toml                    # Workspace root
├── crates/
│   ├── memory-synthesis/         # Executable 1
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── pattern_detection.rs
│   │   │   ├── clustering.rs
│   │   │   └── supabase_client.rs
│   │   └── tests/
│   │       └── integration.rs
│   ├── psychology-decay/         # Executable 2
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── decay_models.rs
│   │   │   ├── scheduler.rs
│   │   │   └── supabase_client.rs
│   │   └── tests/
│   ├── skill-sandbox/            # Executable 3
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── wasm_runtime.rs
│   │   │   ├── sandbox.rs
│   │   │   └── rpc_server.rs
│   │   └── tests/
│   ├── voice-pipeline/           # Executable 4
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── audio_processing.rs
│   │   │   ├── deepgram_client.rs
│   │   │   └── supabase_client.rs
│   │   └── tests/
│   ├── sync-coordinator/         # Executable 5
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── vector_clock.rs
│   │   │   ├── conflict_resolution.rs
│   │   │   └── supabase_client.rs
│   │   └── tests/
│   └── shared/                   # Shared library
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── supabase.rs       # Common Supabase client
│           ├── types.rs          # Shared types
│           └── gateway.rs        # Gateway RPC protocol
└── README.md
```

---

## Tech Stack

**Core:**

- Rust 1.75+ (stable)
- Tokio (async runtime)
- Serde (serialization)
- Anyhow (error handling)

**Database:**

- postgrest (Supabase client)
- sqlx (type-safe SQL queries)

**Sandboxing:**

- wasmtime (WASM runtime)
- wasmer (alternative WASM runtime)

**Audio:**

- symphonia (audio decoding)
- rubato (resampling)
- reqwest (HTTP client for Deepgram)

**Testing:**

- cargo-nextest (fast test runner)
- criterion (benchmarking)

---

## EXECUTABLE 1: Memory Synthesis Engine

### Overview

Replaces expensive Claude API calls with CPU-intensive local pattern recognition. Reads memories from Supabase, performs clustering/pattern detection, writes synthesis results back.

### Architecture

```
┌─────────────────┐
│   Supabase      │
│   memories      │
└────────┬────────┘
         │ Read recent memories
         │
┌────────▼────────┐
│ Pattern         │
│ Detection       │
│ - Temporal      │
│ - Semantic      │
│ - Emotional     │
└────────┬────────┘
         │
┌────────▼────────┐
│ Clustering      │
│ - DBSCAN        │
│ - K-means       │
└────────┬────────┘
         │ Write synthesis
         │
┌────────▼────────┐
│   Supabase      │
│ memory_synthesis│
└─────────────────┘
```

### Database Schema

```sql
-- Existing table: memories
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT CHECK (type IN ('episodic', 'semantic', 'procedural')),
  content TEXT,
  embedding VECTOR(1536),
  emotional_valence FLOAT,
  created_at TIMESTAMP,
  last_accessed TIMESTAMP
);

-- Existing table: memory_synthesis
CREATE TABLE memory_synthesis (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT,
  memory_ids UUID[],
  synthesis_content TEXT,
  confidence_score FLOAT,
  created_at TIMESTAMP
);
```

### Task 1.1: Workspace Setup

**Files:**

- Create: `helix-rust/Cargo.toml`
- Create: `helix-rust/crates/shared/Cargo.toml`
- Create: `helix-rust/crates/shared/src/lib.rs`
- Create: `helix-rust/crates/memory-synthesis/Cargo.toml`

**Step 1: Create workspace root**

```toml
# helix-rust/Cargo.toml
[workspace]
members = [
    "crates/shared",
    "crates/memory-synthesis",
    "crates/psychology-decay",
    "crates/skill-sandbox",
    "crates/voice-pipeline",
    "crates/sync-coordinator",
]
resolver = "2"

[workspace.dependencies]
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
postgrest = "1.4"
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-native-tls", "uuid", "chrono"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

**Step 2: Create shared library**

```toml
# helix-rust/crates/shared/Cargo.toml
[package]
name = "helix-shared"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
postgrest = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
```

**Step 3: Create shared types**

```rust
// helix-rust/crates/shared/src/lib.rs
pub mod supabase;
pub mod types;
pub mod gateway;

pub use supabase::SupabaseClient;
pub use types::*;
```

**Step 4: Create Supabase client**

```rust
// helix-rust/crates/shared/src/supabase.rs
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
```

**Step 5: Create shared types**

```rust
// helix-rust/crates/shared/src/types.rs
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: Uuid,
    pub user_id: Uuid,
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
    pub content: String,
    pub embedding: Option<Vec<f32>>,
    pub emotional_valence: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub last_accessed: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    Episodic,
    Semantic,
    Procedural,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySynthesis {
    pub id: Uuid,
    pub user_id: Uuid,
    pub pattern_type: String,
    pub memory_ids: Vec<Uuid>,
    pub synthesis_content: String,
    pub confidence_score: f32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PsychologyLayer {
    pub id: Uuid,
    pub user_id: Uuid,
    pub layer_number: i32,
    pub layer_name: String,
    pub data: serde_json::Value,
    pub decay_rate: f32,
    pub last_updated: DateTime<Utc>,
}
```

**Step 6: Commit**

```bash
cd helix-rust
git add .
git commit -m "feat(rust): create workspace with shared Supabase client"
```

### Task 1.2: Pattern Detection Engine

**Files:**

- Create: `helix-rust/crates/memory-synthesis/src/main.rs`
- Create: `helix-rust/crates/memory-synthesis/src/pattern_detection.rs`
- Create: `helix-rust/crates/memory-synthesis/src/clustering.rs`

**Step 1: Create memory-synthesis binary**

```toml
# helix-rust/crates/memory-synthesis/Cargo.toml
[package]
name = "memory-synthesis"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "memory-synthesis"
path = "src/main.rs"

[dependencies]
helix-shared = { path = "../shared" }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
ndarray = "0.15"
linfa = "0.7"
linfa-clustering = "0.7"
clap = { version = "4.4", features = ["derive"] }
```

**Step 2: Create main entry point**

```rust
// helix-rust/crates/memory-synthesis/src/main.rs
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
```

**Step 3: Implement pattern detection**

```rust
// helix-rust/crates/memory-synthesis/src/pattern_detection.rs
use anyhow::{Context, Result};
use helix_shared::{Memory, MemorySynthesis, SupabaseClient};
use sqlx::Row;
use uuid::Uuid;
use tracing::{debug, info};
use chrono::Utc;

use crate::clustering::cluster_memories;

pub struct PatternDetector {
    client: SupabaseClient,
    min_confidence: f32,
}

impl PatternDetector {
    pub fn new(client: SupabaseClient, min_confidence: f32) -> Self {
        Self { client, min_confidence }
    }

    pub async fn synthesize_patterns(&self, user_id: Uuid, limit: i32) -> Result<usize> {
        info!("Fetching recent {} memories for user {}", limit, user_id);

        // 1. Fetch recent memories from Supabase
        let memories = self.fetch_recent_memories(user_id, limit).await?;

        if memories.is_empty() {
            info!("No memories found for synthesis");
            return Ok(0);
        }

        debug!("Found {} memories to analyze", memories.len());

        // 2. Detect temporal patterns
        let temporal = self.detect_temporal_patterns(&memories)?;

        // 3. Detect semantic clusters
        let semantic = self.detect_semantic_patterns(&memories)?;

        // 4. Detect emotional patterns
        let emotional = self.detect_emotional_patterns(&memories)?;

        // 5. Write synthesis results to Supabase
        let mut count = 0;
        count += self.write_patterns(user_id, "temporal", temporal).await?;
        count += self.write_patterns(user_id, "semantic", semantic).await?;
        count += self.write_patterns(user_id, "emotional", emotional).await?;

        Ok(count)
    }

    async fn fetch_recent_memories(&self, user_id: Uuid, limit: i32) -> Result<Vec<Memory>> {
        let rows = sqlx::query(
            "SELECT id, user_id, type, content, embedding, emotional_valence, created_at, last_accessed
             FROM memories
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2"
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(self.client.pool())
        .await
        .context("Failed to fetch memories from Supabase")?;

        let memories: Vec<Memory> = rows.iter().map(|row| {
            Memory {
                id: row.get("id"),
                user_id: row.get("user_id"),
                memory_type: serde_json::from_str(&row.get::<String, _>("type")).unwrap(),
                content: row.get("content"),
                embedding: row.try_get("embedding").ok(),
                emotional_valence: row.try_get("emotional_valence").ok(),
                created_at: row.get("created_at"),
                last_accessed: row.try_get("last_accessed").ok(),
            }
        }).collect();

        Ok(memories)
    }

    fn detect_temporal_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Group memories by time windows (daily, weekly)
        let mut patterns = Vec::new();

        // Simple temporal grouping: memories within 24 hours
        let mut current_group = Vec::new();
        let mut last_timestamp = None;

        for memory in memories {
            if let Some(last) = last_timestamp {
                let diff = memory.created_at.signed_duration_since(last);
                if diff.num_hours().abs() > 24 {
                    if current_group.len() >= 3 {
                        patterns.push(Pattern {
                            memory_ids: current_group.clone(),
                            pattern_type: "temporal_cluster".to_string(),
                            confidence: 0.8,
                            synthesis: format!("Cluster of {} memories within 24-hour period", current_group.len()),
                        });
                    }
                    current_group.clear();
                }
            }
            current_group.push(memory.id);
            last_timestamp = Some(memory.created_at);
        }

        Ok(patterns)
    }

    fn detect_semantic_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Use embeddings for semantic clustering
        let memories_with_embeddings: Vec<_> = memories.iter()
            .filter(|m| m.embedding.is_some())
            .collect();

        if memories_with_embeddings.is_empty() {
            return Ok(Vec::new());
        }

        let clusters = cluster_memories(&memories_with_embeddings, 3)?;

        let patterns = clusters.into_iter().map(|cluster| {
            Pattern {
                memory_ids: cluster.memory_ids,
                pattern_type: "semantic_cluster".to_string(),
                confidence: cluster.confidence,
                synthesis: cluster.description,
            }
        }).collect();

        Ok(patterns)
    }

    fn detect_emotional_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Group by emotional valence
        let mut positive = Vec::new();
        let mut negative = Vec::new();
        let mut neutral = Vec::new();

        for memory in memories {
            if let Some(valence) = memory.emotional_valence {
                if valence > 0.3 {
                    positive.push(memory.id);
                } else if valence < -0.3 {
                    negative.push(memory.id);
                } else {
                    neutral.push(memory.id);
                }
            }
        }

        let mut patterns = Vec::new();

        if positive.len() >= 5 {
            patterns.push(Pattern {
                memory_ids: positive,
                pattern_type: "emotional_positive".to_string(),
                confidence: 0.85,
                synthesis: "Cluster of positive emotional memories".to_string(),
            });
        }

        if negative.len() >= 5 {
            patterns.push(Pattern {
                memory_ids: negative,
                pattern_type: "emotional_negative".to_string(),
                confidence: 0.85,
                synthesis: "Cluster of negative emotional memories".to_string(),
            });
        }

        Ok(patterns)
    }

    async fn write_patterns(&self, user_id: Uuid, category: &str, patterns: Vec<Pattern>) -> Result<usize> {
        let mut count = 0;

        for pattern in patterns {
            if pattern.confidence < self.min_confidence {
                continue;
            }

            let synthesis = MemorySynthesis {
                id: Uuid::new_v4(),
                user_id,
                pattern_type: format!("{}_{}", category, pattern.pattern_type),
                memory_ids: pattern.memory_ids.clone(),
                synthesis_content: pattern.synthesis.clone(),
                confidence_score: pattern.confidence,
                created_at: Utc::now(),
            };

            sqlx::query(
                "INSERT INTO memory_synthesis (id, user_id, pattern_type, memory_ids, synthesis_content, confidence_score, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(synthesis.id)
            .bind(synthesis.user_id)
            .bind(&synthesis.pattern_type)
            .bind(&synthesis.memory_ids)
            .bind(&synthesis.synthesis_content)
            .bind(synthesis.confidence_score)
            .bind(synthesis.created_at)
            .execute(self.client.pool())
            .await
            .context("Failed to write synthesis to Supabase")?;

            count += 1;
        }

        info!("Wrote {} {} patterns to Supabase", count, category);
        Ok(count)
    }
}

#[derive(Debug)]
struct Pattern {
    memory_ids: Vec<Uuid>,
    pattern_type: String,
    confidence: f32,
    synthesis: String,
}
```

**Step 4: Implement clustering**

```rust
// helix-rust/crates/memory-synthesis/src/clustering.rs
use anyhow::Result;
use helix_shared::Memory;
use ndarray::{Array1, Array2};
use linfa::prelude::*;
use linfa_clustering::{Dbscan, DbscanParams};
use uuid::Uuid;

pub struct Cluster {
    pub memory_ids: Vec<Uuid>,
    pub confidence: f32,
    pub description: String,
}

pub fn cluster_memories(memories: &[&Memory], min_cluster_size: usize) -> Result<Vec<Cluster>> {
    // Build feature matrix from embeddings
    let n_memories = memories.len();
    let embedding_dim = memories[0].embedding.as_ref().unwrap().len();

    let mut features = Array2::<f32>::zeros((n_memories, embedding_dim));

    for (i, memory) in memories.iter().enumerate() {
        if let Some(emb) = &memory.embedding {
            for (j, &val) in emb.iter().enumerate() {
                features[[i, j]] = val;
            }
        }
    }

    // DBSCAN clustering
    let params = DbscanParams::new(min_cluster_size)
        .tolerance(0.5);

    let dataset = DatasetBase::from(features);
    let dbscan = Dbscan::params_with_rng(params, rand::thread_rng());
    let clusters = dbscan.transform(dataset);

    // Convert to our Cluster format
    let mut result = Vec::new();
    let labels = clusters.targets();

    // Group by cluster label
    let mut cluster_map: std::collections::HashMap<Option<usize>, Vec<Uuid>> = std::collections::HashMap::new();

    for (idx, &label) in labels.iter().enumerate() {
        cluster_map.entry(label).or_default().push(memories[idx].id);
    }

    for (label, memory_ids) in cluster_map {
        if label.is_none() || memory_ids.len() < min_cluster_size {
            continue; // Skip noise points and small clusters
        }

        result.push(Cluster {
            memory_ids,
            confidence: 0.75,
            description: format!("Semantic cluster {} with {} memories", label.unwrap(), memory_ids.len()),
        });
    }

    Ok(result)
}
```

**Step 5: Test**

```bash
cd helix-rust
cargo build --release --bin memory-synthesis
cargo test --package memory-synthesis
```

**Step 6: Commit**

```bash
git add crates/memory-synthesis/
git commit -m "feat(rust): implement memory synthesis with pattern detection"
```

### Task 1.3: Integration Testing

**Files:**

- Create: `helix-rust/crates/memory-synthesis/tests/integration.rs`

**Step 1: Write integration test**

```rust
// helix-rust/crates/memory-synthesis/tests/integration.rs
use helix_shared::{Memory, MemoryType, SupabaseClient};
use uuid::Uuid;
use chrono::Utc;

#[tokio::test]
async fn test_memory_synthesis_integration() {
    let client = SupabaseClient::new().await.expect("Failed to create client");
    let test_user_id = Uuid::new_v4();

    // Create test memories
    let memories = vec![
        Memory {
            id: Uuid::new_v4(),
            user_id: test_user_id,
            memory_type: MemoryType::Episodic,
            content: "Test memory 1".to_string(),
            embedding: Some(vec![0.1; 1536]),
            emotional_valence: Some(0.5),
            created_at: Utc::now(),
            last_accessed: None,
        },
        Memory {
            id: Uuid::new_v4(),
            user_id: test_user_id,
            memory_type: MemoryType::Episodic,
            content: "Test memory 2".to_string(),
            embedding: Some(vec![0.2; 1536]),
            emotional_valence: Some(0.6),
            created_at: Utc::now(),
            last_accessed: None,
        },
    ];

    // Insert test memories
    for memory in &memories {
        sqlx::query(
            "INSERT INTO memories (id, user_id, type, content, embedding, emotional_valence, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(memory.id)
        .bind(memory.user_id)
        .bind(serde_json::to_string(&memory.memory_type).unwrap())
        .bind(&memory.content)
        .bind(&memory.embedding)
        .bind(memory.emotional_valence)
        .bind(memory.created_at)
        .execute(client.pool())
        .await
        .expect("Failed to insert test memory");
    }

    // Run synthesis
    use memory_synthesis::pattern_detection::PatternDetector;
    let detector = PatternDetector::new(client.clone(), 0.5);
    let count = detector.synthesize_patterns(test_user_id, 10).await.expect("Synthesis failed");

    assert!(count > 0, "Should create at least one synthesis pattern");

    // Cleanup
    sqlx::query("DELETE FROM memories WHERE user_id = $1")
        .bind(test_user_id)
        .execute(client.pool())
        .await
        .expect("Cleanup failed");
}
```

**Step 2: Run test**

```bash
cargo test --package memory-synthesis --test integration
```

Expected: Test passes

**Step 3: Commit**

```bash
git add crates/memory-synthesis/tests/
git commit -m "test(rust): add memory synthesis integration test"
```

---

## EXECUTABLE 2: Psychology Layer Decay Calculator

### Overview

Computes memory decay mathematically based on psychological models (Ebbinghaus forgetting curve). Runs on schedule, updates decay values in Supabase for all 7 psychology layers.

### Architecture

```
┌──────────────────┐
│   Scheduler      │
│   (cron-like)    │
└────────┬─────────┘
         │ Every hour
         │
┌────────▼─────────┐
│ Fetch Psychology │
│ Layers from      │
│ Supabase         │
└────────┬─────────┘
         │
┌────────▼─────────┐
│ Calculate Decay  │
│ - Ebbinghaus     │
│ - Power law      │
│ - Exponential    │
└────────┬─────────┘
         │
┌────────▼─────────┐
│ Update Supabase  │
│ psychology_layers│
└──────────────────┘
```

### Task 2.1: Decay Models Implementation

**Files:**

- Create: `helix-rust/crates/psychology-decay/Cargo.toml`
- Create: `helix-rust/crates/psychology-decay/src/main.rs`
- Create: `helix-rust/crates/psychology-decay/src/decay_models.rs`

**Step 1: Create package**

```toml
# helix-rust/crates/psychology-decay/Cargo.toml
[package]
name = "psychology-decay"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "psychology-decay"
path = "src/main.rs"

[dependencies]
helix-shared = { path = "../shared" }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
clap = { version = "4.4", features = ["derive"] }
tokio-cron-scheduler = "0.10"
```

**Step 2: Implement decay models**

```rust
// helix-rust/crates/psychology-decay/src/decay_models.rs
use chrono::{DateTime, Utc, Duration};

pub trait DecayModel {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32;
}

/// Ebbinghaus forgetting curve: R(t) = e^(-t/S)
pub struct EbbinghausCurve {
    pub decay_constant: f32,
}

impl DecayModel for EbbinghausCurve {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * (-t / self.decay_constant).exp();
        retention.max(0.0).min(1.0)
    }
}

/// Power law forgetting: R(t) = (1 + t)^(-b)
pub struct PowerLawDecay {
    pub exponent: f32,
}

impl DecayModel for PowerLawDecay {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * (1.0 + t).powf(-self.exponent);
        retention.max(0.0).min(1.0)
    }
}

/// Exponential decay with half-life
pub struct ExponentialDecay {
    pub half_life_hours: f32,
}

impl DecayModel for ExponentialDecay {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * 0.5f32.powf(t / self.half_life_hours);
        retention.max(0.0).min(1.0)
    }
}

pub fn get_model_for_layer(layer_number: i32) -> Box<dyn DecayModel> {
    match layer_number {
        1 => Box::new(ExponentialDecay { half_life_hours: 720.0 }), // 30 days for Narrative Core
        2 => Box::new(EbbinghausCurve { decay_constant: 168.0 }),   // 7 days for Emotional Memory
        3 => Box::new(PowerLawDecay { exponent: 0.5 }),              // Relational Memory
        4 => Box::new(ExponentialDecay { half_life_hours: 360.0 }), // 15 days for Prospective Self
        5 => Box::new(EbbinghausCurve { decay_constant: 240.0 }),   // 10 days for Integration
        6 => Box::new(ExponentialDecay { half_life_hours: 480.0 }), // 20 days for Transformation
        7 => Box::new(EbbinghausCurve { decay_constant: 1440.0 }),  // 60 days for Purpose Engine
        _ => Box::new(EbbinghausCurve { decay_constant: 168.0 }),   // Default 7 days
    }
}
```

**Step 3: Implement main calculator**

```rust
// helix-rust/crates/psychology-decay/src/main.rs
use anyhow::{Context, Result};
use clap::Parser;
use helix_shared::{PsychologyLayer, SupabaseClient};
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

        let job = Job::new_async(&args.schedule, move |_uuid, _lock| {
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
```

**Step 4: Test**

```bash
cargo build --release --bin psychology-decay
cargo test --package psychology-decay
```

**Step 5: Commit**

```bash
git add crates/psychology-decay/
git commit -m "feat(rust): implement psychology layer decay calculator"
```

---

## EXECUTABLE 3: Skill Execution Sandbox

### Overview

WASM-based secure sandbox for skill execution. Replaces Node VM with WASM runtime. Provides RPC server that web/desktop/mobile can call for skill execution.

### Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Web       │   │  Desktop    │   │   Mobile    │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │ RPC              │ RPC              │ RPC
       │                  │                  │
┌──────▼──────────────────▼──────────────────▼──────┐
│         Skill Execution Sandbox (Rust)             │
│  ┌────────────┐         ┌────────────────────┐   │
│  │ RPC Server │────────▶│  WASM Runtime      │   │
│  │ (TCP)      │         │  (wasmtime)        │   │
│  └────────────┘         └────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐  │
│  │   Skill Repository (Supabase)              │  │
│  │   - Skill definitions                      │  │
│  │   - WASM bytecode                          │  │
│  │   - Execution history                      │  │
│  └────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Task 3.1: WASM Runtime Setup

**Files:**

- Create: `helix-rust/crates/skill-sandbox/Cargo.toml`
- Create: `helix-rust/crates/skill-sandbox/src/main.rs`
- Create: `helix-rust/crates/skill-sandbox/src/wasm_runtime.rs`

**Step 1: Create package**

```toml
# helix-rust/crates/skill-sandbox/Cargo.toml
[package]
name = "skill-sandbox"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "skill-sandbox"
path = "src/main.rs"

[dependencies]
helix-shared = { path = "../shared" }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
wasmtime = "18.0"
wasmtime-wasi = "18.0"
clap = { version = "4.4", features = ["derive"] }
axum = "0.7"
tower = "0.4"
```

**Step 2: Implement WASM runtime**

```rust
// helix-rust/crates/skill-sandbox/src/wasm_runtime.rs
use anyhow::{Context, Result};
use wasmtime::*;
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder};
use std::time::Duration;

pub struct WasmSandbox {
    engine: Engine,
}

impl WasmSandbox {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.epoch_interruption(true);
        config.wasm_simd(true);
        config.wasm_bulk_memory(true);

        let engine = Engine::new(&config)?;
        Ok(Self { engine })
    }

    pub async fn execute(&self, wasm_bytes: &[u8], input: serde_json::Value) -> Result<serde_json::Value> {
        let module = Module::new(&self.engine, wasm_bytes)
            .context("Failed to compile WASM module")?;

        let mut linker = Linker::new(&self.engine);
        wasmtime_wasi::add_to_linker(&mut linker, |s| s)?;

        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .build();

        let mut store = Store::new(&self.engine, wasi);

        // Set timeout: 5 seconds max
        store.set_epoch_deadline(1);

        let instance = linker.instantiate(&mut store, &module)
            .context("Failed to instantiate WASM module")?;

        // Call the "execute" function
        let execute_fn = instance.get_typed_func::<(), ()>(&mut store, "execute")
            .context("WASM module missing 'execute' function")?;

        // TODO: Pass input via WASI stdin, read output from stdout
        execute_fn.call(&mut store, ())
            .context("WASM execution failed")?;

        Ok(serde_json::json!({"status": "success"}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_wasm_sandbox_creation() {
        let sandbox = WasmSandbox::new();
        assert!(sandbox.is_ok());
    }
}
```

**Step 3: Implement RPC server**

```rust
// helix-rust/crates/skill-sandbox/src/rpc_server.rs
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
```

**Step 4: Implement main**

```rust
// helix-rust/crates/skill-sandbox/src/main.rs
use anyhow::Result;
use clap::Parser;
use tracing_subscriber;

mod wasm_runtime;
mod rpc_server;

use rpc_server::start_rpc_server;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port for RPC server
    #[arg(short, long, default_value_t = 18790)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    start_rpc_server(args.port).await?;
    Ok(())
}
```

**Step 5: Test**

```bash
cargo build --release --bin skill-sandbox
cargo test --package skill-sandbox
```

**Step 6: Commit**

```bash
git add crates/skill-sandbox/
git commit -m "feat(rust): implement WASM skill execution sandbox with RPC server"
```

---

## EXECUTABLE 4: Voice Processing Pipeline

### Overview

Real-time audio codec processing. Receives audio from web/desktop/mobile, processes (noise reduction, format conversion), sends to Deepgram for transcription, stores results in Supabase.

### Architecture

```
┌─────────────┐
│ Audio Input │ (web/desktop/mobile)
└──────┬──────┘
       │ WebRTC/raw audio
       │
┌──────▼───────────────┐
│ Voice Pipeline       │
│ - Decode audio       │
│ - Noise reduction    │
│ - Resample to 16kHz  │
│ - Convert to PCM     │
└──────┬───────────────┘
       │
       ├──────────────────┐
       │                  │
┌──────▼──────┐   ┌───────▼────────┐
│  Deepgram   │   │   Supabase     │
│  API        │   │ voice_recordings│
│ (transcribe)│   │ (store audio)  │
└──────┬──────┘   └────────────────┘
       │
┌──────▼──────┐
│  Supabase   │
│ (store text)│
└─────────────┘
```

### Task 4.1: Audio Processing

**Files:**

- Create: `helix-rust/crates/voice-pipeline/Cargo.toml`
- Create: `helix-rust/crates/voice-pipeline/src/main.rs`
- Create: `helix-rust/crates/voice-pipeline/src/audio_processing.rs`
- Create: `helix-rust/crates/voice-pipeline/src/deepgram_client.rs`

**Step 1: Create package**

```toml
# helix-rust/crates/voice-pipeline/Cargo.toml
[package]
name = "voice-pipeline"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "voice-pipeline"
path = "src/main.rs"

[dependencies]
helix-shared = { path = "../shared" }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
clap = { version = "4.4", features = ["derive"] }
axum = "0.7"
reqwest = { version = "0.11", features = ["json", "multipart"] }
symphonia = { version = "0.5", features = ["all"] }
rubato = "0.14"
hound = "3.5"
```

**Step 2: Implement audio processing**

```rust
// helix-rust/crates/voice-pipeline/src/audio_processing.rs
use anyhow::{Context, Result};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use symphonia::core::formats::FormatOptions;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::codecs::DecoderOptions;
use rubato::{Resampler, SincFixedIn, InterpolationType, InterpolationParameters, WindowFunction};
use std::io::Cursor;

pub struct AudioProcessor {
    target_sample_rate: u32,
}

impl AudioProcessor {
    pub fn new() -> Self {
        Self {
            target_sample_rate: 16000, // Deepgram optimal
        }
    }

    pub fn process_audio(&self, input_bytes: &[u8], format_hint: &str) -> Result<Vec<i16>> {
        // 1. Decode audio using Symphonia
        let cursor = Cursor::new(input_bytes);
        let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

        let mut hint = Hint::new();
        hint.with_extension(format_hint);

        let format_opts = FormatOptions::default();
        let metadata_opts = MetadataOptions::default();

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts)
            .context("Failed to probe audio format")?;

        let mut format = probed.format;
        let track = format.default_track().context("No default audio track")?;
        let track_id = track.id;

        let decoder_opts = DecoderOptions::default();
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &decoder_opts)
            .context("Failed to create decoder")?;

        let mut samples = Vec::new();

        // Decode all packets
        while let Ok(packet) = format.next_packet() {
            if packet.track_id() != track_id {
                continue;
            }

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    // Convert to f32 samples
                    let spec = *decoded.spec();
                    let duration = decoded.capacity() as u64;

                    for sample_idx in 0..duration {
                        for chan in 0..spec.channels.count() {
                            if let Some(plane) = decoded.chan(chan) {
                                // Convert to f32 (Symphonia uses various formats)
                                let sample = plane[sample_idx as usize].into();
                                samples.push(sample);
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Decode error: {}", e);
                }
            }
        }

        // 2. Resample to 16kHz if needed
        let source_rate = track.codec_params.sample_rate.unwrap_or(44100);

        let resampled = if source_rate != self.target_sample_rate {
            self.resample(&samples, source_rate, self.target_sample_rate)?
        } else {
            samples
        };

        // 3. Convert to 16-bit PCM
        let pcm: Vec<i16> = resampled.iter()
            .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
            .collect();

        Ok(pcm)
    }

    fn resample(&self, input: &[f32], from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
        let params = InterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: InterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            to_rate as f64 / from_rate as f64,
            2.0,
            params,
            input.len(),
            1,
        )?;

        let output = resampler.process(&[input], None)?;
        Ok(output[0].clone())
    }

    pub fn to_wav_bytes(&self, pcm: &[i16]) -> Result<Vec<u8>> {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: self.target_sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut cursor = Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(&mut cursor, spec)?;

        for &sample in pcm {
            writer.write_sample(sample)?;
        }

        writer.finalize()?;
        Ok(cursor.into_inner())
    }
}
```

**Step 3: Implement Deepgram client**

```rust
// helix-rust/crates/voice-pipeline/src/deepgram_client.rs
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
```

**Step 4: Implement main with RPC server**

```rust
// helix-rust/crates/voice-pipeline/src/main.rs
use anyhow::Result;
use axum::{
    extract::{State, Multipart},
    routing::post,
    Router,
    response::IntoResponse,
    http::StatusCode,
};
use clap::Parser;
use helix_shared::SupabaseClient;
use serde::Serialize;
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
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut audio_bytes = Vec::new();
    let mut user_id = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap().to_string();

        if name == "audio" {
            audio_bytes = field.bytes().await.unwrap().to_vec();
        } else if name == "user_id" {
            let text = field.text().await.unwrap();
            user_id = Uuid::parse_str(&text).ok();
        }
    }

    let user_id = match user_id {
        Some(id) => id,
        None => {
            return (StatusCode::BAD_REQUEST, axum::Json(TranscriptionResponse {
                success: false,
                transcript: None,
                error: Some("Missing user_id".to_string()),
            }));
        }
    };

    info!("Processing voice recording for user {}", user_id);

    // 1. Process audio
    let pcm = match state.audio_processor.process_audio(&audio_bytes, "webm") {
        Ok(pcm) => pcm,
        Err(e) => {
            error!("Audio processing failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(TranscriptionResponse {
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
            return (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(TranscriptionResponse {
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
            return (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(TranscriptionResponse {
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

    (StatusCode::OK, axum::Json(TranscriptionResponse {
        success: true,
        transcript: Some(transcript),
        error: None,
    }))
}
```

**Step 5: Test**

```bash
cargo build --release --bin voice-pipeline
cargo test --package voice-pipeline
```

**Step 6: Commit**

```bash
git add crates/voice-pipeline/
git commit -m "feat(rust): implement voice processing pipeline with Deepgram integration"
```

---

## EXECUTABLE 5: Real-Time Sync Coordinator

### Overview

Manages multi-instance synchronization with vector clock conflict detection. Listens to Supabase realtime changes, coordinates conflict resolution, updates all connected instances.

### Architecture

```
┌────────────┐   ┌────────────┐   ┌────────────┐
│    Web     │   │  Desktop   │   │   Mobile   │
└─────┬──────┘   └─────┬──────┘   └─────┬──────┘
      │ WebSocket       │ WebSocket       │ WebSocket
      │                 │                 │
┌─────▼─────────────────▼─────────────────▼──────┐
│       Sync Coordinator (Rust)                   │
│  ┌──────────────┐       ┌──────────────────┐  │
│  │ WebSocket    │◄──────┤ Supabase         │  │
│  │ Relay        │       │ Realtime         │  │
│  └──────────────┘       │ (postgres_changes)│  │
│                         └──────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │ Vector Clock Conflict Resolution        │  │
│  │ - Detect concurrent edits               │  │
│  │ - Apply Last-Write-Wins / Merge         │  │
│  │ - Broadcast deltas to all instances     │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Task 5.1: Vector Clock Implementation

**Files:**

- Create: `helix-rust/crates/sync-coordinator/Cargo.toml`
- Create: `helix-rust/crates/sync-coordinator/src/main.rs`
- Create: `helix-rust/crates/sync-coordinator/src/vector_clock.rs`
- Create: `helix-rust/crates/sync-coordinator/src/conflict_resolution.rs`

**Step 1: Create package**

```toml
# helix-rust/crates/sync-coordinator/Cargo.toml
[package]
name = "sync-coordinator"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "sync-coordinator"
path = "src/main.rs"

[dependencies]
helix-shared = { path = "../shared" }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
anyhow = { workspace = true }
sqlx = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
clap = { version = "4.4", features = ["derive"] }
axum = "0.7"
axum-tungstenite = "0.3"
tokio-tungstenite = "0.21"
futures-util = "0.3"
dashmap = "5.5"
```

**Step 2: Implement vector clock**

```rust
// helix-rust/crates/sync-coordinator/src/vector_clock.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VectorClock {
    pub clocks: HashMap<String, u64>,
}

impl VectorClock {
    pub fn new() -> Self {
        Self {
            clocks: HashMap::new(),
        }
    }

    pub fn increment(&mut self, device_id: &str) {
        let counter = self.clocks.entry(device_id.to_string()).or_insert(0);
        *counter += 1;
    }

    pub fn merge(&mut self, other: &VectorClock) {
        for (device, &count) in &other.clocks {
            let current = self.clocks.entry(device.clone()).or_insert(0);
            *current = (*current).max(count);
        }
    }

    pub fn happens_before(&self, other: &VectorClock) -> bool {
        let mut all_less_or_equal = true;
        let mut at_least_one_less = false;

        for (device, &count) in &self.clocks {
            let other_count = other.clocks.get(device).copied().unwrap_or(0);
            if count > other_count {
                return false;
            }
            if count < other_count {
                at_least_one_less = true;
            }
        }

        for (device, &other_count) in &other.clocks {
            if !self.clocks.contains_key(device) && other_count > 0 {
                at_least_one_less = true;
            }
        }

        all_less_or_equal && at_least_one_less
    }

    pub fn is_concurrent(&self, other: &VectorClock) -> bool {
        !self.happens_before(other) && !other.happens_before(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_clock_ordering() {
        let mut v1 = VectorClock::new();
        v1.increment("A");

        let mut v2 = VectorClock::new();
        v2.increment("A");
        v2.increment("A");

        assert!(v1.happens_before(&v2));
        assert!(!v2.happens_before(&v1));
    }

    #[test]
    fn test_concurrent_clocks() {
        let mut v1 = VectorClock::new();
        v1.increment("A");

        let mut v2 = VectorClock::new();
        v2.increment("B");

        assert!(v1.is_concurrent(&v2));
        assert!(v2.is_concurrent(&v1));
    }
}
```

**Step 3: Implement conflict resolution**

```rust
// helix-rust/crates/sync-coordinator/src/conflict_resolution.rs
use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::vector_clock::VectorClock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEntity {
    pub id: Uuid,
    pub data: serde_json::Value,
    pub vector_clock: VectorClock,
    pub last_modified: chrono::DateTime<chrono::Utc>,
    pub device_id: String,
}

#[derive(Debug)]
pub enum ConflictResolution {
    NoConflict(SyncEntity),
    LastWriteWins(SyncEntity),
    Merge(SyncEntity),
    RequiresManual(Vec<SyncEntity>),
}

pub fn resolve_conflict(local: SyncEntity, remote: SyncEntity) -> Result<ConflictResolution> {
    // Check vector clocks
    if local.vector_clock.happens_before(&remote.vector_clock) {
        // Remote is newer
        return Ok(ConflictResolution::NoConflict(remote));
    }

    if remote.vector_clock.happens_before(&local.vector_clock) {
        // Local is newer
        return Ok(ConflictResolution::NoConflict(local));
    }

    if local.vector_clock.is_concurrent(&remote.vector_clock) {
        // Concurrent modification - conflict!

        // Strategy 1: Last-Write-Wins based on timestamp
        if local.last_modified > remote.last_modified {
            return Ok(ConflictResolution::LastWriteWins(local));
        } else {
            return Ok(ConflictResolution::LastWriteWins(remote));
        }

        // Strategy 2: Merge (for specific data types)
        // TODO: Implement merge logic for arrays, objects
    }

    Ok(ConflictResolution::NoConflict(local))
}
```

**Step 4: Implement WebSocket relay**

```rust
// helix-rust/crates/sync-coordinator/src/main.rs
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
use tracing::{info, error};
use tracing_subscriber;
use uuid::Uuid;

mod vector_clock;
mod conflict_resolution;

use vector_clock::VectorClock;
use conflict_resolution::{SyncEntity, resolve_conflict};

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
```

**Step 5: Test**

```bash
cargo build --release --bin sync-coordinator
cargo test --package sync-coordinator
```

**Step 6: Commit**

```bash
git add crates/sync-coordinator/
git commit -m "feat(rust): implement real-time sync coordinator with vector clocks"
```

---

## Integration & Deployment

### Task 6: Integration with Helix Desktop

**Files:**

- Modify: `helix-desktop/src-tauri/src/commands/mod.rs`
- Create: `helix-desktop/src-tauri/src/commands/rust_executables.rs`

**Step 1: Add Rust executable command**

```rust
// helix-desktop/src-tauri/src/commands/rust_executables.rs
use tauri::command;
use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct RustExeStatus {
    pub name: String,
    pub running: bool,
    pub port: Option<u16>,
}

#[command]
pub async fn start_memory_synthesis(user_id: String) -> Result<String, String> {
    let output = Command::new("./helix-rust/target/release/memory-synthesis")
        .arg("--user-id")
        .arg(user_id)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[command]
pub async fn get_rust_exe_status() -> Result<Vec<RustExeStatus>, String> {
    Ok(vec![
        RustExeStatus {
            name: "memory-synthesis".to_string(),
            running: false, // TODO: Check if process running
            port: None,
        },
        RustExeStatus {
            name: "skill-sandbox".to_string(),
            running: false,
            port: Some(18790),
        },
        RustExeStatus {
            name: "voice-pipeline".to_string(),
            running: false,
            port: Some(18791),
        },
        RustExeStatus {
            name: "sync-coordinator".to_string(),
            running: false,
            port: Some(18792),
        },
    ])
}
```

**Step 2: Register commands**

```rust
// helix-desktop/src-tauri/src/commands/mod.rs
pub mod rust_executables;

pub use rust_executables::{start_memory_synthesis, get_rust_exe_status};
```

**Step 3: Add to Tauri builder**

```rust
// helix-desktop/src-tauri/src/main.rs
use commands::{start_memory_synthesis, get_rust_exe_status};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            start_memory_synthesis,
            get_rust_exe_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: Commit**

```bash
git add helix-desktop/src-tauri/
git commit -m "feat(desktop): integrate Rust executables with Tauri commands"
```

### Task 7: Documentation

**Files:**

- Create: `helix-rust/README.md`
- Create: `docs/guides/RUST-EXECUTABLES.md`

**Step 1: Create README**

````markdown
# helix-rust/README.md

# Helix Rust Executables

High-performance Rust executables for CPU-intensive operations, all integrated with Supabase PostgreSQL as single source of truth.

## Executables

### 1. Memory Synthesis Engine

**Binary:** `memory-synthesis`
**Port:** N/A (CLI tool)

Performs CPU-intensive pattern recognition on memories stored in Supabase.

```bash
./target/release/memory-synthesis --user-id <UUID> --limit 100 --confidence 0.7
```
````

### 2. Psychology Layer Decay Calculator

**Binary:** `psychology-decay`
**Port:** N/A (scheduled job)

Computes memory decay using psychological models (Ebbinghaus, power law, exponential).

```bash
# Run once
./target/release/psychology-decay --once

# Run on schedule (hourly)
./target/release/psychology-decay --schedule "0 0 * * * *"
```

### 3. Skill Execution Sandbox

**Binary:** `skill-sandbox`
**Port:** 18790

WASM-based secure sandbox for skill execution.

```bash
./target/release/skill-sandbox --port 18790
```

### 4. Voice Processing Pipeline

**Binary:** `voice-pipeline`
**Port:** 18791

Real-time audio processing with Deepgram integration.

```bash
./target/release/voice-pipeline --port 18791
```

### 5. Real-Time Sync Coordinator

**Binary:** `sync-coordinator`
**Port:** 18792

Multi-instance synchronization with vector clock conflict resolution.

```bash
./target/release/sync-coordinator --port 18792
```

## Building

```bash
cargo build --release
```

## Testing

```bash
cargo test
cargo test --package <package-name>
```

## Environment Variables

All executables require:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Additional for specific executables:

- `DEEPGRAM_API_KEY` (voice-pipeline only)

## Integration

All executables are integrated with:

- **Web:** Via HTTP/WebSocket APIs
- **Desktop:** Via Tauri commands
- **Mobile:** Via Gateway RPC protocol

Data flows through Supabase PostgreSQL - no local silos.

````

**Step 2: Commit**

```bash
git add helix-rust/README.md docs/guides/RUST-EXECUTABLES.md
git commit -m "docs(rust): add comprehensive documentation for all executables"
````

---

## Success Criteria

### Executable 1: Memory Synthesis

- [ ] Compiles without errors
- [ ] Fetches memories from Supabase
- [ ] Detects temporal, semantic, emotional patterns
- [ ] Writes synthesis results to Supabase
- [ ] Integration test passes

### Executable 2: Psychology Decay

- [ ] Implements 3 decay models (Ebbinghaus, Power Law, Exponential)
- [ ] Runs on schedule (cron-like)
- [ ] Updates all 7 psychology layers in Supabase
- [ ] Handles missing data gracefully

### Executable 3: Skill Sandbox

- [ ] WASM runtime initializes
- [ ] RPC server listens on port 18790
- [ ] Executes WASM skills with timeout
- [ ] Stores execution results in Supabase
- [ ] Returns results via HTTP response

### Executable 4: Voice Pipeline

- [ ] Decodes audio (webm, mp3, wav)
- [ ] Resamples to 16kHz
- [ ] Sends to Deepgram API
- [ ] Stores transcript + audio in Supabase
- [ ] RPC server on port 18791

### Executable 5: Sync Coordinator

- [ ] Vector clock implementation correct
- [ ] Detects concurrent modifications
- [ ] Resolves conflicts (LWW)
- [ ] WebSocket relay broadcasts deltas
- [ ] Multiple clients can connect

### Integration

- [ ] All executables build with `cargo build --release`
- [ ] Desktop app can invoke via Tauri commands
- [ ] Environment variables loaded from `.env`
- [ ] All tests pass
- [ ] Documentation complete

---

## Notes

**Critical Constraints:**

- ALL data storage MUST use Supabase (no SQLite silos)
- Executables are services, not standalone apps
- Web/desktop/mobile call these via RPC
- Performance: Rust replaces expensive Node.js operations

**User Directive:** "I want you to build all of them, only stop when you finished 100% all tasks."

**Estimated Time:** 40-50 hours total

- Memory Synthesis: 8-10 hours
- Psychology Decay: 6-8 hours
- Skill Sandbox: 10-12 hours
- Voice Pipeline: 8-10 hours
- Sync Coordinator: 8-10 hours
