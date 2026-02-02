# OpenClaw Complete Analysis

> Source: docs.openclaw.ai (scraped 2026-02-01)

## Executive Summary

OpenClaw is a powerful but developer-oriented AI assistant gateway that connects Claude/other LLMs to messaging platforms (WhatsApp, Telegram, Discord, etc.). The system is highly configurable but has significant friction for non-technical users.

---

## Core Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      USER DEVICES                            │
│  (Phone/Tablet - WhatsApp, Telegram, Discord, iMessage)     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW GATEWAY                          │
│  • Port 18789 (default)                                      │
│  • WebSocket connections                                     │
│  • Channel providers (WhatsApp, Telegram, Discord, etc.)    │
│  • Authentication (OAuth, API keys)                          │
│  • Pairing system (DM access control)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     AI PROVIDERS                             │
│  • Anthropic (Claude) - Recommended                         │
│  • OpenAI                                                    │
│  • MiniMax, Moonshot, Synthetic                             │
│  • Vercel AI Gateway                                        │
└─────────────────────────────────────────────────────────────┘
```

### File System Layout

| Path | Purpose |
|------|---------|
| `~/.openclaw/workspace` | Skills, prompts, memories |
| `~/.openclaw/openclaw.json` | Main configuration (JSON/JSON5) |
| `~/.openclaw/credentials/` | API keys, OAuth tokens |
| `~/.openclaw/agents/<id>/sessions/` | Session data |
| `~/.openclaw/credentials/whatsapp/<id>/creds.json` | WhatsApp auth |
| `~/.openclaw/devices/paired.json` | Paired devices |
| `/tmp/openclaw/` | Logs |

### Workspace Files (Auto-created)

- `AGENTS.md` - Agent definitions
- `SOUL.md` - Agent personality
- `TOOLS.md` - Available tools
- `IDENTITY.md` - Identity configuration
- `USER.md` - User profile
- `BOOTSTRAP.md` - Startup context
- `HEARTBEAT.md` - Heartbeat prompts

---

## Installation Methods

### 1. Bash Installer (macOS/Linux)
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### 2. PowerShell (Windows/WSL2)
```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

### 3. NPM/pnpm
```bash
npm install -g openclaw
# or
pnpm add -g openclaw
```

### Prerequisites
- Node.js ≥22
- pnpm (optional but recommended)
- Docker (optional)
- macOS: Xcode/CLT for app development
- Windows: WSL2 (Ubuntu) - **NOT native Windows**

---

## Onboarding Wizard Flow

### Command Entry Points

| Command | Purpose |
|---------|---------|
| `openclaw onboard` | Initial setup |
| `openclaw configure` | Reconfigure existing |
| `openclaw dashboard` | Quick browser chat (no channels) |
| `openclaw onboard --install-daemon` | Full setup + daemon |

### 9-Step Wizard Process

1. **Config Detection** - Keep/Modify/Reset existing config
2. **Model/Auth Selection** - Choose AI provider + credentials
3. **Workspace Configuration** - Set workspace directory
4. **Gateway Settings** - Port, bind address, auth mode, Tailscale
5. **Channel Providers** - WhatsApp/Telegram/Discord/etc.
6. **Daemon Installation** - LaunchAgent (macOS) or systemd (Linux)
7. **Health Verification** - Gateway start + diagnostics
8. **Skills Setup** - Node manager + optional dependencies
9. **Completion Summary** - Next steps

### Two Modes

| Mode | Description |
|------|-------------|
| **QuickStart** | Preset defaults, minimal questions |
| **Advanced** | Full control over all parameters |

### QuickStart Defaults
- Gateway: local loopback, port 18789
- Auth: auto-generated token
- Tailscale: disabled
- Channels: allowlist mode

---

## Authentication Methods

### Supported Providers

| Provider | Config Method |
|----------|---------------|
| Anthropic API Key | **Recommended** |
| OAuth flows | Browser-based |
| OpenAI | API key |
| MiniMax | API key |
| Moonshot | API key |
| Synthetic | API key |
| Vercel AI Gateway | Token |
| OpenCode Zen | Token |

### Credential Storage

```
~/.openclaw/credentials/
├── oauth.json              # OAuth tokens
├── whatsapp/<id>/creds.json # WhatsApp sessions
├── <channel>-pairing.json  # Pending pairing requests
├── <channel>-allowFrom.json # Approved senders
```

