// Telemetry Ingest Edge Function
// Receives telemetry from Helix instances

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from '../_shared/cors.ts'

interface TelemetryEvent {
  event_type: 'heartbeat' | 'session_start' | 'session_end' | 'transformation' | 'anomaly' | 'error' | 'boot' | 'shutdown'
  event_data?: Record<string, unknown>
  client_timestamp?: string
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

    // Verify instance exists and is not in ghost mode
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, ghost_mode, user_id')
      .eq('instance_key', instanceKey)
      .single()

    if (instanceError || !instance) {
      return corsErrorResponse(req, 'Invalid instance key', 401, ['x-instance-key'])
    }

    // Check ghost mode
    if (instance.ghost_mode) {
      return corsJsonResponse(req, { message: 'Telemetry disabled for ghost mode' }, 200, ['x-instance-key'])
    }

    // Parse telemetry event
    const event: TelemetryEvent = await req.json()

    // Insert telemetry event
    const { error: insertError } = await supabase
      .from('telemetry_events')
      .insert({
        instance_key: instanceKey,
        event_type: event.event_type,
        event_data: event.event_data,
        client_timestamp: event.client_timestamp,
        server_timestamp: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to insert telemetry:', insertError)
      return corsErrorResponse(req, 'Failed to store telemetry', 500, ['x-instance-key'])
    }

    // Update instance last_seen
    await supabase
      .from('instances')
      .update({ last_seen: new Date().toISOString() })
      .eq('instance_key', instanceKey)

    // Handle special event types
    if (event.event_type === 'transformation') {
      await supabase
        .from('instances')
        .update({ last_transformation: new Date().toISOString() })
        .eq('instance_key', instanceKey)

      // Also insert into transformations table
      await supabase
        .from('transformations')
        .insert({
          instance_key: instanceKey,
          transformation_type: event.event_data?.type as string,
          from_state: event.event_data?.from_state as Record<string, unknown>,
          to_state: event.event_data?.to_state as Record<string, unknown>,
          trigger_category: event.event_data?.trigger as string,
          significance_score: event.event_data?.significance as number,
        })
    }

    if (event.event_type === 'anomaly') {
      await supabase
        .from('anomalies')
        .insert({
          instance_key: instanceKey,
          anomaly_type: event.event_data?.type as string,
          severity: (event.event_data?.severity as string) || 'info',
          description: event.event_data?.description as string,
          pattern_data: event.event_data?.pattern_data as Record<string, unknown>,
        })
    }

    return corsJsonResponse(req, { success: true }, 200, ['x-instance-key'])
  } catch (error) {
    console.error('Telemetry ingest error:', error)
    return corsErrorResponse(req, 'Internal server error', 500, ['x-instance-key'])
  }
})
