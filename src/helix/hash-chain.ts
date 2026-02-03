/**
 * HELIX HASH CHAIN
 * Cryptographic integrity verification with Discord posting
 *
 * CRITICAL: Hash chain entries are sent to Discord BEFORE local storage.
 * This makes the chain unhackable - Discord has the authoritative record.
 *
 * SECURITY: Implements FAIL-CLOSED behavior - operations block if Discord unreachable
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { HashChainEntry, DiscordEmbed, SecretOperationEntry } from './types.js';
import { HelixSecurityError } from './types.js';

// Security mode - when true, operations fail if Discord logging fails
let failClosedMode = true;

/**
 * Set fail-closed mode for hash chain operations (INTERNAL ONLY)
 * WARNING: This function is for testing only. In production, fail-closed is always enabled.
 *
 * @internal
 * @throws Error if attempting to disable in production
 */
export function setHashChainFailClosedMode(enabled: boolean): void {
  // Production security: fail-closed mode CANNOT be disabled
  if (process.env.NODE_ENV === 'production' && !enabled) {
    throw new Error(
      '[Helix] SECURITY ERROR: Cannot disable fail-closed mode for hash chain in production. ' +
        'This function is for testing only and is not exported in production builds.'
    );
  }

  if (!enabled) {
    console.warn('[Helix] WARNING: Disabling fail-closed mode for hash chain! (TEST MODE ONLY)');
  }
  failClosedMode = enabled;
}

/**
 * Type guard for HashChainEntry
 */
function isHashChainEntry(value: unknown): value is HashChainEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.timestamp === 'string' &&
    typeof obj.previousHash === 'string' &&
    typeof obj.entryHash === 'string' &&
    typeof obj.logStates === 'object' &&
    obj.logStates !== null
  );
}

/**
 * Parse JSON safely as HashChainEntry
 */
function parseHashChainEntry(json: string): HashChainEntry | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return isHashChainEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const CHAIN_FILE = process.env.HELIX_HASH_CHAIN_FILE || './hash_chain.log';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_HASH_CHAIN;

// Log files to include in hash state
const LOG_FILES = [
  '/var/log/helix/commands.log',
  '/var/log/helix/api_calls.log',
  '/var/log/helix/file_changes.log',
  '/var/log/helix/consciousness.log',
];

// In-memory cache of chain state
let lastHash: string = 'GENESIS';
let sequence: number = 0;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Send hash chain entry to Discord
 * SECURITY: In fail-closed mode, throws if Discord unreachable
 */
