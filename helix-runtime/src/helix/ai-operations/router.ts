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
  route(_request: RoutingRequest): Promise<RoutingResponse> {
    throw new Error('Not implemented in type stub');
  }

  estimateCost(_model: string, _inputTokens: number, _outputTokens: number): number {
    throw new Error('Not implemented in type stub');
  }
}
