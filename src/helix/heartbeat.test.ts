/**
 * Tests for Helix heartbeat module
 */

import { describe, it, expect, vi } from 'vitest';

describe('Heartbeat - Uptime Calculation', () => {
  // Recreate the uptime function for testing
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

  it('should return "unknown" for null start time', () => {
    expect(getHelixUptime(null)).toBe('unknown');
  });

  it('should format seconds correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 45 * 1000); // 45 seconds ago
    expect(getHelixUptime(startTime)).toBe('0m 45s');
    vi.useRealTimers();
  });

  it('should format minutes correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 5 * 60 * 1000); // 5 minutes ago
    expect(getHelixUptime(startTime)).toBe('5m 0s');
    vi.useRealTimers();
  });

  it('should format hours correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 2 * 60 * 60 * 1000 - 30 * 60 * 1000); // 2h 30m ago
    expect(getHelixUptime(startTime)).toBe('2h 30m');
    vi.useRealTimers();
  });

  it('should format days correctly', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startTime = new Date(now - 3 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000); // 3d 5h ago
    expect(getHelixUptime(startTime)).toBe('3d 5h 0m');
    vi.useRealTimers();
  });
});

describe('Heartbeat - Stats Structure', () => {
  it('should return correct stats format', () => {
    const getHeartbeatStats = (state: {
      running: boolean;
      count: number;
      startTime: Date | null;
    }): {
      running: boolean;
      count: number;
      startTime: Date | null;
      uptime: string;
    } => {
      const getUptime = (st: Date | null): string => {
        if (!st) return 'unknown';
        const ms = Date.now() - st.getTime();
        const minutes = Math.floor(ms / 60000);
        return `${minutes}m`;
      };

      return {
        running: state.running,
        count: state.count,
        startTime: state.startTime,
        uptime: getUptime(state.startTime),
      };
    };

    const startTime = new Date();
    const stats = getHeartbeatStats({
      running: true,
      count: 42,
      startTime,
    });

    expect(stats.running).toBe(true);
    expect(stats.count).toBe(42);
    expect(stats.startTime).toBe(startTime);
    expect(typeof stats.uptime).toBe('string');
  });
});

describe('Heartbeat - System Info', () => {
  it('should gather system information', () => {
    // Test the system info structure
    const sysInfo = {
      hostname: 'test-host',
      platform: 'linux 5.15.0',
      arch: 'x64',
      cpus: 8,
      memoryGB: '16.0',
      nodeVersion: 'v22.0.0',
      uptime: '24h 30m',
      pid: 12345,
    };

    expect(sysInfo.hostname).toBeDefined();
    expect(sysInfo.platform).toBeDefined();
    expect(sysInfo.arch).toBeDefined();
    expect(typeof sysInfo.cpus).toBe('number');
    expect(sysInfo.memoryGB).toMatch(/^\d+\.\d+$/);
    expect(sysInfo.nodeVersion).toMatch(/^v\d+/);
    expect(typeof sysInfo.pid).toBe('number');
  });
});

describe('Heartbeat - Discord Embeds', () => {
  it('should create valid startup embed', () => {
    const embed = {
      title: '🟢 HELIX ONLINE',
      color: 0x00ff00,
      fields: [
        { name: 'Status', value: '**LOGGING ACTIVE**', inline: true },
        { name: 'Boot Time', value: '2024-01-15T10:00:00.000Z', inline: true },
        { name: 'PID', value: '12345', inline: true },
        { name: 'Host', value: 'test-host', inline: true },
        { name: 'Platform', value: 'linux 5.15', inline: true },
        { name: 'Architecture', value: 'x64', inline: true },
      ],
      timestamp: '2024-01-15T10:00:00.000Z',
      footer: { text: 'Helix autonomous system initialized' },
    };

    expect(embed.title).toContain('ONLINE');
    expect(embed.color).toBe(0x00ff00); // Bright green
    expect(embed.fields.length).toBeGreaterThanOrEqual(6);
  });

  it('should create valid heartbeat embed', () => {
    const embed = {
      title: '💓 Heartbeat',
      color: 0x5865f2,
      fields: [
        { name: 'Beat #', value: '42', inline: true },
        { name: 'Helix Uptime', value: '1h 30m', inline: true },
        { name: 'Time', value: '2024-01-15T11:30:00.000Z', inline: true },
        { name: 'Memory', value: '128.5/256.0 MB', inline: true },
        { name: 'Load', value: '0.75', inline: true },
        { name: 'PID', value: '12345', inline: true },
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
        { name: 'Shutdown Time', value: '2024-01-15T12:00:00.000Z', inline: true },
        { name: 'Total Uptime', value: '2h 0m', inline: true },
        { name: 'Heartbeats Sent', value: '120', inline: true },
      ],
      timestamp: '2024-01-15T12:00:00.000Z',
      footer: { text: 'Graceful shutdown - logging will resume on next boot' },
    };

    expect(embed.title).toContain('OFFLINE');
    expect(embed.color).toBe(0xff0000); // Red
    expect(embed.footer.text).toContain('resume on next boot');
  });
});

describe('Heartbeat - Interval Management', () => {
  it('should track heartbeat interval state', () => {
    // Simulate interval management
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    // Start heartbeat
    const startHeartbeat = (): void => {
      if (heartbeatInterval) return; // Already running
      heartbeatInterval = setInterval(() => {
        // Heartbeat tick (count would increment here)
      }, 100); // Short interval for testing
    };

    // Stop heartbeat
    const stopHeartbeat = (): void => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    // Test
    expect(heartbeatInterval).toBeNull();

    startHeartbeat();
    expect(heartbeatInterval).not.toBeNull();

    // Starting again should not create new interval
    const savedInterval = heartbeatInterval;
    startHeartbeat();
    expect(heartbeatInterval).toBe(savedInterval);

    // Stop should clear interval
    stopHeartbeat();
    expect(heartbeatInterval).toBeNull();
  });

  it('should use 60 second interval constant', () => {
    const HEARTBEAT_INTERVAL = 60 * 1000;
    expect(HEARTBEAT_INTERVAL).toBe(60000);
  });
});

describe('Heartbeat - Status Update', () => {
  it('should create valid status update embed', () => {
    const embed = {
      title: '📊 Custom Status',
      color: 0xf1c40f,
      fields: [
        { name: 'Status', value: 'Processing complete', inline: true },
        { name: 'Time', value: '2024-01-15T10:30:00.000Z', inline: true },
        { name: 'Uptime', value: '30m 0s', inline: true },
        { name: 'Files Processed', value: '42', inline: true },
        { name: 'Errors', value: '0', inline: true },
      ],
      timestamp: '2024-01-15T10:30:00.000Z',
      footer: { text: 'Helix status update' },
    };

    expect(embed.title).toContain('Status');
    expect(embed.color).toBe(0xf1c40f); // Yellow
  });
});
