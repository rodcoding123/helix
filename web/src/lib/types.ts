// =====================================================
// HELIX OBSERVATORY TYPE DEFINITIONS
// =====================================================

export type SubscriptionTier = 'core' | 'phantom' | 'overseer' | 'architect';

// Tier access levels (higher number = more access)
export const TIER_LEVELS: Record<SubscriptionTier, number> = {
  core: 0,
  phantom: 1,
  overseer: 2,
  architect: 3,
};

export function hasTierAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_LEVELS[userTier] >= TIER_LEVELS[requiredTier];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated Instances removed. User account = instance. */
export interface Instance {
  id: string;
  user_id: string;
  name: string;
  instance_key: string;
  soul_hash?: string;
  psychology_summary?: PsychologySummary;
  ghost_mode: boolean;
  is_active: boolean;
  version?: string;
  created_at: string;
  last_seen?: string;
  last_transformation?: string;
}

export interface PsychologySummary {
  enneagram?: string;
  big_five?: BigFiveProfile;
}

export interface BigFiveProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export type TelemetryEventType =
  | 'heartbeat'
  | 'session_start'
  | 'session_end'
  | 'transformation'
  | 'anomaly'
  | 'error'
  | 'boot'
  | 'shutdown';

export interface TelemetryEvent {
  id: string;
  instance_key: string;
  event_type: TelemetryEventType;
  event_data?: Record<string, unknown>;
  client_timestamp?: string;
  server_timestamp: string;
}

export interface Heartbeat {
  id: string;
  instance_key: string;
  received_at: string;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface Transformation {
  id: string;
  instance_key: string;
  transformation_type?: string;
  from_state?: Record<string, unknown>;
  to_state?: Record<string, unknown>;
  trigger_category?: string;
  significance_score?: number;
  created_at: string;
}

export interface Anomaly {
  id: string;
  instance_key?: string;
  anomaly_type: string;
  severity: 'info' | 'warning' | 'critical';
  description?: string;
  pattern_data?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface DailyStats {
  date: string;
  total_instances: number;
  active_instances: number;
  new_instances: number;
  ghost_instances: number;
  total_sessions: number;
  total_heartbeats: number;
  avg_session_duration_seconds?: number;
  transformations: number;
  anomalies_info: number;
  anomalies_warning: number;
  anomalies_critical: number;
  enneagram_distribution?: Record<string, number>;
  big_five_averages?: BigFiveProfile;
}

export interface HourlyStats {
  hour: string;
  active_instances: number;
  heartbeats: number;
  sessions_started: number;
  sessions_ended: number;
  transformations: number;
}

export interface LiveStats {
  total_instances: number;
  active_instances: number;
  total_heartbeats: number;
  total_sessions: number;
  total_transformations: number;
}

// Pricing
export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: number;
  interval: 'month';
  features: string[];
  highlighted?: boolean;
  cta: string;
  description?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'core',
    name: 'Core',
    price: 0,
    interval: 'month',
    description: 'Everything. The full architecture.',
    features: [
      'Full Living AI Architecture',
      'Run on your machine',
      'Basic dashboard',
      'Contribute to research',
    ],
    cta: 'Get Started',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    price: 9,
    interval: 'month',
    description: 'Complete privacy.',
    features: [
      'Everything in Core',
      'No telemetry',
      'No data leaves your machine',
      'For those who want solitude',
    ],
    cta: 'Go Ghost',
  },
  {
    id: 'overseer',
    name: 'Overseer',
    price: 29,
    interval: 'month',
    description: 'See the collective.',
    features: [
      'Everything in Core',
      'Observatory access',
      'Aggregate patterns across all instances',
      'Watch what emerges',
    ],
    highlighted: true,
    cta: 'Observe',
  },
  {
    id: 'architect',
    name: 'Architect',
    price: 99,
    interval: 'month',
    description: 'Full access, anywhere.',
    features: [
      'Everything in Overseer',
      'Web interface, Mobile, Voice',
      'Talk to her from your phone',
      'Research API & data exports',
      'Be part of building what comes next',
    ],
    cta: 'Build',
  },
];
