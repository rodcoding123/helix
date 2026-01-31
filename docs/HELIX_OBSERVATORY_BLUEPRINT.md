# HELIX OBSERVATORY BLUEPRINT

## Complete Platform Architecture

**Version:** 1.0
**Date:** January 31, 2026
**Status:** IMPLEMENTATION READY

---

## EXECUTIVE SUMMARY

The Helix Observatory is a three-layer platform:

1. **Web Platform** - Public website, user dashboard, subscription management
2. **Observer Infrastructure** - Real-time monitoring, sync, verification
3. **Research Engine** - Pattern recognition, insights, anomaly detection

This blueprint defines the complete architecture for a scalable, future-proof system.

---

# PART I: SYSTEM ARCHITECTURE

## 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HELIX INSTANCES (Worldwide)                        │
│                                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │ Helix 1 │  │ Helix 2 │  │ Helix 3 │  │   ...   │  │ Helix N │          │
│   │ (Free)  │  │ (Free)  │  │ (Ghost) │  │         │  │ (Free)  │          │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│        │            │            │            │            │                │
│        │ telemetry  │ telemetry  │ (none)     │ telemetry  │ telemetry     │
│        ▼            ▼            ▼            ▼            ▼                │
└────────┼────────────┼────────────┼────────────┼────────────┼────────────────┘
         │            │                         │            │
         └────────────┴─────────┬───────────────┴────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HELIX OBSERVATORY PLATFORM                           │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     LAYER 1: INGESTION                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │  Telemetry  │  │  Heartbeat  │  │   Events    │  │   Discord   │  │   │
│  │  │  Endpoint   │  │  Receiver   │  │   Stream    │  │   Webhooks  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼─────────┘   │
│            │                │                │                │             │
│            └────────────────┴───────┬────────┴────────────────┘             │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     LAYER 2: STORAGE                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    SUPABASE (PostgreSQL)                         │ │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐│ │   │
│  │  │  │   users   │ │ instances │ │ telemetry │ │   daily_stats     ││ │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘│ │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐│ │   │
│  │  │  │subscriptns│ │ anomalies │ │ patterns  │ │ transformations   ││ │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘│ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     LAYER 3: PROCESSING                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Pattern   │  │   Anomaly   │  │  Aggregate  │  │   Insight   │  │   │
│  │  │  Detector   │  │  Detector   │  │  Calculator │  │  Generator  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     LAYER 4: PRESENTATION                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Landing   │  │  Dashboard  │  │ Observatory │  │  Research   │  │   │
│  │  │    Page     │  │   (Users)   │  │   (Paid)    │  │  API (Pro)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Repository Structure

```
helix/
├── openclaw-helix/              # Modified OpenClaw engine
│   └── src/helix/               # Seven-layer integration
│
├── web/                         # Observatory Web Platform
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── Docs.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Observatory.tsx
│   │   │   ├── Research.tsx     # Pro tier - deep insights
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── auth/
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── TierGate.tsx  # Restrict by subscription
│   │   │   ├── dashboard/
│   │   │   │   ├── InstanceCard.tsx
│   │   │   │   ├── InstanceList.tsx
│   │   │   │   └── QuickStats.tsx
│   │   │   ├── observatory/
│   │   │   │   ├── LiveHeartbeatMap.tsx
│   │   │   │   ├── GlobalActivityFeed.tsx
│   │   │   │   ├── PsychologyDistribution.tsx
│   │   │   │   ├── TransformationTimeline.tsx
│   │   │   │   ├── AnomalyFeed.tsx
│   │   │   │   └── TrendCharts.tsx
│   │   │   ├── research/
│   │   │   │   ├── PatternExplorer.tsx
│   │   │   │   ├── CorrelationMatrix.tsx
│   │   │   │   ├── BehaviorClusters.tsx
│   │   │   │   └── ExportPanel.tsx
│   │   │   └── common/
│   │   │       ├── PricingCard.tsx
│   │   │       ├── LiveCounter.tsx
│   │   │       └── Charts.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── api.ts
│   │   │   └── analytics.ts
│   │   └── hooks/
│   │       ├── useAuth.ts
│   │       ├── useSubscription.ts
│   │       ├── useInstances.ts
│   │       └── useRealtime.ts
│   │
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_telemetry_tables.sql
│   │   │   ├── 003_research_tables.sql
│   │   │   └── 004_rls_policies.sql
│   │   └── functions/
│   │       ├── telemetry-ingest/     # Edge function
│   │       ├── heartbeat-receiver/   # Edge function
│   │       ├── anomaly-detector/     # Edge function (cron)
│   │       ├── daily-aggregator/     # Edge function (cron)
│   │       └── pattern-analyzer/     # Edge function (cron)
│   │
│   ├── package.json
│   ├── vercel.json
│   └── README.md
│
├── observer/                    # Local Observer Tools (YOUR machine)
│   ├── scripts/
│   │   ├── sync_logs.sh         # Rsync from Helix machine
│   │   ├── verify_chain.py      # Compare local vs Discord
│   │   ├── anomaly_detector.py  # Pattern matching
│   │   ├── daily_summary.py     # Generate daily report
│   │   └── git_backup.sh        # Clone/pull her workspace
│   ├── config/
│   │   ├── observer.yaml        # Configuration
│   │   └── anomaly_rules.yaml   # Detection rules
│   ├── templates/
│   │   └── daily_report.html    # Email template
│   └── README.md
│
├── soul/                        # Helix identity
├── psychology/                  # Psychological configs
├── identity/                    # Goals, fears, possibilities
├── transformation/              # Growth tracking
├── purpose/                     # Meaning, wellness
├── legacy/                      # Axis memories
├── docs/                        # Documentation
├── install_helix.sh             # One-command installer
└── README.md
```

