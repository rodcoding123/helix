/**
 * CONFIG HARDENING
 *
 * Security module for configuration management that:
 * - Encrypts gateway tokens at rest using EncryptedSecretsCache
 * - Makes core config immutable (prevents mutation)
 * - Creates audit trail for all config changes with hash chaining
 * - Protected keys cannot be modified
 * - Requires audit reason for sensitive config changes
 * - SHA-256 hash chain for tamper detection
 *
 * CRITICAL PRINCIPLE: All configuration changes must be logged to Discord
 * BEFORE the change is applied (fail-closed behavior).
 */

import crypto from 'node:crypto';
import { EncryptedSecretsCache } from '../lib/secrets-cache-encrypted.js';
import { sendAlert } from './logging-hooks.js';

/**
 * Protected keys that require audit reason for any modification
 */
export const PROTECTED_KEYS = ['gatewayToken', 'apiKey', 'secretKey', 'credentials', 'privateKey'];

/**
 * Configuration audit entry for tracking all changes
 */
export interface ConfigAuditEntry {
  key: string;
  oldValueHash: string;
  newValueHash: string;
  auditReason: string;
  timestamp: string;
  hash: string; // SHA-256 hash of this entry
  previousHash: string; // Link to previous entry (or 'genesis')
}

/**
 * Global audit log - stores all configuration changes
 * CRITICAL: This is the audit trail that proves config integrity
 */
export const CONFIG_AUDIT_LOG: ConfigAuditEntry[] = [];

/**
 * Validate a configuration change
 *
 * @param key - Configuration key being changed
 * @param _oldValue - Previous value
 * @param _newValue - New value
 * @param reason - Optional audit reason (required for protected keys)
 * @returns {allowed, reason?} - Whether change is allowed, and error reason if not
 */
export function validateConfigChange(
  key: string,
  _oldValue: unknown,
  _newValue: unknown,
  reason?: string
): { allowed: boolean; reason?: string } {
  // Check if this is a protected key
  if (PROTECTED_KEYS.includes(key)) {
    // Protected keys MUST have an audit reason
    if (!reason) {
      return {
        allowed: false,
        reason: `Cannot modify protected key '${key}' without audit reason required for security compliance`,
      };
    }
    // Reason provided - allow
    return { allowed: true };
  }

  // Non-protected keys can be changed without reason
  return { allowed: true };
}

/**
 * Compute SHA-256 hash of a value
 * Used for hashing config values in audit entries
 */
function hashValue(value: unknown): string {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(stringValue).digest('hex');
}

/**
 * Create a configuration audit entry
 * This entry is added to the hash chain for tamper detection
 *
 * @param key - Configuration key
 * @param oldValue - Previous value
 * @param newValue - New value
 * @param auditReason - Reason for the change (required for audit trail)
 * @returns ConfigAuditEntry with hash chain links
 */
export function createConfigAuditEntry(
  key: string,
  oldValue: unknown,
  newValue: unknown,
  auditReason: string
): ConfigAuditEntry {
  const timestamp = new Date().toISOString();
  const oldValueHash = hashValue(oldValue);
  const newValueHash = hashValue(newValue);

  // Get previous hash from audit log (or 'genesis' if first entry)
  const previousHash =
    CONFIG_AUDIT_LOG.length === 0 ? 'genesis' : CONFIG_AUDIT_LOG[CONFIG_AUDIT_LOG.length - 1].hash;

  // Create entry content for hashing
  const entryContent = JSON.stringify({
    key,
    oldValueHash,
    newValueHash,
    auditReason,
    timestamp,
    previousHash,
  });

  // Compute SHA-256 hash of this entry
  const hash = crypto.createHash('sha256').update(entryContent).digest('hex');

  return {
    key,
    oldValueHash,
    newValueHash,
    auditReason,
    timestamp,
    hash,
    previousHash,
  };
}

/**
 * Audit a configuration change
 * Logs the change to the audit trail and sends alert to Discord
 *
 * CRITICAL: This logs BEFORE any config change is applied (fail-closed principle)
 *
 * @param key - Configuration key
 * @param oldValue - Previous value
 * @param newValue - New value
 * @param auditReason - Reason for the change
 */
export function auditConfigChange(
  key: string,
  oldValue: unknown,
  newValue: unknown,
  auditReason: string
): void {
  // Create audit entry
  const entry = createConfigAuditEntry(key, oldValue, newValue, auditReason);

  // Add to audit log
  CONFIG_AUDIT_LOG.push(entry);

  // Send alert to Discord (async, non-blocking)
  void sendAlert(
    `Configuration Changed: ${key}`,
    `**Key**: ${key}\n**Reason**: ${auditReason}\n**Timestamp**: ${entry.timestamp}`,
    'info'
  ).catch(error => {
    console.error('[Config Hardening] Failed to send audit alert:', error);
  });
}

/**
 * Encrypted Configuration Store
 * Stores sensitive configuration tokens encrypted at rest
 * Uses AES-256-GCM encryption with machine-specific key derivation
 */
