# Helix Business Model, Pricing & Infrastructure Cost Analysis

> Research date: 2026-02-05
> Status: Draft — requires marketing validation and A/B testing

---

## Pricing Tiers

```
┌──────────┬──────────────┬──────────────┐
│   FREE   │   STARTER    │     PRO      │
│   $0     │   $9/mo      │   $19/mo     │
├──────────┼──────────────┼──────────────┤
│ 10 msg/d │ 50 msg/day   │ Unlimited*   │
│ Web only │ All platforms│ All platforms│
│ Basic AI │ Managed AI   │ Managed AI   │
│ No local │ Local runtime│ Local runtime│
│ No sync  │ 1 device sync│ Full sync    │
│          │              │ Priority AI  │
│          │ ── OR ──     │ ── OR ──     │
│          │ BYOK toggle: │ BYOK toggle: │
│          │ Unlimited msg│ Saves $10/mo │
└──────────┴──────────────┴──────────────┘
```

### Tier Details

#### Free ($0/mo)

- 10 messages/day
- Web-only access (no mobile, no desktop)
- Basic managed AI (DeepSeek V3.2)
- No local runtime
- No cross-device sync
- Basic personality/memory
- Purpose: Acquisition hook, conversion to paid

#### Starter ($9/mo)

- **Managed mode**: 50 messages/day, managed AI (DeepSeek V3.2 + Gemini Flash)
- **BYOK mode**: Unlimited messages, user provides own API keys
- All platforms (web, mobile, desktop)
- Local runtime support
- 1 device sync (web+mobile OR web+desktop)
- Full personality/memory
- Purpose: Convert free users, capture dev segment via BYOK toggle

#### Pro ($19/mo)

- **Managed mode**: Unlimited messages\*, managed AI with smart routing
- **BYOK mode**: Unlimited, saves cost (potential $9/mo BYOK discount TBD)
- All platforms with full real-time sync
- Local runtime with full tool access
- Priority AI model routing (better models for complex tasks)
- Advanced features: proactive heartbeat, scheduled tasks, multi-agent
- Purpose: Core revenue driver, under $20 sweet spot

#### Team Add-on (Future — not at launch)

- Multi-user support
- Shared agents/workspaces
- Admin panel
- SLA guarantees
- Pricing TBD based on demand signal

### Key Design Decisions

- **BYOK is a toggle within paid plans, not a separate tier** — devs self-select
- **3 tiers max on pricing page** — simple, left-to-right, increasing value
- **$19 undercuts ChatGPT/Claude ($20)** — strong competitive positioning
- **No 4th tier at launch** — add Team plan when demand exists
- **Message caps protect margins** on managed tiers

---

## AI API Cost Model

### Models Used (Managed Tier)

- **Primary**: DeepSeek V3.2 Exp — $0.028 input / $0.32 output per 1M tokens
- **Secondary**: Gemini 2.5 Flash — $0.15 input / $0.60 output per 1M tokens
- **Routing**: DeepSeek for casual chat, Gemini for tasks needing multimodal/reasoning

### Per-User AI Cost Estimates

| Scenario               | Messages/day | Input tokens/day | Output tokens/day | Monthly AI Cost |
| ---------------------- | ------------ | ---------------- | ----------------- | --------------- |
| Free tier (10 msg)     | 10           | ~20K             | ~10K              | ~$0.12          |
| Starter light (20 msg) | 20           | ~40K             | ~20K              | ~$0.60          |
| Starter cap (50 msg)   | 50           | ~100K            | ~50K              | ~$1.50          |
| Pro average (80 msg)   | 80           | ~160K            | ~80K              | ~$2.50          |
| Pro heavy (200 msg)    | 200          | ~400K            | ~200K             | ~$6.00          |

### Cost Optimization Strategies

1. **Smart model routing**: DeepSeek for casual, Gemini for complex — cuts costs 40-60%
2. **Response caching**: Common patterns get cached — zero marginal cost
3. **Context window management**: Aggressive summarization = fewer tokens/message
4. **Off-peak batching**: Non-urgent tasks (email summaries, reports) queued for DeepSeek off-peak (50-75% discount)
5. **Context caching (Gemini)**: Frequently used prompts cached at 10% of base input price

---

## Infrastructure Costs

### Fixed Monthly Costs (amortized across user base)

