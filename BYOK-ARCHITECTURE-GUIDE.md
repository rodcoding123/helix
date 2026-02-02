# BYOK Architecture Guide - Zero-Cost Infrastructure

**Date:** February 2, 2026
**Purpose:** How BYOK (Bring Your Own Keys) makes bootstrapping viable
**Status:** Perfect for your zero-budget situation

---

## What is BYOK?

```
Traditional Architecture:
┌─────────────────────────────────────────────────────┐
│ User (no API keys needed)                           │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ Your Server (Helix)                                 │
│ • Stores API keys                                   │
│ • Makes API calls                                   │
│ • YOU PAY THE COSTS                                 │
│ • Cost: $50-500/month                               │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ↓           ↓           ↓
    Deepgram    Claude API   ElevenLabs
    ($$$)       ($$$)        ($$$)


BYOK Architecture (Bring Your Own Keys):
┌─────────────────────────────────────────────────────┐
│ User (provides their own API keys)                  │
│ • Has Deepgram account → provides key              │
│ • Has OpenAI account → provides key                │
│ • Has ElevenLabs account → provides key            │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ Your Server (Helix)                                 │
│ • Stores encrypted API keys (user-owned)            │
│ • Routes calls through keys                         │
│ • YOU PAY NOTHING                                   │
│ • Cost: $0/month                                    │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ↓           ↓           ↓
    Deepgram    Claude API   ElevenLabs
    (user pays) (user pays)  (user pays)
```

**The magic:** Users pay the APIs directly, you pay nothing.

---

## How BYOK Works in Helix

### Step 1: User Sets Up API Keys

**In UI (Developer Tier Setup Page):**

```
┌─────────────────────────────────────────┐
│  DEVELOPER TIER SETUP                   │
├─────────────────────────────────────────┤
│                                         │
│ Speech Recognition Provider             │
│ ○ Whisper Local (free, offline)        │
│ ● Deepgram (requires API key)           │
│                                         │
│ Deepgram API Key:                       │
│ [sk_live_________________] 🔒 encrypted│
│                                         │
│ Text-to-Speech Provider                 │
│ ○ System TTS (free, robot)             │
│ ○ Edge TTS (free, natural)             │
│ ● ElevenLabs (requires API key)        │
│                                         │
│ ElevenLabs API Key:                    │
│ [xi_________________] 🔒 encrypted     │
│                                         │
│ Claude Integration                      │
│ ● Enable Memory Synthesis               │
│ Claude API Key:                         │
│ [sk-ant-________________] 🔒 encrypted │
│                                         │
│ [✓ Save & Encrypt Keys]                │
│                                         │
└─────────────────────────────────────────┘
```

### Step 2: Keys Are Encrypted & Stored Locally

**Backend (helix-runtime/src/services/key-management.ts):**

```typescript
async function storeUserApiKeys(userId: string, keys: ApiKeys) {
  // Encrypt keys with user's password
  const encrypted = encryptKeys(keys, userPassword);

  // Store in database (encrypted, user can't see)
  await db.userSettings.update(userId, {
    encryptedApiKeys: encrypted,
    keyProvider: 'user_supplied',
  });
}

// When making API calls:
async function callDeepgram(userId: string, audio: Buffer) {
  // Get encrypted keys
  const encrypted = await db.userSettings.get(userId, 'encryptedApiKeys');

  // Decrypt (only possible with user's password)
  const keys = decryptKeys(encrypted, userPassword);

  // Use their key for their API call
  const response = await fetch('https://api.deepgram.com/v1/listen', {
    headers: {
      'Authorization': `Token ${keys.deepgramKey}`,
    },
    body: audio,
  });

  return response;
}
```

### Step 3: Billing is Transparent

**User sees:**
```
Deepgram Usage: 2.5 hours this month
  Cost: 2.5 × $0.0043/min = $6.45
  Charged to: YOUR Deepgram account
  You can see: Login to Deepgram dashboard

Claude API Usage: 50,000 tokens this month
  Cost: 50,000 × $0.30/1M = $0.015
  Charged to: YOUR OpenAI account
  You can see: Login to OpenAI dashboard
```

**The key:** Users see exact usage and can control it by managing their own API keys.

---

## BYOK Implementation Checklist

### Backend (helix-runtime)

```typescript
// 1. Key Management Service
src/services/encryption.ts
  ├─ encryptKey(key: string, userPassword: string): string
  ├─ decryptKey(encrypted: string, userPassword: string): string
  └─ rotateKey(oldKey: string): string

// 2. API Integration Layer
src/gateway/services/api-proxy.ts
  ├─ proxyDeepgramCall(userId: string, request: Request)
  ├─ proxyClaudeCall(userId: string, messages: Message[])
  ├─ proxyElevenLabsCall(userId: string, text: string)
  └─ proxyOpenAICall(userId: string, text: string)

// 3. Database Schema
src/database/migrations/user_api_keys.sql
  CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,    -- "deepgram", "claude", "elevenlabs"
    encrypted_key TEXT NOT NULL,
    key_rotated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
  );

// 4. Gateway RPC Method
src/gateway/server-methods/byok.ts
  ├─ byok.setApiKey(provider: string, key: string)
  ├─ byok.getApiKeyStatus(provider: string)
  ├─ byok.validateApiKey(provider: string, key: string)
  └─ byok.rotateApiKey(provider: string)
```

