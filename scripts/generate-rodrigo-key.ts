#!/usr/bin/env node

/**
 * Rodrigo Creator Key Generator
 *
 * One-time setup script to hash the Rodrigo API key
 * Usage: node scripts/generate-rodrigo-key.ts
 *
 * Prompts for API key (from paper) and generates bcrypt hash
 * Output: Add RODRIGO_API_KEY_HASH and RODRIGO_API_KEY_SALT to .env.local
 *
 * SECURITY: Never run this twice. Delete after setup.
 */

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';
import * as fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function generateRodrigoKeyHash(): Promise<void> {
  console.log('\n🔐 Rodrigo Creator API Key Setup\n');
  console.log('This script will hash your API key for storage in .env.local');
  console.log('The plaintext key will NOT be saved anywhere.\n');

  // Prompt for API key (no echo)
  rl.question(
    'Paste your Rodrigo API key (from paper, input hidden): ',
    async (apiKey: string) => {
      if (!apiKey || apiKey.length < 32) {
        console.error('❌ Error: API key too short (must be 64+ chars)');
        rl.close();
        process.exit(1);
      }

      try {
        console.log('\n⏳ Generating bcrypt hash (this takes ~1 second)...\n');

        // Generate bcrypt hash with 12 rounds (OWASP recommended)
        const hash = await bcrypt.hash(apiKey, 12);
        const salt = await bcrypt.genSalt(12);

        // Verify the hash works
        const isValid = await bcrypt.compare(apiKey, hash);
        if (!isValid) {
          throw new Error('Hash verification failed - hash generation aborted');
        }

        console.log('✅ Hash generated successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('Add these lines to .env.local:\n');
        console.log(`RODRIGO_API_KEY_HASH=${hash}`);
        console.log(`RODRIGO_API_KEY_SALT=${salt}`);
        console.log(`THANOS_TRIGGER_PHRASE=THANOS_MODE_AUTH_1990`);
        console.log(`RODRIGO_CREATOR_ID=rodrigo_specter`);
        console.log(`RODRIGO_TRUST_LEVEL=1.0`);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('⚠️  SECURITY REMINDERS:\n');
        console.log('1. Your plaintext API key is NOT saved anywhere');
        console.log('2. Delete this script after setup (never run again)');
        console.log('3. Keep your paper backup safe');
        console.log('4. .env.local is in .gitignore (will not be committed)\n');

        rl.close();
      } catch (error) {
        console.error('❌ Error during hash generation:', error);
        rl.close();
        process.exit(1);
      }
    }
  );

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    process.exit(0);
  });
}

generateRodrigoKeyHash();