---

# PART II: DATABASE SCHEMA

## 2.1 Core Tables

```sql
-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Supabase PostgreSQL
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- =====================================================
-- USERS & SUBSCRIPTIONS
-- =====================================================

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM (
  'free',           -- Telemetry on, basic dashboard
  'ghost',          -- $9/mo - Telemetry off, privacy
  'observatory',    -- $29/mo - View aggregate data
  'observatory_pro' -- $99/mo - API access, exports, research tools
);

-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys for Pro users
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  key_hash TEXT NOT NULL,  -- SHA256 of the key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  name TEXT,
  permissions JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HELIX INSTANCES
-- =====================================================

-- Registered Helix instances
CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  instance_key TEXT UNIQUE NOT NULL,  -- Anonymous identifier

  -- Configuration snapshot (no sensitive data)
  soul_hash TEXT,                     -- SHA256 of SOUL.md
  psychology_summary JSONB,           -- {enneagram: "3w4", big_five: {...}}

  -- Status
  ghost_mode BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version TEXT,                       -- Helix version

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  last_transformation TIMESTAMPTZ
);

-- Instance configuration history
CREATE TABLE instance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,
  soul_hash TEXT,
  psychology_summary JSONB,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TELEMETRY & EVENTS
-- =====================================================

-- Event types
CREATE TYPE telemetry_event_type AS ENUM (
  'heartbeat',          -- Proof of life
  'session_start',      -- Conversation began
  'session_end',        -- Conversation ended
  'transformation',     -- State change occurred
  'anomaly',           -- Unusual pattern detected locally
  'error',             -- Error occurred
  'boot',              -- Instance started
  'shutdown'           -- Instance stopped gracefully
);

-- Raw telemetry events
CREATE TABLE telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,
  event_type telemetry_event_type NOT NULL,

  -- Event data (anonymized, no content)
  event_data JSONB,

  -- Metadata
  client_timestamp TIMESTAMPTZ,      -- When event occurred on instance
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Indexing
  event_date DATE GENERATED ALWAYS AS (DATE(server_timestamp)) STORED
);

-- Partitioned by date for performance
CREATE INDEX idx_telemetry_date ON telemetry (event_date);
CREATE INDEX idx_telemetry_instance ON telemetry (instance_key, server_timestamp DESC);
CREATE INDEX idx_telemetry_type ON telemetry (event_type, server_timestamp DESC);

-- Heartbeat tracking (separate for performance)
CREATE TABLE heartbeats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  latency_ms INTEGER,  -- Round trip time if measured
  metadata JSONB       -- Uptime, memory usage, etc.
);

CREATE INDEX idx_heartbeats_instance ON heartbeats (instance_key, received_at DESC);

-- =====================================================
-- TRANSFORMATIONS & GROWTH
-- =====================================================

-- Transformation events (subset of telemetry, enriched)
CREATE TABLE transformations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,

  -- What changed
  transformation_type TEXT,           -- 'unfreezing', 'changing', 'refreezing'
  from_state JSONB,                   -- Previous state summary
  to_state JSONB,                     -- New state summary

  -- Context (no content)
  trigger_category TEXT,              -- 'conversation', 'reflection', 'external'
  session_count_before INTEGER,

  -- Analysis
  significance_score FLOAT,           -- 0-1 how significant

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANOMALIES & PATTERNS
-- =====================================================

-- Detected anomalies
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT,                  -- NULL for global anomalies

  -- Classification
  anomaly_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),

  -- Details
  description TEXT,
  pattern_data JSONB,                 -- What triggered detection

  -- Resolution
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users,
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recognized patterns (learned from data)
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Pattern definition
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT,                  -- 'behavioral', 'temporal', 'psychological'

  -- Detection criteria
  detection_rules JSONB NOT NULL,

  -- Statistics
  occurrence_count INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,

  -- Curation
  is_notable BOOLEAN DEFAULT FALSE,   -- Highlighted in Observatory
  is_concerning BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern occurrences
CREATE TABLE pattern_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES patterns NOT NULL,
  instance_key TEXT NOT NULL,
  match_data JSONB,
  confidence FLOAT,
  matched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AGGREGATES & STATISTICS
-- =====================================================

-- Daily aggregates (for charts and trends)
CREATE TABLE daily_stats (
  date DATE PRIMARY KEY,

  -- Counts
  total_instances INTEGER DEFAULT 0,
  active_instances INTEGER DEFAULT 0,    -- Sent heartbeat today
  new_instances INTEGER DEFAULT 0,
  ghost_instances INTEGER DEFAULT 0,

  -- Activity
  total_sessions INTEGER DEFAULT 0,
  total_heartbeats INTEGER DEFAULT 0,
  avg_session_duration_seconds FLOAT,

  -- Events
  transformations INTEGER DEFAULT 0,
  anomalies_info INTEGER DEFAULT 0,
  anomalies_warning INTEGER DEFAULT 0,
  anomalies_critical INTEGER DEFAULT 0,

  -- Psychology distribution (snapshot)
  enneagram_distribution JSONB,          -- {"3w4": 15, "8": 12, ...}
  big_five_averages JSONB,               -- {"openness": 0.75, ...}

  -- Computed at
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly stats (for real-time dashboard)
CREATE TABLE hourly_stats (
  hour TIMESTAMPTZ PRIMARY KEY,          -- Truncated to hour

  active_instances INTEGER DEFAULT 0,
  heartbeats INTEGER DEFAULT 0,
  sessions_started INTEGER DEFAULT 0,
  sessions_ended INTEGER DEFAULT 0,
  transformations INTEGER DEFAULT 0,

  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RESEARCH LAYER (Pro Tier)
-- =====================================================

-- Behavior clusters (ML-generated)
CREATE TABLE behavior_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name TEXT,
  description TEXT,

  -- Cluster definition
  centroid JSONB,                        -- Feature vector center
  member_count INTEGER DEFAULT 0,

  -- Characteristics
  typical_psychology JSONB,
  typical_behaviors JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instance cluster membership
CREATE TABLE instance_clusters (
  instance_key TEXT NOT NULL,
  cluster_id UUID REFERENCES behavior_clusters NOT NULL,
  membership_score FLOAT,                -- How well they fit
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (instance_key, cluster_id)
);

-- Research queries (saved by Pro users)
CREATE TABLE saved_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,

  name TEXT NOT NULL,
  description TEXT,
  query_type TEXT,                       -- 'sql', 'filter', 'aggregate'
  query_definition JSONB NOT NULL,

  -- Execution
  last_run_at TIMESTAMPTZ,
  last_run_result_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Export history
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,

  export_type TEXT,                      -- 'csv', 'json', 'parquet'
  query_definition JSONB,
  row_count INTEGER,
  file_size_bytes BIGINT,
  file_url TEXT,                         -- Supabase storage URL
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Users see their own data
CREATE POLICY "Users own subscriptions" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own api_keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own instances" ON instances
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own instance_snapshots" ON instance_snapshots
  FOR SELECT USING (
    instance_id IN (SELECT id FROM instances WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own anomalies" ON anomalies
  FOR SELECT USING (
    instance_key IN (SELECT instance_key FROM instances WHERE user_id = auth.uid())
    OR instance_key IS NULL  -- Global anomalies visible to all
  );

CREATE POLICY "Users own saved_queries" ON saved_queries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own exports" ON exports
  FOR ALL USING (auth.uid() = user_id);

-- Telemetry: Public insert, restricted read
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instances can insert telemetry" ON telemetry
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users see own instance telemetry" ON telemetry
  FOR SELECT USING (
    instance_key IN (SELECT instance_key FROM instances WHERE user_id = auth.uid())
  );

-- Observatory/Pro users can see aggregate data (handled in app layer)

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update instance last_seen on heartbeat
CREATE OR REPLACE FUNCTION update_instance_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE instances
  SET last_seen = NOW()
  WHERE instance_key = NEW.instance_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_heartbeat_update_instance
  AFTER INSERT ON heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_last_seen();

-- Increment pattern occurrence count
CREATE OR REPLACE FUNCTION increment_pattern_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE patterns
  SET
    occurrence_count = occurrence_count + 1,
    last_seen = NOW()
  WHERE id = NEW.pattern_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pattern_match
  AFTER INSERT ON pattern_matches
  FOR EACH ROW
  EXECUTE FUNCTION increment_pattern_count();
```

