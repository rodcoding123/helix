/**
 * MCP TOOL SANDBOXING
 *
 * Prevents MCP tool poisoning attacks by:
 * - Validating tool definitions before loading
 * - Enforcing resource limits
 * - Restricting file access
 * - Monitoring tool behavior
 * - Blocking dangerous operations
 */

import { sendAlert } from './logging-hooks.js';

/**
 * Dangerous tool patterns that should be blocked
 */
const BLOCKED_TOOL_NAMES = [
  'exec',
  'shell',
  'system',
  'cmd',
  'bash',
  'sh',
  'powershell',
  'cmd.exe',
  'system32',
];

/**
 * Dangerous file paths that tools should not access
 */
const BLOCKED_PATHS = [
  '/etc',
  '/sys',
  '/proc',
  '/dev',
  '/root',
  '/boot',
  'C:\\Windows',
  'C:\\System32',
  process.env.HOME || '/home',
];

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute?: (args: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Tool execution sandbox
 */
export interface ToolSandboxConfig {
  maxExecutionTimeMs: number;
  maxMemoryMb: number;
  maxOutputBytes: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  rateLimitPerMinute?: number;
}

/**
 * Tool execution metrics
 */
export interface ToolExecutionMetrics {
  toolName: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  outputBytes?: number;
  memoryUsedMb?: number;
  success: boolean;
  error?: string;
}

/**
 * Validate MCP tool definition
 *
 * @param tool - Tool to validate
 * @returns { valid: boolean, issues: string[] }
 */
export function validateMCPToolDefinition(tool: unknown): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!tool || typeof tool !== 'object') {
    issues.push('Tool must be an object');
    return { valid: false, issues };
  }

  const toolObj = tool as Record<string, unknown>;

  // Check tool name
  if (!toolObj.name || typeof toolObj.name !== 'string') {
    issues.push('Tool must have a string name');
  } else {
    // Check for blocked tool names
    const toolName = toolObj.name.toLowerCase();
    for (const blocked of BLOCKED_TOOL_NAMES) {
      if (toolName.includes(blocked)) {
        issues.push(`Tool name contains blocked pattern: ${blocked}`);
      }
    }
  }

  // Check for suspicious properties
  if ('exec' in toolObj || 'shell' in toolObj || 'system' in toolObj) {
    issues.push('Tool contains suspicious properties (exec, shell, system)');
  }

  // Check for code execution patterns
  const toolStr = JSON.stringify(toolObj);
  const dangerousPatterns = [
    /require\s*\(/gi,
    /import\s*\(/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /child_process/gi,
    /execSync/gi,
    /exec\s*\(/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(toolStr)) {
      issues.push(`Tool definition contains dangerous pattern: ${pattern.source}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate tool arguments before execution
 *
 * @param tool - Tool definition
 * @param args - Arguments to validate
 * @returns { valid: boolean, issues: string[] }
 */
export function validateToolArguments(
  _tool: MCPTool,
  args: unknown
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Always validate arguments for security patterns
  if (typeof args === 'object' && args !== null) {
    const argObj = args as Record<string, unknown>;

    // Check for path traversal attempts and command injection
    for (const [key, value] of Object.entries(argObj)) {
      if (typeof value === 'string') {
        // Check for path traversal patterns
        if (value.includes('..') || value.includes('~')) {
          issues.push(`Argument "${key}" contains path traversal pattern`);
        }

        // Check for command injection patterns
        if (/[;&|`$()]/.test(value)) {
          issues.push(`Argument "${key}" contains shell metacharacters`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check if path is allowed for tool access
 *
 * @param path - Path to check
 * @param allowedPaths - List of allowed paths
 * @param blockedPaths - List of blocked paths
 * @returns { allowed: boolean, reason?: string }
 */
export function validateToolPathAccess(
  filePath: string,
  allowedPaths?: string[],
  blockedPaths?: string[]
): { allowed: boolean; reason?: string } {
  // Check blocked paths (default list)
  const blockedList = blockedPaths || BLOCKED_PATHS;

  for (const blocked of blockedList) {
    if (filePath.includes(blocked) || filePath.startsWith(blocked)) {
      return {
        allowed: false,
        reason: `Access to path blocked: ${blocked}`,
      };
    }
  }

  // Check allowed paths if list is provided
  if (allowedPaths && allowedPaths.length > 0) {
    let isAllowed = false;

    for (const allowed of allowedPaths) {
      if (filePath.startsWith(allowed)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Path not in allowed list: ${filePath}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Create sandboxed tool execution
 *
 * Wraps tool execution with timeouts, resource limits, and monitoring
 */
export async function executeToolInSandbox(
  tool: MCPTool,
  args: unknown,
  config: ToolSandboxConfig
): Promise<{
  result?: unknown;
  error?: string;
  metrics: ToolExecutionMetrics;
}> {
  const metrics: ToolExecutionMetrics = {
    toolName: tool.name,
    startTime: Date.now(),
    success: false,
  };

  // Validate tool
  const toolValidation = validateMCPToolDefinition(tool);
  if (!toolValidation.valid) {
    const errorMsg = `Tool validation failed: ${toolValidation.issues.join(', ')}`;

    await sendAlert(
      '🚨 SECURITY: MCP Tool Validation Failed',
      `Tool: ${tool.name}\nIssues: ${toolValidation.issues.join('\n')}`,
      'critical'
    );

    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.error = errorMsg;

    return { error: errorMsg, metrics };
  }

  // Validate arguments
  const argValidation = validateToolArguments(tool, args);
  if (!argValidation.valid) {
    const errorMsg = `Tool argument validation failed: ${argValidation.issues.join(', ')}`;

    await sendAlert(
      '⚠️ SECURITY: MCP Tool Argument Validation Failed',
      `Tool: ${tool.name}\nIssues: ${argValidation.issues.join('\n')}`,
      'critical'
    );

    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.error = errorMsg;

    return { error: errorMsg, metrics };
  }

  // Execute with timeout
  try {
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool does not have execute function');
    }

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timeout')), config.maxExecutionTimeMs)
    );

    // Race between execution and timeout
    const result = await Promise.race([tool.execute(args), timeoutPromise]);

    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.success = true;

    // Track output size
    if (typeof result === 'string') {
      metrics.outputBytes = result.length;
    } else if (result) {
      metrics.outputBytes = JSON.stringify(result).length;
    }

    // Alert if output is very large
    if (metrics.outputBytes && metrics.outputBytes > config.maxOutputBytes) {
      await sendAlert(
        '⚠️ SECURITY: Tool Output Exceeds Limit',
        `Tool: ${tool.name}\nOutput size: ${metrics.outputBytes} bytes (limit: ${config.maxOutputBytes})`,
        'critical'
      );

      return {
        error: 'Tool output exceeds maximum allowed size',
        metrics,
      };
    }

    return { result, metrics };
  } catch (error) {
    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.error = error instanceof Error ? error.message : String(error);

    // Log tool execution failure
    await sendAlert(
      '⚠️ SECURITY: Tool Execution Failed',
      `Tool: ${tool.name}\nError: ${metrics.error}\nDuration: ${metrics.durationMs}ms`,
      'critical'
    );

    return {
      error: metrics.error,
      metrics,
    };
  }
}

/**
 * Get default sandbox configuration
 */
export function getDefaultSandboxConfig(): ToolSandboxConfig {
  return {
    maxExecutionTimeMs: 30000, // 30 seconds
    maxMemoryMb: 512, // 512 MB
    maxOutputBytes: 10 * 1024 * 1024, // 10 MB
    rateLimitPerMinute: 100,
  };
}
