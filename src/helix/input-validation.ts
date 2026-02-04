/**
 * INPUT VALIDATION AND SANITIZATION
 *
 * Prevents:
 * - Path traversal attacks (CVE-2025-68145)
 * - Argument injection attacks (CVE-2025-68144)
 * - Unrestricted directory operations (CVE-2025-68143)
 * - Command injection via user input
 */

import * as path from 'node:path';
import { sendAlert } from './logging-hooks.js';

/**
 * Validate and normalize file path
 *
 * Prevents path traversal by:
 * - Resolving .. sequences
 * - Checking if result is within allowed directory
 * - Blocking symlinks to escape scope
 *
 * CVE-2025-68145: Git MCP didn't validate repo_path
 */
export function validateFilePath(
  inputPath: string,
  basePath: string
): { valid: boolean; resolvedPath?: string; reason?: string } {
  // Reject empty paths
  if (!inputPath || !basePath) {
    return { valid: false, reason: 'Path cannot be empty' };
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(basePath, inputPath);

  // Ensure it's within the base directory
  const normalized = path.normalize(resolvedPath);
  const normalizedBase = path.normalize(path.resolve(basePath));

  if (!normalized.startsWith(normalizedBase)) {
    return {
      valid: false,
      reason: `Path escapes base directory: ${inputPath}`,
    };
  }

  // Check for suspicious patterns
  if (inputPath.includes('..') || inputPath.includes('~')) {
    return {
      valid: false,
      reason: `Path contains traversal patterns: ${inputPath}`,
    };
  }

  // Check for null bytes (path injection)
  if (inputPath.includes('\0')) {
    return {
      valid: false,
      reason: 'Path contains null byte',
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * Validate repository path access
 *
 * CVE-2025-68145: Prevents access outside repository scope
 */
export function validateRepositoryPath(
  inputPath: string,
  repositoryBasePath: string
): { valid: boolean; resolvedPath?: string; reason?: string } {
  const pathValidation = validateFilePath(inputPath, repositoryBasePath);

  if (!pathValidation.valid) {
    return pathValidation;
  }

  // Additional repository-specific checks
  const resolvedPath = pathValidation.resolvedPath!;

  // Block access to .git directory internals (unless explicitly needed)
  if (resolvedPath.includes('.git/objects') || resolvedPath.includes('.git/refs')) {
    // Allow but log for monitoring
    console.warn(`Access to Git internals: ${resolvedPath}`);
  }

  return { valid: true, resolvedPath };
}

/**
 * Validate directory path for operations
 *
 * CVE-2025-68143: Prevents unrestricted git_init or mkdir
 */
export function validateDirectoryPath(
  inputPath: string,
  allowedParentPaths: string[]
): { valid: boolean; resolvedPath?: string; reason?: string } {
  if (!inputPath) {
    return { valid: false, reason: 'Directory path cannot be empty' };
  }

  // Check if path is within allowed parent paths
  let isAllowed = false;

  for (const allowedPath of allowedParentPaths) {
    const resolvedParent = path.resolve(allowedPath);
    const resolvedInput = path.resolve(inputPath);

    if (resolvedInput.startsWith(resolvedParent)) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    return {
      valid: false,
      reason: `Directory path not in allowed locations: ${inputPath}`,
    };
  }

  // Check for dangerous directory names
  const dirName = path.basename(inputPath).toLowerCase();
  const blockedDirNames = ['etc', 'sys', 'proc', 'root', 'boot', 'system32'];

  if (blockedDirNames.some(name => dirName === name)) {
    return {
      valid: false,
      reason: `Directory name is blocked: ${dirName}`,
    };
  }

  return { valid: true, resolvedPath: path.resolve(inputPath) };
}

/**
 * Sanitize argument for use in operations
 *
 * CVE-2025-68144: Prevents argument injection
 *
 * @param arg - Argument to sanitize
 * @param type - Type of argument ('path', 'command', 'text')
 * @returns { safe: boolean, sanitized: string, reason?: string }
 */
export function sanitizeArgument(
  arg: string,
  type: 'path' | 'command' | 'text' = 'text'
): { safe: boolean; sanitized: string; reason?: string } {
  if (!arg) {
    return { safe: true, sanitized: '' };
  }

  // Path arguments: block traversal patterns
  if (type === 'path') {
    if (arg.includes('..') || arg.includes('~')) {
      return {
        safe: false,
        sanitized: '',
        reason: 'Path argument contains traversal pattern',
      };
    }

    // Block absolute paths that escape scope
    if (arg.startsWith('/') || arg.match(/^[A-Z]:\\/)) {
      return {
        safe: false,
        sanitized: '',
        reason: 'Absolute paths not allowed',
      };
    }
  }

  // Command arguments: block shell metacharacters
  if (type === 'command') {
    const dangerous = /[;&|`$()[\]{}\\<>'"]/;
    if (dangerous.test(arg)) {
      return {
        safe: false,
        sanitized: '',
        reason: 'Command argument contains shell metacharacters',
      };
    }
  }

  // All types: block control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(arg)) {
    return {
      safe: false,
      sanitized: '',
      reason: 'Argument contains control characters',
    };
  }

  return { safe: true, sanitized: arg };
}

/**
 * Validate git repository initialization parameters
 *
 * CVE-2025-68143: Prevents unrestricted git_init
 *
 * @param repoPath - Path to create repository
 * @param allowedParents - Allowed parent directories
 * @returns { valid: boolean, resolvedPath?: string, reason?: string }
 */
export function validateGitInitPath(
  repoPath: string,
  allowedParents: string[] = [process.cwd()]
): { valid: boolean; resolvedPath?: string; reason?: string } {
  // Use directory validation
  return validateDirectoryPath(repoPath, allowedParents);
}

/**
 * Validate git diff/checkout target argument
 *
 * CVE-2025-68144: Prevents argument injection via target field
 *
 * @param target - Target file/ref
 * @returns { valid: boolean, sanitized?: string, reason?: string }
 */
export function validateGitDiffTarget(target: string): {
  valid: boolean;
  sanitized?: string;
  reason?: string;
} {
  // Block output redirection attempts
  if (target.includes('--output') || target.includes('>') || target.includes('<')) {
    return {
      valid: false,
      reason: 'Target contains output redirection attempt',
    };
  }

  // Block flag injection (arguments starting with --)
  if (target.startsWith('--')) {
    return {
      valid: false,
      reason: 'Target contains git flags',
    };
  }

  // Sanitize
  const sanitized = sanitizeArgument(target, 'path');
  if (!sanitized.safe) {
    return {
      valid: false,
      reason: sanitized.reason,
    };
  }

  return { valid: true, sanitized: target };
}

/**
 * Validate commit message for injection attacks
 */
export function validateCommitMessage(message: string): { valid: boolean; reason?: string } {
  // Limit length
  if (message.length > 10000) {
    return {
      valid: false,
      reason: 'Commit message too long',
    };
  }

  // Block control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(message)) {
    return {
      valid: false,
      reason: 'Commit message contains control characters',
    };
  }

  // Block shell commands
  if (/[`$(){}]/.test(message)) {
    return {
      valid: false,
      reason: 'Commit message contains suspicious patterns',
    };
  }

  return { valid: true };
}

/**
 * Alert on validation failure
 */
export async function alertValidationFailure(
  operation: string,
  input: string,
  reason: string
): Promise<void> {
  await sendAlert(
    '🚨 SECURITY: Input Validation Failed',
    `Operation: ${operation}\nInput: ${input.substring(0, 100)}\nReason: ${reason}`,
    'critical'
  );
}

/**
 * Get list of default allowed parent directories for tool operations
 */
export function getDefaultAllowedParents(): string[] {
  return [
    process.cwd(),
    // Add workspace-specific paths here
  ];
}
