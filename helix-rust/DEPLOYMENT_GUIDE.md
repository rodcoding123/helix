# Helix Rust Executables - Deployment Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Build Instructions](#build-instructions)
3. [Environment Configuration](#environment-configuration)
4. [RPC Server Specifications](#rpc-server-specifications)
5. [Database Setup](#database-setup)
6. [Running Executables](#running-executables)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Rust 1.93+ with Cargo
- Node.js 22+ (for Tauri desktop app)
- PostgreSQL 14+ (via Supabase)
- Deepgram API key (for voice-pipeline only)

### One-Command Build

```bash
cd helix-rust
cargo build --release --workspace
```

**Output**: 5 release binaries in `target/release/`

- memory-synthesis.exe
- psychology-decay.exe
- skill-sandbox.exe
- voice-pipeline.exe
- sync-coordinator.exe

### One-Command Test

```bash
cargo test --lib --workspace
```

**Expected**: All 16 tests pass

---

## Build Instructions

### Building Individual Crates

```bash
# Build only memory synthesis
cargo build --release -p memory-synthesis

# Build only psychology decay
cargo build --release -p psychology-decay

# Build only skill sandbox
cargo build --release -p skill-sandbox

# Build only voice pipeline
cargo build --release -p voice-pipeline

# Build only sync coordinator
cargo build --release -p sync-coordinator
```

### Building in Debug Mode (Development)

```bash
# Full debug build (faster, larger binaries, more debug symbols)
cargo build --workspace

# Output: target/debug/*.exe (unoptimized)
```

### Debug vs Release Comparison

| Aspect          | Debug       | Release          |
| --------------- | ----------- | ---------------- |
| Build time      | ~2 min      | ~2 min           |
| Binary size     | ~100-200 MB | ~4-13 MB         |
| Execution speed | Slow        | Fast (optimized) |
| Debug symbols   | Full        | Stripped         |
| Use case        | Development | Production       |

---

## Environment Configuration

### 1. Create .env File

```bash
# helix-rust/.env

# Supabase Configuration (REQUIRED FOR ALL)
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_FROM_SUPABASE]
SUPABASE_DB_URL=postgresql://[USERNAME]:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

# Deepgram Configuration (REQUIRED FOR VOICE PIPELINE ONLY)
DEEPGRAM_API_KEY=[API_KEY_FROM_DEEPGRAM]

# Logging Configuration (OPTIONAL)
RUST_LOG=info
# Detailed logging: RUST_LOG=debug
```

### 2. Load Environment Variables

#### Option A: .env File (Recommended for development)

```bash
# Manually source .env before running
export $(cat .env | xargs)
```

#### Option B: Tauri Integration (Recommended for production)

The desktop app can inject environment variables:

```typescript
// src-tauri/src/main.rs
use std::env;

fn main() {
  // Load from environment or config file
  env::set_var("SUPABASE_URL", config.supabase_url);
  env::set_var("SUPABASE_SERVICE_ROLE_KEY", config.supabase_key);
}
```

#### Option C: System Environment Variables (Production servers)

```bash
# Windows
set SUPABASE_URL=https://[PROJECT_ID].supabase.co
set SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
set SUPABASE_DB_URL=postgresql://[CREDENTIALS]

# Linux/macOS
export SUPABASE_URL=https://[PROJECT_ID].supabase.co
export SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
export SUPABASE_DB_URL=postgresql://[CREDENTIALS]
```

### 3. Environment Variable Reference

#### Required Variables

| Variable                    | Value                 | Source                                   |
| --------------------------- | --------------------- | ---------------------------------------- |
| `SUPABASE_URL`              | Project URL           | Supabase dashboard → Settings → API      |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key      | Supabase dashboard → Settings → API      |
| `SUPABASE_DB_URL`           | PostgreSQL connection | Supabase dashboard → Settings → Database |

#### Optional Variables

| Variable           | Default | Purpose                                  |
| ------------------ | ------- | ---------------------------------------- |
| `RUST_LOG`         | info    | Logging level (debug, info, warn, error) |
| `DEEPGRAM_API_KEY` | (none)  | Deepgram API key (voice-pipeline only)   |

#### Deepgram API Key

Get from: Deepgram console under API Keys

```bash
# Production: sk_live_[KEY]
# Testing: sk_test_[KEY]
DEEPGRAM_API_KEY=[PRODUCTION_OR_TEST_KEY]
```

---

## RPC Server Specifications

### Overview

Each executable runs its own RPC server for inter-process communication:

### 1. Memory Synthesis (Port 18788)

```
Base URL: http://localhost:18788
```

**Endpoints**:

#### POST /detect-patterns

Detect patterns in input sequence

```bash
curl -X POST http://localhost:18788/detect-patterns \
  -H "Content-Type: application/json" \
  -d '{
    "sequence": [0, 1, 0, 1, 0, 1],
    "threshold": 0.8
  }'
```

**Response**:

```json
{
  "patterns": [
    {
      "pattern": [0, 1],
      "frequency": 3,
      "confidence": 0.95
    }
  ],
  "total_matches": 3
}
```

#### GET /status

Health check

```bash
curl http://localhost:18788/status
```

**Response**:

```json
{
  "status": "healthy",
  "uptime_seconds": 123,
  "patterns_cached": 42
}
```

---

### 2. Skill Sandbox (Port 18790)

```
Base URL: http://localhost:18790
RPC WebSocket: ws://localhost:18790/ws
```

**Endpoints**:

#### POST /execute-skill

Execute a WASM skill

```bash
curl -X POST http://localhost:18790/execute-skill \
  -H "Content-Type: application/json" \
  -d '{
    "skill_id": "uuid-1234",
    "skill_bytes": "base64-encoded-wasm",
    "args": {
      "input": "test"
    },
    "timeout_ms": 5000
  }'
```

**Response**:

```json
{
  "success": true,
  "output": {
    "result": "output value"
  },
  "execution_time_ms": 42
}
```

#### GET /skill/:skill_id

Fetch skill from Supabase

```bash
curl http://localhost:18790/skill/uuid-1234
```

**Response**:

```json
{
  "skill_id": "uuid-1234",
  "name": "text_analysis",
  "version": "1.0.0",
  "wasm_bytes": "base64...",
  "created_at": "2026-02-05T00:00:00Z"
}
```

---

### 3. Voice Pipeline (Port 18791)

```
Base URL: http://localhost:18791
```

**Endpoints**:

#### POST /transcribe

Transcribe audio file

```bash
curl -X POST http://localhost:18791/transcribe \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@recording.mp3" \
  -F "language=en" \
  -F "model=nova-2"
```

**Response**:

```json
{
  "transcript": "Hello world",
  "confidence": 0.98,
  "duration_seconds": 1.2,
  "language": "en",
  "storage_url": "https://bucket.supabase.co/voice/uuid.mp3"
}
```

#### POST /process-audio

Convert and process audio

```bash
curl -X POST http://localhost:18791/process-audio \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@song.m4a"
```

**Response**:

```json
{
  "format": "wav",
  "sample_rate": 16000,
  "channels": 1,
  "duration_seconds": 180,
  "output_url": "https://bucket.supabase.co/processed/uuid.wav"
}
```

#### GET /status

Health check

```bash
curl http://localhost:18791/status
```

**Response**:

```json
{
  "status": "healthy",
  "deepgram_quota_remaining": 456,
  "processed_files": 12
}
```

---

### 4. Sync Coordinator (Port 18792)

```
Base URL: http://localhost:18792
WebSocket: ws://localhost:18792/sync
```

**Endpoints**:

#### WebSocket: /sync

Real-time sync relay

```javascript
const ws = new WebSocket('ws://localhost:18792/sync');

ws.onmessage = event => {
  const message = JSON.parse(event.data);
  console.log('Sync update:', message);
};

ws.send(
  JSON.stringify({
    event_type: 'entity_update',
    entity_id: 'uuid-1234',
    data: { field: 'value' },
    device_id: 'device-uuid',
    user_id: 'user-uuid',
    timestamp: Date.now(),
  })
);
```

#### POST /resolve-conflict

Resolve concurrent modifications

```bash
curl -X POST http://localhost:18792/resolve-conflict \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "uuid-1234",
    "local_version": {
      "timestamp": 1707050000000,
      "data": { "field": "local_value" }
    },
    "remote_version": {
      "timestamp": 1707050001000,
      "data": { "field": "remote_value" }
    }
  }'
```

**Response**:

```json
{
  "resolution": "remote_wins",
  "reason": "last_write_wins",
  "final_value": { "field": "remote_value" }
}
```

#### GET /vector-clock/:device_id

Get vector clock state

```bash
curl http://localhost:18792/vector-clock/device-uuid
```

**Response**:

```json
{
  "device_id": "device-uuid",
  "timestamp": 12345,
  "clock": {
    "device-uuid": 12345,
    "device-uuid-2": 11000,
    "device-uuid-3": 10500
  }
}
```

---

### 5. Psychology Decay (No RPC - Scheduled)

No HTTP server. Runs as a scheduled cron job.

**Execution**:

```bash
# Run once
./psychology-decay.exe --once

# Run with custom schedule (cron format)
./psychology-decay.exe --schedule "0 0 * * * *"

# Run hourly (default)
./psychology-decay.exe
```

**Decay Calculation**: Updates `psychology_layers` table with retention decay

---

## Database Setup

### Prerequisites

- Supabase project created
- PostgreSQL database accessible
- `postgres` role configured with password

### 1. Create Schema

Run these SQL commands in Supabase SQL editor:

```sql
-- Memory Synthesis Table
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pattern BYTEA NOT NULL,
  frequency INTEGER DEFAULT 1,
  confidence FLOAT DEFAULT 0.0,
  first_detected TIMESTAMPTZ DEFAULT now(),
  last_detected TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patterns_user_id ON patterns(user_id);
CREATE INDEX idx_patterns_created_at ON patterns(created_at);

-- Psychology Layer Decay Table
CREATE TABLE IF NOT EXISTS psychology_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  layer_number INTEGER NOT NULL CHECK (layer_number BETWEEN 1 AND 7),
  layer_name TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  decay_rate FLOAT DEFAULT 1.0,
  initial_strength FLOAT DEFAULT 1.0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, layer_number)
);

CREATE INDEX idx_psychology_user_id ON psychology_layers(user_id);
CREATE INDEX idx_psychology_layer_number ON psychology_layers(layer_number);

-- Skills Table
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  wasm_bytes BYTEA NOT NULL,
  description TEXT,
  timeout_ms INTEGER DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skills_user_id ON skills(user_id);
CREATE INDEX idx_skills_name ON skills(name);

-- Voice Recordings Table
CREATE TABLE IF NOT EXISTS voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transcript TEXT,
  storage_url TEXT NOT NULL,
  format TEXT DEFAULT 'wav',
  sample_rate INTEGER DEFAULT 16000,
  duration_seconds FLOAT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_user_id ON voice_recordings(user_id);
CREATE INDEX idx_voice_created_at ON voice_recordings(created_at);

-- Sync Events Table
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  vector_clock JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sync_user_id ON sync_events(user_id);
CREATE INDEX idx_sync_device_id ON sync_events(device_id);
CREATE INDEX idx_sync_entity_id ON sync_events(entity_id);
CREATE INDEX idx_sync_timestamp ON sync_events(timestamp);
```

### 2. Create RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychology_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own data"
ON patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
ON patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Repeat for other tables...
```

### 3. Verify Schema

```bash
# Test connection
psql -U postgres -h db.[PROJECT_ID].supabase.co -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"

# Expected output:
# - patterns
# - psychology_layers
# - skills
# - voice_recordings
# - sync_events
```

---

## Running Executables

### 1. From Command Line (Development)

```bash
# Terminal 1: Memory Synthesis
./target/release/memory-synthesis.exe

# Terminal 2: Psychology Decay (scheduled)
./target/release/psychology-decay.exe

# Terminal 3: Skill Sandbox
./target/release/skill-sandbox.exe

# Terminal 4: Voice Pipeline
./target/release/voice-pipeline.exe

# Terminal 5: Sync Coordinator
./target/release/sync-coordinator.exe
```

### 2. From Tauri Desktop App (Production)

```typescript
// src-tauri/src/main.rs

use std::process::{Command, Child};
use std::sync::Mutex;

// Store subprocess handles
struct AppState {
  subprocesses: Mutex<Vec<Child>>,
}

#[tauri::command]
fn start_memory_synthesis() -> Result<(), String> {
  let child = Command::new("./memory-synthesis.exe")
    .spawn()
    .map_err(|e| e.to_string())?;

  // Store handle for later cleanup
  Ok(())
}

#[tauri::command]
fn stop_all() {
  // Kill all subprocesses gracefully
}
```

### 3. As System Services (Production Linux)

```ini
# /etc/systemd/system/helix-memory-synthesis.service
[Unit]
Description=Helix Memory Synthesis Engine
After=network.target

[Service]
Type=simple
User=helix
WorkingDirectory=/opt/helix
ExecStart=/opt/helix/memory-synthesis
Environment=RUST_LOG=info
Environment=SUPABASE_URL=https://...
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable helix-memory-synthesis
sudo systemctl start helix-memory-synthesis
```

---

## Usage Examples

### Example 1: End-to-End Memory Synthesis

```bash
# 1. Start all services
./target/release/memory-synthesis.exe &
./target/release/sync-coordinator.exe &

# 2. Send a sequence to detect patterns
curl -X POST http://localhost:18788/detect-patterns \
  -H "Content-Type: application/json" \
  -d '{
    "sequence": [1, 2, 3, 1, 2, 3, 1, 2, 3],
    "threshold": 0.7
  }'

# 3. Sync pattern across devices
curl -X POST http://localhost:18792/resolve-conflict \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "pattern-uuid",
    "local_version": { "timestamp": 1000, "data": {} },
    "remote_version": { "timestamp": 2000, "data": {} }
  }'
```

### Example 2: Voice Transcription

```bash
# 1. Start voice pipeline
./target/release/voice-pipeline.exe &

# 2. Transcribe audio file
curl -X POST http://localhost:18791/transcribe \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@/path/to/audio.mp3" \
  -F "language=en"

# 3. Retrieve from Supabase
psql -U postgres -h db.[PROJECT_ID].supabase.co -d postgres -c \
  "SELECT transcript, storage_url FROM voice_recordings WHERE id = 'uuid';"
```

### Example 3: Skill Execution

```bash
# 1. Start skill sandbox
./target/release/skill-sandbox.exe &

# 2. Create WASM skill (using wasm-pack or similar)
# $ wasm-pack build --target web

# 3. Upload to Supabase or directly invoke
curl -X POST http://localhost:18790/execute-skill \
  -H "Content-Type: application/json" \
  -d '{
    "skill_id": "skill-uuid",
    "skill_bytes": "AGFzbQ...",
    "args": { "text": "input" },
    "timeout_ms": 5000
  }'
```

### Example 4: Psychology Decay Calculation

```bash
# 1. Trigger decay calculation
./target/release/psychology-decay.exe --once

# 2. Monitor results in database
psql -U postgres -h db.[PROJECT_ID].supabase.co -d postgres -c \
  "SELECT layer_number, decay_rate, last_updated FROM psychology_layers ORDER BY layer_number;"

# 3. Schedule hourly updates
nohup ./target/release/psychology-decay.exe > /var/log/psychology-decay.log 2>&1 &
```

---

## Troubleshooting

### Problem: "SUPABASE_URL not set"

**Cause**: Environment variable not loaded

**Solution**:

```bash
# Check environment
echo $SUPABASE_URL

# Load from file
export $(cat .env | xargs)

# Verify
echo $SUPABASE_URL  # Should output URL
```

### Problem: "Connection refused" on port 18788

**Cause**: Service not running or port in use

**Solution**:

```bash
# Check if running
netstat -tuln | grep 18788

# Check if port is in use by something else
lsof -i :18788

# Kill process on port
kill -9 $(lsof -t -i :18788)

# Restart service
./target/release/memory-synthesis.exe
```

### Problem: "Failed to create client: DEEPGRAM_API_KEY not set"

**Cause**: Voice pipeline started without API key

**Solution**:

```bash
# Only voice-pipeline needs this
export DEEPGRAM_API_KEY=[DEEPGRAM_KEY]

# Restart voice pipeline
./target/release/voice-pipeline.exe
```

### Problem: "Panic: Failed to connect to database"

**Cause**: PostgreSQL connection string invalid

**Solution**:

```bash
# Test connection directly
psql -U postgres -h db.[PROJECT_ID].supabase.co -d postgres -c "SELECT 1;"

# Update SUPABASE_DB_URL with correct credentials
export SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

# Verify in code
cargo run --bin memory-synthesis -- --test-connection
```

### Problem: Executables run very slowly

**Cause**: Debug build instead of release

**Solution**:

```bash
# Make sure you built release
ls -lh target/release/*.exe

# Should show: 4-13 MB

# If built debug:
cargo build --release --workspace

# Run from release directory
./target/release/memory-synthesis.exe
```

### Problem: "WASM timeout - execution exceeded 5000ms"

**Cause**: Skill takes too long to execute

**Solution**:

```bash
# Increase timeout in request
curl -X POST http://localhost:18790/execute-skill \
  -d '{
    "timeout_ms": 10000
  }'

# Or optimize skill (reduce computation time)
```

### Problem: Voice transcription very slow or failing

**Cause**: Deepgram API rate limit or network issue

**Solution**:

```bash
# Check Deepgram quota
curl http://localhost:18791/status

# Check network connectivity
curl -I https://api.deepgram.com/

# Verify API key
echo $DEEPGRAM_API_KEY

# Check logs for errors
RUST_LOG=debug ./target/release/voice-pipeline.exe
```

---

## Performance Tuning

### Memory Synthesis

```bash
# Increase pattern cache size
# Edit src/crates/memory-synthesis/src/main.rs
const PATTERN_CACHE_SIZE: usize = 10_000;

# Rebuild and redeploy
cargo build --release -p memory-synthesis
```

### Skill Sandbox

```bash
# Increase WASM memory limit
# In src/crates/skill-sandbox/src/main.rs
let mut store = Store::new(&engine, InstanceConfig {
  max_memory: 10 * 1024 * 1024,  // 10 MB
  ..Default::default()
});
```

### Voice Pipeline

```bash
# Batch audio processing
curl -X POST http://localhost:18791/batch-transcribe \
  -F "files=@audio1.mp3" \
  -F "files=@audio2.mp3" \
  -F "files=@audio3.mp3"
```

### Sync Coordinator

```bash
# Increase broadcast channel capacity
// In src/crates/sync-coordinator/src/main.rs
let (tx, _rx) = broadcast::channel(1_000);  // Increase buffer size
```

---

## Monitoring & Logging

### Enable Debug Logging

```bash
# All packages at debug level
RUST_LOG=debug ./target/release/memory-synthesis.exe

# Specific package at debug
RUST_LOG=memory_synthesis=debug ./target/release/memory-synthesis.exe

# Multiple levels
RUST_LOG=memory_synthesis=debug,sync_coordinator=info
```

### View Logs from Tauri App

```typescript
// In Tauri main.rs
use tauri::api::process::Command;

let output = Command::new("cmd")
  .args(&["/C", "type", "logs\\memory-synthesis.log"])
  .output()
  .expect("Failed to read logs");

println!("{}", String::from_utf8(output.stdout).unwrap());
```

### Monitor Service Health

```bash
#!/bin/bash
# check-health.sh

for port in 18788 18790 18791 18792; do
  echo "Checking port $port..."
  if curl -s http://localhost:$port/status > /dev/null; then
    echo "✓ Service on port $port is healthy"
  else
    echo "✗ Service on port $port is DOWN"
  fi
done
```

---

## Security Considerations

### 1. API Key Security

```bash
# ✗ DON'T: Hardcode keys
const DEEPGRAM_KEY = "[DEEPGRAM_KEY]";

# ✓ DO: Use environment variables
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

# ✓ DO: Use secrets manager
const DEEPGRAM_KEY = await secretsManager.get("deepgram-api-key");
```

### 2. Database Credentials

```bash
# ✗ DON'T: Store in git
git add .env

# ✓ DO: Add to .gitignore
echo ".env" >> .gitignore

# ✓ DO: Use environment variables in CI/CD
CI_SUPABASE_KEY=xyz deploy.sh
```

### 3. WebSocket Authentication

```javascript
// Add auth token to WebSocket connection
const ws = new WebSocket('ws://localhost:18792/sync?token=jwt_token');

// Verify token on server side
#[derive(Deserialize)]
struct SyncQuery {
  token: String,
}

// Validate JWT and extract user_id
let user_id = validate_jwt(&query.token)?;
```

### 4. Rate Limiting

```bash
# For RPC servers, add rate limiting middleware
# In Axum: use tower_governor for rate limits

const REQUESTS_PER_SECOND: u32 = 100;
const BURST_SIZE: u32 = 200;
```

---

## Backup & Recovery

### Backup Strategy

```bash
# Backup PostgreSQL database weekly
pg_dump -U postgres -h db.[PROJECT_ID].supabase.co postgres > backup-$(date +%Y%m%d).sql

# Backup WASM skills (versioned in Git)
git add crates/skill-sandbox/skills/
git commit -m "Backup: Add skill versions"
git push origin main
```

### Recovery Procedure

```bash
# Restore from backup
psql -U postgres -h db.[PROJECT_ID].supabase.co postgres < backup-20260205.sql

# Re-run schema migrations
./helix-rust/scripts/migrate.sh

# Restart all services
./target/release/memory-synthesis.exe &
./target/release/psychology-decay.exe &
# ... etc
```

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] PostgreSQL database created and populated
- [ ] All tables created with proper indexes
- [ ] RLS policies configured
- [ ] Binaries built in release mode
- [ ] Deepgram API key obtained (for voice-pipeline)
- [ ] Services started and responding on correct ports
- [ ] Health check endpoints returning 200
- [ ] Database connectivity verified
- [ ] Logging configured (RUST_LOG)
- [ ] Monitoring/alerting set up
- [ ] Backup strategy implemented
- [ ] Team trained on troubleshooting
- [ ] Documentation shared with ops team

---

**Deployment Guide Version**: 1.0
**Last Updated**: February 5, 2026
**Maintained By**: Helix Engineering Team
