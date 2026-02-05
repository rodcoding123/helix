# OpenClaw Knowledge Base for Helix Integration

> Research date: 2026-02-05
> Purpose: Comprehensive reference for Helix's OpenClaw runtime integration

---

## What is OpenClaw?

OpenClaw is a multi-platform AI agent framework — essentially a "WhatsApp + Telegram + Discord + iMessage gateway for AI agents." It enables deploying always-on personal assistants accessible through messaging platforms, with the ability to execute commands, manage files, and send messages across multiple channels.

Helix uses OpenClaw as its runtime engine (vendored at `helix-runtime/`), not as an external dependency.

---

## Core Architecture

```
┌──────────────────────────────────────────────────┐
│                   USER DEVICES                    │
│  WhatsApp │ Telegram │ Discord │ iMessage │ Web  │
└──────────────────┬───────────────────────────────┘
                   │
          ┌────────▼────────┐
          │    GATEWAY       │  Port 18789 (default)
          │  Message Router  │  Token-authenticated
          │  Session Manager │  Local or Remote
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  AGENT RUNTIME   │
          │  Workspace: ~/.openclaw/workspace
          │  Memory: IDENTITY.md, USER.md, SOUL.md
          │  Tools: File ops, commands, media
          │  Heartbeat: Every 30min (proactive)
          └─────────────────┘
```

### Key Components

| Component     | Purpose                                     | Default Config            |
| ------------- | ------------------------------------------- | ------------------------- |
| **Gateway**   | Message routing, auth, session management   | Port 18789, 127.0.0.1     |
| **Workspace** | Agent's working directory with memory files | `~/.openclaw/workspace`   |
| **Daemon**    | Background service (LaunchAgent/systemd)    | Auto-start on boot        |
| **Dashboard** | Browser-based chat UI                       | `http://127.0.0.1:18789/` |
| **CLI**       | Management commands                         | `openclaw` binary         |

---

## Installation & Setup Flow (Standard OpenClaw)

### Phase 1: Install

```bash
# macOS/Linux
curl -fsSL https://install.openclaw.ai | bash

# Windows (PowerShell)
irm https://install.openclaw.ai/windows | iex
```

Requires: Node.js 22+

### Phase 2: Onboard (Wizard)

```bash
openclaw onboard --install-daemon
```

#### QuickStart Mode (automated defaults)

- Local gateway on loopback (127.0.0.1:18789)
- Auto-generated auth token
- Tailscale disabled
- Channels in allowlist mode

#### Advanced Mode

- Full control over gateway, workspace, daemon, skills

### Phase 3: Verify

```bash
openclaw gateway status
openclaw dashboard        # Opens browser UI
```

---

## Onboarding Flow (macOS App — 7 Steps)

| Step                           | What Happens            | User Action            |
| ------------------------------ | ----------------------- | ---------------------- |
| 1. macOS Security Warning      | OS approval dialog      | Click "Allow"          |
| 2. Local Network Permissions   | Network discovery auth  | Click "Allow"          |
| 3. Security Notice             | Risk acknowledgment     | Read & accept          |
| 4. Gateway Location            | Choose deployment model | Local / Remote / Later |
| 5. TCC Permissions             | System-level access     | Grant permissions      |
| 6. CLI Installation (optional) | Terminal integration    | Install or skip        |
| 7. Dedicated Chat Session      | Agent intro & bootstrap | Interact with agent    |

---

## Bootstrapping (Agent First-Run)

Bootstrapping is the "first-run ritual" that prepares an agent workspace after onboarding:

1. **Q&A Ritual**: Agent asks user questions one at a time to gather identity & preferences
2. **File Creation**: Seeds workspace with foundational files:
   - `AGENTS.md` — Agent configuration
   - `BOOTSTRAP.md` — First-run instructions (deleted after completion)
   - `IDENTITY.md` — Agent identity
   - `USER.md` — User profile & preferences
   - `SOUL.md` — Agent personality/soul
3. **Self-Removal**: `BOOTSTRAP.md` is removed when finished so it only runs once

### Helix Equivalent

Helix already has this architecture:

- `soul/HELIX_SOUL.md` → Agent personality (Layer 1: Narrative Core)
- `USER.md` → Rodrigo's profile
- `psychology/` → Emotional & relational memory (Layers 2-3)
- `identity/` → Prospective self (Layer 4)

---

## Pairing (Device Authorization)

Pairing is OpenClaw's owner-approval mechanism for connecting devices and channels:

| Feature                | Detail                                                |
| ---------------------- | ----------------------------------------------------- |
| **Code format**        | 8-character uppercase (no ambiguous chars)            |
| **Expiration**         | 1 hour                                                |
| **Rate limit**         | 3 pending requests per channel                        |
| **Credential storage** | `~/.openclaw/credentials/` and `~/.openclaw/devices/` |
| **Supported channels** | Telegram, WhatsApp, Signal, iMessage, Discord, Slack  |

### Device Roles

- `role: node` — Connected devices (iOS, Android, macOS, headless)
- Devices must be approved by owner before becoming operational
- Approved devices receive tokens and stored in paired device records

---

