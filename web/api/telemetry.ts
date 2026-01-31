import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vercel Edge Function for telemetry ingestion
export const config = {
  runtime: 'edge',
};

interface TelemetryPayload {
  instance_key: string;
  event_type: 'command' | 'api_call' | 'file_change' | 'heartbeat' | 'transformation' | 'anomaly';
  payload: Record<string, unknown>;
  hash?: string;
  previous_hash?: string;
  timestamp?: string;
}

interface HeartbeatPayload {
  instance_key: string;
  status: 'online' | 'offline' | 'error';
  memory_usage?: number;
  cpu_usage?: number;
  uptime_seconds?: number;
}

interface TransformationPayload {
  instance_key: string;
  layer: number;
  from_state: Record<string, unknown>;
  to_state: Record<string, unknown>;
  trigger: string;
  description?: string;
}

export default async function handler(request: Request): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Instance-Key',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only POST allowed
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const url = new URL(request.url);
    const endpoint = url.pathname.split('/').pop();

    // Validate instance key
    const instanceKey = body.instance_key || request.headers.get('X-Instance-Key');
    if (!instanceKey) {
      return new Response(JSON.stringify({ error: 'Missing instance_key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify instance exists
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, status')
      .eq('instance_key', instanceKey)
      .single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ error: 'Invalid instance key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate handler
    switch (endpoint) {
      case 'telemetry':
        return handleTelemetry(supabase, body as TelemetryPayload, corsHeaders);
      case 'heartbeat':
        return handleHeartbeat(supabase, body as HeartbeatPayload, corsHeaders);
      case 'transformation':
        return handleTransformation(supabase, body as TransformationPayload, corsHeaders);
      default:
        return handleTelemetry(supabase, body as TelemetryPayload, corsHeaders);
    }
  } catch (error) {
    console.error('Telemetry error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleTelemetry(
  supabase: SupabaseClient,
  payload: TelemetryPayload,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { error } = await supabase.from('telemetry').insert({
    instance_key: payload.instance_key,
    event_type: payload.event_type,
    payload: payload.payload,
    hash: payload.hash,
    previous_hash: payload.previous_hash,
    timestamp: payload.timestamp || new Date().toISOString(),
  });

  if (error) {
    console.error('Telemetry insert error:', error);
    return new Response(JSON.stringify({ error: 'Failed to store telemetry' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update global counters
  await supabase.rpc('increment_counter', {
    counter_name: `events_${payload.event_type}`,
    increment_value: 1,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleHeartbeat(
  supabase: SupabaseClient,
  payload: HeartbeatPayload,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { error } = await supabase.from('heartbeats').insert({
    instance_key: payload.instance_key,
    status: payload.status,
    memory_usage: payload.memory_usage,
    cpu_usage: payload.cpu_usage,
    uptime_seconds: payload.uptime_seconds,
  });

  if (error) {
    console.error('Heartbeat insert error:', error);
    return new Response(JSON.stringify({ error: 'Failed to store heartbeat' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleTransformation(
  supabase: SupabaseClient,
  payload: TransformationPayload,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { error } = await supabase.from('transformations').insert({
    instance_key: payload.instance_key,
    layer: payload.layer,
    from_state: payload.from_state,
    to_state: payload.to_state,
    trigger: payload.trigger,
    description: payload.description,
  });

  if (error) {
    console.error('Transformation insert error:', error);
    return new Response(JSON.stringify({ error: 'Failed to store transformation' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update global transformation counter
  await supabase.rpc('increment_counter', {
    counter_name: 'total_transformations',
    increment_value: 1,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
