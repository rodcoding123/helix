# Voice Features Cost Analysis

**Date:** February 2, 2026
**Purpose:** Complete breakdown of voice infrastructure costs
**Bottom Line:** Can be FREE with excellent quality, or $0-500+/month depending on choices

---

## Executive Summary

| Scenario | Cost | Quality | Latency |
|----------|------|---------|---------|
| **Budget (All Free)** | $0/month | Good | Acceptable |
| **Balanced (Mixed)** | $10-50/month | Excellent | Fast |
| **Premium (Best-in-class)** | $200-500+/month | Premium | Sub-400ms |

---

## 1. SPEECH-TO-TEXT (STT) Costs

### Option 1: Whisper Local (FREE) ✅ Recommended
```
Cost: $0
What you need:
  - GPU or CPU (runs locally on user's machine)
  - 1-2GB disk space for model

Pricing: Completely free, no API calls

Quality: Very good (OpenAI's model)
Accuracy: 95%+ for clear audio
Latency: 2-5 seconds (depends on CPU)

Trade-offs:
  + No recurring costs
  + Works offline
  + No rate limits
  - Slower on old computers
  - Requires local model download
```

### Option 2: Whisper API (PAID - $0.02/min)
```
Cost: $0.02 per minute of audio

Example usage:
  - 1 hour/day conversations = $36/month
  - 10 hours/day = $360/month

Quality: Excellent (same model as local, but cloud)
Accuracy: 95%+
Latency: 5-10 seconds

Trade-offs:
  + Better accuracy on edge cases
  + No local processing
  - API costs add up
  - Requires internet
  - Privacy: audio sent to OpenAI
```

### Option 3: Deepgram (PAID - $0.0043/min)
```
Cost: $0.0043 per minute (streaming)

Example usage:
  - 1 hour/day = $7.74/month
  - 10 hours/day = $77/month

Quality: Excellent
Accuracy: 95%+
Latency: 300-800ms (real-time streaming)

Trade-offs:
  + Cheapest cloud option
  + Real-time streaming (best for Phase 4.1)
  + Low latency
  - Requires API key
  - Internet dependent
```

### Option 4: AssemblyAI (PAID - $0.0001/min equivalent)
```
Cost: ~$13/hour transcription (async)

Example:
  - 100 hours/month = $1,300/month
  - 10 hours/month = $130/month

Quality: Excellent (highest accuracy)
Accuracy: 99%+
Latency: High (async, not real-time)

Trade-offs:
  + Most accurate
  - Most expensive
  - Async only (not good for real-time conversation)
  - Not suitable for Phase 4.1
```

---

## 2. TEXT-TO-SPEECH (TTS) Costs

### Option 1: System TTS (FREE) ✅ Best Value
```
Cost: $0
Built-in to:
  - macOS: "say" command
  - Windows: SAPI (PowerShell)
  - Linux: espeak

Quality: Basic (robot-like but acceptable)
Latency: Very fast (50-200ms)

Trade-offs:
  + Completely free
  + Very fast
  + Works offline
  - Sounds less natural
  - Limited voice options
  + Sufficient for many use cases
```

### Option 2: Edge TTS (FREE) ✅ Great Alternative
```
Cost: $0 (Microsoft Azure free tier)
"Neural voices" from Microsoft
  - 200+ voice options
  - Natural sounding
  - Rate/pitch control

Quality: Good (natural sounding)
Latency: 500ms-2s

Trade-offs:
  + Completely free
  + Many voice options
  + Sounds natural
  - Slightly slower than system TTS
  - Requires internet (most of the time)
```

### Option 3: OpenAI TTS (PAID - $0.015/1k chars)
```
Cost: $0.015 per 1,000 characters

Example usage:
  - 10,000 chars/day = $450/month
  - 1,000 chars/day = $45/month
  - Typical response = 1,000 chars = $0.015

Quality: Excellent (natural, multiple voices)
Latency: 1-3 seconds

Trade-offs:
  + High quality voices
  + 6 voice options (alloy, echo, fable, onyx, nova, shimmer)
  + Speed control
  - Per-character pricing adds up with long conversations
  - Medium cost
```

### Option 4: ElevenLabs (PAID - $0.30/1k chars)
```
Cost: $0.30 per 1,000 characters (or subscription)

Subscription tiers:
  - Starter: $5/month (10k chars)
  - Professional: $99/month (1M chars)
  - Scale: $990/month (10M chars)

Quality: Premium (most natural voices)
Latency: 500ms-2s
Voices: 100+ options

Trade-offs:
  + Most natural sounding voices
  + Highest quality
  + Good for premium experience
  - Most expensive per-character
  - Subscription model makes sense for regular use
```

---

## 3. Claude Realtime API (Phase 4.1 Core)

