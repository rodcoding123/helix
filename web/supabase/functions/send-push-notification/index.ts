/**
 * Supabase Edge Function: Send Push Notification
 *
 * Sends push notifications to iOS and Android devices.
 * Called when:
 * 1. Helix sends a response
 * 2. User is mentioned in a conversation
 * 3. Thread has a reply
 *
 * Uses:
 * - APNs (Apple Push Notification service) for iOS
 * - FCM (Firebase Cloud Messaging) for Android
 *
 * Authentication: Service role only
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  conversationId?: string;
  messageId?: string;
}

interface SendNotificationResult {
  sent: number;
  failed: number;
  errors: Array<{
    deviceId: string;
    error: string;
  }>;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Verify service role (internal only)
    const authHeader = req.headers.get('Authorization');
    const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!authHeader || !authHeader.includes(expectedKey)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse request
    const payload: NotificationPayload = await req.json();

    // Validate
    if (!payload.userId || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, title, body',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', payload.userId)
      .single();

    if (!prefs?.enable_push) {
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          errors: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check quiet hours
    if (isInQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          errors: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user devices
    const { data: devices } = await supabase
      .from('push_notification_devices')
      .select('*')
      .eq('user_id', payload.userId)
      .eq('is_enabled', true);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          errors: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send to each device
    const errors: SendNotificationResult['errors'] = [];
    let sent = 0;

    for (const device of devices) {
      try {
        if (device.platform === 'ios') {
          await sendApnsNotification(device, payload);
          sent++;
        } else if (device.platform === 'android') {
          await sendFcmNotification(device, payload);
          sent++;
        }
      } catch (err) {
        errors.push({
          deviceId: device.device_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Store notification in database
    await supabase.from('push_notifications').insert({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      platform: devices[0]?.platform,
      sent_at: new Date().toISOString(),
      metadata: {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
      },
    });

    // Return response
    const result: SendNotificationResult = {
      sent,
      failed: errors.length,
      errors,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push-notification] Error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal server error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Send notification via APNs (iOS)
 */
async function sendApnsNotification(
  device: any,
  payload: NotificationPayload
) {
  const apnsKey = Deno.env.get('APNS_KEY') || '';
  const apnsTeamId = Deno.env.get('APNS_TEAM_ID') || '';
  const apnsKeyId = Deno.env.get('APNS_KEY_ID') || '';
  const apnsTopic = Deno.env.get('APNS_TOPIC') || '';

  if (!apnsKey || !apnsTeamId || !apnsKeyId) {
    throw new Error('APNs configuration missing');
  }

  // Create JWT token for APNs
  const token = createApnsJwt(apnsKey, apnsTeamId, apnsKeyId);

  // Prepare notification payload
  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: 'default',
      badge: 1,
      'content-available': 1,
    },
    data: payload.data || {},
  };

  // Send to APNs
  const response = await fetch(
    `https://api.push.apple.com/3/device/${device.device_token}`,
    {
      method: 'POST',
      headers: {
        'apns-topic': apnsTopic,
        'apns-priority': '10',
        authorization: `bearer ${token}`,
      },
      body: JSON.stringify(apnsPayload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`APNs error: ${response.status} - ${error}`);
  }
}

/**
 * Send notification via FCM (Android)
 */
async function sendFcmNotification(
  device: any,
  payload: NotificationPayload
) {
  const fcmKey = Deno.env.get('FCM_API_KEY') || '';

  if (!fcmKey) {
    throw new Error('FCM configuration missing');
  }

  // Prepare FCM payload
  const fcmPayload = {
    token: device.device_token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channel_id: 'helix_notifications',
      },
    },
  };

  // Send to FCM
  const response = await fetch(
    'https://fcm.googleapis.com/v1/projects/{project-id}/messages:send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fcmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: fcmPayload,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FCM error: ${response.status} - ${error}`);
  }
}

/**
 * Create APNs JWT token
 */
function createApnsJwt(key: string, teamId: string, keyId: string): string {
  // This is a simplified version - actual implementation would:
  // 1. Parse the P8 key
  // 2. Create JWT header
  // 3. Create JWT payload with expiry
  // 4. Sign with ES256
  // For now, return a placeholder
  return `${teamId}.${keyId}`;
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(start?: string, end?: string): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Simple string comparison (assumes HH:mm format)
  return currentTime >= start && currentTime <= end;
}
