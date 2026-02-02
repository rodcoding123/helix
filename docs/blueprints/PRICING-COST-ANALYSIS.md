# Helix Pricing & Cost Analysis

> Business economics of Web vs Desktop deployment

---

## Platform Comparison: Business Perspective

### Desktop App (Local Execution)

| Cost Category | Our Cost | Notes |
|---------------|----------|-------|
| **Hosting** | $0 | Runs on user's machine |
| **Compute** | $0 | User's CPU |
| **Claude API** | $0 | User brings own key (BYOK) |
| **Storage** | $0 | User's disk |
| **Bandwidth** | ~$0 | GitHub releases (free for open repos) |
| **Distribution** | $99-400/yr | Code signing (optional initially) |
| **Support** | Variable | Community/paid |

**Total fixed cost: ~$0-400/year**
**Per-user cost: $0**

### Web App (Cloud Execution)

| Cost Category | Our Cost | Notes |
|---------------|----------|-------|
| **Hosting** | Variable | Vercel/Supabase |
| **Compute** | Per-request | Edge functions |
| **Claude API** | Per-token | We pay, pass through or markup |
| **Storage** | Per-GB | User data, sessions, files |
| **Bandwidth** | Per-GB | API calls, file transfers |
| **Database** | Per-row/query | Sessions, users, config |
| **Auth** | Per-MAU | Supabase auth |

**Total fixed cost: $25-100/month base**
**Per-user cost: $0.50-5.00/month (varies by usage)**

---

## Vercel Pricing Breakdown

### Free Tier (Hobby)
| Resource | Limit | Helix Usage |
|----------|-------|-------------|
| Bandwidth | 100 GB/month | ~10,000 active users |
| Serverless Functions | 100 GB-hrs | ~500,000 requests |
| Edge Functions | 500,000 invocations | ~500,000 API calls |
| Build Minutes | 6,000/month | Plenty |
| Deployments | Unlimited | Plenty |

**Verdict:** Free tier supports ~5,000-10,000 monthly active users

### Pro Tier ($20/month)
| Resource | Limit | Helix Usage |
|----------|-------|-------------|
| Bandwidth | 1 TB/month | ~100,000 users |
| Serverless Functions | 1,000 GB-hrs | ~5M requests |
| Edge Functions | 1M invocations | ~1M API calls |
| Team members | 10 | Enough |

**Verdict:** Pro tier supports ~50,000-100,000 MAU

### Per-Usage Overages
| Resource | Cost |
|----------|------|
| Bandwidth | $0.15/GB |
| Edge Function Invocations | $0.65/million |
| Serverless GB-hrs | $0.18/GB-hr |

---

## Supabase Pricing Breakdown

### Free Tier
| Resource | Limit | Helix Usage |
|----------|-------|-------------|
| Database | 500 MB | ~50,000 users |
| Storage | 1 GB | ~10,000 files |
| Bandwidth | 2 GB/month | ~20,000 requests |
| Edge Functions | 500,000 invocations | ~500,000 API calls |
| Auth MAU | 50,000 | 50,000 users |
| Realtime | 200 concurrent | 200 simultaneous |

**Verdict:** Free tier supports ~10,000-50,000 MAU (auth is generous)

### Pro Tier ($25/month)
| Resource | Limit | Helix Usage |
|----------|-------|-------------|
| Database | 8 GB | ~500,000 users |
| Storage | 100 GB | ~1M files |
| Bandwidth | 250 GB/month | ~2.5M requests |
| Edge Functions | 2M invocations | 2M API calls |
| Auth MAU | 100,000 | 100,000 users |
| Realtime | 500 concurrent | 500 simultaneous |

**Verdict:** Pro tier supports ~100,000+ MAU

### Per-Usage Overages
| Resource | Cost |
|----------|------|
| Database | $0.125/GB |
| Storage | $0.021/GB |
| Bandwidth | $0.09/GB |
| Auth MAU | $0.00325/user above 100K |

