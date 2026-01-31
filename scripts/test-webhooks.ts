/**
 * HELIX WEBHOOK TEST SCRIPT
 * Tests all Discord webhooks to verify connectivity
 *
 * Usage: npx tsx scripts/test-webhooks.ts
 */

import { config } from 'dotenv';
import path from 'node:path';

// Load environment from ~/.openclaw/.env
const envPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', '.env');
config({ path: envPath });

interface WebhookTest {
  name: string;
  envVar: string;
  url: string | undefined;
}

interface DiscordEmbed {
  title: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp: string;
  footer: {
    text: string;
  };
}

const WEBHOOKS: WebhookTest[] = [
  { name: 'Commands', envVar: 'DISCORD_WEBHOOK_COMMANDS', url: process.env.DISCORD_WEBHOOK_COMMANDS },
  { name: 'API', envVar: 'DISCORD_WEBHOOK_API', url: process.env.DISCORD_WEBHOOK_API },
  { name: 'Heartbeat', envVar: 'DISCORD_WEBHOOK_HEARTBEAT', url: process.env.DISCORD_WEBHOOK_HEARTBEAT },
  { name: 'Alerts', envVar: 'DISCORD_WEBHOOK_ALERTS', url: process.env.DISCORD_WEBHOOK_ALERTS },
  { name: 'Consciousness', envVar: 'DISCORD_WEBHOOK_CONSCIOUSNESS', url: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS },
  { name: 'File Changes', envVar: 'DISCORD_WEBHOOK_FILE_CHANGES', url: process.env.DISCORD_WEBHOOK_FILE_CHANGES },
  { name: 'Hash Chain', envVar: 'DISCORD_WEBHOOK_HASH_CHAIN', url: process.env.DISCORD_WEBHOOK_HASH_CHAIN },
];

async function testWebhook(webhook: WebhookTest): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!webhook.url) {
    return { success: false, error: 'URL not configured' };
  }

  const timestamp = new Date().toISOString();
  const embed: DiscordEmbed = {
    title: `🧪 Webhook Test: ${webhook.name}`,
    color: 0x5865f2, // Discord blurple
    fields: [
      { name: 'Channel', value: webhook.name, inline: true },
      { name: 'Status', value: 'Testing...', inline: true },
      { name: 'Time', value: timestamp, inline: true },
      { name: 'Environment Variable', value: `\`${webhook.envVar}\``, inline: false },
    ],
    timestamp,
    footer: {
      text: 'Helix Webhook Connectivity Test',
    },
  };

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (response.ok) {
      return { success: true, status: response.status };
    } else {
      const text = await response.text();
      return { success: false, status: response.status, error: text };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('HELIX DISCORD WEBHOOK TEST');
  console.log('='.repeat(60));
  console.log(`Environment file: ${envPath}`);
  console.log('');

  const results: Array<{ webhook: WebhookTest; result: { success: boolean; status?: number; error?: string } }> = [];

  for (const webhook of WEBHOOKS) {
    process.stdout.write(`Testing ${webhook.name.padEnd(15)}... `);

    if (!webhook.url) {
      console.log('⏭️  SKIPPED (not configured)');
      results.push({ webhook, result: { success: false, error: 'Not configured' } });
      continue;
    }

    const result = await testWebhook(webhook);

    if (result.success) {
      console.log(`✅ SUCCESS (${result.status})`);
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }

    results.push({ webhook, result });

    // Rate limit protection - Discord allows 5 requests per 2 seconds per webhook
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const configured = results.filter(r => r.webhook.url);
  const successful = results.filter(r => r.result.success);
  const failed = configured.filter(r => !r.result.success);

  console.log(`Total webhooks:      ${WEBHOOKS.length}`);
  console.log(`Configured:          ${configured.length}`);
  console.log(`Successful:          ${successful.length}`);
  console.log(`Failed:              ${failed.length}`);
  console.log('');

  if (failed.length > 0) {
    console.log('FAILED WEBHOOKS:');
    for (const { webhook, result } of failed) {
      console.log(`  - ${webhook.name}: ${result.error}`);
    }
    console.log('');
  }

  if (successful.length > 0) {
    console.log('Check your Discord channels for test messages! ✨');
  }

  // Exit with error code if any configured webhooks failed
  const exitCode = failed.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
