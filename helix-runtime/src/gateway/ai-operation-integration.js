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
import { AIOperationRouter } from '../helix/ai-operations/router.js';
import { CostTracker } from '../helix/ai-operations/cost-tracker.js';
import { ApprovalGate } from '../helix/ai-operations/approval-gate.js';
import { logToDiscord } from '../helix/logging.js';
import { hashChain } from '../helix/hash-chain.js';
// Singleton instances
let router = null;
let costTracker = null;
let approvalGate = null;
function getRouter() {
    if (!router) {
        router = new AIOperationRouter();
    }
    return router;
}
function getCostTracker() {
    if (!costTracker) {
        costTracker = new CostTracker();
    }
    return costTracker;
}
function getApprovalGate() {
    if (!approvalGate) {
        approvalGate = new ApprovalGate();
    }
    return approvalGate;
}
/**
 * Gateway Operation Execution Context
 * Tracks timing, tokens, and other metrics for an operation
 */
export class OperationContext {
    operationId;
    operationType;
    userId;
    startTime = Date.now();
    routingResponse;
    inputTokens = 0;
    outputTokens = 0;
    success = false;
    errorMessage;
    costUsd = 0;
    qualityScore;
    constructor(operationId, operationType, userId) {
        this.operationId = operationId;
        this.operationType = operationType;
        this.userId = userId;
    }
    get latencyMs() {
        return Date.now() - this.startTime;
    }
    /**
     * Get the routing decision for this operation
     * (route() must be called first via executeWithRouting)
     */
    getModel() {
        if (!this.routingResponse) {
            throw new Error('Route decision not available - call executeWithRouting first');
        }
        return this.routingResponse.model || '';
    }
    requiresApproval() {
        if (!this.routingResponse) {
            throw new Error('Route decision not available - call executeWithRouting first');
        }
        return this.routingResponse.requiresApproval || false;
    }
    estimatedCost() {
        if (!this.routingResponse) {
            throw new Error('Route decision not available - call executeWithRouting first');
        }
        return this.routingResponse.estimatedCostUsd || 0;
    }
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
export async function executeWithRouting(context, handler) {
    const timestamp = new Date().toISOString();
    const routerInstance = getRouter();
    try {
        // 1. Route the operation
        context.routingResponse = await routerInstance.route({
            operationId: context.operationId,
            userId: context.userId,
            estimatedInputTokens: context.inputTokens,
        });
        // 2. Check if approval required and request if needed
        if (context.requiresApproval()) {
            const approvalGateInstance = getApprovalGate();
            const approval = await approvalGateInstance.requestApproval(context.operationId, context.operationType, context.estimatedCost(), `Requires approval for ${context.operationType}`, context.userId || '');
            // Add approval request to hash chain
            await hashChain.add({
                type: 'approval_requested_by_gateway',
                approval_id: approval.id,
                operation_id: context.operationId,
                operation_type: context.operationType,
                cost_impact_usd: context.estimatedCost(),
                timestamp,
            });
        }
        // 3. Execute the operation with the selected model
        const result = await handler(context.getModel());
        context.success = true;
        return result;
    }
    catch (error) {
        context.success = false;
        context.errorMessage = error instanceof Error ? error.message : String(error);
        // Log error to Discord and hash chain
        await logToDiscord({
            channel: 'helix-alerts',
            type: 'gateway_operation_error',
            operation: context.operationId,
            operationType: context.operationType,
            userId: context.userId,
            error: context.errorMessage,
        });
        throw error;
    }
    finally {
        // 4. Log operation cost after completion (success or failure)
        await logOperationCost(context);
    }
}
/**
 * Log the cost of a completed operation
 *
 * Adds to:
 * - CostTracker database table (ai_operation_log)
 * - Hash chain for immutable record
 * - Discord for real-time monitoring
 */
async function logOperationCost(context) {
    const costTrackerInstance = getCostTracker();
    const timestamp = new Date().toISOString();
    try {
        // Calculate final cost (use routing estimate if actual cost not available)
        const finalCost = context.costUsd || context.estimatedCost();
        // 1. Log to CostTracker
        const operationLog = {
            operation_type: context.operationType,
            operation_id: context.operationId,
            model_used: context.routingResponse?.model || 'unknown',
            user_id: context.userId,
            input_tokens: context.inputTokens,
            output_tokens: context.outputTokens,
            cost_usd: finalCost,
            latency_ms: context.latencyMs,
            quality_score: context.qualityScore,
            success: context.success,
            error_message: context.errorMessage,
        };
        await costTrackerInstance.logOperation(context.userId || '', operationLog);
        // 2. Add to hash chain
        await hashChain.add({
            type: 'gateway_operation_logged',
            operation_id: context.operationId,
            operation_type: context.operationType,
            model: context.routingResponse?.model,
            cost_usd: finalCost,
            latency_ms: context.latencyMs,
            success: context.success,
            timestamp,
        });
        // 3. Log to Discord if successful
        if (context.success) {
            await logToDiscord({
                channel: 'helix-api',
                type: 'gateway_operation_completed',
                operation: context.operationId,
                operationType: context.operationType,
                costUsd: finalCost.toFixed(6),
                latencyMs: context.latencyMs,
                tokens: context.inputTokens + context.outputTokens,
                userId: context.userId,
            });
        }
    }
    catch (error) {
        // Log failures to alerts but don't block operation
        await logToDiscord({
            channel: 'helix-alerts',
            type: 'cost_logging_failed',
            operation: context.operationId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Execute an operation with cost tracking (without routing)
 *
 * Use this for low-cost or non-AI operations that don't need routing/approval
 *
 * @param context Operation context
 * @param handler Function that executes the operation
 * @returns The handler's return value
 */
export async function executeWithCostTracking(context, handler) {
    try {
        const result = await handler();
        context.success = true;
        return result;
    }
    catch (error) {
        context.success = false;
        context.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
    }
    finally {
        await logOperationCost(context);
    }
}
/**
 * Get the estimated cost for an operation before execution
 *
 * Useful for providing cost feedback to clients
 *
 * @param operationId Operation identifier
 * @param userId User making the request
 * @param estimatedInputTokens Expected input token count
 */
export async function getEstimatedCost(operationId, userId, estimatedInputTokens = 1000) {
    const routerInstance = getRouter();
    const response = await routerInstance.route({
        operationId,
        userId,
        estimatedInputTokens,
    });
    return {
        estimatedCostUsd: response.estimatedCostUsd || 0,
        model: response.model || '',
    };
}
/**
 * Check if an operation requires approval before execution
 *
 * @param operationId Operation identifier
 * @param userId User making the request
 */
export async function checkApprovalRequired(operationId, userId) {
    const routerInstance = getRouter();
    const response = await routerInstance.route({
        operationId,
        userId,
        estimatedInputTokens: 1000,
    });
    return response.requiresApproval || false;
}
//# sourceMappingURL=ai-operation-integration.js.map