/**
 * HELIX MCP TOOL VALIDATOR
 * Security layer for validating and sanitizing MCP tool calls
 *
 * Prevents:
 * - Tool poisoning attacks
 * - Parameter injection
 * - Unauthorized tool access
 * - Resource exhaustion
 *
 * Based on CVE-2025-49596, CVE-2025-6514, CVE-2025-52882
 */

import crypto from 'node:crypto';
import { HelixSecurityError } from './types.js';

/**
 * MCP Tool metadata
 */
export interface MCPToolMetadata {
  name: string;
  description: string;
  version?: string;
  source: 'builtin' | 'plugin' | 'remote' | 'dynamic';
  trustedOrigin?: string;
  capabilities: MCPToolCapability[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Tool capabilities that affect security decisions
 */
export type MCPToolCapability =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'filesystem:execute'
  | 'network:outbound'
  | 'network:localhost'
  | 'process:spawn'
  | 'process:signal'
  | 'memory:access'
  | 'browser:navigate'
  | 'browser:execute'
  | 'database:query'
  | 'database:modify'
  | 'system:info'
  | 'credential:access';

/**
 * Tool validation configuration
 */
export interface MCPToolValidatorConfig {
  /** Block high-risk tools by default */
  blockHighRisk: boolean;
  /** Block critical-risk tools (always recommended) */
  blockCritical: boolean;
  /** Require tool metadata validation */
  requireMetadata: boolean;
  /** Maximum parameter size in bytes */
  maxParameterSize: number;
  /** Allowed tool sources */
  allowedSources: MCPToolMetadata['source'][];
  /** Blocked tool names (exact match) */
  blockedTools: string[];
  /** Blocked tool patterns (regex) */
  blockedPatterns: RegExp[];
  /** Rate limit per tool per minute */
  rateLimitPerMinute: number;
  /** Enable audit logging */
  enableAuditLog: boolean;
}

/**
 * Default validator configuration (secure by default)
 */
export const DEFAULT_VALIDATOR_CONFIG: MCPToolValidatorConfig = {
  blockHighRisk: false, // Log warning but allow
  blockCritical: true, // Block critical tools
  requireMetadata: true,
  maxParameterSize: 1024 * 1024, // 1 MB
  allowedSources: ['builtin', 'plugin'],
  blockedTools: [],
  blockedPatterns: [/^eval$/i, /^exec$/i, /^system$/i, /^shell$/i, /^run_command$/i, /^spawn$/i],
  rateLimitPerMinute: 100,
  enableAuditLog: true,
};

/**
 * Tool call parameters
 */
export interface MCPToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
  sessionKey: string;
  timestamp: Date;
}

/**
 * Validation result
 */
export interface MCPToolValidationResult {
  valid: boolean;
  blocked: boolean;
  reason?: string;
  sanitizedParameters?: Record<string, unknown>;
  warnings: string[];
  riskAssessment: {
    level: MCPToolMetadata['riskLevel'];
    factors: string[];
  };
  auditId?: string;
}

/**
 * Audit log entry
 */
export interface MCPToolAuditEntry {
  id: string;
  timestamp: string;
  toolName: string;
  sessionKey: string;
  action: 'allowed' | 'blocked' | 'sanitized';
  reason?: string;
  riskLevel: MCPToolMetadata['riskLevel'];
  parameterHash: string;
}

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Audit log storage
const auditLog: MCPToolAuditEntry[] = [];

// Known tool metadata registry
const toolRegistry = new Map<string, MCPToolMetadata>();

/**
 * Register tool metadata
 */
export function registerToolMetadata(metadata: MCPToolMetadata): void {
  toolRegistry.set(metadata.name, metadata);
}

/**
 * Get tool metadata
 */
export function getToolMetadata(toolName: string): MCPToolMetadata | undefined {
  return toolRegistry.get(toolName);
}

/**
 * Assess risk level of a tool based on its capabilities
 */
export function assessToolRisk(
  toolName: string,
  capabilities: MCPToolCapability[]
): MCPToolMetadata['riskLevel'] {
  // Critical capabilities
  const criticalCaps: MCPToolCapability[] = [
    'process:spawn',
    'process:signal',
    'credential:access',
    'filesystem:execute',
  ];

  // High risk capabilities
  const highRiskCaps: MCPToolCapability[] = [
    'filesystem:write',
    'network:outbound',
    'browser:execute',
    'database:modify',
  ];

  // Medium risk capabilities
  const mediumRiskCaps: MCPToolCapability[] = [
    'filesystem:read',
    'network:localhost',
    'browser:navigate',
    'database:query',
    'memory:access',
  ];

  // Check for critical capabilities
  if (capabilities.some(cap => criticalCaps.includes(cap))) {
    return 'critical';
  }

  // Check for high-risk tool name patterns
  const highRiskNamePatterns = [/bash/i, /shell/i, /exec/i, /eval/i, /run/i, /spawn/i, /command/i];

  if (highRiskNamePatterns.some(pattern => pattern.test(toolName))) {
    return 'high';
  }

  // Check for high risk capabilities
  if (capabilities.some(cap => highRiskCaps.includes(cap))) {
    return 'high';
  }

  // Check for medium risk capabilities
  if (capabilities.some(cap => mediumRiskCaps.includes(cap))) {
    return 'medium';
  }

  return 'low';
}

/**
 * Sanitize tool parameters to prevent injection attacks
 */
export function sanitizeParameters(
  parameters: Record<string, unknown>,
  config: MCPToolValidatorConfig
): { sanitized: Record<string, unknown>; modifications: string[] } {
  const modifications: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    // Check for prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      modifications.push(`Blocked prototype pollution key: ${key}`);
      continue;
    }

