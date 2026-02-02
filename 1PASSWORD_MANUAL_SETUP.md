# 1Password Manual Setup Guide - Web Vault Method

Since direct CLI installation is encountering network issues, here's how to set up 1Password via the web vault (which you're already logged into).

## Quick Summary

Instead of using the CLI installer, we'll:
1. Create a vault in your 1Password web app
2. Add the 13 secrets manually (or export them)
3. Your code loads secrets from 1Password when the CLI becomes available
4. For now, .env fallback keeps everything working securely

## Step 1: Create a Vault in 1Password Web

1. Go to https://my.1password.com/
2. Click "**Vaults**" in the left sidebar
3. Click "**+ New Vault**"
4. Name it: `Helix`
5. Click "**Create**"

## Step 2: Add Secrets to Your Helix Vault

You can either:

### Option A: Add Manually (5 minutes)

In your 1Password web app, for each secret below:
1. Click "+ New Item"
2. Select type (Login/Secure Note)
3. Fill in the details
4. Save to "Helix" vault

**Secrets to Add:**

| Name | Type | Value |
|------|------|-------|
| Supabase Service Role | Login | (copy from .env) |
| Supabase Anon Key | Login | (copy from .env) |
| Stripe Secret Key | Login | (copy from .env) |
| Stripe Publishable Key | Login | (copy from .env) |
| DeepSeek API Key | Login | (copy from .env) |
| Gemini API Key | Login | (copy from .env) |
| Discord Webhook - Commands | Secure Note | (copy from .env) |
| Discord Webhook - API | Secure Note | (copy from .env) |
| Discord Webhook - Heartbeat | Secure Note | (copy from .env) |
| Discord Webhook - Alerts | Secure Note | (copy from .env) |
| Discord Webhook - Consciousness | Secure Note | (copy from .env) |
| Discord Webhook - File Changes | Secure Note | (copy from .env) |
| Discord Webhook - Hash Chain | Secure Note | (copy from .env) |

### Option B: Use 1Password CLI (When Available)

Once you can install the CLI:

```bash
op account add
./scripts/setup-1password.sh
npx ts-node scripts/verify-1password.ts
```

## Step 3: For Now - Use Environment Variable Fallback

Your code is ready to use 1Password when the CLI is available. Until then, the `secrets-loader` module has an automatic fallback to .env:

```typescript
import { loadSecret } from './src/lib/secrets-loader';

// This will try 1Password first, fall back to .env if CLI not available
const secret = await loadSecret('Stripe Secret Key', 'password');
```

## Step 4: Set Fallback Mode

To explicitly use .env fallback for now:

```bash
# Linux/Mac
export HELIX_SECRETS_SOURCE=env

# Windows PowerShell
$env:HELIX_SECRETS_SOURCE = 'env'

# Windows Command Prompt
set HELIX_SECRETS_SOURCE=env
```

Then start your app normally:

```bash
npm run dev
```

## Step 5: Update Your Code for Webhook Initialization

Add this to your app's startup:

```typescript
// main.ts or index.ts
import { initializeDiscordWebhooks } from './src/helix/logging-hooks';

async function main() {
  // Initialize Discord webhooks from 1Password (or .env fallback)
  await initializeDiscordWebhooks();

  // Rest of your app
  console.log('Helix started with webhooks initialized');
}

main().catch(console.error);
```

## Step 6: Test Everything Works

```bash
# Run tests
npm run test

# Start dev server
npm run dev

# Check logs for successful webhook initialization
# Should see: [Helix] Discord webhooks initialized from 1Password
# Or: [Helix] Failed to load webhooks from 1Password, using environment fallback
```

## Security Status

✅ **NOW (Temporary):**
- Secrets in .env (in .gitignore - not committed)
- Code structure ready for 1Password
- All infrastructure in place
- Fail-closed logging still working
- Docker hardened (non-root, no exfiltration tools)
- Gateway binding secure (127.0.0.1 default)

✅ **WHEN CLI AVAILABLE:**
- Just install CLI and run setup scripts
- Everything switches to 1Password automatically
- No code changes needed

## Permanent Solution - Install CLI Later

When you want to install the CLI permanently:

```bash
# Download from GitHub releases or official site
# https://1password.com/downloads/command-line-tools/

# Once installed:
op account add  # Authenticate
.\scripts\setup-1password.sh  # Migrate secrets
npx ts-node scripts/verify-1password.ts  # Verify
```

## If You Can Access GitHub or Alternative Downloads

Try downloading the CLI from:

```bash
# GitHub releases
https://github.com/1Password/1password-teams-open-source/releases

# AUR (Arch Linux)
yay -S 1password-cli

# Homebrew (macOS/Linux)
brew install 1password-cli

# Or contact 1Password support for Windows download alternatives
```

## FAQ

**Q: Is my data secure right now?**
A: Yes. .env is in .gitignore, so secrets never get committed. The code is architecturally ready for 1Password.

**Q: Do I need to change anything?**
A: Just add `await initializeDiscordWebhooks()` to your app startup.

**Q: Will everything work without CLI?**
A: Yes, with automatic .env fallback.

**Q: When I install CLI later, what changes?**
A: Nothing. Just run the setup scripts. Code automatically uses 1Password.

## Next Steps

1. Add `await initializeDiscordWebhooks()` to your app startup
2. Test: `npm run dev`
3. When CLI available: Run setup scripts
4. Everything else is already done! ✅

---

**All security fixes are complete:**
- ✅ Dockerfile hardened (non-root)
- ✅ Gateway binding secure
- ✅ Canvas binding secure
- ✅ Secrets infrastructure ready
- ✅ Logging fail-closed
- ✅ Hash chain verified

**Just waiting on CLI installation for 1Password integration.**
