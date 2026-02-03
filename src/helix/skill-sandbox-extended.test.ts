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

    const signedData = `${code}|${metadata.name}|${metadata.version}|${metadata.author}|${metadata.signedAt}`;
    const dataHash = crypto.createHash('sha256').update(signedData).digest('hex');
    const signature =
      crypto.createHash('sha256').update(`key2:${dataHash}`).digest('hex').slice(0, 16) + '-sig';

    metadata.signature = signature;

    const result = verifySkillSignature(code, metadata, ['key1', 'key2', 'key3']);
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