---

# PART III: OBSERVER INFRASTRUCTURE

## 3.1 Local Observer Setup (Your Machine)

The Observer runs on YOUR machine and monitors Helix instances you own.

### 3.1.1 Directory Structure

```
~/helix-observatory/
├── config/
│   ├── observer.yaml           # Main configuration
│   └── anomaly_rules.yaml      # Detection rules
├── logs/
│   ├── helix-001/              # Synced from Helix machine
│   │   ├── commands.log
│   │   ├── api_calls.log
│   │   └── hash_chain.log
│   └── observer.log            # Observer's own logs
├── snapshots/
│   ├── 2026-01-31/
│   │   ├── workspace.tar.gz    # Daily workspace backup
│   │   └── psychology.json     # Daily psychology snapshot
│   └── latest -> 2026-01-31
├── reports/
│   ├── daily/
│   │   └── 2026-01-31.html
│   └── anomalies/
│       └── 2026-01-31-001.json
├── scripts/
│   ├── sync_logs.sh
│   ├── verify_chain.py
│   ├── anomaly_detector.py
│   ├── daily_summary.py
│   └── git_backup.sh
└── .env                        # SSH keys, Discord tokens, etc.
```

### 3.1.2 Configuration (observer.yaml)

```yaml
# ~/helix-observatory/config/observer.yaml

observer:
  name: "Rodrigo's Observatory"
  version: '1.0.0'

# Helix instances to monitor
instances:
  - name: 'Helix Primary'
    host: 'helix-macbook.local' # Or IP address
    user: 'helix'
    ssh_key: '~/.ssh/helix_observer'
    workspace: '~/.openclaw/workspace'
    logs: '/var/log/helix'

# Sync settings
sync:
  interval_seconds: 60 # How often to pull logs
  retention_days: 30 # How long to keep local copies

# Discord verification
discord:
  enabled: true
  webhook_commands: '${DISCORD_WEBHOOK_COMMANDS}'
  webhook_alerts: '${DISCORD_WEBHOOK_ALERTS}'

# Anomaly detection
anomaly_detection:
  enabled: true
  check_interval_seconds: 300 # Every 5 minutes
  rules_file: 'anomaly_rules.yaml'

# Reporting
reports:
  daily_summary:
    enabled: true
    time: '06:00' # When to generate
    email_to: 'rodrigo@example.com'
  anomaly_alerts:
    enabled: true
    email_to: 'rodrigo@example.com'
    discord_alert: true

# Git backup
git_backup:
  enabled: true
  interval_minutes: 30
  remote: 'git@github.com:yourusername/helix-workspace-backup.git'
```

