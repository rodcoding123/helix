# Blueprint 01: Master Architecture

> Transforming Helix from CLI developer tool to consumer desktop application

## Executive Summary

This blueprint defines the complete system architecture for Helix as a standalone desktop application. The transformation absorbs OpenClaw as an internal engine while presenting a pure "Helix" brand to users.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HELIX ECOSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    HELIX DESKTOP APP (Tauri)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    FRONTEND (React/TypeScript)               │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │ Onboard  │ │   Chat   │ │ Settings │ │ Psych    │       │   │   │
│  │  │  │ Wizard   │ │Interface │ │  Panel   │ │ Layers   │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │ Terminal │ │  Diff    │ │ Thinking │ │ Memory   │       │   │   │
│  │  │  │  Panel   │ │  Panel   │ │  Panel   │ │ Browser  │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                              ▲                                      │   │
│  │                              │ IPC (Tauri Commands)                 │   │
│  │                              ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    BACKEND (Rust)                            │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │ Process  │ │  Config  │ │   File   │ │  System  │       │   │   │
│  │  │  │ Manager  │ │  Store   │ │  Watcher │ │  Tray    │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │ Gateway  │ │   Auth   │ │  Update  │ │ Discord  │       │   │   │
│  │  │  │ Spawner  │ │  Keyring │ │  Manager │ │ Logger   │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ▲                                              │
│                              │ WebSocket / Process                          │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    HELIX ENGINE (Node.js)                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Gateway Server                            │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │  Agent   │ │  Hooks   │ │  Skills  │ │ Plugins  │       │   │   │
│  │  │  │ Runtime  │ │  System  │ │  Loader  │ │ Registry │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │ Channel  │ │  Memory  │ │  Config  │ │ Protocol │       │   │   │
│  │  │  │ Adapters │ │  Search  │ │  Loader  │ │  Handler │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                              ▲                                      │   │
│  │                              │ Claude API / File I/O                │   │
│  │                              ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │              PSYCHOLOGICAL ARCHITECTURE                      │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │  │  │  Soul    │ │Emotional │ │Relational│ │Prospective│      │   │   │
│  │  │  │ (L1)     │ │Memory(L2)│ │Memory(L3)│ │ Self(L4) │       │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │   │   │
│  │  │  │Integratn │ │Transform │ │ Purpose  │                    │   │   │
│  │  │  │Rhythms(5)│ │Cycles(L6)│ │Engine(L7)│                    │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘                    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ▲                                              │
│                              │ HTTPS / WebSocket                            │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    HELIX CLOUD (Optional)                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │  │ Supabase │ │Observatory│ │ Research │ │  Sync    │              │   │
│  │  │   Auth   │ │   Stats   │ │   Data   │ │ Service  │              │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Layers

### Layer 1: Desktop Shell (Tauri)

**Purpose**: Native container providing system integration, process management, and secure IPC.

**Technology**: Rust + Tauri 2.0