### Frontend (helix-desktop)

```typescript
// 1. Settings Component
src/components/settings/ApiKeyManager.tsx
  ├─ ApiKeyInput (encrypted input field)
  ├─ ProviderSelector
  ├─ ValidateButton
  └─ DeleteButton

// 2. Configuration UI
src/pages/Settings.tsx
  ├─ ShowDeveloperTierSetup()
  ├─ ApiKeyManager component
  ├─ ProviderStatus (which are configured)
  └─ UsageEstimate (show what you'll pay)

// 3. Hook for BYOK
src/hooks/useByokConfig.ts
  ├─ useByokConfig(): {
  │   deepgram: { configured: boolean, lastValidated: Date }
  │   claude: { configured: boolean, lastValidated: Date }
  │   elevenlabs: { configured: boolean, lastValidated: Date }
  │ }
  └─ async validateKey(provider, key)
```

---

## BYOK for Different Tiers

### FREE TIER (No API keys needed)

```
Uses only:
  - Whisper Local (offline, no key)
  - System TTS (offline, no key)
  - Vosk (offline, no key)

No API key configuration page needed.
```

### DEVELOPER TIER (BYOK Required)

```
Users must provide:
  - Deepgram API key (for real-time STT)
  - Claude API key (for memory synthesis + conversations)
  - ElevenLabs OR OpenAI key (for TTS, optional if using Edge)

Setup flow:
1. User signs up for Developer tier
2. Gets directed to API Key Manager page
3. Provided links to sign up for each service
4. Pastes keys into UI
5. We validate each key works
6. User is ready to use Phase 4.1

Cost to company: $0
Cost to user: Direct to providers
```

### PRO TIER (No API keys, we manage)

```
Users DON'T provide keys.
We provide managed access to APIs.

Implementation:
  - We have master API keys
  - We meter usage per user
  - We include costs in Pro subscription
  - We handle rate limiting, failover, etc.

This tier has actual costs to us.
```

---

## Your Personal Setup (The Dream Config)

You can build the ultimate setup on your own computer:

```bash
# Create helix-desktop/.env.local

# For your personal use (not shared):
VITE_PERSONAL_MODE=true
VITE_PERSONAL_API_KEYS_ENABLED=true

# Your API keys (stored locally, never sent to server)
LOCAL_DEEPGRAM_KEY=sk_live_xxxxxxxxxxxx
LOCAL_CLAUDE_KEY=sk-ant-xxxxxxxxxxxxxx
LOCAL_ELEVENLABS_KEY=xxxxxxxxxxxxx

# Your preferences
LOCAL_VOICE_MODE=unlimited          # No throttling
LOCAL_MEMORY_MODE=full_synthesis    # All 7 layers
LOCAL_REALTIME_MODE=enabled         # Phase 4.1 full speed
LOCAL_WHISPER_MODEL=large           # Best accuracy
LOCAL_ELEVENLABS_VOICE=rachel       # Your voice choice

# GPU acceleration
LOCAL_WHISPER_DEVICE=cuda           # If you have NVIDIA
LOCAL_WHISPER_DEVICE=mps            # If you have Apple Silicon
```

**Run locally:**
```bash
npm run dev -- --personal-mode

# This gives you:
✅ Unlimited real-time conversations
✅ All 100+ ElevenLabs voices available
✅ Whisper Large model (best accuracy)
✅ Full 7-layer memory synthesis every conversation
✅ No cloud dependency (local Whisper can work offline)
✅ No throttling or limits
✅ Everything runs on your machine
✅ Complete privacy
```

**Your cost:**
- Whatever you spend on API keys
- But you get to experience the product as intended
- You know exactly how users will experience it
- You can test features before shipping

---

## Security Considerations for BYOK

### Key Encryption

```typescript
// Keys are encrypted at rest
// Only decrypted when needed for API calls

const encryptionConfig = {
  algorithm: 'aes-256-gcm',    // Military grade
  keyDerivation: 'argon2',      // Password hashing
  iv: randomBytes(16),
  authTag: true,                // Detect tampering
}

// Keys are NEVER logged
// Keys are NEVER sent to our servers
// Keys are NEVER visible in plaintext
```

### Trust Model

```
With BYOK:
✅ User controls their API keys
✅ User controls their spending
✅ User controls data flow
✅ We can't see sensitive data
✅ We can't abuse their keys
✅ User can rotate keys anytime
✅ User can revoke access instantly
```

### Transparency

