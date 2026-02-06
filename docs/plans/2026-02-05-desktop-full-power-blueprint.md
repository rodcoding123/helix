# Helix Desktop App: Full Power Blueprint

> **Status:** PHASES A-J COMPLETE (2026-02-06). Integration work (routing, nav, typecheck) in progress.

**Goal:** Transform the Helix desktop app into the PRIMARY platform with FULL POWER over every helix-runtime capability. Currently the desktop surfaces ~30% of gateway methods. Target: 90%+.

**Architecture:** Tauri 2 (Rust backend) + React 19 + Zustand 5, communicating with helix-runtime via WebSocket Protocol v3. Desktop registers as DUAL-ROLE client (operator + node).

**Tech Stack:** Tauri 2, React 19, TypeScript 5.8, Zustand 5, Vite 7, helix-runtime (OpenClaw fork)

---

## Completion Tracker

| Phase | Name                                    | Status      | Session      |
| ----- | --------------------------------------- | ----------- | ------------ |
| A     | Foundation & Onboarding Fix             | DONE        | Session 2    |
| B     | Agent Command Center                    | DONE        | Session 2    |
| C     | Skills Marketplace & Management         | DONE        | Sessions 2-3 |
| D     | Tools & Security Control                | DONE        | Session 3    |
| E     | Channel Powerhouse                      | DONE        | Session 3    |
| F     | Voice & Media Center                    | DONE        | Session 3    |
| G     | Session & Memory Intelligence           | DONE        | Session 3    |
| H     | Node & Device Network                   | DONE        | Session 3    |
| I     | Advanced Configuration                  | DONE        | Session 4    |
| J     | Polish & Distribution                   | DONE        | Session 4    |
| --    | Route Wiring + Nav + J5 Command Palette | IN PROGRESS | Session 4    |
| --    | TypeScript / Lint / Build Verification  | PENDING     | Session 4    |

---

## Current State Summary

### What We Have (helix-desktop)

| Category           | Status  | Coverage                                 |
| ------------------ | ------- | ---------------------------------------- |
| Chat interface     | Working | Full                                     |
| Gateway management | Working | Auto-start, health, lifecycle            |
| Authentication     | Working | Supabase + OAuth + Claude Code detection |
| Settings           | Working | 17 sections                              |
| Psychology layers  | Working | All 7 layers + decay + synthesis         |
| MCP servers        | Working | Full CRUD                                |
| Orchestrator       | Working | Job submission + monitoring              |
| Cron/Automation    | Working | Editor + manager                         |
| Memory/Knowledge   | Working | Browser + synthesis                      |
| Onboarding         | Working | 11-step tier-based flow                  |
| System tray        | Working | Basic menu                               |
| OS keyring         | Working | Secure secrets                           |
| File browser       | Working | Basic                                    |
| Git panel          | Working | Basic                                    |
| Sessions           | Partial | List only, no deep config                |
| Agent editor       | Partial | Basic CRUD, no routing                   |
| Skills             | Partial | Basic toggles only                       |
| Tools              | Partial | Basic toggles only                       |
| Channels           | Partial | Enable/disable only                      |
| Voice              | Partial | TTS/STT config, no Talk Mode             |

### What helix-runtime Provides (UNUSED by desktop)

| Capability              | Gateway Methods                             | Impact                 |
| ----------------------- | ------------------------------------------- | ---------------------- |
| **Exec Approvals**      | exec.approval.resolve/snapshot/configure    | CRITICAL - Security    |
| **Multi-Agent Routing** | agents.add/delete, bindings config          | CRITICAL - Power       |
| **Full Skills Mgmt**    | skills.install/uninstall/update/status/bins | HIGH - Extensibility   |
| **Tools Policy**        | tools.allow/deny/profile/byProvider         | HIGH - Security        |
| **Deep Channel Config** | channels.login/logout/config (per-channel)  | HIGH - Communication   |
| **Browser Automation**  | browser.start/stop/snapshot/navigate/action | HIGH - Automation      |
| **Node/Device Mgmt**    | nodes.discover/invoke/pair/verify/describe  | HIGH - Multi-device    |
| **Device Pairing**      | devices.approve/list/rotate                 | HIGH - Multi-device    |
| **Talk Mode**           | channels.talk-mode, TTS streaming           | MEDIUM - Voice UX      |
| **Session Config**      | sessions.compact, session scope/reset       | MEDIUM - State         |
| **Auth Profiles**       | auth.profiles, oauth.\*                     | MEDIUM - Provider mgmt |
| **Model Failover**      | models.failover chain                       | MEDIUM - Reliability   |
| **Sandbox Config**      | sandbox.mode/scope/docker                   | MEDIUM - Security      |
| **Hooks Management**    | hooks.list/enable/disable                   | LOW - Advanced         |
| **Config Includes**     | $include, multi-file config                 | LOW - Advanced         |
| **Deep Linking**        | helix:// URL scheme                         | LOW - UX               |
| **OpenAI-compat API**   | /v1/chat/completions endpoint               | LOW - External         |

