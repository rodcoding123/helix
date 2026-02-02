# Production Secrets Setup Guide

## Overview

Helix uses 1Password for secure secret management across all environments. This guide covers the production setup for both Vercel web deployment and Helix core runtime.

## Environment Variables Strategy

### Production (Vercel)

Environment variables are set via Vercel Dashboard or CLI and are immutable at deployment time.

**Required for Web API Routes**:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for backend operations)
- `HELIX_SECRETS_SOURCE=1password` - Force 1Password mode for Helix core (if running on Vercel)

### Development/Desktop

Local environment uses 1Password CLI (`op`) for secret loading.

**Required**:
- 1Password CLI installed and authenticated: `op account add`
- `HELIX_SECRETS_SOURCE=1password` (recommended) or `HELIX_SECRETS_SOURCE=env` for dev
- Vault named "Helix" in 1Password with all secrets

## 1Password Vault Items Required

All items must exist in the "Helix" vault:

| Item Name | Field | Type | Example Value |
|-----------|-------|------|----------------|
| Supabase URL | url | URL | https://xxxxx.supabase.co |
| Supabase Service Role | password | Secret | eyJhbGc... |
| Supabase Anon Key | password | Secret | eyJhbGc... |
| Stripe Secret Key | password | Secret | sk_live_... |
| Stripe Publishable Key | password | Secret | pk_live_... |
| DeepSeek API Key | password | Secret | sk-... |
| Gemini API Key | password | Secret | AIzaSy... |
| Discord Webhook - Commands | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - API | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - Heartbeat | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - Alerts | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - Consciousness | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - File Changes | notes | Text | https://discord.com/api/webhooks/... |
| Discord Webhook - Hash Chain | notes | Text | https://discord.com/api/webhooks/... |

## Vercel Setup

### Step 1: Link Vercel Project

```bash
cd web
vercel link
# Follow prompts to link to your Vercel project
```

### Step 2: Set Environment Variables

Use Vercel CLI to set production environment variables:

```bash
# Set for Production environment
vercel env add SUPABASE_URL
# Paste: https://your-project.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste: eyJhbGc... (from 1Password or .env)

vercel env add HELIX_SECRETS_SOURCE
# Paste: 1password
```

### Step 3: Verify Environment

```bash
# List all environment variables
vercel env ls

# The output should show:
# ✓ SUPABASE_URL (Production, Preview, Development)
# ✓ SUPABASE_SERVICE_ROLE_KEY (Production, Preview, Development)
# ✓ HELIX_SECRETS_SOURCE (Production, Preview, Development)
```

## Supabase Setup (Optional - if using Edge Functions)

Supabase Edge Functions can also use 1Password secrets via environment variables.

```bash
# Link Supabase project
supabase link

# Set secrets for Edge Functions
supabase secrets set HELIX_SECRETS_SOURCE=1password
supabase secrets set DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
```

## Helix Core Runtime Setup

### Startup Initialization

The Helix core automatically initializes Discord webhooks during `initializeHelix()`:

```typescript
import { initializeHelix } from '@helix/logging';

// This will:
// 1. Load all environment variables
// 2. If HELIX_SECRETS_SOURCE=1password, load Discord webhooks from 1Password
// 3. Fall back to .env if 1Password is unavailable (development only)
// 4. Validate all required webhooks are configured
await initializeHelix({
  enableFileWatcher: true,
  hashChainInterval: 5 * 60 * 1000,
  enableHeartbeat: true,
  failClosedMode: true, // ALWAYS enabled in production
});
```

### Production Fail-Closed Mode

**CRITICAL**: In production (`NODE_ENV=production`), fail-closed mode is ALWAYS enabled and cannot be disabled. Attempting to disable it will throw:

```
[Helix] SECURITY ERROR: Cannot disable fail-closed mode in production.
This function is for testing only and is not exported in production builds.
```

This ensures:
- All commands are logged to Discord BEFORE execution
- Operations block if Discord is unreachable
- Hash chain integrity is maintained
- No silent failures in production

### Environment Variables for Runtime

```bash
# REQUIRED
NODE_ENV=production
HELIX_SECRETS_SOURCE=1password

# OPTIONAL (with sensible defaults)
OPENCLAW_WORKSPACE=~/.openclaw/workspace
HELIX_HASH_CHAIN_FILE=./hash_chain.log
```

## Local Development Setup

### 1. Authenticate 1Password CLI

```bash
op account add
# This will prompt you to sign in
```

### 2. Create .env.local (for Vercel preview/development)

```bash
# .env.local (NOT COMMITTED)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
HELIX_SECRETS_SOURCE=env  # Use .env fallback for development
```

### 3. Set HELIX_SECRETS_SOURCE

```bash
# Use 1Password for Helix core (recommended)
export HELIX_SECRETS_SOURCE=1password

# OR use .env fallback (development only)
export HELIX_SECRETS_SOURCE=env
```

### 4. Verify Secrets Load

```bash
node -e "
import { verifySecrets } from './src/lib/secrets-loader.ts';
const result = verifySecrets();
console.log(result);
"
```

## Troubleshooting

### 1Password CLI Not Found

```bash
# Install 1Password CLI
brew install 1password-cli  # macOS
# or
choco install 1password-cli  # Windows
# or
apt-get install 1password-cli  # Linux

# Authenticate
op account add
```

### Vault "Helix" Not Found

```bash
# Create the vault in 1Password Desktop app, or
op vault create Helix

# List vaults
op vault list
```

### Secret Not Found

```bash
# List all items in Helix vault
op item list --vault Helix

# Get specific item
op item get "Discord Webhook - Commands" --vault Helix --format=json
```

### Fail-Closed Mode Error in Production

If you see:
```
[Helix] SECURITY ERROR: Cannot disable fail-closed mode in production.
```

This is **expected and correct**. Fail-closed mode is locked in production. To disable for testing:
1. Set `NODE_ENV=development` or `NODE_ENV=test`
2. The function will then work for testing only

## Security Checklist

- [ ] 1Password account created and authenticated (`op whoami` returns your account)
- [ ] "Helix" vault exists in 1Password
- [ ] All required secrets are in the vault
- [ ] Vercel environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HELIX_SECRETS_SOURCE=1password)
- [ ] Local .env files are in .gitignore (✅ already configured)
- [ ] `HELIX_SECRETS_SOURCE=1password` set in production
- [ ] Fail-closed mode is enabled in production (✅ enforced by code)
- [ ] Hash chain is being sent to Discord
- [ ] All tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`

## Rotation Schedule

Rotate secrets on:
- **Quarterly**: Stripe, DeepSeek, Gemini API keys
- **Monthly**: Discord webhook URLs (if compromised)
- **On-demand**: Supabase keys (if user accesses are revoked)

Update 1Password after rotation - production will pick up changes on next deployment.

## References

- [1Password CLI Documentation](https://developer.1password.com/docs/cli)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [Helix Logging Architecture](./HELIX_ARCHITECTURE.md)
