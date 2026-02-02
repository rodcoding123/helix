-- Code Modification Proposals table
-- Tracks code changes proposed by Helix for review and approval

CREATE TABLE code_modification_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES autonomy_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File and change details
  file_path TEXT NOT NULL,
  proposed_code TEXT NOT NULL,
  reason TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),

  -- Review metadata
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  merge_commit_id TEXT,
  merged_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_code_proposals_action_id ON code_modification_proposals(action_id);
CREATE INDEX idx_code_proposals_user_id ON code_modification_proposals(user_id);
CREATE INDEX idx_code_proposals_status ON code_modification_proposals(status);
CREATE INDEX idx_code_proposals_file_path ON code_modification_proposals(file_path);

ALTER TABLE code_modification_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY code_proposals_user_access ON code_modification_proposals
  FOR ALL USING (auth.uid() = user_id);
