export interface DailyCostMetrics {
  date: string;
  total_cost: number;
  operation_count: number;
  success_rate: number;
  top_operations: { operation_type: string; cost: number }[];
  top_models: { model: string; cost: number }[];
}

export interface CostByUser {
  user_id: string;
  today: number;
  this_month: number;
  daily_limit: number;
  warning_threshold: number;
}

export interface OperationMetric {
  id?: string;
  operation_type: string;
  model_used: string;
  cost_usd: number;
  tokens_used: number;
  success: boolean;
  quality_score: number;
  created_at: string;
}

export interface PendingApproval {
  id: string;
  operation_id: string;
  operation_type: string;
  user_id: string;
  estimated_cost: number;
  reason: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
}

export interface RoutingConfig {
  id: string;
  operation_type: string;
  primary_model: string;
  fallback_model: string | null;
  criticality_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailableModel {
  model_id: string;
  model_name: string;
  provider: string;
  cost_per_1k_tokens: number;
}