---

## Channel Configuration

### Supported Channels

| Channel | Auth Method | Notes |
|---------|-------------|-------|
| WhatsApp | QR code scan | **Most popular**, requires `openclaw channels login` |
| Telegram | Bot token | Create via @BotFather |
| Discord | Bot token | Create in Discord Developer Portal |
| Slack | Bot token | Workspace app |
| iMessage | Local only | macOS only |
| Signal | QR code | Self-hosted bridge required |
| Google Chat | OAuth | Workspace integration |
| Mattermost | Webhook | Self-hosted |

### Channel Login

```bash
openclaw channels login  # Interactive QR for WhatsApp
```

### Safety Configuration

```json
{
  "channels": {
    "whatsapp": {
      "allowFrom": ["+1234567890"]  // CRITICAL: Whitelist numbers
    }
  }
}
```

**WARNING**: Never run open-to-the-world on personal Mac!

---

## Pairing System

### DM Pairing (Chat Access Control)

When a channel uses "pairing" policy, unknown senders must be approved.

**Pairing Code Specs:**
- 8 characters, uppercase
- Excludes ambiguous chars (0, O, 1, I)
- Expires in 1 hour
- Max 3 pending per channel

**Commands:**
```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

### Device Pairing (Node Access)

For iOS, Android, macOS, headless nodes connecting to Gateway.

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

**Storage:**
- Pending: `~/.openclaw/devices/pending.json`
- Paired: `~/.openclaw/devices/paired.json`

---

## Gateway Operations

### Starting Gateway

```bash
openclaw gateway --port 18789 --verbose
```

Dashboard: `http://127.0.0.1:18789/`

### Health Check

```bash
openclaw health
openclaw health --json
openclaw status
openclaw status --all
```

### Daemon Installation

**macOS:** LaunchAgent
**Linux/WSL2:** systemd user unit

```bash
# Enable lingering on Linux (prevents shutdown on logout)
sudo loginctl enable-linger $USER
```

---

## Agent Configuration

### Multi-Agent Support

```bash
openclaw agents add <name>
```

Each agent gets:
- Separate workspace
- Isolated sessions
- Distinct auth profiles

### Heartbeat System

Default: every 30 minutes

```json
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "every": "30m"  // Set to "0m" to disable
      }
    }
  }
}
```

Agent reads `HEARTBEAT.md` and replies `HEARTBEAT_OK` if no action needed.

### Session Management

- Reset: `/new` or `/reset` commands
- Auto-reset: Configure `reset.mode` and `reset.atHour`

---

## Media Handling

### Inbound (Receiving)

Template variables:
- `{{MediaPath}}` - Local file path
- `{{MediaUrl}}` - URL if available
- `{{Transcript}}` - Voice transcription

### Outbound (Sending)

```
MEDIA:/path/to/file.png
MEDIA:https://example.com/image.jpg
```

---

## Non-Interactive Automation

```bash
openclaw onboard --non-interactive \
  --anthropic-api-key sk-xxx \
  --gateway-port 18789 \
  --daemon-runtime launchctl \
  --skip-skills \
  --json
```

---

## Development Workflow

### Bleeding Edge Setup

```bash
git clone <repo>
pnpm install
pnpm build
pnpm gateway:watch  # Hot reload
```

### Source Build Requirements

1. Clone repository
2. Install dependencies
3. Run `pnpm build`
4. UI bundling steps

---

## Critical Warnings

1. **Bun Incompatibility**: Bun does NOT work with WhatsApp and Telegram channels
2. **WSL2 Required**: Windows users MUST use WSL2 (Ubuntu preferred)
3. **Allowlist Required**: Always set `channels.whatsapp.allowFrom`
4. **Dedicated Number**: Use a secondary phone number, not personal
5. **Heartbeat Caution**: Disable heartbeats initially until system proves trustworthy

---

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `openclaw onboard` | Initial setup |
| `openclaw configure` | Reconfigure |
| `openclaw dashboard` | Browser chat |
| `openclaw gateway` | Start gateway |
| `openclaw channels login` | WhatsApp QR |
| `openclaw pairing list <ch>` | View pending |
| `openclaw pairing approve <ch> <code>` | Approve user |
| `openclaw devices list` | View devices |
| `openclaw health` | Health check |
| `openclaw status --all` | Full diagnosis |
| `openclaw agents add <name>` | Add agent |
