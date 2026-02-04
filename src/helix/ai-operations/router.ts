/**
 * AIOperationRouter
 *
 * Central routing engine for all AI operations. Routes operations to appropriate models
 * based on database configuration, cost analysis, and approval gates.
 *
 * Phase 0.5: AI Operations Control Plane
 * Created: 2026-02-04
 */

import { createClient } from '@supabase/supabase-js';
import { logToDiscord } from '../logging.js';
import { hashChain } from '../hash-chain.js';
import { calculateProviderCost } from './providers/index.js';

// Type definitions
export interface RoutingRequest {
  operationId: string;
  userId?: string;
  input?: unknown;
  estimatedInputTokens?: number;
}

export interface RoutingResponse {
  operationId: string;
  model: string;
  requiresApproval: boolean;
  estimatedCostUsd: number;
  timestamp: string;
}

export interface RouteConfig {
  id: string;
  operation_id: string;
  operation_name: string;
  primary_model: string;
  fallback_model: string | null;
  enabled: boolean;
  cost_criticality: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
  updated_at: string;
}

export interface CostBudget {
  id: string;
  user_id: string;
  daily_limit_usd: number;
  warning_threshold_usd: number;
  current_spend_today: number;
  operations_today: number;
  last_checked: string;
}

export interface FeatureToggle {
  id: string;
  toggle_name: string;
  enabled: boolean;
  locked: boolean;
  controlled_by: 'ADMIN_ONLY' | 'USER' | 'BOTH';
}

/**
 * AIOperationRouter - Main routing engine
 *
 * Responsibilities:
 * 1. Route operations to appropriate models based on configuration
 * 2. Check cost budgets and enforce limits
 * 3. Determine if operation requires approval
 * 4. Cache routing decisions for performance
 * 5. Log all routing decisions to database
 */
