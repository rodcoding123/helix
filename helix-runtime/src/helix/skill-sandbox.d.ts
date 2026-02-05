/**
 * Skill Sandbox Execution Engine
 *
 * Provides secure, isolated execution of custom tools and skills with:
 * - Resource limits (CPU time, memory)
 * - Permission-based capability restrictions
 * - Comprehensive audit logging
 * - Error handling and timeout protection
 */
export interface SkillMetadata {
    name: string;
    version: string;
    author: string;
    permissions?: string[];
}
export interface SandboxConfig {
    timeoutMs: number;
    memoryLimitMb: number;
    allowedCapabilities: string[];
}
export interface ExecutionResult {
    success: boolean;
    output: unknown;
    executionTimeMs: number;
    auditLog: Array<{
        type: string;
        message: string;
        timestamp: number;
    }>;
    error?: string;
}
export declare const DEFAULT_SKILL_SANDBOX_CONFIG: SandboxConfig;
/**
 * Executes a skill in a sandboxed environment
 *
 * @param code - JavaScript function body to execute
 * @param metadata - Skill metadata (name, version, author)
 * @param params - Input parameters for the skill
 * @param sessionKey - Session key for audit logging
 * @param config - Sandbox configuration
 * @returns Execution result with output and audit log
 */
export declare function executeSkillSandboxed(code: string, metadata: SkillMetadata, params?: Record<string, unknown>, sessionKey?: string, config?: SandboxConfig): Promise<ExecutionResult>;
//# sourceMappingURL=skill-sandbox.d.ts.map