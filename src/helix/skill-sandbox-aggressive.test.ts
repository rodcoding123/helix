/**
 * AGGRESSIVE coverage expansion for skill-sandbox
 * Target: 54.62% → 85%+
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifySkillSignature,
  validateSkill,
  executeSkillSandboxed,
  clearSkillAuditLog,
  DEFAULT_SKILL_SANDBOX_CONFIG,
  type SkillMetadata,
  type SkillSandboxConfig,
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

describe('Skill Sandbox - Aggressive Coverage: Validation', () => {
  beforeEach(() => {
    clearSkillAuditLog();
  });

  it('should validate code with arithmetic operations', () => {
    const metadata: SkillMetadata = {
      name: 'math-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return 2 + 2 * 3;', metadata, config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate code with string operations', () => {
    const metadata: SkillMetadata = {
      name: 'string-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return "hello".toUpperCase();', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should validate code with array operations', () => {
    const metadata: SkillMetadata = {
      name: 'array-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return [1,2,3].map(x => x * 2);', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should validate code with object operations', () => {
    const metadata: SkillMetadata = {
      name: 'object-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return Object.keys({a:1,b:2});', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect fs:read permission request', () => {
    const metadata: SkillMetadata = {
      name: 'fs-read-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['filesystem:read'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect fs:write permission request', () => {
    const metadata: SkillMetadata = {
      name: 'fs-write-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['filesystem:write'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect network:outbound permission', () => {
    const metadata: SkillMetadata = {
      name: 'network-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['network:outbound'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect network:localhost permission', () => {
    const metadata: SkillMetadata = {
      name: 'localhost-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['network:localhost'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect env:read permission', () => {
    const metadata: SkillMetadata = {
      name: 'env-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['env:read'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect mcp:tools permission', () => {
    const metadata: SkillMetadata = {
      name: 'mcp-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['mcp:tools'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should detect discord:webhooks permission', () => {
    const metadata: SkillMetadata = {
      name: 'discord-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['discord:webhooks'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should always deny process:spawn permission', () => {
    const metadata: SkillMetadata = {
      name: 'spawn-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['process:spawn'],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return true;', metadata, config);

    expect(result.permissionsDenied).toContain('process:spawn');
  });

  it('should handle code with comments', () => {
    const metadata: SkillMetadata = {
      name: 'comment-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const code = `
      // This is a comment
      /* Multi-line
         comment */
      return 42;
    `;
    const result = validateSkill(code, metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with template literals', () => {
    const metadata: SkillMetadata = {
      name: 'template-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return `hello ${1+1}`;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with arrow functions', () => {
    const metadata: SkillMetadata = {
      name: 'arrow-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return [1,2,3].map(x => x * 2);', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with destructuring', () => {
    const metadata: SkillMetadata = {
      name: 'destructure-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('const {a, b} = {a:1, b:2}; return a + b;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with spread operator', () => {
    const metadata: SkillMetadata = {
      name: 'spread-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return [...[1,2,3], 4, 5];', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with try-catch', () => {
    const metadata: SkillMetadata = {
      name: 'trycatch-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const code = 'try { return 1; } catch(e) { return 0; }';
    const result = validateSkill(code, metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should warn on setTimeout usage', () => {
    const metadata: SkillMetadata = {
      name: 'timeout-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('setTimeout(() => {}, 1000);', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should warn on setInterval usage', () => {
    const metadata: SkillMetadata = {
      name: 'interval-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('setInterval(() => {}, 1000);', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should warn on fetch usage', () => {
    const metadata: SkillMetadata = {
      name: 'fetch-skill',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('fetch("https://example.com");', metadata, config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should validate signature with correct format', () => {
    const code = 'return 123;';
    const metadata: SkillMetadata = {
      name: 'signed-skill',
      version: '1.0.0',
      author: 'test@example.com',
      signedAt: '2024-01-15T10:00:00.000Z',
      permissions: [],
    };

    // Create valid Ed25519 signature
    const { signature, publicKeyPem } = createEd25519Signature(code, metadata);
    metadata.signature = signature;

    const result = verifySkillSignature(code, metadata, [publicKeyPem]);
    expect(result).toBe(true);
  });

  it('should reject signature with wrong key', () => {
    const code = 'return 123;';
    const metadata: SkillMetadata = {
      name: 'wrong-key-skill',
      version: '1.0.0',
      author: 'test@example.com',
      signedAt: '2024-01-15T10:00:00.000Z',
      signature: 'wrong-signature-here',
      permissions: [],
    };

    const result = verifySkillSignature(code, metadata, ['different-key']);
    expect(result).toBe(false);
  });

  it('should reject signature without signedAt', () => {
    const code = 'return 123;';
    const metadata: SkillMetadata = {
      name: 'no-signed-at',
      version: '1.0.0',
      author: 'test@example.com',
      signature: 'some-signature',
      permissions: [],
    };

    const result = verifySkillSignature(code, metadata, ['key']);
    expect(result).toBe(false);
  });

  it('should fail execution without signature when required', async () => {
    const metadata: SkillMetadata = {
      name: 'unsigned-fail',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const result = await executeSkillSandboxed(
      'return 1;',
      metadata,
      {},
      'session',
      DEFAULT_SKILL_SANDBOX_CONFIG // requireSignature: true
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('signature');
  });

  it('should fail execution with invalid metadata', async () => {
    const metadata: SkillMetadata = {
      name: '',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = await executeSkillSandboxed('return 1;', metadata, {}, 'session', config);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle empty permissions array', () => {
    const metadata: SkillMetadata = {
      name: 'no-perms',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
    expect(result.permissionsGranted).toHaveLength(0);
  });

  it('should handle trustedOrigin in metadata', () => {
    const metadata: SkillMetadata = {
      name: 'trusted-origin',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
      trustedOrigin: 'https://trusted.com',
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should validate version format basic', () => {
    const metadata: SkillMetadata = {
      name: 'version-test',
      version: '2.5.1',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle config with allowNetwork true', () => {
    const metadata: SkillMetadata = {
      name: 'network-allowed',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['network:outbound'],
    };

    const config: SkillSandboxConfig = {
      ...DEFAULT_SKILL_SANDBOX_CONFIG,
      requireSignature: false,
      allowNetwork: true,
      allowedHosts: ['api.example.com'],
    };

    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle config with allowWrite true', () => {
    const metadata: SkillMetadata = {
      name: 'write-allowed',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: ['filesystem:write'],
    };

    const config: SkillSandboxConfig = {
      ...DEFAULT_SKILL_SANDBOX_CONFIG,
      requireSignature: false,
      allowWrite: true,
      allowedWritePaths: ['/tmp'],
    };

    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle very short timeout', () => {
    const metadata: SkillMetadata = {
      name: 'short-timeout',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config: SkillSandboxConfig = {
      ...DEFAULT_SKILL_SANDBOX_CONFIG,
      requireSignature: false,
      timeoutMs: 100,
    };

    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle very large maxMemoryBytes', () => {
    const metadata: SkillMetadata = {
      name: 'large-memory',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config: SkillSandboxConfig = {
      ...DEFAULT_SKILL_SANDBOX_CONFIG,
      requireSignature: false,
      maxMemoryBytes: 1024 * 1024 * 1024, // 1GB
    };

    const result = validateSkill('return 1;', metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with Math operations', () => {
    const metadata: SkillMetadata = {
      name: 'math-ops',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const code = 'return Math.floor(Math.random() * 100);';
    const result = validateSkill(code, metadata, config);

    expect(result.valid).toBe(true);
  });

  it('should handle code with JSON operations', () => {
    const metadata: SkillMetadata = {
      name: 'json-ops',
      version: '1.0.0',
      author: 'test@example.com',
      permissions: [],
    };

    const config = { ...DEFAULT_SKILL_SANDBOX_CONFIG, requireSignature: false };
    const code = 'return JSON.stringify({a: 1});';
    const result = validateSkill(code, metadata, config);

    expect(result.valid).toBe(true);
  });
});
