/**
 * Secrets Loader - Load secrets from 1Password CLI
 *
 * This module provides a unified interface to load secrets from either:
 * 1. 1Password CLI (production / secure)
 * 2. .env files (development fallback only)
 *
 * Secrets are stored encrypted in memory using AES-256-GCM to prevent
 * plaintext exposure in heap snapshots or memory dumps.
 *
 * Usage:
 *   const stripeKey = await loadSecret('Stripe Secret Key', 'password');
 *   const discordWebhook = await loadSecret('Discord Webhook - Commands', 'notes');
 *
 * For development without 1Password, set HELIX_SECRETS_SOURCE=env
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EncryptedSecretsCache } from './secrets-cache-encrypted.js';

export type SecretField = 'password' | 'notes' | 'username' | 'email' | 'url';

const VAULT_NAME = 'Helix';
const SECRETS_CACHE = new EncryptedSecretsCache();

// Initialize encrypted cache immediately when module loads
let cacheInitialized = false;
async function initializeCache(): Promise<void> {
  if (!cacheInitialized) {
    try {
      await SECRETS_CACHE.initialize();
      cacheInitialized = true;
    } catch (error) {
      console.error(
        '[Secrets Loader] Failed to initialize encrypted cache:',
        error instanceof Error ? error.message : String(error)
      );
      // Continue without encryption (fallback) - will log to sanitized error
      cacheInitialized = true;
    }
  }
}

// Start initialization immediately
initializeCache().catch((error) => {
  console.error('[Secrets Loader] Async init failed:', error instanceof Error ? error.message : String(error));
});

/**
 * Load a secret from 1Password
 *
 * Secrets are encrypted in memory and decrypted on-the-fly to prevent
 * plaintext exposure in heap snapshots.
 *
 * @param itemName - The name of the secret item in 1Password
 * @param field - The field to retrieve ('password', 'notes', 'username', etc.)
 * @returns The secret value (plaintext, decrypted from cache)
 * @throws Error if secret not found or 1Password CLI fails
 */
