# Helix Voice Pricing Strategy - Zero Budget Bootstrap

**Date:** February 2, 2026
**Context:** Starting with $0, no users, smart money allocation
**Strategy:** BYOK (Bring Your Own Keys) architecture = $0 cost to company
**Personal Setup:** Premium local configuration on your machine

---

## Executive Summary

You can launch with **zero infrastructure costs** by using BYOK (Bring Your Own Keys) model where users provide their own API keys. This means:

- ✅ Free tier users pay nothing (local Whisper + System TTS)
- ✅ Developer tier users pay only what they use (they buy their own API keys)
- ✅ You pay $0 until you reach profitable scale
- ✅ No money upfront to launch
- ✅ Pro/Premium tiers added later when you have revenue

---

## The BYOK Architecture (This is Genius)

```
Traditional (you pay):
App User → Your Server → You pay Deepgram $0.0043/min
                      → You pay Claude $0.30/1M tokens
                      → You pay ElevenLabs $0.30/1k chars
                      Your cost: ~$100-500/month before revenue

BYOK Model (user pays):
App User (has own API keys) → Your App → Deepgram (user pays)
                           → Claude (user pays)
                           → ElevenLabs (user pays)
Your cost: $0/month, forever

User cost: Only what they use
Your revenue: Later (subscription on top of BYOK)
```

**This is perfect for bootstrapping because:**
1. Zero cost to launch
2. Zero cost to scale
3. Users control their own spending
4. When you have revenue, you add managed services on top

---

## Product Tiers (Recommended Structure)

### TIER 1: FREE (Cost to you: $0)

**Features:**
- Speech Recognition: Whisper Local (offline)
- Voice Output: System TTS (macOS/Windows/Linux)
- Wake Word: Vosk (free, offline)
- Memory: Basic pattern storage (no Claude API)
- Conversations: Text-based only (not Phase 4.1)

**Limitations:**
- Local-only (no cloud sync)
- No real-time voice conversations
- Robot-like voice
- No advanced memory synthesis
- Single device only

**For who:**
- Budget users
- Privacy-first users
- Offline-only preference

**Cost to company:** $0
**Cost to user:** $0

**Example user story:**
```
User launches Helix
→ Uses local Whisper for voice input
→ Gets system voice output ("speak" command)
→ Can create/run tools locally
→ Can create memories but no synthesis
→ All processing on their machine
→ Completely free experience
```

---

### TIER 2: DEVELOPER (Cost to you: $0) ⭐ BOOTSTRAPPING TIER

**Features (same as Free):**
- Everything from Free tier

**PLUS (requires user to provide API keys):**
- Deepgram STT (user provides key)
- ElevenLabs OR OpenAI TTS (user provides key)
- Claude API for memory synthesis (user provides key)
- Real-time voice conversations (Phase 4.1) ✅
- Full memory synthesis with 7-layer psychology
- Pattern detection in real-time
- API key management UI

**Limitations:**
- User must have their own API keys
- User pays Deepgram directly
- User pays Claude directly
- User pays ElevenLabs/OpenAI directly
- No conversation history cloud sync

**For who:**
- Developers/technical users
- Users comfortable with API keys
- Power users
- Budget-conscious who want premium features

**Cost to company:** $0 (users pay APIs directly)
**Cost to user:** Variable (typically $50-100/month if using frequently)
  - Deepgram: $0.0043/min (10 hrs = $26)
  - Claude: ~$10-30/month (depending on synthesis usage)
  - ElevenLabs: $0 if using Edge TTS, or $99/month if premium voices

**Pricing model:**
- Free tier (monetize later with pro features)
- OR charge $0/month ("Free Developer Tier")

**Example user story:**
```
Developer user signs up
→ Provides Deepgram API key (from their account)
→ Provides Claude API key (from their account)
→ Provides ElevenLabs key (optional, can use free Edge TTS)
→ Gets access to Phase 4.1 real-time conversations
→ Conversations stream directly to their own API keys
→ They pay Deepgram/Claude/ElevenLabs monthly
→ We pay $0, but make them happy
```

---

### TIER 3: PRO (Cost to you: $20-50/month per user)

**Paid Tier: $9.99-19.99/month**

