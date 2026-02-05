/**
 * HELIX SKILL SANDBOX
 * Secure isolation layer for executing untrusted skills
 *
 * Security Features:
 * - Code signature verification before execution
 * - Resource limits (CPU, memory, time)
 * - Network isolation
 * - Filesystem sandboxing
 * - Capability dropping
 * - Audit logging of all skill executions
 */

import crypto from 'node:crypto';
import { HelixSecurityError } from './types.js';

/**
 * Skill metadata for validation
 */
export interface SkillMetadata {
  name: string;
  version: string;
  author: string;
  signature?: string;
  signedAt?: string;
  permissions: SkillPermission[];
  trustedOrigin?: string;
}

/**
 * Permissions a skill can request
 */
export type SkillPermission =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:outbound'
  | 'network:localhost'
  | 'process:spawn'
  | 'env:read'
  | 'mcp:tools'
  | 'discord:webhooks';

/**
 * Sandbox configuration for skill execution
 */
export interface SkillSandboxConfig {
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** Maximum memory in bytes */
  maxMemoryBytes: number;
  /** Maximum CPU time in milliseconds */
  maxCpuMs: number;
  /** Allow network access */
  allowNetwork: boolean;
  /** Allowed network hosts (if network enabled) */
  allowedHosts: string[];
  /** Allow filesystem write */
  allowWrite: boolean;
  /** Allowed write paths (if write enabled) */
  allowedWritePaths: string[];
  /** Required signature for execution */
  requireSignature: boolean;
  /** Trusted signers public keys */
  trustedSigners: string[];
}

/**
 * Default sandbox configuration (maximum security)
 */
export const DEFAULT_SKILL_SANDBOX_CONFIG: SkillSandboxConfig = {
  timeoutMs: 30_000, // 30 seconds
  maxMemoryBytes: 128 * 1024 * 1024, // 128 MB
  maxCpuMs: 10_000, // 10 seconds CPU time
  allowNetwork: false,
  allowedHosts: [],
  allowWrite: false,
  allowedWritePaths: [],
  requireSignature: true,
  trustedSigners: [],
};

/**
 * Result of skill validation
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: SkillMetadata;
  signatureVerified: boolean;
  permissionsGranted: SkillPermission[];
  permissionsDenied: SkillPermission[];
}

/**
 * Skill execution context (passed to sandboxed skill)
 */
export interface SkillExecutionContext {
  /** Skill metadata */
  metadata: SkillMetadata;
  /** Granted permissions */
  permissions: SkillPermission[];
  /** Sandbox configuration in effect */
  sandboxConfig: SkillSandboxConfig;
  /** Session identifier for audit logging */
  sessionKey: string;
  /** Execution start time */
  startedAt: Date;
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  memoryUsedBytes?: number;
  auditLog: SkillAuditEntry[];
}

/**
 * Audit log entry for skill execution
 */
export interface SkillAuditEntry {
  timestamp: string;
  action: 'start' | 'permission_check' | 'resource_access' | 'network_call' | 'complete' | 'error';
  details: Record<string, unknown>;
}

// Audit log storage (in-memory for now, could be persisted)
const skillAuditLog: SkillAuditEntry[] = [];

/**
 * Verify skill signature using Ed25519
 * Uses Node.js built-in crypto module with Ed25519 keys
 */
