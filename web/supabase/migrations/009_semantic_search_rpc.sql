-- Create semantic search RPC function for pgvector similarity search
-- This function performs efficient cosine similarity search on conversation embeddings

CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(768),
  user_id_param uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  instance_key text,
  messages jsonb,
  primary_emotion text,
  secondary_emotions text[],
  valence float,
  arousal float,
  dominance float,
  novelty float,
  self_relevance float,
  emotional_salience float,
  salience_tier text,
  extracted_topics text[],
  embedding vector,
  decay_multiplier float,
  user_marked_important boolean,
  is_deleted boolean,
  attachment_context text,
  prospective_self_context text,
  created_at timestamp,
  updated_at timestamp,
  similarity float
) AS $$
SELECT
  c.id,
  c.user_id,
  c.instance_key,
  c.messages,
  c.primary_emotion,
  c.secondary_emotions,
  c.valence,
  c.arousal,
  c.dominance,
  c.novelty,
  c.self_relevance,
  c.emotional_salience,
  c.salience_tier,
  c.extracted_topics,
  c.embedding,
  c.decay_multiplier,
  c.user_marked_important,
  c.is_deleted,
  c.attachment_context,
  c.prospective_self_context,
  c.created_at,
  c.updated_at,
  1 - (c.embedding <=> query_embedding) AS similarity
FROM conversations c
WHERE c.user_id = user_id_param AND c.is_deleted = false
ORDER BY c.embedding <=> query_embedding
LIMIT match_count;
$$ LANGUAGE sql;

-- Create index for improved performance on semantic search
-- ivfflat index with cosine distance for fast approximate searches
CREATE INDEX IF NOT EXISTS idx_conversations_embedding_cosine
ON conversations
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
