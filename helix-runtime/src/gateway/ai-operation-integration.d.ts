/**
 * AI Operation Integration for Gateway Methods
 *
 * This module provides helper functions to integrate gateway server methods with:
 * - AIOperationRouter (for model selection and approval routing)
 * - CostTracker (for logging operation costs)
 * - ApprovalGate (for high-cost operation approvals)
 *
 * Phase 0.5: AI Operations Control Plane
 * Created: 2026-02-04
 */
import { type RoutingResponse } from '../helix/ai-operations/router.js';
/**
 * Gateway Operation Execution Context
 * Tracks timing, tokens, and other metrics for an operation
 */
export declare class OperationContext {
    readonly operationId: string;
    readonly operationType: string;
    readonly userId?: string;
    readonly startTime: number;
    routingResponse?: RoutingResponse;
    inputTokens: number;
    outputTokens: number;
    success: boolean;
    errorMessage?: string;
    costUsd: number;
    qualityScore?: number;
    constructor(operationId: string, operationType: string, userId?: string);
    get latencyMs(): number;
    /**
     * Get the routing decision for this operation
     * (route() must be called first via executeWithRouting)
     */
    getModel(): string;
    requiresApproval(): boolean;
    estimatedCost(): number;
}
/**
 * Execute an operation with full AI operation integration
 *
 * This wrapper:
 * 1. Routes operation through AIOperationRouter
 * 2. Checks if approval is required
 * 3. Executes the operation handler
 * 4. Logs cost to CostTracker
 * 5. Adds to hash chain for integrity
 *
 * @param context Operation context with tracking metadata
 * @param handler Function that executes the operation
 * @returns The handler's return value
 */
export declare function executeWithRouting<T>(context: OperationContext, handler: (model: string) => Promise<T>): Promise<T>;
/**
 * Execute an operation with cost tracking (without routing)
 *
 * Use this for low-cost or non-AI operations that don't need routing/approval
 *
 * @param context Operation context
 * @param handler Function that executes the operation
 * @returns The handler's return value
 */
export declare function executeWithCostTracking<T>(context: OperationContext, handler: () => Promise<T>): Promise<T>;
/**
 * Get the estimated cost for an operation before execution
 *
 * Useful for providing cost feedback to clients
 *
 * @param operationId Operation identifier
 * @param userId User making the request
 * @param estimatedInputTokens Expected input token count
 */
export declare function getEstimatedCost(operationId: string, userId?: string, estimatedInputTokens?: number): Promise<{
    estimatedCostUsd: number;
    model: string;
}>;
/**
 * Check if an operation requires approval before execution
 *
 * @param operationId Operation identifier
 * @param userId User making the request
 */
export declare function checkApprovalRequired(operationId: string, userId?: string): Promise<boolean>;
//# sourceMappingURL=ai-operation-integration.d.ts.map