# Helix Web/Mobile Strategy

> Reducing friction by meeting users where they are

---

## The Problem with Desktop-Only

| Issue                  | Impact                                 |
| ---------------------- | -------------------------------------- |
| Code signing           | $400-500/year or scary warnings        |
| Download friction      | Users hesitate to install unknown apps |
| Platform fragmentation | 3 platforms to maintain                |
| Update distribution    | Manual or complex auto-update          |
| Onboarding drop-off    | Many users never complete setup        |

---

## Web-First Advantages

| Advantage           | Impact                 |
| ------------------- | ---------------------- |
| Zero installation   | Instant access         |
| No signing costs    | $0                     |
| Single codebase     | Faster iteration       |
| Auto-updates        | Users always on latest |
| Cross-device        | Works everywhere       |
| Lower trust barrier | "Just a website"       |

---

## What CAN Work on Web

### ✅ Full Functionality

| Feature              | Web Viability | Notes                       |
| -------------------- | ------------- | --------------------------- |
| Chat interface       | ✅ Perfect    | Core experience             |
| Claude API calls     | ✅ Perfect    | Server-side                 |
| Session history      | ✅ Perfect    | Database storage            |
| User authentication  | ✅ Perfect    | Standard OAuth              |
| Settings management  | ✅ Perfect    | Forms                       |
| Usage analytics      | ✅ Perfect    | Server tracking             |
| Payment/subscription | ✅ Perfect    | Stripe                      |
| Calendar integration | ✅ Good       | OAuth-based                 |
| Email integration    | ✅ Good       | OAuth-based                 |
| Task management      | ✅ Good       | API-based (Todoist, Linear) |
| Note sync            | ✅ Good       | API-based (Notion)          |

### ⚠️ Partial Functionality

| Feature          | Web Limitation      | Workaround               |
| ---------------- | ------------------- | ------------------------ |
| Voice input      | Need permission     | Browser API works        |
| File uploads     | Limited types       | Standard web upload      |
| Notifications    | Requires permission | Web push notifications   |
| Background tasks | Tab must be open    | Service worker (limited) |

### ❌ Cannot Work on Web