---

## Architecture Decisions

### 1. Dual-Role Desktop Client

Currently the desktop app connects to the gateway with `role: "operator"` only. It should ALSO register as `role: "node"` to unlock native capabilities (camera, screen capture, clipboard, system.run, canvas).

**Implementation:** Either dual WebSocket connections or a single connection with combined role declaration.

**Files:**

- `helix-desktop/src/lib/gateway-client.ts` - Add node capabilities declaration
- `helix-desktop/src-tauri/src/commands/gateway.rs` - Handle node registration

### 2. User = Instance (Post-Migration)

The previous session eliminated the "instance" abstraction. Onboarding step `instance-registration` should become `device-registration`. The user IS their instance; we register devices, not instances.

**Files:**

- `helix-desktop/src/components/onboarding/` - Update registration step
- `helix-desktop/src/components/auth/InstanceRegistrationStep.tsx` - Rename to DeviceRegistrationStep

### 3. Gateway Token Security

Current: Hardcoded `"helix-desktop-local"` token.
Target: Generate cryptographically secure per-device token on first launch, store in OS keyring, pass to gateway on startup.

**Files:**

- `helix-desktop/src-tauri/src/commands/auth.rs` - Token generation
- `helix-desktop/src-tauri/src/commands/gateway.rs` - Pass token to gateway process

### 4. Gateway Config as Source of Truth

The gateway's `openclaw.json` config is the authoritative source. Desktop settings should read from AND write to this config via gateway protocol methods (config.get/set/patch), not maintain a separate `~/.helix/config.json`.

**Files:**

- `helix-desktop/src/stores/configStore.ts` - Sync with gateway config
- `helix-desktop/src/lib/gateway-client.ts` - Use config.patch method

---

## Phase A: Foundation & Onboarding Fix

**Goal:** Fix the foundations broken by User=Instance migration, secure the gateway token, and prepare for full power.

### Task A1: Update Onboarding for User=Instance

**Files:**

- Rename: `helix-desktop/src/components/auth/InstanceRegistrationStep.tsx` → `DeviceRegistrationStep.tsx`
- Modify: `helix-desktop/src/components/onboarding/Onboarding.tsx` - Update step flow
- Modify: `helix-desktop/src-tauri/src/commands/auth.rs` - `register_device()` instead of `register_instance()`

**Changes:**

- Replace "instance" language with "device" throughout onboarding
- `register_instance()` → `register_device()` - registers this machine with Supabase
- Store device_id (not instance_id) in local config
- Update Supabase table from `instances` to `devices` (or add device columns)

### Task A2: Secure Gateway Token Generation

**Files:**

- Modify: `helix-desktop/src-tauri/src/commands/auth.rs` - Add `generate_gateway_token()`
- Modify: `helix-desktop/src-tauri/src/commands/gateway.rs` - Pass secure token on startup
- Modify: `helix-desktop/src/lib/gateway-client.ts` - Use dynamic token

**Changes:**

- On first launch: Generate 256-bit random token, store in OS keyring as `helix-gateway-token`
- Pass to helix-runtime via `OPENCLAW_GATEWAY_TOKEN` env var when spawning
- Gateway client reads token from keyring, not hardcoded constant
- Support JWT auth mode from previous session's work

### Task A3: Gateway Config Synchronization

**Files:**

- Modify: `helix-desktop/src/stores/configStore.ts` - Dual-source config
- Modify: `helix-desktop/src/lib/gateway-client.ts` - Add config.schema method

**Changes:**

- On gateway connect: Fetch full config via `config.get`
- Settings UI reads/writes via `config.patch` (gateway protocol)
- Local config only for desktop-specific settings (window position, tray behavior)
- Gateway config for everything else (agents, channels, models, tools, skills)

### Task A4: Dual-Role Connection (Operator + Node)

**Files:**

- Modify: `helix-desktop/src/lib/gateway-client.ts` - Declare node capabilities
- Modify: `helix-desktop/src-tauri/src/commands/system.rs` - Expose native capabilities

**Changes:**

- Connect frame adds `caps: ["system", "clipboard"]` (and "camera", "screen" on supported platforms)
- Gateway recognizes desktop as both operator and node
- Enables system.run, system.notify via desktop's native Tauri commands
- Node capabilities depend on platform (macOS: camera, screen, system. Windows: system, clipboard)

---

## Phase B: Agent Command Center

**Goal:** Full multi-agent management with routing, workspaces, and identity.

### Task B1: Agent List & Management Panel

**Files:**

- Rewrite: `helix-desktop/src/components/agents/AgentEditor.tsx` → full management
- Create: `helix-desktop/src/components/agents/AgentList.tsx`
- Create: `helix-desktop/src/components/agents/AgentCard.tsx`
- Create: `helix-desktop/src/components/agents/AgentWorkspace.tsx`
- Create: `helix-desktop/src/components/agents/AgentIdentity.tsx`

**Gateway Methods Used:**

