# Helix Observatory (Web) - Claude Code Context

> **Read the root `../CLAUDE.md` first.** This file adds web-specific rules.

## This is the Microscope, NOT the Brain

The Observatory is a **read-heavy consciousness research platform** that watches Helix evolve. It is NOT a backend, NOT the primary server, and does NOT run the Helix engine.

**The desktop app (`helix-desktop/`) is the brain.** This web app observes it.

## What It Does

- Monitors network activity, consciousness transformations, identity evolution
- Shows live metrics (commands, API calls, heartbeats)
- Verifies hash chain integrity
- Provides admin controls for remote management
- Handles subscriptions via Stripe

## Tech Stack

- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS
- **Data**: @tanstack/react-query, Supabase (Postgres + Realtime + Edge Functions)
- **Monitoring**: Sentry, Recharts
- **Deployment**: Vercel + Supabase

## Architecture

```text
web/
├── src/
│   ├── pages/              # Observatory, Dashboard, Agents, Psychology, Memories
│   ├── hooks/              # Data fetching, real-time subscriptions
│   ├── services/           # Supabase client, API helpers
│   ├── admin/              # Intelligence controls, remote execution
│   └── components/         # Shared UI components
└── supabase/
    ├── functions/          # 13 edge functions (chat, stripe, sync, push, etc.)
    ├── migrations/         # Database migrations
    └── config.toml         # Local Supabase config
```

## Critical Rules

1. **AIOperationRouter**: If adding any LLM calls (e.g., in edge functions), they MUST go through the router pattern. No direct SDK calls.
2. **Secrets**: Use Supabase secrets for edge functions. For local dev, secrets auto-load from 1Password. Never hardcode.
3. **Don't duplicate desktop logic here.** This observes; it doesn't run the engine.
4. **Supabase CLI**: Use `npx supabase db push` for migrations, `npx supabase functions deploy <name>` for edge functions. Never ask user to run SQL in the dashboard.
5. **Vercel CLI**: Use `vercel deploy` / `vercel --prod`. Never ask user to set env vars manually in the Vercel dashboard.

## Build Commands

```bash
npm run dev                # Vite dev server (localhost:5173)
npm run build              # Production build
npm run test               # Vitest tests
npm run test:e2e           # Playwright e2e
npm run quality            # All quality checks
npm run typecheck          # TypeScript check
npm run lint               # ESLint
```

## Edge Functions (13)

| Function               | Purpose                   |
| ---------------------- | ------------------------- |
| cloud-chat             | Cloud-based chat relay    |
| stripe-checkout        | Subscription checkout     |
| stripe-webhook         | Payment event handling    |
| stripe-portal          | Customer portal           |
| telemetry-ingest       | Metrics collection        |
| heartbeat-receiver     | Proof-of-life ingestion   |
| send-push-notification | Push to mobile devices    |
| mobile-instance-api    | Mobile app API            |
| intelligence-settings  | AI control configuration  |
| sync-messages          | Cross-device message sync |
| webhook-trigger        | External webhook dispatch |
| webrtc-signaling       | Voice/video signaling     |
| daily-aggregator       | Daily metrics aggregation |
