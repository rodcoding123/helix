/**
 * Approval Gate Type Stubs
 * These are type stubs for cross-project imports
 */
export class ApprovalGate {
    async checkApproval(_operation, _cost) {
        // No-op in helix-runtime context (type stub)
        // Default to approved for testing
        return true;
    }
    async requestApproval(operationId, _operationType, _cost, _reason, _userId) {
        // No-op in helix-runtime context (type stub)
        // Default to approved for testing
        return { id: operationId, approved: true };
    }
}
//# sourceMappingURL=approval-gate.js.map