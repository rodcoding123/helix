/**
 * Test Secrets Loader Fallback
 * Verifies that secrets can be loaded from .env as fallback
 *
 * Usage:
 *   export HELIX_SECRETS_SOURCE=env
 *   npx ts-node scripts/test-secrets-loader.ts
 */

import { loadSecret, verifySecrets, clearCache } from '../dist/lib/secrets-loader.js';

async function main() {
  console.log('\n🔐 Testing Secrets Loader\n');

  // Show which source we're using
  const source = process.env.HELIX_SECRETS_SOURCE || '1password (default)';
  console.log(`📌 Using secret source: ${source}\n`);

  // Test 1: Load a single secret
  console.log('Test 1: Loading single secret...');
  try {
    clearCache();
    const stripe = await loadSecret('Stripe Secret Key', 'password');
    console.log(`✓ Loaded Stripe key (first 20 chars): ${stripe.substring(0, 20)}...`);
  } catch (error) {
    console.error(`✗ Failed: ${error}`);
  }

  // Test 2: Verify all secrets
  console.log('\nTest 2: Verifying all secrets...');
  try {
    clearCache();
    const { status, messages } = await verifySecrets();
    messages.forEach(msg => console.log(`  ${msg}`));

    if (status === 'ok') {
      console.log(`✓ All secrets verified!\n`);
    } else {
      console.log(`⚠ Some secrets missing (status: ${status})\n`);
    }
  } catch (error) {
    console.error(`✗ Verification failed: ${error}`);
  }

  // Test 3: Load webhook
  console.log('Test 3: Loading webhook...');
  try {
    clearCache();
    const webhook = await loadSecret('Discord Webhook - Commands', 'notes');
    console.log(`✓ Loaded webhook (first 50 chars): ${webhook.substring(0, 50)}...`);
  } catch (error) {
    console.error(`✗ Failed: ${error}`);
  }

  // Test 4: Cache test
  console.log('\nTest 4: Testing cache...');
  try {
    clearCache();
    const secret1 = await loadSecret('Stripe Secret Key', 'password');
    const secret2 = await loadSecret('Stripe Secret Key', 'password');
    if (secret1 === secret2) {
      console.log('✓ Cache working correctly');
    }
  } catch (error) {
    console.error(`✗ Cache test failed: ${error}`);
  }

  console.log('\n✅ Secrets loader tests complete!\n');

  console.log('Next steps:');
  console.log('  1. Set: export HELIX_SECRETS_SOURCE=env (to use .env)');
  console.log('  2. Start your app: npm run dev');
  console.log('  3. Logs should show: [Helix] Discord webhooks initialized');
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