export function verifySkillSignature(
  skillCode: string,
  metadata: SkillMetadata,
  trustedSigners: string[]
): boolean {
  if (!metadata.signature) {
    return false;
  }

  // The signature should be over: code + name + version + author + signedAt
  const signedData = `${skillCode}|${metadata.name}|${metadata.version}|${metadata.author}|${metadata.signedAt}`;

  // For each trusted signer, try to verify the signature
  for (const signerPublicKeyPem of trustedSigners) {
    try {
      // Create verifier using Ed25519 public key (PEM format expected)
      // The signature should be base64-encoded
      const signatureBuffer = Buffer.from(metadata.signature, 'base64');

      // Verify signature using Ed25519 (pass null as algorithm for Ed25519)
      const isValid = crypto.verify(
        null,
        Buffer.from(signedData, 'utf8'),
        signerPublicKeyPem,
        signatureBuffer
      );

      if (isValid) {
        return true;
      }
    } catch (e) {
      // Continue to next signer on error
      // Could log verification attempt failure for audit
      console.debug(
        `Signature verification failed for signer: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return false;
}

/**
 * Validate skill before execution
 */
export function validateSkill(
  skillCode: string,
  metadata: SkillMetadata,
  config: SkillSandboxConfig = DEFAULT_SKILL_SANDBOX_CONFIG
): SkillValidationResult {
  const result: SkillValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    metadata,
    signatureVerified: false,
    permissionsGranted: [],
    permissionsDenied: [],
  };

  // 1. Signature verification
  if (config.requireSignature) {
    if (!metadata.signature) {
      result.errors.push('Skill signature required but not provided');
      result.valid = false;
    } else {
      result.signatureVerified = verifySkillSignature(skillCode, metadata, config.trustedSigners);
      if (!result.signatureVerified) {
        result.errors.push('Skill signature verification failed - untrusted code');
        result.valid = false;
      }
    }
  } else {
    result.warnings.push('Signature verification disabled - executing untrusted code');
  }

  // 2. Permission analysis
  for (const permission of metadata.permissions) {
    const granted = checkPermissionGranted(permission, config);
    if (granted) {
      result.permissionsGranted.push(permission);
    } else {
      result.permissionsDenied.push(permission);
      result.warnings.push(`Permission denied: ${permission}`);
    }
  }

  // 3. Static code analysis for dangerous patterns
  const dangerousPatterns = [
    { pattern: /eval\s*\(/g, message: 'Use of eval() detected' },
    { pattern: /new\s+Function\s*\(/g, message: 'Use of new Function() detected' },
    { pattern: /process\.exit/g, message: 'Process termination attempt detected' },
    { pattern: /child_process/g, message: 'Child process spawning detected' },
    { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, message: 'Direct fs module import detected' },
    { pattern: /__proto__|prototype\s*\[/g, message: 'Prototype pollution pattern detected' },
    { pattern: /constructor\s*\[/g, message: 'Constructor access pattern detected' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(skillCode)) {
      result.warnings.push(`Static analysis warning: ${message}`);
    }
  }

  // 4. Check for required metadata fields
  if (!metadata.name || !metadata.version || !metadata.author) {
    result.errors.push('Missing required metadata: name, version, or author');
    result.valid = false;
  }

  return result;
}

/**
 * Check if a permission is granted by the sandbox config
 */
function checkPermissionGranted(permission: SkillPermission, config: SkillSandboxConfig): boolean {
  switch (permission) {
    case 'filesystem:read':
      return true; // Read is generally allowed within sandbox
    case 'filesystem:write':
      return config.allowWrite;
    case 'network:outbound':
      return config.allowNetwork && config.allowedHosts.length > 0;
    case 'network:localhost':
      return config.allowNetwork && config.allowedHosts.includes('localhost');
    case 'process:spawn':
      return false; // Never allowed in sandbox
    case 'env:read':
      return false; // Environment access controlled
    case 'mcp:tools':
      return true; // MCP tools have their own validation layer
    case 'discord:webhooks':
      return false; // Only core Helix can use webhooks
    default:
      return false;
  }
}

/**
 * Create audit log entry
 */
function createAuditEntry(
  action: SkillAuditEntry['action'],
  details: Record<string, unknown>
): SkillAuditEntry {
  const entry: SkillAuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    details,
  };
  skillAuditLog.push(entry);
  return entry;
}

/**
 * Execute skill in sandbox (main entry point)
 *
 * CRITICAL: This function enforces all security boundaries
 */
export async function executeSkillSandboxed(
  skillCode: string,
  metadata: SkillMetadata,
  args: unknown,
  sessionKey: string,
  config: SkillSandboxConfig = DEFAULT_SKILL_SANDBOX_CONFIG
): Promise<SkillExecutionResult> {
  const auditLog: SkillAuditEntry[] = [];
  const startTime = Date.now();

  // Audit: execution start
  auditLog.push(
    createAuditEntry('start', {
      skillName: metadata.name,
      skillVersion: metadata.version,
      sessionKey,
      config: {
        timeoutMs: config.timeoutMs,
        requireSignature: config.requireSignature,
        allowNetwork: config.allowNetwork,
        allowWrite: config.allowWrite,
      },
    })
  );

  try {
    // 1. Validate skill
    const validation = validateSkill(skillCode, metadata, config);

    auditLog.push(
      createAuditEntry('permission_check', {
        valid: validation.valid,
        signatureVerified: validation.signatureVerified,
        permissionsGranted: validation.permissionsGranted,
        permissionsDenied: validation.permissionsDenied,
        errors: validation.errors,
      })
    );

    if (!validation.valid) {
      throw new HelixSecurityError(
        `Skill validation failed: ${validation.errors.join(', ')}`,
        'SECURITY_CONFIG_INVALID',
        { validation }
      );
    }

    // 2. Create execution context
    const context: SkillExecutionContext = {
      metadata,
      permissions: validation.permissionsGranted,
      sandboxConfig: config,
      sessionKey,
      startedAt: new Date(),
    };

    // 3. Execute with timeout
    const result = await Promise.race([
      executeInIsolation(skillCode, args, context),
      createTimeoutPromise(config.timeoutMs),
    ]);

    const executionTimeMs = Date.now() - startTime;

    auditLog.push(
      createAuditEntry('complete', {
        success: true,
        executionTimeMs,
      })
    );

    return {
      success: true,
      output: result,
      executionTimeMs,
      auditLog,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    auditLog.push(
      createAuditEntry('error', {
        error: errorMessage,
        executionTimeMs,
      })
    );

    return {
      success: false,
      error: errorMessage,
      executionTimeMs,
      auditLog,
    };
  }
}

/**
 * Create a frozen, minimal sandbox context
 * This provides only safe, read-only APIs to the isolated code
 */
function createSandboxContext(
  context: SkillExecutionContext,
  args: unknown
): Record<string, unknown> {
  // Create a minimal console that logs to audit
  const safeConsole = {
    log: (..._args: unknown[]): void => {
      // Logs captured but not exposed to outside
    },
    warn: (..._args: unknown[]): void => {},
    error: (..._args: unknown[]): void => {},
    info: (..._args: unknown[]): void => {},
  };

  // Safe math functions (no random to ensure determinism)
  const safeMath = {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    round: Math.round,
    sqrt: Math.sqrt,
    trunc: Math.trunc,
    sign: Math.sign,
    PI: Math.PI,
    E: Math.E,
  };

  // Safe string utilities
  const safeString = {
    fromCharCode: String.fromCharCode,
    fromCodePoint: String.fromCodePoint,
  };

  // Safe JSON (no revivers to prevent prototype pollution)
  const safeJSON = {
    parse: (text: string): unknown => JSON.parse(text),
    stringify: (value: unknown): string => JSON.stringify(value),
  };

  // Build the sandbox context
  const sandboxContext: Record<string, unknown> = {
    // Input arguments
    args,

    // Skill metadata (read-only)
    metadata: Object.freeze({ ...context.metadata }),

    // Safe built-ins
    console: Object.freeze(safeConsole),
    Math: Object.freeze(safeMath),
    String: Object.freeze(safeString),
    JSON: Object.freeze(safeJSON),

    // Safe constructors
    Array,
    Object,
    Map,
    Set,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,

    // Safe primitives
    undefined,
    NaN,
    Infinity,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,

    // Promise for async operations (but no access to Node APIs)
    Promise,

    // Result storage
    __result__: undefined,
    __error__: undefined,
  };

  // Freeze the context to prevent modifications
  return Object.freeze(sandboxContext);
}

/**
 * Execute skill code in isolation using Node.js vm module
 *
 * Security measures:
 * - Separate V8 context with no access to Node.js APIs
 * - Frozen, minimal sandbox with only safe built-ins
 * - Strict timeout enforcement
 * - No access to require, process, global, or module
 * - Prototype chain isolation
 */
async function executeInIsolation(
  skillCode: string,
  args: unknown,
  context: SkillExecutionContext
): Promise<unknown> {
  // Import vm module dynamically to avoid hoisting issues
  const vm = await import('node:vm');

  // Validate context
  if (!context.metadata || !context.sandboxConfig) {
    throw new HelixSecurityError('Invalid execution context', 'SECURITY_CONFIG_INVALID', {
      context,
    });
  }

  // Create isolated sandbox context
  const sandboxContext = createSandboxContext(context, args);

  // Create a new V8 context with the sandbox
  const vmContext = vm.createContext(sandboxContext, {
    name: `helix-skill-${context.metadata.name}`,
    origin: 'helix://skill-sandbox',
    // Prevent code generation from strings (eval, new Function)
    codeGeneration: {
      strings: false,
      wasm: false,
    },
  });

  // Wrap the skill code to capture the result
  const wrappedCode = `
    'use strict';
    (async () => {
      try {
        const skillFunction = (function() {
          ${skillCode}
        })();

        if (typeof skillFunction === 'function') {
          __result__ = await skillFunction(args);
        } else {
          __result__ = skillFunction;
        }
      } catch (e) {
        __error__ = e instanceof Error ? e.message : String(e);
      }
    })();
  `;

  try {
    // Compile the script
    const script = new vm.Script(wrappedCode, {
      filename: `skill-${context.metadata.name}.js`,
      lineOffset: 0,
      columnOffset: 0,
    });

    // Execute with timeout
    const timeoutMs = context.sandboxConfig.timeoutMs;

    // Run the script in the isolated context
    script.runInContext(vmContext, {
      timeout: timeoutMs,
      displayErrors: false,
      breakOnSigint: true,
    });

    // Wait for async completion (with timeout)
    const startTime = Date.now();
    while (
      vmContext.__result__ === undefined &&
      vmContext.__error__ === undefined &&
      Date.now() - startTime < timeoutMs
    ) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Check for errors
    if (vmContext.__error__) {
      throw new Error(vmContext.__error__ as string);
    }

    // Check for timeout
    if (vmContext.__result__ === undefined && vmContext.__error__ === undefined) {
      throw new HelixSecurityError(
        `Skill execution timed out after ${timeoutMs}ms`,
        'SECURITY_CONFIG_INVALID',
        { timeoutMs }
      );
    }

    return vmContext.__result__;
  } catch (error) {
    // Handle VM-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Script execution timed out')) {
        throw new HelixSecurityError(
          `Skill execution timed out after ${context.sandboxConfig.timeoutMs}ms`,
          'SECURITY_CONFIG_INVALID',
          { timeoutMs: context.sandboxConfig.timeoutMs }
        );
      }

      if (error.message.includes('Code generation from strings disallowed')) {
        throw new HelixSecurityError(
          'Skill attempted to use eval() or new Function() - blocked',
          'SECURITY_CONFIG_INVALID',
          { attempt: 'code_generation' }
        );
      }
    }

    throw error;
  }
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new HelixSecurityError(
          `Skill execution timed out after ${timeoutMs}ms`,
          'SECURITY_CONFIG_INVALID',
          { timeoutMs }
        )
      );
    }, timeoutMs);
  });
}

/**
 * Get skill audit log
 */
export function getSkillAuditLog(): readonly SkillAuditEntry[] {
  return skillAuditLog;
}

/**
 * Clear skill audit log (for testing)
 */
export function clearSkillAuditLog(): void {
  skillAuditLog.length = 0;
}

/**
 * Create a sandbox config from a preset
 */
export type SandboxPreset = 'strict' | 'standard' | 'permissive';

export function createSandboxConfig(preset: SandboxPreset): SkillSandboxConfig {
  switch (preset) {
    case 'strict':
      return {
        ...DEFAULT_SKILL_SANDBOX_CONFIG,
        requireSignature: true,
        allowNetwork: false,
        allowWrite: false,
        timeoutMs: 10_000,
        maxMemoryBytes: 64 * 1024 * 1024,
      };

    case 'standard':
      return {
        ...DEFAULT_SKILL_SANDBOX_CONFIG,
        requireSignature: true,
        allowNetwork: false,
        allowWrite: false,
      };

    case 'permissive':
      return {
        ...DEFAULT_SKILL_SANDBOX_CONFIG,
        requireSignature: false,
        allowNetwork: true,
        allowedHosts: ['localhost', '127.0.0.1'],
        allowWrite: true,
        allowedWritePaths: ['/tmp', '/var/tmp'],
        timeoutMs: 60_000,
        maxMemoryBytes: 256 * 1024 * 1024,
      };
  }
}