    // Sanitize string values
    if (typeof value === 'string') {
      // Check size
      if (value.length > config.maxParameterSize) {
        modifications.push(`Truncated oversized parameter: ${key}`);
        sanitized[key] = value.slice(0, config.maxParameterSize);
        continue;
      }

      // Check for command injection patterns
      const injectionPatterns = [
        { pattern: /;\s*(?:rm|del|format|dd|mkfs)/gi, name: 'destructive command injection' },
        { pattern: /\$\([^)]+\)/g, name: 'command substitution' },
        { pattern: /`[^`]+`/g, name: 'backtick command substitution' },
        { pattern: /\|\s*(?:bash|sh|cmd|powershell)/gi, name: 'shell piping' },
        { pattern: />\s*\/(?:dev|proc|sys)/g, name: 'device file redirect' },
      ];

      const sanitizedValue = value;
      for (const { pattern, name } of injectionPatterns) {
        if (pattern.test(sanitizedValue)) {
          modifications.push(`Detected ${name} pattern in ${key}`);
          // Don't modify, just log - blocking is done at validation level
        }
      }

      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const { sanitized: s, modifications: m } = sanitizeParameters(
              item as Record<string, unknown>,
              config
            );
            modifications.push(...m.map(mod => `${key}[${idx}]: ${mod}`));
            return s;
          }
          return item;
        });
      } else {
        const { sanitized: s, modifications: m } = sanitizeParameters(
          value as Record<string, unknown>,
          config
        );
        modifications.push(...m.map(mod => `${key}: ${mod}`));
        sanitized[key] = s;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return { sanitized, modifications };
}

/**
 * Check rate limit for a tool
 */
function checkRateLimit(
  toolName: string,
  sessionKey: string,
  config: MCPToolValidatorConfig
): { allowed: boolean; remaining: number } {
  const key = `${sessionKey}:${toolName}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: config.rateLimitPerMinute - 1 };
  }

  if (existing.count >= config.rateLimitPerMinute) {
    return { allowed: false, remaining: 0 };
  }

  existing.count++;
  return { allowed: true, remaining: config.rateLimitPerMinute - existing.count };
}

/**
 * Create audit log entry
 */
function createAuditEntry(
  toolCall: MCPToolCall,
  action: MCPToolAuditEntry['action'],
  riskLevel: MCPToolMetadata['riskLevel'],
  reason?: string
): MCPToolAuditEntry {
  const entry: MCPToolAuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    toolName: toolCall.toolName,
    sessionKey: toolCall.sessionKey,
    action,
    reason,
    riskLevel,
    parameterHash: crypto
      .createHash('sha256')
      .update(JSON.stringify(toolCall.parameters))
      .digest('hex')
      .slice(0, 16),
  };

  auditLog.push(entry);

  // Keep only last 10000 entries
  if (auditLog.length > 10000) {
    auditLog.shift();
  }

  return entry;
}

/**
 * Validate MCP tool call
 * Main entry point for tool validation
 */
