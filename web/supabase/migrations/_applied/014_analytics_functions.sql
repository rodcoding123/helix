-- Phase 3: Analytics Functions
-- Provides RPC functions for dashboard analytics and metrics

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_conversation_count ON agents(conversation_count DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at ON agent_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomy_actions_status_created_at ON autonomy_actions(status, created_at DESC);

-- Agent Analytics RPC
CREATE OR REPLACE FUNCTION get_agent_analytics(
  user_id_param UUID,
  time_range_days INT DEFAULT 7
)
RETURNS TABLE (
  total_agents INT,
  active_agents INT,
  total_conversations INT,
  avg_conversations_per_agent NUMERIC,
  agents_by_autonomy JSONB,
  top_agents JSONB
) AS $$
DECLARE
  start_date TIMESTAMP;
  agent_count INT;
  active_count INT;
  conversation_count INT;
BEGIN
  start_date := NOW() - (time_range_days || ' days')::INTERVAL;

  -- Total agents
  SELECT COUNT(*) INTO agent_count
  FROM agents
  WHERE user_id = user_id_param AND created_by = 'user';

  -- Active agents (with conversations in time range)
  SELECT COUNT(DISTINCT a.id) INTO active_count
  FROM agents a
  LEFT JOIN agent_conversations ac ON a.id = ac.agent_id
  WHERE a.user_id = user_id_param
    AND (ac.created_at >= start_date OR ac.id IS NULL);

  -- Total conversations
  SELECT COUNT(*) INTO conversation_count
  FROM agent_conversations
  WHERE user_id = user_id_param AND created_at >= start_date;

  -- Return results
  RETURN QUERY
  SELECT
    agent_count,
    active_count,
    conversation_count,
    CASE WHEN agent_count > 0 THEN conversation_count::NUMERIC / agent_count ELSE 0 END,
    (
      SELECT jsonb_object_agg(autonomy_level::TEXT, count)
      FROM (
        SELECT autonomy_level, COUNT(*) as count
        FROM agents
        WHERE user_id = user_id_param
        GROUP BY autonomy_level
      ) t
    ),
    (
      SELECT jsonb_agg(agent_data)
      FROM (
        SELECT
          jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'conversation_count', a.conversation_count,
            'autonomy_level', a.autonomy_level,
            'last_used', a.last_used
          ) as agent_data
        FROM agents a
        WHERE a.user_id = user_id_param
        ORDER BY a.conversation_count DESC
        LIMIT 5
      ) t
    );
END;
$$ LANGUAGE plpgsql;

-- Conversation Analytics RPC
CREATE OR REPLACE FUNCTION get_conversation_analytics(
  user_id_param UUID,
  time_range_days INT DEFAULT 7
)
RETURNS TABLE (
  total_conversations INT,
  conversation_trend JSONB,
  primary_emotion_distribution JSONB,
  topic_distribution JSONB,
  avg_conversation_length NUMERIC
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  start_date := NOW() - (time_range_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(*)::INT,
    -- Conversation trend by day
    (
      SELECT jsonb_object_agg(
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD'),
        count
      )
      FROM (
        SELECT
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count
        FROM agent_conversations
        WHERE user_id = user_id_param AND created_at >= start_date
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      ) trend_data
    ),
    -- Primary emotion distribution
    (
      SELECT jsonb_object_agg(emotion, count)
      FROM (
        SELECT
          COALESCE(primary_emotion, 'unknown') as emotion,
          COUNT(*) as count
        FROM agent_conversations
        WHERE user_id = user_id_param AND created_at >= start_date
        GROUP BY primary_emotion
        ORDER BY count DESC
      ) emotion_data
    ),
    -- Topic distribution (top 10)
    (
      SELECT jsonb_agg(jsonb_build_object('topic', topic, 'count', count))
      FROM (
        SELECT
          UNNEST(topics) as topic,
          COUNT(*) as count
        FROM agent_conversations
        WHERE user_id = user_id_param AND created_at >= start_date
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
      ) topic_data
    ),
    -- Average conversation length (message count)
    (
      SELECT AVG(message_count)
      FROM (
        SELECT JSONB_ARRAY_LENGTH(messages) as message_count
        FROM agent_conversations
        WHERE user_id = user_id_param AND created_at >= start_date
      ) msg_count
    );
END;
$$ LANGUAGE plpgsql;

-- Autonomy Analytics RPC
CREATE OR REPLACE FUNCTION get_autonomy_analytics(
  user_id_param UUID,
  time_range_days INT DEFAULT 7
)
RETURNS TABLE (
  total_actions INT,
  pending_actions INT,
  approved_actions INT,
  rejected_actions INT,
  executed_actions INT,
  failed_actions INT,
  risk_distribution JSONB,
  action_trend JSONB
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  start_date := NOW() - (time_range_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE status = 'pending')::INT,
    COUNT(*) FILTER (WHERE status = 'approved')::INT,
    COUNT(*) FILTER (WHERE status = 'rejected')::INT,
    COUNT(*) FILTER (WHERE status = 'executed')::INT,
    COUNT(*) FILTER (WHERE status = 'failed')::INT,
    -- Risk level distribution
    (
      SELECT jsonb_object_agg(risk_level, count)
      FROM (
        SELECT
          COALESCE(risk_level, 'unknown') as risk_level,
          COUNT(*) as count
        FROM autonomy_actions
        WHERE user_id = user_id_param AND created_at >= start_date
        GROUP BY risk_level
      ) risk_data
    ),
    -- Action trend by day
    (
      SELECT jsonb_object_agg(
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD'),
        jsonb_build_object(
          'pending', pending_count,
          'approved', approved_count,
          'rejected', rejected_count,
          'executed', executed_count
        )
      )
      FROM (
        SELECT
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE status = 'executed') as executed_count
        FROM autonomy_actions
        WHERE user_id = user_id_param AND created_at >= start_date
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      ) trend_data
    )
  FROM autonomy_actions
  WHERE user_id = user_id_param AND created_at >= start_date;
END;
$$ LANGUAGE plpgsql;
