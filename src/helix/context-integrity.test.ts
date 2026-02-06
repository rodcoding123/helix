/**
 * Context Integrity Tests
 * Tests SHA-256 hashing, tampering detection, and integrity verification
 */

import { describe, it, expect, vi } from 'vitest';
import { calculateFileHash, verifyFileIntegrity } from './context-integrity.js';
import * as loggingHooks from './logging-hooks.js';

vi.mock('./logging-hooks.js', () => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('Context Integrity', () => {
  describe('calculateFileHash', () => {
    it('should calculate SHA-256 hash', () => {
      const content = 'test content';
      const hash = calculateFileHash(content);

      expect(hash).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars = 256 bits
    });

    it('should produce same hash for same content', () => {
      const content = 'test content';
      const hash1 = calculateFileHash(content);
      const hash2 = calculateFileHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different content', () => {
      const hash1 = calculateFileHash('content1');
      const hash2 = calculateFileHash('content2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be sensitive to small changes', () => {
      const hash1 = calculateFileHash('The quick brown fox');
      const hash2 = calculateFileHash('The quick brown dog');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty content', () => {
      const hash = calculateFileHash('');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle large content', () => {
      const largeContent = 'a'.repeat(100000);
      const hash = calculateFileHash(largeContent);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle unicode content', () => {
      const hash = calculateFileHash('🔐密码パスワード');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle newlines and special chars', () => {
      const content = 'line1\nline2\r\nline3\ttab';
      const hash = calculateFileHash(content);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyFileIntegrity', () => {
    const testContent = 'HELIX_SOUL="We are the ones who remember"';
    const expectedHash = calculateFileHash(testContent);

    it('should verify correct file integrity', async () => {
      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', testContent, expectedHash);

      expect(result).toBe(true);
    });

    it('should detect tampering', async () => {
      const tamperedContent = 'MODIFIED CONTENT';

      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', tamperedContent, expectedHash);

      expect(result).toBe(false);
    });

    it('should send alert on tampering detection', async () => {
      const tamperedContent = 'MODIFIED CONTENT';
      const sendAlertSpy = vi.spyOn(loggingHooks, 'sendAlert');

      await verifyFileIntegrity('soul/HELIX_SOUL.md', tamperedContent, expectedHash);

      expect(sendAlertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tampering Detected'),
        expect.any(String),
        'critical'
      );
    });

    it('should allow verification without expected hash', async () => {
      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', testContent);

      expect(result).toBe(true);
    });

    it('should log verification when no hash provided', async () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await verifyFileIntegrity('soul/HELIX_SOUL.md', testContent);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('without hash verification')
      );

      consoleDebugSpy.mockRestore();
    });

    it('should detect single bit flip in content', async () => {
      const contentBytes = Buffer.from(testContent);
      contentBytes[0] ^= 1; // Flip one bit
      const tamperedContent = contentBytes.toString('utf8', 0, testContent.length);

      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', tamperedContent, expectedHash);

      expect(result).toBe(false);
    });

    it('should detect byte addition', async () => {
      const tamperedContent = testContent + 'x';

      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', tamperedContent, expectedHash);

      expect(result).toBe(false);
    });

    it('should detect byte removal', async () => {
      const tamperedContent = testContent.slice(1);

      const result = await verifyFileIntegrity('soul/HELIX_SOUL.md', tamperedContent, expectedHash);

      expect(result).toBe(false);
    });

    it('should log successful verification', async () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await verifyFileIntegrity('soul/HELIX_SOUL.md', testContent, expectedHash);

      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('verified'));

      consoleDebugSpy.mockRestore();
    });

    it('should log errors on verification failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await verifyFileIntegrity('soul/HELIX_SOUL.md', 'MODIFIED', expectedHash);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('integrity failure'));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Security Properties', () => {
    it('should prevent collision attacks (avalanche effect)', () => {
      const content1 = 'A';
      const content2 = 'B';

      const hash1 = calculateFileHash(content1);
      const hash2 = calculateFileHash(content2);

      // Should be completely different hashes (avalanche effect)
      const diffBits = [...hash1].filter((char, i) => char !== hash2[i]).length;

      expect(diffBits).toBeGreaterThan(32); // Many bits should differ
    });

    it('should be preimage resistant (cannot reverse hash)', () => {
      const hash = calculateFileHash('secret content');

      // Cannot reconstruct original from hash (one-way function)
      expect(hash).not.toContain('secret');
      expect(hash).not.toContain('content');
    });

    it('should detect man-in-the-middle tampering', async () => {
      const originalContent = 'Important configuration';
      const originalHash = calculateFileHash(originalContent);

      // Attacker intercepts and modifies
      const attackContent = 'Malicious configuration';

      const result = await verifyFileIntegrity('config.json', attackContent, originalHash);

      expect(result).toBe(false); // Tampering detected
    });

    it('should have uniform distribution of hashes', () => {
      const hashes: string[] = [];

      for (let i = 0; i < 100; i++) {
        const content = `content_${i}`;
        hashes.push(calculateFileHash(content));
      }

      // Check that hashes have good distribution (all unique)
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(100);

      // Check that no two hashes start with same 8 chars
      const prefixes = hashes.map(h => h.slice(0, 8));
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBeGreaterThan(95);
    });
  });

  describe('Performance', () => {
    it('should calculate hash quickly', () => {
      const content = 'test content';

      const start = performance.now();
      calculateFileHash(content);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should handle large files efficiently', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB

      const start = performance.now();
      calculateFileHash(largeContent);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should verify integrity quickly', async () => {
      const content = 'test content';
      const hash = calculateFileHash(content);

      const start = performance.now();
      await verifyFileIntegrity('test.md', content, hash);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
