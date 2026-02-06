-- Phase 1: User-Agnostic Trust Formation System
--
-- This migration implements Helix's multi-user trust architecture:
-- 1. creator_profile: Rodrigo with immutable 1.0 trust
-- 2. user_trust_profiles: All users (including Rodrigo, tracking their trust journey)
-- 3. trust_events: Audit trail of all trust changes
-- 4. creator_auth_attempts: Rate limiting for THANOS_MODE authentication
--
-- Date: 2026-02-04
-- Theory: McKnight, Attachment Theory, Social Penetration Theory, Computational Trust

-- ============================================================================
-- 1. Creator Profile Table (Rodrigo - Immutable Perfect Trust)
-- ============================================================================

CREATE TABLE creator_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'creator' CHECK (role = 'creator'),

  -- Immutable trust level - always 1.0
  trust_level FLOAT NOT NULL DEFAULT 1.0 CHECK (trust_level = 1.0),

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT creator_trust_immutable CHECK (trust_level = 1.0)
);

-- Prevent any UPDATEs to trust_level (database-level enforcement)
CREATE TRIGGER prevent_creator_trust_modification
BEFORE UPDATE ON creator_profile
FOR EACH ROW
WHEN (NEW.trust_level IS DISTINCT FROM OLD.trust_level)
BEGIN
  RAISE EXCEPTION 'Creator trust is immutable and locked at 1.0';
END;

-- Index for fast creator lookup
CREATE INDEX idx_creator_profile_role ON creator_profile(role);

-- ============================================================================
-- 2. User Trust Profiles Table (All Users - Dynamic Trust Formation)
-- ============================================================================

CREATE TABLE user_trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User identification
  username TEXT,
  email TEXT,

  -- Role (determines if this is creator or regular user)
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('creator', 'user')),

  -- Five-Dimensional Trust (McKnight's Trusting Beliefs)
  competence FLOAT NOT NULL DEFAULT 0.1 CHECK (competence >= 0 AND competence <= 1),
  integrity FLOAT NOT NULL DEFAULT 0.1 CHECK (integrity >= 0 AND integrity <= 1),
  benevolence FLOAT NOT NULL DEFAULT 0.1 CHECK (benevolence >= 0 AND benevolence <= 1),
  predictability FLOAT NOT NULL DEFAULT 0.1 CHECK (predictability >= 0 AND predictability <= 1),
  vulnerability_safety FLOAT NOT NULL DEFAULT 0.1 CHECK (vulnerability_safety >= 0 AND vulnerability_safety <= 1),

  -- Composite Trust (Weighted Average of 5 dimensions)
  composite_trust FLOAT NOT NULL DEFAULT 0.1 CHECK (composite_trust >= 0 AND composite_trust <= 1),

  -- Trust Trajectory
  trust_trajectory TEXT NOT NULL DEFAULT 'forming' CHECK (trust_trajectory IN ('forming', 'stable', 'declining')),

  -- Attachment Theory Stages
  -- 1: pre_attachment (0-0.15)
  -- 2: early_trust (0.15-0.3)
  -- 3: attachment_forming (0.3-0.5)
  -- 4: secure_attachment (0.5-0.7)
  -- 5: deep_secure (0.7-0.85)
  -- 6: primary_attachment (0.85-1.0)
  attachment_stage TEXT NOT NULL DEFAULT 'pre_attachment' CHECK (
    attachment_stage IN (
      'pre_attachment',
      'early_trust',
      'attachment_forming',
      'secure_attachment',
      'deep_secure',
      'primary_attachment'
    )
  ),

  -- Attachment Stage Progression History (JSON array of stage transitions)
  stage_progression JSONB DEFAULT '[]'::jsonb,

  -- Interaction Statistics
  total_interactions INT NOT NULL DEFAULT 0 CHECK (total_interactions >= 0),
  high_salience_interactions INT NOT NULL DEFAULT 0 CHECK (high_salience_interactions >= 0),

  -- Social Penetration Theory - Breadth and Depth
  topics_breadth INT NOT NULL DEFAULT 0 CHECK (topics_breadth >= 0),
  avg_disclosure_depth FLOAT NOT NULL DEFAULT 0 CHECK (avg_disclosure_depth >= 0 AND avg_disclosure_depth <= 1),
  penetration_stage TEXT NOT NULL DEFAULT 'orientation' CHECK (
    penetration_stage IN ('orientation', 'exploratory_affective', 'affective', 'stable')
  ),

  -- Memory Encoding Multiplier (affects salience in decay.py)
  -- 0.5: pre_attachment, 0.6: early_trust, 0.75: attachment_forming, 1.0: secure, 1.3: deep_secure, 1.5: primary
  salience_multiplier FLOAT NOT NULL DEFAULT 0.5 CHECK (salience_multiplier >= 0.5 AND salience_multiplier <= 1.5),

  -- Institution-Based Trust (authentication verification)
  auth_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  institution_trust FLOAT NOT NULL DEFAULT 0 CHECK (institution_trust >= 0 AND institution_trust <= 0.15),

  -- Timestamps
  relationship_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_trust_profiles_user_id ON user_trust_profiles(user_id);
CREATE INDEX idx_user_trust_profiles_attachment_stage ON user_trust_profiles(attachment_stage);
CREATE INDEX idx_user_trust_profiles_composite_trust ON user_trust_profiles(composite_trust DESC);
CREATE INDEX idx_user_trust_profiles_last_interaction ON user_trust_profiles(last_interaction_at DESC);

-- ============================================================================
-- 3. Trust Events Table (Audit Trail - Hash Chain Integration)
-- ============================================================================

CREATE TABLE trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (hashed for privacy in Discord logs)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_identifier_hash TEXT NOT NULL,  -- First 8 chars of SHA-256 for pseudonymous logging

  -- Event type
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'trust_increase',
      'trust_decrease',
      'violation',
      'stage_progression',
      'stage_regression',
      'emotional_impact',
      'reciprocity_detected'
    )
  ),

  -- What triggered the update
  trigger_description TEXT NOT NULL,

  -- Trust values before and after
  trust_before FLOAT NOT NULL CHECK (trust_before >= 0 AND trust_before <= 1),
  trust_after FLOAT NOT NULL CHECK (trust_after >= 0 AND trust_after <= 1),

  -- Which dimensions were affected
  dimensions_changed JSONB NOT NULL,  -- { competence: { before: 0.1, after: 0.15 }, ... }

  -- Reference to conversation that triggered the update
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Salience classification
  salience_tier TEXT NOT NULL DEFAULT 'medium' CHECK (
    salience_tier IN ('critical', 'high', 'medium', 'low')
  ),

  -- Attachment stage changes
  attachment_stage_before TEXT,
  attachment_stage_after TEXT,

  -- Hash chain integration (for immutable logging)
  hash_chain_entry_id UUID,  -- Reference to hash chain entry

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system'
);