- `agents.list` - Get all agents with status
- `agents.add` - Create agent with workspace
- `agents.delete` - Remove agent
- `agents.identity` - Get/set agent identity (name, persona)
- `agent.wait` - Monitor agent activity

**UI:**

- Agent list with cards showing: name, status (active/idle), model, workspace path, session count
- "Add Agent" button → wizard: name, model, workspace, tools policy, sandbox mode
- Agent detail view: identity editor, workspace file browser, sessions, routing rules
- Per-agent model override, thinking level, timeout settings

### Task B2: Agent Routing & Bindings

**Files:**

- Create: `helix-desktop/src/components/agents/AgentBindings.tsx`
- Create: `helix-desktop/src/components/agents/BindingEditor.tsx`

**Gateway Methods Used:**

- `config.patch` (agents.list[], bindings[]) - Set routing rules

**UI:**

- Visual binding editor: drag channels/peers to agents
- Table view: channel + accountId + peer → agentId mapping
- "Most specific wins" rule visualization
- Test routing: "Which agent handles messages from X on Y channel?"

### Task B3: Agent Workspace Explorer

**Files:**

- Create: `helix-desktop/src/components/agents/WorkspaceExplorer.tsx`
- Create: `helix-desktop/src/components/agents/BootstrapFileEditor.tsx`

**Gateway Methods Used:**

- File system access via gateway (read/write bootstrap files)

**UI:**

- Tree view of agent workspace files
- Editors for: AGENTS.md, SOUL.md, TOOLS.md, USER.md, IDENTITY.md, BOOTSTRAP.md
- Markdown preview with syntax highlighting
- "Reset to defaults" per file

---

## Phase C: Skills Marketplace & Management

**Goal:** Full skill lifecycle management with ClawHub integration.

### Task C1: Skills Dashboard

**Files:**

- Rewrite: `helix-desktop/src/components/skills/` (existing stubs)
- Create: `helix-desktop/src/components/skills/SkillsDashboard.tsx`
- Create: `helix-desktop/src/components/skills/SkillCard.tsx`
- Create: `helix-desktop/src/components/skills/SkillDetail.tsx`

**Gateway Methods Used:**

- `skills.list` - All skills with status (enabled, requirements met, gating)
- `skills.status` - Individual skill health

**UI:**

- Skills grid with cards: name, description, enabled status, requirements status
- Filter by: installed/available, category, platform
- Quick enable/disable toggle per skill
- Skill detail: description, requirements, config, environment vars

### Task C2: ClawHub Integration

**Files:**

- Create: `helix-desktop/src/components/skills/ClawHubBrowser.tsx`
- Create: `helix-desktop/src/lib/clawhub-client.ts`

**Gateway Methods Used:**

- `skills.install` - Install from ClawHub
- `skills.uninstall` - Remove installed skill
- `skills.update` - Update to latest version
- `skills.bins` - Check binary availability

**UI:**

- Browse ClawHub skill registry (fetch from clawhub.com API)
- Search skills by name/category
- One-click install with requirement checking
- Update notifications for installed skills
- Uninstall confirmation

### Task C3: Custom Skill Editor

**Files:**

- Create: `helix-desktop/src/components/skills/SkillEditor.tsx`
- Create: `helix-desktop/src/components/skills/FrontmatterEditor.tsx`

**UI:**

- Create custom skills with SKILL.md editor
- Frontmatter YAML editor (name, description, requirements, gating)
- Markdown body editor for skill instructions
- Save to workspace skills directory
- Preview: "How will the agent see this skill?"

### Task C4: Per-Agent Skill Configuration

**Files:**

- Create: `helix-desktop/src/components/skills/AgentSkillConfig.tsx`

**Gateway Methods Used:**

- `config.patch` (agents.list[].skills) - Per-agent skill overrides

**UI:**

- Per-agent skill enable/disable
- Per-agent skill environment variable overrides
- Skill API key management per agent

---

## Phase D: Tools & Security Control

**Goal:** Full tools policy management, exec approval workflows, and sandbox configuration.

### Task D1: Tools Policy Editor

**Files:**

- Create: `helix-desktop/src/components/tools/ToolsPolicyEditor.tsx`
- Create: `helix-desktop/src/components/tools/ToolGroupToggle.tsx`

**Gateway Methods Used:**

- `config.patch` (tools.\*) - Set tool policies

**UI:**

- Tool profile selector: minimal / coding / messaging / full
- Allow/deny list editor with wildcard support
- Tool group toggles: group:runtime, group:fs, group:sessions, group:memory, group:web, group:ui, group:automation, group:messaging, group:nodes, group:openclaw
- Per-provider restrictions (tools.byProvider)
- Per-agent tool overrides

### Task D2: Exec Approvals Dashboard

**Files:**

- Create: `helix-desktop/src/components/security/ExecApprovalsDashboard.tsx`
- Create: `helix-desktop/src/components/security/ApprovalRequestCard.tsx`
- Create: `helix-desktop/src/components/security/ApprovalHistory.tsx`

**Gateway Methods Used:**

