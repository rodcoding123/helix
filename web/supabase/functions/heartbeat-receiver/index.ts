// Heartbeat Receiver Edge Function
// Tracks instance liveness via heartbeat signals

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from '../_shared/cors.ts'

interface HeartbeatPayload {
  timestamp: number
  metadata?: Record<string, unknown>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['x-instance-key'])
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get instance key from header
    const instanceKey = req.headers.get('x-instance-key')
    if (!instanceKey) {
      return corsErrorResponse(req, 'Missing instance key', 400, ['x-instance-key'])
    }

    // Verify instance exists
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, ghost_mode')
      .eq('instance_key', instanceKey)
      .single()

    if (instanceError || !instance) {
      return corsErrorResponse(req, 'Invalid instance key', 401, ['x-instance-key'])
    }

    // Parse heartbeat payload
    const payload: HeartbeatPayload = await req.json()
    const serverTimestamp = Date.now()
    const clientTimestamp = payload.timestamp || serverTimestamp
    const latencyMs = serverTimestamp - clientTimestamp

    // Don't store heartbeats for ghost mode, but still update last_seen
    if (!instance.ghost_mode) {
      // Insert heartbeat record
      const { error: insertError } = await supabase
        .from('heartbeats')
        .insert({
          instance_key: instanceKey,
          received_at: new Date(serverTimestamp).toISOString(),
          latency_ms: latencyMs > 0 ? latencyMs : null,
          metadata: payload.metadata,
        })

      if (insertError) {
        console.error('Failed to insert heartbeat:', insertError)
      }
    }

    // Update instance last_seen and active status
    const { error: updateError } = await supabase
      .from('instances')
      .update({
        last_seen: new Date(serverTimestamp).toISOString(),
        is_active: true,
      })
      .eq('instance_key', instanceKey)

    if (updateError) {
      console.error('Failed to update instance:', updateError)
    }

    return corsJsonResponse(req, {
      success: true,
      server_timestamp: serverTimestamp,
      latency_ms: latencyMs > 0 ? latencyMs : null,
    }, 200, ['x-instance-key'])
  } catch (error) {
    console.error('Heartbeat receiver error:', error)
    return corsErrorResponse(req, 'Internal server error', 500, ['x-instance-key'])
  }
})
