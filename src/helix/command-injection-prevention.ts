/**
 * COMMAND INJECTION PREVENTION
 *
 * Prevents shell command injection attacks (CVE-2026-25157) by:
 * - Sanitizing all user inputs before shell execution
 * - Using safe argument passing (no shell interpretation)
 * - Blocking dangerous characters and patterns
 * - Validating command whitelist
 */

import { spawn, exec } from 'node:child_process';
import { sendAlert } from './logging-hooks.js';

/**
 * Dangerous shell metacharacters that can break out of arguments
 */
const DANGEROUS_CHARS = [
  ';', // Command separator
  '|', // Pipe
  '&', // Background/AND
  '$', // Variable expansion
  '`', // Command substitution
  '\\', // Escape character
  '"', // Quote
  "'", // Quote
  '<', // Redirection
  '>', // Redirection
  '*', // Glob
  '?', // Glob
  '~', // Home directory
  '(', // Subshell
  ')', // Subshell
  '[', // Glob/array
  ']', // Glob/array
  '{', // Expansion
  '}', // Expansion
  '\n', // Newline (command injection vector)
  '\r', // Carriage return
];

/**
 * Dangerous patterns that could bypass validation
 */
const DANGEROUS_PATTERNS = [
  /\$\(/g, // Command substitution $(...)
  /`/g, // Backtick command substitution
  /\|\|/g, // OR operator
  /&&/g, // AND operator
  /;\s*\w/g, // Command chaining
  /%.*%/g, // Windows environment variables
  /\${.*}/g, // Variable expansion
  /`.*`/g, // Command substitution
];

/**
 * Safe command execution configuration
 */
export interface SafeCommandConfig {
  command: string;
  args: string[];
  cwd?: string;
  timeout?: number;
  maxOutputBytes?: number;
  allowedCommands?: string[];
}

/**
 * Validate command before execution
 *
 * @param command - Command to execute
 * @param allowedCommands - List of allowed commands (whitelist)
 * @returns { valid: boolean, reason?: string }
 */
export function validateCommand(
  command: string,
  allowedCommands?: string[]
): { valid: boolean; reason?: string } {
  // Extract just the command name (first word)
  const commandName = command.trim().split(/\s+/)[0];

  // If allowlist is provided, must be in it
  if (allowedCommands && allowedCommands.length > 0) {
    if (!allowedCommands.includes(commandName)) {
      return {
        valid: false,
        reason: `Command not in allowlist: ${commandName}`,
      };
    }
  }

  // Command must not contain shell metacharacters
  for (const char of DANGEROUS_CHARS) {
    if (commandName.includes(char)) {
      return {
        valid: false,
        reason: `Dangerous character in command: ${char}`,
      };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(commandName)) {
      return {
        valid: false,
        reason: `Dangerous pattern detected in command`,
      };
    }
  }

  return { valid: true };
}

/**
 * Sanitize argument to prevent injection
 *
 * @param arg - Argument to sanitize
 * @param maxLength - Maximum allowed length
 * @returns { safe: boolean, sanitized: string, reason?: string }
 */
export function sanitizeArgument(
  arg: string,
  maxLength: number = 4096
): { safe: boolean; sanitized: string; reason?: string } {
  // Check length
  if (arg.length > maxLength) {
    return {
      safe: false,
      sanitized: '',
      reason: `Argument exceeds maximum length (${maxLength})`,
    };
  }

  // Check for dangerous characters
  for (const char of DANGEROUS_CHARS) {
    if (arg.includes(char)) {
      return {
        safe: false,
        sanitized: '',
        reason: `Dangerous character detected: ${char}`,
      };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(arg)) {
      return {
        safe: false,
        sanitized: '',
        reason: 'Dangerous pattern detected in argument',
      };
    }
  }

  return {
    safe: true,
    sanitized: arg,
  };
}

/**
 * Validate all arguments for safe command execution
 */
export function validateCommandArguments(args: string[]): {
  valid: boolean;
  sanitized: string[];
  reason?: string;
} {
  const sanitized: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const check = sanitizeArgument(args[i]);

    if (!check.safe) {
      return {
        valid: false,
        sanitized: [],
        reason: `Argument ${i} failed validation: ${check.reason}`,
      };
    }

    sanitized.push(check.sanitized);
  }

  return {
    valid: true,
    sanitized,
  };
}

/**
 * SAFE: Execute command with spawn (no shell interpretation)
 * This is the RECOMMENDED approach - arguments are NOT interpreted by shell
 *
 * @param config - Safe command configuration
 * @returns Promise<{ stdout: string, stderr: string, exitCode: number }>
 */
export async function executeCommandSafe(
  config: SafeCommandConfig
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // Validate command
    const cmdValidation = validateCommand(config.command, config.allowedCommands);
    if (!cmdValidation.valid) {
      reject(new Error(`Command validation failed: ${cmdValidation.reason}`));
      return;
    }

    // Validate arguments
    const argValidation = validateCommandArguments(config.args);
    if (!argValidation.valid) {
      reject(new Error(`Argument validation failed: ${argValidation.reason}`));
      return;
    }

    // Set default timeout
    const timeout = config.timeout || 30000; // 30 seconds
    const maxOutput = config.maxOutputBytes || 1024 * 1024; // 1 MB

    let stdout = '';
    let stderr = '';

    // Spawn process (no shell - arguments NOT interpreted)
    const child = spawn(config.command, argValidation.sanitized, {
      cwd: config.cwd,
      timeout,
      // CRITICAL: Do NOT use shell: true
      shell: false,
      // Inherit stdio but capture output
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Handle stdout
    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length + data.length > maxOutput) {
        child.kill();
        reject(new Error('Command output exceeds maximum allowed size'));
        return;
      }
      stdout += data.toString();
    });

    // Handle stderr
    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length + data.length > maxOutput) {
        child.kill();
        reject(new Error('Command stderr exceeds maximum allowed size'));
        return;
      }
      stderr += data.toString();
    });

    // Handle timeout
    child.on('error', (error: Error) => {
      reject(new Error(`Command execution error: ${error.message}`));
    });

    // Handle completion
    child.on('close', (exitCode: number | null) => {
      if (exitCode === null) {
        reject(new Error('Command did not exit cleanly'));
        return;
      }

      // Log command execution to audit trail
      console.debug(`Command executed: ${config.command}`, {
        args: config.args,
        exitCode,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      resolve({
        stdout,
        stderr,
        exitCode,
      });
    });
  });
}

/**
 * UNSAFE: Legacy exec() function (DEPRECATED)
 * DO NOT USE - shell interprets all metacharacters
 *
 * Only use if absolutely necessary and inputs are 100% trusted
 *
 * @deprecated Use executeCommandSafe() instead
 */
export async function executeCommandUnsafe(
  cmd: string,
  options?: { cwd?: string; timeout?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    // WARN: This is unsafe!
    console.warn('[DEPRECATED] Using executeCommandUnsafe - consider using executeCommandSafe');

    exec(cmd, { timeout: options?.timeout || 30000, cwd: options?.cwd }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Get list of default allowed commands for Helix
 */
export function getDefaultAllowedCommands(): string[] {
  return [
    // Node.js
    'node',
    'npm',
    'npx',
    // Git
    'git',
    // File operations
    'ls',
    'cat',
    'cp',
    'mv',
    'rm',
    'mkdir',
    // Text processing
    'grep',
    'sed',
    'awk',
    // Utilities
    'echo',
    'pwd',
    'env',
    'sort',
    'uniq',
  ];
}

/**
 * Alert on command injection attempt
 */
export async function alertCommandInjectionAttempt(
  command: string,
  args: string[],
  reason: string
): Promise<void> {
  await sendAlert(
    '🚨 SECURITY: Command Injection Attempt Detected',
    `Command: ${command}\nArguments: ${args.join(' ')}\nReason: ${reason}`,
    'critical'
  );
}
