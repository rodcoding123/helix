import { supabase } from './supabase';
import { DailyCostMetrics, CostByUser, OperationMetric, PendingApproval, RoutingConfig, FeatureToggle, UserBudget } from '../types/control-plane';

export async function getDailyCostMetrics(days = 7): Promise<DailyCostMetrics[]> {
  const { data, error } = await supabase
    .from('v_daily_cost_summary')
    .select('*')
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCostByUser(userId: string): Promise<CostByUser> {
  const { data, error } = await supabase
    .from('v_cost_by_user')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentOperations(limit = 50): Promise<OperationMetric[]> {
  const { data, error } = await supabase
    .from('ai_operation_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export function subscribeToOperationUpdates(callback: (newOp: OperationMetric) => void) {
  return supabase
    .channel('operation_updates')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ai_operation_log' },
      (payload) => callback(payload.new as OperationMetric)
    )
    .subscribe();
}

export async function getPendingApprovals(): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from('helix_recommendations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function approveOperation(
  approvalId: string,
  approverId: string
): Promise<void> {
  const { error } = await supabase
    .from('helix_recommendations')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approverId,
    })
    .eq('id', approvalId);

  if (error) throw error;
}

export async function rejectOperation(
  approvalId: string,
  reason: string,
  rejecterId: string
): Promise<void> {
  const { error } = await supabase
    .from('helix_recommendations')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: rejecterId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', approvalId);

  if (error) throw error;
}

export function subscribeToApprovalUpdates(
  callback: (approval: PendingApproval) => void
): ReturnType<typeof supabase.channel> {
  return supabase
    .channel('approval_updates')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'helix_recommendations' },
      (payload) => callback(payload.new as PendingApproval)
    )
    .subscribe();
}

export async function getRoutingConfigs(): Promise<RoutingConfig[]> {
  const { data, error } = await supabase
    .from('ai_model_routes')
    .select('*')
    .order('operation_type', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateRouting(
  routingId: string,
  primaryModel: string,
  fallbackModel: string | null
): Promise<void> {
  const { error } = await supabase
    .from('ai_model_routes')
    .update({
      primary_model: primaryModel,
      fallback_model: fallbackModel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routingId);

  if (error) throw error;
}

export async function toggleRoute(routingId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_model_routes')
    .update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routingId);

  if (error) throw error;
}

export function subscribeToRoutingUpdates(
  callback: (config: RoutingConfig) => void
): ReturnType<typeof supabase.channel> {
  return supabase
    .channel('routing_updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ai_model_routes',
      },
      (payload) => {
        callback(payload.new as RoutingConfig);
      }
    )
    .subscribe();
}

export async function getFeatureToggles(): Promise<FeatureToggle[]> {
  const { data, error } = await supabase
    .from('feature_toggles')
    .select('*')
    .order('category', { ascending: true })
    .order('feature_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateFeatureToggle(
  toggleId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('feature_toggles')
    .update({
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', toggleId);

  if (error) throw error;
}

export function subscribeToFeatureToggleUpdates(
  callback: (toggle: FeatureToggle) => void
): ReturnType<typeof supabase.channel> {
  return supabase
    .channel('feature_toggles_updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'feature_toggles',
      },
      (payload) => {
        callback(payload.new as FeatureToggle);
      }
    )
    .subscribe();
}

export async function getUserBudgets(): Promise<UserBudget[]> {
  const { data, error } = await supabase
    .from('cost_budgets')
    .select('*')
    .order('user_email', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateUserBudget(
  budgetId: string,
  dailyLimit: number,
  monthlyLimit: number,
  warningThreshold: number
): Promise<void> {
  const { error } = await supabase
    .from('cost_budgets')
    .update({
      daily_limit: dailyLimit,
      monthly_limit: monthlyLimit,
      warning_threshold_percent: warningThreshold,
      updated_at: new Date().toISOString(),
    })
    .eq('id', budgetId);

  if (error) throw error;
}

export async function toggleUserBudget(
  budgetId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from('cost_budgets')
    .update({
      is_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', budgetId);

  if (error) throw error;
}

export function subscribeToUserBudgetUpdates(
  callback: (budget: UserBudget) => void
): ReturnType<typeof supabase.channel> {
  return supabase
    .channel('user_budgets_updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cost_budgets',
      },
      (payload) => {
        callback(payload.new as UserBudget);
      }
    )
    .subscribe();
}
