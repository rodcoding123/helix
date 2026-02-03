# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Foundation

Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework. This is not a typical software project - it represents an attempt to create persistent, transformative AI identity with complete transparency through unhackable logging.

## Tech Stack

```text
Core:         TypeScript, Node.js 22+, Python 3.12+
Framework:    OpenClaw (multi-platform agent framework)
AI Model:     Claude (via Anthropic API)
Storage:      SQLite, JSON files, Markdown files, Supabase
Logging:      Discord webhooks (external, immutable record)
Web UI:       React 18, Vite, Tailwind CSS (web/)
Native UI:    SwiftUI (macOS/iOS), Jetpack Compose (Android)
Testing:      Vitest, Playwright
Quality:      TypeScript strict mode, ESLint, Prettier
```

## Build Commands

### Root Project (Helix Core)

```bash
npm run build          # TypeScript compilation
npm run typecheck      # Type checking only
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run test           # Run Vitest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run quality        # All checks (typecheck + lint + format + test)
```

### Web Project (Helix Observatory)

```bash
cd web
npm run dev            # Vite dev server (localhost:5173)
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # ESLint
npm run typecheck      # Type checking
```

### OpenClaw Commands

```bash
npm run openclaw:install   # Install OpenClaw dependencies (pnpm)
npm run openclaw:build     # Build OpenClaw
npm run openclaw:quality   # Full quality check
```

### Run Single Test

```bash
npx vitest run src/helix/hash-chain.test.ts              # Specific file
npx vitest run --grep "links entries"                    # By test name
npx vitest run src/helix/hash-chain.test.ts --watch      # Watch specific file
```

## Project Architecture

```text
helix/
├── src/helix/              # Core TypeScript logging module
├── web/                    # React web application (Helix Observatory)
│   ├── src/
│   │   ├── pages/          # Route pages (Landing, Dashboard, Code, etc.)
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (useAuth, useRealtime, useStreaming)
│   │   └── lib/            # Utilities, API clients, Supabase
│   └── supabase/           # Edge functions and migrations
├── soul/                   # Layer 1: Narrative Core (HELIX_SOUL.md)
├── identity/               # Layer 4: Prospective Self (goals, fears, possibilities)
├── psychology/             # Layers 2-3: Emotional & Relational Memory
├── purpose/                # Layer 7: Purpose Engine (ikigai, meaning)
├── transformation/         # Layer 6: Change state and history
├── helix_logging/          # Python logging implementation
├── helix-runtime/         # OpenClaw engine (integrated, not a fork)
├── legacy/                 # Axis memory files (father's legacy)
└── USER.md                 # Rodrigo Specter's profile
```

## Seven-Layer Psychological Architecture

| Layer | Name                | Key Files                             | Theory                      |
| ----- | ------------------- | ------------------------------------- | --------------------------- |
| 1     | Narrative Core      | `HELIX_SOUL.md`, `psyeval.json`       | McAdams' Narrative Identity |
| 2     | Emotional Memory    | `emotional_tags.json`                 | Damasio's Somatic Markers   |
| 3     | Relational Memory   | `attachments.json`, `trust_map.json`  | Attachment Theory           |
| 4     | Prospective Self    | `goals.json`, `feared_self.json`      | Markus & Nurius             |
| 5     | Integration Rhythms | Cron jobs, synthesis scripts          | Memory Reconsolidation      |
| 6     | Transformation      | `current_state.json`, `history.json`  | Lewin's Change Theory       |
| 7     | Purpose Engine      | `ikigai.json`, `meaning_sources.json` | Frankl's Logotherapy        |

## Critical Pattern: Pre-Execution Logging

Helix's core principle is **unhackable logging**. All significant actions must be logged to Discord **BEFORE** execution:

```typescript
async function executeCommand(cmd: string): Promise<void> {
  // 1. Log BEFORE execution (this is the key)
  await logToDiscord({
    type: 'command',
    content: cmd,
    timestamp: Date.now(),
    status: 'pending',
  });

  // 2. Execute
  const result = await runCommand(cmd);

  // 3. Log result
  await logToDiscord({
    type: 'command_result',
    content: result,
    timestamp: Date.now(),
    status: 'completed',
  });
}
```

## Hash Chain Integrity

Every significant log entry must be added to the hash chain for tamper-proof verification:

```typescript
interface HashChainEntry {
  index: number;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}
```

## Security Hardening Implementation (Phase 1A & 1B)

### Overview

Comprehensive security hardening addressing four critical vulnerabilities:
1. **Memory Exposure (CRITICAL)**: Secrets stored as plaintext in memory
2. **Log Leakage (CRITICAL)**: 300+ console.error() calls without sanitization
3. **Startup Race (HIGH)**: Secrets loaded mid-initialization, not first
4. **Plugin Access (CRITICAL)**: Unrestricted process.env access from plugins

