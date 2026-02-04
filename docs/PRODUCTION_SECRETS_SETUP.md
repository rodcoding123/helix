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

| Item Name                       | Field    | Type   | Example Value                        |
| ------------------------------- | -------- | ------ | ------------------------------------ |
| Supabase URL                    | url      | URL    | https://xxxxx.supabase.co            |
| Supabase Service Role           | password | Secret | eyJhbGc...                           |
| Supabase Anon Key               | password | Secret | eyJhbGc...                           |
| Stripe Secret Key               | password | Secret | sk*live*...                          |
| Stripe Publishable Key          | password | Secret | pk*live*...                          |
| DeepSeek API Key                | password | Secret | sk-...                               |
| Gemini API Key                  | password | Secret | AIzaSy...                            |
| Anthropic API Key               | password | Secret | sk-ant-...                           |
| Deepgram API Key                | password | Secret | (Deepgram key format)                |
| ElevenLabs API Key              | password | Secret | (ElevenLabs key format)              |
| Discord Webhook - Commands      | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - API           | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - Heartbeat     | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - Alerts        | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - Consciousness | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - File Changes  | notes    | Text   | (Discord webhook URL)                |
| Discord Webhook - Hash Chain    | notes    | Text   | (Discord webhook URL)                |

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

## Phase 3: Provider API Keys Setup

Phase 3 introduces integration with multiple AI providers for specialized operations. Each provider requires an API key obtained from their respective platform.

### Anthropic Claude API

**Purpose**: Agent Execution and Email Analysis operations

**Setup Steps**:

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign in with your Anthropic account (create one if needed)
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the generated key (format: `sk-ant-[alphanumeric]`)
6. Add to 1Password vault as "Anthropic API Key"

**Environment Variable**: `ANTHROPIC_API_KEY`

**Testing**:
```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-1",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

### Google Generative AI (Gemini 2.0)

**Purpose**: Video Understanding operation

**Setup Steps**:

1. Go to [https://aistudio.google.com/](https://aistudio.google.com/)
2. Click **Get API Key** (top left)
3. Create a new project if needed
4. Click **Create API Key in new project**
5. Copy the generated key (format: `AIza[alphanumeric]`)
6. Add to 1Password vault as "Gemini API Key" (or separate from Phase 1 Gemini if using different models)

**Environment Variable**: `GOOGLE_API_KEY`

**Important Notes**:
- Google Gemini API provides free tier with rate limits
- For production, enable billing in Google Cloud Console
- Video Understanding uses Gemini 2.0 vision capabilities

**Testing**:
```bash
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Describe this image"}]}]
  }' \
  -H "x-goog-api-key: $GOOGLE_API_KEY"
```

### Deepgram API

**Purpose**: Audio Transcription operation

**Setup Steps**:

1. Go to [https://console.deepgram.com/](https://console.deepgram.com/)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create a New API Key**
5. Select scope: **Scopes** → Check "Usage" and "All" for full access
6. Copy the key
7. Add to 1Password vault as "Deepgram API Key"

**Environment Variable**: `DEEPGRAM_API_KEY`

**Important Notes**:
- Deepgram offers a free tier: 50,000 minutes/month of transcription
- Production usage requires payment method on file
- Supports 99+ languages and accents
- Real-time and batch transcription available

**Testing**:
```bash
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/audio.mp3"}'
```

### ElevenLabs API

**Purpose**: Text-to-Speech operation

**Setup Steps**:

1. Go to [https://elevenlabs.io/](https://elevenlabs.io/)
2. Sign up or log in
3. Go to **Account** → **Account Settings**
4. Scroll to **API Key** section
5. Click **Get API Key** or copy your existing key
6. Add to 1Password vault as "ElevenLabs API Key"

**Environment Variable**: `ELEVENLABS_API_KEY`

**Important Notes**:
- ElevenLabs offers a **free tier**: 10,000 characters/month
- Production usage requires subscription ($5-99/month depending on volume)
- 32 AI voices available with natural prosody
- Supports 29 languages
- Low latency (< 500ms for streaming)

**Testing**:
```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/default \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "model_id": "eleven_monolingual_v1"
  }' \
  --output audio.mp3
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
