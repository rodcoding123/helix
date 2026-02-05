/**
 * AI Operation Router Type Stubs
 * These are type stubs for cross-project imports
 */

export interface RoutingRequest {
  operation?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RoutingResponse {
  selected: string | undefined;
  model: string | undefined;
  cost: number | undefined;
  requiresApproval: boolean | undefined;
  estimatedCostUsd: number | undefined;
  [key: string]: unknown;
}

export class AIOperationRouter {
  async route(_request: RoutingRequest): Promise<RoutingResponse> {
    // No-op in helix-runtime context (type stub)
    return {
      selected: undefined,
      model: undefined,
      cost: undefined,
      requiresApproval: undefined,
      estimatedCostUsd: undefined,
    };
  }

  estimateCost(_model: string, _inputTokens: number, _outputTokens: number): number {
    // No-op in helix-runtime context (type stub)
    return 0;
  }
}
