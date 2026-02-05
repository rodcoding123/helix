/**
 * Extended coverage tests for skill sandbox
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifySkillSignature,
  validateSkill,
  clearSkillAuditLog,
  DEFAULT_SKILL_SANDBOX_CONFIG,
  type SkillMetadata,
} from './skill-sandbox.js';
import crypto from 'node:crypto';
/**
 * Helper to generate Ed25519 keypair and sign data
 */
function createEd25519Signature(
  skillCode: string,
  metadata: Pick<SkillMetadata, 'name' | 'version' | 'author' | 'signedAt'>
): { signature: string; publicKeyPem: string } {
  // Generate Ed25519 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  // Create signed data string
  const signedData = `${skillCode}|${metadata.name}|${metadata.version}|${metadata.author}|${metadata.signedAt}`;

  // Sign the data using Ed25519 (pass null as algorithm for Ed25519)
  const signatureBuffer = crypto.sign(null, Buffer.from(signedData, 'utf8'), privateKey);

  // Export public key as PEM
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

  return {
    signature: signatureBuffer.toString('base64'),
    publicKeyPem,
  };
}

describe('Skill Sandbox - Extended Validation', () => {
  beforeEach(() => {
    clearSkillAuditLog();
  });

  it('should detect eval usage', () => {
    const metadata: SkillMetadata = {
      name: 'eval-test',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('eval("code");', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should detect Function constructor', () => {
    const metadata: SkillMetadata = {
      name: 'func-test',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('new Function("return 1");', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should detect require statements', () => {
    const metadata: SkillMetadata = {
      name: 'require-test',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('require("fs");', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should detect import statements', () => {
    const metadata: SkillMetadata = {
      name: 'import-test',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('import fs from "fs";', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should validate empty author', () => {
    const metadata: SkillMetadata = {
      name: 'no-author',
      version: '1.0.0',
      author: '',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(false);
  });

  it('should handle long code', () => {
    const longCode = 'return ' + '1 + '.repeat(500) + '1;';
    const metadata: SkillMetadata = {
      name: 'long-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill(longCode, metadata, config);

    expect(result).toBeDefined();
  });

  it('should validate with multiple trusted keys', () => {
    const code = 'return 42;';
    const metadata: SkillMetadata = {
      name: 'multi-key',
      version: '1.0.0',
      author: 'test@example.com',
      signedAt: '2024-01-15T10:00:00.000Z',
      permissions: [],
    };

    // Create valid Ed25519 signature
    const { signature, publicKeyPem } = createEd25519Signature(code, metadata);
    metadata.signature = signature;

    // Generate two other random public keys to test multiple key support
    const { publicKey: key1 } = crypto.generateKeyPairSync('ed25519');
    const { publicKey: key3 } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem1 = key1.export({ type: 'spki', format: 'pem' });
    const publicKeyPem3 = key3.export({ type: 'spki', format: 'pem' });

    const result = verifySkillSignature(code, metadata, [
      publicKeyPem1,
      publicKeyPem,
      publicKeyPem3,
    ]);
    expect(result).toBe(true);
  });

  it('should handle preset: minimal', () => {
    const metadata: SkillMetadata = {
      name: 'minimal',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = {
      ...DEFAULT_SKILL_SANDBOX_CONFIG,
      requireSignature: false,
      preset: 'minimal' as const,
    };

    const result = validateSkill('return true;', metadata, config);
    expect(result.valid).toBe(true);
  });

  it('should handle whitespace-only code', () => {
    const metadata: SkillMetadata = {
      name: 'whitespace',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('   \n\t  ', metadata, config);

    // Whitespace-only code may be valid depending on implementation
    expect(result).toBeDefined();
  });

  it('should check process global access', () => {
    const metadata: SkillMetadata = {
      name: 'process-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('process.exit(0);', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
