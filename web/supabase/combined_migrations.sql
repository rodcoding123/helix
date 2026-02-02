CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_key TEXT,
  messages JSONB NOT NULL,

  -- Emotional analysis
  primary_emotion TEXT,
  secondary_emotions TEXT[],
  valence FLOAT, arousal FLOAT, dominance FLOAT, novelty FLOAT, self_relevance FLOAT,
  emotional_salience FLOAT,
  salience_tier TEXT CHECK (salience_tier IN ('critical', 'high', 'medium', 'low')),

  -- Topics
  extracted_topics TEXT[],

  -- Embedding
  embedding vector(768),

  -- Memory management
  decay_multiplier FLOAT DEFAULT 1.0,
  user_marked_important BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  attachment_context TEXT,
  prospective_self_context TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_salience ON conversations(emotional_salience DESC);
CREATE INDEX idx_conversations_embedding ON conversations USING ivfflat (embedding vector_cosine_ops);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_user_access ON conversations FOR ALL USING (auth.uid() = user_id);
