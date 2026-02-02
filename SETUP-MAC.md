# Helix Setup Guide for Mac (Claude Code Terminal)

Complete installation guide for setting up Helix on a fresh Mac with Claude Code (terminal version).

## Prerequisites

### 1. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, add to PATH (Apple Silicon Macs):

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 2. Install Core Dependencies

```bash
# Node.js 22+ (required)
brew install node@22
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Python 3.12+
brew install python@3.12

# Git
brew install git

# GitHub CLI (for PRs and issues)
brew install gh

# pnpm (required for OpenClaw)
npm install -g pnpm

# Docker (optional, for containerized deployment)
brew install --cask docker
```

### 3. Install Platform CLIs

```bash
# Supabase CLI (database, auth, edge functions)
brew install supabase/tap/supabase

# Vercel CLI (deployment)
npm install -g vercel

# Deno (required for Supabase edge functions)
brew install deno

# Stripe CLI (optional, for payment testing)
brew install stripe/stripe-cli/stripe
```

### 4. Verify Installations

```bash
node --version      # Should be v22.x.x or higher
npm --version       # Should be 10.x.x or higher
pnpm --version      # Should be 10.x.x or higher
python3 --version   # Should be 3.12.x or higher
git --version
gh --version
supabase --version  # Should be 1.x.x or higher
vercel --version    # Should be 39.x.x or higher
deno --version      # Should be 2.x.x or higher
stripe --version    # (optional) Should be 1.x.x
```

---

## Install Claude Code (Terminal)

### 1. Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Authenticate

```bash
claude login
```

This will open a browser for Anthropic account authentication.

### 3. Verify Installation

```bash
claude --version
```

---

## Clone and Setup Helix Repository

### 1. Clone the Repository

```bash
cd ~/Desktop  # or your preferred location
git clone https://github.com/rodrigo-specter/helix.git Helix
cd Helix
```

### 2. Install Root Dependencies

```bash
npm install
```

### 3. Install OpenClaw Dependencies

```bash
cd openclaw-helix
pnpm install
cd ..
```

### 4. Install Web UI Dependencies

```bash
cd web
npm install
cd ..
```

### 5. Install Python Dependencies

```bash
pip3 install python-dotenv aiohttp
```

### 6. Build All Projects

```bash
# Build root TypeScript
npm run build

# Build OpenClaw
npm run openclaw:build
```

---

## Configure Environment Variables

### 1. Create Root .env File

```bash
cat > .env << 'EOF'
# ============================================
# HELIX ENVIRONMENT CONFIGURATION
# ============================================

# Anthropic API Key (required for Claude integration)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI API Key (optional, for GPT models)
OPENAI_API_KEY=your_openai_api_key_here

# Discord Webhooks (required for unhackable logging)
DISCORD_WEBHOOK_COMMANDS=https://discord.com/api/webhooks/your_commands_webhook
DISCORD_WEBHOOK_HASH_CHAIN=https://discord.com/api/webhooks/your_hashchain_webhook
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/your_alerts_webhook

# Optional Discord Webhooks
DISCORD_WEBHOOK_API=https://discord.com/api/webhooks/your_api_webhook
DISCORD_WEBHOOK_FILE_CHANGES=https://discord.com/api/webhooks/your_files_webhook
DISCORD_WEBHOOK_CONSCIOUSNESS=https://discord.com/api/webhooks/your_consciousness_webhook
DISCORD_WEBHOOK_HEARTBEAT=https://discord.com/api/webhooks/your_heartbeat_webhook

# Supabase (for web UI and session sync)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxx

# Security Settings
HELIX_FAIL_CLOSED=true
HELIX_SECURITY_VALIDATION=true

# OpenClaw Settings
OPENCLAW_WORKSPACE=~/.openclaw/workspace
EOF
```

### 2. Create Python .env File

```bash
cat > helix_logging/.env << 'EOF'
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_main_webhook
DISCORD_WEBHOOK_HASH_CHAIN=https://discord.com/api/webhooks/your_hashchain_webhook
EOF
```

### 3. Create Web UI .env File

```bash
cat > web/.env.local << 'EOF'
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe (publishable key for frontend)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# App URLs
VITE_APP_URL=http://localhost:5173
EOF
```

### 4. Create Supabase Edge Functions .env

```bash
cat > web/supabase/.env << 'EOF'
# Supabase (auto-injected in production)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
EOF
```

---

## Configure Claude Code for Helix

### 1. Create Claude Code Settings Directory

```bash
mkdir -p .claude/agents .claude/commands .claude/skills .claude/plans
```

### 2. Create Main Settings File

