/**
 * Secrets Loader - Load secrets from 1Password CLI
 *
 * This module provides a unified interface to load secrets from either:
 * 1. 1Password CLI (production / secure)
 * 2. .env files (development fallback only)
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

export type SecretField = 'password' | 'notes' | 'username' | 'email' | 'url';

const VAULT_NAME = 'Helix';
const SECRETS_CACHE = new Map<string, string>();

/**
 * Load a secret from 1Password
 * @param itemName - The name of the secret item in 1Password
 * @param field - The field to retrieve ('password', 'notes', 'username', etc.)
 * @returns The secret value
 * @throws Error if secret not found or 1Password CLI fails
 */
export async function loadSecret(
  itemName: string,
  field: SecretField = 'password'
): Promise<string> {
  // Check cache first
  const cacheKey = `${itemName}:${field}`;
  if (SECRETS_CACHE.has(cacheKey)) {
    return SECRETS_CACHE.get(cacheKey)!;
  }

  // Try 1Password first
  const useOnePassword = process.env.HELIX_SECRETS_SOURCE !== 'env';

  if (useOnePassword) {
    try {
      const secret = await loadSecretFrom1Password(itemName, field);
      SECRETS_CACHE.set(cacheKey, secret);
      return secret;
    } catch (error) {
      // Fall back to .env if 1Password fails
      console.warn(
        `Warning: Could not load "${itemName}" from 1Password. Trying .env fallback.`,
        error
      );
      const secret = await loadSecretFromEnv(itemName);
      if (secret) {
        SECRETS_CACHE.set(cacheKey, secret);
        return secret;
      }
      throw new Error(`Secret "${itemName}" not found in 1Password or .env`);
    }
  }

  // Dev mode: load from .env
  const secret = await loadSecretFromEnv(itemName);
  if (!secret) {
    throw new Error(`Secret "${itemName}" not found in .env (dev mode)`);
  }
  SECRETS_CACHE.set(cacheKey, secret);
  return secret;
}

/**
 * Load a secret directly from 1Password using op CLI
 */
async function loadSecretFrom1Password(itemName: string, field: SecretField): Promise<string> {
  try {
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
    const parsed = JSON.parse(result);
    if (parsed.value) {
      return parsed.value;
    }

    throw new Error(`Field "${field}" not found in item "${itemName}"`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load secret from 1Password: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load secret from .env files (fallback for development)
 * Maps item names to env variable names
 */
async function loadSecretFromEnv(itemName: string): Promise<string | null> {
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
 */
export async function loadAllSecrets(): Promise<Record<string, string>> {
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
      const value = await loadSecret(item.name, item.field);
      secrets[item.envVar] = value;
      process.env[item.envVar] = value;
    } catch (error) {
      console.error(`Failed to load ${item.name}:`, error);
      // Don't throw - allow partial loading for development
    }
  }

  return secrets;
}

/**
 * Verify all required secrets are available
 */
export async function verifySecrets(): Promise<{
  status: 'ok' | 'warning' | 'error';
  messages: string[];
}> {
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
      await loadSecret(secretName);
      messages.push(`✓ ${secretName}`);
    } catch (error) {
      messages.push(`✗ ${secretName} - ${error}`);
      status = 'error';
    }
  }

  return { status, messages };
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  SECRETS_CACHE.clear();
}