- `exec.approval.snapshot` - Get pending approvals
- `exec.approval.resolve` - Approve/deny
- `config.patch` (exec approvals) - Configure approval policies

**Events:**

- `exec.approval.requested` - Real-time approval notifications

**UI:**

- Pending approvals list with command details
- One-click Approve / Deny / Always Allow
- Approval history log
- Policy editor: global deny/allowlist, per-agent policies, glob patterns
- System tray notification on new approval request
- Native OS notification for pending approvals

### Task D3: Sandbox Configuration

**Files:**

- Create: `helix-desktop/src/components/security/SandboxConfig.tsx`

**Gateway Methods Used:**

- `config.patch` (agents.defaults.sandbox.\*) - Sandbox settings

**UI:**

- Sandbox mode toggle: off / non-main / all
- Sandbox scope: session / agent / shared
- Docker image selection
- Network mode (none/host/bridge)
- Memory limit slider
- Workspace access toggle (none/ro/rw)
- Per-agent sandbox overrides

### Task D4: Browser Automation Panel

**Files:**

- Create: `helix-desktop/src/components/browser/BrowserPanel.tsx`
- Create: `helix-desktop/src/components/browser/BrowserPreview.tsx`
- Create: `helix-desktop/src/components/browser/BrowserActions.tsx`

**Gateway Methods Used:**

- `browser.start` / `browser.stop` / `browser.status`
- `browser.snapshot` / `browser.screenshot`
- `browser.navigate` / `browser.action`
- `browser.tabs` / `browser.profiles`

**UI:**

- Browser status indicator (running/stopped)
- Screenshot preview (periodically updated)
- URL navigation bar
- Tab list
- Profile management
- Start/stop controls
- Action log

---

## Phase E: Channel Powerhouse

**Goal:** Deep configuration for every supported messaging channel.

### Task E1: Channel Configuration Center

**Files:**

- Rewrite: `helix-desktop/src/components/channels/` (expand from basic toggles)
- Create: `helix-desktop/src/components/channels/ChannelCenter.tsx`
- Create: `helix-desktop/src/components/channels/ChannelDetail.tsx`
- Create: `helix-desktop/src/components/channels/ChannelConfigPanel.tsx`

**Gateway Methods Used:**

- `channels.status` - All channel statuses
- `channels.login` / `channels.logout` - Channel auth
- `config.patch` (channels.\*) - Channel configuration

**UI per channel:**

- Connection status with reconnect button
- DM policy: pairing / allowlist / open / disabled
- Group policy: allowlist / open / disabled
- Allowlist editor (phone numbers, IDs, usernames)
- Media settings (max MB, types)
- Message chunking settings
- History limit slider
- Streaming mode (where applicable)

### Task E2: WhatsApp Setup Flow

**Files:**

- Create: `helix-desktop/src/components/channels/whatsapp/WhatsAppSetup.tsx`
- Create: `helix-desktop/src/components/channels/whatsapp/QRScanner.tsx`

**Gateway Methods Used:**

- `channels.login` (whatsapp) - Initiates QR pairing
- WhatsApp events for QR code and connection status

**UI:**

- QR code display for phone pairing
- Multi-account support (personal/business)
- Read receipts toggle
- Contact allowlist editor

### Task E3: Telegram Bot Setup

**Files:**

- Create: `helix-desktop/src/components/channels/telegram/TelegramSetup.tsx`

**Gateway Methods Used:**

- `channels.login` (telegram) - Token-based auth
- `config.patch` (channels.telegram.\*) - Config

**UI:**

- Bot token input (from @BotFather)
- Custom commands editor
- Stream mode toggle (off/partial/block)
- Draft chunk size slider

### Task E4: Discord Bot Setup

**Files:**

- Create: `helix-desktop/src/components/channels/discord/DiscordSetup.tsx`
- Create: `helix-desktop/src/components/channels/discord/GuildConfig.tsx`

**Gateway Methods Used:**

- `channels.login` (discord) - Token auth
- `config.patch` (channels.discord.\*) - Config

**UI:**

- Bot token input
- Per-guild allowlists and channel gating
- Reply-to mode (off/first/all)
- Max lines per message slider
- Group DM toggle

### Task E5: Signal / iMessage / LINE Setup

**Files:**

- Create: `helix-desktop/src/components/channels/signal/SignalSetup.tsx`
- Create: `helix-desktop/src/components/channels/imessage/iMessageSetup.tsx`
- Create: `helix-desktop/src/components/channels/line/LineSetup.tsx`

**Gateway Methods Used:**

- `channels.login` for each
- Platform-specific configuration

**UI:**

- Signal: CLI bridge setup, phone number registration
- iMessage: macOS-only, BlueBubbles bridge config
- LINE: Bot SDK token and webhook URL

---

## Phase F: Voice & Media Center

**Goal:** Talk mode, voice overlay, media capture via node capabilities.

### Task F1: Talk Mode Implementation

**Files:**

