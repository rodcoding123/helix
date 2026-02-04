/**
 * Phase 8: AI Router Client
 * Client-side connection to Phase 0.5 AIOperationRouter
 * Handles routing requests, cost tracking, and approval gates
 */

import type { AIOperationRouter } from '../../lib/ai-router';

/**
 * Singleton instance of the router client
 * Lazily initialized on first use
 */
let routerInstance: AIRouterClient | null = null;

/**
 * Get or create the router client instance
 */
export function getRouterClient(): AIRouterClient {
  if (!routerInstance) {
    routerInstance = new AIRouterClient();
  }
  return routerInstance;
}

/**
 * Exported router client for use by intelligence services
 */
export const aiRouter = {
  route: async (request: RoutingRequest) => {
    const client = getRouterClient();
    return client.route(request);
  },
  execute: async (operationId: string, input: unknown) => {
    const client = getRouterClient();
    return client.execute(operationId, input);
  },
  checkApproval: async (operationId: string) => {
    const client = getRouterClient();
    return client.checkApproval(operationId);
  },
  getBudgetStatus: async (userId: string) => {
    const client = getRouterClient();
    return client.getBudgetStatus(userId);
  },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RoutingRequest {
  operationId: string;
  userId: string;
  input: Record<string, unknown>;
  estimatedInputTokens: number;
}

export interface RoutingResponse {
  operationId: string;
  model: string;
  requiresApproval: boolean;
  estimatedCostUsd: number;
  cacheKey?: string;
}

export interface ApprovalRequest {
  operationId: string;
  userId: string;
  estimatedCost: number;
  reason: string;
}

export interface BudgetStatus {
  dailyLimit: number;
  currentSpend: number;
  remaining: number;
  percentUsed: number;
  operationsToday: number;
}

// ============================================================================
// ROUTER CLIENT IMPLEMENTATION
// ============================================================================

class AIRouterClient {
  private baseUrl: string;
  private userId: string | null = null;
  private routeCache: Map<string, { response: RoutingResponse; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Get API endpoint from environment or use default
    this.baseUrl = import.meta.env.VITE_AI_ROUTER_URL || 'http://localhost:3000/api/ai-router';
  }

  /**
   * Set the current user ID for routing requests
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Route an operation to the appropriate model
   * Checks cache, applies cost limits, and handles approval gates
   */
  async route(request: RoutingRequest): Promise<RoutingResponse> {
    if (!request.userId) {
      throw new Error('userId is required for routing');
    }

    // Check cache
    const cacheKey = this.buildCacheKey(request.operationId, request.userId);
    const cached = this.routeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.response;
    }

    try {
      // Call router endpoint
      const response = await fetch(`${this.baseUrl}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: request.operationId,
          user_id: request.userId,
          estimated_tokens: request.estimatedInputTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Router error: ${response.statusText}`);
      }

      const data = await response.json();
      const routingResponse: RoutingResponse = {
        operationId: data.operation_id,
        model: data.primary_model,
        requiresApproval: data.requires_approval || false,
        estimatedCostUsd: data.estimated_cost_usd,
        cacheKey,
      };

      // Cache the response
      this.routeCache.set(cacheKey, {
        response: routingResponse,
        timestamp: Date.now(),
      });

      return routingResponse;
    } catch (error) {
      console.error('Routing error:', error);
      // Fallback to default model
      return {
        operationId: request.operationId,
        model: 'deepseek',
        requiresApproval: false,
        estimatedCostUsd: 0.01,
      };
    }
  }

  /**
   * Execute an operation through the router
   * Handles full lifecycle: route → approve (if needed) → execute → track cost
   */
  async execute(operationId: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this.userId) {
      throw new Error('User not set. Call setUserId() first.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operationId,
          user_id: this.userId,
          input,
        }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error('Insufficient budget. Cost limit reached.');
        }
        throw new Error(`Execution error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Execution error:', error);
      throw error;
    }
  }

  /**
   * Check if an operation requires approval
   */
  async checkApproval(operationId: string): Promise<boolean> {
    if (!this.userId) {
      throw new Error('User not set. Call setUserId() first.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/approval/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operationId,
          user_id: this.userId,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.requires_approval || false;
    } catch (error) {
      console.error('Approval check error:', error);
      return false;
    }
  }

  /**
   * Get the current user's budget status
   */
  async getBudgetStatus(userId: string): Promise<BudgetStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error('Budget check failed');
      }

      const data = await response.json();
      return {
        dailyLimit: data.daily_limit_usd,
        currentSpend: data.current_spend_today,
        remaining: data.daily_limit_usd - data.current_spend_today,
        percentUsed: (data.current_spend_today / data.daily_limit_usd) * 100,
        operationsToday: data.operations_today,
      };
    } catch (error) {
      console.error('Budget status error:', error);
      // Return default budget
      return {
        dailyLimit: 50,
        currentSpend: 0,
        remaining: 50,
        percentUsed: 0,
        operationsToday: 0,
      };
    }
  }

  /**
   * Get all registered operations
   */
  async getRegisteredOperations(): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/operations`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Operations list error:', error);
      return [];
    }
  }

  /**
   * Get operation cost estimates
   */
  async getOperationCosts(operationId: string): Promise<{ estimated: number; actual: number; lastCall: Date | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/costs/${operationId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        return { estimated: 0, actual: 0, lastCall: null };
      }

      const data = await response.json();
      return {
        estimated: data.estimated_cost,
        actual: data.actual_average_cost,
        lastCall: data.last_call ? new Date(data.last_call) : null,
      };
    } catch (error) {
      console.error('Cost info error:', error);
      return { estimated: 0, actual: 0, lastCall: null };
    }
  }

  /**
   * Clear the routing cache
   */
  clearCache(): void {
    this.routeCache.clear();
  }

  /**
   * Build a cache key for a routing request
   */
  private buildCacheKey(operationId: string, userId: string): string {
    return `${operationId}:${userId}`;
  }
}