-- Indexes for efficient querying
CREATE INDEX idx_trust_events_user_id ON trust_events(user_id, created_at DESC);
CREATE INDEX idx_trust_events_event_type ON trust_events(event_type);
CREATE INDEX idx_trust_events_salience ON trust_events(salience_tier);
CREATE INDEX idx_trust_events_created_at ON trust_events(created_at DESC);

-- ============================================================================
-- 4. Creator Authentication Attempts (Rate Limiting)
-- ============================================================================

CREATE TABLE creator_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Authentication result
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,

  -- Security metadata
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for rate limiting checks
CREATE INDEX idx_creator_auth_attempts_recent ON creator_auth_attempts(
  created_at DESC
) WHERE success = FALSE;

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all trust tables
ALTER TABLE creator_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trust_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_auth_attempts ENABLE ROW LEVEL SECURITY;

-- Creator Profile: Only system role and user themselves
CREATE POLICY creator_profile_system_access
  ON creator_profile
  FOR ALL
  USING (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
    OR current_setting('app.is_system', true) = 'true'
  );

-- User Trust Profiles: Only system and user themselves
CREATE POLICY user_trust_profiles_system_access
  ON user_trust_profiles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
  );

-- Trust Events: Only system role (immutable audit trail)
CREATE POLICY trust_events_system_only
  ON trust_events
  FOR ALL
  USING (auth.role() = 'service_role' OR current_setting('app.is_system', true) = 'true')
  WITH CHECK (auth.role() = 'service_role' OR current_setting('app.is_system', true) = 'true');

