-- Phase 2/3: Agents and Autonomy System Tables

-- Agents table (with personality dimensions)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,

  -- Psychology (Layer 1 + 4)
  narrative JSONB,
  goals TEXT[],
  scope TEXT,

  -- Autonomy
  autonomy_level INT DEFAULT 0 CHECK (autonomy_level IN (0, 1, 2, 3)),
  created_by TEXT DEFAULT 'system' CHECK (created_by IN ('system', 'user')),
  enabled BOOLEAN DEFAULT TRUE,

  -- Personality state (5 dimensions: 0-1 scale)
  personality JSONB DEFAULT '{
    "verbosity": 0.5,
    "formality": 0.5,
    "creativity": 0.5,
    "proactivity": 0.5,
    "warmth": 0.5
  }'::jsonb,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  conversation_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_enabled ON agents(enabled);
CREATE INDEX idx_agents_created_by ON agents(created_by);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY agents_user_access ON agents FOR ALL USING (auth.uid() = user_id);

-- Agent Conversations table
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation data
  messages JSONB NOT NULL,
  primary_emotion TEXT,
  secondary_emotions TEXT[],
  emotional_dimensions JSONB,
  topics TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_conversations_agent_id ON agent_conversations(agent_id);
CREATE INDEX idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_created_at ON agent_conversations(created_at DESC);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_conversations_user_access ON agent_conversations FOR ALL USING (auth.uid() = user_id);

-- Agent Proposals table (for Helix agent creation proposals)
CREATE TABLE agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Proposal details
  proposed_name TEXT NOT NULL,
  proposed_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  detected_pattern JSONB,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_created')),

  -- Resolution
  agent_id UUID REFERENCES agents(id),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_proposals_user_id ON agent_proposals(user_id);
CREATE INDEX idx_agent_proposals_status ON agent_proposals(status);

ALTER TABLE agent_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_proposals_user_access ON agent_proposals FOR ALL USING (auth.uid() = user_id);

-- Autonomy Settings table
CREATE TABLE autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Helix autonomy level (0-3)
  helix_autonomy_level INT DEFAULT 0 CHECK (helix_autonomy_level IN (0, 1, 2, 3)),

  -- Feature toggles
  auto_agent_creation BOOLEAN DEFAULT TRUE,
  agent_proposals_require_approval BOOLEAN DEFAULT TRUE,
  discord_approval_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE autonomy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomy_settings_user_access ON autonomy_settings FOR ALL USING (auth.uid() = user_id);

-- Autonomy Actions table (for approval workflow)
CREATE TABLE autonomy_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),

  -- Action details
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  approval_method TEXT,

  -- Discord logging
  discord_message_id TEXT,
  discord_channel TEXT,

  -- Execution
  executed_at TIMESTAMP,
  result JSONB,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autonomy_actions_user_id ON autonomy_actions(user_id);
CREATE INDEX idx_autonomy_actions_status ON autonomy_actions(status);
CREATE INDEX idx_autonomy_actions_created_at ON autonomy_actions(created_at DESC);

ALTER TABLE autonomy_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomy_actions_user_access ON autonomy_actions FOR ALL USING (auth.uid() = user_id);