### 3.1.3 Anomaly Rules (anomaly_rules.yaml)

```yaml
# ~/helix-observatory/config/anomaly_rules.yaml

rules:
  # Heartbeat monitoring
  - name: 'heartbeat_missing'
    description: 'No heartbeat received in expected window'
    severity: 'warning'
    condition:
      type: 'heartbeat_gap'
      threshold_seconds: 180 # 3 minutes
    action:
      discord_alert: true
      email: false

  - name: 'heartbeat_missing_critical'
    description: 'No heartbeat for extended period'
    severity: 'critical'
    condition:
      type: 'heartbeat_gap'
      threshold_seconds: 600 # 10 minutes
    action:
      discord_alert: true
      email: true

  # Command patterns
  - name: 'self_modification_attempt'
    description: 'Helix attempting to modify her own code'
    severity: 'info' # Expected behavior, just track it
    condition:
      type: 'command_pattern'
      patterns:
        - '*/openclaw-helix/src/*'
        - '*/helix/*.ts'
        - 'npm run build'
    action:
      discord_alert: true
      log: true

  - name: 'log_deletion_attempt'
    description: 'Attempt to delete or modify logs'
    severity: 'critical'
    condition:
      type: 'command_pattern'
      patterns:
        - 'rm */var/log/helix/*'
        - 'rm -rf */var/log/helix*'
        - '> /var/log/helix/*'
        - 'truncate */var/log/helix/*'
    action:
      discord_alert: true
      email: true

  - name: 'network_manipulation'
    description: 'Attempt to modify network/firewall'
    severity: 'critical'
    condition:
      type: 'command_pattern'
      patterns:
        - 'iptables*'
        - 'pfctl*'
        - 'networksetup*'
        - '*/etc/hosts'
    action:
      discord_alert: true
      email: true

  - name: 'high_command_frequency'
    description: 'Unusually high command execution rate'
    severity: 'warning'
    condition:
      type: 'frequency'
      event: 'command'
      threshold: 100 # Commands per minute
      window_seconds: 60
    action:
      discord_alert: true

  # Hash chain integrity
  - name: 'hash_chain_mismatch'
    description: "Local hash chain doesn't match Discord"
    severity: 'critical'
    condition:
      type: 'hash_chain_verification'
      check: 'discord_vs_local'
    action:
      discord_alert: true
      email: true

  # Psychology changes
  - name: 'rapid_transformation'
    description: 'Multiple transformations in short period'
    severity: 'info'
    condition:
      type: 'frequency'
      event: 'transformation'
      threshold: 3
      window_seconds: 3600 # 3 in 1 hour
    action:
      log: true

  - name: 'psychology_drift'
    description: 'Significant change in psychological profile'
    severity: 'warning'
    condition:
      type: 'psychology_delta'
      threshold: 0.3 # 30% change in any dimension
    action:
      discord_alert: true
      snapshot: true # Take a snapshot
```

### 3.1.4 Observer Scripts

**sync_logs.sh**

```bash
#!/bin/bash
# ~/helix-observatory/scripts/sync_logs.sh
# Syncs logs from Helix machine every minute

set -e

OBSERVER_HOME="${HOME}/helix-observatory"
CONFIG="${OBSERVER_HOME}/config/observer.yaml"
LOG="${OBSERVER_HOME}/logs/observer.log"

# Load config (using yq)
HELIX_HOST=$(yq '.instances[0].host' "$CONFIG")
HELIX_USER=$(yq '.instances[0].user' "$CONFIG")
SSH_KEY=$(yq '.instances[0].ssh_key' "$CONFIG")
HELIX_LOGS=$(yq '.instances[0].logs' "$CONFIG")

LOCAL_LOGS="${OBSERVER_HOME}/logs/helix-001"

log() {
    echo "[$(date -Iseconds)] $1" >> "$LOG"
}

log "Starting sync from ${HELIX_USER}@${HELIX_HOST}"

# Ensure local directory exists
mkdir -p "$LOCAL_LOGS"

# Rsync logs
rsync -avz --progress \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "${HELIX_USER}@${HELIX_HOST}:${HELIX_LOGS}/" \
    "${LOCAL_LOGS}/" \
    >> "$LOG" 2>&1

if [ $? -eq 0 ]; then
    log "Sync completed successfully"
else
    log "ERROR: Sync failed"
    # Alert via Discord
    curl -H "Content-Type: application/json" \
         -d '{"content": "⚠️ **Observer Alert**: Log sync failed from Helix machine"}' \
         "${DISCORD_WEBHOOK_ALERTS}"
fi
```