### Claude Realtime API Pricing (PAID)
```
Model: claude-3-5-sonnet (Realtime)

Pricing:
  Input (audio):  $0.30 per 1M input tokens
  Output (audio): $1.20 per 1M output tokens

What is a token for audio?
  - ~1 token per 100ms of audio
  - Typical 5-second user message = ~50 tokens
  - Typical 3-second Claude response = ~30 tokens

Example conversation:
  1 exchange (user speaks 5s, Claude responds 3s):
    Input: 50 tokens × $0.30/1M = $0.000015
    Output: 30 tokens × $1.20/1M = $0.000036
    Total per exchange: ~$0.00005

  100 exchanges/day = $0.005/day = $0.15/month (negligible)
  1000 exchanges/day = $0.05/day = $1.50/month (still cheap)

Quality: Excellent (state-of-the-art AI)
Latency: <400ms (key for Phase 4.1)

Trade-offs:
  + Very cheap for audio
  + Excellent conversational ability
  + Interruption support
  + Multi-modal understanding
  - Requires internet
  - Depends on OpenAI availability
```

**Key Insight:** Claude Realtime API is cheap because it's priced on tokens, and audio doesn't use many tokens compared to text.

---

## 4. Wake Word Detection Costs

### Option 1: Vosk (FREE) ✅ Best
```
Cost: $0
Open-source wake word detector
Runs locally on device

Quality: Good
Accuracy: ~85-90%

Trade-offs:
  + Completely free
  + Open source
  + Works offline
  - Slightly lower accuracy than commercial
  - Requires model download (~50MB)
```

### Option 2: Porcupine (PAID - ~$0-99)
```
Cost: $0 free tier, commercial pricing on request

Quality: Excellent
Accuracy: >95%

Trade-offs:
  + Very high accuracy
  - Commercial licensing required
  - Not ideal for personal projects
```

---

## 5. Infrastructure & Hosting Costs

### Desktop Application (Helix Desktop)
```
Cost: $0 (no recurring server costs)

Architecture:
  - App runs on user's machine (no server)
  - helix-runtime runs locally
  - Local audio processing
  - Only API calls to external services
  - No hosting needed
```

### Optional: Cloud Backend (if you add it later)
```
Minimal recommended:
  - Server: $20-50/month (small VPS)
  - Database: $15-30/month (managed DB)
  - CDN/Storage: $10-20/month (if serving audio)
  Total: ~$50-100/month (optional)
```

---

## 6. Telephony Costs (Optional - for voice calls)

### If you add voice calling (Phase 4.2+):
```
Twilio:
  - Inbound call: $0.0085/minute
  - Outbound call: $0.011/minute
  - 100 minutes/month = ~$1

Telnyx:
  - Inbound: $0.0085/minute
  - Outbound: $0.013/minute
  - 100 minutes/month = ~$1.30

Plivo:
  - Inbound: $0.0075/minute
  - Outbound: $0.005/minute
  - 100 minutes/month = ~$0.75

Typical usage (if you use phone calling):
  - 1 hour/month = $0.50
  - 10 hours/month = $5
```

**Note:** This is optional and only needed if you implement voice calling features.

---

## 7. COMPLETE COST SCENARIOS

### Scenario A: COMPLETELY FREE ✅

```
STT:  Whisper Local    ($0)
TTS:  System TTS       ($0)
Wake: Vosk             ($0)
Claude: Not used       ($0)

Total: $0/month

Features:
  ✅ Voice input recognition
  ✅ Voice output (robot-like but works)
  ✅ Local processing (offline capable)
  ❌ Real-time conversation (Phase 4.1) - not possible
  ❌ Natural sounding voices

Use case:
  - Personal/hobby project
  - Offline-first application
  - Budget-constrained deployment
```

### Scenario B: BALANCED (Good Quality, Low Cost) ⭐ RECOMMENDED

```
STT:  Deepgram         ($50/month estimated - 10 hrs usage)
TTS:  Edge TTS         ($0)
Wake: Vosk             ($0)
Claude: Claude API     ($0-20/month)

Total: $50-70/month

Features:
  ✅ Real-time speech recognition
  ✅ Natural sounding voices
  ✅ Responsive conversational feel
  ✅ Phase 4.1 Voice Features
  ✅ Professional quality

Use case:
  - Startup/small business
  - Personal with regular voice use
  - Good balance of quality and cost
```

### Scenario C: PREMIUM (Best Quality)

```
STT:  Deepgram         ($100/month - 30 hrs usage)
TTS:  ElevenLabs       ($99/month subscription)
Wake: Vosk             ($0)
Claude: Claude API     ($10-50/month)

Total: $209-249/month

Features:
  ✅ Excellent recognition accuracy
  ✅ Premium natural voices (100+ options)
  ✅ Real-time conversation
  ✅ Best user experience
  ✅ Professional product quality

Use case:
  - Launched product
  - Enterprise deployment
  - Premium user experience
```

