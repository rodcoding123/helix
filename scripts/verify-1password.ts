/**
 * Verification Script - Test 1Password Integration
 *
 * Usage:
 *   npx ts-node scripts/verify-1password.ts
 *
 * This script verifies that:
 * 1. 1Password CLI is installed and authenticated
 * 2. Helix vault exists
 * 3. All required secrets are accessible
 * 4. Secrets can be loaded successfully
 */

import { loadSecret, verifySecrets, loadAllSecrets } from '../src/lib/secrets-loader';
import { execSync } from 'child_process';

async function main() {
  console.log('\n🔐 Helix 1Password Integration Verification\n');

  // Step 1: Check 1Password CLI
  console.log('Step 1: Checking 1Password CLI...');
  try {
    const version = execSync('op --version', { encoding: 'utf-8' });
    console.log(`  ✓ 1Password CLI: ${version.trim()}`);
  } catch {
    console.error('  ✗ 1Password CLI not found. Install from: https://1password.com/downloads/command-line-tools/');
    process.exit(1);
  }

  // Step 2: Check authentication
  console.log('\nStep 2: Checking 1Password authentication...');
  try {
    const whoami = execSync('op whoami', { encoding: 'utf-8' });
    console.log(`  ✓ Authenticated as: ${whoami.trim()}`);
  } catch {
    console.error('  ✗ Not authenticated. Run: op account add');
    process.exit(1);
  }

  // Step 3: Check vault exists
  console.log('\nStep 3: Checking Helix vault...');
  try {
    const vaults = execSync('op vault list --format=json', { encoding: 'utf-8' });
    const vaultList = JSON.parse(vaults);
    const helixVault = vaultList.find((v: any) => v.name === 'Helix');
    if (helixVault) {
      console.log(`  ✓ Helix vault found (ID: ${helixVault.id})`);
    } else {
      console.error('  ✗ Helix vault not found. Run: npx powershell scripts/setup-1password.ps1');
      process.exit(1);
    }
  } catch (error) {
    console.error('  ✗ Could not list vaults:', error);
    process.exit(1);
  }

  // Step 4: Verify all secrets
  console.log('\nStep 4: Verifying all secrets...');
  const { status, messages } = await verifySecrets();
  messages.forEach(msg => console.log(`  ${msg}`));

  if (status === 'error') {
    console.error('\n✗ Some secrets are missing. Run: npx powershell scripts/setup-1password.ps1');
    process.exit(1);
  }

  // Step 5: Load and test a secret
  console.log('\nStep 5: Testing secret loading...');
  try {
    const secret = await loadSecret('Stripe Secret Key');
    console.log(`  ✓ Successfully loaded Stripe Secret Key (${secret.substring(0, 10)}...)`);
  } catch (error) {
    console.error('  ✗ Failed to load test secret:', error);
    process.exit(1);
  }

  // Step 6: Load all secrets
  console.log('\nStep 6: Loading all secrets into environment...');
  try {
    const secrets = await loadAllSecrets();
    console.log(`  ✓ Loaded ${Object.keys(secrets).length} secrets into environment`);
  } catch (error) {
    console.error('  ✗ Failed to load all secrets:', error);
  }

  console.log('\n✅ 1Password integration verified successfully!\n');
  console.log('Next steps:');
  console.log('  1. Update your code to use: import { loadSecret } from "./src/lib/secrets-loader"');
  console.log('  2. Replace .env references with: await loadSecret("Secret Name")');
  console.log('  3. Run tests to ensure everything works\n');
}

main().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
