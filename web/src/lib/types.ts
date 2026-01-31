// =====================================================
// HELIX OBSERVATORY TYPE DEFINITIONS
// =====================================================

export type SubscriptionTier = 'free' | 'ghost' | 'observatory' | 'observatory_pro';

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
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Basic dashboard',
      'Instance monitoring',
      'Telemetry collection',
      'Community support',
    ],
    cta: 'Get Started',
  },
  {
    id: 'ghost',
    name: 'Ghost Mode',
    price: 9,
    interval: 'month',
    features: [
      'Everything in Free',
      'Telemetry disabled',
      'Complete privacy',
      'No data collection',
    ],
    cta: 'Go Ghost',
  },
  {
    id: 'observatory',
    name: 'Observatory',
    price: 29,
    interval: 'month',
    features: [
      'Everything in Free',
      'Aggregate research data',
      'Psychology distributions',
      'Transformation timelines',
      'Anomaly detection',
      'Email reports',
    ],
    highlighted: true,
    cta: 'Start Observing',
  },
  {
    id: 'observatory_pro',
    name: 'Observatory Pro',
    price: 99,
    interval: 'month',
    features: [
      'Everything in Observatory',
      'Full API access',
      'Data exports (CSV/JSON)',
      'Pattern explorer',
      'Behavior clusters',
      'Research tools',
      'Priority support',
    ],
    cta: 'Go Pro',
  },
];
