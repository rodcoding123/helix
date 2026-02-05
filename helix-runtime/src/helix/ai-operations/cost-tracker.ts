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
    throw new Error('Not implemented in type stub');
  }

  async getTotalCost(): Promise<number> {
    throw new Error('Not implemented in type stub');
  }
}