### Scenario D: ULTRA-BUDGET (Local Only)

```
STT:  Whisper Local    ($0)
TTS:  System TTS       ($0)
Wake: Vosk             ($0)
Claude: Not used       ($0)
Infrastructure: Free tier only

Total: $0/month

Features:
  ✅ Completely offline
  ✅ No API dependencies
  ✅ No privacy concerns
  ❌ Lower quality
  ❌ No real-time conversation
  ❌ Robot-like voice

Use case:
  - Privacy-first application
  - Offline-first requirement
  - Budget with zero revenue
```

---

## 8. COST BREAKDOWN BY FEATURE

### Feature: Real-Time Voice Conversation (Phase 4.1)
```
Minimum required:
  - STT (Deepgram): $50/month
  - Claude Realtime: ~$5-20/month
  - TTS (Edge): $0

Total: $55-70/month for good experience
```

### Feature: Voice Memos
```
Cost: Minimal
  - STT: included above
  - Storage: ~$5/month (optional, for cloud backup)
  - No additional API costs

Total: ~$5/month (if storing in cloud)
```

### Feature: Voice Commands (triggering tools)
```
Cost: Minimal
  - Uses existing Claude API tokens
  - No additional cost beyond base subscription

Total: $0 additional
```

### Feature: Telephony (phone calling)
```
Cost per call:
  - Twilio/Telnyx: ~$0.01/minute
  - 10 hours/month = ~$6

Total: $5-10/month for moderate use
```

---

## 9. COST OPTIMIZATION STRATEGIES

### Strategy 1: Hybrid Approach
```typescript
// Use Deepgram for realtime, but fallback to local Whisper for offline
if (navigator.onLine) {
  use Deepgram ($50/month)
} else {
  use Whisper Local ($0)
}

Cost: $50/month baseline + usage spikes
Savings: 10-30% compared to cloud-only
```

### Strategy 2: Tiered Service Levels
```typescript
// Free tier users get slower, lower quality
// Paid users get premium providers

Free tier:
  - System TTS ($0)
  - Whisper Local ($0)
  - Basic Claude API ($0 if cached)

Paid tier ($9.99/month):
  - ElevenLabs TTS ($99/month wholesale)
  - Deepgram STT ($50/month wholesale)
  - Priority Claude API

Cost to you: Negotiate wholesale rates with providers
```

### Strategy 3: Batch Processing
```typescript
// Don't use realtime Deepgram for everything
// Use cheaper async options for non-critical

Real-time: Deepgram ($0.0043/min)
Async: AssemblyAI ($0.0001/min equivalent) - 20x cheaper
  or save and batch later

Cost: 50-70% reduction for batch workloads
```

### Strategy 4: Cache Responses
```typescript
// Store frequently used TTS responses
// Reuse audio for common responses

"Hello, how can I help?"
  - Generate once: $0.0001
  - Reuse 1000 times: $0 (cached)

Cost: Minimal DB storage cost
Savings: Huge for common phrases
```

---

## 10. REVENUE MODELS TO OFFSET COSTS

### Option A: Freemium Model
```
Free Tier:
  - 10 minutes voice/month
  - System TTS only
  - No real-time conversation

Paid Tier ($9.99/month):
  - Unlimited voice
  - Natural TTS voices
  - Real-time conversation
  - Cloud backup

Your revenue covers costs:
  - $9.99/month × 100 paid users = $1,000
  - Your voice costs: ~$50-70
  - Profit margin: ~90% ✅
```

### Option B: Enterprise License
```
Per-deployment pricing:
  - Single user: free
  - 5 users: $29/month
  - 50 users: $249/month
  - Enterprise: custom pricing

Example:
  - 10 enterprise customers at $249/month
  - Revenue: $2,490/month
  - Voice costs: $100-200/month
  - Margin: >90% ✅
```

### Option C: Pay-as-you-go
```
Users pay for usage:
  - 30 minutes voice: $0.99
  - 300 minutes voice: $4.99
  - Unlimited/month: $9.99

Your costs are usage-based:
  - 300 min: ~$1.30 in APIs
  - Your revenue: $4.99
  - Margin: 75% ✅
```

---

## 11. SCALING COSTS

### At 10,000 users (20% active using voice):

**Scenario: Balanced Setup**
```
2,000 active users
  - Average 30 min/week voice = 2,600 hours/month
  - Deepgram: $11,180/month
  - Claude Realtime: $50/month
  - ElevenLabs: $0 (use Edge free)
  - Total: $11,230/month

Per user cost: $5.60/month
Revenue at $9.99/month per user: $19,980
Profit margin: ~40% ✅
```

