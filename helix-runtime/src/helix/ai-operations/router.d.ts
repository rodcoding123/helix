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
export declare class AIOperationRouter {
    route(_request: RoutingRequest): Promise<RoutingResponse>;
    estimateCost(_model: string, _inputTokens: number, _outputTokens: number): number;
}
//# sourceMappingURL=router.d.ts.map