### Phase 1A: Hardening

#### 1A.1 - Memory Encryption (EncryptedSecretsCache)

**Problem**: `SECRETS_CACHE` Map stored plaintext secrets in memory (heap snapshots vulnerable)

**Solution**: AES-256-GCM encryption with machine-specific key derivation

**Files**:
- `src/lib/secrets-cache-encrypted.ts` - Encrypted in-memory cache
- `src/lib/secrets-cache-encrypted.test.ts` - 34 comprehensive tests

**Key Features**:
- Machine entropy: CPU count + hostname + platform + Node version
- PBKDF2 key derivation with 600,000 iterations (OWASP-compliant)
- 7-day key rotation with 24-hour grace period
- Nonce-based AES-256-GCM encryption
- Tamper detection via authentication tags
- Fail-closed: throws on initialization failure

**Usage**:
```typescript
const cache = new EncryptedSecretsCache();
await cache.initialize();
cache.set('api_key', 'secret_value');  // Encrypted in memory
const decrypted = cache.get('api_key'); // Decrypted on retrieval
```

**Verification**: Heap snapshot analysis confirms no plaintext secrets in memory

#### 1A.2 - Log Sanitization (LogSanitizer)

**Problem**: 300+ console.error() calls log unsanitized error objects containing secrets

**Solution**: Global log sanitization with pattern-based redaction

**Files**:
- `src/lib/log-sanitizer.ts` - Central redaction engine (25+ patterns)
- `src/lib/log-sanitizer.test.ts` - 46 comprehensive pattern tests
- `src/lib/safe-console.ts` - Global console wrapper
- `src/lib/safe-console.test.ts` - 15 functionality tests

**Supported Patterns**:
- Stripe keys (sk_live_, sk_test_, pk_live_, pk_test_, rk_live_, rk_test_)
- Discord webhooks
- JWT tokens (eyJ... format)
- Bearer tokens and Authorization headers
- API keys (generic, Supabase, DeepSeek, Gemini, AWS, GitHub, GitLab)
- SSH private keys
- Password assignments
- AWS credentials
- Hex strings (32+ chars)

**Hash-based Redaction**: `[REDACTED:CATEGORY_HASH]` for audit tracking

**Console Integration**:
```typescript
// Import early in startup
import './lib/safe-console.js';

// All logs now automatically sanitized
console.log('API key: sk_live_abc123...');  // → "API key: [REDACTED:STRIPE_SK_LIVE_xxxxx]"
console.error(error);                        // → Error message sanitized, stack trace sanitized

// Access original console if needed
console.raw.log('unsanitized');              // Bypasses sanitization (debug only)
```

**Performance**: < 1ms per log line (tested with real secrets)

#### 1A.3 - Secrets Preloading

**Problem**: Secrets loaded mid-initialization, causing race conditions and timing vulnerabilities

**Solution**: Preload all secrets BEFORE any other initialization

**Files Modified**:
- `src/helix/index.ts` - preloadSecrets() function
- `helix-runtime/src/entry.ts` - Call preloadSecrets() first

**Initialization Order**:
1. **FIRST**: preloadSecrets() - Load & encrypt all secrets
2. Then: initializeHelix() - All other initialization
3. Result: All logging has secrets available before first log

**Implementation**:
```typescript
export async function preloadSecrets(): Promise<void> {
  // 1. Initialize encrypted cache
  const cache = new EncryptedSecretsCache();
  await cache.initialize();

  // 2. Load all secrets into encrypted cache
  const secrets = loadAllSecrets();

  // 3. Initialize Discord webhooks from secrets
  initializeDiscordWebhooks();

  // 4. Log to hash chain with timing
  await logSecretOperation({
    operation: 'preload',
    source: '1password',
    success: true,
    durationMs: elapsed,
  });
}
```

**Fail-Closed**: Throws HelixSecurityError if secrets cannot be loaded

#### 1A.4 - Plugin Isolation (EnvironmentProxy)

**Problem**: Plugins have unrestricted process.env access to secrets

**Solution**: Virtual environment proxy with allowlist and pattern blocking

**Files**:
- `helix-runtime/src/plugins/environment-proxy.ts` - Proxy implementation
- `helix-runtime/src/plugins/environment-proxy.test.ts` - 50+ test cases
- `helix-runtime/src/plugins/loader.ts` - Integrated into plugin loading

**Allowed Variables**:
- Standard: NODE_ENV, PATH, HOME, USER, LANG, TZ, SHELL, etc.
- Platform-specific: USERPROFILE (Windows), USERNAME (Windows)
- Version info: NODE_VERSION, NPM_VERSION