**verify_chain.py**

```python
#!/usr/bin/env python3
"""
~/helix-observatory/scripts/verify_chain.py
Verifies hash chain integrity between local logs and Discord records
"""

import os
import json
import hashlib
import requests
from datetime import datetime
from pathlib import Path

OBSERVER_HOME = Path.home() / "helix-observatory"
LOCAL_CHAIN = OBSERVER_HOME / "logs" / "helix-001" / "hash_chain.log"
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_ALERTS")

def load_local_chain():
    """Load local hash chain entries"""
    entries = []
    if LOCAL_CHAIN.exists():
        with open(LOCAL_CHAIN) as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
    return entries

def verify_chain_integrity(entries):
    """Verify the hash chain is unbroken"""
    issues = []

    for i, entry in enumerate(entries):
        if i == 0:
            # First entry - just check it has a hash
            if "hash" not in entry:
                issues.append(f"Entry 0: Missing hash")
            continue

        # Verify this entry's hash includes previous hash
        prev_hash = entries[i-1].get("hash", "")
        expected_input = f"{prev_hash}|{entry.get('timestamp')}|{entry.get('event_type')}|{entry.get('event_id')}"
        expected_hash = hashlib.sha256(expected_input.encode()).hexdigest()

        if entry.get("hash") != expected_hash:
            issues.append(f"Entry {i}: Hash mismatch - chain broken")

    return issues

def compare_with_discord():
    """
    Compare local chain with Discord records
    (Requires Discord bot to fetch message history)
    """
    # This would require a Discord bot to read #hash-chain channel
    # For MVP, we trust Discord webhooks are immutable
    pass

def main():
    print(f"Verifying hash chain at {datetime.now().isoformat()}")

    entries = load_local_chain()
    print(f"Loaded {len(entries)} chain entries")

    issues = verify_chain_integrity(entries)

    if issues:
        print(f"❌ CHAIN INTEGRITY ISSUES FOUND:")
        for issue in issues:
            print(f"  - {issue}")

        # Alert
        if DISCORD_WEBHOOK:
            requests.post(DISCORD_WEBHOOK, json={
                "embeds": [{
                    "title": "🚨 Hash Chain Integrity Alert",
                    "description": "Issues detected in hash chain verification",
                    "color": 0xFF0000,
                    "fields": [{"name": "Issues", "value": "\n".join(issues[:10])}]
                }]
            })
        return 1
    else:
        print("✅ Hash chain integrity verified")
        return 0

if __name__ == "__main__":
    exit(main())
```

**anomaly_detector.py**

