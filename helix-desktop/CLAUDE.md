# Helix Desktop - Claude Code Context

> **Read the root `../CLAUDE.md` first.** This file adds desktop-specific rules.

## This IS the Brain

**The desktop app is the primary server.** It runs the full Helix engine, 35+ tools, MCPs, and multi-agent orchestration. Everything else (web, iOS, Android) is a remote control.

**There is NO separate backend/VPS.** The `helix-runtime` gateway runs INSIDE this Tauri app.

## Tech Stack

- **Framework**: Tauri v2 (Rust backend) + React 19 (frontend)
- **State**: Zustand stores (`chatStore`, `configStore`, `sessionStore`, `uiStore`)
- **Build**: Vite 7, TypeScript strict mode
- **Testing**: Vitest (unit), Playwright (e2e), Percy (visual regression)

## Architecture

```text
helix-desktop/
├── src/                    # React 19 frontend (40+ component dirs)
│   ├── components/         # UI components by feature
│   ├── stores/             # Zustand state management
│   ├── hooks/              # Custom React hooks
│   └── services/           # API/gateway communication
└── src-tauri/              # Rust backend
    ├── src/                # Tauri commands, gateway, tray, updater
    └── Cargo.toml          # Rust dependencies
```

## Critical Rules

1. **AIOperationRouter**: ALL LLM calls go through `router.route()`. Never `new Anthropic()` or direct SDK calls.
2. **Secrets**: Auto-load from 1Password via `secrets-loader.ts`. Never hardcode. Never ask user to paste.
3. **Pre-execution logging**: Log to Discord BEFORE actions. Fail-closed if logging fails.
4. **Don't duplicate in web/mobile**: This is the source of truth. Web observes, mobile controls remotely.

## Build Commands

```bash
npm run dev                # Vite dev server
npm run tauri:dev          # Tauri dev mode with hot reload
npm run tauri:build        # Production build
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright e2e
npm run typecheck          # TypeScript check
npm run lint               # ESLint
```
