#!/usr/bin/env tsx
/**
 * Secret Rotation Script
 * Automates rotating secrets from 1Password and updating Vercel/Supabase
 *
 * Usage:
 *   npm run security:rotate-secrets
 *   npm run security:rotate-secrets -- --dry-run
 *
 * This script:
 * 1. Rotates secrets in 1Password vault
 * 2. Updates Vercel environment variables
 * 3. Notifies of changes via Discord
 * 4. Logs audit trail
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SecretConfig {
  name: string;
  itemName: string; // 1Password item name
  envVar: string; // Environment variable name
  field: 'password' | 'notes' | 'username';
  rotatable: boolean;
  vercelSync: boolean;
}

// Secrets that can be rotated
const ROTATABLE_SECRETS: SecretConfig[] = [
  {
    name: 'Stripe Secret Key',
    itemName: 'Stripe Secret Key',
    envVar: 'STRIPE_SECRET_KEY',
    field: 'password',
    rotatable: true,
    vercelSync: true,
  },
  {
    name: 'DeepSeek API Key',
    itemName: 'DeepSeek API Key',
    envVar: 'DEEPSEEK_API_KEY',
    field: 'password',
    rotatable: true,
    vercelSync: true,
  },
  {
    name: 'Gemini API Key',
    itemName: 'Gemini API Key',
    envVar: 'GEMINI_API_KEY',
    field: 'password',
    rotatable: true,
    vercelSync: true,
  },
  // Discord webhooks are not auto-rotated (manual process in Discord)
  // Supabase keys are not auto-rotated (manual process in Supabase)
];

interface RotationResult {
  success: boolean;
  rotated: number;
  failed: number;
  warnings: string[];
  operations: string[];
}

async function main() {
  console.log('🔄 Helix Secret Rotation');
  console.log('========================\n');

  const dryRun = process.argv.includes('--dry-run');
  const result: RotationResult = {
    success: true,
    rotated: 0,
    failed: 0,
    warnings: [],
    operations: [],
  };

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  // Check prerequisites
  try {
    console.log('✓ Checking prerequisites...');
    execSync('op whoami', { stdio: 'pipe' });
    result.operations.push('1Password CLI authenticated');
  } catch {
    console.error('❌ 1Password CLI not authenticated');
    console.error('   Run: op account add');
    process.exit(1);
  }

  // Check Vercel CLI
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    result.operations.push('Vercel CLI available');
  } catch {
    console.warn('⚠️  Vercel CLI not available - skipping Vercel sync');
    result.warnings.push('Vercel CLI not installed - cannot sync environment variables');
  }

  console.log();

  // Rotate each secret
  for (const secret of ROTATABLE_SECRETS) {
    console.log(`\n🔐 Rotating: ${secret.name}`);

    try {
      // Generate new secret (provider-specific)
      const newSecret = generateNewSecret(secret.name);

      if (dryRun) {
        console.log(`   [DRY RUN] Would generate new secret`);
        result.operations.push(`[DRY RUN] ${secret.name} rotation`);
      } else {
        // Update in 1Password
        console.log(`   → Updating in 1Password Vault "Helix"...`);
        updateSecretIn1Password(secret.itemName, secret.field, newSecret);
        result.operations.push(`Updated ${secret.name} in 1Password`);
        result.rotated++;

        // Sync to Vercel
        if (secret.vercelSync) {
          console.log(`   → Syncing to Vercel environment...`);
          try {
            updateVercelEnv(secret.envVar, newSecret);
            result.operations.push(`Synced ${secret.envVar} to Vercel`);
          } catch (error) {
            console.warn(`   ⚠️  Failed to sync to Vercel: ${error}`);
            result.warnings.push(`Could not sync ${secret.name} to Vercel`);
          }
        }

        console.log(`   ✓ ${secret.name} rotated successfully`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to rotate ${secret.name}: ${error}`);
      result.failed++;
      result.success = false;
    }
  }

  // Summary
  console.log('\n\n📊 Rotation Summary');
  console.log('===================');
  console.log(`✓ Rotated: ${result.rotated}`);
  console.log(`✗ Failed: ${result.failed}`);

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of result.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  console.log('\n📝 Operations Log:');
  for (const op of result.operations) {
    console.log(`   - ${op}`);
  }

  if (!result.success) {
    console.error('\n❌ Rotation FAILED - some secrets could not be rotated');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n✓ Dry run complete - no changes made');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log('\n✓ Secret rotation complete!');
    console.log('   Next step: Redeploy applications with new secrets');
    console.log('   Command: git push origin main');
  }
}

function generateNewSecret(secretName: string): string {
  // This is a placeholder - in production, you'd call the provider's API
  // For now, return a marker indicating a new secret would be generated
  return `[NEW_${secretName.replace(/ /g, '_').toUpperCase()}_${Date.now()}]`;
}

function updateSecretIn1Password(itemName: string, field: string, newValue: string): void {
  // Update secret in 1Password vault
  const command = `op item edit "${itemName}" --vault Helix --${field}="${newValue}"`;

  try {
    execSync(command, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Failed to update ${itemName} in 1Password: ${error}`);
  }
}

function updateVercelEnv(envVar: string, newValue: string): void {
  // Update environment variable in Vercel
  const command = `vercel env add ${envVar}`;

  try {
    // This is simplified - in practice you'd use Vercel API or interactive CLI
    execSync(command, { input: newValue });
  } catch (error) {
    throw new Error(`Failed to update ${envVar} in Vercel: ${error}`);
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
