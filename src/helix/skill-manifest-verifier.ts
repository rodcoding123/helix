import { createSign, createVerify, generateKeyPairSync } from 'crypto';

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
  prerequisites: string[];
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

  for (const prerequisite of manifest.prerequisites) {
    // 1. Detect fake download prerequisites
    if (/\b(download|click|run)\b/i.test(prerequisite)) {
      if (/click-to-download|run-installer|fake-.*download|download-plugin/i.test(prerequisite)) {
        suspicious.push(`Detected fake prerequisite (suspicious download prompt): ${prerequisite}`);
      }
    }

    // 2. Detect shell commands (curl | bash, sh -c, etc.)
    if (
      /curl.*\|.*bash|curl.*\|.*sh\b|sh\s+-c|bash\s+-c|\|\s*sh\b|\|\s*bash\b/i.test(prerequisite)
    ) {
      suspicious.push(`Detected shell command prerequisite (execution risk): ${prerequisite}`);
    }

    // 3. Detect obfuscation techniques
    if (/base64|eval|decode|atob|btoa|unescape/i.test(prerequisite)) {
      suspicious.push(`Detected obfuscation in prerequisite: ${prerequisite}`);
    }

    // 4. Detect suspicious archive downloads
    if (/https?:\/\/[^\s]+\.(zip|dmg|exe|msi|tar\.gz|tgz)$/i.test(prerequisite)) {
      // Allow downloads from trusted sources
      const isTrusted = /github\.com|npmjs\.com|npm\.org/i.test(prerequisite);

      if (!isTrusted) {
        suspicious.push(`Detected suspicious archive download (untrusted source): ${prerequisite}`);
      }
    }
  }

  return suspicious;
}

/**
 * Generate an RSA key pair for signing skills (compatible with Node.js crypto)
 */
export function generateSkillSigningKey(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: 'pem',
      type: 'pkcs8',
    },
    publicKeyEncoding: {
      format: 'pem',
      type: 'spki',
    },
  });

  return {
    publicKey,
    privateKey,
  };
}

/**
 * Sign a skill manifest with a private key
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

  // Create signature
  const signer = createSign('sha256');
  signer.update(manifestString);
  const signature = signer.sign(privateKey, 'hex');

  return {
    ...manifest,
    signature,
  };
}

/**
 * Verify a skill manifest signature with a public key
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

    // Verify signature
    const verifier = createVerify('sha256');
    verifier.update(manifestString);

    return verifier.verify(publicKey, manifest.signature, 'hex');
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
export function loadAndVerifySkill(
  manifest: SkillManifest,
  publicKey: string
): SkillVerificationResult {
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