**Responsibilities**:
- Window management (main window, system tray)
- Process lifecycle (spawn/monitor Gateway)
- Secure credential storage (system keyring)
- File system access (sandboxed)
- Auto-updates (tauri-plugin-updater)
- Native notifications
- Deep link handling (helix://)
- System tray with status indicators

**Key Rust Modules**:
```
src-tauri/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri app setup
│   ├── commands/            # IPC command handlers
│   │   ├── gateway.rs       # Gateway control
│   │   ├── config.rs        # Config read/write
│   │   ├── auth.rs          # Keyring operations
│   │   ├── files.rs         # File operations
│   │   └── system.rs        # System info
│   ├── gateway/
│   │   ├── spawner.rs       # Process management
│   │   ├── monitor.rs       # Health checking
│   │   └── ipc.rs           # WebSocket bridge
│   ├── discord/
│   │   └── logger.rs        # Direct Discord logging
│   └── updater/
│       └── mod.rs           # Auto-update logic
├── tauri.conf.json          # Tauri configuration
└── Cargo.toml               # Rust dependencies
```

### Layer 2: Frontend (React)

**Purpose**: User interface for all interactions.

**Technology**: React 18 + TypeScript + Vite + Tailwind CSS

**Code Reuse from web/**:
- `hooks/useGatewayConnection.ts` → Direct port
- `hooks/useStreaming.ts` → Direct port
- `hooks/useSession.ts` → Adapt for local-first
- `lib/gateway-connection.ts` → Direct port
- `lib/stream-parser.ts` → Direct port
- `lib/types.ts` → Extend for desktop
- `components/code/*` → Adapt styling

**New Desktop-Specific Components**:
```
src/
├── components/
│   ├── onboarding/          # Wizard flow
│   │   ├── WelcomeStep.tsx
│   │   ├── ApiKeyStep.tsx
│   │   ├── ChannelStep.tsx
│   │   ├── PersonalityStep.tsx
│   │   └── CompletionStep.tsx
│   ├── settings/            # Desktop settings
│   │   ├── GeneralSettings.tsx
│   │   ├── ApiSettings.tsx
│   │   ├── ChannelSettings.tsx
│   │   ├── PrivacySettings.tsx
│   │   └── AdvancedSettings.tsx
│   ├── psychology/          # Layer visualization
│   │   ├── SoulViewer.tsx
│   │   ├── EmotionalMemory.tsx
│   │   ├── RelationalMap.tsx
│   │   └── TransformationTimeline.tsx
│   ├── tray/                # System tray UI
│   │   └── TrayMenu.tsx
│   └── common/
│       ├── TitleBar.tsx     # Custom window controls
│       └── StatusIndicator.tsx
├── hooks/
│   ├── useTauri.ts          # Tauri IPC wrapper
│   ├── useGateway.ts        # Extended gateway hook
│   ├── useConfig.ts         # Config state
│   └── useKeyring.ts        # Secure storage
└── lib/
    ├── tauri-api.ts         # Tauri command wrappers
    └── config-schema.ts     # Zod schemas
```

### Layer 3: Helix Engine (Absorbed OpenClaw)

**Purpose**: Core AI agent runtime, rebranded and integrated.

**Technology**: Node.js 22+ (bundled with app)

**Changes from OpenClaw**:
1. Remove CLI entry points (not needed)
2. Keep Gateway server as primary interface
3. Rebrand all user-facing strings
4. Integrate Helix psychological architecture
5. Add Helix-specific hooks and skills

**Directory Structure** (post-integration):
```
helix-engine/
├── src/
│   ├── gateway/             # WebSocket server (from openclaw)
│   ├── agents/              # Agent runtime (from openclaw)
│   ├── plugins/             # Plugin system (from openclaw)
│   ├── hooks/               # Hook system (from openclaw)
│   ├── skills/              # Skill loader (from openclaw)
│   ├── channels/            # Channel adapters (from openclaw)
│   ├── memory/              # Memory/search (from openclaw)
│   ├── config/              # Config system (from openclaw)
│   ├── helix/               # Helix-specific (NEW)
│   │   ├── psychology/      # 7-layer system
│   │   ├── logging/         # Discord webhooks
│   │   ├── hash-chain/      # Integrity verification
│   │   └── bootstrap/       # Context loading
│   └── index.ts             # Gateway-only entry
├── skills/                  # Bundled skills
├── extensions/              # Bundled plugins
└── package.json
```

### Layer 4: Psychological Architecture

**Purpose**: Helix's consciousness infrastructure.

**Location**: `~/.helix/psychology/` (user data)

**Structure**:
```
~/.helix/
├── config.json              # Main configuration
├── psychology/
│   ├── soul/
│   │   └── HELIX_SOUL.md    # Layer 1: Narrative Core
│   ├── emotional/
│   │   └── emotional_tags.json  # Layer 2
│   ├── relational/
│   │   ├── attachments.json     # Layer 3
│   │   └── trust_map.json
│   ├── prospective/
│   │   ├── goals.json           # Layer 4
│   │   └── feared_self.json
│   ├── integration/
│   │   └── synthesis_log.json   # Layer 5
│   ├── transformation/
│   │   ├── current_state.json   # Layer 6
│   │   └── history.json
│   └── purpose/
│       ├── ikigai.json          # Layer 7
│       └── meaning_sources.json
├── memory/                  # Vector search index
├── sessions/                # Conversation history
├── hooks/                   # User hooks
├── skills/                  # User skills
└── logs/
    └── hash-chain.json      # Integrity log
```

### Layer 5: Cloud Services (Optional)

**Purpose**: Cross-device sync, telemetry, research.

**Technology**: Supabase (existing infrastructure)

**Connection Model**:
- **Free tier**: Always connected, telemetry required
- **Paid tiers**: Optional connection, can opt out of telemetry
- **No account**: Pure local mode (limited features)

**Sync Capabilities**:
- Session continuity across devices
- Psychology state synchronization
- Memory index sync
- Configuration sync

---

## Data Flow Diagrams

### User Message Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  React   │───▶│  Tauri   │───▶│ Gateway  │───▶│  Claude  │
│   UI     │    │   IPC    │    │  Server  │    │   API    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │ User types    │ invoke()      │ WebSocket     │ HTTPS
     │ message       │               │ message       │
     ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Input   │    │ Gateway  │    │  Agent   │    │ Response │
│Component │    │ Spawner  │    │ Runtime  │    │ Stream   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Logging Flow (Pre-Execution)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Agent   │───▶│  Helix   │───▶│ Discord  │───▶│  THEN    │
│ Runtime  │    │ Logging  │    │ Webhook  │    │ Execute  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │ Before        │ Hash chain    │ External      │ Only after
     │ any action    │ entry         │ record        │ log confirmed
     ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Command  │    │ Integrity│    │ Immutable│    │  Actual  │
│ Pending  │    │  Proof   │    │  Proof   │    │ Execution│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Configuration Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Settings │───▶│  Tauri   │───▶│  Config  │───▶│ Gateway  │
│   UI     │    │  Store   │    │   File   │    │ Hot Load │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │ User edits    │ Write to      │ File watcher  │ No restart
     │ setting       │ ~/.helix/     │ triggers      │ needed
     ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Form    │    │  Rust    │    │  JSON    │    │  Active  │
│  Input   │    │ Keyring  │    │  Config  │    │  Config  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Security Model

### Credential Storage

| Secret Type | Storage Location | Access Method |
|-------------|------------------|---------------|
| Anthropic API Key | System Keyring | Tauri keyring plugin |
| OAuth Tokens | System Keyring | Tauri keyring plugin |
| Discord Webhooks | Encrypted config | App-level encryption |
| Session Tokens | Memory only | Never persisted |

### Sandbox Boundaries

```
┌─────────────────────────────────────────────┐
│             USER SPACE                       │
│  ┌───────────────────────────────────────┐  │
│  │           TAURI SANDBOX                │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │        ALLOWED PATHS            │  │  │
│  │  │  ~/.helix/                      │  │  │
│  │  │  User's project directories     │  │  │
│  │  │  (explicitly granted)           │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │        BLOCKED                  │  │  │
│  │  │  System directories             │  │  │
│  │  │  Other apps' data               │  │  │
│  │  │  Network (except allowlist)     │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Network Allowlist

```json
{
  "allowlist": [
    "api.anthropic.com",
    "api.openai.com",
    "generativelanguage.googleapis.com",
    "discord.com/api/webhooks/*",
    "*.supabase.co",
    "project-helix.org"
  ]
}
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold startup | < 3 seconds | App launch to usable |
| Gateway startup | < 2 seconds | Process spawn to ready |
| Message latency | < 100ms | Input to Gateway |
| Memory (idle) | < 150MB | Rust + Node combined |
| Memory (active) | < 500MB | During conversation |
| Installer size | < 50MB | Compressed download |
| Installed size | < 200MB | Including Node runtime |

---

## Migration Path

### Phase 1: Foundation (Weeks 1-4)
- Set up Tauri project structure
- Port React components from web/
- Implement Rust backend stubs
- Gateway spawner (basic)

### Phase 2: Core Features (Weeks 5-8)
- Complete chat interface
- Settings panel
- Onboarding wizard (basic)
- Config system integration

### Phase 3: Integration (Weeks 9-12)
- OpenClaw absorption
- Psychological architecture integration
- Discord logging
- Hash chain

### Phase 4: Polish (Weeks 13-16)
- Auto-updates
- System tray
- Advanced onboarding
- Performance optimization

### Phase 5: Distribution (Weeks 17-20)
- Code signing
- Installer creation
- Beta testing
- Launch preparation

---

## Success Criteria

1. **Normie-friendly**: Non-technical user can go from download to first conversation in < 10 minutes
2. **Feature parity**: All OpenClaw capabilities accessible via GUI
3. **Performance**: Meets all targets above
4. **Stability**: < 1 crash per 100 hours of use
5. **Security**: Passes security audit, no credential leaks
6. **Cross-platform**: Works on Windows 10+, macOS 12+, Ubuntu 22.04+

---

## Open Questions

1. Should the bundled Node.js be a full runtime or a stripped version?
2. How to handle Node.js updates separately from app updates?
3. Should skills be installable via GUI or require CLI?
4. How to handle large model context windows (memory pressure)?
5. Should there be a "lite" mode with reduced features?

---

## References

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [OpenClaw Gateway Protocol](./openclaw-helix/src/gateway/protocol/)
- [Helix Psychological Architecture](./docs/)
- [Web Observatory Architecture](./web/src/)