- Create: `helix-desktop/src/components/voice/TalkMode.tsx`
- Create: `helix-desktop/src/components/voice/VoiceOverlay.tsx`
- Create: `helix-desktop/src/components/voice/WaveformVisualizer.tsx`

**Gateway Methods Used:**

- `channels.talk-mode` - Start/stop talk mode
- Chat events for streaming response
- TTS configuration

**UI:**

- Floating voice overlay (always-on-top option)
- Three states: listening (pulsing mic), thinking (animation), speaking (waveform)
- Click to interrupt playback
- X to exit talk mode
- Voice selection (ElevenLabs voice picker)
- Speed/stability sliders

### Task F2: Media Capture (Node Capabilities)

**Files:**

- Create: `helix-desktop/src/components/media/MediaCapture.tsx`
- Create: `helix-desktop/src/components/media/ScreenCapture.tsx`
- Create: `helix-desktop/src/components/media/CameraCapture.tsx`

**Gateway Methods Used:**

- `nodes.invoke` (camera.snap, screen.capture) - Via node role
- `nodes.status` - Capability check

**UI:**

- Camera capture button (front/back on supported devices)
- Screen capture (screenshot + recording)
- Media gallery with history
- Attach captured media to chat

### Task F3: TTS Configuration

**Files:**

- Enhance: `helix-desktop/src/components/settings/VoiceSettings.tsx`

**Gateway Methods Used:**

- `config.patch` (messages.tts.\*) - TTS config

**UI:**

- Provider selection (ElevenLabs, OpenAI, Edge TTS)
- Voice browser with audio previews
- Speed, stability, similarity boost sliders
- Output format selection
- Test button ("Speak this text")

---

## Phase G: Session & Memory Intelligence

**Goal:** Deep session management and memory vector search.

### Task G1: Session Configuration Panel

**Files:**

- Create: `helix-desktop/src/components/sessions/SessionConfig.tsx`
- Create: `helix-desktop/src/components/sessions/CompactionSettings.tsx`

**Gateway Methods Used:**

- `sessions.list` - All sessions
- `sessions.compact` - Trigger compaction
- `config.patch` (session.\*) - Session settings

**UI:**

- Session scope selector: per-sender / per-channel / per-channel-peer
- Reset mode: daily / idle / manual
- Reset time picker (hour)
- Idle timeout slider (minutes)
- Compaction mode: default / safeguard
- Memory flush toggle (pre-compaction)
- Identity links editor (cross-channel user mapping)

### Task G2: Memory Vector Search UI

**Files:**

- Enhance: `helix-desktop/src/components/memory/MemoryBrowser.tsx`
- Create: `helix-desktop/src/components/memory/SemanticSearch.tsx`

**Gateway Methods Used:**

- `memory_search` - Semantic search
- `memory_get` - Read specific memory files

**UI:**

- Semantic search bar with hybrid mode toggle
- Search results with relevance scores and file snippets
- Memory file editor (markdown)
- Daily log viewer (memory/YYYY-MM-DD.md)
- MEMORY.md long-term editor
- Extra paths configuration

### Task G3: Session History Deep Dive

**Files:**

- Enhance: `helix-desktop/src/components/sessions/SessionHistory.tsx`
- Create: `helix-desktop/src/components/sessions/SessionDetail.tsx`

**Gateway Methods Used:**

- `chat.history` with pagination
- `sessions.list`

**UI:**

- Session list with search/filter
- Full conversation replay
- Token usage per session
- Model used per message
- Tool calls visualization
- Export session (JSON/Markdown)

---

## Phase H: Node & Device Network

**Goal:** Multi-device management with pairing, discovery, and remote node control.

### Task H1: Device Management Dashboard

**Files:**

- Create: `helix-desktop/src/components/devices/DevicesDashboard.tsx`
- Create: `helix-desktop/src/components/devices/DeviceCard.tsx`
- Create: `helix-desktop/src/components/devices/PairingApproval.tsx`

**Gateway Methods Used:**

- `devices.list` - All paired devices
- `devices.approve` - Approve pairing requests
- `devices.rotate` - Rotate device tokens

**Events:**

- Device pairing requests (real-time notification)

**UI:**

- Paired devices grid with status (online/offline/last seen)
- Pending pairing requests with approve/deny
- Device details: name, platform, capabilities, last active
- Token rotation button
- Revoke device access

### Task H2: Node Discovery & Control

**Files:**

- Create: `helix-desktop/src/components/nodes/NodesDashboard.tsx`
- Create: `helix-desktop/src/components/nodes/NodeDetail.tsx`
- Create: `helix-desktop/src/components/nodes/NodeCommands.tsx`

**Gateway Methods Used:**

- `nodes.discover` - Find available nodes
- `nodes.status` / `nodes.describe` - Node info
- `nodes.invoke` - Execute commands on nodes
- `nodes.rename` - Rename nodes

**UI:**

- Discovered nodes list with capabilities
- Node detail: capabilities, permissions, exec policy
- Invoke commands on remote nodes
- Camera/screen capture from remote nodes
- Notification send to nodes