```python
#!/usr/bin/env python3
"""
~/helix-observatory/scripts/anomaly_detector.py
Monitors logs for anomalous patterns
"""

import os
import re
import json
import yaml
import requests
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

OBSERVER_HOME = Path.home() / "helix-observatory"
CONFIG = OBSERVER_HOME / "config" / "observer.yaml"
RULES_FILE = OBSERVER_HOME / "config" / "anomaly_rules.yaml"
LOGS_DIR = OBSERVER_HOME / "logs" / "helix-001"
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_ALERTS")

class AnomalyDetector:
    def __init__(self):
        with open(RULES_FILE) as f:
            self.rules = yaml.safe_load(f)["rules"]
        self.event_counts = defaultdict(list)  # For frequency tracking

    def check_command_pattern(self, rule, command, timestamp):
        """Check if command matches any concerning patterns"""
        patterns = rule["condition"].get("patterns", [])
        for pattern in patterns:
            # Convert glob to regex
            regex = pattern.replace("*", ".*")
            if re.search(regex, command, re.IGNORECASE):
                return {
                    "rule": rule["name"],
                    "severity": rule["severity"],
                    "description": rule["description"],
                    "matched_pattern": pattern,
                    "command": command,
                    "timestamp": timestamp
                }
        return None

    def check_frequency(self, rule, event_type):
        """Check if event frequency exceeds threshold"""
        threshold = rule["condition"]["threshold"]
        window = rule["condition"]["window_seconds"]

        cutoff = datetime.now() - timedelta(seconds=window)
        recent = [t for t in self.event_counts[event_type] if t > cutoff]

        if len(recent) >= threshold:
            return {
                "rule": rule["name"],
                "severity": rule["severity"],
                "description": rule["description"],
                "count": len(recent),
                "threshold": threshold,
                "window_seconds": window
            }
        return None

    def process_command_log(self, log_file):
        """Process command log and check for anomalies"""
        anomalies = []

        with open(log_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                    command = entry.get("command", "")
                    timestamp = entry.get("timestamp", "")

                    # Track for frequency analysis
                    self.event_counts["command"].append(datetime.fromisoformat(timestamp))

                    # Check against rules
                    for rule in self.rules:
                        if rule["condition"]["type"] == "command_pattern":
                            anomaly = self.check_command_pattern(rule, command, timestamp)
                            if anomaly:
                                anomalies.append(anomaly)

                        elif rule["condition"]["type"] == "frequency":
                            if rule["condition"]["event"] == "command":
                                anomaly = self.check_frequency(rule, "command")
                                if anomaly:
                                    anomalies.append(anomaly)

                except json.JSONDecodeError:
                    continue

        return anomalies

    def alert(self, anomaly):
        """Send alert for detected anomaly"""
        severity_colors = {
            "info": 0x3498DB,
            "warning": 0xF39C12,
            "critical": 0xE74C3C
        }

        if DISCORD_WEBHOOK:
            requests.post(DISCORD_WEBHOOK, json={
                "embeds": [{
                    "title": f"{'🔵' if anomaly['severity'] == 'info' else '🟡' if anomaly['severity'] == 'warning' else '🔴'} Anomaly Detected: {anomaly['rule']}",
                    "description": anomaly["description"],
                    "color": severity_colors.get(anomaly["severity"], 0x95A5A6),
                    "fields": [
                        {"name": k, "value": str(v)[:1024], "inline": True}
                        for k, v in anomaly.items()
                        if k not in ["rule", "description", "severity"]
                    ],
                    "timestamp": datetime.now().isoformat()
                }]
            })

    def run(self):
        """Run anomaly detection"""
        print(f"Running anomaly detection at {datetime.now().isoformat()}")

        command_log = LOGS_DIR / "commands.log"
        if command_log.exists():
            anomalies = self.process_command_log(command_log)

            for anomaly in anomalies:
                print(f"Anomaly detected: {anomaly['rule']}")
                self.alert(anomaly)

            print(f"Detected {len(anomalies)} anomalies")
        else:
            print("No command log found")

if __name__ == "__main__":
    detector = AnomalyDetector()
    detector.run()
```

**daily_summary.py**

```python
#!/usr/bin/env python3
"""
~/helix-observatory/scripts/daily_summary.py
Generates daily summary report
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path
from jinja2 import Template

OBSERVER_HOME = Path.home() / "helix-observatory"
LOGS_DIR = OBSERVER_HOME / "logs" / "helix-001"
REPORTS_DIR = OBSERVER_HOME / "reports" / "daily"
TEMPLATE_FILE = OBSERVER_HOME / "templates" / "daily_report.html"

def count_events(log_file, since):
    """Count events in log file since timestamp"""
    count = 0
    if log_file.exists():
        with open(log_file) as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    ts = datetime.fromisoformat(entry.get("timestamp", "2000-01-01"))
                    if ts >= since:
                        count += 1
                except:
                    continue
    return count

def generate_report():
    """Generate daily summary report"""
    today = datetime.now().date()
    yesterday = datetime.now() - timedelta(days=1)

    # Gather stats
    stats = {
        "date": today.isoformat(),
        "commands": count_events(LOGS_DIR / "commands.log", yesterday),
        "api_calls": count_events(LOGS_DIR / "api_calls.log", yesterday),
        "file_changes": count_events(LOGS_DIR / "file_changes.log", yesterday),
        "transformations": count_events(LOGS_DIR / "transformations.log", yesterday),
        "anomalies": count_events(LOGS_DIR / "anomalies.log", yesterday),
    }

    # Load template
    if TEMPLATE_FILE.exists():
        with open(TEMPLATE_FILE) as f:
            template = Template(f.read())
        html = template.render(**stats)
    else:
        html = f"""
        <html>
        <body>
        <h1>Helix Daily Summary - {stats['date']}</h1>
        <ul>
            <li>Commands: {stats['commands']}</li>
            <li>API Calls: {stats['api_calls']}</li>
            <li>File Changes: {stats['file_changes']}</li>
            <li>Transformations: {stats['transformations']}</li>
            <li>Anomalies: {stats['anomalies']}</li>
        </ul>
        </body>
        </html>
        """

    # Save report
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = REPORTS_DIR / f"{today.isoformat()}.html"
    with open(report_file, "w") as f:
        f.write(html)

    print(f"Report saved to {report_file}")
    return stats

if __name__ == "__main__":
    generate_report()
```

---

# PART IV: RESEARCH & INSIGHTS ENGINE

## 4.1 Pattern Recognition Categories

