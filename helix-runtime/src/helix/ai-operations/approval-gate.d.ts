/**
 * Approval Gate Type Stubs
 * These are type stubs for cross-project imports
 */
export declare class ApprovalGate {
    checkApproval(_operation: string, _cost?: number): Promise<boolean>;
    requestApproval(operationId: string, _operationType: string, _cost: number, _reason: string, _userId: string): Promise<{
        id: string;
        approved: boolean;
    }>;
}
//# sourceMappingURL=approval-gate.d.ts.map