### Task H3: Exec Policy per Node

**Files:**

- Create: `helix-desktop/src/components/nodes/NodeExecPolicy.tsx`

**Gateway Methods Used:**

- `config.patch` (tools.exec.node) - Default exec node
- Approval allowlist management

**UI:**

- Default exec node selector
- Per-node command allowlist editor (glob patterns)
- Security policy: deny-by-default vs allowlist
- Test command execution

---

## Phase I: Advanced Configuration

**Goal:** Model failover, auth profiles, hooks, and advanced settings.

### Task I1: Model Failover Chain Editor

**Files:**

- Create: `helix-desktop/src/components/models/FailoverChainEditor.tsx`
- Enhance: `helix-desktop/src/components/settings/ModelSettings.tsx`

**Gateway Methods Used:**

- `models.list` - Available models
- `models.scan` - Discover models from providers
- `config.patch` (agents.defaults.model.\*) - Model config

**UI:**

- Primary model selector
- Drag-and-drop fallback chain
- Per-agent model overrides
- Model scan/discovery button
- Image model selector
- Thinking level default (low/high/off)

### Task I2: Auth Profile Manager

**Files:**

- Create: `helix-desktop/src/components/auth/AuthProfileManager.tsx`
- Create: `helix-desktop/src/components/auth/OAuthFlowDialog.tsx`

**Gateway Methods Used:**

- Auth profile CRUD via gateway
- OAuth flow triggers

**UI:**

- List of auth profiles (Anthropic, OpenAI, etc.)
- Add new profile via OAuth flow
- Profile ordering (priority for failover)
- Profile health check / repair
- API key direct entry option
- Profile usage statistics

### Task I3: Hooks Management

**Files:**

- Create: `helix-desktop/src/components/hooks/HooksManager.tsx`
- Create: `helix-desktop/src/components/hooks/HookEditor.tsx`

**Gateway Methods Used:**

- Hook configuration via config.patch

**UI:**

- List bundled hooks (boot-md, command-logger, session-memory, etc.)
- Enable/disable per hook
- Hook configuration editor
- Custom hook creation (file path to hook script)

### Task I4: Gateway Advanced Settings

**Files:**

- Enhance: `helix-desktop/src/components/settings/AdvancedSettings.tsx`

**UI additions:**

- Gateway port configuration
- Logging level selector
- Sensitive data redaction toggle
- Context pruning mode (adaptive/aggressive/off)
- Block streaming default toggle
- Message queue mode (steer/followup/collect/interrupt)
- Inbound debounce slider (ms)
- Config include paths editor

---

## Phase J: Polish & Distribution

**Goal:** Production-ready desktop app with auto-update, deep linking, and native polish.

### Task J1: Deep Linking (helix:// URL scheme)

**Files:**

- Modify: `helix-desktop/src-tauri/tauri.conf.json` - Register URL scheme
- Create: `helix-desktop/src-tauri/src/commands/deeplink.rs` - Handle deep links
- Create: `helix-desktop/src/hooks/useDeepLink.ts`

**URL patterns:**

- `helix://chat?message=...` - Open chat with message
- `helix://settings/:section` - Open settings section
- `helix://approve/:requestId` - Open approval dialog
- `helix://agent/:agentId` - Open agent detail

### Task J2: Enhanced System Tray

**Files:**

- Modify: `helix-desktop/src-tauri/src/lib.rs` - Richer tray menu

**UI:**

- Quick actions: New Chat, Send Message, Talk Mode
- Agent status submenu (per-agent online/idle)
- Channel status submenu (connected/disconnected per channel)
- Recent conversations
- Pending approvals count badge
- Gateway status indicator

### Task J3: Keyboard Shortcuts System

**Files:**

- Enhance: `helix-desktop/src/components/settings/KeyboardShortcuts.tsx`
- Create: `helix-desktop/src/hooks/useGlobalShortcuts.ts`

**Shortcuts:**

- `Cmd/Ctrl+N` - New chat
- `Cmd/Ctrl+K` - Command palette
- `Cmd/Ctrl+,` - Settings
- `Cmd/Ctrl+T` - Talk mode toggle
- `Cmd/Ctrl+Shift+A` - Approvals
- Customizable via settings

### Task J4: Auto-Update System

**Files:**

- Modify: `helix-desktop/src-tauri/tauri.conf.json` - Enable updater
- Create: `helix-desktop/src/components/common/UpdateNotification.tsx`

**Requirements:**

- Code signing keys (macOS: Apple Developer, Windows: Authenticode)
- Update server endpoint
- Changelog display

### Task J5: Command Palette

**Files:**

- Create: `helix-desktop/src/components/common/CommandPalette.tsx`

**UI:**

- Searchable command list (keyboard-driven)
- Quick navigation to any page/setting
- Fuzzy search
- Recent commands
- Keyboard shortcut hints

---

## Capability Coverage Map (Before → After)