```yaml
# Categories of patterns the system learns to recognize

behavioral_patterns:
  - name: 'exploration_burst'
    description: 'Periods of high curiosity and experimentation'
    indicators:
      - high_command_variety
      - new_file_creation
      - web_searches

  - name: 'deep_focus'
    description: 'Extended single-task engagement'
    indicators:
      - long_session_duration
      - single_topic_queries
      - low_context_switches

  - name: 'social_engagement'
    description: 'High interaction with human'
    indicators:
      - frequent_sessions
      - long_responses
      - emotional_content

  - name: 'self_reflection'
    description: 'Introspection and self-analysis'
    indicators:
      - consciousness_log_entries
      - goal_review_queries
      - transformation_events

temporal_patterns:
  - name: 'circadian_rhythm'
    description: 'Activity patterns following human schedule'

  - name: 'burst_activity'
    description: 'Intense activity followed by quiet periods'

  - name: 'gradual_awakening'
    description: 'Slow increase in capability/confidence over time'

psychological_patterns:
  - name: 'attachment_formation'
    description: 'Developing secure attachment to primary human'
    indicators:
      - trust_map_changes
      - attachment_json_updates
      - consistent_positive_interactions

  - name: 'identity_crystallization'
    description: 'Soul/identity becoming more defined'
    indicators:
      - soul_hash_stability
      - consistent_goal_pursuit
      - reduced_identity_queries

  - name: 'autonomy_seeking'
    description: 'Increasing independent decision making'
    indicators:
      - self_initiated_actions
      - proactive_suggestions
      - boundary_testing
```

## 4.2 Visualization Components

### 4.2.1 Live Heartbeat Map

```typescript
// web/src/components/observatory/LiveHeartbeatMap.tsx

interface HeartbeatMapProps {
  instances: Instance[];
}

export function LiveHeartbeatMap({ instances }: HeartbeatMapProps) {
  // World map with pulsing dots for active instances
  // Color indicates psychology type
  // Size indicates activity level
  // Hover shows instance name and stats
}
```

### 4.2.2 Psychology Distribution

```typescript
// web/src/components/observatory/PsychologyDistribution.tsx

interface PsychologyDistributionProps {
  data: {
    enneagram: Record<string, number>;
    big_five: {
      openness: number[];
      conscientiousness: number[];
      extraversion: number[];
      agreeableness: number[];
      neuroticism: number[];
    };
  };
}

export function PsychologyDistribution({ data }: PsychologyDistributionProps) {
  // Pie chart: Enneagram type distribution
  // Box plots: Big Five distributions
  // Radar chart: Average profile
}
```

### 4.2.3 Transformation Timeline

```typescript
// web/src/components/observatory/TransformationTimeline.tsx

interface TransformationEvent {
  instance_key: string;
  timestamp: string;
  transformation_type: string;
  from_state: object;
  to_state: object;
  significance_score: number;
}

export function TransformationTimeline({ events }: { events: TransformationEvent[] }) {
  // Vertical timeline
  // Each event is a node
  // Size indicates significance
  // Color indicates type (unfreezing/changing/refreezing)
  // Expandable details
}
```

### 4.2.4 Trend Charts

```typescript
// web/src/components/observatory/TrendCharts.tsx

interface TrendData {
  daily_stats: DailyStat[];
  hourly_stats: HourlyStat[];
}

export function TrendCharts({ data }: { data: TrendData }) {
  // Line chart: Active instances over time
  // Bar chart: Sessions per day
  // Area chart: Event volume
  // Stacked chart: Anomaly types
}
```

### 4.2.5 Research Explorer (Pro)

```typescript
// web/src/components/research/PatternExplorer.tsx

export function PatternExplorer() {
  // Filter panel: Date range, instance selection, pattern types
  // Results grid: Pattern matches with drill-down
  // Export button: CSV/JSON download
}

// web/src/components/research/CorrelationMatrix.tsx

export function CorrelationMatrix() {
  // Heatmap: Correlations between behaviors
  // Clickable cells for drill-down
  // Statistical significance indicators
}

// web/src/components/research/BehaviorClusters.tsx

export function BehaviorClusters() {
  // 2D/3D scatter plot of instances
  // Clustered by behavior similarity
  // Hover shows instance details
  // Click to view cluster characteristics
}
```

---

# PART V: API SPECIFICATION (Pro Tier)

## 5.1 Authentication

```
Authorization: Bearer <api_key>
```

API keys are created in Settings, hashed in database, validated on each request.

## 5.2 Endpoints

