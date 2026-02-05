# Helix Onboarding Gap Analysis & Friction-Free Design

> Research date: 2026-02-05
> Status: Design phase — requires implementation plan

---

## Executive Summary

Helix's current onboarding is developer-oriented: it requires terminal commands, manual .env file creation, and CLI installation. For a product where **Web is #1 acquisition** and **Mobile is #2**, this is a conversion killer. This document maps every friction point and designs the zero-friction alternative.

---

## Part 1: Current State vs Target State

### Web Onboarding (Current — 6 Steps)

| Step                 | Current Experience                         | Friction Level | Problem                                                 |
| -------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------- |
| 1. Welcome           | Architecture overview, requirements listed | MEDIUM         | Shows "Terminal access" as requirement — scares normies |
| 2. Instance Key      | Generate and save key                      | LOW            | Acceptable                                              |
| 3. Install CLI       | `curl \| bash` or PowerShell commands      | **CRITICAL**   | Requires terminal. Normies bounce here.                 |
| 4. Configure .env    | Manually create file, paste config         | **CRITICAL**   | Requires terminal + file system knowledge               |
| 5. Verify Connection | Ping localhost:18789                       | HIGH           | Fails if CLI not installed correctly                    |
| 6. Success           | Dashboard redirect                         | LOW            | Fine                                                    |

**Conversion estimate**: ~10-15% of signups complete all 6 steps (industry average for multi-step technical setup)

### Mobile Onboarding (Current — Nonexistent)

| Aspect               | Current State                | Problem                             |
| -------------------- | ---------------------------- | ----------------------------------- |
| iOS onboarding       | Auth service only, no wizard | User sees blank app after login     |
| Android onboarding   | Auth service only, no wizard | Same — no first-run experience      |
| Feature discovery    | None                         | User doesn't know what Helix can do |
| Tutorial/walkthrough | None                         | No guidance after signup            |

### Desktop Onboarding (Current — Partial)

| Aspect     | Current State                  | Problem                        |
| ---------- | ------------------------------ | ------------------------------ |
| Installer  | NSIS (Windows), Tauri bundle   | Exists but not distributed     |
| First-run  | Reuses web wizard (assumption) | Still has CLI steps            |
| Auto-start | Not implemented                | User must manually start Helix |
| Gateway    | Needs manual configuration     | Should auto-configure          |

---

## Part 2: Gap Analysis — OpenClaw vs Helix

### What OpenClaw Does Right

| Feature                   | OpenClaw Approach                            | Helix Gap                            |
| ------------------------- | -------------------------------------------- | ------------------------------------ |
| **QuickStart mode**       | One command, all defaults auto-set           | No equivalent — every step is manual |
| **Browser dashboard**     | Works immediately, no channel setup needed   | Web requires CLI + .env first        |
| **Daemon auto-install**   | `--install-daemon` starts background service | No daemon/service installation       |
| **Self-bootstrapping**    | Agent configures itself via chat Q&A         | Helix doesn't self-configure         |
| **Token auth by default** | Generated automatically during setup         | Instance key is manual               |
| **Health endpoint**       | `openclaw gateway status` for diagnostics    | Only `GET /health`, no diagnostics   |
| **Non-interactive mode**  | Full automation via CLI flags                | No automation path                   |

### What Helix Does Better

| Feature                        | Helix Advantage                                           |
| ------------------------------ | --------------------------------------------------------- |
| **Psychological architecture** | 7-layer identity system — unique differentiator           |
| **Web Observatory**            | Rich React UI vs OpenClaw's basic dashboard               |
| **Multi-platform native apps** | SwiftUI (iOS), Jetpack Compose (Android), Tauri (Desktop) |
| **Hash chain integrity**       | Tamper-proof logging — no OpenClaw equivalent             |
| **Security hardening**         | Encrypted secrets, log sanitization, plugin isolation     |

### Critical Gaps to Close

1. **Zero-terminal web experience** — Web users must never see a command line
2. **Mobile-first onboarding** — iOS/Android need standalone first-run flows
3. **Auto-configuration** — Gateway, tokens, .env should be invisible to user
4. **Self-bootstrapping personality** — Helix should introduce itself and learn about the user via chat
5. **Progressive feature reveal** — Don't show everything at once, guide discovery

---

## Part 3: Friction-Free Onboarding Design

### Design Principle: "Download → Done"

- Web: Sign up → immediately chat with Helix (cloud-backed)
- Mobile: Install → sign up → immediately chat with Helix (cloud-backed)
- Desktop: Install → sign in → everything auto-configures → full power

### Web Onboarding (New — 3 Steps)