---

## Claude API Costs (The Big One)

### Anthropic Pricing (as of 2024)

| Model | Input | Output | Typical Chat |
|-------|-------|--------|--------------|
| Claude 3.5 Sonnet | $3/M tokens | $15/M tokens | ~$0.01-0.05/message |
| Claude 3 Opus | $15/M tokens | $75/M tokens | ~$0.05-0.20/message |
| Claude 3.5 Haiku | $0.25/M tokens | $1.25/M tokens | ~$0.001-0.005/message |

### Per-User Cost Estimates

| Usage Level | Messages/day | Model | Monthly Cost |
|-------------|--------------|-------|--------------|
| Light | 10 | Sonnet | $3-5 |
| Medium | 50 | Sonnet | $15-25 |
| Heavy | 200 | Sonnet | $60-100 |
| Power | 500+ | Sonnet | $150-250 |

### Business Model Options

#### Option A: BYOK (Bring Your Own Key)
- User enters their Anthropic API key
- We pay $0 for Claude
- User pays Anthropic directly
- **Best for:** Desktop app, power users

#### Option B: Resale (Markup)
- We have Anthropic API key
- User pays us
- We charge markup (e.g., 2x)
- **Best for:** Simplicity, casual users

#### Option C: Hybrid
- Free tier: BYOK only
- Paid tier: Choice of BYOK or included credits
- **Best for:** Flexibility

---

## Cost Per User Analysis

### Scenario: 10,000 MAU

#### Web-Only (All users on cloud)

| Category | Cost/month | Notes |
|----------|------------|-------|
| Vercel Pro | $20 | Base |
| Supabase Pro | $25 | Base |
| Bandwidth overage | ~$50 | Estimate |
| Database growth | ~$10 | Estimate |
| **Infrastructure** | **$105/month** | |
| Claude API (if included) | $30,000-50,000 | At 50 msg/user |
| **Total w/ Claude** | **$30,000-50,000** | |
| **Total BYOK** | **$105** | User pays Claude |

**Per-user cost:**
- BYOK: $0.01/user/month (infrastructure only)
- Included Claude: $3-5/user/month

#### Desktop + Web Hybrid

| Category | Cost/month | Notes |
|----------|------------|-------|
| Vercel Free | $0 | Dashboard only |
| Supabase Pro | $25 | Sync, auth |
| **Total** | **$25/month** | |

**Per-user cost: $0.0025/user/month** (just auth/sync)

---

## Feature Comparison: User Perspective

### What Users GET on Desktop (Local)

| Feature | Desktop | Why Local Required |
|---------|---------|-------------------|
| **WhatsApp Connection** | ✅ Full | QR session lives locally |
| **Telegram Bot** | ✅ Full | Long-running process |
| **Discord Bot** | ✅ Full | Long-running process |
| **iMessage** | ✅ Full | macOS only, local access |
| **Signal** | ✅ Full | Local bridge |
| **Local Files** | ✅ Full | Filesystem access |
| **MCP Servers** | ✅ Full | Local Node processes |
| **Browser Automation** | ✅ Full | Playwright/local browser |
| **Smart Home (Local)** | ✅ Full | Local network access |
| **Offline Mode** | ✅ Works | No internet needed for UI |
| **Privacy** | ✅ Maximum | Data never leaves machine |
| **Speed** | ✅ Fastest | No network latency for UI |
| **API Key** | BYOK | User controls |

### What Users GET on Web (Cloud)

