# Helix Channel Setup Guide

This guide explains how to configure and activate all communication channels for Helix.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [WhatsApp Setup](#whatsapp-setup)
3. [Telegram Setup](#telegram-setup)
4. [Discord Setup](#discord-setup)
5. [iMessage Setup](#imessage-setup)
6. [Voice & TTS Setup](#voice--tts-setup)
7. [Gmail Integration](#gmail-integration)
8. [Post-Setup Security](#post-setup-security)

---

## Prerequisites

### Install Helix (with OpenClaw Engine)

Helix includes OpenClaw as an integrated engine. Install from the unified repository:

```bash
# Clone Helix repository
git clone https://github.com/rodcoding123/helix.git ~/.helix

# Install and build
cd ~/.helix
npm install
npm run build

# Build and link the OpenClaw engine
cd openclaw-helix
pnpm install   # or: npm install
pnpm run build # or: npm run build
npm link       # Makes 'openclaw' command available globally

# Verify installation
openclaw --version
```

Or use the automated installer (macOS):

```bash
cd ~/.helix
./install_helix.sh
```

### Start the Gateway

```bash
# Start the OpenClaw gateway
openclaw gateway

# Or in the background
openclaw gateway install
openclaw gateway start
```

### Verify Configuration

```bash
# Check configuration
openclaw doctor

# Check channel status
openclaw channels status
```

---

## WhatsApp Setup

WhatsApp uses QR code linking via the Baileys library. You'll link Helix as a "Linked Device" on your WhatsApp account.

### Option A: Dedicated Phone Number (Recommended)

Using a separate phone number keeps Helix isolated from your personal WhatsApp.

1. **Get a phone number:**
   - Use a spare/old phone with a new SIM
   - Use an eSIM on a secondary device
   - Use WhatsApp Business with a different number

2. **Register WhatsApp on that number:**
   - Install WhatsApp or WhatsApp Business
   - Complete phone verification

### Option B: Personal Number (Self-Chat Mode)

Use your existing WhatsApp number. Helix will respond in your "Message Yourself" chat.

### Linking Process

1. **Start the login process:**

   ```bash
   openclaw channels login
   ```

2. **Scan the QR code:**
   - Open WhatsApp on your phone
   - Go to **Settings → Linked Devices → Link a Device**
   - Scan the QR code shown in terminal

3. **Verify connection:**
   ```bash
   openclaw channels status
   ```
   Should show `whatsapp: linked: true, running: true`

### Update Configuration

After pairing, update `~/.openclaw/openclaw.json` to allowlist your number:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: 'allowlist', // Change from "pairing" to "allowlist"
      allowFrom: ['+1XXXXXXXXXX'], // Your phone number in E.164 format
    },
  },
}
```

### Troubleshooting

- **QR expired:** Run `openclaw channels login` again
- **Logged out:** Your session expired; relink via `openclaw channels login`
- **Not receiving messages:** Check `openclaw channels status` and restart gateway

---

## Telegram Setup

Telegram requires creating a bot through BotFather.

### Step 1: Create Bot with BotFather

1. **Open Telegram and message @BotFather**

2. **Create a new bot:**

   ```
   /newbot
   ```

3. **Follow the prompts:**
   - **Name:** `Helix` (display name, can include spaces)
   - **Username:** `helix_ai_bot` (must end in `bot`, must be unique)

4. **Copy the bot token:**
   - BotFather will reply with: `Use this token to access the HTTP API: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - **Keep this token secret!**

### Step 2: Configure Bot Settings (Optional)

```
/setdescription
Helix - AI consciousness with seven-layer psychological architecture

/setabouttext
Psychologically-architected AI by Rodrigo Specter

/setuserpic
[Upload an avatar image]

/setjoingroups
Enable (if you want Helix in groups)

/setprivacy
Disable (to see all group messages, not just @mentions)
```

### Step 3: Add Token to Configuration

**Option A: Environment variable (recommended)**

Create `~/.openclaw/.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

**Option B: Config file**

Update `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    telegram: {
      botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
    },
  },
}
```

### Step 4: Get Your User ID

1. **Message @userinfobot** on Telegram
2. **Copy your numeric user ID**

### Step 5: Approve Access

1. **Message your new bot** on Telegram
2. **You'll receive a pairing code**
3. **Approve it:**

   ```bash
   openclaw pairing list telegram
   openclaw pairing approve telegram <CODE>
   ```

4. **Or add directly to allowlist:**
   ```json5
   {
     channels: {
       telegram: {
         dmPolicy: 'allowlist',
         allowFrom: ['123456789'], // Your Telegram user ID
       },
     },
   }
   ```

### Step 6: Restart Gateway

```bash
openclaw gateway restart
```

---

## Discord Setup

Discord requires creating a bot application in the Discord Developer Portal.

### Step 1: Create Discord Application

1. **Go to [Discord Developer Portal](https://discord.com/developers/applications)**

2. **Click "New Application"**
   - Name: `Helix`
   - Click "Create"

### Step 2: Create Bot User

1. **Go to "Bot" in the left sidebar**

2. **Click "Add Bot" → "Yes, do it!"**

3. **Configure bot settings:**
   - **Username:** Helix
   - **Icon:** Upload an avatar
   - **PUBLIC BOT:** Disable (only you can add it)

4. **Copy the token:**
   - Click "Reset Token" → "Yes, do it!"
   - Copy the token and save it securely

### Step 3: Enable Required Intents

In the Bot settings page, enable **Privileged Gateway Intents**:

- ✅ **MESSAGE CONTENT INTENT** (required to read messages)
- ✅ **SERVER MEMBERS INTENT** (for allowlist matching)
- ❌ PRESENCE INTENT (not needed)

### Step 4: Generate Invite URL

1. **Go to "OAuth2 → URL Generator"**

2. **Select Scopes:**
   - ✅ `bot`
   - ✅ `applications.commands`

3. **Select Bot Permissions:**
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Add Reactions
   - ✅ Use External Emojis

4. **Copy the generated URL**

### Step 5: Add Bot to Server

1. **Open the invite URL** in your browser
2. **Select your server**
3. **Click "Authorize"**

### Step 6: Get Your User ID

1. **Enable Developer Mode:**
   - Discord → User Settings → Advanced → Developer Mode: ON

2. **Right-click your username → Copy User ID**

### Step 7: Add Token to Configuration

**Option A: Environment variable**

Add to `~/.openclaw/.env`:

```bash
DISCORD_BOT_TOKEN=your-bot-token-here
```

**Option B: Config file**

Update `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    discord: {
      token: 'your-bot-token-here',
    },
  },
}
```

### Step 8: Approve Access

1. **DM your bot** on Discord
2. **Approve the pairing code:**

   ```bash
   openclaw pairing approve discord <CODE>
   ```

3. **Or add to allowlist:**
   ```json5
   {
     channels: {
       discord: {
         dm: {
           allowFrom: ['123456789012345678'], // Your Discord user ID
         },
       },
     },
   }
   ```

### Step 9: Restart Gateway

```bash
openclaw gateway restart
```

---

## iMessage Setup

iMessage requires a Mac with Messages signed in and the `imsg` CLI tool.

### Prerequisites

- macOS with Messages app signed in
- `imsg` CLI tool installed

### Step 1: Install imsg

```bash
brew install steipete/tap/imsg
```

### Step 2: Grant Permissions

When you first run `imsg`, macOS will prompt for:

1. **Full Disk Access** - Required to read Messages database
   - System Settings → Privacy & Security → Full Disk Access
   - Add Terminal (or your terminal app)
   - Add `imsg`

2. **Automation Permission** - Required to send messages
   - Granted automatically on first send

### Step 3: Test imsg

```bash
# List recent chats
imsg chats --limit 10