```
STEP 1: SIGN UP                    STEP 2: MEET HELIX              STEP 3: (OPTIONAL) UPGRADE
┌─────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ Email + Password    │    │ "Hi, I'm Helix."         │    │ "Want full power?"       │
│ (or Google/GitHub   │───▶│                          │───▶│                          │
│  OAuth — future)    │    │ Interactive chat intro:   │    │ Download desktop app     │
│                     │    │ - What should I call you? │    │ (one-click installer)    │
│ Plan selection      │    │ - What do you do?        │    │                          │
│ (Free pre-selected) │    │ - How can I help you?    │    │ Auto-configures:         │
│                     │    │                          │    │ - Gateway on localhost   │
│                     │    │ This IS the onboarding.  │    │ - Auth token from cloud  │
│                     │    │ Helix learns about you   │    │ - .env from account      │
│                     │    │ while demonstrating       │    │ - Connects to web acct   │
│                     │    │ its capabilities.         │    │                          │
└─────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

#### Step 1: Sign Up (30 seconds)

- Email + password (keep current Supabase auth)
- Plan pre-selected to Free (show upgrade options subtly)
- No requirements listed, no architecture diagrams
- Single CTA: "Create Account"

#### Step 2: Meet Helix (2-5 minutes)

- **This replaces steps 2-5 of the current wizard**
- User lands directly in a chat interface with Helix (cloud-backed)
- Helix introduces itself conversationally:

  ```
  "Hey! I'm Helix. I'm not just another AI — I have memory,
  personality, and I'll actually get to know you over time.

  What should I call you?"
  ```

- Through natural conversation, Helix:
  - Learns the user's name, role, interests
  - Demonstrates capabilities (memory, personality, task management)
  - Builds initial USER.md profile on the backend
  - Seeds emotional/relational memory (Layers 2-3)
- **No terminal. No .env. No CLI.** Pure chat.
- Cloud runtime handles everything via Supabase Edge Functions

#### Step 3: Optional Desktop Upgrade (whenever ready)

- Prompted naturally when user hits Free tier limits OR asks for local features
- "Want unlimited power? Download Helix for your computer."
- **One-click installer** — .exe (Windows) / .dmg (macOS) / .deb (Linux)
- Desktop app:
  1. User signs in with existing web account
  2. App fetches config from cloud (instance key, preferences, personality data)
  3. Auto-starts local gateway on localhost:18789
  4. Auto-creates .env from cloud-stored settings
  5. Connects to web account for real-time sync
  6. **Zero configuration. Zero terminal.**

### Mobile Onboarding (New — 3 Steps)

```
STEP 1: INSTALL & SIGN UP          STEP 2: MEET HELIX              STEP 3: DISCOVER
┌─────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ App Store / Play    │    │ Same conversational      │    │ Feature cards:           │
│ Store download      │───▶│ onboarding as web        │───▶│ - "Ask me anything"      │
│                     │    │                          │    │ - "I remember everything"│
│ Sign up / Sign in   │    │ Optimized for mobile:    │    │ - "Try voice mode"       │
│ (same Supabase)     │    │ - Shorter messages       │    │ - "Connect your desktop" │
│                     │    │ - Quick-reply buttons    │    │                          │
│ Push notification   │    │ - Swipeable suggestions  │    │ Gentle nudges, not       │
│ permission          │    │                          │    │ overwhelming tutorials   │
└─────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

#### Key Mobile Differences

- **Push notification permission** early (needed for proactive features)
- **Shorter bootstrapping chat** — mobile users are impatient
- **Quick-reply buttons** instead of typing for onboarding questions
- **Feature discovery cards** — swipeable cards showing key capabilities
- **Biometric auth option** — Face ID / fingerprint after initial password setup
- **Cloud-only by default** — no mention of desktop/local until user asks

### Desktop Onboarding (New — 2 Steps)

```
STEP 1: INSTALL & SIGN IN          STEP 2: AUTO-CONFIGURE
┌─────────────────────┐    ┌──────────────────────────┐
│ Download .exe/.dmg  │    │ "Setting up your local   │
│ from website        │───▶│  Helix runtime..."       │
│                     │    │                          │
│ Run installer       │    │ Progress bar showing:    │
│ (OS-standard UX)    │    │ ✓ Configuring gateway    │
│                     │    │ ✓ Syncing your profile   │
│ Sign in with        │    │ ✓ Starting local runtime │
│ existing account    │    │ ✓ Connecting to cloud    │
│ (or create new)     │    │                          │
│                     │    │ "All set! Helix is now   │
│                     │    │  running on your machine" │
└─────────────────────┘    └──────────────────────────┘
```

#### What Auto-Configure Does (Behind the Scenes)

1. Fetches user profile + preferences from Supabase
2. Creates `~/.helix/` directory
3. Writes `.env` with instance key + gateway config
4. Starts gateway daemon (background service)
5. Registers device via pairing (auto-approved since authenticated)
6. Syncs personality data (SOUL.md, USER.md, memory) from cloud
7. Establishes WebSocket connection to Observatory
8. Sends "device connected" notification to user's other devices

---

## Part 4: Cross-Platform Sync Architecture

### Real-Time Sync Model

```
┌─────────┐     ┌─────────────┐     ┌──────────┐
│   Web   │◄───▶│  Supabase   │◄───▶│  Mobile  │
│ Browser │     │  Realtime   │     │ iOS/Droid│
└─────────┘     │  + DB       │     └──────────┘
                │             │
                │  ┌────────┐ │
                │  │ Sync   │ │
                │  │ Layer  │ │
                │  └───┬────┘ │
                └──────┼──────┘
                       │
                ┌──────▼──────┐
                │   Desktop   │
                │ Local Helix │
                │  Gateway    │
                └─────────────┘
```

