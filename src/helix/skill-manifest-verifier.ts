/* eslint-disable @typescript-eslint/no-base-to-string */
import { generateKeyPairSync, sign, verify } from 'crypto';
import { sendAlert } from './logging-hooks.js';

/**
 * Skill manifest interface with capability-based security model
 */
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: string[];
  prerequisites: Array<Record<string, unknown>>;
  signature: string;
}

/**
 * Result of manifest validation
 */
export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Result of full skill verification
 */
export interface SkillVerificationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Whitelist of allowed permissions
 */
const ALLOWED_PERMISSIONS = new Set([
  'fs:read',
  'fs:write',
  'fs:delete',
  'http:get',
  'http:post',
  'crypto:sign',
  'crypto:verify',
  'ui:display',
]);

/**
 * Blocklist of dangerous permissions
 */
const BLOCKED_PERMISSION_PATTERNS = [
  /^all$/i,
  /^root$/i,
  /^admin$/i,
  /^exec:\*/i,
  /^shell:\*/i,
  /^process:kill$/i,
  /^network:\*/i,
];

/**
 * Validate a skill manifest structure and permissions
 */
export function validateSkillManifest(manifest: SkillManifest): ManifestValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Manifest missing required field: id');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Manifest missing required field: name');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Manifest missing required field: version');
  }
  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('Manifest missing required field: description');
  }
  if (!manifest.author || typeof manifest.author !== 'string') {
    errors.push('Manifest missing required field: author');
  }
  if (!Array.isArray(manifest.permissions)) {
    errors.push('Manifest missing required field: permissions (array)');
  }
  if (!Array.isArray(manifest.prerequisites)) {
    errors.push('Manifest missing required field: prerequisites (array)');
  }

  // Check permissions whitelist/blocklist
  if (Array.isArray(manifest.permissions)) {
    for (const permission of manifest.permissions) {
      // Check blocked patterns first
      const isBlocked = BLOCKED_PERMISSION_PATTERNS.some(pattern => pattern.test(permission));
      if (isBlocked) {
        errors.push(`Dangerous permission blocked: ${permission} (matches blocked pattern)`);
      }

      // Check whitelist
      if (!ALLOWED_PERMISSIONS.has(permission) && !isBlocked) {
        errors.push(
          `Permission not in whitelist: ${permission} (use: fs:read, fs:write, fs:delete, http:get, http:post, crypto:sign, crypto:verify, ui:display)`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect suspicious prerequisites that indicate potential malicious intent
 * (fake downloads, shell commands, obfuscation, etc.)
 */
export function detectSuspiciousPrerequisites(manifest: SkillManifest): string[] {
  const suspicious: string[] = [];

  if (!Array.isArray(manifest.prerequisites)) {
    return suspicious;
  }

  for (const prereq of manifest.prerequisites) {
    if (typeof prereq !== 'object' || prereq === null) {
      suspicious.push(`Invalid prerequisite format: ${typeof prereq}`);
      continue;
    }

    const prereqName = String(prereq.name ?? '').toLowerCase();
    const instructions = String(prereq.instructions ?? '').toLowerCase();
    const url = String(prereq.url ?? '').toLowerCase();

    // Fake prerequisites (not real packages)
    if (
      prereqName.includes('download') ||
      prereqName.includes('click') ||
      prereqName.includes('run')
    ) {
      const nameStr = typeof prereq.name === 'string' ? prereq.name : 'unknown';
      suspicious.push(`Suspicious fake prerequisite: "${nameStr}"`);
    }

    // Dangerous URLs
    if (url && !url.includes('github.com') && !url.includes('npmjs.com')) {
      if (url.includes('attacker') || url.includes('malware')) {
        suspicious.push(`Malicious URL in prerequisites: ${url}`);
      }
    }

    // Shell commands
    if (instructions.includes('curl') && instructions.includes('|')) {
      suspicious.push(`Piped shell command detected: "${instructions.substring(0, 50)}..."`);
    }

    if (instructions.includes('bash -c') || instructions.includes('sh -c')) {
      suspicious.push(`Direct shell execution detected: "${instructions.substring(0, 50)}..."`);
    }

    // Obfuscation patterns
    if (
      instructions.includes('base64') ||
      instructions.includes('eval') ||
      instructions.includes('decode')
    ) {
      suspicious.push(`Obfuscated code detected: "${instructions.substring(0, 50)}..."`);
    }

    // Suspicious file downloads
    if (
      instructions.includes('.zip') ||
      instructions.includes('.dmg') ||
      instructions.includes('.exe')
    ) {
      if (!instructions.includes('npm') && !instructions.includes('github.com')) {
        suspicious.push(`Suspicious file download: "${instructions.substring(0, 50)}..."`);
      }
    }
  }

  return suspicious;
}

/**
 * Generate an Ed25519 key pair for signing skills (compatible with Node.js crypto)
 */
export function generateSkillSigningKey(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  return {
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  };
}

/**
 * Sign a skill manifest with a private key (Ed25519)
 * Returns a new manifest with signature populated
 */
export function signSkillManifest(manifest: SkillManifest, privateKey: string): SkillManifest {
  // Create a copy without the signature field for hashing
  const manifestToSign: Omit<SkillManifest, 'signature'> & { signature: '' } = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    permissions: manifest.permissions,
    prerequisites: manifest.prerequisites,
    signature: '',
  };

  // Ensure consistent ordering for deterministic signing
  const keys = [
    'id',
    'name',
    'version',
    'description',
    'author',
    'permissions',
    'prerequisites',
    'signature',
  ];
  const manifestString = JSON.stringify(manifestToSign, keys);

  // Create signature using Ed25519
  const signature = sign(null, Buffer.from(manifestString), privateKey);

  return {
    ...manifest,
    signature: signature.toString('hex'),
  };
}

/**
 * Verify a skill manifest signature with a public key (Ed25519)
 */
export function verifySkillSignature(manifest: SkillManifest, publicKey: string): boolean {
  try {
    // Create unsigned copy with same field ordering
    const manifestWithoutSig: Omit<SkillManifest, 'signature'> & { signature: '' } = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      permissions: manifest.permissions,
      prerequisites: manifest.prerequisites,
      signature: '',
    };

    const keys = [
      'id',
      'name',
      'version',
      'description',
      'author',
      'permissions',
      'prerequisites',
      'signature',
    ];
    const manifestString = JSON.stringify(manifestWithoutSig, keys);

    // Verify signature using Ed25519
    return verify(
      null,
      Buffer.from(manifestString),
      publicKey,
      Buffer.from(manifest.signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Load and fully verify a skill manifest:
 * 1. Validate manifest structure
 * 2. Check signature
 * 3. Detect suspicious prerequisites
 */
export async function loadAndVerifySkill(
  manifest: SkillManifest,
  publicKey: string
): Promise<SkillVerificationResult> {
  const errors: string[] = [];

  // 1. Validate manifest structure
  const validationResult = validateSkillManifest(manifest);
  if (!validationResult.valid) {
    errors.push(...validationResult.errors);
  }

  // 2. Verify signature
  if (manifest.signature && !verifySkillSignature(manifest, publicKey)) {
    errors.push(
      `Skill signature verification failed (tampered or signed with wrong key): ${manifest.id}`
    );
  }

  // 3. Detect suspicious prerequisites
  const suspiciousPrereqs = detectSuspiciousPrerequisites(manifest);
  if (suspiciousPrereqs.length > 0) {
    errors.push(`Suspicious prerequisites detected: ${suspiciousPrereqs.join('; ')}`);
  }

  if (errors.length > 0) {
    await sendAlert(
      'CRITICAL: Suspicious skill detected',
      `Skill: ${manifest.name}\nErrors: ${errors.join('\n')}`,
      'critical'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
