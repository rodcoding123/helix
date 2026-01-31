/**
 * HELIX FILE WATCHER
 * Monitors workspace files for changes and logs to Discord
 *
 * Watches critical directories:
 * - OpenClaw workspace (SOUL.md, configs)
 * - Helix configuration files (psychology, identity, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileChangeLog, DiscordEmbed } from './types.js';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_FILE_CHANGES;

// Directories to watch
const WATCH_DIRS = [
  process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace',
  process.env.HELIX_CONFIG_DIR,
].filter(Boolean) as string[];

// Files to ignore (patterns)
const IGNORE_PATTERNS = [
  /\.pyc$/,
  /\.pyo$/,
  /\/__pycache__\//,
  /\.git\//,
  /\.swp$/,
  /\.swo$/,
  /~$/,
  /\.DS_Store$/,
  /node_modules\//,
  /\.env$/,  // Don't log .env changes for security
];

// Track file hashes to detect actual changes
const fileHashes: Map<string, string> = new Map();

// Track watcher instances for cleanup
const watchers: fs.FSWatcher[] = [];

/**
 * Send webhook to Discord
 */
async function sendWebhook(embed: DiscordEmbed): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((error) => {
    console.error('[Helix] File change webhook failed:', error);
  });
}

/**
 * Calculate MD5 hash of file content
 */
function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Get file size safely
 */
function getFileSize(filePath: string): number | undefined {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return undefined;
  }
}

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Log a file change to Discord
 */
async function logFileChange(log: FileChangeLog): Promise<void> {
  const emojis = {
    created: '🆕',
    modified: '📝',
    deleted: '🗑️'
  };

  const colors = {
    created: 0x2ECC71,
    modified: 0xF1C40F,
    deleted: 0xE74C3C,
  };

  const embed: DiscordEmbed = {
    title: `${emojis[log.changeType]} File ${log.changeType.charAt(0).toUpperCase() + log.changeType.slice(1)}`,
    color: colors[log.changeType],
    fields: [
      { name: 'File', value: `\`${log.path}\``, inline: false },
      { name: 'Type', value: log.changeType, inline: true },
      { name: 'Time', value: log.timestamp, inline: true },
    ],
    timestamp: log.timestamp,
    footer: { text: 'File change detected' }
  };

  if (log.hash) {
    embed.fields.push({
      name: 'Hash',
      value: `\`${log.hash.slice(0, 16)}...\``,
      inline: true
    });
  }

  if (log.sizeBytes !== undefined) {
    const sizeStr = log.sizeBytes >= 1024
      ? `${(log.sizeBytes / 1024).toFixed(1)} KB`
      : `${log.sizeBytes} bytes`;
    embed.fields.push({ name: 'Size', value: sizeStr, inline: true });
  }

  // Check for critical files
  const criticalFiles = ['SOUL.md', 'USER.md', 'MEMORY.md', 'goals.json', 'attachments.json'];
  const filename = path.basename(log.path);
  if (criticalFiles.includes(filename)) {
    embed.title = `⚠️ CRITICAL: ${embed.title}`;
    embed.color = 0xE74C3C;
    embed.fields.push({
      name: 'Warning',
      value: 'This is a critical configuration file',
      inline: false
    });
  }

  await sendWebhook(embed);
}

/**
 * Handle file system event
 */
async function handleFsEvent(
  eventType: string,
  filename: string | null,
  watchDir: string
): Promise<void> {
  if (!filename) return;

  const fullPath = path.join(watchDir, filename);
  const relativePath = filename;

  // Skip ignored files
  if (shouldIgnore(fullPath)) return;

  const timestamp = new Date().toISOString();
  let changeType: 'created' | 'modified' | 'deleted';
  let hash: string | undefined;
  let sizeBytes: number | undefined;

  try {
    // Check if file exists
    const exists = fs.existsSync(fullPath);

    if (!exists) {
      // File was deleted
      changeType = 'deleted';
      fileHashes.delete(fullPath);
    } else {
      // File exists - check if created or modified
      const newHash = hashFile(fullPath);
      const oldHash = fileHashes.get(fullPath);

      if (!oldHash) {
        // New file (not in our cache)
        changeType = 'created';
      } else if (oldHash === newHash) {
        // No actual content change - skip
        return;
      } else {
        changeType = 'modified';
      }

      if (newHash) {
        hash = newHash;
        fileHashes.set(fullPath, newHash);
      }

      sizeBytes = getFileSize(fullPath);
    }

    await logFileChange({
      path: relativePath,
      changeType,
      hash,
      timestamp,
      sizeBytes,
    });
  } catch (error) {
    console.error(`[Helix] Error handling file event for ${fullPath}:`, error);
  }
}

/**
 * Initialize file hash cache for a directory
 */
function initializeHashCache(dir: string): void {
  try {
    const walk = (currentDir: string): void => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (shouldIgnore(fullPath)) continue;

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const hash = hashFile(fullPath);
          if (hash) {
            fileHashes.set(fullPath, hash);
          }
        }
      }
    };

    walk(dir);
    console.log(`[Helix] Initialized hash cache for ${dir} (${fileHashes.size} files)`);
  } catch (error) {
    console.error(`[Helix] Error initializing hash cache for ${dir}:`, error);
  }
}

/**
 * Start watching directories for file changes
 */
export function startFileWatcher(): void {
  for (const dir of WATCH_DIRS) {
    // Resolve ~ to home directory
    const resolved = dir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');

    // Check if directory exists
    if (!fs.existsSync(resolved)) {
      console.warn(`[Helix] Watch directory does not exist: ${resolved}`);
      continue;
    }

    // Initialize hash cache
    initializeHashCache(resolved);

    // Start watching
    try {
      const watcher = fs.watch(
        resolved,
        { recursive: true },
        (eventType, filename) => {
          handleFsEvent(eventType, filename, resolved).catch(console.error);
        }
      );

      watchers.push(watcher);
      console.log(`[Helix] Watching directory: ${resolved}`);
    } catch (error) {
      console.error(`[Helix] Failed to watch ${resolved}:`, error);
    }
  }
}

/**
 * Stop all file watchers
 */
export function stopFileWatcher(): void {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers.length = 0;
  fileHashes.clear();
  console.log('[Helix] File watchers stopped');
}

/**
 * Manually log a file change (for use when fs.watch isn't available)
 */
export async function manualLogFileChange(
  filePath: string,
  changeType: 'created' | 'modified' | 'deleted'
): Promise<void> {
  const timestamp = new Date().toISOString();
  const hash = changeType !== 'deleted' ? hashFile(filePath) || undefined : undefined;
  const sizeBytes = changeType !== 'deleted' ? getFileSize(filePath) : undefined;

  await logFileChange({
    path: filePath,
    changeType,
    hash,
    timestamp,
    sizeBytes,
  });
}

/**
 * Get the list of watched directories
 */
export function getWatchedDirectories(): string[] {
  return [...WATCH_DIRS];
}

/**
 * Get the current file hash cache size
 */
export function getHashCacheSize(): number {
  return fileHashes.size;
}

export { logFileChange };