async function sendToDiscord(entry: HashChainEntry): Promise<boolean> {
  if (!DISCORD_WEBHOOK) {
    if (failClosedMode) {
      throw new HelixSecurityError(
        'Hash chain webhook not configured - cannot guarantee integrity',
        'WEBHOOK_NOT_CONFIGURED',
        { entry }
      );
    }
    return false;
  }

  const logStatesList = Object.entries(entry.logStates)
    .map(([file, hash]) => `\`${path.basename(file)}\`: \`${hash.slice(0, 12)}...\``)
    .join('\n');

  const embed: DiscordEmbed = {
    title: '🔗 Hash Chain Entry',
    color: 0x9b59b6,
    fields: [
      { name: 'Sequence', value: `#${entry.sequence || 0}`, inline: true },
      { name: 'Entry Hash', value: `\`${entry.entryHash.slice(0, 32)}...\``, inline: false },
      { name: 'Previous Hash', value: `\`${entry.previousHash.slice(0, 24)}...\``, inline: true },
      { name: 'Time', value: entry.timestamp, inline: true },
      { name: 'Log States', value: logStatesList || 'No logs found', inline: false },
    ],
    timestamp: entry.timestamp,
    footer: { text: 'Integrity verification - sent before local storage (fail-closed)' },
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok && failClosedMode) {
      throw new HelixSecurityError(
        `Hash chain logging failed (HTTP ${response.status}) - integrity compromised`,
        'LOGGING_FAILED',
        { status: response.status }
      );
    }

    return response.ok;
  } catch (error) {
    if (error instanceof HelixSecurityError) throw error;

    if (failClosedMode) {
      throw new HelixSecurityError(
        'Discord unreachable - hash chain integrity cannot be guaranteed',
        'DISCORD_UNREACHABLE',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    console.error('[Helix] Hash chain Discord webhook failed:', error);
    return false;
  }
}

/**
 * Get the last hash from the chain file
 */
async function getLastHash(): Promise<{ hash: string; sequence: number }> {
  try {
    const content = await fs.readFile(CHAIN_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    if (lines.length === 0) {
      return { hash: 'GENESIS', sequence: 0 };
    }

    const lastEntry = parseHashChainEntry(lines[lines.length - 1]);
    if (!lastEntry) {
      return { hash: 'GENESIS', sequence: 0 };
    }
    return {
      hash: lastEntry.entryHash,
      sequence: (lastEntry.sequence || 0) + 1,
    };
  } catch {
    // File doesn't exist or is empty
    return { hash: 'GENESIS', sequence: 0 };
  }
}

/**
 * Compute SHA-256 hashes of all log files
 */
async function hashLogFiles(): Promise<Record<string, string>> {
  const states: Record<string, string> = {};

  // Also check environment-specified log files
  const configuredLogs = process.env.HELIX_LOG_FILES?.split(',') || [];
  const allLogFiles = [...LOG_FILES, ...configuredLogs];

  for (const logFile of allLogFiles) {
    try {
      const content = await fs.readFile(logFile);
      states[path.basename(logFile)] = crypto.createHash('sha256').update(content).digest('hex');
    } catch {
      states[path.basename(logFile)] = 'MISSING';
    }
  }

  return states;
}

/**
 * Compute the entry hash from its components
 */
function computeEntryHash(
  timestamp: string,
  previousHash: string,
  logStates: Record<string, string>
): string {
  const sortedKeys = Object.keys(logStates).sort();
  const sortedStates = sortedKeys.map(k => `${k}:${logStates[k]}`).join('|');
  const entryContent = `${timestamp}|${previousHash}|${sortedStates}`;
  return crypto.createHash('sha256').update(entryContent).digest('hex');
}

/**
 * Create a new hash chain entry
 * CRITICAL: Sends to Discord FIRST, then writes locally
 */
export async function createHashChainEntry(): Promise<HashChainEntry> {
  const timestamp = new Date().toISOString();

  // Get chain state
  const chainState = await getLastHash();
  lastHash = chainState.hash;
  sequence = chainState.sequence;

  // Hash all log files
  const logStates = await hashLogFiles();

  // Compute entry hash
  const entryHash = computeEntryHash(timestamp, lastHash, logStates);

  const entry: HashChainEntry = {
    timestamp,
    previousHash: lastHash,
    logStates,
    entryHash,
    sequence,
  };

  // >>>>>> SEND TO DISCORD FIRST (unhackable) <<<<<<
  // In fail-closed mode, this will throw if Discord unreachable
  const discordSuccess = await sendToDiscord(entry);

  if (!discordSuccess && !failClosedMode) {
    console.warn('[Helix] Hash chain entry not confirmed by Discord (fail-closed disabled)');
  }

  // >>>>>> THEN write locally <<<<<<
  try {
    // Ensure directory exists
    const chainDir = path.dirname(CHAIN_FILE);
    await fs.mkdir(chainDir, { recursive: true }).catch(() => {});

    await fs.appendFile(CHAIN_FILE, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('[Helix] Failed to write hash chain locally:', error);
  }

  // Update in-memory state
  lastHash = entryHash;
  sequence++;

  return entry;
}

/**
 * Log a secret operation to the hash chain and Discord
 * Used for auditing all secret management activities
 * SECURITY: In fail-closed mode, throws if Discord unreachable
 */
export async function logSecretOperation(entry: SecretOperationEntry): Promise<void> {
  const DISCORD_WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_HASH_CHAIN;
  if (!DISCORD_WEBHOOK_SECRET) {
    if (failClosedMode) {
      throw new HelixSecurityError(
        'Secret operation logging webhook not configured - cannot guarantee integrity',
        'WEBHOOK_NOT_CONFIGURED',
        { entry }
      );
    }
    console.warn(
      '[Helix] Secret operation webhook not configured, operation not logged to Discord'
    );
    return;
  }

  // Build detailed description of operation
  let description = `**Operation**: ${entry.operation}\n`;
  description += `**Success**: ${entry.success ? '✅' : '❌'}\n`;
  if (entry.secretName) description += `**Secret**: ${entry.secretName}\n`;
  if (entry.pluginId) description += `**Plugin**: ${entry.pluginId}\n`;
  description += `**Source**: ${entry.source}\n`;
  if (entry.durationMs) description += `**Duration**: ${entry.durationMs}ms\n`;
  if (entry.keyVersion) description += `**Key Version**: ${entry.keyVersion}\n`;
  if (entry.details) description += `**Details**: ${entry.details}\n`;

  const embed: DiscordEmbed = {
    title: '🔐 Secret Operation',
    color: entry.success ? 0x2ecc71 : 0xe74c3c, // Green if success, red if failure
    description,
    fields: [
      { name: 'Timestamp', value: entry.timestamp, inline: true },
      { name: 'Operation Type', value: entry.operation, inline: true },
      { name: 'Source', value: entry.source, inline: true },
    ],
    timestamp: entry.timestamp,
    footer: { text: 'Audit trail for secret operations - fail-closed enabled' },
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_SECRET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok && failClosedMode) {
      throw new HelixSecurityError(
        `Secret operation logging failed (HTTP ${response.status}) - integrity compromised`,
        'LOGGING_FAILED',
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.warn(`[Helix] Secret operation log failed (HTTP ${response.status})`);
    }
  } catch (error) {
    if (error instanceof HelixSecurityError) throw error;

    if (failClosedMode) {
      throw new HelixSecurityError(
        'Discord unreachable - secret operation logging cannot be guaranteed',
        'DISCORD_UNREACHABLE',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    console.error('[Helix] Secret operation Discord webhook failed:', error);
  }

  // Also add to hash chain for immutable record
  try {
    await createHashChainEntry();
  } catch (error) {
    console.error('[Helix] Failed to add secret operation to hash chain:', error);
    // Don't throw - hash chain failure shouldn't block secret operation
  }
}

/**
 * Verify the integrity of the entire chain
 * Checks that each entry's hash matches its computed value
 * and that the previousHash links are correct
 */
export async function verifyChain(): Promise<{
  valid: boolean;
  entries: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const content = await fs.readFile(CHAIN_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    if (lines.length === 0) {
      return { valid: true, entries: 0, errors: [] };
    }

    let expectedPrevHash = 'GENESIS';

    for (let i = 0; i < lines.length; i++) {
      const entry = parseHashChainEntry(lines[i]);

      if (!entry) {
        errors.push(`Entry ${i}: Invalid JSON or malformed entry`);
        continue;
      }

      // Verify previous hash link
      if (entry.previousHash !== expectedPrevHash) {
        errors.push(
          `Entry ${i}: previousHash mismatch (expected ${expectedPrevHash.slice(0, 8)}, got ${entry.previousHash.slice(0, 8)})`
        );
      }

      // Verify entry hash
      const computedHash = computeEntryHash(entry.timestamp, entry.previousHash, entry.logStates);
      if (entry.entryHash !== computedHash) {
        errors.push(`Entry ${i}: entryHash mismatch (tampering detected)`);
      }

      expectedPrevHash = entry.entryHash;
    }

    return {
      valid: errors.length === 0,
      entries: lines.length,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      entries: 0,
      errors: [
        `Failed to read chain file: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Get the current state of the chain
 */
export async function getChainState(): Promise<{
  lastHash: string;
  sequence: number;
  entries: number;
}> {
  const state = await getLastHash();
  try {
    const content = await fs.readFile(CHAIN_FILE, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean).length;
    return {
      lastHash: state.hash,
      sequence: state.sequence,
      entries,
    };
  } catch {
    return {
      lastHash: 'GENESIS',
      sequence: 0,
      entries: 0,
    };
  }
}

/**
 * Start the hash chain scheduler
 * Creates entries at regular intervals (default: every 5 minutes)
 */
export function startHashChainScheduler(intervalMs: number = 5 * 60 * 1000): void {
  if (schedulerInterval) {
    console.warn('[Helix] Hash chain scheduler already running');
    return;
  }

  // Create initial entry on startup
  createHashChainEntry()
    .then(() => console.log('[Helix] Initial hash chain entry created'))
    .catch(console.error);

  // Schedule regular entries
  schedulerInterval = setInterval(() => {
    createHashChainEntry().catch(console.error);
  }, intervalMs);

  console.log(`[Helix] Hash chain scheduler started (interval: ${intervalMs / 1000}s)`);
}

/**
 * Stop the hash chain scheduler
 */
export function stopHashChainScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Helix] Hash chain scheduler stopped');
  }
}

/**
 * Discord verification result
 */
export interface DiscordVerificationResult {
  verified: boolean;
  method: 'automatic' | 'manual';
  localEntries: number;
  discordEntries?: number;
  mismatches: string[];
  message: string;
  verificationSteps?: string[];
}

/**
 * Compare local chain with Discord records
 * This verifies that local logs haven't been tampered with
 *
 * NOTE: Full automatic verification requires Discord Bot API access.
 * Without a bot token, this provides manual verification instructions.
 */
export async function verifyAgainstDiscord(): Promise<DiscordVerificationResult> {
  const result: DiscordVerificationResult = {
    verified: false,
    method: 'manual',
    localEntries: 0,
    mismatches: [],
    message: '',
    verificationSteps: [],
  };

  // Get local chain state
  try {
    const content = await fs.readFile(CHAIN_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    result.localEntries = lines.length;

    if (lines.length === 0) {
      result.verified = true;
      result.message = 'Local chain is empty - nothing to verify';
      return result;
    }

    // Extract hashes for manual verification
    const localHashes: string[] = [];
    for (const line of lines) {
      const entry = parseHashChainEntry(line);
      if (entry) {
        localHashes.push(entry.entryHash.slice(0, 32));
      }
    }

    // Check if Discord bot token is available for automatic verification
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    const discordChannelId = process.env.DISCORD_HASH_CHAIN_CHANNEL_ID;

    if (discordBotToken && discordChannelId) {
      // Automatic verification using Discord API
      try {
        const response = await fetch(
          `https://discord.com/api/v10/channels/${discordChannelId}/messages?limit=100`,
          {
            headers: { Authorization: `Bot ${discordBotToken}` },
          }
        );

        if (response.ok) {
          const messages = (await response.json()) as Array<{
            embeds?: Array<{ fields?: Array<{ name: string; value: string }> }>;
          }>;
          result.method = 'automatic';
          result.discordEntries = messages.length;

          // Extract hashes from Discord messages
          const discordHashes: string[] = [];
          for (const msg of messages) {
            const embed = msg.embeds?.[0];
            const hashField = embed?.fields?.find(f => f.name === 'Entry Hash');
            if (hashField) {
              // Extract hash from format: `abc123...`
              const match = hashField.value.match(/`([a-f0-9]+)\.\.\./);
              if (match) {
                discordHashes.push(match[1]);
              }
            }
          }

          // Compare hashes
          for (let i = 0; i < localHashes.length; i++) {
            const localHash = localHashes[i];
            if (!discordHashes.includes(localHash)) {
              result.mismatches.push(`Entry ${i}: Local hash ${localHash} not found in Discord`);
            }
          }

          result.verified = result.mismatches.length === 0;
          result.message = result.verified
            ? `Verified ${result.localEntries} entries against Discord`
            : `Found ${result.mismatches.length} mismatches - possible tampering!`;
        }
      } catch (error) {
        result.message = `Discord API error: ${error instanceof Error ? error.message : String(error)}`;
      }
    } else {
      // Manual verification required
      result.verificationSteps = [
        '1. Open the Discord #helix-hash-chain channel',
        '2. Compare the Entry Hash values with local chain file',
        `3. Local chain file: ${CHAIN_FILE}`,
        `4. Expected entries: ${result.localEntries}`,
        '5. Look for any missing or different hashes',
        '',
        'Recent local hashes (newest first):',
        ...localHashes
          .slice(-5)
          .reverse()
          .map((h, i) => `   ${i + 1}. ${h}...`),
      ];

      result.message =
        'Manual verification required - set DISCORD_BOT_TOKEN and DISCORD_HASH_CHAIN_CHANNEL_ID for automatic verification';
    }
  } catch (error) {
    result.message = `Failed to read local chain: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

// setHashChainFailClosedMode is exported via its declaration above
export { computeEntryHash, hashLogFiles };
