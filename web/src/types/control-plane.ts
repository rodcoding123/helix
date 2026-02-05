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
