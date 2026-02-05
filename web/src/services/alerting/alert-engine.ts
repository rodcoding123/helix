/**
 * Phase 10 Week 4: Alert Rule Engine
 * Evaluates alert conditions and triggers notifications through multiple channels
 */

import { createClient } from '@supabase/supabase-js';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertMetric =
  | 'error_rate'
  | 'latency_p95'
  | 'cost_spike'
  | 'sla_violation'
  | 'budget_exceeded'
  | 'operation_failure_rate';
export type AlertOperator = '>' | '<' | '=' | '!=' | 'between';
export type AlertChannel = 'discord' | 'email' | 'sms' | 'in_app';
export type TimeWindow = '5m' | '15m' | '1h' | '24h';

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number | [number, number]; // For 'between' operator
  window: TimeWindow;
}

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  description: string;
  condition: AlertCondition;
  channels: AlertChannel[];
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMinutes: number; // Minimum minutes between alert triggers
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  userId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric: AlertMetric;
  metricValue: number;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
}

export interface MetricsSnapshot {
  timestamp: number;
  error_rate: number; // Percentage (0-100)
  latency_p95: number; // Milliseconds
  cost_spike: number; // Percentage change from baseline
  sla_violation: boolean;
  budget_exceeded: boolean;
  operation_failure_rate: number; // Percentage (0-100)
}

interface AlertRuleState {
  lastTriggeredAt?: number;
  lastValue?: number;
  windowValues: number[];
}

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

