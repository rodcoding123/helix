/**
 * Approval Gate Type Stubs
 * These are type stubs for cross-project imports
 */

export class ApprovalGate {
  async checkApproval(_operation: string, _cost?: number): Promise<boolean> {
    throw new Error('Not implemented in type stub');
  }

  async requestApproval(
    _operationId: string,
    _operationType: string,
    _cost: number,
    _reason: string,
    _userId: string
  ): Promise<{ id: string; approved: boolean }> {
    throw new Error('Not implemented in type stub');
  }
}