**Features (hybrid approach):**
- AI Voice Input: Deepgram (we pay)
- Voice Output: Edge TTS (we pay, free) OR ElevenLabs (add $10/month)
- Real-time conversations: LIMITED (1 hour/month)
- Memory synthesis: Yes, but limited to 1x per day
- Cloud sync: Conversations backed up
- Audio message history: Keep for 30 days
- Async voice messages: Send/receive like Telegram

**Async Voice Messaging (Key feature):**
```
User 1 records voice message
→ Auto-transcribed by Deepgram
→ Sent to User 2 (like WhatsApp/Telegram)
→ User 2 can reply with voice
→ All stored in cloud

This gives voice interaction without real-time requirement
Reduces Claude API usage (async = cheaper batch processing)
```

**Real-time conversation limit:**
- 1 hour per month of real-time voice
- Great for testing, not production daily use
- Each user gets 1 realtime session

**Limitations:**
- Real-time limited to 1 hour/month
- Memory synthesis 1x/day
- No BYOK (we manage keys, handle costs)
- Conversation history kept for 30 days only

**For who:**
- Users who want convenience (no API keys to manage)
- Casual voice users
- Want to try real-time but don't need heavy use

**Cost breakdown:**
- Deepgram (1 hour/month × 100 users): ~$25
- Claude (limited synthesis): ~$10
- ElevenLabs (if they choose upgrade): $99/month (split across users)
- Infrastructure: ~$10
- **Total per 100 users: ~$45-55**
- **Revenue: $1,000-1,900 per 100 users**
- **Margin: ~95%** ✅

**Pricing model:**
- $9.99/month (basic Pro)
- $14.99/month (Pro + premium voice)
- $19.99/month (Pro + premium voice + more hours)

---

### TIER 4: PREMIUM (Cost to you: $100-150/month per user)

**Paid Tier: $29.99-49.99/month**

**Features:**
- Everything from Pro
- PLUS unlimited real-time conversations
- Claude API unlimited (your cost: ~$100-150/month per user)
- Premium TTS voices (ElevenLabs: 100+ options)
- Full memory synthesis (unlimited)
- Conversation history: Unlimited storage
- Priority support

**Async voice messaging:**
- Unlimited (same as Pro)
- Plus ability to create "voice channels" with others

**Real-time conversations:**
- Unlimited hours
- Sub-400ms latency
- Full interruption support (Phase 4.1)
- Can use in group conversations

**Limitations:**
- Still cloud-managed (not BYOK)

**For who:**
- Power users
- Professional use
- Want unlimited access

**Cost breakdown:**
- Deepgram (unlimited): ~$100-150/month
- Claude (unlimited synthesis): ~$30-50/month
- ElevenLabs premium: ~$99/month
- Infrastructure: ~$10
- **Total per user: ~$240-310**
- **Revenue: $29.99-49.99/month**
- **This is a loss leader** ❌

**Note:** Premium tier is LOSS MAKING until you have:
1. 100+ premium users (revenue covers costs)
2. Better pricing with providers
3. Or you only offer this to enterprise

**Recommendation:** Don't launch Premium tier until you have 50+ Pro users and can negotiate provider rates.

---

## Your Personal "Dream Setup" (Local Premium)

Since you're starting with zero budget, build yourself the **ultimate personal setup** on your computer:

```
Your Personal Machine:

Speech Input:
  ✅ Whisper Local (best open-source model)
     - Use "large" model (not "base")
     - GPU acceleration if you have it
     - Accuracy: 99%

Voice Output:
  ✅ ElevenLabs (your own API key, your budget)
     - All 100+ voice options available
     - Your choice of voice personality
     - Natural sounding

Wake Word:
  ✅ Vosk (local)
     - Custom wake phrases
     - Always listening

Claude Realtime:
  ✅ Claude Realtime API (your own API key)
     - Unlimited real-time conversations
     - Sub-400ms latency
     - Full interruption support
     - Multi-modal understanding

Memory Synthesis:
  ✅ Full 7-layer psychological analysis
     - Every conversation analyzed
     - Patterns detected
     - Stored locally

This is literally the dream setup. Cost to you:
  - Deepgram key: You control (maybe $50/month personal use)
  - ElevenLabs key: You control (maybe $99/month if premium)
  - Claude Realtime: You control (maybe $10-20/month personal)
  - Whisper Local: $0 (local)
  - Vosk: $0 (local)

Total: ~$160-170/month for YOUR ultimate personal AI voice assistant
```