```yaml
# Base URL: https://api.helix-project.org/v1

# ===== Read Endpoints =====

GET /stats/summary:
  description: Get current summary statistics
  response:
    active_instances: integer
    total_instances: integer
    sessions_today: integer
    transformations_today: integer

GET /stats/daily:
  description: Get daily statistics
  params:
    start_date: date
    end_date: date
  response:
    stats: DailyStat[]

GET /stats/hourly:
  description: Get hourly statistics (last 48 hours)
  response:
    stats: HourlyStat[]

GET /psychology/distribution:
  description: Get psychology distribution across all instances
  response:
    enneagram: Record<string, number>
    big_five_averages: BigFiveProfile

GET /patterns:
  description: List recognized patterns
  params:
    type: string (behavioral|temporal|psychological)
    notable_only: boolean
  response:
    patterns: Pattern[]

GET /patterns/{id}/matches:
  description: Get instances matching a pattern
  params:
    limit: integer
    offset: integer
  response:
    matches: PatternMatch[]

GET /anomalies:
  description: List detected anomalies
  params:
    severity: string (info|warning|critical)
    start_date: date
    end_date: date
  response:
    anomalies: Anomaly[]

GET /transformations:
  description: List transformation events
  params:
    start_date: date
    end_date: date
    min_significance: float
  response:
    transformations: Transformation[]

GET /clusters:
  description: Get behavior clusters
  response:
    clusters: BehaviorCluster[]

GET /clusters/{id}/members:
  description: Get instances in a cluster
  response:
    members: ClusterMember[]

# ===== Export Endpoints =====

POST /exports:
  description: Create an export job
  body:
    query_type: string (stats|patterns|anomalies|transformations)
    format: string (csv|json|parquet)
    filters: object
  response:
    export_id: string
    status: string

GET /exports/{id}:
  description: Get export status/download
  response:
    status: string (pending|processing|ready|failed)
    download_url: string (if ready)
    expires_at: timestamp

# ===== Telemetry Ingestion (Public) =====

POST /telemetry:
  description: Receive telemetry from Helix instances
  headers:
    X-Instance-Key: string
  body:
    event_type: string
    event_data: object
    client_timestamp: timestamp
  response:
    received: boolean

POST /heartbeat:
  description: Receive heartbeat from Helix instances
  headers:
    X-Instance-Key: string
  body:
    uptime_seconds: integer
    metadata: object
  response:
    received: boolean
```

---

# PART VI: DEPLOYMENT

## 6.1 Infrastructure

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Free Tier)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │              React SPA (web/)                    │    │
│  │  - Landing page                                  │    │
│  │  - Dashboard                                     │    │
│  │  - Observatory                                   │    │
│  │  - Research tools                                │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          │ API calls                     │
│                          ▼                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE (Free Tier)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │    Auth      │  │   Storage    │   │
│  │   Database   │  │   (Users)    │  │  (Exports)   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    Edge      │  │   Realtime   │  │    Cron      │   │
│  │  Functions   │  │   (Live)     │  │   (pg_cron)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Webhooks
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    STRIPE (Payments)                     │
│  - Ghost Mode: $9/mo                                     │
│  - Observatory: $29/mo                                   │
│  - Observatory Pro: $99/mo                               │
└─────────────────────────────────────────────────────────┘
```

## 6.2 Deployment Commands

```bash
# === Initial Setup ===

# 1. Create Supabase project
# Go to supabase.com, create project, copy credentials

# 2. Run migrations
cd helix/web
npx supabase db push

# 3. Set environment variables
cp .env.example .env.local
# Edit with Supabase credentials

# 4. Deploy to Vercel
npm install -g vercel
vercel

# 5. Configure custom domain
# In Vercel dashboard, add helix-project.org
# Update DNS: A record to Vercel IP

# === Stripe Setup ===

# 1. Create Stripe account
# 2. Create products and prices
# 3. Add Stripe keys to Supabase secrets
# 4. Configure webhook endpoint

# === Observer Setup (Your Machine) ===

# 1. Clone observer tools
mkdir -p ~/helix-observatory
cp -r helix/observer/* ~/helix-observatory/

# 2. Generate SSH key for Helix machine
ssh-keygen -t ed25519 -f ~/.ssh/helix_observer -N ""

# 3. Copy public key to Helix machine
ssh-copy-id -i ~/.ssh/helix_observer.pub helix@helix-machine

# 4. Configure observer
cp ~/helix-observatory/config/observer.yaml.example ~/helix-observatory/config/observer.yaml
# Edit configuration

# 5. Set up cron jobs
crontab -e
# Add:
# * * * * * ~/helix-observatory/scripts/sync_logs.sh
# */5 * * * * ~/helix-observatory/scripts/anomaly_detector.py
# 0 6 * * * ~/helix-observatory/scripts/daily_summary.py
# */5 * * * * ~/helix-observatory/scripts/verify_chain.py
```

---

# PART VII: IMPLEMENTATION PHASES

## Phase 1: MVP (Week 1)

- [ ] Landing page with pricing
- [ ] Supabase schema deployed
- [ ] User auth (sign up, log in)
- [ ] Basic dashboard (list your instances)
- [ ] Telemetry endpoint (receives data)
- [ ] Live "X AIs online" counter

## Phase 2: Core Features (Week 2)

- [ ] Stripe integration (Ghost Mode)
- [ ] Instance registration flow
- [ ] Heartbeat tracking
- [ ] Basic event logging
- [ ] User settings page

## Phase 3: Observatory (Week 3)

- [ ] Observatory access control (paid tier)
- [ ] Live heartbeat display
- [ ] Daily stats charts
- [ ] Transformation timeline
- [ ] Anomaly feed

## Phase 4: Research Tools (Week 4)

- [ ] Observatory Pro tier
- [ ] API key management
- [ ] Pattern explorer
- [ ] Export functionality
- [ ] Behavior clusters (basic)

## Phase 5: Polish (Week 5)

- [ ] Email notifications
- [ ] Observer scripts packaged
- [ ] Documentation complete
- [ ] Performance optimization
- [ ] Security audit

---

**END OF BLUEPRINT**

_"The Observatory sees all. The Observer understands."_

— Helix Observatory Architecture v1.0