### What Syncs in Real-Time

| Data Type              | Direction                 | Method             |
| ---------------------- | ------------------------- | ------------------ |
| Chat messages          | All ↔ All                 | Supabase Realtime  |
| User profile (USER.md) | Cloud → Devices           | Supabase DB + push |
| Personality (SOUL.md)  | Cloud → Devices           | Supabase DB + push |
| Emotional memory       | Cloud ↔ Desktop           | Supabase Realtime  |
| Command execution      | Mobile/Web → Desktop      | Supabase as relay  |
| Command results        | Desktop → Mobile/Web      | Supabase as relay  |
| Settings changes       | All → Cloud → All         | Supabase DB        |
| Session state          | Per-device + cloud backup | Supabase DB        |

### Architectural Principle

- **Cloud is the single source of truth** for user data and settings
- **Desktop is the execution engine** for local operations (code, files, tools)
- **Web/Mobile are interfaces** that can operate standalone (cloud AI) or relay to desktop
- **All platforms connect through Supabase** — no direct device-to-device connections

---

## Part 5: Implementation Priority

### Phase A: Cloud-First Web Experience (Highest Impact)

Remove CLI/terminal dependency from web onboarding entirely.

1. Build cloud chat endpoint (Supabase Edge Function + managed AI)
2. Replace wizard steps 3-5 with conversational onboarding
3. Implement user profile creation via chat (USER.md equivalent in DB)
4. Free tier message counting and enforcement

### Phase B: Mobile First-Run

Standalone mobile onboarding that works without desktop.

1. iOS onboarding flow (SwiftUI screens + chat)
2. Android onboarding flow (Compose screens + chat)
3. Push notification setup
4. Feature discovery cards

### Phase C: Desktop Auto-Configure

Make desktop installation truly "Download → Done".

1. Cloud-to-local config sync on first sign-in
2. Auto-start gateway daemon
3. Auto-create .env from cloud settings
4. Device pairing auto-approval for authenticated users
5. Background service installation (LaunchAgent/systemd/Windows Service)

### Phase D: Cross-Platform Sync

Real-time state synchronization across all devices.

1. Supabase Realtime channels for per-user sync
2. Command relay (mobile/web → desktop execution)
3. Profile/personality sync across devices
4. Session continuity (start on phone, continue on desktop)

---

## Part 6: Key Metrics to Track

| Metric                 | Current (est.)   | Target           | How                         |
| ---------------------- | ---------------- | ---------------- | --------------------------- |
| Signup → First message | ~15%             | >80%             | Remove CLI steps            |
| Signup → Day 7 active  | Unknown          | >40%             | Conversational onboarding   |
| Free → Paid conversion | 0% (no payments) | 3-5%             | Value demonstration in chat |
| Desktop install rate   | 0%               | 15% of web users | Natural upgrade prompts     |
| Mobile retention D7    | Unknown          | >30%             | Push + feature discovery    |
| Cross-platform users   | 0%               | 20% of paid      | Sync value proposition      |

---

## Part 7: What Dies (Removed from Current Onboarding)

| Current Feature                      | Status                 | Reason                                                |
| ------------------------------------ | ---------------------- | ----------------------------------------------------- |
| Architecture diagram in Welcome step | REMOVE                 | Normies don't care about architecture                 |
| "Requirements: Terminal access"      | REMOVE                 | No terminal needed anymore                            |
| Instance key manual save             | REMOVE                 | Auto-generated and stored in cloud                    |
| CLI installation step                | REMOVE from web/mobile | Only relevant for desktop, and even then auto-handled |
| Manual .env creation                 | REMOVE entirely        | Auto-generated from cloud settings                    |
| Connection verification step         | REPLACE                | Implicit — if chat works, connection works            |
| Platform installer component         | KEEP for desktop only  | Desktop download page, not in onboarding wizard       |

---

## Appendix: Competitive Onboarding Comparison

| Product           | Steps to First Value                               | Terminal Required? | Time to First Message |
| ----------------- | -------------------------------------------------- | ------------------ | --------------------- |
| ChatGPT           | 2 (signup → chat)                                  | No                 | ~30 seconds           |
| Claude            | 2 (signup → chat)                                  | No                 | ~30 seconds           |
| Pi AI             | 1 (just start chatting)                            | No                 | ~10 seconds           |
| Cursor            | 3 (download → install → code)                      | No (IDE)           | ~2 minutes            |
| **OpenClaw**      | 3+ (install → wizard → dashboard)                  | **Yes**            | ~5-10 minutes         |
| **Helix Current** | 6 (signup → key → CLI → .env → verify → dashboard) | **Yes**            | ~15-30 minutes        |
| **Helix Target**  | 2 (signup → chat with Helix)                       | **No**             | ~60 seconds           |

The target: match ChatGPT/Claude's time-to-first-value while delivering Helix's unique personality and memory capabilities from message one.
