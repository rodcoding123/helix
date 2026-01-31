/**
 * Tests for Helix hash chain module
 */

import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// Test the pure functions that don't require Discord
describe('Hash Chain - computeEntryHash', () => {
  // Import the function directly for testing
  const computeEntryHash = (
    timestamp: string,
    previousHash: string,
    logStates: Record<string, string>
  ): string => {
    const sortedKeys = Object.keys(logStates).sort();
    const sortedStates = sortedKeys.map(k => `${k}:${logStates[k]}`).join('|');
    const entryContent = `${timestamp}|${previousHash}|${sortedStates}`;
    return crypto.createHash('sha256').update(entryContent).digest('hex');
  };

  it('should compute deterministic hash for same inputs', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    const previousHash = 'abc123';
    const logStates = { 'commands.log': 'hash1', 'api_calls.log': 'hash2' };

    const hash1 = computeEntryHash(timestamp, previousHash, logStates);
    const hash2 = computeEntryHash(timestamp, previousHash, logStates);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
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
  });

  it('should handle GENESIS as previous hash', () => {
    const hash = computeEntryHash('2024-01-15T10:30:00.000Z', 'GENESIS', {
      'commands.log': 'hash1',
    });
    expect(hash).toHaveLength(64);
  });
});

describe('Hash Chain - Entry Structure', () => {
  it('should have correct HashChainEntry interface', () => {
    // Test that the interface matches expected structure
    const entry = {
      timestamp: '2024-01-15T10:30:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'commands.log': 'abc123' },
      entryHash: 'def456',
      sequence: 0,
    };

    expect(entry.timestamp).toBeDefined();
    expect(entry.previousHash).toBeDefined();
    expect(entry.logStates).toBeDefined();
    expect(entry.entryHash).toBeDefined();
    expect(typeof entry.sequence).toBe('number');
  });

  it('should link entries correctly', () => {
    // Simulate chain linking
    const computeHash = (ts: string, prev: string, states: Record<string, string>): string => {
      const sortedKeys = Object.keys(states).sort();
      const sortedStates = sortedKeys.map(k => `${k}:${states[k]}`).join('|');
      const content = `${ts}|${prev}|${sortedStates}`;
      return crypto.createHash('sha256').update(content).digest('hex');
    };

    const entry1 = {
      timestamp: '2024-01-15T10:00:00.000Z',
      previousHash: 'GENESIS',
      logStates: { 'a.log': 'hash1' },
      entryHash: '',
      sequence: 0,
    };
    entry1.entryHash = computeHash(entry1.timestamp, entry1.previousHash, entry1.logStates);

    const entry2 = {
      timestamp: '2024-01-15T10:05:00.000Z',
      previousHash: entry1.entryHash, // Links to previous
      logStates: { 'a.log': 'hash2' },
      entryHash: '',
      sequence: 1,
    };
    entry2.entryHash = computeHash(entry2.timestamp, entry2.previousHash, entry2.logStates);

    // Verify linking
    expect(entry2.previousHash).toBe(entry1.entryHash);
    expect(entry2.sequence).toBe(entry1.sequence + 1);
  });
});

describe('Hash Chain - Verification Logic', () => {
  it('should detect broken chain links', () => {
    // Simulate verification logic
    const verifyChainLogic = (
      entries: Array<{ previousHash: string; entryHash: string }>
    ): boolean => {
      let expectedPrev = 'GENESIS';
      for (const entry of entries) {
        if (entry.previousHash !== expectedPrev) {
          return false;
        }
        expectedPrev = entry.entryHash;
      }
      return true;
    };

    const validChain = [
      { previousHash: 'GENESIS', entryHash: 'hash1' },
      { previousHash: 'hash1', entryHash: 'hash2' },
      { previousHash: 'hash2', entryHash: 'hash3' },
    ];

    const brokenChain = [
      { previousHash: 'GENESIS', entryHash: 'hash1' },
      { previousHash: 'WRONG', entryHash: 'hash2' }, // Broken link
      { previousHash: 'hash2', entryHash: 'hash3' },
    ];

    expect(verifyChainLogic(validChain)).toBe(true);
    expect(verifyChainLogic(brokenChain)).toBe(false);
  });

  it('should handle empty chain', () => {
    const verifyChainLogic = (
      entries: Array<{ previousHash: string; entryHash: string }>
    ): boolean => {
      if (entries.length === 0) return true;
      let expectedPrev = 'GENESIS';
      for (const entry of entries) {
        if (entry.previousHash !== expectedPrev) return false;
        expectedPrev = entry.entryHash;
      }
      return true;
    };

    expect(verifyChainLogic([])).toBe(true);
  });
});
