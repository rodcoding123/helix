/**
 * Policy Engine
 *
 * Evaluates channel policies to make routing and blocking decisions.
 * Supports DM allowlists, group policies, and custom rule evaluation.
 * 
 * Decision hierarchy (first match wins):
 * 1. Account-specific policy
 * 2. Channel-specific policy
 * 3. Global default policy
 */

import { randomUUID } from 'crypto';
import type {
  PolicyConfig,
  PolicyRule,
  PolicyEvaluationResult,
  PolicyDecision,
  DmPolicyMode,
  GroupPolicyMode,
  POLICY_PROFILES,
} from './types.js';

export class PolicyEngine {
  private policies: Map<string, PolicyConfig> = new Map();
  private decisions: PolicyDecision[] = [];
  private decisionLimit = 10000; // Keep last 10k decisions in memory

  /**
   * Set policy for a scope
   */
  setPolicy(scope: string, config: PolicyConfig): void {
    this.policies.set(scope, config);
  }

  /**
   * Get policy for a scope (with fallback to parent scopes)
   */
  getPolicy(
    channelId: string,
    accountId?: string,
    scope: 'account' | 'channel' | 'global' = 'global'
  ): PolicyConfig | null {
    // Try account-specific first
    if (accountId) {
      const accountKey = `${channelId}:${accountId}`;
      const policy = this.policies.get(accountKey);
      if (policy) return policy;
    }

    // Try channel-specific
    const channelPolicy = this.policies.get(channelId);
    if (channelPolicy) return channelPolicy;

    // Fall back to global
    const globalPolicy = this.policies.get('global');
    return globalPolicy || null;
  }

  /**
   * Evaluate if a DM should be allowed
   */
  evaluateDmPolicy(
    channelId: string,
    sender: string,
    accountId?: string
  ): PolicyEvaluationResult {
    const config = this.getPolicy(channelId, accountId);
    if (!config) {
      return {
        allowed: true,
        actions: [],
        reason: 'No policy configured',
        confidence: 0.5,
      };
    }

    const { dmPolicy, customRules } = config;

    // Check custom rules first (highest priority)
    for (const rule of customRules.sort((a, b) => b.priority - a.priority)) {
      if (!rule.enabled) continue;

      const ruleMatch = this.evaluateRule(rule, {
        sender,
        channel: channelId,
        type: 'dm',
      });

      if (ruleMatch) {
        const result: PolicyEvaluationResult = {
          allowed: rule.actions.some(a => a.type === 'allow'),
          actions: rule.actions,
          matchedRule: rule,
          reason: `Matched rule: ${rule.name}`,
          confidence: 0.95,
        };

        this.logDecision({
          id: randomUUID(),
          timestamp: Date.now(),
          channelId,
          sender,
          type: 'dm',
          result,
          responseTimeMs: 0,
        });

        return result;
      }
    }

    // Apply DM policy mode
    switch (dmPolicy.mode) {
      case 'disabled':
        return {
          allowed: false,
          actions: [{ type: 'block' }],
          reason: 'DM disabled for this channel',
          confidence: 1.0,
        };

      case 'pairing': {
        // Only allow if sender is known (paired)
        const isPaired = await this.isSenderPaired(channelId, sender);
        return {
          allowed: isPaired,
          actions: isPaired ? [{ type: 'allow' }] : [{ type: 'block' }],
          reason: isPaired ? 'Sender is paired' : 'Sender requires pairing',
          confidence: 0.9,
          requiresApproval: !isPaired,
        };
      }

      case 'allowlist': {
        const isAllowed = dmPolicy.allowlist?.includes(sender) ?? false;
        return {
          allowed: isAllowed,
          actions: isAllowed ? [{ type: 'allow' }] : [{ type: 'block' }],
          reason: isAllowed ? 'Sender in allowlist' : 'Sender not in allowlist',
          confidence: 1.0,
          requiresApproval: !isAllowed,
        };
      }

      case 'open':
        return {
          allowed: true,
          actions: [{ type: 'allow' }],
          reason: 'DM policy is open',
          confidence: 1.0,
        };

      default:
        return {
          allowed: true,
          actions: [],
          reason: 'Unknown policy mode',
          confidence: 0.3,
        };
    }
  }

  /**
   * Evaluate if a group message should be allowed
   */
  evaluateGroupPolicy(
    channelId: string,
    groupId: string,
    accountId?: string
  ): PolicyEvaluationResult {
    const config = this.getPolicy(channelId, accountId);
    if (!config) {
      return {
        allowed: true,
        actions: [],
        reason: 'No policy configured',
        confidence: 0.5,
      };
    }

    const { groupPolicy } = config;

    // Apply group policy mode
    switch (groupPolicy.mode) {
      case 'allowlist': {
        const isAllowed = groupPolicy.allowlist?.includes(groupId) ?? false;
        return {
          allowed: isAllowed,
          actions: isAllowed ? [{ type: 'allow' }] : [{ type: 'block' }],
          reason: isAllowed ? 'Group in allowlist' : 'Group not in allowlist',
          confidence: 1.0,
        };
      }

      case 'open':
        return {
          allowed: true,
          actions: [{ type: 'allow' }],
          reason: 'Group policy is open',
          confidence: 1.0,
        };

      default:
        return {
          allowed: true,
          actions: [],
          reason: 'Unknown policy mode',
          confidence: 0.3,
        };
    }
  }

  /**
   * Check if a sender is paired (implementation depends on channel)
   */
  private async isSenderPaired(channelId: string, sender: string): Promise<boolean> {
    // This would call into channel-specific pairing logic
    // For now, return false (all unpaired)
    return false;
  }

  /**
   * Evaluate if a custom rule matches
   */
  private evaluateRule(
    rule: PolicyRule,
    context: Record<string, unknown>
  ): boolean {
    return rule.conditions.every(condition => {
      const contextValue = context[condition.type];
      if (!contextValue) return false;

      const operator = condition.operator || 'equals';

      switch (operator) {
        case 'equals':
          return contextValue === condition.value;
        case 'contains':
          return String(contextValue).includes(String(condition.value));
        case 'matches': {
          const pattern = new RegExp(condition.value as string);
          return pattern.test(String(contextValue));
        }
        case 'in':
          return (condition.value as unknown[]).includes(contextValue);
        case 'greater':
          return (contextValue as number) > (condition.value as number);
        case 'less':
          return (contextValue as number) < (condition.value as number);
        default:
          return false;
      }
    });
  }

  /**
   * Log a policy decision
   */
  private logDecision(decision: PolicyDecision): void {
    this.decisions.push(decision);
    if (this.decisions.length > this.decisionLimit) {
      this.decisions.shift();
    }
  }

  /**
   * Get decision history for a channel
   */
  getDecisions(channelId: string, limit = 100): PolicyDecision[] {
    return this.decisions
      .filter(d => d.channelId === channelId)
      .slice(-limit);
  }

  /**
   * Clear all decisions (for testing)
   */
  clearDecisions(): void {
    this.decisions = [];
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
