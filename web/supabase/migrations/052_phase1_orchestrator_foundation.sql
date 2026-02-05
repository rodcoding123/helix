/**
 * Phase 1 Module 12: Orchestrator Foundation
 *
 * Establishes database foundation for Phase 2 Lingxi-style orchestrator.
 * Prepares schema for state management, checkpointing, and job tracking.
 *
 * **Design Principle**:
 * Phase 1 provides: Multi-device execution via RemoteCommandExecutor
 * Phase 2 builds on: Orchestrator routing between specialized agents
 *
 * **Tables Created**:
 * - agent_jobs: Jobs submitted to orchestrator
 * - orchestrator_state: State snapshots for checkpointing
 * - orchestrator_checkpoints: Full execution traces for replay/debugging
 * - supervisor_routing_log: Routing decisions (audit trail)
 * - agent_collaborations: Inter-agent coordination records
 *
 * **Security**:
 * - All tables use user-scoped RLS
 * - Checkpoints immutable after creation
 * - Routing decisions logged for audit
 */

-- ============================================================================
-- Agent Jobs (Orchestrator Task Queue)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and context
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Job metadata
  job_type TEXT NOT NULL DEFAULT 'generic'
    CHECK (job_type IN (
      'generic',           -- Generic task
      'narrative_analysis', -- Layer 1 analysis
      'memory_synthesis',   -- Layers 2-3
      'purpose_alignment',  -- Layer 7
      'action_execution'    -- Direct execution
    )),

  -- Job input
  input_prompt TEXT NOT NULL,
  input_context JSONB,

  -- Job state
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'routing', 'executing', 'completed', 'failed')),

  -- Priority for job queue
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Execution budget (for model selection)
  budget_cents BIGINT DEFAULT 100, -- Default $1.00
  budget_remaining_cents BIGINT,

  -- Results
  output JSONB,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX agent_jobs_user_idx ON agent_jobs(user_id, created_at DESC);
CREATE INDEX agent_jobs_status_idx ON agent_jobs(status);
CREATE INDEX agent_jobs_priority_idx ON agent_jobs(priority DESC) WHERE status = 'pending';
CREATE INDEX agent_jobs_session_idx ON agent_jobs(session_id, created_at DESC);

-- ============================================================================
-- Orchestrator State Snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestrator_state (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_jobs(job_id) ON DELETE CASCADE,

  -- State at specific point in execution
  current_agent TEXT NOT NULL,
  messages JSONB NOT NULL, -- Array of messages processed so far
  context JSONB, -- Shared context across agents

  -- Metadata
  sequence_number INTEGER NOT NULL,
  checkpoint_hash TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX orchestrator_state_job_idx ON orchestrator_state(job_id, sequence_number DESC);

-- ============================================================================
-- Orchestrator Checkpoints (Full Execution Traces)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestrator_checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to job
  job_id UUID NOT NULL REFERENCES agent_jobs(job_id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL, -- For multi-threaded execution

  -- Checkpoint hierarchy (for resumption)
  parent_checkpoint_id UUID REFERENCES orchestrator_checkpoints(checkpoint_id),

  -- Complete state snapshot (for replay)
  state JSONB NOT NULL,

  -- Metadata
  checkpoint_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (checkpoint_type IN ('standard', 'error_recovery', 'manual')),

  -- Hash chain integration
  hash TEXT NOT NULL,
  previous_hash TEXT,

  -- Audit info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'orchestrator',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX orchestrator_checkpoints_job_idx ON orchestrator_checkpoints(job_id);
CREATE INDEX orchestrator_checkpoints_thread_idx ON orchestrator_checkpoints(thread_id, created_at DESC);

-- ============================================================================
-- Supervisor Routing Log (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supervisor_routing_log (
  routing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_jobs(job_id) ON DELETE CASCADE,

  -- Routing decision
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,

  -- Decision reasoning
  routing_reason TEXT,
  task_analysis JSONB,

  -- Cost impact
  estimated_cost_cents INTEGER,

  -- Audit metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decision_hash TEXT
);

CREATE INDEX supervisor_routing_log_job_idx ON supervisor_routing_log(job_id);
CREATE INDEX supervisor_routing_log_agent_idx ON supervisor_routing_log(from_agent, to_agent);

-- ============================================================================
-- Agent Collaborations (Inter-Agent Coordination)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaborations (
  collaboration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_jobs(job_id) ON DELETE CASCADE,

  -- Agents involved
  requesting_agent TEXT NOT NULL,
  supporting_agent TEXT NOT NULL,

  -- Request/Response
  request_type TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX agent_collaborations_job_idx ON agent_collaborations(job_id);
CREATE INDEX agent_collaborations_agents_idx ON agent_collaborations(requesting_agent, supporting_agent);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_routing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_collaborations ENABLE ROW LEVEL SECURITY;

-- Users can view own jobs
CREATE POLICY "Users can view own jobs"
  ON agent_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create jobs"
  ON agent_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own states"
  ON orchestrator_state FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM agent_jobs WHERE agent_jobs.job_id = orchestrator_state.job_id AND agent_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can view own checkpoints"
  ON orchestrator_checkpoints FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM agent_jobs WHERE agent_jobs.job_id = orchestrator_checkpoints.job_id AND agent_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can view own routing logs"
  ON supervisor_routing_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM agent_jobs WHERE agent_jobs.job_id = supervisor_routing_log.job_id AND agent_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can view own collaborations"
  ON agent_collaborations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM agent_jobs WHERE agent_jobs.job_id = agent_collaborations.job_id AND agent_jobs.user_id = auth.uid())
  );

-- ============================================================================
-- Real-Time Subscriptions (for live dashboards)
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE agent_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE orchestrator_checkpoints;
ALTER PUBLICATION supabase_realtime ADD TABLE supervisor_routing_log;

-- ============================================================================
-- Helpful Views
-- ============================================================================

-- Job progress view
CREATE OR REPLACE VIEW job_progress AS
SELECT
  j.job_id,
  j.job_type,
  j.status,
  j.priority,
  (j.budget_cents - j.budget_remaining_cents) AS cost_cents,
  j.budget_cents AS total_budget_cents,
  ROUND(100.0 * (j.budget_cents - j.budget_remaining_cents) / j.budget_cents, 2) AS cost_percentage,
  j.created_at,
  j.started_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(j.completed_at, NOW()) - j.created_at)) AS elapsed_seconds
FROM agent_jobs j;

-- Routing statistics
CREATE OR REPLACE VIEW routing_statistics AS
SELECT
  from_agent,
  to_agent,
  COUNT(*) as routing_count,
  AVG((routing_log.routing_log).estimated_cost_cents) as avg_cost_cents,
  MAX(routing_log.timestamp) as last_used
FROM supervisor_routing_log routing_log
GROUP BY from_agent, to_agent;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_jobs IS
'Orchestrator jobs submitted by users. Foundation for Phase 2 TRAE orchestrator.';

COMMENT ON TABLE orchestrator_checkpoints IS
'Full execution traces for replay, debugging, and resumption. Hash chain integrated.';

COMMENT ON TABLE supervisor_routing_log IS
'Immutable routing decisions by supervisor agent for audit and analysis.';

COMMENT ON COLUMN agent_jobs.budget_cents IS
'Cost budget in cents. Orchestrator respects this for model selection and approval thresholds.';

COMMENT ON COLUMN orchestrator_checkpoints.hash IS
'SHA256 hash linked to hash chain for tamper-proof verification.';