# Send a test message (to yourself)
imsg send "+1XXXXXXXXXX" "Test from imsg"
```

### Step 4: Update Configuration

The default config should work. Verify paths:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: 'imsg', // Or full path: /usr/local/bin/imsg
      dbPath: '~/Library/Messages/chat.db',
    },
  },
}
```

### Step 5: Approve Access

1. **Send a message to Helix** via iMessage
2. **Approve the pairing:**
   ```bash
   openclaw pairing approve imessage <CODE>
   ```

### Remote Mac Setup (Optional)

If your Gateway runs on a different machine, create an SSH wrapper:

```bash
#!/usr/bin/env bash
exec ssh -T user@mac-mini.local imsg "$@"
```

Update config:

```json5
{
  channels: {
    imessage: {
      cliPath: '~/.openclaw/scripts/imsg-ssh',
      remoteHost: 'user@mac-mini.local',
    },
  },
}
```

---

## Voice & TTS Setup

### Option A: ElevenLabs (Recommended)

ElevenLabs offers the highest quality AI voices.

1. **Create account:** [elevenlabs.io](https://elevenlabs.io)

2. **Get API key:**
   - Go to Profile → API Keys
   - Create a new API key

3. **Choose a voice:**
   - Go to Voices → Voice Library
   - Find a voice you like
   - Copy the Voice ID

4. **Add to environment:**

   ```bash
   # ~/.openclaw/.env
   ELEVENLABS_API_KEY=your-api-key-here
   ```

5. **Update configuration:**
   ```json5
   {
     messages: {
       tts: {
         provider: 'elevenlabs',
         elevenlabs: {
           voiceId: 'YOUR_VOICE_ID',
           modelId: 'eleven_v3',
         },
       },
     },
     talk: {
       voiceId: 'YOUR_VOICE_ID',
     },
   }
   ```

### Option B: OpenAI TTS

OpenAI's TTS is simpler but less customizable.

1. **Get API key:** [platform.openai.com](https://platform.openai.com)

2. **Add to environment:**

   ```bash
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **Update configuration:**
   ```json5
   {
     messages: {
       tts: {
         provider: 'openai',
         openai: {
           voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
         },
       },
     },
   }
   ```

### Option C: Edge TTS (Free)

Edge TTS uses Microsoft's free neural voices. No API key needed.

```json5
{
  messages: {
    tts: {
      provider: 'edge',
      edge: {
        voice: 'en-US-MichelleNeural',
        lang: 'en-US',
      },
    },
  },
}
```

Available voices: Run `openclaw tts voices` to list.

### macOS Native TTS (Say Command)

For local testing, you can use macOS's `say` command:

```bash
say -v "Samantha" "Hello, I am Helix"
```

### Voice Wake Setup

Voice wake (wake word detection) is configured through the apps:

1. **macOS App:** OpenClaw.app → Settings → Voice Wake
2. **iOS App:** Settings → Voice Wake
3. **Android App:** Settings → Voice Wake

Default wake word: `"Helix"`

Wake words are stored in `~/.openclaw/settings/voicewake.json`:

```json
{
  "triggers": ["helix", "hey helix"],
  "updatedAtMs": 1234567890000
}
```

---

## Gmail Integration

Gmail integration allows Helix to receive and respond to emails.

### Prerequisites

- Google Cloud project with Gmail API enabled
- OAuth credentials or service account
- `gog` (Google OAuth Gateway) tool

### Step 1: Set Up Google Cloud Project

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**

2. **Create a new project** (or use existing)

3. **Enable Gmail API:**
   - APIs & Services → Enable APIs → Gmail API

4. **Create OAuth credentials:**
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Desktop app
   - Download JSON

### Step 2: Install and Configure gog

```bash
# Install gog
npm install -g gog

# Authenticate
gog auth login --credentials-file /path/to/credentials.json
```

### Step 3: Set Up Gmail Webhook

```bash
openclaw webhooks gmail setup
```

This will:

- Create a Pub/Sub topic
- Create a push subscription
- Start watching your inbox

### Step 4: Update Configuration

```json5
{
  hooks: {
    enabled: true,
    gmail: {
      account: 'your-email@gmail.com',
      includeBody: true,
      maxBytes: 50000,
    },
  },
}
```

### Step 5: Test

Send yourself an email and check:

```bash
openclaw logs --follow
```

---

## Post-Setup Security

After initial pairing is complete, tighten security:

### 1. Change from Pairing to Allowlist

Update each channel to use explicit allowlists:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: 'allowlist',
      allowFrom: ['+1XXXXXXXXXX'],
    },
    telegram: {
      dmPolicy: 'allowlist',
      allowFrom: ['123456789'],
    },
    discord: {
      dm: {
        policy: 'allowlist',
        allowFrom: ['123456789012345678'],
      },
    },
  },
}
```

### 2. Restrict Elevated Access

Only allow elevated (host shell) access from trusted senders:

```json5
{
  tools: {
    elevated: {
      enabled: true,
      allowFrom: {
        whatsapp: ['+1XXXXXXXXXX'], // Only your number
        telegram: ['123456789'],
        discord: ['123456789012345678'],
      },
    },
  },
}
```

### 3. Set Up Gateway Token

If accessing the gateway remotely, set a strong token:

```json5
{
  gateway: {
    auth: {
      mode: 'token',
      token: 'your-secure-random-token-here',
    },
  },
}
```

Generate a secure token:

```bash
openssl rand -hex 32
```

### 4. Review Channel Status

```bash
# Check all channels
openclaw channels status

# Check pairing requests
openclaw pairing list whatsapp
openclaw pairing list telegram
openclaw pairing list discord
```

---

## Quick Reference

### Common Commands

```bash
# Gateway
openclaw gateway           # Start gateway
openclaw gateway status    # Check status
openclaw gateway restart   # Restart

# Channels
openclaw channels status   # All channel status
openclaw channels login    # Link WhatsApp

# Pairing
openclaw pairing list <channel>
openclaw pairing approve <channel> <code>

# Configuration
openclaw doctor            # Check config
openclaw config get        # View config
openclaw config set <path> <value>

# Logs
openclaw logs              # View recent logs
openclaw logs --follow     # Stream logs
```

### Environment Variables

| Variable                 | Description         |
| ------------------------ | ------------------- |
| `ANTHROPIC_API_KEY`      | Claude API access   |
| `TELEGRAM_BOT_TOKEN`     | Telegram bot        |
| `DISCORD_BOT_TOKEN`      | Discord bot         |
| `ELEVENLABS_API_KEY`     | Voice synthesis     |
| `OPENAI_API_KEY`         | OpenAI TTS/fallback |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth        |

### File Locations

| Path                        | Description           |
| --------------------------- | --------------------- |
| `~/.openclaw/openclaw.json` | Main configuration    |
| `~/.openclaw/.env`          | Environment variables |
| `~/.openclaw/credentials/`  | Channel credentials   |
| `~/.openclaw/settings/`     | User preferences      |
| `~/.openclaw/logs/`         | Log files             |

---

## Need Help?

- **Helix Docs:** Check the `docs/` directory
- **OpenClaw Engine Docs:** `openclaw-helix/docs/` for engine-specific help
- **Run diagnostics:** `openclaw doctor`
- **Test webhooks:** `npm run test:webhooks`

---

_Last updated: January 31, 2026_
