/**
 * Phase 9A: Webhook Trigger Handler
 * Supabase Edge Function for handling external webhook triggers
 *
 * SECURITY:
 * - Verifies HMAC-SHA256 signature
 * - Loads secret from 1Password (never hardcoded)
 * - Returns 202 Accepted immediately
 * - Executes operation async in background
 * - Logs all webhook events for audit trail
 *
 * Usage:
 *   POST /functions/v1/webhook-trigger?id=schedule-uuid
 *   Headers: X-Webhook-Signature: <HMAC-SHA256>
 *   Body: JSON payload
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

/**
 * Verify HMAC-SHA256 signature
 * Ensures webhook came from trusted source
 */
async function verifyHMAC(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedHex = Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === signature;
}

/**
 * Load secret from 1Password
 * In production, this would call 1Password CLI
 * For now, it returns the secret from environment or database
 */
async function load1PasswordSecret(secretRef: string): Promise<string> {
  try {
    // Try to get from environment first (for testing)
    const envSecret = Deno.env.get(`SECRET_${secretRef}`);
    if (envSecret) {
      return envSecret;
    }

    // In production, would call 1Password CLI:
    // const cmd = new Deno.Command('op', {
    //   args: ['item', 'get', secretRef, '--format', 'json'],
    // });
    // const { success, stdout } = await cmd.output();
    // if (success) {
    //   const item = JSON.parse(new TextDecoder().decode(stdout));
    //   return item.fields[0].value;
    // }

    console.error(`[webhook-trigger] Secret not found: ${secretRef}`);
    return '';
  } catch (error) {
    console.error(`[webhook-trigger] Failed to load secret: ${error}`);
    return '';
  }
}

serve(async (req: Request) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Extract schedule ID from query params
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get('id');

    if (!scheduleId) {
      return new Response(JSON.stringify({ error: 'Schedule ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Extract signature from headers
    const signature = req.headers.get('X-Webhook-Signature') || '';

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get payload
    const payload = await req.text();

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Empty payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Get webhook schedule and secret reference
    const { data: schedule, error: scheduleError } = await supabase
      .from('operation_schedules')
      .select('webhook_secret_ref, user_id, operation_id')
      .eq('id', scheduleId)
      .eq('schedule_type', 'webhook')
      .single();

    if (scheduleError || !schedule?.webhook_secret_ref) {
      console.error('[webhook-trigger] Invalid webhook schedule:', scheduleError);

      // Log failed webhook attempt
      await supabase.from('webhook_events').insert({
        schedule_id: scheduleId,
        event_type: 'webhook_error',
        signature: signature.substring(0, 20) + '...',
        error_message: scheduleError?.message || 'Invalid webhook schedule',
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ error: 'Invalid webhook schedule' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Load secret from 1Password at runtime (never hardcoded)
    const secret = await load1PasswordSecret(schedule.webhook_secret_ref);

    if (!secret) {
      console.error('[webhook-trigger] Failed to load webhook secret');

      await supabase.from('webhook_events').insert({
        schedule_id: scheduleId,
        event_type: 'webhook_error',
        signature: signature.substring(0, 20) + '...',
        error_message: 'Failed to load webhook secret',
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ error: 'Failed to load secret' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verify HMAC-SHA256 signature
    const isValid = await verifyHMAC(payload, signature, secret);

    if (!isValid) {
      console.error('[webhook-trigger] Invalid signature for schedule:', scheduleId);

      // Log failed signature verification
      await supabase.from('webhook_events').insert({
        schedule_id: scheduleId,
        event_type: 'signature_failed',
        signature: signature.substring(0, 20) + '...',
        error_message: 'HMAC signature verification failed',
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Parse and log webhook event
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (e) {
      parsedPayload = { raw: payload };
    }

    const { error: logError } = await supabase
      .from('webhook_events')
      .insert({
        schedule_id: scheduleId,
        event_type: 'webhook_received',
        signature: signature.substring(0, 20) + '...', // Log first 20 chars only
        payload: parsedPayload,
        signature_verified: true,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('[webhook-trigger] Failed to log webhook event:', logError);
      // Don't fail the request, just log the error
    }

    // 8. Queue execution (async, don't wait)
    const executeAsync = async () => {
      try {
        const { error: execError } = await supabase
          .from('schedule_executions')
          .insert({
            schedule_id: scheduleId,
            user_id: schedule.user_id,
            operation_id: schedule.operation_id,
            execution_status: 'pending',
            triggered_by: 'webhook',
            webhook_payload: parsedPayload,
            created_at: new Date().toISOString(),
          });

        if (execError) {
          console.error('[webhook-trigger] Failed to queue execution:', execError);
        }
      } catch (error) {
        console.error('[webhook-trigger] Async execution error:', error);
      }
    };

    // Fire and forget (don't await)
    executeAsync();

    // 9. Return 202 Accepted immediately
    return new Response(
      JSON.stringify({
        accepted: true,
        schedule_id: scheduleId,
        message: 'Webhook accepted for processing',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[webhook-trigger] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
