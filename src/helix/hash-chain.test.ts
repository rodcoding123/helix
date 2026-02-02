/**
 * Tests for Helix hash chain module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {
  computeEntryHash,
  hashLogFiles,
  createHashChainEntry,
  verifyChain,
  getChainState,
  startHashChainScheduler,
  stopHashChainScheduler,
  setHashChainFailClosedMode,
} from './hash-chain.js';

// Mock fs and fetch
vi.mock('node:fs/promises');
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Hash Chain - computeEntryHash', () => {
  it('should compute deterministic hash for same inputs', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    const previousHash = 'abc123';
    const logStates = { 'commands.log': 'hash1', 'api_calls.log': 'hash2' };

    const hash1 = computeEntryHash(timestamp, previousHash, logStates);
    const hash2 = computeEntryHash(timestamp, previousHash, logStates);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hash for different timestamps', () => {
    const logStates = { 'commands.log': 'hash1' };

    const hash1 = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', logStates);
    const hash2 = computeEntryHash('2024-01-15T10:31:00.000Z', 'prev', logStates);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different previous hash', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    const logStates = { 'commands.log': 'hash1' };

    const hash1 = computeEntryHash(timestamp, 'prev1', logStates);
    const hash2 = computeEntryHash(timestamp, 'prev2', logStates);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different log states', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    const previousHash = 'prev';

    const hash1 = computeEntryHash(timestamp, previousHash, { 'a.log': 'hash1' });
    const hash2 = computeEntryHash(timestamp, previousHash, { 'a.log': 'hash2' });

    expect(hash1).not.toBe(hash2);
  });

  it('should sort log states alphabetically for consistency', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    const previousHash = 'prev';

    // Same states, different insertion order
    const states1 = { 'b.log': 'hash2', 'a.log': 'hash1' };
    const states2 = { 'a.log': 'hash1', 'b.log': 'hash2' };

    const hash1 = computeEntryHash(timestamp, previousHash, states1);
    const hash2 = computeEntryHash(timestamp, previousHash, states2);

    expect(hash1).toBe(hash2);
  });

  it('should handle empty log states', () => {
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', {});
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle GENESIS as previous hash', () => {
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'GENESIS', {
      'commands.log': 'hash1',
    });
    expect(hash).toHaveLength(64);
  });

  it('should handle very long log state values', () => {
    const longHash = 'a'.repeat(1000);
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', {
      'test.log': longHash,
    });
    expect(hash).toHaveLength(64);
  });

  it('should handle special characters in log states', () => {
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', {
      'test.log': 'hash|with:special/chars',
    });
    expect(hash).toHaveLength(64);
  });
});

describe('Hash Chain - hashLogFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should hash existing log files', async () => {
    // Mock file exists
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('log content'));

    const states = await hashLogFiles();

    expect(states).toBeDefined();
    expect(Object.keys(states).length).toBeGreaterThan(0);
    // Each hash should be 64 hex chars or 'MISSING'
    for (const hash of Object.values(states)) {
      expect(hash === 'MISSING' || hash.match(/^[a-f0-9]{64}$/)).toBeTruthy();
    }
  });

  it('should mark missing log files as MISSING', async () => {
    // Mock file not found
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const states = await hashLogFiles();

    expect(states).toBeDefined();
    for (const hash of Object.values(states)) {
      expect(hash).toBe('MISSING');
    }
  });

  it('should handle empty log files', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));

    const states = await hashLogFiles();

    expect(states).toBeDefined();
    for (const hash of Object.values(states)) {
      if (hash !== 'MISSING') {
        expect(hash).toHaveLength(64);
      }
    }
  });
});

describe('Hash Chain - createHashChainEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Disable fail-closed mode for testing
    setHashChainFailClosedMode(false);
    // Mock successful Discord webhook
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    // Mock file operations
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT')); // No existing chain
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopHashChainScheduler();
  });

  it('should create hash chain entry with correct structure', async () => {
    const entry = await createHashChainEntry();

    expect(entry).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.previousHash).toBeDefined();
    expect(entry.logStates).toBeDefined();
    expect(entry.entryHash).toBeDefined();
    expect(entry.entryHash).toHaveLength(64);
    expect(typeof entry.sequence).toBe('number');
  });

  it('should send to Discord before writing locally', async () => {
    await createHashChainEntry();

    // Verify Discord was called
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Verify file write happened
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should link to previous hash', async () => {
    // First entry
    const entry1 = await createHashChainEntry();

    // Mock reading the first entry
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entry1));

    // Second entry
    const entry2 = await createHashChainEntry();

    expect(entry2.previousHash).toBe(entry1.entryHash);
    expect(entry2.sequence).toBe((entry1.sequence || 0) + 1);
  });

  it('should use GENESIS for first entry', async () => {
    const entry = await createHashChainEntry();
    expect(entry.previousHash).toBe('GENESIS');
  });

  it('should handle Discord webhook failure in fail-open mode', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    // Should not throw in fail-open mode
    const entry = await createHashChainEntry();
    expect(entry).toBeDefined();
  });

  it('should handle file write failure gracefully', async () => {
    vi.mocked(fs.appendFile).mockRejectedValue(new Error('Disk full'));

    // Should still return entry (Discord has it)
    const entry = await createHashChainEntry();
    expect(entry).toBeDefined();
  });
});

describe('Hash Chain - verifyChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify valid chain', async () => {
    const entry1 = {
      timestamp: '2024-01-15T10:00:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'a.log': 'hash1' },
      entryHash: computeEntryHash('2024-01-15T10:00:00.000Z', 'GENESIS', { 'a.log': 'hash1' }),
      sequence: 0,
    };
    const entry2 = {
      timestamp: '2024-01-15T10:05:00.000Z',
      previousHash: entry1.entryHash,
      logStates: { 'a.log': 'hash2' },
      entryHash: computeEntryHash('2024-01-15T10:05:00.000Z', entry1.entryHash, {
        'a.log': 'hash2',
      }),
      sequence: 1,
    };

    const chainContent = JSON.stringify(entry1) + '\n' + JSON.stringify(entry2) + '\n';
    vi.mocked(fs.readFile).mockResolvedValue(chainContent);

    const result = await verifyChain();

    expect(result.valid).toBe(true);
    expect(result.entries).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect tampered entry hash', async () => {
    const entry = {
      timestamp: '2024-01-15T10:00:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'a.log': 'hash1' },
      entryHash: 'tampered_hash',
      sequence: 0,
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entry));

    const result = await verifyChain();

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('entryHash mismatch');
  });

  it('should detect broken chain link', async () => {
    const entry1 = {
      timestamp: '2024-01-15T10:00:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'a.log': 'hash1' },
      entryHash: computeEntryHash('2024-01-15T10:00:00.000Z', 'GENESIS', { 'a.log': 'hash1' }),
      sequence: 0,
    };
    const entry2 = {
      timestamp: '2024-01-15T10:05:00.000Z',
      previousHash: 'WRONG_HASH', // Broken link
      logStates: { 'a.log': 'hash2' },
      entryHash: computeEntryHash('2024-01-15T10:05:00.000Z', 'WRONG_HASH', { 'a.log': 'hash2' }),
      sequence: 1,
    };

    const chainContent = JSON.stringify(entry1) + '\n' + JSON.stringify(entry2) + '\n';
    vi.mocked(fs.readFile).mockResolvedValue(chainContent);

    const result = await verifyChain();

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('previousHash mismatch');
  });

  it('should handle empty chain', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('');

    const result = await verifyChain();

    expect(result.valid).toBe(true);
    expect(result.entries).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle malformed JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('not valid json\n');

    const result = await verifyChain();

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('should handle missing chain file', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: file not found'));

    const result = await verifyChain();

    expect(result.valid).toBe(false);
    expect(result.entries).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Hash Chain - getChainState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return current chain state', async () => {
    const entry = {
      timestamp: '2024-01-15T10:00:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'a.log': 'hash1' },
      entryHash: 'abc123',
      sequence: 5,
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entry));

    const state = await getChainState();

    expect(state.lastHash).toBe('abc123');
    expect(state.sequence).toBe(6); // Next sequence
    expect(state.entries).toBe(1);
  });

  it('should return GENESIS state for empty chain', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const state = await getChainState();

    expect(state.lastHash).toBe('GENESIS');
    expect(state.sequence).toBe(0);
    expect(state.entries).toBe(0);
  });
});

describe('Hash Chain - Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setHashChainFailClosedMode(false);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopHashChainScheduler();
    vi.useRealTimers();
  });

  it('should start scheduler and create initial entry', async () => {
    startHashChainScheduler(1000);

    // Wait for initial entry
    await vi.advanceTimersByTimeAsync(100);

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should create entries at regular intervals', async () => {
    mockFetch.mockClear();
    startHashChainScheduler(1000);

    await vi.advanceTimersByTimeAsync(100); // Initial
    const initialCalls = mockFetch.mock.calls.length;

    await vi.advanceTimersByTimeAsync(1000); // First interval
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);

    await vi.advanceTimersByTimeAsync(1000); // Second interval
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls + 1);
  });

  it('should stop scheduler', async () => {
    startHashChainScheduler(1000);
    await vi.advanceTimersByTimeAsync(100);

    mockFetch.mockClear();
    stopHashChainScheduler();

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not start multiple schedulers', async () => {
    startHashChainScheduler(1000);
    startHashChainScheduler(1000); // Second call should be ignored

    await vi.advanceTimersByTimeAsync(100);

    // Should only create one initial entry
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('Hash Chain - Edge Cases', () => {
  it('should handle null values in log states', () => {
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', {
      'test.log': '',
    });
    expect(hash).toHaveLength(64);
  });

  it('should handle very long timestamp', () => {
    const longTimestamp = '2024-01-15T10:30:00.000Z' + 'x'.repeat(1000);
    const hash = computeEntryHash(longTimestamp, 'prev', { 'a.log': 'hash1' });
    expect(hash).toHaveLength(64);
  });

  it('should handle many log states', () => {
    const manyStates: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      manyStates[`log${i}.log`] = `hash${i}`;
    }
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'prev', manyStates);
    expect(hash).toHaveLength(64);
  });
});
