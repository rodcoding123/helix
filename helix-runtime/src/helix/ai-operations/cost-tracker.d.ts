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
export declare class CostTracker {
    logOperation(_userId: string, _log: OperationLog): Promise<void>;
    logOperation(_log: OperationLog): Promise<void>;
    getTotalCost(): Promise<number>;
}
//# sourceMappingURL=cost-tracker.d.ts.map