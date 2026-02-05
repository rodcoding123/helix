/**
 * Phase 10 Week 4: SLA Tracking and Violation Detection
 * Monitors Service Level Agreement compliance and triggers alerts
 */

import { createClient } from '@supabase/supabase-js';

export type SLATier = 'premium' | 'standard' | 'basic';

export interface SLAThresholds {
  tier: SLATier;
  uptimePercentage: number; // e.g., 99.99, 99.5, 95
  maxDowntimeMinutesPerMonth: number;
  responseTimeP95Ms: number; // Maximum acceptable P95 latency
  successRatePercentage: number; // Minimum acceptable success rate
}

export interface SLAStatus {
  userId: string;
  tier: SLATier;
  currentUptime: number; // Percentage
  currentDowntime: number; // Minutes
  currentSuccessRate: number; // Percentage
  currentAvgLatency: number; // Milliseconds
  daysIntoMonth: number;
  projectedUptime: number; // Projected for full month
  isCompliant: boolean;
  violations: SLAViolation[];
  lastCheckedAt: string;
}

export interface SLAViolation {
  id: string;
  userId: string;
  tier: SLATier;
  violationType: 'uptime' | 'latency' | 'success_rate';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  metricValue: number;
  threshold: number;
  detectedAt: string;
  resolvedAt?: string;
}

export interface ExecutionMetrics {
  timestamp: number;
  success: boolean;
  latency: number; // Milliseconds
  operationId: string;
}

// SLA Threshold Definitions
const SLA_TIERS: Record<SLATier, SLAThresholds> = {
  premium: {
    tier: 'premium',
    uptimePercentage: 99.99, // 4.3 minutes downtime per month
    maxDowntimeMinutesPerMonth: 4.3,
    responseTimeP95Ms: 500,
    successRatePercentage: 99.95,
  },
  standard: {
    tier: 'standard',
    uptimePercentage: 99.5, // 3.6 hours downtime per month
    maxDowntimeMinutesPerMonth: 216,
    responseTimeP95Ms: 1000,
    successRatePercentage: 99.0,
  },
  basic: {
    tier: 'basic',
    uptimePercentage: 95.0, // 36 hours downtime per month
    maxDowntimeMinutesPerMonth: 2160,
    responseTimeP95Ms: 2000,
    successRatePercentage: 95.0,
  },
};

let db: any;

function getDb() {
  if (!db) {
    db = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    );
  }
  return db;
}

export class SLATracker {
  private executionMetrics: Map<string, ExecutionMetrics[]> = new Map();
  private slaViolations: Map<string, SLAViolation[]> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;

  /**
   * Get SLA thresholds for a tier
   */
  getSLAThresholds(tier: SLATier): SLAThresholds {
    return SLA_TIERS[tier];
  }

