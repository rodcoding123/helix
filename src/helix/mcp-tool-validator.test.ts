/**
 * Comprehensive tests for Helix MCP Tool Validator
 * Tests tool validation, sanitization, and security controls
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerToolMetadata,
  getToolMetadata,
  assessToolRisk,
  sanitizeParameters,
  validateMCPToolCall,
  getMCPToolAuditLog,
  clearMCPToolAuditLog,
  DEFAULT_VALIDATOR_CONFIG,
  type MCPToolMetadata,
  type MCPToolCall,
  type MCPToolValidatorConfig,
} from './mcp-tool-validator.js';

describe('MCP Tool Validator - Tool Registry', () => {
  beforeEach(() => {
    clearMCPToolAuditLog();
  });

  it('should register tool metadata', () => {
    const metadata: MCPToolMetadata = {
      name: 'test-tool',
      description: 'A test tool',
      source: 'builtin',
      capabilities: ['filesystem:read'],
      riskLevel: 'low',
    };

    registerToolMetadata(metadata);
    const retrieved = getToolMetadata('test-tool');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test-tool');
  });

  it('should return undefined for unregistered tool', () => {
    const result = getToolMetadata('non-existent-tool');

    expect(result).toBeUndefined();
  });

  it('should update metadata when registered twice', () => {
    const metadata1: MCPToolMetadata = {
      name: 'update-tool',
      description: 'Original',
      source: 'builtin',
      capabilities: [],
      riskLevel: 'low',
    };

    const metadata2: MCPToolMetadata = {
      name: 'update-tool',
      description: 'Updated',
      source: 'plugin',
      capabilities: ['network:outbound'],
      riskLevel: 'high',
    };

    registerToolMetadata(metadata1);
    registerToolMetadata(metadata2);

    const retrieved = getToolMetadata('update-tool');
    expect(retrieved?.description).toBe('Updated');
    expect(retrieved?.riskLevel).toBe('high');
  });
});

describe('MCP Tool Validator - Risk Assessment', () => {
  it('should assess low risk for safe capabilities', () => {
    const risk = assessToolRisk('safe-tool', ['system:info']);

    expect(risk).toBe('low');
  });

  it('should assess medium risk for read capabilities', () => {
    const risk = assessToolRisk('read-tool', ['filesystem:read']);

    expect(risk).toBe('medium');
  });

  it('should assess high risk for write capabilities', () => {
    const risk = assessToolRisk('write-tool', ['filesystem:write']);

    expect(risk).toBe('high');
  });

  it('should assess high risk for network capabilities', () => {
    const risk = assessToolRisk('network-tool', ['network:outbound']);

    expect(risk).toBe('high');
  });

  it('should assess critical risk for process spawn', () => {
    const risk = assessToolRisk('spawn-tool', ['process:spawn']);

    expect(risk).toBe('critical');
  });

  it('should assess critical risk for credential access', () => {
    const risk = assessToolRisk('cred-tool', ['credential:access']);

    expect(risk).toBe('critical');
  });

  it('should assess critical risk for filesystem execute', () => {
    const risk = assessToolRisk('exec-tool', ['filesystem:execute']);

    expect(risk).toBe('critical');
  });

  it('should assess high risk based on tool name pattern', () => {
    const risk = assessToolRisk('bash-command', []);

    expect(risk).toBe('high');
  });

  it('should assess high risk for shell-like names', () => {
    const risk = assessToolRisk('execute-shell', []);

    expect(risk).toBe('high');
  });

  it('should return highest risk when multiple capabilities present', () => {
    const risk = assessToolRisk('multi-tool', [
      'filesystem:read',
      'process:spawn',
      'network:outbound',
    ]);

    expect(risk).toBe('critical');
  });
});

describe('MCP Tool Validator - Parameter Sanitization', () => {
  const config = DEFAULT_VALIDATOR_CONFIG;

  it('should pass through safe parameters unchanged', () => {
    const params = { name: 'test', value: 123, flag: true };
    const { sanitized, modifications } = sanitizeParameters(params, config);

    expect(sanitized).toEqual(params);
    expect(modifications).toHaveLength(0);
  });

  it('should block __proto__ key', () => {
    const params = { __proto__: { polluted: true }, safe: 'value' };
    const { sanitized } = sanitizeParameters(params, config);

    // __proto__ should be blocked (not in sanitized output)
    expect(Object.keys(sanitized)).not.toContain('__proto__');
    // Safe value should still be present
    expect(sanitized.safe).toBe('value');
  });

  it('should block constructor key', () => {
    const params = { constructor: 'malicious', safe: 'value' };
    const { sanitized, modifications } = sanitizeParameters(params, config);

    expect(sanitized).not.toHaveProperty('constructor');
    expect(modifications.some(m => m.includes('constructor'))).toBe(true);
  });

  it('should block prototype key', () => {
    const params = { prototype: 'bad', safe: 'value' };
    const { sanitized, modifications } = sanitizeParameters(params, config);

    expect(sanitized).not.toHaveProperty('prototype');
    expect(modifications.some(m => m.includes('prototype'))).toBe(true);
  });

  it('should truncate oversized parameters', () => {
    const largeString = 'x'.repeat(2_000_000);
    const params = { data: largeString };
    const { sanitized, modifications } = sanitizeParameters(params, config);

    expect((sanitized.data as string).length).toBe(config.maxParameterSize);
    expect(modifications.some(m => m.includes('Truncated'))).toBe(true);
  });

  it('should detect command injection pattern - rm', () => {
    const params = { cmd: 'test; rm -rf /' };
    const { modifications } = sanitizeParameters(params, config);

    expect(modifications.some(m => m.includes('destructive command'))).toBe(true);
  });

  it('should detect command substitution pattern', () => {
    const params = { cmd: 'echo $(cat /etc/passwd)' };
    const { modifications } = sanitizeParameters(params, config);

    expect(modifications.some(m => m.includes('command substitution'))).toBe(true);
  });

  it('should detect backtick command substitution', () => {
    const params = { cmd: 'echo `whoami`' };
    const { modifications } = sanitizeParameters(params, config);

    expect(modifications.some(m => m.includes('backtick'))).toBe(true);
  });

  it('should detect shell piping pattern', () => {
    const params = { cmd: 'cat file | bash' };
    const { modifications } = sanitizeParameters(params, config);

    expect(modifications.some(m => m.includes('shell piping'))).toBe(true);
  });

  it('should detect device file redirect', () => {
    const params = { cmd: 'echo test > /dev/null' };
    const { modifications } = sanitizeParameters(params, config);

    expect(modifications.some(m => m.includes('device file'))).toBe(true);
  });

  it('should recursively sanitize nested objects', () => {
    const params = {
      safe: 'value',
      nested: {
        __proto__: 'bad',
        good: 'value',
      },
    };
    const { sanitized } = sanitizeParameters(params, config);

    expect(sanitized.nested).toBeDefined();
    expect((sanitized.nested as Record<string, unknown>).good).toBe('value');
    // __proto__ should not be in nested object keys
    expect(Object.keys(sanitized.nested as Record<string, unknown>)).not.toContain('__proto__');
  });

  it('should sanitize arrays of objects', () => {
    const params = {
      items: [{ __proto__: 'bad1' }, { safe: 'value' }, { constructor: 'bad2' }],
    };
    const { sanitized, modifications } = sanitizeParameters(params, config);

    expect(Array.isArray(sanitized.items)).toBe(true);
    expect(modifications.length).toBeGreaterThan(0);
  });
});

describe('MCP Tool Validator - Tool Call Validation', () => {
  beforeEach(() => {
    clearMCPToolAuditLog();
  });

  it('should validate safe builtin tool', () => {
    const metadata: MCPToolMetadata = {
      name: 'safe-tool',
      description: 'Safe tool',
      source: 'builtin',
      capabilities: ['filesystem:read'],
      riskLevel: 'low',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'safe-tool',
      parameters: { path: '/tmp/test.txt' },
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('should block explicitly blocked tool', () => {
    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      blockedTools: ['dangerous-tool'],
    };

    const toolCall: MCPToolCall = {
      toolName: 'dangerous-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('explicitly blocked');
  });

  it('should block tool matching blocked pattern - eval', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('blocked pattern');
  });

  it('should block tool matching blocked pattern - exec', () => {
    const toolCall: MCPToolCall = {
      toolName: 'exec',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('should block tool matching blocked pattern - system', () => {
    const toolCall: MCPToolCall = {
      toolName: 'system',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('should warn about missing metadata when required', () => {
    const toolCall: MCPToolCall = {
      toolName: 'unknown-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.warnings.some(w => w.includes('No metadata'))).toBe(true);
  });

  it('should block tool from disallowed source', () => {
    const metadata: MCPToolMetadata = {
      name: 'remote-tool',
      description: 'Remote tool',
      source: 'remote',
      capabilities: [],
      riskLevel: 'medium',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'remote-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('not allowed');
  });

  it('should block critical-risk tool when config requires', () => {
    const metadata: MCPToolMetadata = {
      name: 'spawn-tool',
      description: 'Process spawner',
      source: 'builtin',
      capabilities: ['process:spawn'],
      riskLevel: 'critical',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'spawn-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Critical-risk');
  });

  it('should block high-risk tool when blockHighRisk enabled', () => {
    const metadata: MCPToolMetadata = {
      name: 'write-tool',
      description: 'File writer',
      source: 'builtin',
      capabilities: ['filesystem:write'],
      riskLevel: 'high',
    };
    registerToolMetadata(metadata);

    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      blockHighRisk: true,
    };

    const toolCall: MCPToolCall = {
      toolName: 'write-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('High-risk');
  });

  it('should allow high-risk tool when blockHighRisk disabled', () => {
    const metadata: MCPToolMetadata = {
      name: 'write-tool',
      description: 'File writer',
      source: 'builtin',
      capabilities: ['filesystem:write'],
      riskLevel: 'high',
    };
    registerToolMetadata(metadata);

    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      blockHighRisk: false,
    };

    const toolCall: MCPToolCall = {
      toolName: 'write-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.valid).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('should include risk assessment in result', () => {
    const metadata: MCPToolMetadata = {
      name: 'medium-tool',
      description: 'Medium risk',
      source: 'builtin',
      capabilities: ['database:query'],
      riskLevel: 'medium',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'medium-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.riskAssessment).toBeDefined();
    expect(result.riskAssessment.level).toBe('medium');
  });

  it('should sanitize parameters when validation passes', () => {
    const metadata: MCPToolMetadata = {
      name: 'safe-tool',
      description: 'Safe',
      source: 'builtin',
      capabilities: [],
      riskLevel: 'low',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'safe-tool',
      parameters: { __proto__: 'bad', safe: 'good' },
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.sanitizedParameters).toBeDefined();
    expect(result.sanitizedParameters).not.toHaveProperty('__proto__');
  });
});

describe('MCP Tool Validator - Audit Logging', () => {
  beforeEach(() => {
    clearMCPToolAuditLog();
  });

  it('should create audit entry for blocked tool', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].action).toBe('blocked');
  });

  it('should create audit entry for allowed tool', () => {
    const metadata: MCPToolMetadata = {
      name: 'allowed-tool',
      description: 'Allowed',
      source: 'builtin',
      capabilities: [],
      riskLevel: 'low',
    };
    registerToolMetadata(metadata);

    const toolCall: MCPToolCall = {
      toolName: 'allowed-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it('should include tool name in audit entry', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log[0].toolName).toBe('eval');
  });

  it('should include session key in audit entry', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'audit-test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log[0].sessionKey).toBe('audit-test-session');
  });

  it('should include timestamp in audit entry', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log[0].timestamp).toBeDefined();
    expect(log[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should include parameter hash in audit entry', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: { test: 'value' },
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);

    const log = getMCPToolAuditLog();
    expect(log[0].parameterHash).toBeDefined();
    expect(log[0].parameterHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should return audit ID in validation result', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.auditId).toBeDefined();
  });

  it('should clear audit log', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall);
    expect(getMCPToolAuditLog().length).toBeGreaterThan(0);

    clearMCPToolAuditLog();
    expect(getMCPToolAuditLog().length).toBe(0);
  });

  it('should not create audit when disabled in config', () => {
    clearMCPToolAuditLog();

    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      enableAuditLog: false,
    };

    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    validateMCPToolCall(toolCall, config);

    expect(getMCPToolAuditLog().length).toBe(0);
  });
});

describe('MCP Tool Validator - Configuration', () => {
  it('should use default config when not provided', () => {
    const toolCall: MCPToolCall = {
      toolName: 'eval',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall);

    expect(result.blocked).toBe(true);
  });

  it('should respect custom blocked tools list', () => {
    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      blockedTools: ['custom-blocked'],
    };

    const toolCall: MCPToolCall = {
      toolName: 'custom-blocked',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.blocked).toBe(true);
  });

  it('should respect custom allowed sources', () => {
    const metadata: MCPToolMetadata = {
      name: 'remote-tool',
      description: 'Remote',
      source: 'remote',
      capabilities: [],
      riskLevel: 'low',
    };
    registerToolMetadata(metadata);

    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      allowedSources: ['builtin', 'plugin', 'remote'],
    };

    const toolCall: MCPToolCall = {
      toolName: 'remote-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.blocked).toBe(false);
  });

  it('should respect requireMetadata setting', () => {
    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      requireMetadata: false,
    };

    const toolCall: MCPToolCall = {
      toolName: 'unknown-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.warnings.length).toBe(0);
  });

  it('should respect blockCritical setting', () => {
    const metadata: MCPToolMetadata = {
      name: 'critical-tool',
      description: 'Critical',
      source: 'builtin',
      capabilities: ['process:spawn'],
      riskLevel: 'critical',
    };
    registerToolMetadata(metadata);

    const config: MCPToolValidatorConfig = {
      ...DEFAULT_VALIDATOR_CONFIG,
      blockCritical: false,
    };

    const toolCall: MCPToolCall = {
      toolName: 'critical-tool',
      parameters: {},
      sessionKey: 'test-session',
      timestamp: new Date(),
    };

    const result = validateMCPToolCall(toolCall, config);

    expect(result.blocked).toBe(false);
  });
});
