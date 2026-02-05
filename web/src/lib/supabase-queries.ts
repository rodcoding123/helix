import { supabase } from './supabase';
import { DailyCostMetrics, CostByUser, OperationMetric, PendingApproval } from '../types/control-plane';

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
