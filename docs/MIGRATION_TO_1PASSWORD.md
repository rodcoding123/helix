# Migration Guide: From .env to 1Password

This guide explains how to migrate Helix from .env file secrets to secure 1Password CLI management.

## Overview

**Old Way (Insecure):**
```typescript
const WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,  // ❌ Exposed in .env
};
```

**New Way (Secure):**
```typescript
import { loadSecret } from '../lib/secrets-loader';

// Loaded once at startup
const WEBHOOKS = {
  commands: await loadSecret('Discord Webhook - Commands', 'notes'),  // ✓ From 1Password
};
```

## Step 1: Install 1Password CLI

**Windows (PowerShell):**
```powershell
winget install 1Password.CLI
```

Or download from: https://1password.com/downloads/command-line-tools/

## Step 2: Set Up 1Password Account

1. Go to https://1password.com/sign-up/
2. Create a personal account (or apply for free open source program)
3. Save your emergency kit

## Step 3: Authenticate CLI

```bash
op account add
```

This opens a browser to authenticate and generates a local credentials file.

## Step 4: Create Helix Vault and Migrate Secrets

```powershell
# Run the setup script
.\scripts\setup-1password.ps1
```

This creates a "Helix" vault and adds all your secrets.

## Step 5: Verify Integration

```bash
# Test that everything works
npx ts-node scripts/verify-1password.ts
```

You should see:
```
✓ 1Password CLI: 2.x.x
✓ Authenticated as: your@email.com
✓ Helix vault found
✓ All secrets verified
✓ Successfully loaded Stripe Secret Key
✓ Loaded 13 secrets into environment

✅ 1Password integration verified successfully!
```

## Step 6: Update Code to Use 1Password

### Example 1: Logging Hooks Module

**Before (logging-hooks.ts):**
```typescript
// OLD - Exposes secrets in .env files
const WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
};
```

**After (logging-hooks.ts):**
```typescript
import { loadSecret } from '../lib/secrets-loader.js';

// Loaded once at application startup
let WEBHOOKS: Record<string, string | undefined>;

export async function initializeWebhooks(): Promise<void> {
  WEBHOOKS = {
    commands: await loadSecret('Discord Webhook - Commands', 'notes'),
    api: await loadSecret('Discord Webhook - API', 'notes'),
    files: await loadSecret('Discord Webhook - File Changes', 'notes'),
    consciousness: await loadSecret('Discord Webhook - Consciousness', 'notes'),
    alerts: await loadSecret('Discord Webhook - Alerts', 'notes'),
    hashChain: await loadSecret('Discord Webhook - Hash Chain', 'notes'),
  };
}

// Call this in your application startup
// await initializeWebhooks();
```

### Example 2: Web Application (Supabase Config)

**Before (web/src/lib/supabase.ts):**
```typescript
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,  // ❌ From .env
  process.env.VITE_SUPABASE_ANON_KEY!
);
```

**After:**
```typescript
import { loadSecret } from '../lib/secrets-loader';

let supabase: ReturnType<typeof createClient> | null = null;

export async function initializeSupabase() {
  const url = await loadSecret('Supabase Service Role', 'username'); // Or store URL in notes
  const key = await loadSecret('Supabase Anon Key', 'password');

  supabase = createClient(url, key);
  return supabase;
}

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase not initialized. Call initializeSupabase() first.');
  }
  return supabase;
}
```

### Example 3: OpenClaw Gateway

**Before (.env):**
```
DISCORD_WEBHOOK_COMMANDS=https://discord.com/api/webhooks/...
```

**After (gateway startup):**
```typescript
import { loadSecret } from '../../lib/secrets-loader';

async function initializeGateway() {
  const commandsWebhook = await loadSecret('Discord Webhook - Commands', 'notes');

  // Use webhook for logging...
}
```

## Step 7: Update .env Files

Keep .env files as documentation, but make them safe:

**.env.local (SAFE - no secrets):**
```bash
# Helix Web Application Configuration
# Secrets are loaded from 1Password CLI, not from this file

# Supabase endpoint (not secret)
VITE_SUPABASE_URL=https://ncygunbukmpwhtzwbnvp.supabase.co

# Development mode
VITE_MODE=development

# Stripe public key (not secret)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**.env (SAFE - no secrets):**
```bash
# Helix Core Configuration
# All secrets are loaded from 1Password via: await loadSecret('Name')

HELIX_ENVIRONMENT=development

# These are loaded from 1Password vault "Helix":
# - Discord Webhook - Commands
# - Discord Webhook - API
# - Discord Webhook - Heartbeat
# - Discord Webhook - Alerts
# - Discord Webhook - Consciousness
# - Discord Webhook - File Changes
# - Discord Webhook - Hash Chain
# - Supabase Service Role
# - Stripe Secret Key
# - DeepSeek API Key
# - Gemini API Key
```

## Step 8: Test Everything Works

```bash
# Run tests to ensure secrets load correctly
npm run test

# Start development server
npm run dev

# Check logs to verify webhooks are working
```

## Development vs Production

### Development
- Use 1Password CLI (easier)
- Or set `HELIX_SECRETS_SOURCE=env` to use .env as fallback
- Run: `export HELIX_SECRETS_SOURCE=env` (Linux/Mac) or `$env:HELIX_SECRETS_SOURCE='env'` (Windows)

### Production (Docker)

See `docs/DEPLOYMENT_WITH_1PASSWORD.md` for Docker setup.

```dockerfile
# In your Dockerfile
RUN apt-get install -y 1password-cli
COPY ./scripts/setup-1password.sh /

ENTRYPOINT ["/bin/sh", "-c", "op account add --address $OP_ACCOUNT --email $OP_EMAIL --secret-key $OP_SECRET && exec \"$@\"", "--"]
CMD ["npm", "start"]
```

## Troubleshooting

### "1Password CLI not found"
```bash
# Install via package manager
winget install 1Password.CLI
# or
brew install 1password-cli
# or
apt-get install 1password-cli
```

### "Not authenticated"
```bash
op account add
# Follow the browser authentication flow
```

### "Helix vault not found"
```bash
# Re-run setup script
.\scripts\setup-1password.ps1
```

### "Secret not found"
```bash
# List all items in vault
op item list --vault Helix

# Check if secret exists
op item get "Discord Webhook - Commands" --vault Helix
```

### "Falls back to .env but .env is missing"
```bash
# Either:
# 1. Fix 1Password authentication
op account add

# 2. Or temporarily allow .env fallback
export HELIX_SECRETS_SOURCE=env
```

## Security Benefits

✅ **Before:** Secrets stored in plaintext .env files (CVSS 9.1)
✅ **After:** Secrets stored in encrypted 1Password vault
✅ **Before:** Git could accidentally commit secrets
✅ **After:** .env files committed only have placeholders
✅ **Before:** Any process with file read access could steal credentials
✅ **After:** Only authorized 1Password CLI calls access secrets
✅ **Before:** No audit trail of who accessed secrets
✅ **After:** 1Password logs all secret access

## Next Steps

1. Update all modules to use `loadSecret()`
2. Remove plaintext secrets from .env
3. Commit safe .env.local with placeholders
4. Update Docker deployment (see deployment guide)
5. Set up 1Password team account for multi-user deployment
6. Configure 1Password CI/CD integration for GitHub Actions

## References

- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [Secrets Loader Module](../src/lib/secrets-loader.ts)
- [Verification Script](../scripts/verify-1password.ts)
