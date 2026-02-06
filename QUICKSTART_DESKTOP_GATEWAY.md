# Helix Desktop Gateway - Quick Start

## Run Gateway (30 Seconds)

### Windows

```powershell
# Double-click this file:
helix-gateway-desktop.bat

# OR run in PowerShell:
node helix-gateway-desktop.js
```

### macOS/Linux

```bash
./helix-gateway-desktop.js
# or
node helix-gateway-desktop.js
```

---

## What You'll See

```
🚀 Starting Helix Desktop Gateway
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Primary Port: 18789
🔒 Bind Address: 127.0.0.1
🌍 Environment: development
✨ Port Discovery: Enabled (auto-fallback to next available port)
🧠 Phase 1B Features: Memory Synthesis, THANOS_MODE Auth, Hash Chain Logging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[helix] Initializing gateway security...
[helix] Gateway security ready: 127.0.0.1:18789 (development)
[helix] Auto-starting gateway server...
[helix] Gateway auto-started on 127.0.0.1:18789
✅ Gateway ready at http://localhost:18789
```

---

## Test It Works (In Another Terminal)

```bash
# Test THANOS_MODE authentication trigger
curl -X POST http://localhost:18789/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "THANOS_MODE_AUTH_1990"}'
```

**Expected Response:**

```json
{
  "role": "assistant",
  "content": "Creator verification initiated. Provide your API key:"
}
```

---

## Features Enabled

✅ **Memory Synthesis** - AI analyzes conversations, updates psychology files
✅ **THANOS_MODE** - Creator authentication with 1.0 trust level
✅ **Port Discovery** - Auto-fallback if port 18789 is in use
✅ **Discord Logging** - Hash chain integrity verification
✅ **Supabase Sync** - Cloud-based memory storage

---

## Custom Port

```bash
# If port 18789 is blocked:
HELIX_GATEWAY_PORT=3000 node helix-gateway-desktop.js
```

Port discovery will try 3000, 3001, 3002, etc until it finds an available one.

---

## Monitor Logs

Watch Discord channels in real-time:

- `#helix-hash-chain` - Memory synthesis logs
- `#helix-alerts` - Errors and anomalies
- `#helix-heartbeat` - 60-second proof-of-life pings

---

## Full Documentation

For detailed testing guide, architecture overview, and troubleshooting:

👉 **See: DESKTOP_GATEWAY_SETUP.md**

---

## What's New (This Build)

- 🔄 **Port Discovery Integration** - Gateway now auto-discovers available ports
- 🧠 **Phase 1B Synthesis Pipeline** - Memory analysis and psychology updates
- 🔐 **THANOS_MODE Auth** - Creator verification system
- 📊 **Salience Scoring** - Memory importance calculation
- 🪝 **Hash Chain Logging** - Immutable audit trail

---

## Architecture

```
User Message
    ↓
Gateway (Port: 18789 or next available)
    ↓
Port Discovery (if 18789 in use → try 18790, 18791, ...)
    ↓
Chat Handler
    ├─ Fetch Helix context (personality, psychology)
    ├─ Call Claude API
    └─ Send response back to user
    ↓
Memory Synthesis (async, fire-and-forget)
    ├─ Analyze conversation
    ├─ Extract goals, emotions, attachments
    ├─ Calculate salience score
    ├─ Update psychology files atomically
    └─ Store in Supabase + Discord logging
```

---

## Status

- ✅ Built with Phase 1B implementations
- ✅ Port discovery integrated
- ✅ THANOS_MODE authentication ready
- ✅ Discord logging configured
- ⏳ Ready for testing

**Next:** `node helix-gateway-desktop.js`