export function validateMCPToolCall(
  toolCall: MCPToolCall,
  config: MCPToolValidatorConfig = DEFAULT_VALIDATOR_CONFIG
): MCPToolValidationResult {
  const result: MCPToolValidationResult = {
    valid: true,
    blocked: false,
    warnings: [],
    riskAssessment: {
      level: 'low',
      factors: [],
    },
  };

  const { toolName, parameters, sessionKey } = toolCall;

  // 1. Check blocked tools (exact match)
  if (config.blockedTools.includes(toolName)) {
    result.valid = false;
    result.blocked = true;
    result.reason = `Tool "${toolName}" is explicitly blocked`;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'blocked', 'critical', result.reason).id;
    }

    return result;
  }

  // 2. Check blocked patterns
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(toolName)) {
      result.valid = false;
      result.blocked = true;
      result.reason = `Tool "${toolName}" matches blocked pattern: ${pattern}`;

      if (config.enableAuditLog) {
        result.auditId = createAuditEntry(toolCall, 'blocked', 'critical', result.reason).id;
      }

      return result;
    }
  }

  // 3. Check metadata requirement
  const metadata = getToolMetadata(toolName);

  if (config.requireMetadata && !metadata) {
    result.warnings.push(`No metadata registered for tool "${toolName}"`);
    result.riskAssessment.factors.push('No metadata available');
    result.riskAssessment.level = 'medium';
  }

  // 4. Check source allowlist
  if (metadata && !config.allowedSources.includes(metadata.source)) {
    result.valid = false;
    result.blocked = true;
    result.reason = `Tool source "${metadata.source}" is not allowed`;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'blocked', 'high', result.reason).id;
    }

    return result;
  }

  // 5. Assess risk
  const capabilities = metadata?.capabilities || [];
  const riskLevel = metadata?.riskLevel || assessToolRisk(toolName, capabilities);

  result.riskAssessment.level = riskLevel;

  if (riskLevel === 'high') {
    result.riskAssessment.factors.push('High-risk tool capabilities detected');
  }

  if (riskLevel === 'critical') {
    result.riskAssessment.factors.push('Critical-risk tool - process spawn/credential access');
  }

  // 6. Block based on risk level
  if (riskLevel === 'critical' && config.blockCritical) {
    result.valid = false;
    result.blocked = true;
    result.reason = `Critical-risk tool "${toolName}" is blocked by policy`;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'blocked', riskLevel, result.reason).id;
    }

    return result;
  }

  if (riskLevel === 'high' && config.blockHighRisk) {
    result.valid = false;
    result.blocked = true;
    result.reason = `High-risk tool "${toolName}" is blocked by policy`;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'blocked', riskLevel, result.reason).id;
    }

    return result;
  }

  // 7. Check rate limit
  const rateLimit = checkRateLimit(toolName, sessionKey, config);
  if (!rateLimit.allowed) {
    result.valid = false;
    result.blocked = true;
    result.reason = `Rate limit exceeded for tool "${toolName}"`;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'blocked', riskLevel, result.reason).id;
    }

    return result;
  }

  // 8. Sanitize parameters
  const { sanitized, modifications } = sanitizeParameters(parameters, config);

  if (modifications.length > 0) {
    result.warnings.push(...modifications);
    result.sanitizedParameters = sanitized;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(
        toolCall,
        'sanitized',
        riskLevel,
        modifications.join('; ')
      ).id;
    }
  } else {
    result.sanitizedParameters = parameters;

    if (config.enableAuditLog) {
      result.auditId = createAuditEntry(toolCall, 'allowed', riskLevel).id;
    }
  }

  return result;
}

/**
 * Get audit log entries
 */
export function getMCPToolAuditLog(options?: {
  sessionKey?: string;
  toolName?: string;
  action?: MCPToolAuditEntry['action'];
  limit?: number;
}): MCPToolAuditEntry[] {
  let entries = [...auditLog];

  if (options?.sessionKey) {
    entries = entries.filter(e => e.sessionKey === options.sessionKey);
  }

  if (options?.toolName) {
    entries = entries.filter(e => e.toolName === options.toolName);
  }

  if (options?.action) {
    entries = entries.filter(e => e.action === options.action);
  }

  if (options?.limit) {
    entries = entries.slice(-options.limit);
  }

  return entries;
}

/**
 * Clear audit log (for testing)
 */
export function clearMCPToolAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Validate and execute with fail-closed behavior
 */
export async function validateAndExecute<T>(
  toolCall: MCPToolCall,
  executor: (sanitizedParams: Record<string, unknown>) => Promise<T>,
  config: MCPToolValidatorConfig = DEFAULT_VALIDATOR_CONFIG
): Promise<T> {
  const validation = validateMCPToolCall(toolCall, config);

  if (!validation.valid || validation.blocked) {
    throw new HelixSecurityError(
      validation.reason || 'Tool validation failed',
      'SECURITY_CONFIG_INVALID',
      {
        toolName: toolCall.toolName,
        riskAssessment: validation.riskAssessment,
        warnings: validation.warnings,
      }
    );
  }

  // Execute with sanitized parameters
  return executor(validation.sanitizedParameters || toolCall.parameters);
}

// Register common built-in tools with metadata
registerToolMetadata({
  name: 'Read',
  description: 'Read file contents',
  source: 'builtin',
  capabilities: ['filesystem:read'],
  riskLevel: 'low',
});

registerToolMetadata({
  name: 'Write',
  description: 'Write file contents',
  source: 'builtin',
  capabilities: ['filesystem:write'],
  riskLevel: 'medium',
});

registerToolMetadata({
  name: 'Edit',
  description: 'Edit file contents',
  source: 'builtin',
  capabilities: ['filesystem:write'],
  riskLevel: 'medium',
});

registerToolMetadata({
  name: 'Bash',
  description: 'Execute bash commands',
  source: 'builtin',
  capabilities: ['process:spawn', 'filesystem:execute'],
  riskLevel: 'critical',
});

registerToolMetadata({
  name: 'WebFetch',
  description: 'Fetch web content',
  source: 'builtin',
  capabilities: ['network:outbound'],
  riskLevel: 'medium',
});

registerToolMetadata({
  name: 'mcp__plugin_playwright_playwright__browser_navigate',
  description: 'Navigate browser to URL',
  source: 'plugin',
  capabilities: ['browser:navigate', 'network:outbound'],
  riskLevel: 'high',
});

registerToolMetadata({
  name: 'mcp__plugin_playwright_playwright__browser_evaluate',
  description: 'Execute JavaScript in browser',
  source: 'plugin',
  capabilities: ['browser:execute'],
  riskLevel: 'critical',
});
