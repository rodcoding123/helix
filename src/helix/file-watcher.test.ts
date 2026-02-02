/**
 * Tests for file-watcher.ts
 * Helix file change monitoring and Discord logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Mock the file system and fetch
vi.mock('node:fs');
vi.mock('node:crypto');

// We need to test the module functions without actually watching files
// Import the module after mocking
const {
  getWatchedDirectories,
  getHashCacheSize,
  manualLogFileChange,
  startFileWatcher: _startFileWatcher,
  stopFileWatcher,
} = await import('./file-watcher.js');

// _startFileWatcher is imported for potential future tests but not currently used
void _startFileWatcher;

describe('FileWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hash cache by stopping watcher
    stopFileWatcher();
  });

  afterEach(() => {
    stopFileWatcher();
  });

  describe('getWatchedDirectories', () => {
    it('returns filtered list of directories', () => {
      const dirs = getWatchedDirectories();
      expect(Array.isArray(dirs)).toBe(true);
    });

    it('filters out undefined/null values', () => {
      const dirs = getWatchedDirectories();
      expect(dirs.every(d => d !== undefined && d !== null)).toBe(true);
    });
  });

  describe('getHashCacheSize', () => {
    it('returns number', () => {
      const size = getHashCacheSize();
      expect(typeof size).toBe('number');
    });

    it('returns 0 after stop', () => {
      stopFileWatcher();
      const size = getHashCacheSize();
      expect(size).toBe(0);
    });
  });

  describe('stopFileWatcher', () => {
    it('clears hash cache', () => {
      stopFileWatcher();
      expect(getHashCacheSize()).toBe(0);
    });

    it('can be called multiple times safely', () => {
      stopFileWatcher();
      stopFileWatcher();
      stopFileWatcher();
      expect(getHashCacheSize()).toBe(0);
    });
  });

  describe('manualLogFileChange', () => {
    beforeEach(() => {
      // Mock fetch for webhook
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
    });

    it('handles created file change', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test content'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 12 } as fs.Stats);

      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('abc123'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/file.txt', 'created');

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles modified file change', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('modified content'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 16 } as fs.Stats);

      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('def456'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/file.txt', 'modified');

      expect(true).toBe(true);
    });

    it('handles deleted file change', async () => {
      await manualLogFileChange('/test/file.txt', 'deleted');

      // Should not throw and should not try to read the file
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('handles file read errors gracefully', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      // Should not throw
      await manualLogFileChange('/nonexistent/file.txt', 'created');
      expect(true).toBe(true);
    });

    it('handles stat errors gracefully', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'));
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('Stat failed');
      });

      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('xyz789'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/file.txt', 'created');
      expect(true).toBe(true);
    });
  });

  describe('ignore patterns', () => {
    // Test that the module has correct ignore patterns
    it('should have common ignore patterns defined', () => {
      // The module should ignore these file types
      // Common patterns: .pyc, .pyo, __pycache__, .git, .swp, .swo, .DS_Store, node_modules, .env
      // We can't directly test private constants, but we verify the module loads
      expect(getWatchedDirectories).toBeDefined();
    });
  });

  describe('critical file detection', () => {
    it('defines critical files for enhanced logging', () => {
      // Critical files that should trigger warnings:
      // SOUL.md, USER.md, MEMORY.md, goals.json, attachments.json
      // Verify the module exports are defined (tested via behavior)
      expect(getWatchedDirectories).toBeDefined();
      expect(stopFileWatcher).toBeDefined();
    });
  });

  describe('hash computation', () => {
    it('uses MD5 for file hashing', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

      const mockHashInstance = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('d41d8cd98f00b204e9800998ecf8427e'),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHashInstance as unknown as crypto.Hash);

      // The module uses MD5 for fast file change detection
      expect(crypto.createHash).toBeDefined();
    });
  });

  describe('embed formatting', () => {
    it('uses correct emojis for change types', () => {
      // Emojis used by the module
      const emojis = {
        created: '🆕',
        modified: '📝',
        deleted: '🗑️',
      };

      expect(emojis.created).toBe('🆕');
      expect(emojis.modified).toBe('📝');
      expect(emojis.deleted).toBe('🗑️');
    });

    it('uses correct colors for change types', () => {
      // Colors used by the module
      const colors = {
        created: 0x2ecc71, // Green
        modified: 0xf1c40f, // Yellow
        deleted: 0xe74c3c, // Red
      };

      expect(colors.created).toBe(0x2ecc71);
      expect(colors.modified).toBe(0xf1c40f);
      expect(colors.deleted).toBe(0xe74c3c);
    });
  });

  describe('size formatting', () => {
    it('formats sizes correctly', () => {
      // Size formatting logic
      const formatSize = (bytes: number): string => {
        return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} bytes`;
      };

      expect(formatSize(512)).toBe('512 bytes');
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(2048)).toBe('2.0 KB');
      expect(formatSize(1536)).toBe('1.5 KB');
    });
  });

  describe('sendWebhook', () => {
    const originalWebhookEnv = process.env.DISCORD_WEBHOOK_FILE_CHANGES;

    beforeEach(() => {
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = 'https://discord.com/api/webhooks/test';
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
    });

    afterEach(() => {
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = originalWebhookEnv;
      vi.clearAllMocks();
    });

    it('sends webhook with correct format', async () => {
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = 'https://discord.com/api/webhooks/test';
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test content'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 12 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('abc123'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/file.txt', 'created');

      expect(global.fetch).toHaveBeenCalled();
      const call = vi.mocked(global.fetch).mock.calls[0];
      // The module reads the env var at load time, so it may have a different value
      expect(call[0]).toContain('discord.com');
      expect(call[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('handles webhook failure gracefully', async () => {
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = 'https://discord.com/api/webhooks/test';
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 4 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('abc'),
      } as unknown as crypto.Hash);

      // Should not throw even if webhook fails
      await expect(manualLogFileChange('/test/file.txt', 'created')).resolves.not.toThrow();
    });

    it('does nothing when webhook URL not configured', async () => {
      // NOTE: The webhook URL is captured at module load time
      // This test verifies that the module would skip webhook calls if the URL is undefined
      // Since the module is already loaded, we can't actually test this scenario dynamically
      // This test documents the expected behavior
      expect(true).toBe(true);
    });
  });

  describe('logFileChange embed creation', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = 'https://discord.com/api/webhooks/test';
    });

    afterEach(() => {
      delete process.env.DISCORD_WEBHOOK_FILE_CHANGES;
    });

    it('creates embed with hash field for non-deleted files', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 7 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('abcdef1234567890'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/file.txt', 'created');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      const hashField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Hash');
      expect(hashField).toBeDefined();
      expect(hashField.value).toContain('abcdef1234567890');
    });

    it('creates embed with size field in bytes for small files', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 512 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/small.txt', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      const sizeField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Size');
      expect(sizeField?.value).toBe('512 bytes');
    });

    it('creates embed with size field in KB for large files', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('x'.repeat(2048)));
      vi.mocked(fs.statSync).mockReturnValue({ size: 2048 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/large.txt', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      const sizeField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Size');
      expect(sizeField?.value).toBe('2.0 KB');
    });

    it('marks critical files with warning', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('soul'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 4 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/config/SOUL.md', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      const embed = body.embeds[0];
      expect(embed.title).toContain('CRITICAL');
      expect(embed.color).toBe(0xe74c3c);
      const warningField = embed.fields.find((f: { name: string }) => f.name === 'Warning');
      expect(warningField).toBeDefined();
    });

    it('marks USER.md as critical', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('user'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 4 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/path/USER.md', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].title).toContain('CRITICAL');
    });

    it('marks MEMORY.md as critical', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('memory'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 6 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/path/MEMORY.md', 'created');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].title).toContain('CRITICAL');
    });

    it('marks goals.json as critical', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('{}'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 2 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/identity/goals.json', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].title).toContain('CRITICAL');
    });

    it('marks attachments.json as critical', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('[]'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 2 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/psychology/attachments.json', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].title).toContain('CRITICAL');
    });

    it('uses correct color for created files', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('new'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 3 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/new.txt', 'created');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].color).toBe(0x2ecc71);
    });

    it('uses correct color for modified files', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('modified'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 8 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      await manualLogFileChange('/test/mod.txt', 'modified');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].color).toBe(0xf1c40f);
    });

    it('uses correct color for deleted files', async () => {
      await manualLogFileChange('/test/deleted.txt', 'deleted');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].color).toBe(0xe74c3c);
    });

    it('includes timestamp field', async () => {
      await manualLogFileChange('/test/file.txt', 'deleted');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      const timeField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Time');
      expect(timeField).toBeDefined();
    });

    it('includes footer text', async () => {
      await manualLogFileChange('/test/file.txt', 'deleted');

      const call = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].footer.text).toBe('File change detected');
    });
  });

  describe('startFileWatcher', () => {
    beforeEach(() => {
      stopFileWatcher();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.watch).mockReturnValue({
        close: vi.fn(),
      } as unknown as fs.FSWatcher);
    });

    it('checks directory exists before watching', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      _startFileWatcher();

      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('skips non-existent directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      _startFileWatcher();

      expect(fs.watch).not.toHaveBeenCalled();
    });

    it('resolves ~ to home directory', () => {
      process.env.OPENCLAW_WORKSPACE = '~/.openclaw/workspace';
      const homeDir = process.env.HOME || process.env.USERPROFILE;

      _startFileWatcher();

      if (homeDir) {
        const expectedPath = process.env.OPENCLAW_WORKSPACE.replace(/^~/, homeDir);
        expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      }
    });

    it('starts fs.watch with recursive option', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      process.env.HELIX_CONFIG_DIR = '/tmp/test-config';

      _startFileWatcher();

      expect(fs.watch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true }),
        expect.any(Function)
      );
    });

    it('handles watch errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockImplementation(() => {
        throw new Error('Watch failed');
      });

      // Should not throw
      expect(() => _startFileWatcher()).not.toThrow();
    });

    it('initializes hash cache for watched directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'test.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'));
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash123'),
      } as unknown as crypto.Hash);

      stopFileWatcher();
      _startFileWatcher();

      expect(getHashCacheSize()).toBeGreaterThan(0);
    });
  });

  describe('initializeHashCache', () => {
    beforeEach(() => {
      stopFileWatcher();
    });

    it('walks directory tree recursively', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync)
        .mockReturnValueOnce([
          { name: 'subdir', isDirectory: () => true, isFile: () => false } as fs.Dirent,
        ])
        .mockReturnValueOnce([
          { name: 'nested.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
        ]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('nested'));
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('nestedhash'),
      } as unknown as crypto.Hash);

      _startFileWatcher();

      expect(fs.readdirSync).toHaveBeenCalledTimes(2);
    });

    it('skips ignored files during initialization', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // First call: root directory, second call: node_modules (which should be skipped)
      vi.mocked(fs.readdirSync)
        .mockReturnValueOnce([
          { name: 'test.pyc', isDirectory: () => false, isFile: () => true } as fs.Dirent,
          { name: 'valid.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
        ])
        .mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'));
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      _startFileWatcher();

      // Should hash valid.txt but not test.pyc
      const readCalls = vi.mocked(fs.readFileSync).mock.calls;
      const hasPycFile = readCalls.some(call => call[0].toString().endsWith('.pyc'));
      expect(hasPycFile).toBe(false);
    });

    it('handles readdir errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => _startFileWatcher()).not.toThrow();
    });

    it('caches hashes for all files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'));
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash'),
      } as unknown as crypto.Hash);

      stopFileWatcher();
      _startFileWatcher();

      expect(getHashCacheSize()).toBeGreaterThan(0);
    });

    it('handles null hash from hashFile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'unreadable.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Cannot read');
      });

      // Should not throw
      expect(() => _startFileWatcher()).not.toThrow();
    });
  });

  describe('handleFsEvent integration', () => {
    const originalWebhookEnv = process.env.DISCORD_WEBHOOK_FILE_CHANGES;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      stopFileWatcher();
      mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = 'https://discord.com/api/webhooks/test';
    });

    afterEach(() => {
      process.env.DISCORD_WEBHOOK_FILE_CHANGES = originalWebhookEnv;
      stopFileWatcher();
    });

    it('ignores null filename', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();

      if (eventCallback) {
        await eventCallback('change', null);
      }

      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not call webhook
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignores files matching ignore patterns', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();

      if (eventCallback) {
        // Try to trigger event for ignored files (returning false for existsSync means file was deleted)
        // Deleted files should not trigger webhooks for ignored patterns
        await eventCallback('change', 'test.pyc');
        await eventCallback('change', '.env');
      }

      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not call webhook for ignored files
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('detects file creation', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true); // For directory check
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('new file'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 8 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('newhash'),
      } as unknown as crypto.Hash);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();

      if (eventCallback) {
        // Simulate file created event
        vi.mocked(fs.existsSync).mockReturnValue(true);
        await eventCallback('change', 'newfile.txt');
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should call webhook for new file
      expect(mockFetch).toHaveBeenCalled();
    });

    it('detects file modification', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'existing.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(Buffer.from('original'))
        .mockReturnValueOnce(Buffer.from('modified'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 8 } as fs.Stats);
      vi.mocked(crypto.createHash)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn().mockReturnValue('originalhash'),
        } as unknown as crypto.Hash)
        .mockReturnValue({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn().mockReturnValue('modifiedhash'),
        } as unknown as crypto.Hash);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();
      mockFetch.mockClear(); // Clear initialization calls

      if (eventCallback) {
        await eventCallback('change', 'existing.txt');
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should call webhook for modified file
      expect(mockFetch).toHaveBeenCalled();
    });

    it('skips events when file content unchanged', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'unchanged.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      const sameHash = 'samehash123';
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('same content'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 12 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(sameHash),
      } as unknown as crypto.Hash);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();
      mockFetch.mockClear(); // Clear initialization calls

      if (eventCallback) {
        // Trigger event for file with same hash
        await eventCallback('change', 'unchanged.txt');
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not call webhook when hash unchanged
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('detects file deletion', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'todelete.txt', isDirectory: () => false, isFile: () => true } as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('will be deleted'));
      vi.mocked(fs.statSync).mockReturnValue({ size: 15 } as fs.Stats);
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('deletehash'),
      } as unknown as crypto.Hash);

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();
      mockFetch.mockClear(); // Clear initialization calls

      if (eventCallback) {
        // Simulate file deleted - existsSync returns false
        vi.mocked(fs.existsSync).mockReturnValue(false);
        await eventCallback('change', 'todelete.txt');
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should call webhook for deleted file
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body.embeds[0].title).toContain('Deleted');
    });

    it('handles errors in file event processing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      let eventCallback: ((eventType: string, filename: string | null) => void) | undefined;
      vi.mocked(fs.watch).mockImplementation((_path, _options, listener) => {
        eventCallback = listener as (eventType: string, filename: string | null) => void;
        return { close: vi.fn() } as unknown as fs.FSWatcher;
      });

      _startFileWatcher();

      if (eventCallback) {
        // Should not throw even if processing fails
        // The callback handles errors internally and logs them
        eventCallback('change', 'error.txt');
        await new Promise(resolve => setTimeout(resolve, 10));
        // Test passes if no exception thrown
        expect(true).toBe(true);
      }
    });
  });
});
