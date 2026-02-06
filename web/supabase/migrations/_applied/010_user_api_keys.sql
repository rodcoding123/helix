-- User-provided API keys with encryption metadata

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Secret identification
  key_name VARCHAR(100) NOT NULL,
  secret_type VARCHAR(50) NOT NULL,

  -- Encryption metadata
  encrypted_value TEXT NOT NULL,
  derivation_salt VARCHAR(32), -- PBKDF2 salt (hex) for user-provided keys
  encryption_method VARCHAR(20) NOT NULL DEFAULT 'aes-256-gcm',
  key_version INT NOT NULL DEFAULT 1,

  -- Source and lifecycle
  source_type VARCHAR(20) NOT NULL, -- 'user-provided', 'system-managed', 'user-local'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, key_name, key_version),
  CONSTRAINT valid_secret_type CHECK (secret_type IN (
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE',
    'DEEPSEEK_API_KEY',
    'GEMINI_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'DISCORD_WEBHOOK'
  )),
  CONSTRAINT valid_source_type CHECK (source_type IN (
    'user-provided',
    'system-managed',
    'user-local',
    'one-password'
  )),
  CONSTRAINT valid_encryption CHECK (encryption_method IN (
    'aes-256-gcm',
    'plaintext'
  ))
);

-- Indexes for fast queries
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_secret_type ON user_api_keys(secret_type);
CREATE INDEX idx_user_api_keys_is_active ON user_api_keys(is_active);
CREATE INDEX idx_user_api_keys_expires_at ON user_api_keys(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own secrets
CREATE POLICY "Users can view their own secrets"
  ON user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own secrets
CREATE POLICY "Users can create their own secrets"
  ON user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own secrets
CREATE POLICY "Users can update their own secrets"
  ON user_api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own secrets
CREATE POLICY "Users can delete their own secrets"
  ON user_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_api_keys_updated_at
BEFORE UPDATE ON user_api_keys
FOR EACH ROW
EXECUTE FUNCTION update_user_api_keys_updated_at();
