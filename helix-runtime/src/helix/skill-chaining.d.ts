/**
 * Composite Skill Chaining Engine
 *
 * Enables multi-step workflow execution with:
 * - Sequential and conditional step execution
 * - Data passing between steps using JSONPath
 * - Error handling and retry logic
 * - Comprehensive execution tracking
 */
export interface SkillStep {
    stepId: string;
    toolName: string;
    description?: string;
    inputMapping?: Record<string, string>;
    outputMapping?: string;
    condition?: string;
    errorHandling?: 'stop' | 'continue' | 'retry';
    retryAttempts?: number;
}
export interface CompositeSkill {
    id: string;
    name: string;
    description?: string;
    steps: SkillStep[];
    version?: string;
}
export interface StepResult {
    stepId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    executionTimeMs: number;
}
export interface CompositeSkillExecutionResult {
    success: boolean;
    skillId: string;
    stepResults: StepResult[];
    finalOutput: unknown;
    executionContext: Record<string, unknown>;
    executionTimeMs: number;
    stepsCompleted: number;
    totalSteps: number;
}
/**
 * Validates a composite skill definition
 */
export declare function validateCompositeSkill(skill: CompositeSkill): {
    valid: boolean;
    errors: string[];
};
/**
 * Function signature for tool execution
 * Can be implemented to call mock tools, gateway RPC, or other execution backends
 */
export interface ToolExecutor {
    (toolName: string, params: Record<string, unknown>): Promise<unknown>;
}
/**
 * Executes a composite skill with multi-step workflow
 *
 * @param skill - Composite skill definition
 * @param input - Initial input data
 * @param toolExecutor - Function to execute individual tools (supports both mock and real execution)
 * @returns Execution result with all step outputs and final output
 */
export declare function executeCompositeSkill(skill: CompositeSkill, input?: Record<string, unknown>, toolExecutor?: ToolExecutor): Promise<CompositeSkillExecutionResult>;
//# sourceMappingURL=skill-chaining.d.ts.map