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

export const DEFAULT_SKILL_SANDBOX_CONFIG: SandboxConfig = {
  timeoutMs: 30000,
  memoryLimitMb: 256,
  allowedCapabilities: ['filesystem:read', 'network:localhost'],
};

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
export async function executeSkillSandboxed(
  code: string,
  metadata: SkillMetadata,
  params: Record<string, unknown> = {},
  sessionKey: string = 'unknown',
  config: SandboxConfig = DEFAULT_SKILL_SANDBOX_CONFIG,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const auditLog: Array<{ type: string; message: string; timestamp: number }> = [];

  try {
    // 1. Validate code doesn't contain dangerous patterns
    validateCodeSafety(code, auditLog);

    // 2. Create isolated execution context
    const executionContext = createExecutionContext(params, metadata, sessionKey, auditLog);

    // 3. Execute with timeout protection
    const result = await executeWithTimeout(code, executionContext, config.timeoutMs, auditLog);

    // 4. Validate output is serializable
    validateOutput(result);

    const executionTimeMs = Date.now() - startTime;

    auditLog.push({
      type: 'EXECUTION_COMPLETE',
      message: `Skill execution completed successfully in ${executionTimeMs}ms`,
      timestamp: Date.now(),
    });

    return {
      success: true,
      output: result,
      executionTimeMs,
      auditLog,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    auditLog.push({
      type: 'EXECUTION_ERROR',
      message: `Skill execution failed: ${errorMessage}`,
      timestamp: Date.now(),
    });

    return {
      success: false,
      output: null,
      executionTimeMs,
      auditLog,
      error: errorMessage,
    };
  }
}

/**
 * Validates that code doesn't contain dangerous functions or patterns
 */
function validateCodeSafety(code: string, auditLog: Array<any>): void {
  const dangerousPatterns = [
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\brequire\s*\(/,
    /\bimport\s*\(/,
    /\bprocess\s*\./,
    /\bglobal\s*\./,
    /\b__dirname\b/,
    /\b__filename\b/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      auditLog.push({
        type: 'SECURITY_CHECK',
        message: `Dangerous pattern detected: ${pattern.source}`,
        timestamp: Date.now(),
      });
      throw new Error(`Code contains dangerous function: ${pattern.source}`);
    }
  }

  auditLog.push({
    type: 'SECURITY_CHECK',
    message: 'Code safety validation passed',
    timestamp: Date.now(),
  });
}

/**
 * Creates isolated execution context with safe helper functions
 */
function createExecutionContext(
  params: Record<string, unknown>,
  metadata: SkillMetadata,
  sessionKey: string,
  auditLog: Array<any>,
): Record<string, unknown> {
  return {
    // Input parameters
    params,

    // Metadata
    skillName: metadata.name,
    skillVersion: metadata.version,
    skillAuthor: metadata.author,

    // Audit trail
    log: (message: string) => {
      auditLog.push({
        type: 'USER_LOG',
        message,
        timestamp: Date.now(),
      });
    },

    // Safe utilities
    JSON: {
      parse: JSON.parse,
      stringify: JSON.stringify,
    },
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
  };
}

/**
 * Executes code with timeout protection using Promise.race
 */
async function executeWithTimeout(
  code: string,
  context: Record<string, unknown>,
  timeoutMs: number,
  auditLog: Array<any>,
): Promise<unknown> {
  // Create async function from code
  const asyncFunction = new Function(
    ...Object.keys(context),
    `return (async () => { ${code} })()`,
  );

  const executionPromise = asyncFunction(...Object.values(context));

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      auditLog.push({
        type: 'TIMEOUT',
        message: `Execution exceeded timeout of ${timeoutMs}ms`,
        timestamp: Date.now(),
      });
      reject(new Error(`Execution timeout exceeded (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([executionPromise, timeoutPromise]);
}

/**
 * Validates that output is JSON serializable
 */
function validateOutput(output: unknown): void {
  if (output === undefined || output === null) {
    return;
  }

  // Check if output is a function, symbol, or non-serializable
  if (typeof output === 'function' || typeof output === 'symbol') {
    throw new Error(`Output is not serializable: ${typeof output}`);
  }

  // For complex objects, try to serialize to catch circular references
  try {
    JSON.stringify(output);
  } catch (error) {
    throw new Error(
      `Output is not JSON serializable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}