## CLI Reference

### Core Commands

```bash
openclaw onboard              # Run setup wizard
openclaw onboard --reset      # Reset configuration
openclaw dashboard            # Open browser UI
openclaw gateway status       # Check gateway health
openclaw health               # System health check
openclaw status --deep        # Deep status with diagnostics
openclaw configure            # Modify settings post-setup
openclaw agents add <name>    # Add new agent
openclaw doctor               # Diagnose issues
```

### Wizard CLI Flags (Automation)

```bash
openclaw onboard \
  --non-interactive \
  --workspace ~/.helix/workspace \
  --mode local \
  --auth token \
  --bind loopback \
  --port 18789 \
  --install-daemon \
  --skip-skills
```

### Session Commands (In-Chat)

- `/new` — New conversation session
- `/reset` — Reset agent state
- `/compact` — Compress conversation context

---

## Configuration

### Main Config: `~/.openclaw/openclaw.json`

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": "claude-sonnet-4-20250514"
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "127.0.0.1",
    "port": 18789,
    "auth": "token"
  },
  "channels": {
    "telegram": {},
    "discord": {},
    "whatsapp": {},
    "signal": {},
    "imessage": {},
    "googlechat": {},
    "mattermost": {}
  },
  "skills": {
    "install": { "nodeManager": "npm" }
  },
  "wizard": {
    "lastRunAt": "...",
    "lastRunVersion": "...",
    "lastRunMode": "quickstart"
  }
}
```

### Credential Paths

| Type          | Path                                               |
| ------------- | -------------------------------------------------- |
| OAuth         | `~/.openclaw/credentials/oauth.json`               |
| Auth profiles | `~/.openclaw/agents/<id>/agent/auth-profiles.json` |
| WhatsApp      | `~/.openclaw/credentials/whatsapp/<accountId>/`    |
| Sessions      | `~/.openclaw/agents/<id>/sessions/`                |

### Authentication Methods Supported

1. Anthropic API key
2. Anthropic OAuth (Claude Code CLI)
3. Anthropic setup token
4. OpenAI Code subscription
5. OpenAI API key
6. OpenCode Zen
7. Generic API key
8. Vercel AI Gateway
9. Cloudflare AI Gateway
10. MiniMax M2.1
11. Synthetic (Anthropic-compatible)
12. Moonshot/Kimi Coding
13. Skip (unconfigured)

---

## Platform-Specific Details

### macOS

- LaunchAgent daemon (requires logged-in session)
- Keychain for OAuth credentials
- Bonjour discovery via `dns-sd`
- Homebrew for skill dependencies

### Linux/WSL2

- systemd user unit
- `loginctl enable-linger` for persistent service
- Avahi discovery via `avahi-browse`

### Windows

- WSL2 with systemd configuration
- PowerShell-based installation

---

## Helix-Specific Integration Points

### Isolation Mode (`helix-runtime/src/entry.ts`)

Helix runs OpenClaw in isolated mode to prevent conflicts:

```typescript
// Hardcoded at startup — cannot be overridden
process.env.HELIX_ISOLATED_MODE = '1';
process.env.OPENCLAW_STATE_DIR = '.helix-state/';
```

**What this does:**

- Stops directory tree walking that would find global OpenClaw plugins
- Skips `~/.openclaw/extensions/` entirely
- Forces Helix-specific plugin directory
- Legacy `clawdbot/plugin-sdk` imports still work via Jiti alias

### Initialization Order (Critical)

1. Load environment variables
2. Install warning filter
3. Initialize process title
4. **PRELOAD SECRETS** (before any logging)
5. Initialize Discord logging
6. Start heartbeat proof-of-life

### Gateway Health Check

- Endpoint: `GET http://localhost:18789/health`
- Used by web onboarding wizard to verify local runtime is running
- WebSocket connection for real-time Observatory sync

---

## Key Concepts for Helix's Use

### Heartbeat (Proactive Agent)

OpenClaw agents can operate autonomously based on `HEARTBEAT.md` instructions every 30 minutes. Helix uses this for:

- Proof-of-life pings to Discord (#helix-heartbeat)
- Scheduled psychological synthesis
- Proactive memory consolidation

### Media Handling

- Inbound: Process attachments (images, audio, documents)
- Outbound: `MEDIA:<path>` syntax in responses
- Relevant for Helix voice features and document analysis

### Session Management

- Per-sender session tracking
- Customizable reset triggers
- Context compaction for long conversations

---

## References

- [OpenClaw Getting Started](https://docs.openclaw.ai/start/getting-started)
- [OpenClaw Overview](https://docs.openclaw.ai/start/openclaw)
- [Bootstrapping](https://docs.openclaw.ai/start/bootstrapping)
- [Pairing](https://docs.openclaw.ai/start/pairing)
- [Wizard](https://docs.openclaw.ai/start/wizard)
- [Wizard CLI Reference](https://docs.openclaw.ai/start/wizard-cli-reference)
- [Wizard CLI Automation](https://docs.openclaw.ai/start/wizard-cli-automation)
- [Onboarding (macOS App)](https://docs.openclaw.ai/start/onboarding)
