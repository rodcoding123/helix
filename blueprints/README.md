# Helix Desktop Transformation Blueprints

> Converting Helix from CLI developer tool to consumer-grade desktop application

## Overview

These blueprints define the complete transformation of Helix into a standalone desktop application with native installers, GUI-based onboarding, and seamless user experience for non-technical users.

## Quick Summary

| Aspect       | Current State                                      | Target State                     |
| ------------ | -------------------------------------------------- | -------------------------------- |
| Installation | `iwr -useb https://openclaw.ai/install.ps1 \| iex` | Download .exe/.dmg, double-click |
| Interface    | CLI + TUI                                          | Native GUI (Tauri + React)       |
| Onboarding   | CLI commands                                       | Visual wizard                    |
| Branding     | OpenClaw visible                                   | Pure "Helix"                     |
| Target Users | Developers                                         | Everyone                         |
| Distribution | npm/script                                         | Website + auto-updates           |

## Blueprints

### [01 - Master Architecture](./01-MASTER-ARCHITECTURE.md)

The complete system design showing how all components fit together.

**Key decisions:**

- Tauri 2.0 for desktop shell (Rust backend, React frontend)
- Node.js bundled for Helix Engine
- Gateway WebSocket as primary interface
- Optional cloud sync via Supabase

### [02 - Desktop App](./02-DESKTOP-APP.md)

Technical specification for the Tauri-based desktop application.

**Covers:**

- Project structure
- Rust backend implementation
- React frontend components
- Build configuration
- Platform-specific notes

### [03 - OpenClaw Integration](./03-OPENCLAW-INTEGRATION.md)

Strategy for absorbing OpenClaw as the internal "Helix Engine."

**Key points:**

- Remove CLI components
- Keep Gateway as primary interface
- Create programmatic API
- Maintain upstream sync capability
- Full Helix branding

### [04 - Onboarding Wizard](./04-ONBOARDING-WIZARD.md)

First-run experience design for new users.

**Flow:**

1. Welcome
2. Account (optional)
3. AI Provider (API key)
4. Discord Logging (optional)
5. Personality
6. Privacy Choice
7. First Chat
8. Completion

**Modes:**

- Fast path (~3-5 minutes) - smart defaults
- Advanced path (~8-12 minutes) - full control

### [05 - Distribution](./05-DISTRIBUTION.md)

Packaging, signing, and delivering Helix to users.

**Platforms:**

- Windows: NSIS installer (.exe)
- macOS: DMG with notarization
- Linux: AppImage, .deb, .rpm

**Features:**

- Code signing on all platforms
- Auto-updates via Tauri Updater
- Download page at project-helix.org

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

- [ ] Initialize Tauri project
- [ ] Set up build pipeline
- [ ] Port React components from web/
- [ ] Create Rust backend stubs
- [ ] Basic Gateway spawner

### Phase 2: Core Features (Weeks 5-8)

- [ ] Complete chat interface
- [ ] Settings panel
- [ ] Basic onboarding wizard
- [ ] Config system integration
- [ ] System tray

### Phase 3: Integration (Weeks 9-12)

- [ ] Create helix-engine package
- [ ] Remove OpenClaw CLI
- [ ] Integrate psychological architecture
- [ ] Discord logging
- [ ] Hash chain integrity

### Phase 4: Polish (Weeks 13-16)

- [ ] Advanced onboarding features
- [ ] Psychology visualization
- [ ] Memory browser
- [ ] Performance optimization
- [ ] Accessibility audit

### Phase 5: Distribution (Weeks 17-20)

- [ ] Code signing setup
- [ ] Installer creation
- [ ] Auto-update testing
- [ ] Beta program
- [ ] Launch preparation

---

## Technical Stack

```
┌────────────────────────────────────────────────────┐
│                  HELIX DESKTOP                      │
├────────────────────────────────────────────────────┤
│  Shell          │  Tauri 2.0 (Rust)                │
│  Frontend       │  React 18 + TypeScript           │
│  Build          │  Vite 5.x                        │
│  Styling        │  Tailwind CSS 3.4                │
│  State          │  Zustand + React Query           │
│  Engine         │  Node.js 22 (bundled)            │
│  AI             │  Claude API (Anthropic)          │
│  Database       │  SQLite (local), Supabase (cloud)│
│  Updates        │  Tauri Updater                   │
└────────────────────────────────────────────────────┘
```

---

## Key Decisions

### Why Tauri over Electron?

| Factor            | Electron        | Tauri        |
| ----------------- | --------------- | ------------ |
| Bundle size       | ~150MB+         | ~15-50MB     |
| Memory usage      | Higher          | Lower        |
| Security          | Node.js surface | Rust sandbox |
| Self-modification | ✅ Runtime      | ❌ Binary    |

**Decision**: Tauri. Helix's self-modification happens at the filesystem level (configs, psychology, skills), not the app shell. Smaller bundles are critical for "normie" adoption.

### Why Keep OpenClaw as Dependency?

1. **Upstream updates**: Bug fixes, new features, security patches
2. **Community**: Benefit from OpenClaw ecosystem
3. **Reduced maintenance**: Don't reinvent the wheel
4. **Clear separation**: Engine vs. shell concerns

### Why Discord for Logging?

1. **External to Helix**: She can't modify Discord's records
2. **Timestamped**: Discord's servers provide proof
3. **Accessible**: Users can see logs in real-time
4. **Free**: No infrastructure cost

---

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [OpenClaw Repository](https://github.com/anthropics/openclaw)
- [Project Helix Website](https://project-helix.org)

---

## Getting Started

To begin implementation:

```bash
# 1. Read the blueprints in order
# 2. Set up development environment

# Prerequisites
- Node.js 22+
- Rust (stable)
- pnpm

# Clone and setup
cd helix
pnpm install

# Create desktop app directory
npx create-tauri-app helix-desktop --template react-ts

# Follow Blueprint 02 for structure setup
```

---

## Questions?

These blueprints are living documents. As implementation progresses, update them with learnings and decisions.