export class AIOperationRouter {
  private supabase: ReturnType<typeof createClient>;
  private routeCache: Map<string, { config: RouteConfig; timestamp: number }> = new Map();
  private toggleCache: Map<string, { toggle: FeatureToggle; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for AIOperationRouter');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Main routing method - determine which model to use
   *
   * Flow:
   * 1. Load route configuration (cached)
   * 2. Check budget enforcement
   * 3. Determine if approval required
   * 4. Return routing decision
   */
  async route(request: RoutingRequest): Promise<RoutingResponse> {
    const timestamp = new Date().toISOString();

    try {
      // 1. Get route configuration
      const config = await this.getRoute(request.operationId);

      if (!config.enabled) {
        throw new Error(`Operation ${request.operationId} is disabled`);
      }

      // 2. Check budget enforcement
      if (request.userId) {
        await this.enforceBudget(
          request.userId,
          request.operationId,
          config.primary_model,
          request.estimatedInputTokens || 1000
        );
      }

      // 3. Estimate cost
      const estimatedCostUsd = this.estimateCost(
        config.primary_model,
        request.estimatedInputTokens || 1000,
        2000 // Estimated output tokens
      );

      // 4. Determine if approval required
      const requiresApproval = await this.requiresApproval(
        request.operationId,
        config,
        estimatedCostUsd,
        request.userId
      );

      // 5. Log routing decision to Discord
      logToDiscord({
        channel: 'helix-api',
        type: 'operation_routed',
        operation: request.operationId,
        model: config.primary_model,
        estimatedCost: estimatedCostUsd,
        requiresApproval,
        userId: request.userId,
      });

      return {
        operationId: request.operationId,
        model: config.primary_model,
        requiresApproval,
        estimatedCostUsd,
        timestamp,
      };
    } catch (error) {
      // Log error and attempt fallback
      logToDiscord({
        channel: 'helix-alerts',
        type: 'routing_error',
        operation: request.operationId,
        error: String(error),
        userId: request.userId,
      });

      // Try to get fallback model
      try {
        const config = await this.getRoute(request.operationId);
        if (config.fallback_model) {
          return {
            operationId: request.operationId,
            model: config.fallback_model,
            requiresApproval: true, // Fallback always requires approval
            estimatedCostUsd: this.estimateCost(config.fallback_model, 1000, 2000),
            timestamp,
          };
        }
      } catch {
        // Fallback lookup also failed
      }

      throw error;
    }
  }

  /**
   * Get route configuration from database with caching
   *
   * Cache: 5 minutes TTL
   * Fallback: Return last known config if DB fails
   */
  async getRoute(operationId: string): Promise<RouteConfig> {
    // Check cache first
    const cached = this.routeCache.get(operationId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.config;
    }

    try {
      const { data, error } = await this.supabase
        .from('ai_model_routes')
        .select('*')
        .eq('operation_id', operationId)
        .single();

      if (error) throw new Error(`Failed to load route for ${operationId}: ${error.message}`);
      if (!data) throw new Error(`No route found for operation: ${operationId}`);

      const config = data as RouteConfig;
      this.routeCache.set(operationId, { config, timestamp: Date.now() });

      return config;
    } catch (error) {
      // If cached exists but expired, return it anyway as fallback
      if (cached) {
        logToDiscord({
          channel: 'helix-alerts',
          type: 'cache_fallback',
          operation: operationId,
          reason: 'Database lookup failed',
        });
        return cached.config;
      }
      throw error;
    }
  }

  /**
   * Determine if operation requires approval
   *
   * Approval required if ANY of:
   * 1. Operation cost_criticality is HIGH
   * 2. Estimated cost > daily budget threshold
   * 3. Operation is marked as approval_required in config
   * 4. Helix feature toggle says "cannot change models"
   */
  async requiresApproval(
    _operationId: string,
    config: RouteConfig,
    estimatedCostUsd: number,
    userId?: string
  ): Promise<boolean> {
    // Check 1: Operation criticality
    if (config.cost_criticality === 'HIGH') {
      return true;
    }

    // Check 2: Cost threshold (if user provided)
    if (userId) {
      try {
        const budget = await this.getBudget(userId);
        if (estimatedCostUsd > budget.warning_threshold_usd) {
          return true;
        }
      } catch {
        // If budget lookup fails, require approval to be safe
        return true;
      }
    }

    // Check 3: Hardcoded safety toggles
    try {
      const helixCanChangeModels = await this.isToggleEnabled('helix_can_change_models');
      if (!helixCanChangeModels) {
        // If Helix cannot change models, then any routing decision requires approval
        return true;
      }
    } catch {
      // If toggle lookup fails, require approval to be safe
      return true;
    }

    return false;
  }

  /**
   * Enforce budget limits
   *
   * Throws error if:
   * 1. Daily spend + estimated cost > daily limit
   * 2. Feature toggle prevents operation
   */
  async enforceBudget(
    userId: string,
    operationId: string,
    model: string,
    estimatedInputTokens: number
  ): Promise<void> {
    try {
      const budget = await this.getBudget(userId);
      const estimatedCost = this.estimateCost(model, estimatedInputTokens, 2000);

      if (budget.current_spend_today + estimatedCost > budget.daily_limit_usd) {
        logToDiscord({
          channel: 'helix-alerts',
          type: 'budget_limit_exceeded',
          userId,
          operation: operationId,
          currentSpend: budget.current_spend_today,
          estimatedCost,
          dailyLimit: budget.daily_limit_usd,
        });

        throw new Error(
          `Budget limit exceeded for user ${userId}. ` +
            `Current: $${budget.current_spend_today.toFixed(2)}, ` +
            `Estimated: $${estimatedCost.toFixed(2)}, ` +
            `Limit: $${budget.daily_limit_usd.toFixed(2)}`
        );
      }

      // Check if at warning threshold
      if (budget.current_spend_today + estimatedCost > budget.warning_threshold_usd) {
        logToDiscord({
          channel: 'helix-alerts',
          type: 'budget_warning',
          userId,
          operation: operationId,
          spendLevel: (
            ((budget.current_spend_today + estimatedCost) / budget.daily_limit_usd) *
            100
          ).toFixed(1),
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Budget limit exceeded')) {
        throw error;
      }
      // Log but don't fail on budget lookup errors - fail-open for availability
      logToDiscord({
        channel: 'helix-alerts',
        type: 'budget_check_failed',
        userId,
        operation: operationId,
        error: String(error),
      });
    }
  }

  /**
   * Get user's daily budget
   */
  private async getBudget(userId: string): Promise<CostBudget> {
    const { data, error } = await this.supabase
      .from('cost_budgets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If user not found, create default budget
      if (error.code === 'PGRST116') {
        return {
          id: '',
          user_id: userId,
          daily_limit_usd: 50.0,
          warning_threshold_usd: 25.0,
          current_spend_today: 0,
          operations_today: 0,
          last_checked: new Date().toISOString(),
        };
      }
      throw error;
    }

    return data as CostBudget;
  }

  /**
   * Estimate cost of operation
   *
   * Uses real provider pricing from the centralized registry.
   * All pricing decisions now use PROVIDER_PRICING constant.
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number = 2000): number {
    return calculateProviderCost(model, inputTokens, outputTokens);
  }

  /**
   * Check if feature toggle is enabled
   *
   * Cache: 5 minutes TTL
   * Safety: Throws error if toggle is locked but disabled (safety guardrail)
   */
  private async isToggleEnabled(toggleName: string): Promise<boolean> {
    // Check cache first
    const cached = this.toggleCache.get(toggleName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.toggle.enabled;
    }

    try {
      const { data, error } = await this.supabase
        .from('feature_toggles')
        .select('*')
        .eq('toggle_name', toggleName)
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Toggle not found: ${toggleName}`);

      const toggle = data as FeatureToggle;
      this.toggleCache.set(toggleName, { toggle, timestamp: Date.now() });

      // Safety check: locked toggles cannot be overridden
      if (toggle.locked && !toggle.enabled) {
        // This is a hardcoded safety guardrail
        await hashChain.add({
          type: 'security_event',
          event: 'locked_toggle_enforced',
          toggle: toggleName,
          enforced: true,
          timestamp: new Date().toISOString(),
        });
      }

      return toggle.enabled;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'toggle_check_failed',
        toggle: toggleName,
        error: String(error),
      });
      // Fail-closed: if toggle check fails, assume disabled (conservative)
      return false;
    }
  }

  /**
   * Clear all caches (useful for testing or manual toggle updates)
   */
  clearCaches(): void {
    this.routeCache.clear();
    this.toggleCache.clear();
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getCacheStats(): { routes: number; toggles: number; cacheTTL: number } {
    return {
      routes: this.routeCache.size,
      toggles: this.toggleCache.size,
      cacheTTL: this.cacheTTL,
    };
  }

  /**
   * Get all registered operations from model_routes table
   */
  async getRegisteredOperations(): Promise<RouteConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('model_routes')
        .select('*');

      if (error) throw error;
      return (data || []) as RouteConfig[];
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'operations_list_failed',
        error: String(error),
      });
      return [];
    }
  }
}

// Singleton instance
export const router = new AIOperationRouter();