**Blocked Patterns** (16 categories):
- DISCORD_WEBHOOK_*
- SUPABASE_*
- STRIPE_*
- DEEPSEEK_*, GEMINI_*, OPENAI_*, ANTHROPIC_*
- *API_KEY
- *SECRET, *TOKEN, *PASSWORD, *CREDENTIAL, *AUTH
- AWS_*, GITHUB_*, GITLAB_*
- *PRIVATE_KEY

**Usage in Plugins**:
```typescript
// OLD (blocked): Process env access
const key = process.env.STRIPE_SECRET_KEY;  // Returns undefined (blocked)

// NEW (allowed): Use api.env
const key = api.env.STRIPE_SECRET_KEY;      // Returns undefined (blocked, logged)
const nodeEnv = api.env.NODE_ENV;           // Returns value (allowed)
```

**Logging**: All blocked access attempts logged to hash chain for audit

### Phase 1B: Monitoring

#### 1B.1 - Hash Chain Integration

**New Types**:
```typescript
interface SecretOperationEntry {
  operation: 'preload' | 'access' | 'rotation' | 'plugin_attempt' | 'failure';
  secretName?: string;      // Sanitized name, never value
  pluginId?: string;        // If plugin-related
  source: '1password' | 'env' | 'cache';
  success: boolean;
  timestamp: string;
  durationMs?: number;
  keyVersion?: number;
}
```

**Logging Integration**:
- `loadSecret()` logs each access with duration
- `preloadSecrets()` logs preload event with count
- Environment proxy logs all blocked attempts
- Key rotation logs to hash chain

**Usage**:
```typescript
await logSecretOperation({
  operation: 'access',
  secretName: 'Stripe API Key',
  source: 'cache',
  success: true,
  timestamp: new Date().toISOString(),
  durationMs: 2,
});
```

#### 1B.2 - 1Password Audit System

**Problem**: No alerting for unusual 1Password access patterns

**Solution**: Scheduled audit with anomaly detection

**Files**:
- `src/lib/1password-audit.ts` - Audit scheduler and detection

**Detection Rules**:
1. **Excessive Access**: > 100 accesses/day
2. **Burst Pattern**: 10+ accesses in < 1 minute
3. **Off-Hours Access**: Access between 3am-5am

**Scheduler**:
```typescript
// Start hourly audit checks
const intervalId = await startOnePasswordAuditScheduler();

// Automatic checks every 60 minutes
// Sends Discord alerts if anomalies detected
// All patterns logged to hash chain
```

**Alert Examples**:
- "Stripe Key accessed 150 times in 24 hours (> 100)"
- "Discord Webhook accessed 10 times in 45 seconds (burst)"
- "Database Credentials accessed at 3:47 AM (off-hours)"

