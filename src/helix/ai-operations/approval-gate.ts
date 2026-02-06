/**
 * ApprovalGate
 *
 * Workflow system for approving cost-impacting decisions.
 * Sends approval requests to Discord, tracks approval status,
 * and prevents execution until approved.
 *
 * Phase 0.5: AI Operations Control Plane
 * Created: 2026-02-04
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logToDiscord } from '../logging.js';
import { hashChain } from '../hash-chain.js';

export interface ApprovalRequest {
  id: string;
  operation_id: string;
  operation_type: string;
  requested_by?: string;
  cost_impact_usd: number;
  reason: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface RecommendationRow {
  id: string;
  operation_id: string;
  recommendation_type: string;
  created_by?: string;
  estimated_savings_usd?: number;
  reasoning: string;
  created_at: string;
  approval_status: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

/**
 * ApprovalGate - Approval workflow system
 *
 * Responsibilities:
 * 1. Create approval requests for cost-critical operations
 * 2. Send Discord notifications to approvers (Rodrigo)
 * 3. Track approval status in database
 * 4. Block operations until approved
 * 5. Log all approval decisions to hash chain
 */
export class ApprovalGate {
  private supabase: SupabaseClient | null = null;

  constructor() {
    // Initialize Supabase client lazily when first needed
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for ApprovalGate');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }

  /**
   * Request approval for a cost-impacting operation
   *
   * Flow:
   * 1. Create approval record in database
   * 2. Send Discord alert to approvers
   * 3. Add to hash chain for integrity
   * 4. Return approval ID for tracking
   */
  async requestApproval(
    operationId: string,
    operationType: string,
    costImpactUsd: number,
    reason: string,
    requestedBy?: string
  ): Promise<ApprovalRequest> {
    const timestamp = new Date().toISOString();
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. Create approval record
      const { error } = await this.getSupabaseClient()
        .from('helix_recommendations') // Reusing recommendations table for now
        .insert({
          id: approvalId,
          operation_id: operationId,
          recommendation_type: 'approval_request',
          current_config: { operation: operationType },
          proposed_config: null,
          estimated_savings_usd: -costImpactUsd, // Negative = cost
          reasoning: reason,
          approval_status: 'PENDING',
          created_by: requestedBy || 'system',
          created_at: timestamp,
        });

      if (error) throw error;

      const approval: ApprovalRequest = {
        id: approvalId,
        operation_id: operationId,
        operation_type: operationType,
        requested_by: requestedBy,
        cost_impact_usd: costImpactUsd,
        reason,
        requested_at: timestamp,
        status: 'pending',
      };

      // 2. Send Discord alert to approvers
      this.sendApprovalAlert(approval);

      // 3. Add to hash chain
      await hashChain.add({
        type: 'approval_requested',
        approval_id: approvalId,
        operation: operationId,
        cost_impact_usd: costImpactUsd,
        reason,
        requested_by: requestedBy,
        timestamp,
      });

      return approval;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'approval_request_failed',
        operation: operationId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Send Discord alert to approvers
   *
   * Includes:
   * - Operation details
   * - Cost impact
   * - Reason
   * - Action buttons (approve/reject)
   */
  private sendApprovalAlert(approval: ApprovalRequest): void {
    const message = `
🔔 **Approval Required**

**Operation:** ${approval.operation_type}
**ID:** ${approval.operation_id}
**Cost Impact:** $${approval.cost_impact_usd.toFixed(2)}
**Reason:** ${approval.reason}
**Requested By:** ${approval.requested_by || 'System'}
**Time:** ${approval.requested_at}

**Action Required:** Approve or reject this operation
\`\`\`
approve: /approve ${approval.id}
reject: /reject ${approval.id}
\`\`\`
    `;

    logToDiscord({
      channel: 'helix-alerts',
      type: 'approval_required',
      content: message,
      approval_id: approval.id,
      mentionAdmins: true,
    });
  }

  /**
   * Check if operation has been approved
   *
   * Returns: true if approved, false if pending, throws if rejected
   */
  async checkApproval(approvalId: string): Promise<boolean> {
    try {
      const { data, error } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .select('approval_status')
        .eq('id', approvalId)
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Approval not found: ${approvalId}`);

      const status = data.approval_status;

      if (status === 'APPROVED') {
        return true;
      }

      if (status === 'REJECTED') {
        throw new Error(`Operation has been rejected. ID: ${approvalId}`);
      }

      // Still pending
      return false;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'approval_check_failed',
        approval_id: approvalId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Approve an operation
   *
   * Updates:
   * - approval_status = 'APPROVED'
   * - approved_by = approver ID
   * - approved_at = timestamp
   *
   * Sends Discord confirmation
   */
  async approve(approvalId: string, approvedBy: string = 'admin'): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      // Get approval details first
      const { data: approval, error: fetchError } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (fetchError) throw fetchError;
      if (!approval) throw new Error(`Approval not found: ${approvalId}`);

      // Update status
      const { error: updateError } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .update({
          approval_status: 'APPROVED',
          approved_by: approvedBy,
          approved_at: timestamp,
        })
        .eq('id', approvalId);

      if (updateError) throw updateError;

      // Log to Discord
      logToDiscord({
        channel: 'helix-api',
        type: 'approval_granted',
        approval_id: approvalId,
        operation: approval.operation_id,
        approved_by: approvedBy,
        cost_impact: approval.estimated_savings_usd,
      });

      // Add to hash chain
      await hashChain.add({
        type: 'approval_granted',
        approval_id: approvalId,
        operation: approval.operation_id,
        approved_by: approvedBy,
        timestamp,
      });
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'approval_grant_failed',
        approval_id: approvalId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Reject an operation
   *
   * Updates:
   * - approval_status = 'REJECTED'
   * - rejection_reason = reason provided
   *
   * Sends Discord notification
   */
  async reject(
    approvalId: string,
    rejectionReason: string,
    rejectedBy: string = 'admin'
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      // Get approval details first
      const { data: approval, error: fetchError } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (fetchError) throw fetchError;
      if (!approval) throw new Error(`Approval not found: ${approvalId}`);

      // Update status
      const { error: updateError } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .update({
          approval_status: 'REJECTED',
          approved_by: rejectedBy,
          approved_at: timestamp,
        })
        .eq('id', approvalId);

      if (updateError) throw updateError;

      // Log to Discord
      logToDiscord({
        channel: 'helix-api',
        type: 'approval_rejected',
        approval_id: approvalId,
        operation: approval.operation_id,
        rejected_by: rejectedBy,
        reason: rejectionReason,
      });

      // Add to hash chain
      await hashChain.add({
        type: 'approval_rejected',
        approval_id: approvalId,
        operation: approval.operation_id,
        rejected_by: rejectedBy,
        reason: rejectionReason,
        timestamp,
      });
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'approval_reject_failed',
        approval_id: approvalId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get pending approvals (for admin dashboard)
   */
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    try {
      const { data, error } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .select('*')
        .eq('approval_status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: RecommendationRow) => ({
        id: d.id,
        operation_id: d.operation_id,
        operation_type: d.recommendation_type,
        requested_by: d.created_by,
        cost_impact_usd: -(d.estimated_savings_usd || 0),
        reason: d.reasoning,
        requested_at: d.created_at,
        status: d.approval_status.toLowerCase() as 'pending',
      }));
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'pending_approvals_fetch_failed',
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Get approval history (for audit)
   */
  async getApprovalHistory(limit: number = 100): Promise<ApprovalRequest[]> {
    try {
      const { data, error } = await this.getSupabaseClient()
        .from('helix_recommendations')
        .select('*')
        .in('approval_status', ['APPROVED', 'REJECTED'])
        .order('approved_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((d: RecommendationRow) => ({
        id: d.id,
        operation_id: d.operation_id,
        operation_type: d.recommendation_type,
        requested_by: d.created_by,
        cost_impact_usd: -(d.estimated_savings_usd || 0),
        reason: d.reasoning,
        requested_at: d.created_at,
        status: d.approval_status.toLowerCase() as 'approved' | 'rejected',
        approved_by: d.approved_by,
        approved_at: d.approved_at,
      }));
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'approval_history_fetch_failed',
        error: String(error),
      });
      return [];
    }
  }
}

// Singleton instance
export const approvalGate = new ApprovalGate();
