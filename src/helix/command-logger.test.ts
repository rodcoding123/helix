/**
 * Tests for Helix command logger module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logCommandPreExecution,
  logCommandPostExecution,
  logCommandFailed,
  getPendingCommands,
  isCommandPending,
  createLoggedExecutor,
  __resetPendingCommandsForTesting,
} from './command-logger.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Command Logger - Pre-Execution Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should log command before execution', async () => {
    const log = {
      id: 'test-id',
      command: 'ls -la',
      workdir: '/home/user',
      timestamp: '2024-01-15T10:30:00.000Z',
      elevated: false,
    };

    const logId = await logCommandPreExecution(log);

    expect(logId).toBe('test-id');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should generate log ID if not provided', async () => {
    const log = {
      command: 'ls -la',
      workdir: '/home/user',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    const logId = await logCommandPreExecution(log);

    expect(logId).toBeDefined();
    expect(logId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should add command to pending map', async () => {
    const log = {
      id: 'test-123',
      command: 'pwd',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    await logCommandPreExecution(log);

    expect(isCommandPending('test-123')).toBe(true);
    const pending = getPendingCommands();
    expect(pending.has('test-123')).toBe(true);
  });

  it('should include session key if provided', async () => {
    const log = {
      command: 'npm test',
      workdir: '/project',
      timestamp: '2024-01-15T10:30:00.000Z',
      sessionKey: 'session-abc',
    };

    await logCommandPreExecution(log);

    expect(mockFetch).toHaveBeenCalled();
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string }) => f.name === 'Session')).toBe(true);
  });

  it('should mark elevated commands with warning', async () => {
    const log = {
      command: 'sudo rm -rf /',
      workdir: '/root',
      timestamp: '2024-01-15T10:30:00.000Z',
      elevated: true,
    };

    await logCommandPreExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.title).toContain('ELEVATED');
    expect(embed.color).toBe(0xe74c3c); // Red for elevated
  });

  it('should sanitize sensitive data in commands', async () => {
    const log = {
      command: 'curl --api_key=secret123 https://api.example.com',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    await logCommandPreExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const commandField = embed.fields.find((f: { name: string }) => f.name === 'Command');
    expect(commandField.value).toContain('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should truncate very long commands', async () => {
    const longCommand = 'echo ' + 'a'.repeat(2000);
    const log = {
      command: longCommand,
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    await logCommandPreExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const commandField = embed.fields.find((f: { name: string }) => f.name === 'Command');
    expect(commandField.value).toContain('[truncated]');
  });

  it('should wait for Discord webhook to complete', async () => {
    let webhookCalled = false;
    mockFetch.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      webhookCalled = true;
      return { ok: true, status: 200 };
    });

    await logCommandPreExecution({
      command: 'test',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(webhookCalled).toBe(true);
  });

  it('should handle webhook failure gracefully', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    // Should not throw
    await expect(
      logCommandPreExecution({
        command: 'test',
        workdir: '/tmp',
        timestamp: '2024-01-15T10:30:00.000Z',
      })
    ).resolves.toBeDefined();
  });
});

describe('Command Logger - Post-Execution Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should log successful command completion', async () => {
    const log = {
      id: 'test-123',
      command: 'ls -la',
      workdir: '/home/user',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: 0,
      signal: null,
      durationMs: 150,
      outputPreview: 'file1.txt\nfile2.txt',
    };

    await logCommandPostExecution(log);

    expect(mockFetch).toHaveBeenCalledOnce();
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.title).toContain('Success');
    expect(embed.color).toBe(0x2ecc71); // Green
  });

  it('should log failed command execution', async () => {
    const log = {
      id: 'test-123',
      command: 'invalid-command',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: 127,
      signal: null,
      durationMs: 50,
      outputPreview: 'command not found',
    };

    await logCommandPostExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.title).toContain('Failed');
    expect(embed.color).toBe(0xe74c3c); // Red
  });

  it('should remove command from pending map', async () => {
    // Add to pending first
    await logCommandPreExecution({
      id: 'test-456',
      command: 'test',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(isCommandPending('test-456')).toBe(true);

    await logCommandPostExecution({
      id: 'test-456',
      command: 'test',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: 0,
      signal: null,
      durationMs: 100,
      outputPreview: 'done',
    });

    expect(isCommandPending('test-456')).toBe(false);
  });

  it('should include signal if present', async () => {
    const log = {
      id: 'test-123',
      command: 'long-running-task',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: null,
      signal: 'SIGTERM',
      durationMs: 5000,
      outputPreview: '',
    };

    await logCommandPostExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string }) => f.name === 'Signal')).toBe(true);
  });

  it('should truncate long output preview', async () => {
    const longOutput = 'x'.repeat(2000);
    const log = {
      id: 'test-123',
      command: 'cat large-file',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: 0,
      signal: null,
      durationMs: 200,
      outputPreview: longOutput,
    };

    await logCommandPostExecution(log);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const outputField = embed.fields.find((f: { name: string }) => f.name === 'Output Preview');
    expect(outputField.value.length).toBeLessThan(longOutput.length + 10);
  });

  it('should handle missing output preview', async () => {
    const log = {
      id: 'test-123',
      command: 'silent-command',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
      exitCode: 0,
      signal: null,
      durationMs: 50,
      outputPreview: undefined,
    };

    await expect(logCommandPostExecution(log)).resolves.not.toThrow();
  });
});

describe('Command Logger - Failed Command Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should log command that failed to start', async () => {
    await logCommandFailed('test-789', 'Command not found');

    expect(mockFetch).toHaveBeenCalledOnce();
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.title).toContain('Failed to Start');
    expect(embed.color).toBe(0xe74c3c);
  });

  it('should remove failed command from pending', async () => {
    // Add to pending first
    await logCommandPreExecution({
      id: 'test-999',
      command: 'test',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(isCommandPending('test-999')).toBe(true);

    await logCommandFailed('test-999', 'Spawn error');

    expect(isCommandPending('test-999')).toBe(false);
  });

  it('should include pending command info if available', async () => {
    await logCommandPreExecution({
      id: 'test-888',
      command: 'failing-command',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    await logCommandFailed('test-888', 'Permission denied');

    const callBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string }) => f.name === 'Command')).toBe(true);
  });

  it('should truncate very long error messages', async () => {
    const longError = 'Error: ' + 'x'.repeat(1000);

    await logCommandFailed('test-id', longError);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const errorField = embed.fields.find((f: { name: string }) => f.name === 'Error');
    expect(errorField.value.length).toBeLessThanOrEqual(500);
  });
});

describe('Command Logger - Pending State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    __resetPendingCommandsForTesting();
  });

  it('should track multiple pending commands', async () => {
    await logCommandPreExecution({
      id: 'cmd-1',
      command: 'test1',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    await logCommandPreExecution({
      id: 'cmd-2',
      command: 'test2',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:01.000Z',
    });

    const pending = getPendingCommands();
    expect(pending.size).toBe(2);
    expect(pending.has('cmd-1')).toBe(true);
    expect(pending.has('cmd-2')).toBe(true);
  });

  it('should return pending command details', async () => {
    await logCommandPreExecution({
      id: 'detailed-cmd',
      command: 'npm install',
      workdir: '/project',
      timestamp: '2024-01-15T10:30:00.000Z',
      sessionKey: 'session-123',
    });

    const pending = getPendingCommands();
    const cmd = pending.get('detailed-cmd');

    expect(cmd).toBeDefined();
    expect(cmd?.command).toBe('npm install');
    expect(cmd?.workdir).toBe('/project');
    expect(cmd?.sessionKey).toBe('session-123');
  });
});

describe('Command Logger - Sanitization', () => {
  // Recreate sanitization function for testing
  const sanitizeCommand = (command: string, maxLength: number = 1500): string => {
    const sensitivePatterns = [
      /password[=:]/i,
      /secret[=:]/i,
      /token[=:]/i,
      /api[_-]?key[=:]/i,
      /auth[=:]/i,
    ];

    let sanitized = command;
    for (const pattern of sensitivePatterns) {
      if (pattern.test(command)) {
        sanitized = '[CONTAINS SENSITIVE DATA - CHECK LOGS]';
        break;
      }
    }

    if (sanitized.length > maxLength) {
      return sanitized.slice(0, maxLength) + '... [truncated]';
    }

    return sanitized;
  };

  it('should pass through normal commands', () => {
    expect(sanitizeCommand('ls -la')).toBe('ls -la');
    expect(sanitizeCommand('npm test')).toBe('npm test');
  });

  it('should detect password patterns', () => {
    expect(sanitizeCommand('mysql --password=secret')).toBe(
      '[CONTAINS SENSITIVE DATA - CHECK LOGS]'
    );
    expect(sanitizeCommand('PASSWORD=abc123')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('--password:test')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect secret patterns', () => {
    expect(sanitizeCommand('export SECRET=value')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('--secret:abc')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect token patterns', () => {
    expect(sanitizeCommand('curl -H "token=abc123"')).toBe(
      '[CONTAINS SENSITIVE DATA - CHECK LOGS]'
    );
    expect(sanitizeCommand('TOKEN:xyz')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect api_key patterns', () => {
    expect(sanitizeCommand('--api_key=secret')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('API-KEY=test')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('apikey=value')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect auth patterns', () => {
    expect(sanitizeCommand('--auth=user:pass')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('AUTH:bearer')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should be case insensitive', () => {
    expect(sanitizeCommand('PaSsWoRd=test')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('SECRET=test')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should truncate long commands', () => {
    const longCmd = 'echo ' + 'a'.repeat(2000);
    const result = sanitizeCommand(longCmd, 100);
    expect(result.endsWith('... [truncated]')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(115);
  });
});

describe('Command Logger - Logged Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should wrap executor with logging', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('result');
    const loggedExecutor = createLoggedExecutor(mockExecutor, {
      sessionKey: 'test-session',
    });

    const result = await loggedExecutor('ls -la', '/tmp');

    expect(result).toBe('result');
    expect(mockExecutor).toHaveBeenCalledWith('ls -la', '/tmp');
    expect(mockFetch).toHaveBeenCalledTimes(2); // Pre + post execution
  });

  it('should log before execution', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('result');
    const loggedExecutor = createLoggedExecutor(mockExecutor);

    await loggedExecutor('test', '/tmp');

    // First call should be pre-execution
    const firstCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstCall.embeds[0].footer.text).toContain('PRE-EXECUTION');
  });

  it('should log after execution', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('result');
    const loggedExecutor = createLoggedExecutor(mockExecutor);

    await loggedExecutor('test', '/tmp');

    // Second call should be post-execution
    const secondCall = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondCall.embeds[0].footer.text).toContain('POST-EXECUTION');
  });

  it('should log failures', async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error('Execution failed'));
    const loggedExecutor = createLoggedExecutor(mockExecutor);

    await expect(loggedExecutor('test', '/tmp')).rejects.toThrow('Execution failed');

    // Should have pre-execution + failure log
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const failureCall = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(failureCall.embeds[0].title).toContain('Failed');
  });

  it('should pass session key to logs', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('result');
    const loggedExecutor = createLoggedExecutor(mockExecutor, {
      sessionKey: 'my-session',
    });

    await loggedExecutor('test', '/tmp');

    const preLog = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(
      preLog.embeds[0].fields.some(
        (f: { name: string; value: string }) => f.name === 'Session' && f.value === 'my-session'
      )
    ).toBe(true);
  });

  it('should mark elevated commands', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('result');
    const loggedExecutor = createLoggedExecutor(mockExecutor, {
      elevated: true,
    });

    await loggedExecutor('sudo rm -rf /', '/');

    const preLog = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(preLog.embeds[0].title).toContain('ELEVATED');
  });
});

describe('Command Logger - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should handle empty command', async () => {
    await expect(
      logCommandPreExecution({
        command: '',
        workdir: '/tmp',
        timestamp: '2024-01-15T10:30:00.000Z',
      })
    ).resolves.toBeDefined();
  });

  it('should handle special characters in workdir', async () => {
    await expect(
      logCommandPreExecution({
        command: 'test',
        workdir: '/path/with spaces/and-special!@#$chars',
        timestamp: '2024-01-15T10:30:00.000Z',
      })
    ).resolves.toBeDefined();
  });

  it('should handle null exitCode', async () => {
    await expect(
      logCommandPostExecution({
        id: 'test',
        command: 'test',
        workdir: '/tmp',
        timestamp: '2024-01-15T10:30:00.000Z',
        exitCode: null,
        signal: 'SIGKILL',
        durationMs: 100,
        outputPreview: '',
      })
    ).resolves.not.toThrow();
  });

  it('should handle webhook failures gracefully', async () => {
    // Mock webhook that returns rejected promise
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await logCommandPreExecution({
      command: 'test',
      workdir: '/tmp',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    expect(result).toBeDefined();
  });
});