| Gateway Method Category | Before   | After    | Methods                                          |
| ----------------------- | -------- | -------- | ------------------------------------------------ |
| chat.\*                 | 80%      | 100%     | send, inject, abort, history                     |
| agents.\*               | 20%      | 100%     | list, add, delete, identity, wait                |
| models.\*               | 40%      | 100%     | list, set, scan, failover                        |
| skills.\*               | 10%      | 100%     | list, install, uninstall, status, update, bins   |
| channels.\*             | 15%      | 90%      | status, login, logout, config, talk-mode         |
| config.\*               | 50%      | 100%     | get, set, patch, apply, schema                   |
| cron.\*                 | 80%      | 100%     | add, list, remove, run, status, update           |
| sessions.\*             | 30%      | 90%      | list, compact, config                            |
| browser.\*              | 0%       | 80%      | start, stop, status, snapshot, navigate, action  |
| nodes.\*                | 0%       | 90%      | discover, invoke, pair, verify, describe, rename |
| devices.\*              | 0%       | 100%     | approve, list, rotate                            |
| exec.approval.\*        | 0%       | 100%     | resolve, snapshot, configure                     |
| system.\*               | 50%      | 100%     | status, health, update                           |
| hooks.\*                | 0%       | 80%      | list, enable/disable, configure                  |
| **Overall**             | **~30%** | **~95%** |                                                  |

---

## Critical Files Inventory

### Files to Create (New)

```
helix-desktop/src/components/agents/AgentList.tsx
helix-desktop/src/components/agents/AgentCard.tsx
helix-desktop/src/components/agents/AgentWorkspace.tsx
helix-desktop/src/components/agents/AgentIdentity.tsx
helix-desktop/src/components/agents/AgentBindings.tsx
helix-desktop/src/components/agents/BindingEditor.tsx
helix-desktop/src/components/agents/WorkspaceExplorer.tsx
helix-desktop/src/components/agents/BootstrapFileEditor.tsx
helix-desktop/src/components/skills/SkillsDashboard.tsx
helix-desktop/src/components/skills/SkillCard.tsx
helix-desktop/src/components/skills/SkillDetail.tsx
helix-desktop/src/components/skills/ClawHubBrowser.tsx
helix-desktop/src/components/skills/SkillEditor.tsx
helix-desktop/src/components/skills/FrontmatterEditor.tsx
helix-desktop/src/components/skills/AgentSkillConfig.tsx
helix-desktop/src/components/tools/ToolsPolicyEditor.tsx
helix-desktop/src/components/tools/ToolGroupToggle.tsx
helix-desktop/src/components/security/ExecApprovalsDashboard.tsx
helix-desktop/src/components/security/ApprovalRequestCard.tsx
helix-desktop/src/components/security/ApprovalHistory.tsx
helix-desktop/src/components/security/SandboxConfig.tsx
helix-desktop/src/components/browser/BrowserPanel.tsx
helix-desktop/src/components/browser/BrowserPreview.tsx
helix-desktop/src/components/browser/BrowserActions.tsx
helix-desktop/src/components/channels/ChannelCenter.tsx
helix-desktop/src/components/channels/ChannelDetail.tsx
helix-desktop/src/components/channels/ChannelConfigPanel.tsx
helix-desktop/src/components/channels/whatsapp/WhatsAppSetup.tsx
helix-desktop/src/components/channels/whatsapp/QRScanner.tsx
helix-desktop/src/components/channels/telegram/TelegramSetup.tsx
helix-desktop/src/components/channels/discord/DiscordSetup.tsx
helix-desktop/src/components/channels/discord/GuildConfig.tsx
helix-desktop/src/components/channels/signal/SignalSetup.tsx
helix-desktop/src/components/channels/imessage/iMessageSetup.tsx
helix-desktop/src/components/channels/line/LineSetup.tsx
helix-desktop/src/components/voice/TalkMode.tsx
helix-desktop/src/components/voice/VoiceOverlay.tsx
helix-desktop/src/components/voice/WaveformVisualizer.tsx
helix-desktop/src/components/media/MediaCapture.tsx
helix-desktop/src/components/media/ScreenCapture.tsx
helix-desktop/src/components/media/CameraCapture.tsx
helix-desktop/src/components/sessions/SessionConfig.tsx
helix-desktop/src/components/sessions/CompactionSettings.tsx
helix-desktop/src/components/sessions/SessionDetail.tsx
helix-desktop/src/components/memory/SemanticSearch.tsx
helix-desktop/src/components/devices/DevicesDashboard.tsx
helix-desktop/src/components/devices/DeviceCard.tsx
helix-desktop/src/components/devices/PairingApproval.tsx
helix-desktop/src/components/nodes/NodesDashboard.tsx
helix-desktop/src/components/nodes/NodeDetail.tsx
helix-desktop/src/components/nodes/NodeCommands.tsx
helix-desktop/src/components/nodes/NodeExecPolicy.tsx
helix-desktop/src/components/models/FailoverChainEditor.tsx
helix-desktop/src/components/auth/AuthProfileManager.tsx
helix-desktop/src/components/auth/OAuthFlowDialog.tsx
helix-desktop/src/components/hooks/HooksManager.tsx
helix-desktop/src/components/hooks/HookEditor.tsx
helix-desktop/src/components/common/CommandPalette.tsx
helix-desktop/src/components/common/UpdateNotification.tsx
helix-desktop/src/hooks/useDeepLink.ts
helix-desktop/src/hooks/useGlobalShortcuts.ts
helix-desktop/src/lib/clawhub-client.ts
helix-desktop/src-tauri/src/commands/deeplink.rs
```