export function loadSecret(itemName: string, field: SecretField = 'password'): string {
  // Check encrypted cache first
  const cacheKey = `${itemName}:${field}`;
  try {
    if (SECRETS_CACHE.has(cacheKey)) {
      return SECRETS_CACHE.get(cacheKey)!;
    }
  } catch (error) {
    // Cache operation failed, continue with loading
    console.error(
      `Warning: Cache operation failed for "${itemName}", reloading from source`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // Try 1Password first
  const useOnePassword = process.env.HELIX_SECRETS_SOURCE !== 'env';

  if (useOnePassword) {
    try {
      const secret = loadSecretFrom1Password(itemName, field);
      try {
        SECRETS_CACHE.set(cacheKey, secret);
      } catch (cacheError) {
        console.error(
          `Warning: Could not cache "${itemName}", using plaintext temporary`,
          cacheError instanceof Error ? cacheError.message : String(cacheError)
        );
      }
      return secret;
    } catch (error) {
      // Fall back to .env if 1Password fails
      console.warn(`Warning: Could not load "${itemName}" from 1Password. Trying .env fallback.`);
      const secret = loadSecretFromEnv(itemName);
      if (secret) {
        try {
          SECRETS_CACHE.set(cacheKey, secret);
        } catch (cacheError) {
          console.error(
            `Warning: Could not cache .env secret "${itemName}"`,
            cacheError instanceof Error ? cacheError.message : String(cacheError)
          );
        }
        return secret;
      }
      throw new Error(`Secret "${itemName}" not found in 1Password or .env`);
    }
  }

  // Dev mode: load from .env
  const secret = loadSecretFromEnv(itemName);
  if (!secret) {
    throw new Error(`Secret "${itemName}" not found in .env (dev mode)`);
  }
  try {
    SECRETS_CACHE.set(cacheKey, secret);
  } catch (cacheError) {
    console.error(
      `Warning: Could not cache .env secret "${itemName}"`,
      cacheError instanceof Error ? cacheError.message : String(cacheError)
    );
  }
  return secret;
}

/**
 * Load a secret directly from 1Password using op CLI
 */
function loadSecretFrom1Password(itemName: string, field: SecretField): string {
  // First, verify 1Password CLI is installed and authenticated
  try {
    execSync('op whoami', { stdio: 'pipe' });
  } catch {
    throw new Error('1Password CLI not authenticated. Run: op account add');
  }

  // Fetch the secret using op CLI
  const command = `op item get "${itemName}" --vault "${VAULT_NAME}" --fields="${field}" --format=json`;
  const result = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

  // Parse the JSON response
  const parsed = JSON.parse(result) as { value?: string };
  if (parsed.value) {
    return parsed.value;
  }

  throw new Error(`Field "${field}" not found in item "${itemName}"`);
}

/**
 * Load secret from .env files (fallback for development)
 * Maps item names to env variable names
 */
function loadSecretFromEnv(itemName: string): string | null {
  const mapping: Record<string, string> = {
    'Supabase URL': 'VITE_SUPABASE_URL',
    'Supabase Service Role': 'SUPABASE_SERVICE_ROLE_KEY',
    'Supabase Anon Key': 'VITE_SUPABASE_ANON_KEY',
    'Stripe Secret Key': 'STRIPE_SECRET_KEY',
    'Stripe Publishable Key': 'VITE_STRIPE_PUBLISHABLE_KEY',
    'DeepSeek API Key': 'DEEPSEEK_API_KEY',
    'Gemini API Key': 'GEMINI_API_KEY',
    'Discord Webhook - Commands': 'DISCORD_WEBHOOK_COMMANDS',
    'Discord Webhook - API': 'DISCORD_WEBHOOK_API',
    'Discord Webhook - Heartbeat': 'DISCORD_WEBHOOK_HEARTBEAT',
    'Discord Webhook - Alerts': 'DISCORD_WEBHOOK_ALERTS',
    'Discord Webhook - Consciousness': 'DISCORD_WEBHOOK_CONSCIOUSNESS',
    'Discord Webhook - File Changes': 'DISCORD_WEBHOOK_FILE_CHANGES',
    'Discord Webhook - Hash Chain': 'DISCORD_WEBHOOK_HASH_CHAIN',
  };

  const envVarName = mapping[itemName];
  if (!envVarName) {
    console.warn(`Warning: No .env mapping for "${itemName}"`);
    return null;
  }

  // Try to load from .env files (check multiple locations)
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'web', '.env.local'),
    path.resolve(process.cwd(), 'web', '.env'),
    path.resolve(process.cwd(), 'openclaw-helix', '.env'),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(new RegExp(`^${envVarName}=(.+)$`, 'm'));
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return null;
}

/**
 * Load all secrets into environment variables
 * Useful for initialization or Docker entrypoint
 *
 * Note: Environment variable values will contain plaintext for use by
 * downstream code, but the encrypted cache preserves the encrypted copy.
 */
export function loadAllSecrets(): Record<string, string> {
  const secrets: Record<string, string> = {};

  const itemsToLoad = [
    { name: 'Supabase URL', envVar: 'VITE_SUPABASE_URL', field: 'url' as SecretField },
    {
      name: 'Supabase Service Role',
      envVar: 'SUPABASE_SERVICE_ROLE_KEY',
      field: 'password' as SecretField,
    },
    {
      name: 'Supabase Anon Key',
      envVar: 'VITE_SUPABASE_ANON_KEY',
      field: 'password' as SecretField,
    },
    { name: 'Stripe Secret Key', envVar: 'STRIPE_SECRET_KEY', field: 'password' as SecretField },
    {
      name: 'Stripe Publishable Key',
      envVar: 'VITE_STRIPE_PUBLISHABLE_KEY',
      field: 'password' as SecretField,
    },
    { name: 'DeepSeek API Key', envVar: 'DEEPSEEK_API_KEY', field: 'password' as SecretField },
    { name: 'Gemini API Key', envVar: 'GEMINI_API_KEY', field: 'password' as SecretField },
    {
      name: 'Discord Webhook - Commands',
      envVar: 'DISCORD_WEBHOOK_COMMANDS',
      field: 'notes' as SecretField,
    },
    { name: 'Discord Webhook - API', envVar: 'DISCORD_WEBHOOK_API', field: 'notes' as SecretField },
    {
      name: 'Discord Webhook - Heartbeat',
      envVar: 'DISCORD_WEBHOOK_HEARTBEAT',
      field: 'notes' as SecretField,
    },
    {
      name: 'Discord Webhook - Alerts',
      envVar: 'DISCORD_WEBHOOK_ALERTS',
      field: 'notes' as SecretField,
    },
    {
      name: 'Discord Webhook - Consciousness',
      envVar: 'DISCORD_WEBHOOK_CONSCIOUSNESS',
      field: 'notes' as SecretField,
    },
    {
      name: 'Discord Webhook - File Changes',
      envVar: 'DISCORD_WEBHOOK_FILE_CHANGES',
      field: 'notes' as SecretField,
    },
    {
      name: 'Discord Webhook - Hash Chain',
      envVar: 'DISCORD_WEBHOOK_HASH_CHAIN',
      field: 'notes' as SecretField,
    },
  ];

  for (const item of itemsToLoad) {
    try {
      const value = loadSecret(item.name, item.field);
      secrets[item.envVar] = value;
      process.env[item.envVar] = value;
    } catch (error) {
      // Don't log error object - it may contain secret data
      console.error(`Failed to load ${item.name}`);
      // Don't throw - allow partial loading for development
    }
  }

  return secrets;
}

/**
 * Verify all required secrets are available
 */
export function verifySecrets(): {
  status: 'ok' | 'warning' | 'error';
  messages: string[];
} {
  const messages: string[] = [];
  let status: 'ok' | 'warning' | 'error' = 'ok';

  const requiredSecrets = [
    'Supabase Service Role',
    'Stripe Secret Key',
    'Discord Webhook - Commands',
    'Discord Webhook - API',
    'Discord Webhook - Heartbeat',
  ];

  for (const secretName of requiredSecrets) {
    try {
      loadSecret(secretName);
      messages.push(`OK ${secretName}`);
    } catch (error) {
      messages.push(`FAIL ${secretName} - ${String(error)}`);
      status = 'error';
    }
  }

  return { status, messages };
}

/**
 * Clear the encrypted cache (useful for testing)
 * Note: Does not clear environment variables or 1Password vault
 */
export function clearCache(): void {
  try {
    SECRETS_CACHE.clear();
  } catch (error) {
    console.error(
      'Warning: Failed to clear cache:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