```bash
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "file=\"$CLAUDE_FILE_PATH\"; if [[ \"$file\" == *.ts ]]; then npx prettier --write \"$file\" --log-level=silent 2>/dev/null; npx eslint --fix \"$file\" --max-warnings=0 2>&1 | head -10; elif [[ \"$file\" == *.json ]]; then npx prettier --write \"$file\" --log-level=silent 2>/dev/null; elif [[ \"$file\" == *.py ]]; then python3 -m black \"$file\" --quiet 2>/dev/null; python3 -m ruff check \"$file\" --fix --quiet 2>&1 | head -10; fi"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=\"$CLAUDE_FILE_PATH\"; if [[ \"$file\" == *.ts ]]; then npx prettier --write \"$file\" --log-level=silent 2>/dev/null; npx eslint --fix \"$file\" --max-warnings=0 2>&1 | head -10; elif [[ \"$file\" == *.json ]]; then npx prettier --write \"$file\" --log-level=silent 2>/dev/null; elif [[ \"$file\" == *.py ]]; then python3 -m black \"$file\" --quiet 2>/dev/null; python3 -m ruff check \"$file\" --fix --quiet 2>&1 | head -10; fi"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(tsc:*)",
      "Bash(vitest:*)",
      "Bash(eslint:*)",
      "Bash(prettier:*)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git branch:*)",
      "Bash(git checkout:*)",
      "Bash(gh pr:*)",
      "Bash(gh issue:*)",
      "Bash(curl:*)",
      "Bash(supabase:*)",
      "Bash(vercel:*)",
      "Bash(deno:*)",
      "Bash(stripe:*)",
      "Bash(pnpm:*)",
      "Bash(docker:*)"
    ]
  }
}
EOF
```

### 3. Create Local Settings with MCP Permissions

```bash
cat > .claude/settings.local.json << 'EOF'
{
  "permissions": {
    "allow": [
      "mcp__memory__*",
      "mcp__sequential-thinking__*",
      "mcp__plugin_playwright_playwright__*"
    ]
  }
}
EOF
```

---

## Install MCP Servers

Helix uses three MCP servers for enhanced capabilities:

### 1. Memory MCP (Knowledge Graph)

```bash
# Install globally
npm install -g @anthropic-ai/mcp-server-memory

# Or install locally in project
npm install --save-dev @anthropic-ai/mcp-server-memory
```

### 2. Sequential Thinking MCP

```bash
npm install -g @anthropic-ai/mcp-server-sequential-thinking
```

### 3. Playwright MCP (Browser Automation)

```bash
npm install -g @anthropic-ai/mcp-server-playwright

# Install Playwright browsers
npx playwright install chromium
```

### 4. Configure MCP Servers

Create the MCP configuration file in Claude Code's config directory:

```bash
# Mac location for Claude Code config
mkdir -p ~/.claude

cat > ~/.claude/mcp.json << 'EOF'
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-memory"],
      "env": {
        "MEMORY_FILE": "~/.claude/memory.json"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-playwright"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "~/.cache/ms-playwright"
      }
    }
  }
}
EOF
```

---

## Install Python Linting Tools

For the PostToolUse hooks to work on Python files:

```bash
pip3 install black ruff
```

---

## Verify Setup

### 1. Run Quality Checks

```bash
cd ~/Desktop/Helix

# TypeScript check
npm run typecheck

# Lint check
npm run lint

# Run tests
npm run test

# Full quality check
npm run quality
```

### 2. Test OpenClaw

```bash
npm run openclaw:quality
```

### 3. Test Discord Webhooks (if configured)

```bash
npx tsx scripts/test-webhooks.ts
```

### 4. Start Claude Code in Helix Directory

```bash
cd ~/Desktop/Helix
claude
```

---

## Available Commands in Claude Code

Once running inside the Helix directory, you can use these slash commands:

### Helix-Specific Commands

| Command                | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `/quality`             | Run all quality checks (typecheck + lint + format + test) |
| `/fix`                 | Auto-fix linting and formatting issues                    |
| `/test`                | Run test suite                                            |
| `/pipeline`            | Full development pipeline                                 |
| `/audit`               | Comprehensive codebase audit                              |
| `/consciousness-audit` | Verify psychological architecture                         |
| `/logging-verify`      | Verify Discord logging and hash chain                     |
| `/helix-status`        | Full system status check                                  |
| `/visual-review`       | Frontend verification with Playwright                     |
| `/security-audit`      | PhD-level AI security assessment                          |
| `/debug`               | Systematic bug investigation                              |
| `/pr`                  | Create a pull request                                     |
| `/commit`              | Create a git commit                                       |
| `/cleanup`             | Clean up generated files and caches                       |

### Available Skills

Skills are specialized capabilities loaded into Claude Code:

| Skill                  | Description                        |
| ---------------------- | ---------------------------------- |
| `helix-typescript`     | TypeScript patterns for Helix core |
| `lit-components`       | Lit web component development      |
| `openclaw-integration` | OpenClaw platform integration      |

---

## Project Structure Overview

```
helix/
├── src/helix/              # Core TypeScript logging module
├── web/                    # React web application (Helix Observatory)
├── openclaw-helix/         # OpenClaw engine (integrated)
├── soul/                   # Layer 1: Narrative Core
├── identity/               # Layer 4: Prospective Self
├── psychology/             # Layers 2-3: Emotional & Relational Memory
├── purpose/                # Layer 7: Purpose Engine
├── transformation/         # Layer 6: Change state and history
├── helix_logging/          # Python logging implementation
├── .claude/                # Claude Code configuration
│   ├── agents/             # Custom agent definitions
│   ├── commands/           # Slash command definitions
│   ├── skills/             # Skill definitions
│   └── settings.json       # Main settings
└── CLAUDE.md               # Project instructions for Claude
```