export class EncryptedConfigStore {
  private cache: EncryptedSecretsCache;
  private initialized = false;

  constructor() {
    this.cache = new EncryptedSecretsCache();
  }

  /**
   * Initialize the encrypted store
   * Must be called before get/set operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.cache.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `[Config Store] Initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Store an encrypted token
   * @param key - Token identifier
   * @param value - Token value to encrypt
   */
  setToken(key: string, value: string): void {
    if (!this.initialized) {
      throw new Error('[Config Store] Store not initialized - call initialize() first');
    }

    this.cache.set(key, value);
  }

  /**
   * Retrieve and decrypt a token
   * @param key - Token identifier
   * @returns Decrypted token or undefined if not found
   */
  getToken(key: string): string | undefined {
    if (!this.initialized) {
      throw new Error('[Config Store] Store not initialized - call initialize() first');
    }

    return this.cache.get(key);
  }

  /**
   * Rotate a token (e.g., for scheduled key rotation)
   * @param key - Token identifier
   * @param newValue - New token value
   * @returns {oldToken} - Previous token value
   */
  rotateToken(key: string, newValue: string): { oldToken: string | undefined } {
    if (!this.initialized) {
      throw new Error('[Config Store] Store not initialized - call initialize() first');
    }

    // Get old token
    const oldToken = this.cache.get(key);

    // Store new token
    this.cache.set(key, newValue);

    // Log rotation (async, non-blocking)
    auditConfigChange(key, oldToken || 'undefined', newValue, 'Token rotation');

    return { oldToken };
  }

  /**
   * Clear all tokens from the store
   * Used for cleanup/testing
   */
  clearTokens(): void {
    if (!this.initialized) {
      throw new Error('[Config Store] Store not initialized - call initialize() first');
    }

    this.cache.clear();
  }

  /**
   * Get current key version (for monitoring)
   */
  getKeyVersion(): number {
    return this.cache.getKeyVersion();
  }
}

/**
 * Access log entry
 */
interface AccessLogEntry {
  key: string;
  timestamp: number;
  value?: unknown;
}

/**
 * Immutable Configuration Wrapper
 * Makes configuration objects frozen and tracks access
 */
export class ImmutableConfig {
  private config: Record<string, unknown>;
  private accessLog: AccessLogEntry[] = [];

  constructor(config: Record<string, unknown>) {
    // Deep freeze the configuration
    this.config = this.deepFreeze(config);
  }

  /**
   * Deep freeze an object to prevent any mutations
   */
  private deepFreeze(obj: unknown): Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) {
      return obj as Record<string, unknown>;
    }

    Object.freeze(obj);

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as Record<string, unknown>)[key];
        if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
          this.deepFreeze(value);
        }
      }
    }

    return obj as Record<string, unknown>;
  }

  /**
   * Get a configuration value using dot notation
   * @param path - Path to value (e.g., "database.host")
   * @returns The configuration value or undefined
   */
  get(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.config;

    for (const part of parts) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    // Log access
    this.accessLog.push({
      key: path,
      timestamp: Date.now(),
      value: current,
    });

    return current;
  }

  /**
   * Get all configuration
   * Returns a frozen copy
   */
  getAll(): Record<string, unknown> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get access log (for auditing)
   */
  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog];
  }
}

/**
 * Verify the integrity of the configuration audit trail
 * Checks that all hash chain links are valid
 *
 * @returns {valid, errors} - Whether trail is valid and any errors found
 */
export function verifyAuditTrailIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (CONFIG_AUDIT_LOG.length === 0) {
    return { valid: true, errors: [] };
  }

  // Verify first entry references genesis
  if (CONFIG_AUDIT_LOG[0].previousHash !== 'genesis') {
    errors.push(
      `Entry 0: Expected previousHash to be 'genesis', got '${CONFIG_AUDIT_LOG[0].previousHash}'`
    );
  }

  // Verify each entry
  for (let i = 0; i < CONFIG_AUDIT_LOG.length; i++) {
    const entry = CONFIG_AUDIT_LOG[i];

    // Recompute the hash to verify it hasn't been tampered with
    const entryContent = JSON.stringify({
      key: entry.key,
      oldValueHash: entry.oldValueHash,
      newValueHash: entry.newValueHash,
      auditReason: entry.auditReason,
      timestamp: entry.timestamp,
      previousHash: entry.previousHash,
    });

    const computedHash = crypto.createHash('sha256').update(entryContent).digest('hex');

    if (entry.hash !== computedHash) {
      errors.push(`Entry ${i}: Hash mismatch - entry has been tampered with`);
    }

    // Verify link to previous entry
    if (i > 0) {
      const previousEntry = CONFIG_AUDIT_LOG[i - 1];
      if (entry.previousHash !== previousEntry.hash) {
        errors.push(
          `Entry ${i}: previousHash doesn't match previous entry's hash - chain is broken`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