| Feature | Web | Why It Works |
|---------|-----|--------------|
| **Chat with Claude** | ✅ Full | API call from server |
| **Google Calendar** | ✅ Full | OAuth + API |
| **Gmail** | ✅ Full | OAuth + API |
| **Outlook/O365** | ✅ Full | OAuth + API |
| **Todoist** | ✅ Full | API |
| **Linear** | ✅ Full | API |
| **Notion** | ✅ Full | API |
| **GitHub** | ✅ Full | API |
| **Slack** | ✅ Full | OAuth + API |
| **Voice Input** | ✅ Browser API | Web Speech API |
| **File Upload** | ✅ Limited | Up to X MB |
| **Session Sync** | ✅ Built-in | Cloud storage |
| **Multi-device** | ✅ Built-in | Same account |
| **Zero Install** | ✅ Instant | Just visit URL |

### What Users CANNOT DO on Web

| Feature | Web | Alternative |
|---------|-----|-------------|
| **WhatsApp** | ❌ | Must use Desktop |
| **Telegram Bot** | ❌ | Must use Desktop |
| **Discord Bot** | ❌ | Must use Desktop |
| **iMessage** | ❌ | Must use Desktop (macOS) |
| **Local Files** | ❌ | Upload to cloud |
| **MCP Servers** | ❌ | Cloud skills only |
| **Browser Automation** | ❌ | Must use Desktop |
| **Smart Home (Local)** | ❌ | Cloud integrations only |
| **Offline** | ❌ | Requires internet |

---

## Proposed Pricing Tiers

### Tier 1: Helix Free (Web)
**Price:** $0
**Target:** Trial, casual users

| Feature | Included |
|---------|----------|
| Chat with Claude | ✅ 50 messages/day |
| Session history | ✅ 7 days |
| File upload | ✅ 10 MB limit |
| Basic settings | ✅ |
| API Key | BYOK required |

**Our cost:** ~$0.001/user/month (minimal)

---

### Tier 2: Helix Starter (Web)
**Price:** $4.99/month
**Target:** Individuals wanting integrations

| Feature | Included |
|---------|----------|
| Chat with Claude | ✅ Unlimited |
| Session history | ✅ 30 days |
| File upload | ✅ 50 MB limit |
| Google Calendar | ✅ |
| Gmail | ✅ |
| Todoist | ✅ |
| Voice input | ✅ |
| API Key | BYOK required |

**Our cost:** ~$0.10/user/month
**Margin:** $4.89 (98%)

---

### Tier 3: Helix Pro (Web)
**Price:** $9.99/month
**Target:** Power users, productivity focus

| Feature | Included |
|---------|----------|
| Everything in Starter | ✅ |
| Session history | ✅ Unlimited |
| File upload | ✅ 500 MB limit |
| Notion sync | ✅ |
| Linear | ✅ |
| GitHub | ✅ |
| Slack | ✅ |
| Scheduled tasks | ✅ |
| Priority support | ✅ |
| API Key | BYOK or $20 Claude credits |

**Our cost:** ~$0.50/user/month (+ Claude if included)
**Margin:** $9.49 (95%) or $9.49 - Claude usage

---

### Tier 4: Helix Full (Desktop + Web)
**Price:** $19.99/month
**Target:** Full power users

| Feature | Included |
|---------|----------|
| Everything in Pro | ✅ |
| Desktop app | ✅ |
| WhatsApp connection | ✅ |
| Telegram bot | ✅ |
| Discord bot | ✅ |
| Local file access | ✅ |
| MCP servers | ✅ |
| Browser automation | ✅ |
| Smart home | ✅ |
| Cloud sync | ✅ |
| API Key | BYOK or $50 Claude credits |

**Our cost:** ~$0.50/user/month (desktop is free for us)
**Margin:** $19.49 (97%)

---

### Tier 5: Helix Team
**Price:** $29.99/user/month (min 3 users)
**Target:** Teams, businesses

| Feature | Included |
|---------|----------|
| Everything in Full | ✅ |
| Team workspace | ✅ |
| Shared memory | ✅ |
| Admin dashboard | ✅ |
| SSO/SAML | ✅ |
| Audit logs | ✅ |
| Priority support | ✅ |
| Dedicated success | ✅ (10+ users) |
| API Key | BYOK or $100 Claude credits/user |

