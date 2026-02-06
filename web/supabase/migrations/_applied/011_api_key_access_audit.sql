-- Complete audit trail of all secret access

CREATE TABLE IF NOT EXISTS api_key_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_id UUID NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,

  -- Access details
  action VARCHAR(20) NOT NULL, -- 'read', 'create', 'update', 'rotate', 'delete'
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Context
  context VARCHAR(500), -- Why was the key accessed? (e.g., "embedding_generation")
  ip_address INET,
  user_agent VARCHAR(255),

  -- Status
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Compliance
  source VARCHAR(50) NOT NULL, -- 'api', 'web-ui', 'cli', 'scheduled-rotation'

  CONSTRAINT valid_action CHECK (action IN ('read', 'create', 'update', 'rotate', 'delete', 'list'))
);

-- Indexes for audit queries
CREATE INDEX idx_api_key_audit_user_id ON api_key_access_audit(user_id);
CREATE INDEX idx_api_key_audit_secret_id ON api_key_access_audit(secret_id);
CREATE INDEX idx_api_key_audit_accessed_at ON api_key_access_audit(accessed_at);
CREATE INDEX idx_api_key_audit_action ON api_key_access_audit(action);

-- Enable RLS for audit
ALTER TABLE api_key_access_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON api_key_access_audit FOR SELECT
  USING (auth.uid() = user_id);

-- Prevent direct modification of audit logs (they're immutable)
CREATE POLICY "Audit logs cannot be modified"
  ON api_key_access_audit FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON api_key_access_audit FOR DELETE
  USING (false);