| Service         | Plan | Monthly Cost          | What It Covers                     |
| --------------- | ---- | --------------------- | ---------------------------------- |
| Supabase        | Pro  | $25 + usage (~$50-75) | Auth, DB, Edge Functions, Realtime |
| Vercel          | Pro  | $20 + usage (~$40-80) | Web hosting, serverless, CDN       |
| Domain/DNS      | -    | ~$5                   | DNS, SSL certificates              |
| Monitoring      | -    | ~$20                  | Uptime, error tracking, alerts     |
| Discord         | Free | $0                    | Webhook logging (free forever)     |
| **Total Fixed** |      | **~$120-200/mo**      |                                    |

### Variable Per-User Costs (all-in)

| Cost Type                | Free User  | Starter (Managed) | Pro (Managed Heavy) |
| ------------------------ | ---------- | ----------------- | ------------------- |
| AI API                   | $0.12      | $1.50             | $6.00               |
| Supabase Auth            | ~$0.00\*   | ~$0.00\*          | ~$0.00\*            |
| Supabase DB              | $0.01      | $0.03             | $0.15               |
| Supabase Edge Functions  | $0.01      | $0.03             | $0.08               |
| Supabase Realtime (sync) | $0.01      | $0.05             | $0.10               |
| Vercel bandwidth         | $0.02      | $0.05             | $0.10               |
| WebSocket relay          | $0.00      | $0.03             | $0.08               |
| Egress/transfer          | $0.01      | $0.05             | $0.15               |
| **Total per user/mo**    | **~$0.18** | **~$1.74**        | **~$6.66**          |

\*Supabase Auth: 100K MAU included in Pro plan

### Intra-Agent Communication Costs (web/mobile <-> local runtime)

| Component              | Cost Driver                  | Estimate/user/mo |
| ---------------------- | ---------------------------- | ---------------- |
| Supabase Realtime      | Persistent WS per device     | $0.03-0.05       |
| Edge Function relay    | Command forwarding           | $0.02-0.05       |
| DB writes (sync state) | Session state, command queue | $0.01-0.03       |
| **Total relay**        |                              | **$0.06-0.13**   |

---

## Margin Analysis

### Direct Margins (Web/Direct Purchase)

| Tier              | Revenue | All-In Cost | Stripe Fee (2.9%+$0.30) | Net Margin | Margin %    |
| ----------------- | ------- | ----------- | ----------------------- | ---------- | ----------- |
| Free              | $0      | $0.18       | -                       | -$0.18     | Loss leader |
| Starter BYOK      | $9      | $0.15       | $0.56                   | **$8.29**  | **92%**     |
| Starter Managed   | $9      | $1.74       | $0.56                   | **$6.70**  | **74%**     |
| Pro BYOK          | $19     | $0.15       | $0.85                   | **$18.00** | **95%**     |
| Pro Managed       | $19     | $3.50 avg   | $0.85                   | **$14.65** | **77%**     |
| Pro Managed Heavy | $19     | $6.66       | $0.85                   | **$11.49** | **60%**     |

### iOS/Android Margins (Apple/Google take 15-30%)

| Tier              | Revenue | Platform Fee (30% Y1) | Cost  | Net Margin | Margin % |
| ----------------- | ------- | --------------------- | ----- | ---------- | -------- |
| Starter Managed   | $9      | $2.70                 | $1.74 | **$4.56**  | **51%**  |
| Pro Managed       | $19     | $5.70                 | $3.50 | **$9.80**  | **52%**  |
| Pro Managed Heavy | $19     | $5.70                 | $6.66 | **$6.64**  | **35%**  |

> **Note**: After Year 1, Apple/Google reduce to 15% for qualifying small businesses (<$1M revenue). This improves margins by ~15 percentage points.

### Break-Even Analysis

| Scale  | Fixed Infra | Free Users (cost) | Revenue Needed | Break-even Paid Users    |
| ------ | ----------- | ----------------- | -------------- | ------------------------ |
| Seed   | $150/mo     | 100 ($18)         | $168/mo        | ~19 Starter or ~9 Pro    |
| Early  | $200/mo     | 1,000 ($180)      | $380/mo        | ~42 Starter or ~20 Pro   |
| Growth | $400/mo     | 10,000 ($1,800)   | $2,200/mo      | ~244 Starter or ~117 Pro |

---

## Competitive Landscape

