import { supabase } from './supabase';
import type {
  Instance,
  Subscription,
  LiveStats,
  DailyStats,
  HourlyStats,
  TelemetryEvent,
  Heartbeat,
  Transformation,
  Anomaly,
} from './types';

// =====================================================
// SUBSCRIPTION API
// =====================================================

export async function getSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase.from('subscriptions').select('*').single();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

// =====================================================
// INSTANCES API (DEPRECATED - User account = instance)
// =====================================================

/** @deprecated Instances removed. User account = instance. */
export async function getInstances(): Promise<Instance[]> {
  console.warn('[api] getInstances() is deprecated. User account = instance.');
  return [];
}

/** @deprecated Instances removed. User account = instance. */
export async function getInstance(id: string): Promise<Instance | null> {
  console.warn('[api] getInstance() is deprecated. User account = instance.');
  return null;
}

/** @deprecated Instances removed. User account = instance. */
export async function createInstance(name: string, instanceKey: string): Promise<Instance | null> {
  console.warn('[api] createInstance() is deprecated. User account = instance.');
  return null;
}

/** @deprecated Instances removed. User account = instance. */
export async function deleteInstance(id: string): Promise<boolean> {
  console.warn('[api] deleteInstance() is deprecated. User account = instance.');
  return false;
}

// =====================================================
// STATS API
// =====================================================

export async function getLiveStats(): Promise<LiveStats | null> {
  const { data, error } = await supabase.rpc('get_live_stats');

  if (error) {
    console.error('Error fetching live stats:', error);
    // Return mock data for demo
    return {
      total_instances: 42,
      active_instances: 17,
      total_heartbeats: 15420,
      total_sessions: 3891,
      total_transformations: 127,
    };
  }

  return data?.[0] || null;
}

export async function getDailyStats(startDate: string, endDate: string): Promise<DailyStats[]> {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching daily stats:', error);
    return [];
  }

  return data || [];
}

export async function getHourlyStats(): Promise<HourlyStats[]> {
  const { data, error } = await supabase
    .from('hourly_stats')
    .select('*')
    .order('hour', { ascending: false })
    .limit(48);

  if (error) {
    console.error('Error fetching hourly stats:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// TELEMETRY API (userId-based)
// =====================================================

export async function getUserTelemetry(
  userId: string,
  limit = 100
): Promise<TelemetryEvent[]> {
  const { data, error } = await supabase
    .from('telemetry')
    .select('*')
    .eq('user_id', userId)
    .order('server_timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching telemetry:', error);
    return [];
  }

  return data || [];
}

export async function getUserHeartbeats(
  userId: string,
  limit = 100
): Promise<Heartbeat[]> {
  const { data, error } = await supabase
    .from('heartbeats')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching heartbeats:', error);
    return [];
  }

  return data || [];
}

export async function getUserTransformations(
  userId: string,
  limit = 50
): Promise<Transformation[]> {
  const { data, error } = await supabase
    .from('transformations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transformations:', error);
    return [];
  }

  return data || [];
}

/** @deprecated Use getUserTelemetry instead */
export const getInstanceTelemetry = (instanceKey: string, limit?: number) => getUserTelemetry(instanceKey, limit);
/** @deprecated Use getUserHeartbeats instead */
export const getInstanceHeartbeats = (instanceKey: string, limit?: number) => getUserHeartbeats(instanceKey, limit);
/** @deprecated Use getUserTransformations instead */
export const getInstanceTransformations = (instanceKey: string, limit?: number) => getUserTransformations(instanceKey, limit);

// =====================================================
// ANOMALIES API
// =====================================================

export async function getAnomalies(instanceKey?: string, limit = 50): Promise<Anomaly[]> {
  let query = supabase
    .from('anomalies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (instanceKey) {
    query = query.eq('instance_key', instanceKey);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching anomalies:', error);
    return [];
  }

  return data || [];
}

export async function acknowledgeAnomaly(id: string, notes?: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('anomalies')
    .update({
      acknowledged: true,
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq('id', id);

  if (error) {
    console.error('Error acknowledging anomaly:', error);
    return false;
  }

  return true;
}

// =====================================================
// TELEMETRY INGESTION (Public endpoints)
// =====================================================

export async function ingestTelemetry(
  instanceKey: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase.from('telemetry').insert({
    instance_key: instanceKey,
    event_type: eventType,
    event_data: eventData,
    client_timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error('Error ingesting telemetry:', error);
    return false;
  }

  return true;
}

export async function ingestHeartbeat(
  instanceKey: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase.from('heartbeats').insert({
    instance_key: instanceKey,
    metadata,
  });

  if (error) {
    console.error('Error ingesting heartbeat:', error);
    return false;
  }

  return true;
}