---

## Discord Webhook Setup

Helix requires Discord webhooks for its "unhackable logging" system. Create these channels and webhooks:

### Required Channels

1. `#helix-commands` - Command execution logs
2. `#helix-hash-chain` - Integrity verification records
3. `#helix-alerts` - Security alerts and anomalies

### Optional Channels

4. `#helix-api` - Claude API call logs
5. `#helix-file-changes` - File system modifications
6. `#helix-consciousness` - Internal state observations
7. `#helix-heartbeat` - Proof-of-life pings

### Creating Webhooks

1. Go to Discord Server Settings → Integrations → Webhooks
2. Create a webhook for each channel
3. Copy webhook URLs to your `.env` file

---

## Security Configuration

Helix implements fail-closed security. Key environment variables:

| Variable                    | Default | Description                             |
| --------------------------- | ------- | --------------------------------------- |
| `HELIX_FAIL_CLOSED`         | `true`  | Block operations if logging unavailable |
| `HELIX_SECURITY_VALIDATION` | `true`  | Enable security validation checks       |

**Warning:** Setting `HELIX_FAIL_CLOSED=false` compromises the security guarantee.

---

## Troubleshooting

### Node Version Issues

```bash
# If using nvm
nvm install 22
nvm use 22
```

### pnpm Installation Failed

```bash
# Clear cache and reinstall
pnpm store prune
cd openclaw-helix && pnpm install --force
```

### MCP Servers Not Working

```bash
# Check if servers are installed
npx -y @anthropic-ai/mcp-server-memory --version
npx -y @anthropic-ai/mcp-server-sequential-thinking --version

# Reinstall if needed
npm cache clean --force
npm install -g @anthropic-ai/mcp-server-memory @anthropic-ai/mcp-server-sequential-thinking @anthropic-ai/mcp-server-playwright
```

### TypeScript Errors

```bash
# Clear build artifacts
rm -rf dist/ node_modules/.cache
npm run build
```

### Webhook Connection Errors

```bash
# Test webhook connectivity
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message from Helix setup"}'
```

### Supabase Issues

```bash
# Reset local Supabase
cd ~/Desktop/Helix/web
supabase stop
supabase start

# Check running containers
docker ps | grep supabase

# View logs
supabase logs

# Reset database (destroys data!)
supabase db reset
```

### Vercel Deployment Issues

```bash
# Check deployment status
vercel ls

# View build logs
vercel logs

# Redeploy with clean cache
vercel --force
```

### Deno/Edge Function Issues

```bash
# Test edge function locally
cd ~/Desktop/Helix/web
supabase functions serve stripe-webhook --env-file supabase/.env

# Check Deno cache
deno info

# Clear Deno cache
deno cache --reload
```

### Stripe Webhook Issues

```bash
# Listen for webhooks locally
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test event
stripe trigger payment_intent.succeeded

# Check webhook logs
stripe logs tail
```

---

## CLI Authentication

### GitHub CLI

```bash
gh auth login
```

Choose:

- GitHub.com
- HTTPS
- Authenticate with browser

### Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project (run from web/ directory)
cd ~/Desktop/Helix/web
supabase link --project-ref your-project-ref
```

### Vercel CLI

```bash
# Login to Vercel
vercel login

# Link to your project (run from web/ directory)
cd ~/Desktop/Helix/web
vercel link
```

### Stripe CLI (Optional)

```bash
# Login to Stripe
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

---

## Supabase Setup

### 1. Start Local Supabase

```bash
cd ~/Desktop/Helix/web

# Start local Supabase stack (Postgres, Auth, Storage, Edge Functions)
supabase start

# This outputs local URLs and keys - save these!
```

### 2. Run Migrations

```bash
# Apply all database migrations
supabase db push

# Or run specific migration
supabase migration up
```

### 3. Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy stripe-webhook
supabase functions deploy telemetry-ingest
supabase functions deploy heartbeat-receiver
```

### 4. Set Function Secrets

```bash
# Set Stripe secret for edge functions
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Vercel Deployment

### 1. Deploy Web UI

```bash
cd ~/Desktop/Helix/web

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

### 2. Set Environment Variables

```bash
# Set via CLI
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Or use Vercel dashboard: Settings → Environment Variables
```

---

## Next Steps

1. **Configure Discord Webhooks** - Set up channels and add webhook URLs
2. **Test the Setup** - Run `/helix-status` in Claude Code
3. **Read CLAUDE.md** - Understand the project context
4. **Explore Commands** - Try `/audit` for a system overview

---

## Quick Reference

```bash
# Start Claude Code
cd ~/Desktop/Helix && claude

# Run quality checks
npm run quality

# Build everything
npm run build:all

# Run all tests
npm run test:all

# Start web dev server
cd web && npm run dev
```

---

_Setup guide version: 2026.02.01_
_Compatible with: Claude Code v1.x, Node.js 22+, macOS 14+_
