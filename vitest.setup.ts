/**
 * Vitest setup file - configures environment variables before any tests run
 * This ensures Discord webhook URLs are available when modules cache process.env
 */

// Set all Discord webhook environment variables with test URLs
process.env.DISCORD_WEBHOOK_HASH_CHAIN =
  'https://discord.com/api/webhooks/test/hash-chain';
process.env.DISCORD_WEBHOOK_COMMANDS =
  'https://discord.com/api/webhooks/test/commands';
process.env.DISCORD_WEBHOOK_API =
  'https://discord.com/api/webhooks/test/api';
process.env.DISCORD_WEBHOOK_HEARTBEAT =
  'https://discord.com/api/webhooks/test/heartbeat';
process.env.DISCORD_WEBHOOK_FILE_CHANGES =
  'https://discord.com/api/webhooks/test/file-changes';
process.env.DISCORD_WEBHOOK_CONSCIOUSNESS =
  'https://discord.com/api/webhooks/test/consciousness';
process.env.DISCORD_WEBHOOK_ALERTS =
  'https://discord.com/api/webhooks/test/alerts';

// Set other required environment variables
process.env.NODE_ENV = 'test';
process.env.HELIX_ROOT = process.cwd();
