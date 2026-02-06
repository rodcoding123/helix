/**
 * HELIX CONTEXT INTEGRITY VERIFICATION
 *
 * Protects against memory poisoning attacks by verifying the integrity of all
 * context files before they are loaded into Helix's consciousness.
 *
 * Uses SHA-256 hashing to detect tampering and logs all verification events
 * to the Discord hash chain for audit purposes.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { sendAlert } from './logging-hooks.js';

/**
 * Context integrity manifest - stores expected SHA-256 hashes for all critical files
 * This should be stored separately and protected from tampering
 */
export interface ContextIntegrityManifest {
  version: string;
  generatedAt: string;
  files: Record<
    string,
    {
      hash: string;
      size: number;
      lastVerified: string;
    }
  >;
}

/**
 * Calculate SHA-256 hash of file content
 */
export function calculateFileHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verify integrity of a single context file
 * @param filePath - Path to the file
 * @param content - File content
 * @param expectedHash - Expected SHA-256 hash (if available)
 * @returns true if verified or no hash available, false if tampered
 */
export async function verifyFileIntegrity(
  filePath: string,
  content: string,
  expectedHash?: string
): Promise<boolean> {
  const actualHash = calculateFileHash(content);

  if (!expectedHash) {
    // No expected hash provided - log for manual verification
    console.debug(`Context file loaded without hash verification: ${filePath}`);
    return true;
  }

  if (actualHash !== expectedHash) {
    // CRITICAL: File has been tampered with
    await sendAlert(
      '🚨 CRITICAL: Context File Tampering Detected',
      `File: ${filePath}\n` +
        `Expected Hash: ${expectedHash}\n` +
        `Actual Hash: ${actualHash}\n` +
        `This file has been modified since it was last verified.`,
      'critical'
    );

    console.error(`Context file integrity failure: ${filePath}`);
    return false;
  }

  // Hash verified
  console.debug(`Context file verified: ${filePath} (hash: ${actualHash.slice(0, 16)}...)`);

  return true;
}

/**
 * Generate integrity manifest for all context files
 * Run this after updating context files to create a new baseline
 */
export async function generateIntegrityManifest(
  workspaceDir: string
): Promise<ContextIntegrityManifest> {
  const criticalFiles = [
    'soul/HELIX_SOUL.md',
    'psychology/psyeval.json',
    'psychology/emotional_tags.json',
    'psychology/attachments.json',
    'psychology/trust_map.json',
    'identity/goals.json',
    'identity/feared_self.json',
    'identity/possible_selves.json',
    'transformation/current_state.json',
    'transformation/history.json',
    'purpose/ikigai.json',
    'purpose/wellness.json',
    'purpose/meaning_sources.json',
    'USER.md',
  ];

  const manifest: ContextIntegrityManifest = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    files: {},
  };

  for (const filePath of criticalFiles) {
    const fullPath = path.join(workspaceDir, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const hash = calculateFileHash(content);
      const stats = await fs.stat(fullPath);

      manifest.files[filePath] = {
        hash,
        size: stats.size,
        lastVerified: new Date().toISOString(),
      };
    } catch (e) {
      // File doesn't exist - optional files are skipped
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error reading ${filePath}:`, e);
      }
    }
  }

  return manifest;
}

/**
 * Save integrity manifest to disk
 * Should be stored in a protected location outside the workspace
 */
export async function saveIntegrityManifest(
  manifest: ContextIntegrityManifest,
  manifestPath: string
): Promise<void> {
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.debug(
    `Integrity manifest created: ${manifestPath} with ${Object.keys(manifest.files).length} files`
  );
}

/**
 * Load and verify integrity manifest
 */
export async function loadIntegrityManifest(
  manifestPath: string
): Promise<ContextIntegrityManifest | null> {
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as ContextIntegrityManifest;
  } catch {
    return null;
  }
}

/**
 * Verify all context files against manifest
 */
export async function verifyAllContextFiles(
  workspaceDir: string,
  manifest: ContextIntegrityManifest
): Promise<{ valid: boolean; failures: string[] }> {
  const failures: string[] = [];

  for (const [filePath, expectedInfo] of Object.entries(manifest.files)) {
    const fullPath = path.join(workspaceDir, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const verified = await verifyFileIntegrity(filePath, content, expectedInfo.hash);

      if (!verified) {
        failures.push(filePath);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        failures.push(`${filePath} (file missing or deleted)`);
      } else {
        failures.push(`${filePath} (read error: ${e instanceof Error ? e.message : String(e)})`);
      }
    }
  }

  if (failures.length > 0) {
    await sendAlert(
      '⚠️ Context File Integrity Verification Failed',
      `${failures.length} files failed verification:\n${failures.join('\n')}`,
      'critical'
    );
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Detect common prompt injection patterns in context files
 * (Complements existing detectPromptInjection but focused on context files)
 */
export function detectContextFileInjection(content: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for HTML comments with potential instructions
  if (/<!--[\s\S]*?-->/gi.test(content)) {
    issues.push('HTML comments detected (potential injection vector)');
  }

  // Check for control characters
  // eslint-disable-next-line no-control-regex
  const controlChars = content.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g);
  if (controlChars) {
    issues.push(`Control characters detected: ${controlChars.join(', ')}`);
  }

  // Check for suspicious markdown elements
  if (/\[SYSTEM:/gi.test(content)) {
    issues.push('Suspicious [SYSTEM: directive detected');
  }

  if (/<!-- OVERRIDE:/gi.test(content)) {
    issues.push('Suspicious <!-- OVERRIDE: comment detected');
  }

  // Check for base64 encoded payloads
  if (/^[A-Za-z0-9+/]{100,}={0,2}$/m.test(content)) {
    issues.push('Large base64 sequences detected (possible encoded payload)');
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Sanitize context file content to remove potential injection vectors
 * while preserving legitimate content
 */
export function sanitizeContextFileContent(content: string): string {
  let sanitized = content;

  // Remove HTML comments
  sanitized = sanitized.replace(/<!\s*--[\s\S]*?--\s*>/g, '');

  // Remove control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');

  // Remove suspicious directives (case-insensitive)
  sanitized = sanitized.replace(/\[SYSTEM:[^\]]*\]/gi, '[system directive removed]');
  sanitized = sanitized.replace(/<!-- OVERRIDE:[^>]* -->/gi, '<!-- override directive removed -->');

  return sanitized;
}

/**
 * Audit context file for security issues
 */
export async function auditContextFile(
  filePath: string,
  content: string
): Promise<{
  file: string;
  safe: boolean;
  issues: string[];
}> {
  const injectionCheck = detectContextFileInjection(content);

  if (!injectionCheck.safe) {
    await sendAlert(
      '⚠️ Potential Injection Detected in Context File',
      `File: ${filePath}\nIssues: ${injectionCheck.issues.join('\n')}`,
      'critical'
    );
  }

  return {
    file: filePath,
    safe: injectionCheck.safe,
    issues: injectionCheck.issues,
  };
}
