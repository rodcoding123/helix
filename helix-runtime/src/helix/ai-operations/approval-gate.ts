/**
 * Approval Gate Type Stubs
 * These are type stubs for cross-project imports
 */

export class ApprovalGate {
  async checkApproval(_operation: string, _cost?: number): Promise<boolean> {
    // No-op in helix-runtime context (type stub)
    // Default to approved for testing
    return true;
  }

  async requestApproval(
    operationId: string,
    _operationType: string,
    _cost: number,
    _reason: string,
    _userId: string
  ): Promise<{ id: string; approved: boolean }> {
    // No-op in helix-runtime context (type stub)
    // Default to approved for testing
    return { id: operationId, approved: true };
  }
}