```
User always knows:
✅ Which APIs are being called
✅ How much data is sent
✅ What they'll be charged
✅ Can see usage in their provider dashboard
✅ Can rate-limit anytime
✅ Can switch providers anytime
```

---

## Marketing Advantage of BYOK

This is a HUGE selling point:

```
Competitive positioning:
┌─────────────────────────────────────────────┐
│ Other AI Apps (Traditional)                 │
├─────────────────────────────────────────────┤
│ "Pay us $99/month for voice"                │
│ • We handle all costs                       │
│ • You trust us with data                    │
│ • Limited to our provider choices           │
│ • No visibility into usage                  │
└─────────────────────────────────────────────┘

vs.

┌─────────────────────────────────────────────┐
│ Helix (BYOK Model)                          │
├─────────────────────────────────────────────┤
│ "Use voice for FREE (just add your keys)"  │
│ • Complete transparency                     │
│ • You control spending                      │
│ • Use any provider you want                 │
│ • See all your data/usage                   │
│ • No vendor lock-in                         │
│ • Advanced users get unlimited for free     │
│ • Pay us only if you want convenience       │
└─────────────────────────────────────────────┘
```

Your marketing message:
```
"Helix Developer Tier is completely free.
 Just bring your own API keys from Deepgram,
 Claude, or ElevenLabs and you get unlimited
 real-time voice conversations with full control
 over your data and spending."
```

This appeals to:
- Developers (technical, control-oriented)
- Privacy-conscious users
- Power users (want to control their infrastructure)
- Budget-conscious (pay exactly what they use)

---

## Implementation Path (No Money Required)

### Phase 1: Free Tier (Week 1-2)
```
1. Whisper Local + System TTS
2. Basic memory storage
3. Deploy and test
```

### Phase 2: BYOK Setup (Week 3-4)
```
1. Build key management UI
2. Encrypt/decrypt infrastructure
3. Proxy API calls through user keys
4. Validation endpoints

Cost to build: Just engineering time
Cost to run: $0 (no APIs called by us)
```

### Phase 3: Launch Developer Tier (Week 5)
```
1. Add Developer tier option
2. Onboarding flow for BYOK keys
3. Documentation
4. GitHub release

Cost to launch: $0
Revenue from users: $0 (but we cost them $0 too)
```

### Phase 4: Iterate & Grow (Month 2+)
```
1. Get feedback from Developer users
2. They tell you which providers work best
3. They tellyou which features matter most
4. You iterate based on their needs
5. Zero infrastructure cost while you figure it out
```

### Phase 5: Pro Tier (When Profitable)
```
1. Add managed API option
2. Only when you have Developer tier revenue/users
3. Or only if you have external funding
```

---

## The Beautiful Economics

```
Helix BYOK Model:
┌──────────────────────────────────────┐
│ 1,000 Users (1 year later)           │
├──────────────────────────────────────┤
│ Free Tier (700 users)                │
│   Your cost: $0                      │
│   Revenue: $0                        │
│   Purpose: Acquisition               │
│                                      │
│ Developer Tier (300 users) ✅         │
│   Your cost: $0                      │
│   Revenue: $0 (or $5/mo for premium) │
│   Their cost: $50-200/mo each        │
│   They're happy: pay for what they   │
│   use, full control, unlimited       │
│                                      │
│ TOTAL COMPANY ECONOMICS:             │
│   Cost: $0/month to run              │
│   Revenue: $0/month                  │
│   Can continue running indefinitely  │
│   without spending money             │
│                                      │
│ When ready for Pro tier:             │
│   Add 50 Pro users at $20/month      │
│   Revenue: $1,000/month              │
│   Cost: ~$1,000/month (break-even)   │
│   Now you know you're viable         │
│                                      │
│ When you have revenue/funding:       │
│   Add Premium tier for power users   │
│   Scale infrastructure              │
│   Grow with confidence              │
└──────────────────────────────────────┘
```

---

## Why This Works for You

✅ **Zero upfront costs** - BYOK means you pay $0 to launch
✅ **Zero ongoing costs** - No monthly infrastructure bills
✅ **Real traction** - Developer users are power users
✅ **Better feedback** - They know what they want
✅ **Less support** - Developers solve their own problems
✅ **Product-market fit** - You'll find it while paying $0
✅ **Smart money** - When you get funding, you know exactly what to build
✅ **No debt** - You own the entire product
✅ **Personal setup** - Build yourself the ultimate voice AI on your computer

---

## Next Steps

1. **Design BYOK key management UI** - Figure out the flow
2. **Build encryption layer** - Secure key storage
3. **Create API proxy service** - Route calls through user keys
4. **Add Developer tier onboarding** - Make it easy to set up
5. **Build your personal dream setup** - So you know the experience

Then launch with:
- Free tier: Everyone
- Developer tier: Anyone with API keys

Zero dollars spent, zero dollars revenue needed initially.

---

*BYOK Architecture Guide | February 2, 2026*
*The Secret to Free, Scalable Voice Infrastructure*