  /**
   * Record execution metrics
   */
  recordExecution(userId: string, metrics: ExecutionMetrics): void {
    if (!this.executionMetrics.has(userId)) {
      this.executionMetrics.set(userId, []);
    }

    const userMetrics = this.executionMetrics.get(userId)!;
    userMetrics.push(metrics);

    // Keep only metrics from last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.executionMetrics.set(
      userId,
      userMetrics.filter(m => m.timestamp > thirtyDaysAgo)
    );
  }

  /**
   * Calculate SLA status for a user
   */
  async calculateSLAStatus(userId: string, tier: SLATier): Promise<SLAStatus> {
    const thresholds = SLA_TIERS[tier];
    const metrics = this.executionMetrics.get(userId) || [];

    // Calculate metrics
    const totalExecutions = metrics.length;
    const successfulExecutions = metrics.filter(m => m.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    // Current success rate
    const currentSuccessRate = totalExecutions > 0
      ? (successfulExecutions / totalExecutions) * 100
      : 100;

    // Current downtime in minutes (approximate)
    const currentDowntime = failedExecutions * 0.1; // Each failure ≈ 0.1 minute downtime

    // Current uptime
    const currentUptime = totalExecutions > 0
      ? currentSuccessRate
      : 100;

    // P95 latency
    const latencies = metrics.map(m => m.latency).sort((a, b) => a - b);
    const p95Index = Math.ceil(latencies.length * 0.95) - 1;
    const currentAvgLatency = latencies.length > 0
      ? latencies[Math.max(0, p95Index)] || 0
      : 0;

    // Days into month
    const now = new Date();
    const daysIntoMonth = now.getDate();

    // Project full month
    const projectedUptime = currentUptime;

    // Check compliance
    const isCompliant =
      currentUptime >= thresholds.uptimePercentage &&
      currentDowntime <= thresholds.maxDowntimeMinutesPerMonth &&
      currentSuccessRate >= thresholds.successRatePercentage &&
      currentAvgLatency <= thresholds.responseTimeP95Ms;

    // Detect violations
    const violations: SLAViolation[] = [];

    if (currentUptime < thresholds.uptimePercentage) {
      violations.push({
        id: crypto.randomUUID(),
        userId,
        tier,
        violationType: 'uptime',
        severity: currentUptime < thresholds.uptimePercentage - 1 ? 'critical' : 'warning',
        message: `Uptime fell below ${thresholds.uptimePercentage}%`,
        metric: 'uptime',
        metricValue: currentUptime,
        threshold: thresholds.uptimePercentage,
        detectedAt: new Date().toISOString(),
      });
    }

    if (currentDowntime > thresholds.maxDowntimeMinutesPerMonth) {
      violations.push({
        id: crypto.randomUUID(),
        userId,
        tier,
        violationType: 'uptime',
        severity: 'critical',
        message: `Downtime exceeded ${thresholds.maxDowntimeMinutesPerMonth} minutes`,
        metric: 'downtime_minutes',
        metricValue: currentDowntime,
        threshold: thresholds.maxDowntimeMinutesPerMonth,
        detectedAt: new Date().toISOString(),
      });
    }

    if (currentAvgLatency > thresholds.responseTimeP95Ms) {
      violations.push({
        id: crypto.randomUUID(),
        userId,
        tier,
        violationType: 'latency',
        severity: currentAvgLatency > thresholds.responseTimeP95Ms * 2 ? 'critical' : 'warning',
        message: `P95 latency exceeded ${thresholds.responseTimeP95Ms}ms`,
        metric: 'latency_p95',
        metricValue: currentAvgLatency,
        threshold: thresholds.responseTimeP95Ms,
        detectedAt: new Date().toISOString(),
      });
    }

    if (currentSuccessRate < thresholds.successRatePercentage) {
      violations.push({
        id: crypto.randomUUID(),
        userId,
        tier,
        violationType: 'success_rate',
        severity: currentSuccessRate < thresholds.successRatePercentage - 5 ? 'critical' : 'warning',
        message: `Success rate fell below ${thresholds.successRatePercentage}%`,
        metric: 'success_rate',
        metricValue: currentSuccessRate,
        threshold: thresholds.successRatePercentage,
        detectedAt: new Date().toISOString(),
      });
    }

    // Store violations
    this.slaViolations.set(userId, violations);

    return {
      userId,
      tier,
      currentUptime,
      currentDowntime,
      currentSuccessRate,
      currentAvgLatency,
      daysIntoMonth,
      projectedUptime,
      isCompliant,
      violations,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all active violations for a user
   */
  getActiveViolations(userId: string): SLAViolation[] {
    return (this.slaViolations.get(userId) || []).filter(v => !v.resolvedAt);
  }

  /**
   * Store SLA status to database
   */
  async storeSLAStatus(status: SLAStatus): Promise<void> {
    try {
      await getDb()
        .from('sla_statuses')
        .upsert({
          user_id: status.userId,
          tier: status.tier,
          current_uptime: status.currentUptime,
          current_downtime: status.currentDowntime,
          current_success_rate: status.currentSuccessRate,
          current_avg_latency: status.currentAvgLatency,
          is_compliant: status.isCompliant,
          last_checked_at: status.lastCheckedAt,
        });
    } catch (error) {
      console.error('[SLATracker] Error storing SLA status:', error);
    }
  }

  /**
   * Store violations to database
   */
  async storeViolations(violations: SLAViolation[]): Promise<void> {
    if (violations.length === 0) return;

    try {
      await getDb()
        .from('sla_violations')
        .insert(
          violations.map(v => ({
            id: v.id,
            user_id: v.userId,
            tier: v.tier,
            violation_type: v.violationType,
            severity: v.severity,
            message: v.message,
            metric: v.metric,
            metric_value: v.metricValue,
            threshold: v.threshold,
            detected_at: v.detectedAt,
          }))
        );
    } catch (error) {
      console.error('[SLATracker] Error storing violations:', error);
    }
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(violationId: string): Promise<void> {
    try {
      await getDb()
        .from('sla_violations')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', violationId);
    } catch (error) {
      console.error('[SLATracker] Error resolving violation:', error);
    }
  }

  /**
   * Get violation history for a user
   */
  async getViolationHistory(userId: string, days: number = 30): Promise<SLAViolation[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await getDb()
        .from('sla_violations')
        .select('*')
        .eq('user_id', userId)
        .gte('detected_at', since)
        .order('detected_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(v => ({
        id: v.id,
        userId: v.user_id,
        tier: v.tier as SLATier,
        violationType: v.violation_type as 'uptime' | 'latency' | 'success_rate',
        severity: v.severity as 'warning' | 'critical',
        message: v.message,
        metric: v.metric,
        metricValue: v.metric_value,
        threshold: v.threshold,
        detectedAt: v.detected_at,
        resolvedAt: v.resolved_at,
      }));
    } catch (error) {
      console.error('[SLATracker] Error fetching violation history:', error);
      return [];
    }
  }

  /**
   * Start periodic SLA evaluation
   */
  startEvaluation(intervalMs: number = 5000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateAllUsers().catch(err => {
        console.error('[SLATracker] Error during evaluation:', err);
      });
    }, intervalMs);

    console.log(`[SLATracker] Started evaluation loop (every ${intervalMs / 1000}s)`);
  }

  /**
   * Stop periodic SLA evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[SLATracker] Stopped evaluation loop');
    }
  }

  /**
   * Evaluate all users' SLA status
   */
  private async evaluateAllUsers(): Promise<void> {
    const userIds = Array.from(new Set(
      Array.from(this.executionMetrics.keys())
    ));

    for (const userId of userIds) {
      // Evaluate all tiers
      for (const tier of ['premium', 'standard', 'basic'] as SLATier[]) {
        const status = await this.calculateSLAStatus(userId, tier);
        await this.storeSLAStatus(status);

        if (status.violations.length > 0) {
          await this.storeViolations(status.violations);
        }
      }
    }
  }

  /**
   * Get metrics count for a user
   */
  getMetricsCount(userId: string): number {
    return this.executionMetrics.get(userId)?.length || 0;
  }

  /**
   * Clear metrics for a user
   */
  clearMetrics(userId: string): void {
    this.executionMetrics.delete(userId);
    this.slaViolations.delete(userId);
  }
}

// Singleton instance
let slaTracker: SLATracker | null = null;

export function getSLATracker(): SLATracker {
  if (!slaTracker) {
    slaTracker = new SLATracker();
  }
  return slaTracker;
}