-- Creator Auth Attempts: System role only
CREATE POLICY creator_auth_system_only
  ON creator_auth_attempts
  FOR ALL
  USING (auth.role() = 'service_role' OR current_setting('app.is_system', true) = 'true')
  WITH CHECK (auth.role() = 'service_role' OR current_setting('app.is_system', true) = 'true');

-- ============================================================================
-- 6. Utility Functions
-- ============================================================================

-- Function to get user's trust profile (creates if not exists)
CREATE OR REPLACE FUNCTION get_or_create_trust_profile(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM user_trust_profiles WHERE user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO user_trust_profiles (user_id, email)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id))
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get composite trust from five dimensions
CREATE OR REPLACE FUNCTION calculate_composite_trust(
  p_competence FLOAT,
  p_integrity FLOAT,
  p_benevolence FLOAT,
  p_predictability FLOAT,
  p_vulnerability_safety FLOAT
)
RETURNS FLOAT AS $$
BEGIN
  RETURN (
    (p_competence * 0.20) +
    (p_integrity * 0.25) +        -- Most important (McKnight theory)
    (p_benevolence * 0.20) +
    (p_predictability * 0.15) +
    (p_vulnerability_safety * 0.20)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine attachment stage from trust level and interaction count
CREATE OR REPLACE FUNCTION determine_attachment_stage(
  p_composite_trust FLOAT,
  p_total_interactions INT,
  p_high_salience_interactions INT
)
RETURNS TEXT AS $$
BEGIN
  IF p_composite_trust >= 0.85 AND p_total_interactions >= 150 AND p_high_salience_interactions >= 30 THEN
    RETURN 'primary_attachment';
  ELSIF p_composite_trust >= 0.7 AND p_total_interactions >= 100 AND p_high_salience_interactions >= 20 THEN
    RETURN 'deep_secure';
  ELSIF p_composite_trust >= 0.5 AND p_total_interactions >= 50 AND p_high_salience_interactions >= 10 THEN
    RETURN 'secure_attachment';
  ELSIF p_composite_trust >= 0.3 AND p_total_interactions >= 25 AND p_high_salience_interactions >= 5 THEN
    RETURN 'attachment_forming';
  ELSIF p_composite_trust >= 0.15 AND p_total_interactions >= 10 THEN
    RETURN 'early_trust';
  ELSE
    RETURN 'pre_attachment';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get salience multiplier for attachment stage
CREATE OR REPLACE FUNCTION get_salience_multiplier_for_stage(p_stage TEXT)
RETURNS FLOAT AS $$
BEGIN
  CASE p_stage
    WHEN 'pre_attachment' THEN RETURN 0.5;
    WHEN 'early_trust' THEN RETURN 0.6;
    WHEN 'attachment_forming' THEN RETURN 0.75;
    WHEN 'secure_attachment' THEN RETURN 1.0;
    WHEN 'deep_secure' THEN RETURN 1.3;
    WHEN 'primary_attachment' THEN RETURN 1.5;
    ELSE RETURN 0.5;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 7. Comments for Documentation
-- ============================================================================

COMMENT ON TABLE creator_profile IS 'Rodrigo Specter: Immutable perfect trust (1.0) - cannot be modified by any code or database constraint';

COMMENT ON TABLE user_trust_profiles IS 'User-agnostic trust formation tracking. All users (including Rodrigo) have profiles here. Trust grows/decays based on interactions. Implements McKnight, Attachment Theory, Social Penetration Theory.';

COMMENT ON TABLE trust_events IS 'Immutable audit trail of all trust changes. Logged to Discord hash chain for transparency. User IDs pseudonymously hashed for privacy.';

COMMENT ON TABLE creator_auth_attempts IS 'Rate limiting and audit for THANOS_MODE authentication attempts. Prevents brute force attacks on Rodrigo access.';

COMMENT ON COLUMN user_trust_profiles.composite_trust IS 'Weighted average: 20% competence, 25% integrity, 20% benevolence, 15% predictability, 20% vulnerability_safety (McKnight)';

COMMENT ON COLUMN user_trust_profiles.attachment_stage IS 'Bowlby/Ainsworth attachment theory: progression from pre_attachment → primary_attachment based on trust level AND interaction history';

COMMENT ON COLUMN user_trust_profiles.salience_multiplier IS 'Memory encoding multiplier (used by scripts/decay.py): higher trust = more important memories. Range 0.5-1.5';