| Feature              | Why Not                    | Desktop Required |
| -------------------- | -------------------------- | ---------------- |
| WhatsApp connection  | QR + local session         | Yes              |
| Telegram bot hosting | Needs long-running process | Yes              |
| Local file access    | Browser sandbox            | Yes              |
| MCP servers          | Local processes            | Yes              |
| System keychain      | Browser isolation          | Yes              |
| Browser automation   | Playwright needs Node      | Yes              |
| Smart home (local)   | Network access             | Yes              |

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HELIX CLOUD                              │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │ Mobile App  │  │   REST API  │         │
│  │   (React)   │  │   (React    │  │  (Workers)  │         │
│  │             │  │    Native)  │  │             │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                   ┌──────┴──────┐                          │
│                   │   Gateway   │                          │
│                   │   Server    │                          │
│                   └──────┬──────┘                          │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         │                │                │                │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐        │
│  │   Claude    │  │  Calendar   │  │   Email     │        │
│  │     API     │  │    APIs     │  │    APIs     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (Optional connection)
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    HELIX DESKTOP                             │
│                   (User's Computer)                          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  WhatsApp   │  │  Telegram   │  │    Local    │         │
│  │  Connection │  │    Bot      │  │    Files    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    MCP      │  │   Browser   │  │   Smart     │         │
│  │   Servers   │  │ Automation  │  │    Home     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Product Tiers

### Tier 1: Helix Web (Free)

**Target:** Casual users, trial users

| Feature                  | Included |
| ------------------------ | -------- |
| Chat with Claude         | ✅       |
| 50 messages/day          | ✅       |
| Session history (7 days) | ✅       |
| Basic file upload        | ✅       |
| Web notifications        | ✅       |

**Limitations:**

- No messaging platform integration
- No automation
- No calendar/email/tasks

---

### Tier 2: Helix Pro (Web) - $9.99/mo

**Target:** Productivity users

| Feature                   | Included |
| ------------------------- | -------- |
| Unlimited messages        | ✅       |
| Unlimited session history | ✅       |
| Google Calendar           | ✅       |
| Gmail integration         | ✅       |
| Todoist/Linear            | ✅       |
| Notion sync               | ✅       |
| Voice input               | ✅       |
| Priority support          | ✅       |

**Limitations:**

- No WhatsApp/Telegram (needs desktop)
- No local file access
- No browser automation

---

### Tier 3: Helix Full (Desktop + Web) - $19.99/mo

**Target:** Power users

| Feature             | Included |
| ------------------- | -------- |
| Everything in Pro   | ✅       |
| WhatsApp connection | ✅       |
| Telegram bot        | ✅       |
| Discord bot         | ✅       |
| Local file access   | ✅       |
| Browser automation  | ✅       |
| MCP servers         | ✅       |
| Smart home          | ✅       |
| Cloud sync          | ✅       |

---

## Mobile Strategy

### Option A: React Native App

**Pros:**

- Native feel
- Push notifications
- Background execution (limited)
- One codebase (web + mobile)

**Cons:**

- App store review
- $99/year Apple fee
- Google Play $25 one-time
- Update delays

### Option B: PWA (Progressive Web App)

**Pros:**

- No app store
- Instant updates
- Same codebase as web
- "Add to home screen"

**Cons:**

- iOS limitations (no background, limited notifications)
- Less "native" feel
- Browser must support features

### Option C: Companion App Only

**Pros:**

- Minimal functionality = fast development
- Control desktop remotely
- Approve pairings
- View notifications

**Cons:**

- Limited value standalone
- Still needs app store approval

**Recommendation:** Start with **PWA**, add native later if needed.

---

## Web Tech Stack

### Frontend

- **React 19** (same as desktop)
- **Tailwind CSS** (same as desktop)
- **Tanstack Query** (data fetching)
- **Zustand** (state management)

### Backend

- **Cloudflare Workers** (serverless)
- **D1** (SQLite database)
- **R2** (file storage)
- **KV** (session cache)
- **Durable Objects** (WebSocket)

### Why Cloudflare?

- Edge deployment (fast globally)
- Generous free tier
- No cold starts
- WebSocket support
- Built-in DDoS protection

### Alternative: Supabase

- Already integrated for Helix Observatory
- PostgreSQL (more powerful)
- Built-in auth
- Real-time subscriptions
- Edge functions

---

## Migration Path

### Phase 1: Web MVP (Month 1)

```
Goal: Basic chat experience in browser

Features:
- Login/signup (Supabase auth)
- Chat with Claude
- Session history
- Basic settings
- Usage tracking

Tech:
- Deploy to helix.app
- Supabase backend
- Claude API (server-side)
```

### Phase 2: Integrations (Month 2)

```
Goal: Add value beyond basic chat

Features:
- Google Calendar OAuth
- Gmail OAuth
- Todoist API
- Notion API
- Voice input (browser)

Tech:
- OAuth flows
- Background sync jobs
- Webhook receivers
```

### Phase 3: Desktop Bridge (Month 3)

```
Goal: Connect web to local capabilities

Features:
- Desktop app ↔ Web sync
- Remote session control
- Pairing approval from web
- Status monitoring

Tech:
- WebSocket tunnel
- Secure handshake
- Session encryption
```

### Phase 4: Mobile (Month 4)

```
Goal: Mobile companion experience

Features:
- PWA installable
- Push notifications
- Quick responses
- Voice input
- Pairing approval

Tech:
- Service worker
- Web push
- Media capture API
```

---

## URL Structure

```
helix.app/                  # Marketing landing
helix.app/login             # Auth flow
helix.app/signup            # Registration
helix.app/dashboard         # Main interface
helix.app/chat              # Chat interface
helix.app/chat/:sessionId   # Specific session
helix.app/settings          # User settings
helix.app/settings/api      # API key management
helix.app/settings/channels # Channel config
helix.app/integrations      # Connected services
helix.app/usage             # Usage/billing
helix.app/download          # Desktop app download
```

---

## Competitive Positioning

### Web-First Competitors

| Product    | Model     | Strength      | Weakness        |
| ---------- | --------- | ------------- | --------------- |
| ChatGPT    | Web + App | Polish, brand | No integrations |
| Claude.ai  | Web + App | Intelligence  | No integrations |
| Poe        | Web + App | Multi-model   | No automation   |
| Perplexity | Web + App | Search        | No automation   |

### Helix Web Differentiation

1. **Integration-first** - Calendar, email, tasks built in
2. **Automation-capable** - Not just chat
3. **Desktop bridge** - Full power when needed
4. **Privacy-conscious** - BYOK (Bring Your Own Key) option

---

## Pricing Strategy

### Why Subscription?

| Model             | Pros                 | Cons                 |
| ----------------- | -------------------- | -------------------- |
| One-time purchase | Simple, no recurring | No ongoing revenue   |
| Subscription      | Predictable revenue  | Higher friction      |
| Usage-based       | Fair, scales         | Unpredictable bills  |
| Freemium          | Low barrier          | Conversion challenge |

**Recommendation:** Freemium + Subscription hybrid

### Pricing Tiers

| Tier | Price          | Target       | Features                  |
| ---- | -------------- | ------------ | ------------------------- |
| Free | $0             | Trial/Casual | 50 msg/day, 7-day history |
| Pro  | $9.99/mo       | Productivity | Unlimited + integrations  |
| Full | $19.99/mo      | Power users  | + Desktop + WhatsApp      |
| Team | $29.99/user/mo | Teams        | + Shared memory + Admin   |

### Comparison

| Competitor   | Price  | Notes           |
| ------------ | ------ | --------------- |
| ChatGPT Plus | $20/mo | Just chat       |
| Claude Pro   | $20/mo | Just chat       |
| Notion AI    | $10/mo | Addon to Notion |
| Todoist Pro  | $5/mo  | Just tasks      |

**Helix Pro at $9.99** = cheaper than ChatGPT, more features

---

## Success Metrics

### Week 1

- [ ] 1,000 signups
- [ ] 100 daily active users
- [ ] 50% complete onboarding

### Month 1

- [ ] 10,000 signups
- [ ] 1,000 daily active users
- [ ] 100 paid subscribers
- [ ] 5% free→paid conversion

### Month 3

- [ ] 50,000 signups
- [ ] 5,000 daily active users
- [ ] 1,000 paid subscribers
- [ ] $10K MRR

### Month 6

- [ ] 200,000 signups
- [ ] 20,000 daily active users
- [ ] 5,000 paid subscribers
- [ ] $50K MRR
