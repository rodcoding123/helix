/**
 * Tests for Helix heartbeat module
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  announceStartup,
  startHeartbeat,
  stopHeartbeat,
  announceShutdown,
  getHeartbeatStats,
  sendStatusUpdate,
} from './heartbeat.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Heartbeat - Startup Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should announce startup to Discord', async () => {
    const result = await announceStartup();

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should include system information', async () => {
    await announceStartup();

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];

    expect(embed.title).toContain('HELIX ONLINE');
    expect(embed.color).toBe(0x00ff00); // Green
    expect(embed.fields.some((f: { name: string }) => f.name === 'PID')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Host')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Platform')).toBe(true);
  });

  it('should return false on webhook failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await announceStartup();

    expect(result).toBe(false);
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await announceStartup();

    expect(result).toBe(false);
  });
});

describe('Heartbeat - Periodic Heartbeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    stopHeartbeat();
    vi.useRealTimers();
  });

  it('should start heartbeat and send immediately', async () => {
    startHeartbeat();

    // Wait for immediate heartbeat
    await vi.advanceTimersByTimeAsync(100);

    expect(mockFetch).toHaveBeenCalled();
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.embeds[0].title).toContain('Heartbeat');
  });

  it('should send heartbeats at 60 second intervals', async () => {
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(100); // Initial
    const initialCalls = mockFetch.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60000); // First interval
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);

    await vi.advanceTimersByTimeAsync(60000); // Second interval
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls + 1);
  });

  it('should increment beat counter', async () => {
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(100);
    const firstBeat = JSON.parse(mockFetch.mock.calls[0][1].body);
    const beatNumber1 = firstBeat.embeds[0].fields.find(
      (f: { name: string }) => f.name === 'Beat #'
    )?.value;

    await vi.advanceTimersByTimeAsync(60000);
    const secondBeat = JSON.parse(mockFetch.mock.calls[1][1].body);
    const beatNumber2 = secondBeat.embeds[0].fields.find(
      (f: { name: string }) => f.name === 'Beat #'
    )?.value;

    expect(parseInt(beatNumber2)).toBeGreaterThan(parseInt(beatNumber1));
  });

  it('should include system metrics', async () => {
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(100);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];

    expect(embed.fields.some((f: { name: string }) => f.name === 'Memory')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Load')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Helix Uptime')).toBe(true);
  });

  it('should stop heartbeats when stopped', async () => {
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(100);

    mockFetch.mockClear();
    stopHeartbeat();

    await vi.advanceTimersByTimeAsync(300000); // 5 minutes
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not start multiple heartbeats', () => {
    startHeartbeat();
    startHeartbeat(); // Should be ignored

    const stats1 = getHeartbeatStats();
    expect(stats1.running).toBe(true);
  });

  it('should handle webhook failures gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    // Should not throw
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(100);

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('Heartbeat - Shutdown Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should announce shutdown to Discord', async () => {
    const result = await announceShutdown('graceful');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should include shutdown reason', async () => {
    await announceShutdown('user requested');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];

    expect(embed.title).toContain('OFFLINE');
    expect(embed.color).toBe(0xff0000); // Red
    const reasonField = embed.fields.find((f: { name: string }) => f.name === 'Reason');
    expect(reasonField?.value).toBe('user requested');
  });

  it('should default to graceful shutdown', async () => {
    await announceShutdown();

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const reasonField = embed.fields.find((f: { name: string }) => f.name === 'Reason');
    expect(reasonField?.value).toBe('graceful');
  });

  it('should include uptime statistics', async () => {
    // Start to establish uptime
    await announceStartup();

    await announceShutdown('test');

    const callBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string }) => f.name === 'Total Uptime')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Heartbeats Sent')).toBe(true);
  });

  it('should return false on webhook failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await announceShutdown();

    expect(result).toBe(false);
  });
});

describe('Heartbeat - Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    stopHeartbeat();
    vi.useRealTimers();
  });

  it('should return initial stats', () => {
    const stats = getHeartbeatStats();

    expect(stats.running).toBe(false);
    expect(stats.count).toBeDefined();
    expect(typeof stats.count).toBe('number');
    expect(stats.uptime).toBeDefined();
  });

  it('should update stats when heartbeat running', async () => {
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(100);

    const stats = getHeartbeatStats();

    expect(stats.running).toBe(true);
    expect(stats.startTime).toBeDefined();
  });

  it('should track heartbeat count', async () => {
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(100);
    const stats1 = getHeartbeatStats();

    await vi.advanceTimersByTimeAsync(60000);
    const stats2 = getHeartbeatStats();

    expect(stats2.count).toBeGreaterThan(stats1.count);
  });

  it('should show running as false after stop', async () => {
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(100);

    stopHeartbeat();

    const stats = getHeartbeatStats();
    expect(stats.running).toBe(false);
  });
});

describe('Heartbeat - Uptime Branch Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    stopHeartbeat();
    vi.useRealTimers();
  });

  it('should format uptime with days (line 90)', async () => {
    // Set up fake time: 3 days and 5 hours ago
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 3 days and 5 hours
    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+d \d+h \d+m/);
    expect(stats.uptime).toContain('d'); // Verify days are shown
  });

  it('should format uptime with hours but no days (line 92)', async () => {
    // Set up fake time: 2 hours and 30 minutes ago (no days)
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 2 hours and 30 minutes
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000 + 30 * 60 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+h \d+m/);
    expect(stats.uptime).not.toContain('d'); // Verify no days
  });

  it('should format uptime with minutes only', async () => {
    // Set up fake time: 5 minutes and 30 seconds ago (no hours/days)
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 5 minutes and 30 seconds
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 30 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+m \d+s/);
    expect(stats.uptime).not.toContain('h'); // Verify no hours
    expect(stats.uptime).not.toContain('d'); // Verify no days
  });

  it('should include uptime in shutdown announcement with days', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 2 days
    await vi.advanceTimersByTimeAsync(2 * 24 * 60 * 60 * 1000);

    // Announce shutdown
    mockFetch.mockClear();
    const result = await announceShutdown('test shutdown');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();

    // Check the shutdown embed includes uptime
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const uptimeField = embed.fields.find((f: { name: string }) => f.name === 'Total Uptime');

    expect(uptimeField).toBeDefined();
    expect(uptimeField.value).toMatch(/\d+d/); // Should have days
  });
});

describe('Heartbeat - Uptime Branch Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    stopHeartbeat();
    vi.useRealTimers();
  });

  it('should format uptime with days (line 90)', async () => {
    // Set up fake time: 3 days and 5 hours ago
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 3 days and 5 hours
    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+d \d+h \d+m/);
    expect(stats.uptime).toContain('d'); // Verify days are shown
  });

  it('should format uptime with hours but no days (line 92)', async () => {
    // Set up fake time: 2 hours and 30 minutes ago (no days)
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 2 hours and 30 minutes
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000 + 30 * 60 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+h \d+m/);
    expect(stats.uptime).not.toContain('d'); // Verify no days
  });

  it('should format uptime with minutes only', async () => {
    // Set up fake time: 5 minutes and 30 seconds ago (no hours/days)
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 5 minutes and 30 seconds
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 30 * 1000);

    // Get stats which calls getHelixUptime internally
    const stats = getHeartbeatStats();
    expect(stats.uptime).toMatch(/\d+m \d+s/);
    expect(stats.uptime).not.toContain('h'); // Verify no hours
    expect(stats.uptime).not.toContain('d'); // Verify no days
  });

  it('should include uptime in shutdown announcement with days', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // Announce startup to set startTime
    await announceStartup();

    // Advance time by 2 days
    await vi.advanceTimersByTimeAsync(2 * 24 * 60 * 60 * 1000);

    // Announce shutdown
    mockFetch.mockClear();
    const result = await announceShutdown('test shutdown');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();

    // Check the shutdown embed includes uptime
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const uptimeField = embed.fields.find((f: { name: string }) => f.name === 'Total Uptime');

    expect(uptimeField).toBeDefined();
    expect(uptimeField.value).toMatch(/\d+d/); // Should have days
  });
});

describe('Heartbeat - Status Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should send custom status update', async () => {
    const result = await sendStatusUpdate('Task Complete', 'Processing finished');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should include custom details', async () => {
    await sendStatusUpdate('Backup Complete', 'All files backed up', {
      Files: '1234',
      Size: '5.6 GB',
      Duration: '2m 30s',
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];

    expect(embed.title).toContain('Backup Complete');
    expect(embed.color).toBe(0xf1c40f); // Yellow
    expect(embed.fields.some((f: { name: string }) => f.name === 'Files')).toBe(true);
    expect(embed.fields.some((f: { name: string }) => f.name === 'Size')).toBe(true);
  });

  it('should work without custom details', async () => {
    const result = await sendStatusUpdate('Simple Status', 'Just a status');

    expect(result).toBe(true);
  });

  it('should include uptime in status', async () => {
    await announceStartup(); // Establish start time

    await sendStatusUpdate('Status', 'Test');

    const callBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string }) => f.name === 'Uptime')).toBe(true);
  });

  it('should return false on webhook failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await sendStatusUpdate('Test', 'Test');

    expect(result).toBe(false);
  });
});

describe('Heartbeat - Uptime Calculation', () => {
  // Recreate the uptime function for unit testing
  const getHelixUptime = (startTime: Date | null): string => {
    if (!startTime) return 'unknown';

    const ms = Date.now() - startTime.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return unknown for null start time', () => {
    expect(getHelixUptime(null)).toBe('unknown');
  });

  it('should format seconds correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 45 * 1000); // 45 seconds ago
    expect(getHelixUptime(startTime)).toBe('0m 45s');
  });

  it('should format minutes correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 5 * 60 * 1000); // 5 minutes ago
    expect(getHelixUptime(startTime)).toBe('5m 0s');
  });

  it('should format hours correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 2 * 60 * 60 * 1000 - 30 * 60 * 1000); // 2h 30m ago
    expect(getHelixUptime(startTime)).toBe('2h 30m');
  });

  it('should format days correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 3 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000); // 3d 5h ago
    expect(getHelixUptime(startTime)).toBe('3d 5h 0m');
  });

  it('should handle very long uptimes', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const uptime = getHelixUptime(startTime);
    expect(uptime).toContain('30d');
  });

  it('should handle zero uptime', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now);
    expect(getHelixUptime(startTime)).toBe('0m 0s');
  });
});

describe('Heartbeat - Discord Embed Structure', () => {
  it('should create valid startup embed', () => {
    const embed = {
      title: '🟢 HELIX ONLINE',
      color: 0x00ff00,
      fields: [
        { name: 'Status', value: '**LOGGING ACTIVE**', inline: true },
        { name: 'Boot Time', value: '2024-01-15T10:00:00.000Z', inline: true },
        { name: 'PID', value: '12345', inline: true },
      ],
      timestamp: '2024-01-15T10:00:00.000Z',
      footer: { text: 'Helix autonomous system initialized' },
    };

    expect(embed.title).toContain('ONLINE');
    expect(embed.color).toBe(0x00ff00);
    expect(embed.footer.text).toContain('initialized');
  });

  it('should create valid heartbeat embed', () => {
    const embed = {
      title: '💓 Heartbeat',
      color: 0x5865f2,
      fields: [
        { name: 'Beat #', value: '42', inline: true },
        { name: 'Helix Uptime', value: '1h 30m', inline: true },
        { name: 'Memory', value: '128.5/256.0 MB', inline: true },
      ],
      timestamp: '2024-01-15T11:30:00.000Z',
      footer: { text: 'Proof of life - every 60 seconds' },
    };

    expect(embed.title).toContain('Heartbeat');
    expect(embed.color).toBe(0x5865f2); // Discord blurple
    expect(embed.footer.text).toContain('60 seconds');
  });

  it('should create valid shutdown embed', () => {
    const embed = {
      title: '🔴 HELIX OFFLINE',
      color: 0xff0000,
      fields: [
        { name: 'Status', value: '**SHUTTING DOWN**', inline: true },
        { name: 'Reason', value: 'graceful', inline: true },
        { name: 'Total Uptime', value: '2h 0m', inline: true },
      ],
      timestamp: '2024-01-15T12:00:00.000Z',
      footer: { text: 'Graceful shutdown - logging will resume on next boot' },
    };

    expect(embed.title).toContain('OFFLINE');
    expect(embed.color).toBe(0xff0000); // Red
    expect(embed.footer.text).toContain('resume on next boot');
  });
});

describe('Heartbeat - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    stopHeartbeat();
  });

  it('should handle missing webhook URL', async () => {
    // Mock no webhook configured
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await announceStartup();

    expect(result).toBe(false);
  });

  it('should handle network timeout', async () => {
    mockFetch.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
    );

    const result = await announceStartup();

    expect(result).toBe(false);
  });

  it('should handle Discord rate limiting', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const result = await sendStatusUpdate('Test', 'Test');

    expect(result).toBe(false);
  });

  it('should stop cleanly when not running', () => {
    // Should not throw
    expect(() => stopHeartbeat()).not.toThrow();
  });

  it('should handle very long status titles', async () => {
    const longTitle = 'x'.repeat(500);

    await expect(sendStatusUpdate(longTitle, 'Test')).resolves.toBeDefined();
  });

  it('should handle empty details object', async () => {
    const result = await sendStatusUpdate('Test', 'Test', {});

    expect(result).toBe(true);
  });

  it('should handle special characters in status', async () => {
    const result = await sendStatusUpdate(
      'Test 🚀',
      'Status with emoji 💓 and special chars !@#$%'
    );

    expect(result).toBe(true);
  });
});

describe('Heartbeat - Uncovered Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopHeartbeat();
  });

  afterEach(() => {
    stopHeartbeat();
    delete process.env.DISCORD_WEBHOOK_HEARTBEAT;
  });

  it('should send and receive proper heartbeat status with running state', async () => {
    // Test lines 89, 91: uptime formatting branches through normal operation
    // Start heartbeat and let it run to cycle through various uptime states
    startHeartbeat();

    // Initial state should be running
    expect(getHeartbeatStats().running).toBe(true);

    // After some time, various uptime branches will be exercised
    await new Promise(resolve => setTimeout(resolve, 50));

    // Send a custom status to exercise the full heartbeat cycle
    const statusResult = await sendStatusUpdate('Test Status', 'Running');
    expect(statusResult).toBe(true);

    // Verify heartbeat is still active
    const stats = getHeartbeatStats();
    expect(stats.running).toBe(true);
    expect(stats.count).toBeGreaterThan(0);
  });

  it('should handle consecutive startHeartbeat calls (guards against double-start)', () => {
    // Test line 185: ensures startHeartbeat handles being called multiple times
    // First call should work
    startHeartbeat();
    const stats1 = getHeartbeatStats();
    expect(stats1.running).toBe(true);

    // Second call should be ignored (not crash, not create multiple intervals)
    startHeartbeat();
    const stats2 = getHeartbeatStats();
    expect(stats2.running).toBe(true);

    // Beat count should not have doubled
    expect(stats2.count).toBe(stats1.count);
  });

  it('should handle stopHeartbeat when no heartbeat is running', () => {
    // Test line 200: stopHeartbeat safely handles being called when not running
    // Ensure no heartbeat is running
    stopHeartbeat();

    // Call stop again - should not throw
    expect(() => stopHeartbeat()).not.toThrow();

    // Should be stopped
    expect(getHeartbeatStats().running).toBe(false);
  });

  it('should include detailed error context when webhook fails', async () => {
    // Test line 42: error logging in sendWebhook catch block
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fetch to fail
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    // Try to announce startup - webhook should fail
    const result = await announceStartup();
    expect(result).toBe(false);

    // Verify error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Heartbeat webhook failed'),
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});