export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private ruleStates: Map<string, AlertRuleState> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private metricsBuffer: Map<string, MetricsSnapshot[]> = new Map();

  /**
   * Load all alert rules for a user
   */
  async loadRules(userId: string): Promise<void> {
    try {
      const { data, error } = await getDb()
        .from('alert_rules')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true);

      if (error) {
        console.error('[AlertEngine] Failed to load rules:', error);
        return;
      }

      for (const rule of data || []) {
        this.rules.set(rule.id, rule);
        this.initializeRuleState(rule.id);
      }

      console.log(`[AlertEngine] Loaded ${data?.length || 0} alert rules for user ${userId}`);
    } catch (error) {
      console.error('[AlertEngine] Error loading rules:', error);
    }
  }

  /**
   * Initialize state for a rule
   */
  private initializeRuleState(ruleId: string): void {
    if (!this.ruleStates.has(ruleId)) {
      this.ruleStates.set(ruleId, {
        windowValues: [],
      });
    }
  }

  /**
   * Add a metrics snapshot to the buffer
   */
  addMetricsSnapshot(userId: string, snapshot: MetricsSnapshot): void {
    const key = userId;
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }

    const buffer = this.metricsBuffer.get(key)!;
    buffer.push(snapshot);

    // Keep only recent snapshots (last 24 hours worth)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metricsBuffer.set(
      key,
      buffer.filter(s => s.timestamp > oneDayAgo)
    );
  }

  /**
   * Get metrics for a specific time window
   */
  private getMetricsForWindow(userId: string, window: TimeWindow): MetricsSnapshot[] {
    const buffer = this.metricsBuffer.get(userId) || [];
    const windowMs = this.parseWindow(window);
    const cutoffTime = Date.now() - windowMs;

    return buffer.filter(s => s.timestamp > cutoffTime);
  }

  /**
   * Parse time window to milliseconds
   */
  private parseWindow(window: TimeWindow): number {
    switch (window) {
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // Default to 1 hour
    }
  }

  /**
   * Get metric value from snapshots
   */
  private getMetricValue(snapshots: MetricsSnapshot[], metric: AlertMetric): number | null {
    if (snapshots.length === 0) return null;

    switch (metric) {
      case 'error_rate':
        // Average error rate across window
        return snapshots.reduce((sum, s) => sum + s.error_rate, 0) / snapshots.length;

      case 'latency_p95':
        // P95 latency
        const latencies = snapshots.map(s => s.latency_p95).sort((a, b) => a - b);
        const p95Index = Math.ceil(latencies.length * 0.95) - 1;
        return latencies[p95Index] || 0;

      case 'cost_spike':
        // Latest cost spike percentage
        return snapshots[snapshots.length - 1]?.cost_spike || 0;

      case 'sla_violation':
        // Return 1 if any snapshot has SLA violation, 0 otherwise
        return snapshots.some(s => s.sla_violation) ? 1 : 0;

      case 'budget_exceeded':
        // Return 1 if any snapshot has budget exceeded, 0 otherwise
        return snapshots.some(s => s.budget_exceeded) ? 1 : 0;

      case 'operation_failure_rate':
        // Average failure rate across window
        return snapshots.reduce((sum, s) => sum + s.operation_failure_rate, 0) / snapshots.length;

      default:
        return null;
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(metric: AlertMetric, value: number | null, condition: AlertCondition): boolean {
    if (value === null) return false;

    switch (condition.operator) {
      case '>':
        return value > (condition.threshold as number);

      case '<':
        return value < (condition.threshold as number);

      case '=':
        return value === (condition.threshold as number);

      case '!=':
        return value !== (condition.threshold as number);

      case 'between':
        const [min, max] = condition.threshold as [number, number];
        return value >= min && value <= max;

      default:
        return false;
    }
  }

  /**
   * Evaluate all rules for a user
   */
  async evaluateRulesForUser(userId: string): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.userId !== userId || !rule.enabled) continue;

      await this.evaluateRule(rule);
    }
  }

  /**
   * Evaluate a single rule
   */
  async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      // Get metrics for the rule's time window
      const snapshots = this.getMetricsForWindow(rule.userId, rule.condition.window);
      const metricValue = this.getMetricValue(snapshots, rule.condition.metric);

      // Evaluate condition
      const shouldAlert = this.evaluateCondition(rule.condition.metric, metricValue, rule.condition);

      if (!shouldAlert) {
        return;
      }

      // Check cooldown
      const state = this.ruleStates.get(rule.id);
      if (state?.lastTriggeredAt) {
        const timeSinceLastTrigger = Date.now() - state.lastTriggeredAt;
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;

        if (timeSinceLastTrigger < cooldownMs) {
          // Still in cooldown period
          return;
        }
      }

      // Trigger alert
      await this.triggerAlert(rule, metricValue || 0);

      // Update state
      if (state) {
        state.lastTriggeredAt = Date.now();
        state.lastValue = metricValue || 0;
      }
    } catch (error) {
      console.error('[AlertEngine] Error evaluating rule:', error);
    }
  }

  /**
   * Trigger alert through configured channels
   */
  private async triggerAlert(rule: AlertRule, metricValue: number): Promise<void> {
    const alert: Alert = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      userId: rule.userId,
      severity: rule.severity,
      title: rule.name,
      message: rule.description,
      metric: rule.condition.metric,
      metricValue,
      triggeredAt: new Date().toISOString(),
    };

    try {
      // Store alert in database
      await getDb().from('alerts').insert(alert);

      // Send through configured channels
      for (const channel of rule.channels) {
        await this.sendAlert(alert, channel, rule);
      }

      console.log(`[AlertEngine] Alert triggered for rule ${rule.id}: ${rule.name}`);
    } catch (error) {
      console.error('[AlertEngine] Error triggering alert:', error);
    }
  }

  /**
   * Send alert through a specific channel
   */
  private async sendAlert(alert: Alert, channel: AlertChannel, rule: AlertRule): Promise<void> {
    try {
      switch (channel) {
        case 'discord':
          await this.sendToDiscord(alert, rule);
          break;
        case 'email':
          await this.sendToEmail(alert, rule);
          break;
        case 'sms':
          await this.sendToSMS(alert, rule);
          break;
        case 'in_app':
          // In-app notifications are stored in alerts table already
          break;
      }
    } catch (error) {
      console.error(`[AlertEngine] Error sending alert via ${channel}:`, error);
    }
  }

  /**
   * Send alert to Discord
   */
  private async sendToDiscord(alert: Alert, rule: AlertRule): Promise<void> {
    const webhookUrl = process.env.DISCORD_ALERTS_WEBHOOK;
    if (!webhookUrl) {
      console.warn('[AlertEngine] Discord webhook not configured');
      return;
    }

    const color = {
      info: 3447003, // Blue
      warning: 16776960, // Yellow
      critical: 15158332, // Red
    }[alert.severity];

    const payload = {
      embeds: [
        {
          title: `🚨 ${alert.title}`,
          description: alert.message,
          color,
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Metric',
              value: alert.metric,
              inline: true,
            },
            {
              name: 'Value',
              value: alert.metricValue.toFixed(2),
              inline: true,
            },
            {
              name: 'Time Window',
              value: rule.condition.window,
              inline: true,
            },
          ],
          timestamp: alert.triggeredAt,
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Send alert via email (stub)
   */
  private async sendToEmail(alert: Alert, rule: AlertRule): Promise<void> {
    console.log(`[AlertEngine] Email alert: ${alert.title} (${alert.metric}=${alert.metricValue})`);
    // Email integration would go here
  }

  /**
   * Send alert via SMS (stub)
   */
  private async sendToSMS(alert: Alert, rule: AlertRule): Promise<void> {
    console.log(`[AlertEngine] SMS alert: ${alert.title} (${alert.metric}=${alert.metricValue})`);
    // SMS integration would go here
  }

  /**
   * Create a new alert rule
   */
  async createRule(userId: string, ruleData: Omit<AlertRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const rule: AlertRule = {
      ...ruleData,
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const { error } = await getDb().from('alert_rules').insert(rule);

      if (error) throw error;

      this.rules.set(rule.id, rule);
      this.initializeRuleState(rule.id);

      return rule;
    } catch (error) {
      console.error('[AlertEngine] Error creating rule:', error);
      throw error;
    }
  }

  /**
   * Update an alert rule
   */
  async updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updated = {
      ...rule,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      const { error } = await getDb().from('alert_rules').update(updated).eq('id', ruleId);

      if (error) throw error;

      this.rules.set(ruleId, updated);
      return updated;
    } catch (error) {
      console.error('[AlertEngine] Error updating rule:', error);
      throw error;
    }
  }

  /**
   * Delete an alert rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      const { error } = await getDb().from('alert_rules').delete().eq('id', ruleId);

      if (error) throw error;

      this.rules.delete(ruleId);
      this.ruleStates.delete(ruleId);

      return true;
    } catch (error) {
      console.error('[AlertEngine] Error deleting rule:', error);
      return false;
    }
  }

  /**
   * Get all rules for a user
   */
  async getRules(userId: string): Promise<AlertRule[]> {
    return Array.from(this.rules.values()).filter(r => r.userId === userId);
  }

  /**
   * Start periodic rule evaluation
   */
  startEvaluation(intervalMs: number = 60_000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      for (const userId of this.getUniqueUserIds()) {
        this.evaluateRulesForUser(userId).catch(err => {
          console.error('[AlertEngine] Error during evaluation loop:', err);
        });
      }
    }, intervalMs);

    console.log('[AlertEngine] Started evaluation loop (every ' + intervalMs / 1000 + 's)');
  }

  /**
   * Stop periodic rule evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[AlertEngine] Stopped evaluation loop');
    }
  }

  /**
   * Get unique user IDs from rules
   */
  private getUniqueUserIds(): string[] {
    return Array.from(new Set(Array.from(this.rules.values()).map(r => r.userId)));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await getDb()
        .from('alerts')
        .update({
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
        })
        .eq('id', alertId);
    } catch (error) {
      console.error('[AlertEngine] Error acknowledging alert:', error);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await getDb()
        .from('alerts')
        .update({
          resolvedAt: new Date().toISOString(),
        })
        .eq('id', alertId);
    } catch (error) {
      console.error('[AlertEngine] Error resolving alert:', error);
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
    try {
      const { data, error } = await getDb()
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('triggeredAt', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[AlertEngine] Error fetching alerts:', error);
      return [];
    }
  }
}

// Singleton instance
let alertEngine: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!alertEngine) {
    alertEngine = new AlertEngine();
  }
  return alertEngine;
}
