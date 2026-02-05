/**
 * Cost Tracker Type Stubs
 * These are type stubs for cross-project imports
 */

export interface OperationLog {
  id?: string;
  operation?: string;
  operation_type?: string;
  model?: string;
  cost?: number;
  timestamp?: number;
  [key: string]: unknown;
}

export class CostTracker {
  async logOperation(_userId: string, _log: OperationLog): Promise<void>;
  async logOperation(_log: OperationLog): Promise<void>;
  async logOperation(_userIdOrLog: string | OperationLog, _log?: OperationLog): Promise<void> {
    // No-op in helix-runtime context (type stub)
  }

  async getTotalCost(): Promise<number> {
    // No-op in helix-runtime context (type stub)
    return 0;
  }
}