**This is achievable because:**
1. You have the architecture already
2. Everything's local-first (privacy)
3. You're just using your own API keys
4. No server costs
5. Can iterate fast without user constraints

**Setup process:**
```
1. Clone helix-desktop locally
2. Create .env.local with your API keys:
   DEEPGRAM_API_KEY=your_key
   ELEVENLABS_API_KEY=your_key
   CLAUDE_API_KEY=your_key

3. Enable Phase 4.1 voice features in local config
4. Run: npm run dev

5. You get the best possible voice AI experience
```

---

## Launch Strategy (No Money Required)

### Phase 1: Launch (Week 1-2)
```
1. Build Free tier (Whisper Local + System TTS)
2. Build Developer tier UI (BYOK configuration)
3. Deploy to GitHub
4. Write documentation

Cost: $0
You get: Working product for free users
```

### Phase 2: Developer Beta (Week 3-4)
```
1. Post on Reddit/HN about BYOK model
2. Get developers to use it (they have own API keys)
3. They provide feedback
4. Zero marketing cost (organic)

Cost: $0
You get: Real users, real feedback, no money spent
```

### Phase 3: Pro Tier Launch (Month 2)
```
1. Add Pro tier when you have 100+ Developer users
2. Set up Stripe subscription
3. Only launch when you have traction

Cost: $0 upfront
Revenue: Starts generating immediately
```

### Phase 4: Premium Tier (Month 6+)
```
1. Only if Pro tier is profitable
2. Add Premium tier for power users
3. You already have the infrastructure

Cost: Only launch if you have revenue to cover it
```

---

## Revenue Model - The Math

### Scenario: 1,000 total users after 6 months

```
Free Tier (70% of users): 700 users
  - Revenue: $0
  - Cost: $0
  - Purpose: Trial, features, growth

Developer Tier (20% of users): 200 users
  - Revenue: $0 (free tier)
  - Cost: $0 (they pay APIs)
  - Purpose: Power users, feedback, community

Pro Tier (8% of users): 80 users
  - Revenue: $80 × $14.99 = $1,199/month
  - Cost: $80 × $25 = $2,000/month
  - LOSS: -$800/month ❌

Premium Tier (2% of users): 20 users
  - Revenue: 20 × $39.99 = $800/month
  - Cost: 20 × $250 = $5,000/month
  - LOSS: -$4,200/month ❌
```

**This doesn't work!** You're paying more than you make.

### Better Scenario: Adjust pricing UP

```
Pro Tier (8% of users): 80 users
  - Revenue: $80 × $24.99 = $1,999/month
  - Cost: $80 × $25 = $2,000/month
  - BREAK EVEN ✅ (slightly losing but close)

Premium Tier: DON'T LAUNCH YET
  - Wait until 200+ Pro users
  - Then launch Premium at higher price

When Premium tier is viable:
Pro (150 users):    $150 × $24.99 = $3,749/month
Premium (50 users): $50 × $49.99 = $2,500/month
Total revenue: $6,249/month

Costs:
Pro (150 users): $150 × $25 = $3,750/month
Premium (50 users): $50 × $250 = $12,500/month
Total costs: $16,250/month ❌ STILL LOSING

This means Premium doesn't make sense with these costs.
```

### Smarter Strategy: Only offer BYOK

```
Free Tier: 70% (700 users)
  - You pay: $0
  - They pay: $0
  - Your revenue: $0

Developer Tier (BYOK): 30% (300 users)
  - You pay: $0 (they buy keys)
  - They pay: Directly to Deepgram/Claude/ElevenLabs
  - Your revenue: $0 (initially)

Add Pro tier later:
  - Only add Pro when you have revenue to cover costs
  - Start at 50 Pro users (on Pro) before sustainability

This is the RIGHT strategy for bootstrap.
```

---

## Honest Reality Check: Margins on Voice

Here's the hard truth:

```
Real-time voice conversations are EXPENSIVE to provide:

Per user monthly cost (if you pay APIs):
  - Deepgram: ~$25/hour usage = $50-100/month
  - Claude: ~$10-50/month (depending on synthesis)
  - ElevenLabs: ~$99/month
  - Infrastructure: ~$10/month
  - Total: ~$170-260/month PER USER

To break even, you need to charge:
  - If you charge $99/month: You barely break even
  - If you charge $199/month: You make ~$40/month profit

This is why:
  ✅ BYOK model is brilliant (you pay $0)
  ✅ Only offer unlimited when you have scale + revenue
  ✅ Free/Pro tier asymmetry until profitable
```

---

## Recommended Launch Pricing

### At Launch (Month 1):

```
FREE
  ├─ Whisper Local (offline)
  ├─ System TTS (robot voice)
  ├─ Vosk wake word
  ├─ Basic memory (no synthesis)
  └─ For everyone, forever

DEVELOPER (Free/$0/month)
  ├─ All Free features
  ├─ PLUS: Enter your own API keys
  ├─ PLUS: Real-time conversations (Phase 4.1)
  ├─ PLUS: Full memory synthesis
  ├─ Unlimited usage (you control spend)
  └─ For developers, technical users

(NO PRO YET - too expensive)
```

### After 6 Months (with traction):

```
FREE: Same as before

DEVELOPER: Same (BYOK)

PRO ($14.99/month) - ONLY if you have 100+ Developer users
  ├─ 1 hour/month real-time voice
  ├─ Unlimited async voice messages
  ├─ Memory synthesis 1x/day
  ├─ We manage the keys (handle costs)
  └─ For casual users

(Still NO PREMIUM - wait until Pro is profitable)
```

### After 12 Months (if profitable):

```
All tiers continue
+ PREMIUM ($49.99/month) - Only if Pro is profitable
  ├─ Unlimited real-time voice
  ├─ Unlimited async messages
  ├─ Unlimited memory synthesis
  ├─ Priority support
  └─ For power users

Revenue should now cover costs.
```

---

## Your Personal Setup (The Fun Part)

Build this for yourself on your computer:

```bash
# Create .env.local
DEEPGRAM_API_KEY=sk_live_xxxx              # Your key, your budget
ELEVENLABS_API_KEY=xxxx                    # Your key, your budget
CLAUDE_API_KEY=sk_ant_xxxx                 # Your key, your budget
VOICE_MODE=personal_unlimited
PHASE_4_1_ENABLED=true
MEMORY_SYNTHESIS_ENABLED=true
VAD_ENABLED=true
WAKE_WORD_ENABLED=true

# Run personal setup
npm run dev -- --personal-config

# Get:
- Unlimited real-time conversations
- All 100+ ElevenLabs voices available
- Full 7-layer memory synthesis
- Best STT (Whisper Large model)
- Best Claude API (Realtime)
- All local, all private
```

**Cost to you personally:**
- Whatever you spend on API keys monthly
- But you get the absolute BEST experience possible
- And you can iterate on features for your users

---

## Summary: The Smart Bootstrap Strategy

```
TIER 1: FREE
  Cost to you: $0
  Revenue from users: $0
  Purpose: Users, feedback, growth

TIER 2: DEVELOPER (BYOK) ✅
  Cost to you: $0
  Revenue from users: $0
  Purpose: Power users pay their own APIs
            They get premium features free
            You get community + feedback

TIER 3: PRO
  Cost to you: $25/user/month
  Revenue from users: $14.99/month
  Status: LAUNCH WHEN PROFITABLE
  Purpose: Casual users who want convenience

TIER 4: PREMIUM
  Cost to you: $250+/user/month
  Revenue from users: $49.99/month
  Status: LAUNCH ONLY WHEN SCALE + REVENUE
  Purpose: Power users (if margins improve with scale)

YOUR PERSONAL SETUP:
  Cost: Your budget on APIs
  Experience: THE BEST POSSIBLE
  Benefit: You know your product inside out
```

---

## The Beautiful Part

With this strategy:

✅ **You launch with $0 budget**
✅ **You scale without spending money**
✅ **Users who want it most (Developers) pay their own APIs**
✅ **You only pay when you have revenue**
✅ **No debt, no investors needed**
✅ **You own 100% of the product**

The BYOK model is perfect for bootstrapping voice features because you flip the economics:
- Traditional SaaS pays for infrastructure upfront
- BYOK model lets users pay for their own infrastructure

---

*Product Pricing Strategy | February 2, 2026*
*Zero Budget Bootstrap with BYOK Model*