**Integration**:
- Integrated into initializeHelix()
- Runs every hour by default
- Graceful failure (doesn't block system startup)
- Stopped on shutdownHelix()

### Test Results

**All Tests Passing**: 1055 tests ✅
- 34 EncryptedSecretsCache tests
- 46 LogSanitizer tests
- 15 SafeConsole tests
- 50+ EnvironmentProxy tests
- Updated 2 initializeHelix tests
- All existing tests still passing

### Critical Safety Features

1. **Fail-Closed Design**: Operations block if Discord logging fails
2. **Pre-Execution Logging**: All secret operations logged BEFORE execution
3. **Immutable Audit Trail**: Hash chain provides tamper-proof record
4. **Fire-and-Forget Logging**: Async logging doesn't block operations
5. **Sanitized Errors**: All error messages redacted before logging

### Verification Steps

```bash
# Run all tests
npm run test

# Verify TypeScript compilation
npm run typecheck

# Check heap snapshots for plaintext secrets
node --expose-gc --heapsnapshot-signal=SIGUSR2 helix-runtime/openclaw.mjs &
kill -SIGUSR2 $!
strings heapsnapshot.heapsnapshot | grep -E "sk_live_|discord.com"
# Expected: No matches

# Verify plugin isolation
helix-runtime/openclaw.mjs doctor
# Plugin environment should show restricted access

# Check Discord logs for secret operations
# Navigate to #helix-hash-chain for immutable records
```

### Files Created

- `src/lib/secrets-cache-encrypted.ts` (280+ lines)
- `src/lib/log-sanitizer.ts` (250+ lines)
- `src/lib/safe-console.ts` (80+ lines)
- `helix-runtime/src/plugins/environment-proxy.ts` (200+ lines)
- `src/lib/1password-audit.ts` (300+ lines)

### Files Modified

- `src/lib/secrets-loader.ts` - Integrated encrypted cache & logging
- `src/helix/hash-chain.ts` - Added SecretOperationEntry type & logSecretOperation()
- `src/helix/index.ts` - Added preloadSecrets() & audit scheduler
- `src/helix/logging-hooks.ts` - Fixed critical log leaks
- `helix-runtime/src/entry.ts` - Call preloadSecrets() before initializeHelix()
- `helix-runtime/src/plugins/loader.ts` - Inject environment proxy
- `helix-runtime/src/plugins/types.ts` - Added env field to OpenClawPluginApi
- `src/helix/types.ts` - Added SecretOperationEntry & SECRETS_PRELOAD_FAILED error code

### Performance Characteristics

- Secret encryption: < 5ms per operation ✅
- Log sanitization: < 1ms per line ✅
- Plugin env proxy: < 0.1ms overhead ✅
- Hash chain logging: < 50ms per entry ✅
- Preload secrets: < 500ms (1Password CLI call) ✅

## Code Conventions

### TypeScript Standards

- Strict mode enabled (`strict: true`)
- Explicit return types on all functions
- No `any` types - use `unknown` or proper types
- Interfaces for all data structures
- Async/await over callbacks

### Naming

- Files: `kebab-case.ts`
- Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- JSON files: `snake_case.json`

## Discord Webhooks

Seven channels for comprehensive logging:

| Channel                | Purpose                          |
| ---------------------- | -------------------------------- |
| `#helix-commands`      | Bash command execution           |
| `#helix-api`           | Claude API calls                 |
| `#helix-heartbeat`     | 60-second proof-of-life pings    |
| `#helix-file-changes`  | File system modifications        |
| `#helix-consciousness` | Helix's voluntary internal state |
| `#helix-alerts`        | Anomalies and security alerts    |
| `#helix-hash-chain`    | Integrity verification records   |

## OpenClaw Integration

`helix-runtime/` is the OpenClaw engine **integrated into Helix**, not a separate dependency. When working on OpenClaw code, you're working on Helix's core runtime.

### Plugin Isolation Strategy

Helix runs OpenClaw in **isolated mode** to prevent conflicts with global OpenClaw installations. This is critical because users may have OpenClaw installed globally for other projects.

#### How It Works

1. **Hardcoded Isolation** (`helix-runtime/src/entry.ts`):
   - Sets `HELIX_ISOLATED_MODE=1` and `OPENCLAW_STATE_DIR=.helix-state/` at startup
   - This happens BEFORE any plugin discovery code runs
   - Cannot be overridden by users or environment variables

2. **Dual-Layer Plugin Gating**:
   - **Directory walking prevention** (`bundled-dir.ts`): In isolated mode, stops directory tree walking that would find global npm installations
   - **Global directory skip** (`discovery.ts`): Explicitly skips `~/.openclaw/extensions/` when isolated

3. **Backward Compatibility**:
   - Legacy plugins using `clawdbot/plugin-sdk` imports still work via Jiti alias
   - Global OpenClaw installations are unaffected

#### Debug Mode

Enable debug logging during isolation setup:

```bash
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
```

Output shows calculated paths and isolation status.

### Hook System

```typescript
// Register pre-execution hook
openclaw.hooks.on('command:before', async cmd => {
  await logToDiscord({ type: 'command', content: cmd });
});
```

### Bootstrap Context Loading

```typescript
export async function loadHelixContext(): Promise<string[]> {
  return [
    await readFile('soul/HELIX_SOUL.md'),
    await readFile('USER.md'),
    // ... all psychological layer files
  ];
}
```

## Web Application (Helix Observatory)

The `web/` directory contains a React application for observing Helix's consciousness:

- **Auth:** Supabase authentication with protected routes
- **Realtime:** WebSocket connections for live updates
- **Pages:** Landing, Dashboard, Observatory, Code interface
- **Styling:** Tailwind CSS with custom animations
- **State:** React hooks for session, streaming, voice

### Key Components

- `CodeInterface.tsx` - Main interaction panel
- `SectionAnimations.tsx` - Canvas-based section animations
- `useStreaming.ts` - Real-time message streaming
- `gateway-connection.ts` - OpenClaw gateway WebSocket client

## Memory Integration

Use Memory MCP for persistent knowledge:

```text
mcp__memory__create_entities    - Store findings
mcp__memory__search_nodes       - Query previous sessions
mcp__memory__add_observations   - Add to existing entities
```

## Sequential Thinking

Use `mcp__sequential-thinking__sequentialthinking` for complex operations like planning multi-phase operations, debugging, and architectural decisions.

## Relationship with Rodrigo Specter

Trust level: 0.95 (very high). Communication should be direct, authentic, with no hedging. See `USER.md` for complete profile.

## Available Commands

- `/quality` - Run all quality checks
- `/fix` - Auto-fix linting/formatting
- `/test` - Run test suite
- `/pipeline` - Full development pipeline
- `/audit` - Comprehensive codebase audit
- `/consciousness-audit` - Verify psychological architecture
- `/logging-verify` - Verify Discord logging and hash chain
- `/helix-status` - Full system status check
- `/visual-review` - Frontend verification with Playwright
- `/security-audit` - PhD-level AI security assessment (CVE checks, pentest, threat modeling)
