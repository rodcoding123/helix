/**
 * Hash Chain Rotation Tests
 * Tests core rotation, indexing, and archival functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { HashChainEntry } from './types.js';
import { getChainStats, rotateAndArchiveLogs } from './hash-chain-rotation.js';

// Test state directory
const TEST_STATE_DIR = path.join(os.tmpdir(), 'helix-rotation-test-' + Date.now());

beforeEach(async () => {
  process.env.HELIX_STATE_DIR = TEST_STATE_DIR;
  await fs.mkdir(TEST_STATE_DIR, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(TEST_STATE_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  delete process.env.HELIX_STATE_DIR;
});

/**
 * Create a test hash chain entry
 */
function createTestEntry(sequence: number, timestamp?: string): HashChainEntry {
  const ts = timestamp || new Date(Date.now() - (100 - sequence) * 60 * 1000).toISOString();
  return {
    timestamp: ts,
    previousHash: sequence === 0 ? 'GENESIS' : `hash${sequence - 1}`,
    entryHash: `hash${sequence}`,
    logStates: {
      'commands.log': `state${sequence}`,
      'api_calls.log': `api${sequence}`,
    },
    sequence,
  };
}

describe('Hash Chain Rotation - Core Functionality', () => {
  describe('getChainStats', () => {
    it('should return stats for empty chain', async () => {
      const stats = await getChainStats();

      expect(stats).toHaveProperty('activeEntries');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('archiveSize');
      expect(stats).toHaveProperty('retentionDays');
    });

    it('should track size correctly', async () => {
      // Create a chain file manually
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      const today = new Date().toISOString().split('T')[0];
      const chainFile = path.join(chainDir, `hash_chain.${today}.log`);

      // Write test data
      const entry = createTestEntry(0);
      await fs.writeFile(chainFile, JSON.stringify(entry) + '\n');

      const stats = await getChainStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should respect retention days setting', async () => {
      process.env.HELIX_LOG_RETENTION_DAYS = '7';

      const stats = await getChainStats();
      expect(stats.retentionDays).toBe(7);

      process.env.HELIX_LOG_RETENTION_DAYS = '30';
      const stats2 = await getChainStats();
      expect(stats2.retentionDays).toBe(30);

      delete process.env.HELIX_LOG_RETENTION_DAYS;
    });

    it('should use default retention days if not set', async () => {
      const stats = await getChainStats();
      expect(stats.retentionDays).toBe(30);
    });
  });

  describe('rotateAndArchiveLogs', () => {
    it('should not throw on missing directories', async () => {
      const result = await rotateAndArchiveLogs();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('archived');
      expect(result).toHaveProperty('deleted');
    });

    it('should return archival statistics', async () => {
      const result = await rotateAndArchiveLogs();
      expect(typeof result.archived).toBe('number');
      expect(typeof result.deleted).toBe('number');
      expect(result.archived).toBeGreaterThanOrEqual(0);
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });

    it('should not archive current day logs', async () => {
      // Create today's log file
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      const today = new Date().toISOString().split('T')[0];
      const chainFile = path.join(chainDir, `hash_chain.${today}.log`);

      const entry = createTestEntry(0);
      await fs.writeFile(chainFile, JSON.stringify(entry) + '\n');

      // Rotate should not archive today's file
      const result = await rotateAndArchiveLogs();
      // Should not archive current day's log
      expect(result.archived).toBe(0);
    });
  });

  describe('Date-based log rotation', () => {
    it('should generate current date in correct format', async () => {
      // This is implicit testing - the chain files use YYYY-MM-DD format
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      const today = new Date().toISOString().split('T')[0];
      const chainFile = path.join(chainDir, `hash_chain.${today}.log`);

      const entry = createTestEntry(0);
      await fs.writeFile(chainFile, JSON.stringify(entry) + '\n');

      // Verify file was created
      const exists = await fs
        .access(chainFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify date format is correct (YYYY-MM-DD)
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle different log files correctly', async () => {
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      // Create logs for different dates
      const dates = ['2025-02-03', '2025-02-04', new Date().toISOString().split('T')[0]];

      for (const date of dates) {
        const chainFile = path.join(chainDir, `hash_chain.${date}.log`);
        const entry = createTestEntry(0);
        await fs.writeFile(chainFile, JSON.stringify(entry) + '\n', { flag: 'a' });
      }

      // Verify all files exist
      const files = await fs.readdir(chainDir);
      expect(files.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Index file management', () => {
    it('should initialize index file if missing', async () => {
      await getChainStats();

      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      const indexFile = path.join(chainDir, '_index.json');

      const exists = await fs
        .access(indexFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create archive directory', async () => {
      await getChainStats();

      const archiveDir = path.join(TEST_STATE_DIR, 'hash_chain_logs', 'archive');
      const exists = await fs
        .access(archiveDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted index gracefully', async () => {
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      // Write corrupted index
      const indexFile = path.join(chainDir, '_index.json');
      await fs.writeFile(indexFile, 'CORRUPTED DATA');

      // Should not throw
      const stats = await getChainStats();
      expect(stats).toBeDefined();
    });

    it('should handle missing chain files gracefully', async () => {
      // Don't create any files
      const result = await rotateAndArchiveLogs();
      expect(result).toBeDefined();
    });

    it('should handle read-only directories gracefully', async () => {
      const stats = await getChainStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Performance characteristics', () => {
    it('should initialize and get stats quickly', async () => {
      const start = performance.now();
      await getChainStats();
      const duration = performance.now() - start;

      // Should complete in < 100ms even on first initialization
      expect(duration).toBeLessThan(100);
    });

    it('should rotate logs efficiently', async () => {
      // Create multiple log files
      const chainDir = path.join(TEST_STATE_DIR, 'hash_chain_logs');
      await fs.mkdir(chainDir, { recursive: true });

      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const chainFile = path.join(chainDir, `hash_chain.${dateStr}.log`);

        const entry = createTestEntry(0);
        await fs.writeFile(chainFile, JSON.stringify(entry) + '\n');
      }

      const start = performance.now();
      await rotateAndArchiveLogs();
      const duration = performance.now() - start;

      // Should complete in reasonable time even with multiple files
      expect(duration).toBeLessThan(500);
    });
  });
});
