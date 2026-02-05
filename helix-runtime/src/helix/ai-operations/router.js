/**
 * AI Operation Router Type Stubs
 * These are type stubs for cross-project imports
 */
export class AIOperationRouter {
    async route(_request) {
        // No-op in helix-runtime context (type stub)
        return {
            selected: undefined,
            model: undefined,
            cost: undefined,
            requiresApproval: undefined,
            estimatedCostUsd: undefined,
        };
    }
    estimateCost(_model, _inputTokens, _outputTokens) {
        // No-op in helix-runtime context (type stub)
        return 0;
    }
}
//# sourceMappingURL=router.js.map