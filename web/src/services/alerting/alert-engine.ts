/**
 * Phase 10 Week 4: Alert Engine
 * Evaluates alert conditions and triggers notifications via multiple channels
 */

import { getDb } from '@/lib/supabase';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertMetric = 'error_rate' | 'latency_p95' | 'cost_spike' | 'sla_violation' | 'budget_exceeded';
export type AlertOperator = '>' | '<' | '=' | '!=' | 'between';

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number | [number, number];
  window: '5m' | '15m' | '1h' | '24h';
}

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  condition: AlertCondition;
  channels: Array<'discord' | 'email' | 'sms'>;
  severity: AlertSeverity;
  enabled: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  userId: string;
  severity: AlertSeverity;
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
}

export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private lastAlertTime: Map<string, number> = new Map();

  async initialize(userId: string): Promise<void> {
    await this.loadRules(userId);
    this.startEvaluation();
  }

  private async loadRules(userId: string): Promise<void> {
    try {
      const { data, error } = await getDb()
        .from('alert_rules')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true);

      if (error) throw error;
      if (data) {
        data.forEach(rule => this.rules.set(rule.id, rule as AlertRule));
      }
    } catch (error) {
      console.error('[AlertEngine] Failed to load rules:', error);
    }
  }

  private startEvaluation(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateAllRules();
    }, 60000);
  }

  private async evaluateAllRules(): Promise<void> {
    for (const [ruleId, rule] of this.rules.entries()) {
      const shouldAlert = await this.evaluateRule(rule);
      if (shouldAlert) {
        const lastAlert = this.lastAlertTime.get(ruleId);
        const now = Date.now();
        const cooldownMs = 5 * 60 * 1000;
        if (!lastAlert || now - lastAlert >= cooldownMs) {
          await this.triggerAlert(rule);
          this.lastAlertTime.set(ruleId, now);
        }
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    const { metric, operator, threshold } = rule.condition;
    const value = await this.getMetricValue(metric, rule.condition.window);

    switch (operator) {
      case '>':
        return value > (threshold as number);
      case '<':
        return value < (threshold as number);
      case '=':
        return value === (threshold as number);
      default:
        return false;
    }
  }

  private async getMetricValue(metric: AlertMetric, window: string): Promise<number> {
    const windowMs = this.parseWindow(window);
    const since = new Date(Date.now() - windowMs);

    switch (metric) {
      case 'error_rate':
        return await this.calculateErrorRate(since);
      case 'latency_p95':
        return await this.calculateP95Latency(since);
      case 'sla_violation':
        return await this.checkSLAViolation(since);
      default:
        return 0;
    }
  }

  private async calculateErrorRate(since: Date): Promise<number> {
    const { data } = await getDb()
      .from('operation_execution_analytics')
      .select('success_count,failure_count')
      .gte('created_at', since.toISOString());

    if (!data || data.length === 0) return 0;

    const totalSuccess = data.reduce((sum, row) => sum + (row.success_count || 0), 0);
    const totalFailure = data.reduce((sum, row) => sum + (row.failure_count || 0), 0);
    const total = totalSuccess + totalFailure;

    return total > 0 ? (totalFailure / total) * 100 : 0;
  }

  private async calculateP95Latency(since: Date): Promise<number> {
    const { data } = await getDb()
      .from('operation_execution_analytics')
      .select('avg_latency_ms')
      .gte('created_at', since.toISOString())
      .order('avg_latency_ms', { ascending: false });

    if (!data || data.length === 0) return 0;
    const index = Math.ceil(data.length * 0.05) - 1;
    return data[index]?.avg_latency_ms || 0;
  }

  private async checkSLAViolation(since: Date): Promise<number> {
    const { data } = await getDb()
      .from('operation_execution_analytics')
      .select('success_count,failure_count')
      .gte('created_at', since.toISOString());

    if (!data || data.length === 0) return 0;

    const totalSuccess = data.reduce((sum, row) => sum + (row.success_count || 0), 0);
    const totalFailure = data.reduce((sum, row) => sum + (row.failure_count || 0), 0);
    const total = totalSuccess + totalFailure;

    if (total === 0) return 0;
    const uptime = (totalSuccess / total) * 100;
    return uptime < 99.9 ? 1 : 0;
  }

  private parseWindow(window: string): number {
    const map: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };
    return map[window] || 5 * 60 * 1000;
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    const alert: Alert = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      userId: rule.userId,
      severity: rule.severity,
      message: rule.name,
      triggeredAt: new Date().toISOString(),
    };

    try {
      await getDb().from('alerts').insert([alert]);
      console.log('[AlertEngine] Alert triggered:', alert);
    } catch (error) {
      console.error('[AlertEngine] Error triggering alert:', error);
    }
  }

  async addRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const { error } = await getDb().from('alert_rules').insert([newRule]);
    if (error) throw error;

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await getDb().from('alert_rules').delete().eq('id', ruleId);
    if (error) throw error;
    this.rules.delete(ruleId);
  }

  async getAlertHistory(userId: string, limit: number = 50): Promise<Alert[]> {
    const { data, error } = await getDb()
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('triggeredAt', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as Alert[]) || [];
  }

  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }
}

let alertEngine: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!alertEngine) {
    alertEngine = new AlertEngine();
  }
  return alertEngine;
}
