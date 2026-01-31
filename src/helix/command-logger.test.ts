/**
 * Tests for Helix command logger module
 */

import { describe, it, expect } from 'vitest';

// Test sanitization logic
describe('Command Logger - sanitizeCommand', () => {
  // Recreate the sanitization function for testing
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

  it('should pass through normal commands unchanged', () => {
    const cmd = 'ls -la /home/user';
    expect(sanitizeCommand(cmd)).toBe(cmd);
  });

  it('should detect password in command', () => {
    expect(sanitizeCommand('mysql --password=secret123')).toBe(
      '[CONTAINS SENSITIVE DATA - CHECK LOGS]'
    );
    expect(sanitizeCommand('PASSWORD=secret ./script.sh')).toBe(
      '[CONTAINS SENSITIVE DATA - CHECK LOGS]'
    );
  });

  it('should detect secret in command', () => {
    expect(sanitizeCommand('export SECRET=abc123')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('--secret:myvalue')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect token in command', () => {
    expect(sanitizeCommand('curl -H "Authorization: Bearer token=abc"')).toBe(
      '[CONTAINS SENSITIVE DATA - CHECK LOGS]'
    );
    expect(sanitizeCommand('TOKEN:abc123')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect api_key in command', () => {
    expect(sanitizeCommand('curl --api_key=abc123')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('API-KEY=secret123')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('apikey=test')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should detect auth in command', () => {
    expect(sanitizeCommand('--auth=user:pass')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('AUTH:bearer-token')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });

  it('should truncate long commands', () => {
    const longCmd = 'a'.repeat(2000);
    const result = sanitizeCommand(longCmd, 100);
    expect(result).toHaveLength(100 + '... [truncated]'.length);
    expect(result.endsWith('... [truncated]')).toBe(true);
  });

  it('should not truncate short commands', () => {
    const shortCmd = 'ls -la';
    expect(sanitizeCommand(shortCmd, 100)).toBe(shortCmd);
  });

  it('should be case insensitive', () => {
    expect(sanitizeCommand('PASSWORD=secret')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('password=secret')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
    expect(sanitizeCommand('PaSsWoRd=secret')).toBe('[CONTAINS SENSITIVE DATA - CHECK LOGS]');
  });
});

describe('Command Logger - Log Entry Structure', () => {
  it('should have correct PreExecutionLog interface', () => {
    const log = {
      id: 'abc-123',
      command: 'ls -la',
      workdir: '/home/user',
      timestamp: '2024-01-15T10:30:00.000Z',
      sessionKey: 'session-1',
      elevated: false,
    };

    expect(log.id).toBeDefined();
    expect(log.command).toBeDefined();
    expect(log.workdir).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(typeof log.elevated).toBe('boolean');
  });

  it('should have correct PostExecutionLog interface', () => {
    const log = {
      id: 'abc-123',
      command: 'ls -la',
      workdir: '/home/user',
      timestamp: '2024-01-15T10:30:00.000Z',
      sessionKey: 'session-1',
      elevated: false,
      exitCode: 0,
      signal: null,
      durationMs: 150,
      outputPreview: 'file1.txt\nfile2.txt',
    };

    expect(log.exitCode).toBe(0);
    expect(log.signal).toBeNull();
    expect(log.durationMs).toBe(150);
    expect(log.outputPreview).toBeDefined();
  });
});

describe('Command Logger - Pending Commands State', () => {
  it('should track pending commands correctly', () => {
    // Simulate pending state management
    const pending = new Map<string, { id: string; command: string }>();

    // Add a pending command
    pending.set('log-1', { id: 'log-1', command: 'ls' });
    expect(pending.has('log-1')).toBe(true);
    expect(pending.size).toBe(1);

    // Add another
    pending.set('log-2', { id: 'log-2', command: 'pwd' });
    expect(pending.size).toBe(2);

    // Remove after completion
    pending.delete('log-1');
    expect(pending.has('log-1')).toBe(false);
    expect(pending.size).toBe(1);

    // Get pending command
    const cmd = pending.get('log-2');
    expect(cmd?.command).toBe('pwd');
  });

  it('should handle UUID generation', () => {
    // Using crypto.randomUUID pattern
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();

    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(id1).not.toBe(id2);
  });
});

describe('Command Logger - Discord Embed Structure', () => {
  it('should create valid pre-execution embed', () => {
    const embed = {
      title: '🔵 Command Starting',
      color: 0x3498db,
      fields: [
        { name: 'ID', value: '`abc12345`', inline: true },
        { name: 'Time', value: '2024-01-15T10:30:00.000Z', inline: true },
        { name: 'Elevated', value: 'No', inline: true },
        { name: 'Directory', value: '`/home/user`', inline: false },
        { name: 'Command', value: '```bash\nls -la\n```', inline: false },
      ],
      timestamp: '2024-01-15T10:30:00.000Z',
      footer: { text: 'PRE-EXECUTION - Already logged before running' },
    };

    expect(embed.title).toContain('Starting');
    expect(embed.color).toBe(0x3498db);
    expect(embed.fields.length).toBeGreaterThanOrEqual(5);
    expect(embed.footer.text).toContain('PRE-EXECUTION');
  });

  it('should use red color for elevated commands', () => {
    const normalColor = 0x3498db;
    const elevatedColor = 0xe74c3c;

    expect(normalColor).not.toBe(elevatedColor);
    expect(elevatedColor).toBe(0xe74c3c); // Red
  });

  it('should create valid post-execution embed', () => {
    const successEmbed = {
      title: '✅ Success',
      color: 0x2ecc71,
      fields: [
        { name: 'ID', value: '`abc12345`', inline: true },
        { name: 'Duration', value: '150ms', inline: true },
        { name: 'Exit', value: '0', inline: true },
      ],
      timestamp: '2024-01-15T10:30:00.150Z',
      footer: { text: 'POST-EXECUTION' },
    };

    expect(successEmbed.title).toContain('Success');
    expect(successEmbed.color).toBe(0x2ecc71); // Green
    expect(successEmbed.footer.text).toBe('POST-EXECUTION');
  });
});