### AI Personal Assistants

| Product | Free | Paid          | Model        |
| ------- | ---- | ------------- | ------------ |
| ChatGPT | Yes  | $20/mo (Plus) | Subscription |
| Claude  | Yes  | $20/mo (Pro)  | Subscription |
| Pi AI   | Yes  | Emerging      | Free-first   |
| Dume.ai | Yes  | $18/mo        | Subscription |

### AI Coding Tools

| Product        | Free           | Pro         | Business      |
| -------------- | -------------- | ----------- | ------------- |
| Cursor         | Limited        | $20/mo      | $40/user      |
| Windsurf       | Yes (generous) | $15/mo      | $30/user      |
| GitHub Copilot | -              | $10-19/mo   | $39/mo (Pro+) |
| Claude Code    | -              | API pricing | -             |

### Helix Positioning

- **$19 Pro undercuts the $20 sweet spot** (ChatGPT, Claude, Cursor)
- **$9 Starter matches budget segment** (Copilot Individual)
- **BYOK toggle is unique** — no competitor offers this flexibility
- **Differentiator**: Persistent psychological identity, not just a chatbot

---

## Scale Inflection Points

| Users (MAU) | Supabase Impact             | Vercel Impact         | Action Required        |
| ----------- | --------------------------- | --------------------- | ---------------------- |
| 0-1K        | Free/Pro fine               | Hobby/Pro fine        | No changes             |
| 1K-10K      | Pro handles it              | Pro handles it        | Monitor egress         |
| 10K-50K     | Edge func overages ~$100/mo | BW overages ~$150/mo  | Budget +$250/mo        |
| 50K-100K    | Team plan ($599/mo)         | Enterprise or migrate | Architecture review    |
| 100K+       | Self-host Postgres          | CDN + edge caching    | Major infra investment |

---

## Hidden Costs Checklist

- [ ] Stripe processing: 2.9% + $0.30 per transaction
- [ ] Apple App Store: 30% (Year 1), 15% (Year 2+ if <$1M)
- [ ] Google Play Store: 15% (<$1M), 30% (>$1M)
- [ ] Apple Developer Program: $99/year
- [ ] Google Play Developer: $25 one-time
- [ ] Code signing (Windows): ~$200-400/year
- [ ] Email delivery (transactional): ~$0.001/email (SendGrid/Resend)
- [ ] Error tracking (Sentry): Free tier → $26/mo at scale
- [ ] Analytics: Free (Plausible/PostHog self-host) or ~$20/mo

---

## Revenue Projections (Conservative)

Assuming 3% freemium conversion rate, 60/40 Starter/Pro split:

| Total Users | Free   | Starter ($9) | Pro ($19) | Monthly Revenue | Monthly Cost | Net     |
| ----------- | ------ | ------------ | --------- | --------------- | ------------ | ------- |
| 1,000       | 970    | 18           | 12        | $390            | $345         | $45     |
| 5,000       | 4,850  | 90           | 60        | $1,950          | $1,475       | $475    |
| 10,000      | 9,700  | 180          | 120       | $3,900          | $2,750       | $1,150  |
| 50,000      | 48,500 | 900          | 600       | $19,500         | $13,200      | $6,300  |
| 100,000     | 97,000 | 1,800        | 1,200     | $39,000         | $25,500      | $13,500 |

> These are conservative. Better onboarding and value demonstration can push conversion to 5-8%, doubling revenue.

---

## Sources & References

- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase True Cost Guide](https://www.metacto.com/blogs/the-true-cost-of-supabase)
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Hidden Costs](https://flexprice.io/blog/vercel-pricing-breakdown)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [DeepSeek V3.2 Pricing Cut](https://venturebeat.com/ai/deepseeks-new-v3-2-exp-model-cuts-api-pricing-in-half/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [SaaS Freemium Conversion Rates 2026](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- [AI Pricing in 2026](https://www.valueships.com/post/ai-pricing-in-2026)
- [2026 Guide to SaaS AI Pricing](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)
- [WebSocket Hosting Costs](https://www.recall.ai/blog/how-websockets-cost-us-1m-on-our-aws-bill)
- [Cursor Pricing 2026](https://checkthat.ai/brands/cursor/pricing)
- [AI Personal Assistants 2026](https://www.dume.ai/blog/10-ai-personal-assistants-youll-need-in-2026)
