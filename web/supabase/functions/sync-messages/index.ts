/**
 * Supabase Edge Function: Sync Messages
 *
 * Handles offline message queue synchronization.
 * Called by mobile/desktop apps to:
 * 1. Submit pending messages
 * 2. Mark messages as synced
 * 3. Retrieve latest message state
 *
 * Authentication: Required (verified JWT)
 * Rate Limit: 100 req/min per user
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  corsJsonResponse,
  corsErrorResponse,
  handleCorsPreflightRequest,
} from '../_shared/cors.ts';

interface SyncMessagePayload {
  deviceId: string;
  platform: 'web' | 'desktop' | 'ios' | 'android' | 'cli';
  messages: Array<{
    clientId?: string;
    content: string;
    sessionKey: string;
    role: 'user' | 'assistant' | 'system';
  }>;
}

interface SyncResponse {
  synced: number;
  failed: number;
  errors: Array<{
    clientId?: string;
    error: string;
  }>;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['x-device-id', 'x-platform']);
  }

  if (req.method !== 'POST') {
    return corsErrorResponse(req, 'Method not allowed', 405);
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsErrorResponse(req, 'Missing authorization header', 401);
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return corsErrorResponse(req, 'Invalid token', 401);
    }

    // Parse request body
    const payload: SyncMessagePayload = await req.json();

    // Validate payload
    if (!payload.messages || !Array.isArray(payload.messages)) {
      return corsErrorResponse(req, 'Invalid payload: messages required', 400);
    }

    if (!payload.deviceId || !payload.platform) {
      return corsErrorResponse(req, 'Invalid payload: deviceId and platform required', 400);
    }

    // Update device last seen
    await supabase
      .from('offline_queue_status')
      .upsert(
        {
          user_id: user.id,
          device_id: payload.deviceId,
          platform: payload.platform,
          is_online: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id,platform' }
      );

    // Process each message
    const errors: SyncResponse['errors'] = [];
    let synced = 0;

    for (const msg of payload.messages) {
      try {
        // Check for duplicate using client_id (idempotency)
        if (msg.clientId) {
          const existing = await supabase
            .from('session_messages')
            .select('id')
            .eq('client_id', msg.clientId)
            .eq('session_id', msg.sessionKey)
            .single();

          if (existing.data) {
            synced++;
            continue; // Skip duplicate
          }
        }

        // Insert message
        const { error } = await supabase.from('session_messages').insert({
          session_id: msg.sessionKey,
          role: msg.role,
          content: msg.content,
          client_id: msg.clientId,
          platform: payload.platform,
          device_id: payload.deviceId,
          is_pending: false,
          synced_at: new Date().toISOString(),
        });

        if (error) {
          errors.push({
            clientId: msg.clientId,
            error: error.message,
          });
        } else {
          synced++;
        }

        // Trigger synthesis for user messages (async, fire-and-forget)
        if (msg.role === 'user') {
          synthesizeMessage(supabaseUrl, supabaseKey, {
            userId: user.id,
            sessionKey: msg.sessionKey,
            content: msg.content,
          }).catch((err) =>
            console.error('[sync-messages] Synthesis error:', err)
          );
        }
      } catch (err) {
        errors.push({
          clientId: msg.clientId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Log sync event
    await supabase.from('offline_sync_log').insert({
      user_id: user.id,
      device_id: payload.deviceId,
      platform: payload.platform,
      event_type: errors.length === 0 ? 'sync_success' : 'sync_partial',
      message_count: payload.messages.length,
      synced_count: synced,
      failed_count: errors.length,
      duration_ms: Date.now(),
    });

    // Return response
    const response: SyncResponse = {
      synced,
      failed: errors.length,
      errors,
    };

    return corsJsonResponse(req, response, 200);
  } catch (err) {
    console.error('[sync-messages] Error:', err);
    return corsErrorResponse(
      req,
      err instanceof Error ? err.message : 'Internal server error',
      500
    );
  }
});

/**
 * Trigger message synthesis (async)
 */
async function synthesizeMessage(
  supabaseUrl: string,
  supabaseKey: string,
  params: {
    userId: string;
    sessionKey: string;
    content: string;
  }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create synthesis job
    await supabase.from('synthesis_jobs').insert({
      user_id: params.userId,
      session_key: params.sessionKey,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    console.log('[synthesize-message] Job queued:', params.userId);
  } catch (err) {
    console.error('[synthesize-message] Error:', err);
  }
}