**Our cost:** ~$2/user/month
**Margin:** $27.99 (93%)

---

## Revenue Projections

### Conservative Growth

| Month | MAU | Paid Users (5%) | MRR |
|-------|-----|-----------------|-----|
| 1 | 1,000 | 50 | $500 |
| 3 | 5,000 | 250 | $2,500 |
| 6 | 20,000 | 1,000 | $10,000 |
| 12 | 100,000 | 5,000 | $50,000 |

### Cost at Scale

| MAU | Infrastructure | Per-User | Total Cost |
|-----|----------------|----------|------------|
| 1,000 | $45 | $0.05 | $95 |
| 10,000 | $105 | $0.01 | $205 |
| 100,000 | $500 | $0.005 | $1,000 |

**Gross Margin at 100K MAU, 5K paid:**
- Revenue: $50,000/month
- Cost: $1,000/month
- **Margin: 98%**

---

## Competitive Pricing Analysis

| Product | Price | What You Get |
|---------|-------|--------------|
| ChatGPT Plus | $20/mo | Just chat, GPT-4 |
| Claude Pro | $20/mo | Just chat, Claude |
| Notion AI | $10/mo | AI in Notion only |
| Zapier Starter | $20/mo | 750 tasks/mo |
| Make.com Core | $9/mo | 10K ops/mo |
| **Helix Pro** | **$9.99/mo** | Chat + Integrations |
| **Helix Full** | **$19.99/mo** | + WhatsApp/Desktop |

**Positioning:** Same price as ChatGPT/Claude but with 10x more features

---

## Key Business Insights

### Why Desktop-First is Cheaper

1. **Zero compute cost** - User's CPU
2. **Zero storage cost** - User's disk
3. **Zero Claude cost** - BYOK
4. **Zero bandwidth** - Local processing
5. **Only cost** - Distribution (GitHub free, signing optional)

### Why Web is Still Valuable

1. **Lower friction** - No download
2. **Instant updates** - No version fragmentation
3. **Mobile access** - PWA
4. **Upsell path** - Free → Paid → Desktop
5. **Data moat** - Sessions, preferences, memory

### Recommended Strategy

```
FREE (Web)
    │
    ▼ Conversion trigger: "Want integrations?"
STARTER ($4.99)
    │
    ▼ Conversion trigger: "Want more power?"
PRO ($9.99)
    │
    ▼ Conversion trigger: "Want WhatsApp/Local?"
FULL ($19.99) ← Most profitable
    │
    ▼ Conversion trigger: "Team features?"
TEAM ($29.99/user)
```

### Claude API Strategy

| Tier | Claude Handling |
|------|-----------------|
| Free | BYOK only (we pay nothing) |
| Starter | BYOK only (we pay nothing) |
| Pro | BYOK or included credits ($20 value) |
| Full | BYOK or included credits ($50 value) |
| Team | BYOK or included credits ($100/user) |

**Why this works:**
- Power users prefer BYOK (control, no limits)
- Casual users pay premium for simplicity
- We profit either way

---

## Action Items

1. **Start with BYOK only** - Zero Claude cost risk
2. **Launch Free + Pro** - Test conversion
3. **Add Desktop tier after validation** - Full at $19.99
4. **Consider included credits later** - When we understand usage
5. **Team tier after PMF** - Enterprise needs validation

---

## Summary

| Metric | Desktop | Web | Hybrid |
|--------|---------|-----|--------|
| Our infra cost | $0 | $0.01-0.50/user | $0.01-0.50/user |
| Our Claude cost | $0 (BYOK) | $0-5/user | $0 (BYOK default) |
| User friction | Download required | Zero | Zero (web), download for full |
| Feature parity | 100% | 60% | 100% via bridge |
| Margin | 100% | 95-98% | 97% |
| **Winner** | Cheapest for us | Easiest for user | Best of both |
