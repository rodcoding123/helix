-- Phase 3: Custom Tools System
-- Enables users to create custom tools through UI with sandbox execution

CREATE TABLE custom_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tool Definition
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters JSONB NOT NULL,        -- JSON Schema for tool parameters
  code TEXT NOT NULL,               -- JavaScript function body

  -- Security
  signature TEXT,                   -- Ed25519 signature (optional for user tools)
  capabilities TEXT[],              -- ['filesystem:read', 'network:localhost', etc.]
  sandbox_profile TEXT DEFAULT 'standard' CHECK (sandbox_profile IN ('strict', 'standard', 'permissive')),

  -- Metadata
  version TEXT DEFAULT '1.0.0',
  tags TEXT[],
  icon TEXT,                        -- Emoji or icon identifier
  usage_count INT DEFAULT 0,
  last_used TIMESTAMP,
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Template/Sharing
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  clone_source_id UUID REFERENCES custom_tools(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_custom_tools_user_id ON custom_tools(user_id);
CREATE INDEX idx_custom_tools_visibility ON custom_tools(visibility);
CREATE INDEX idx_custom_tools_enabled ON custom_tools(is_enabled);

ALTER TABLE custom_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_tools_user_access ON custom_tools FOR ALL USING (auth.uid() = user_id);
CREATE POLICY custom_tools_public_read ON custom_tools FOR SELECT USING (visibility = 'public');

-- Tool Usage Log
CREATE TABLE custom_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_tool_id UUID NOT NULL REFERENCES custom_tools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution Details
  input_params JSONB,
  output_result JSONB,
  status TEXT CHECK (status IN ('success', 'failure', 'timeout')),
  error_message TEXT,

  -- Metrics
  execution_time_ms INT,
  memory_used_mb INT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tool_usage_tool_id ON custom_tool_usage(custom_tool_id);
CREATE INDEX idx_tool_usage_user_id ON custom_tool_usage(user_id);
CREATE INDEX idx_tool_usage_timestamp ON custom_tool_usage(timestamp DESC);

ALTER TABLE custom_tool_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_usage_user_access ON custom_tool_usage FOR ALL USING (auth.uid() = user_id);