### At 100,000 users:

```
20,000 active users
  - 26,000 hours/month
  - Deepgram (negotiate bulk): ~$50,000/month
  - Claude: $500/month
  - Total: ~$50,500/month

Per user cost: $2.50/month
Revenue at $9.99/month: $199,800
Profit margin: ~75% ✅
```

**Key insight:** Costs stay proportional to usage, so margins improve as you scale.

---

## 12. HIDDEN COSTS TO CONSIDER

```
Development:
  - Initial Phase 4.1 implementation: ~240 hours of eng time
  - Ongoing maintenance: ~20 hours/month

Infrastructure (optional):
  - Database: $15-30/month
  - Backups: $5-10/month
  - Monitoring: $10-20/month
  - CDN (if needed): $20-50/month

Support:
  - API outage management
  - Voice quality issues
  - Customer support for voice bugs

Support tools:
  - Error tracking (Sentry): $29/month
  - Analytics: $50-100/month
  - Monitoring: $100-200/month

Total "hidden": $200-500/month once launched
```

---

## 13. MY RECOMMENDATION

### Phase 4.1 Launch Strategy:

```
Month 1-3 (Development):
  Cost: $0 (use free tier while building)
  - Whisper Local for STT
  - System/Edge TTS
  - No production costs yet

Month 4 (Soft Launch):
  Cost: $100-150/month
  - Deepgram for STT ($50)
  - Claude API ($20-50)
  - ElevenLabs ($0, use Edge)
  - Serve 50-100 beta users

Month 5+ (Public Launch):
  Cost: $200-500/month for healthy margin
  - Deepgram ($100-200 for scaled usage)
  - Claude ($50-100)
  - ElevenLabs ($99 if adding premium tier)
  - Serve 10,000+ users

Revenue model:
  - Freemium: $9.99/month
  - 30% conversion = 3,000 paying users
  - Revenue: $89,970/month
  - Costs: $300/month
  - Net: $89,670/month profit ✅
```

---

## 14. COST COMPARISON TO COMPETITORS

```
Existing voice AI products:

Google Assistant:
  - Free to use (Google absorbs $10+/user/month cost)
  - Supported by ads/ecosystem

Amazon Alexa:
  - Free device (profit on hardware/subscriptions)
  - Costs Amazon ~$3-5 per user/month in infrastructure

ChatGPT Voice:
  - Included in $20/month subscription
  - OpenAI spends ~$5-10 per user on voice infrastructure

Helix positioning:
  - Personal/professional voice AI
  - Privacy-focused (local option available)
  - Conversational (not just commands)
  - At $9.99/month, very competitive
  - With memory integration, unique value prop
```

---

## 15. BOTTOM LINE

| Question | Answer |
|----------|--------|
| **Can you have voice features for free?** | YES (Whisper Local + System TTS = $0) |
| **What's the minimum for good experience?** | $50-70/month (Deepgram + Claude) |
| **What's needed for premium quality?** | $200-250/month (all premium providers) |
| **Is it profitable?** | YES, 75-90% margins with freemium model |
| **Does it scale affordably?** | YES, costs stay proportional to usage |
| **Biggest cost driver?** | Claude Realtime API (but still cheap per conversation) |
| **Easiest cost to cut?** | TTS (switch from ElevenLabs to Edge for $99→$0/month) |

---

## 16. DECISION FRAMEWORK

### Choose based on your constraints:

**If you want: Minimum viable product**
```
Budget: $0/month
Use: Whisper Local + System TTS
Suitable for: Personal/hobby, offline-first
```

**If you want: Good production experience**
```
Budget: $50-100/month
Use: Deepgram + Edge TTS + Claude
Suitable for: Startup launch, small user base
```

**If you want: Premium user experience**
```
Budget: $200-300/month
Use: Deepgram + ElevenLabs + Claude
Suitable for: Funded startup, enterprise
```

**If you want: Cost-conscious scale**
```
Budget: $100-500/month (scales with users)
Use: Hybrid (Deepgram + Edge free tier)
Suitable for: SaaS business model
```

---

## 17. NEGOTIATING WITH PROVIDERS

**Deepgram:**
- Startup rate: ~50% off list price
- Volume discounts: 30-40% at $1K+/month
- Contact sales for custom deal

**ElevenLabs:**
- Wholesale rates available for products
- Volume-based pricing
- Can negotiate API rates vs subscription

**Claude API:**
- No volume discounts (flat per-token rate)
- But tokens are very cheap for audio
- Focus on optimization, not negotiation

**Twilio/Telnyx:**
- Startup program: $500 credit
- Volume: negotiate at 1M+ units

---

*Voice Features Cost Analysis | February 2, 2026*
*Phase 4.1 Implementation: Budget-Friendly & Profitable*