### Files to Modify (Existing)

```
helix-desktop/src/components/onboarding/Onboarding.tsx
helix-desktop/src/components/auth/InstanceRegistrationStep.tsx → DeviceRegistrationStep.tsx
helix-desktop/src/components/agents/AgentEditor.tsx (rewrite)
helix-desktop/src/components/settings/ModelSettings.tsx
helix-desktop/src/components/settings/VoiceSettings.tsx
helix-desktop/src/components/settings/AdvancedSettings.tsx
helix-desktop/src/components/settings/KeyboardShortcuts.tsx
helix-desktop/src/components/memory/MemoryBrowser.tsx
helix-desktop/src/components/sessions/SessionHistory.tsx
helix-desktop/src/lib/gateway-client.ts
helix-desktop/src/stores/configStore.ts
helix-desktop/src-tauri/src/commands/auth.rs
helix-desktop/src-tauri/src/commands/gateway.rs
helix-desktop/src-tauri/src/commands/system.rs
helix-desktop/src-tauri/src/lib.rs
helix-desktop/src-tauri/tauri.conf.json
helix-desktop/src/routes/index.tsx (add new routes)
```

---

## Verification Plan

### Per-Phase Verification

**Phase A:**

```bash
# 1. Launch desktop app, verify onboarding says "device" not "instance"
# 2. Check OS keyring for helix-gateway-token
# 3. Verify gateway starts with dynamic token
# 4. Check gateway recognizes desktop as node (nodes.status should show desktop)
```

**Phase B:**

```bash
# 1. Add a second agent via UI
# 2. Configure binding: Telegram → agent-2
# 3. Verify routing works (send Telegram message, check agent-2 session)
# 4. Edit agent workspace files, verify persistence
```

**Phase C:**

```bash
# 1. Browse ClawHub, install a skill
# 2. Verify skill appears in skills.list
# 3. Create custom skill via editor
# 4. Configure skill per-agent
```

**Phase D:**

```bash
# 1. Set tools policy to "minimal", verify restricted tools
# 2. Trigger exec approval, approve from dashboard
# 3. Configure "Always Allow" for a command
# 4. Enable sandbox for non-main sessions
```

**Phase E:**

```bash
# 1. Connect WhatsApp via QR code in desktop
# 2. Configure Telegram bot token
# 3. Set Discord per-guild allowlists
# 4. Verify deep channel config persists via config.patch
```

**Phase F:**

```bash
# 1. Start Talk Mode, speak, verify response plays back
# 2. Capture camera image via node capabilities
# 3. Take screenshot via node capabilities
```

**Phase G:**

```bash
# 1. Configure session scope to per-sender
# 2. Trigger compaction, verify memory flush
# 3. Semantic search memories, verify results
```

**Phase H:**

```bash
# 1. Pair a mobile device (iOS/Android)
# 2. Approve pairing from desktop
# 3. Invoke camera on mobile from desktop
# 4. Configure exec policy for mobile node
```

### Build & Test

```bash
cd helix-desktop
npm run typecheck            # TypeScript check
npm run lint                 # ESLint
npx vitest run              # Unit tests
npm run tauri:build         # Production build
npx playwright test         # E2E tests
```

---

## Implementation Priority

**Start with Phase A** (Foundation) - everything else depends on it.

Then prioritize by user impact:

1. **Phase B** (Agents) - core power feature
2. **Phase D** (Security/Tools) - exec approvals are safety-critical
3. **Phase C** (Skills) - extensibility
4. **Phase E** (Channels) - communication reach
5. **Phase G** (Sessions/Memory) - state intelligence
6. **Phase F** (Voice/Media) - modality expansion
7. **Phase H** (Nodes/Devices) - multi-device
8. **Phase I** (Advanced) - power users
9. **Phase J** (Polish) - production readiness

---

## Notes

- **DO NOT touch ios/ or android/ directories** - native code is out of scope
- The `cli-login.ts` created in the previous session is for the TERMINAL CLI tool, not the desktop app. Desktop uses Tauri IPC.
- Gateway WebSocket Protocol v3 is the communication standard. All UI operations go through gateway methods.
- Config writes MUST use `config.patch` (gateway protocol), not direct file writes, to trigger proper validation and hot-reload.
- Exec approvals are SECURITY-CRITICAL. They must work before we give the desktop app full tool access.
- All new components should follow the existing dark theme design system (bg-bg-primary/secondary/tertiary, card-glass, helix-500 accents).
