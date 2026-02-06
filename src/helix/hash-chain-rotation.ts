/**
 * HELIX HASH CHAIN LOG ROTATION
 * Implements efficient log rotation, indexing, and archival for hash chain integrity records
 *
 * CRITICAL: Rotates logs daily to prevent unbounded file growth
 * Maintains backward-compatible interface with existing hash-chain.ts
 */

import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import type { HashChainEntry } from './types.js';

/**
 * Index entry for efficient random access
 * Maps sequence number to file offset for O(1) lookups
 */
interface IndexEntry {
  sequence: number;
  offset: number;
  timestamp: string;
  entryHash: string;
}

/**
 * Get configuration paths - allows runtime override for testing
 */
function getConfig(): {
  stateDir: string;
  chainDir: string;
  indexFile: string;
  archiveDir: string;
  retentionDays: number;
} {
  const stateDir = process.env.HELIX_STATE_DIR || '.helix-state';
  const chainDir = path.join(stateDir, 'hash_chain_logs');
  const indexFile = path.join(chainDir, '_index.json');
  const archiveDir = path.join(chainDir, 'archive');
  const retentionDays = parseInt(process.env.HELIX_LOG_RETENTION_DAYS || '30', 10);
  return { stateDir, chainDir, indexFile, archiveDir, retentionDays };
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Initialize directories and index
 */
async function initializeRotation(): Promise<void> {
  try {
    const { chainDir, indexFile, archiveDir } = getConfig();
    await fs.mkdir(chainDir, { recursive: true });
    await fs.mkdir(archiveDir, { recursive: true });

    // Initialize index if it doesn't exist
    try {
      await fs.access(indexFile);
    } catch {
      await fs.writeFile(indexFile, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('[Hash Chain Rotation] Failed to initialize:', error);
  }
}

/**
 * Load the index from disk
 */
async function loadIndex(): Promise<IndexEntry[]> {
  try {
    const { indexFile } = getConfig();
    const content = await fs.readFile(indexFile, 'utf-8');
    return JSON.parse(content) as IndexEntry[];
  } catch {
    return [];
  }
}

/**
 * Save the index to disk
 */
async function saveIndex(index: IndexEntry[]): Promise<void> {
  try {
    const { indexFile } = getConfig();
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
  } catch (error) {
    console.error('[Hash Chain Rotation] Failed to save index:', error);
  }
}

/**
 * Get file offset at end of active chain file
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Append entry to active chain file and update index
 */
export async function appendToChain(entry: HashChainEntry): Promise<void> {
  const { chainDir } = getConfig();
  await initializeRotation();

  const chainFile = path.join(chainDir, `hash_chain.${getCurrentDate()}.log`);
  const offset = await getFileSize(chainFile);

  // Append to chain file
  const entryLine = JSON.stringify(entry) + '\n';
  await fs.appendFile(chainFile, entryLine);

  // Update index
  const index = await loadIndex();
  index.push({
    sequence: entry.sequence || 0,
    offset,
    timestamp: entry.timestamp,
    entryHash: entry.entryHash,
  });
  await saveIndex(index);
}

/**
 * Get entry by sequence number (efficient O(1) access)
 */
export async function getEntryBySequence(sequence: number): Promise<HashChainEntry | null> {
  await initializeRotation();

  const index = await loadIndex();
  const indexEntry = index.find(e => e.sequence === sequence);

  if (!indexEntry) {
    return null;
  }

  return readEntryAtOffset(indexEntry.offset);
}

/**
 * Read a single JSON entry at file offset
 */
async function readEntryAtOffset(offset: number): Promise<HashChainEntry | null> {
  try {
    const { chainDir } = getConfig();
    const chainFile = path.join(chainDir, `hash_chain.${getCurrentDate()}.log`);
    const content = await fs.readFile(chainFile, 'utf-8');
    const lines = content.split('\n');

    // Find line at offset (approximate - scan from offset)
    let currentOffset = 0;
    for (const line of lines) {
      if (currentOffset >= offset && line.trim()) {
        const parsed = JSON.parse(line);
        return parsed as HashChainEntry;
      }
      currentOffset += line.length + 1; // +1 for newline
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Get last N entries from chain (efficient)
 */
export async function getLastEntries(count: number): Promise<HashChainEntry[]> {
  const { chainDir } = getConfig();
  await initializeRotation();

  const entries: HashChainEntry[] = [];
  const chainFile = path.join(chainDir, `hash_chain.${getCurrentDate()}.log`);

  try {
    const content = await fs.readFile(chainFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const start = Math.max(0, lines.length - count);

    for (let i = start; i < lines.length; i++) {
      try {
        const parsed = JSON.parse(lines[i]);
        entries.push(parsed as HashChainEntry);
      } catch {
        // Skip invalid entries
      }
    }
  } catch {
    // File doesn't exist yet
  }

  return entries;
}

/**
 * Get entries between timestamps (inclusive)
 */
export async function getEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<HashChainEntry[]> {
  const { chainDir } = getConfig();
  await initializeRotation();

  const entries: HashChainEntry[] = [];
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  // Get all log files in date range
  const logFiles = await fs.readdir(chainDir);
  const relevantFiles = logFiles.filter((f: string) => {
    const match = f.match(/hash_chain\.(\d{4}-\d{2}-\d{2})\.log/);
    if (!match) return false;

    const fileDate = new Date(match[1]).getTime();
    return fileDate >= startTime && fileDate <= endTime;
  });

  // Read entries from each file
  for (const file of relevantFiles) {
    try {
      const content = await fs.readFile(path.join(chainDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as HashChainEntry;
          const entryTime = new Date(parsed.timestamp).getTime();

          if (entryTime >= startTime && entryTime <= endTime) {
            entries.push(parsed);
          }
        } catch {
          // Skip invalid entries
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Rotate logs - move yesterday's logs to archive and compress
 */
export async function rotateAndArchiveLogs(): Promise<{ archived: number; deleted: number }> {
  const { chainDir, archiveDir, retentionDays } = getConfig();
  await initializeRotation();

  let archived = 0;
  let deleted = 0;

  try {
    const logFiles = await fs.readdir(chainDir);
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    for (const file of logFiles) {
      const match = file.match(/hash_chain\.(\d{4}-\d{2}-\d{2})\.log/);
      if (!match) continue;

      const fileDate = new Date(match[1]);

      // Archive files older than 1 day
      if (fileDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        const sourcePath = path.join(chainDir, file);
        const archiveName = `${file}.gz`;
        const archivePath = path.join(archiveDir, archiveName);

        try {
          // Compress to archive
          await pipeline(
            createReadStream(sourcePath),
            zlib.createGzip(),
            createWriteStream(archivePath)
          );

          // Delete original
          await fs.unlink(sourcePath);
          archived++;
        } catch (error) {
          console.error(`[Hash Chain Rotation] Failed to archive ${file}:`, error);
        }
      }

      // Delete archives older than retention period
      if (fileDate < cutoffDate) {
        const archivePath = path.join(archiveDir, `${file}.gz`);
        try {
          await fs.unlink(archivePath);
          deleted++;
        } catch {
          // Archive already deleted or doesn't exist
        }
      }
    }
  } catch (error) {
    console.error('[Hash Chain Rotation] Rotation failed:', error);
  }

  return { archived, deleted };
}

/**
 * Get chain statistics
 */
export async function getChainStats(): Promise<{
  activeEntries: number;
  totalSize: number;
  archiveSize: number;
  oldestEntry?: string;
  newestEntry?: string;
  retentionDays: number;
}> {
  const { chainDir, archiveDir, retentionDays } = getConfig();
  await initializeRotation();

  let totalSize = 0;
  let archiveSize = 0;
  let oldestEntry: string | undefined;
  let newestEntry: string | undefined;

  try {
    const index = await loadIndex();
    const chainFile = path.join(chainDir, `hash_chain.${getCurrentDate()}.log`);

    // Get active file size
    const fileStats = await fs.stat(chainFile).catch(() => null);
    if (fileStats) {
      totalSize = fileStats.size;
    }

    // Get archive sizes
    const archiveFiles = await fs.readdir(archiveDir).catch(() => []);
    for (const file of archiveFiles) {
      const archivePath = path.join(archiveDir, file);
      const archiveStats = await fs.stat(archivePath).catch(() => null);
      if (archiveStats) {
        archiveSize += archiveStats.size;
      }
    }

    // Get entry date range from index
    if (index.length > 0) {
      oldestEntry = index[0].timestamp;
      newestEntry = index[index.length - 1].timestamp;
    }

    return {
      activeEntries: index.length,
      totalSize,
      archiveSize,
      oldestEntry,
      newestEntry,
      retentionDays,
    };
  } catch (error) {
    console.error('[Hash Chain Rotation] Failed to get stats:', error);

    return {
      activeEntries: 0,
      totalSize: 0,
      archiveSize: 0,
      retentionDays,
    };
  }
}

/**
 * Start automatic rotation scheduler
 * Runs daily at midnight UTC
 */
export function startRotationScheduler(): NodeJS.Timeout {
  const schedule = (): void => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      rotateAndArchiveLogs()
        .then(result => {
          console.log(
            `[Hash Chain Rotation] Rotated: ${result.archived} archived, ${result.deleted} deleted`
          );
        })
        .catch(error => {
          console.error('[Hash Chain Rotation] Rotation failed:', error);
        });

      // Reschedule for next day
      schedule();
    }, msUntilMidnight);
  };

  schedule();

  // Also run immediately on startup
  rotateAndArchiveLogs()
    .then(result => {
      if (result.archived > 0 || result.deleted > 0) {
        console.log(
          `[Hash Chain Rotation] Initial rotation: ${result.archived} archived, ${result.deleted} deleted`
        );
      }
    })
    .catch(console.error);

  return {} as NodeJS.Timeout;
}
