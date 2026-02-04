#!/usr/bin/env node

/**
 * Quick Rodrigo Hash Generator
 * Takes API key as argument and generates hash
 */

const bcrypt = require('bcrypt');

const apiKey = process.argv[2];

if (!apiKey || apiKey.length < 32) {
  console.error('❌ Usage: node scripts/setup-rodrigo-hash.js <your-api-key>');
  console.error('❌ API key must be 64+ characters');
  process.exit(1);
}

async function generateHash() {
  try {
    console.log('\n⏳ Generating bcrypt hash...\n');

    const hash = await bcrypt.hash(apiKey, 12);
    const salt = await bcrypt.genSalt(12);

    // Verify
    const isValid = await bcrypt.compare(apiKey, hash);
    if (!isValid) {
      throw new Error('Hash verification failed');
    }

    console.log('✅ Hash generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Add to .env.local:\n');
    console.log(`RODRIGO_API_KEY_HASH=${hash}`);
    console.log(`RODRIGO_API_KEY_SALT=${salt}`);
    console.log(`THANOS_TRIGGER_PHRASE=THANOS_MODE_AUTH_1990`);
    console.log(`RODRIGO_CREATOR_ID=rodrigo_specter`);
    console.log(`RODRIGO_TRUST_LEVEL=1.0`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateHash();
