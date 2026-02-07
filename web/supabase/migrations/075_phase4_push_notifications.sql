-- Phase 4: Push Notifications Schema
-- Date: 2026-02-06
--
-- Implements push notification infrastructure for iOS (APNs) and Android (FCM)

BEGIN;

-- ============================================================================
-- Push Notification Devices
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_notification_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_token TEXT NOT NULL, -- APNs or FCM token

  -- Device status
  is_enabled BOOLEAN DEFAULT TRUE,
  last_token_refresh_at TIMESTAMPTZ,

  -- Device metadata
  device_name TEXT,
  os_version TEXT,
  app_version TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_device_token UNIQUE (user_id, device_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_notification_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_platform ON push_notification_devices(platform);
CREATE INDEX IF NOT EXISTS idx_push_devices_enabled ON push_notification_devices(is_enabled);
CREATE INDEX IF NOT EXISTS idx_push_devices_updated ON push_notification_devices(updated_at DESC);

-- RLS: Users manage their own devices
ALTER TABLE push_notification_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_devices_user_policy ON push_notification_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Notification Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Global push notification settings
  enable_push BOOLEAN DEFAULT TRUE,
  enable_sound BOOLEAN DEFAULT TRUE,
  enable_badge BOOLEAN DEFAULT TRUE,

  -- Quiet hours (24-hour format HH:mm)
  quiet_hours_start TEXT, -- e.g., "22:00"
  quiet_hours_end TEXT,   -- e.g., "08:00"

  -- Notification types
  notify_on TEXT[] DEFAULT ARRAY['message'], -- 'message', 'mention', 'thread_reply'

  -- Advanced preferences
  max_notifications_per_hour INTEGER DEFAULT 20,
  group_similar_notifications BOOLEAN DEFAULT TRUE,
  show_preview BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notify_prefs_user ON notification_preferences(user_id);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auth_user_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- RLS: Users manage their own preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notify_prefs_user_policy ON notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Push Notification History
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',

  -- Platform
  platform TEXT CHECK (platform IN ('ios', 'android')),

  -- Delivery status
  sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'read')),

  -- Context
  conversation_id TEXT,
  message_id TEXT,
  trigger_type TEXT DEFAULT 'message' CHECK (trigger_type IN ('message', 'mention', 'thread_reply', 'system')),

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  CONSTRAINT has_context CHECK (conversation_id IS NOT NULL OR message_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON push_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON push_notifications(read_at DESC) WHERE read_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_conversation ON push_notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_trigger ON push_notifications(trigger_type);

-- RLS: Users view their own notifications
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_user_policy ON push_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_read ON push_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Push Notification Analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Aggregated metrics
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  dismissed_count INTEGER DEFAULT 0,

  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Average metrics
  avg_delivery_time_ms INTEGER,
  avg_time_to_read_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_period UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON notification_analytics(period_start, period_end);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Register or update device token
CREATE OR REPLACE FUNCTION register_push_device(
  user_id_param UUID,
  device_id_param TEXT,
  platform_param TEXT,
  device_token_param TEXT,
  metadata_param JSONB DEFAULT '{}'
)
RETURNS push_notification_devices AS $$
DECLARE
  device push_notification_devices;
BEGIN
  INSERT INTO push_notification_devices (
    user_id,
    device_id,
    platform,
    device_token,
    metadata,
    is_enabled
  ) VALUES (
    user_id_param,
    device_id_param,
    platform_param,
    device_token_param,
    metadata_param,
    TRUE
  )
  ON CONFLICT (user_id, device_id, platform)
  DO UPDATE SET
    device_token = device_token_param,
    metadata = metadata_param,
    is_enabled = TRUE,
    last_token_refresh_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO device;

  RETURN device;
END;
$$ LANGUAGE plpgsql;

-- Unregister device
CREATE OR REPLACE FUNCTION unregister_push_device(
  user_id_param UUID,
  device_id_param TEXT,
  platform_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_notification_devices
  WHERE user_id = user_id_param
    AND device_id = device_id_param
    AND platform = platform_param;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get enabled devices for user
CREATE OR REPLACE FUNCTION get_enabled_devices(user_id_param UUID)
RETURNS TABLE (
  device_id TEXT,
  platform TEXT,
  device_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pnd.device_id,
    pnd.platform,
    pnd.device_token
  FROM push_notification_devices pnd
  WHERE pnd.user_id = user_id_param
    AND pnd.is_enabled = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_notifications
  SET
    read_at = NOW(),
    delivery_status = 'read'
  WHERE id = notification_id_param
    AND read_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get notification stats for user
CREATE OR REPLACE FUNCTION get_notification_stats(user_id_param UUID)
RETURNS TABLE (
  total_sent INTEGER,
  unread_count INTEGER,
  today_count INTEGER,
  this_week_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_sent,
    COUNT(*) FILTER (WHERE read_at IS NULL)::INTEGER as unread_count,
    COUNT(*) FILTER (WHERE DATE(sent_at) = CURRENT_DATE)::INTEGER as today_count,
    COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days')::INTEGER as this_week_count
  FROM push_notifications
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Update Timestamps
-- ============================================================================

CREATE TRIGGER push_devices_updated_at
  BEFORE UPDATE ON push_notification_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
