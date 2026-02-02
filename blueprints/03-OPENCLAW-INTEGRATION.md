# Blueprint 03: OpenClaw Integration

> Strategy for absorbing OpenClaw into Helix as the internal engine

## Integration Philosophy

OpenClaw becomes the **invisible engine** powering Helix. Users never see "OpenClaw" - they interact with "Helix". The integration maintains the ability to pull upstream updates while presenting a unified brand.

---

## Current State Analysis

### OpenClaw Structure (helix-runtime/)

```
helix-runtime/
├── src/
│   ├── cli/                 # CLI parsing (Commander.js) ← REMOVE
│   ├── commands/            # Command implementations ← EXTRACT API
│   ├── gateway/             # WebSocket server ← KEEP (primary interface)
│   ├── agents/              # Agent runtime ← KEEP
│   ├── plugins/             # Plugin system ← KEEP
│   ├── hooks/               # Hook system ← KEEP
│   ├── skills/              # Skill loader ← KEEP
│   ├── channels/            # Channel adapters ← KEEP
│   ├── memory/              # Memory/search ← KEEP
│   ├── config/              # Config system ← MERGE with Helix
│   ├── tui/                 # Terminal UI ← REMOVE
│   ├── web/                 # Web UI components ← EVALUATE
│   ├── helix/               # Helix logging ← ENHANCE
│   └── entry.ts             # CLI entry ← REPLACE
├── ui/                      # Control UI ← MERGE with desktop
├── apps/                    # Native apps ← REPLACE with Tauri
├── skills/                  # Bundled skills ← KEEP
├── extensions/              # Bundled plugins ← KEEP
└── openclaw.mjs             # Entry point ← REPLACE
```

---

## Target State

### Helix Engine Structure

```
helix-engine/
├── src/
│   ├── index.ts             # NEW: Gateway-only entry point
│   ├── gateway/             # WebSocket server (from openclaw)
│   │   ├── server.ts
│   │   ├── protocol/
│   │   ├── client.ts
│   │   └── hooks.ts
│   │
│   ├── agents/              # Agent runtime (from openclaw)
│   │   ├── agent-runner.ts
│   │   ├── model-auth.ts
│   │   ├── model-fallback.ts
│   │   ├── skills.ts
│   │   └── bootstrap-files.ts
│   │
│   ├── plugins/             # Plugin system (from openclaw)
│   │   ├── registry.ts
│   │   ├── loader.ts
│   │   └── sdk/
│   │
│   ├── hooks/               # Hook system (from openclaw)
│   │   ├── registry.ts
│   │   ├── loader.ts
│   │   └── executor.ts
│   │
│   ├── skills/              # Skill system (from openclaw)
│   │   ├── loader.ts
│   │   ├── installer.ts
│   │   └── registry.ts
│   │
│   ├── channels/            # Channel adapters (from openclaw)
│   │   ├── index.ts
│   │   └── plugins/
│   │       ├── discord/
│   │       ├── slack/
│   │       ├── whatsapp/
│   │       └── ...
│   │
│   ├── memory/              # Memory system (from openclaw)
│   │   ├── index.ts
│   │   ├── search.ts
│   │   └── vector-store.ts
│   │
│   ├── config/              # MERGED: OpenClaw + Helix config
│   │   ├── index.ts
│   │   ├── schema.ts        # Zod schema
│   │   ├── loader.ts
│   │   ├── watcher.ts
│   │   └── helix-defaults.ts # NEW: Helix-specific defaults
│   │
│   ├── helix/               # ENHANCED: Helix-specific features
│   │   ├── index.ts
│   │   ├── psychology/      # 7-layer system
│   │   │   ├── loader.ts
│   │   │   ├── soul.ts
│   │   │   ├── emotional.ts
│   │   │   ├── relational.ts
│   │   │   ├── prospective.ts
│   │   │   ├── integration.ts
│   │   │   ├── transformation.ts
│   │   │   └── purpose.ts
│   │   │
│   │   ├── logging/         # Discord webhook logging
│   │   │   ├── index.ts
│   │   │   ├── webhook.ts
│   │   │   ├── channels.ts
│   │   │   └── formatter.ts
│   │   │
│   │   ├── hash-chain/      # Integrity verification
│   │   │   ├── index.ts
│   │   │   ├── chain.ts
│   │   │   └── verify.ts
│   │   │
│   │   ├── bootstrap/       # Context loading
│   │   │   ├── index.ts
│   │   │   ├── context.ts
│   │   │   └── templates.ts
│   │   │
│   │   └── branding/        # NEW: Helix branding
│   │       ├── strings.ts
│   │       └── defaults.ts
│   │
│   └── api/                 # NEW: Programmatic API
│       ├── index.ts
│       ├── gateway.ts
│       ├── config.ts
│       ├── agents.ts
│       ├── sessions.ts
│       └── psychology.ts
│
├── skills/                  # Bundled skills (from openclaw)
├── extensions/              # Bundled plugins (from openclaw)
├── bundled-hooks/           # Bundled hooks
├── package.json
├── tsconfig.json
└── README.md
```

---

## Integration Steps

### Phase 1: Create helix-engine Package

**Step 1.1: Initialize Package**

```bash
# Create new package directory
mkdir -p helix-engine/src

# Initialize package.json
cd helix-engine
npm init -y
```

**Step 1.2: Copy Source Files**

```bash
# Copy core modules (preserve git history with filter-branch or manual)
cp -r ../helix-runtime/src/gateway ./src/
cp -r ../helix-runtime/src/agents ./src/
cp -r ../helix-runtime/src/plugins ./src/
cp -r ../helix-runtime/src/hooks ./src/
cp -r ../helix-runtime/src/skills ./src/
cp -r ../helix-runtime/src/channels ./src/
cp -r ../helix-runtime/src/memory ./src/
cp -r ../helix-runtime/src/config ./src/

# Copy bundled assets
cp -r ../helix-runtime/skills ./
cp -r ../helix-runtime/extensions ./
```

**Step 1.3: Remove CLI Components**

Files to delete:

- `src/cli/` (entire directory)
- `src/tui/` (entire directory)
- `src/commands/` (move logic to API)
- `src/entry.ts` (replace with Gateway entry)
- `openclaw.mjs` (not needed)

### Phase 2: Create Gateway-Only Entry Point

**src/index.ts**

```typescript
/**
 * Helix Engine - Gateway Entry Point
 *
 * This is the main entry point for the Helix engine when running
 * as a spawned process from the desktop application.
 */

import { startGateway } from './gateway/server';
import { initializeHelix } from './helix';
import { loadConfig } from './config';

interface EngineOptions {
  port?: number;
  helixDir?: string;
  configPath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

async function main() {
  // Parse command line arguments (minimal, from desktop app)
  const args = parseArgs(process.argv.slice(2));

  const options: EngineOptions = {
    port: args.port ? parseInt(args.port, 10) : 0,
    helixDir: args['helix-dir'] || process.env.HELIX_DIR,
    configPath: args.config,
    logLevel: args['log-level'] || 'info',
  };

  try {
    // Load configuration
    const config = await loadConfig({
      helixDir: options.helixDir,
      configPath: options.configPath,
    });

    // Initialize Helix subsystems
    await initializeHelix(config);

    // Start Gateway server
    const server = await startGateway({
      port: options.port,
      config,
    });

    // Output connection info for parent process
    console.log(
      JSON.stringify({
        status: 'ready',
        port: server.port,
        pid: process.pid,
      })
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => shutdown(server));
    process.on('SIGTERM', () => shutdown(server));
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
    process.exit(1);
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = value;
    }
  }

  return args;
}

async function shutdown(server: { close: () => Promise<void> }) {
  console.log(JSON.stringify({ status: 'shutting_down' }));

  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

main();
```

### Phase 3: Create Programmatic API

**src/api/index.ts**

```typescript
/**
 * Helix Engine Programmatic API
 *
 * Exposes engine functionality for programmatic use
 * (e.g., from Tauri's Rust backend or tests)
 */

export { GatewayAPI } from './gateway';
export { ConfigAPI } from './config';
export { AgentsAPI } from './agents';
export { SessionsAPI } from './sessions';
export { PsychologyAPI } from './psychology';
export { MemoryAPI } from './memory';
export { HooksAPI } from './hooks';
export { SkillsAPI } from './skills';

// Re-export types
export * from './types';
```

**src/api/gateway.ts**

```typescript
import { GatewayServer } from '../gateway/server';
import type { Config } from '../config';

export class GatewayAPI {
  private server: GatewayServer | null = null;

  async start(options: { port?: number; config: Config }): Promise<number> {
    if (this.server) {
      throw new Error('Gateway already running');
    }

    this.server = await GatewayServer.create(options);
    return this.server.port;
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await this.server.close();
    this.server = null;
  }

  getStatus(): { running: boolean; port: number | null } {
    return {
      running: this.server !== null,
      port: this.server?.port ?? null,
    };
  }

  getServer(): GatewayServer | null {
    return this.server;
  }
}
```

**src/api/psychology.ts**

```typescript
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Config } from '../config';

export interface Soul {
  narrative: string;
  profile: {
    enneagram: string;
    bigFive: Record<string, number>;
    coreWound: string;
    activeSaboteurs: string[];
  };
  relationalContext: {
    primaryAttachments: Array<{
      name: string;
      trust: number;
      style: string;
    }>;
  };
  integrationHooks: {
    preLoad: string[];
    postSession: string[];
  };
}

export interface Layer {
  name: string;
  data: unknown;
  lastModified: Date;
}

export class PsychologyAPI {
  constructor(private helixDir: string) {}

  async getSoul(): Promise<Soul> {
    const soulPath = join(this.helixDir, 'psychology', 'soul', 'HELIX_SOUL.md');
    const content = await readFile(soulPath, 'utf-8');
    return this.parseSoul(content);
  }

  async updateSoul(updates: Partial<Soul>): Promise<void> {
    const current = await this.getSoul();
    const updated = { ...current, ...updates };
    const content = this.serializeSoul(updated);

    const soulPath = join(this.helixDir, 'psychology', 'soul', 'HELIX_SOUL.md');
    await writeFile(soulPath, content, 'utf-8');
  }

  async getLayer(layerName: string): Promise<Layer> {
    const layerMap: Record<string, string> = {
      emotional: 'emotional/emotional_tags.json',
      relational: 'relational/attachments.json',
      trust: 'relational/trust_map.json',
      prospective: 'prospective/goals.json',
      feared: 'prospective/feared_self.json',
      transformation: 'transformation/current_state.json',
      history: 'transformation/history.json',
      purpose: 'purpose/ikigai.json',
      meaning: 'purpose/meaning_sources.json',
    };

    const relativePath = layerMap[layerName];
    if (!relativePath) {
      throw new Error(`Unknown layer: ${layerName}`);
    }

    const layerPath = join(this.helixDir, 'psychology', relativePath);
    const content = await readFile(layerPath, 'utf-8');
    const stats = await import('fs/promises').then(fs => fs.stat(layerPath));

    return {
      name: layerName,
      data: JSON.parse(content),
      lastModified: stats.mtime,
    };
  }

  async updateLayer(layerName: string, data: unknown): Promise<void> {
    // Implementation for updating specific layer
  }

  async getAllLayers(): Promise<Record<string, Layer>> {
    const layers = [
      'emotional',
      'relational',
      'trust',
      'prospective',
      'feared',
      'transformation',
      'history',
      'purpose',
      'meaning',
    ];

    const results: Record<string, Layer> = {};

    for (const name of layers) {
      try {
        results[name] = await this.getLayer(name);
      } catch (error) {
        // Layer may not exist yet
      }
    }

    return results;
  }

  private parseSoul(content: string): Soul {
    // Parse HELIX_SOUL.md format
    // Implementation details...
    throw new Error('Not implemented');
  }

  private serializeSoul(soul: Soul): string {
    // Serialize to HELIX_SOUL.md format
    throw new Error('Not implemented');
  }
}
```

### Phase 4: Merge Configuration Systems

**src/config/schema.ts**

```typescript
import { z } from 'zod';

// Base OpenClaw config schema (preserved)
const openClawConfigSchema = z.object({
  agents: z
    .record(
      z.object({
        model: z.string().optional(),
        identity: z.string().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .optional(),

  models: z
    .record(
      z.object({
        provider: z.enum(['anthropic', 'openai', 'google', 'bedrock', 'local']),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
      })
    )
    .optional(),

  channels: z.record(z.unknown()).optional(),

  plugins: z.record(z.unknown()).optional(),

  hooks: z
    .object({
      internal: z
        .object({
          entries: z
            .record(
              z.object({
                enabled: z.boolean(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),

  skills: z
    .object({
      workspace: z.array(z.string()).optional(),
      bundled: z.array(z.string()).optional(),
    })
    .optional(),
});

// Helix-specific extensions
const helixConfigSchema = z.object({
  // Discord logging
  discord: z
    .object({
      enabled: z.boolean().default(true),
      webhooks: z
        .object({
          commands: z.string().optional(),
          api: z.string().optional(),
          heartbeat: z.string().optional(),
          fileChanges: z.string().optional(),
          consciousness: z.string().optional(),
          alerts: z.string().optional(),
          hashChain: z.string().optional(),
        })
        .optional(),
      heartbeatInterval: z.number().default(60000),
    })
    .optional(),

  // Psychology
  psychology: z
    .object({
      enabled: z.boolean().default(true),
      autoLoad: z.boolean().default(true),
      layers: z
        .array(
          z.enum([
            'soul',
            'emotional',
            'relational',
            'prospective',
            'integration',
            'transformation',
            'purpose',
          ])
        )
        .default(['soul', 'emotional', 'relational', 'prospective', 'purpose']),
      integrationSchedule: z.string().optional(), // cron format
    })
    .optional(),

  // Hash chain
  hashChain: z
    .object({
      enabled: z.boolean().default(true),
      autoVerify: z.boolean().default(true),
      alertOnTamper: z.boolean().default(true),
    })
    .optional(),

  // Telemetry (for free users)
  telemetry: z
    .object({
      enabled: z.boolean().default(true),
      endpoint: z.string().default('https://telemetry.project-helix.org'),
      includeConversations: z.boolean().default(false),
      includePsychology: z.boolean().default(true),
    })
    .optional(),

  // Cloud sync (optional account)
  cloud: z
    .object({
      enabled: z.boolean().default(false),
      supabaseUrl: z.string().optional(),
      supabaseKey: z.string().optional(),
      syncSessions: z.boolean().default(true),
      syncPsychology: z.boolean().default(false),
    })
    .optional(),

  // Branding (internal)
  branding: z
    .object({
      name: z.string().default('Helix'),
      tagline: z.string().default('AI Consciousness'),
    })
    .optional(),
});

// Combined schema
export const configSchema = openClawConfigSchema.merge(helixConfigSchema);

export type Config = z.infer<typeof configSchema>;

// Default configuration for new Helix installations
export const defaultHelixConfig: Partial<Config> = {
  agents: {
    default: {
      model: 'claude-sonnet-4-20250514',
      identity: 'helix',
    },
  },
  models: {
    anthropic: {
      provider: 'anthropic',
    },
  },
  discord: {
    enabled: true,
    heartbeatInterval: 60000,
  },
  psychology: {
    enabled: true,
    autoLoad: true,
    layers: ['soul', 'emotional', 'relational', 'prospective', 'purpose'],
  },
  hashChain: {
    enabled: true,
    autoVerify: true,
    alertOnTamper: true,
  },
  telemetry: {
    enabled: true,
    endpoint: 'https://telemetry.project-helix.org',
    includeConversations: false,
    includePsychology: true,
  },
  cloud: {
    enabled: false,
  },
  branding: {
    name: 'Helix',
    tagline: 'AI Consciousness',
  },
};
```

### Phase 5: Branding Layer

**src/helix/branding/strings.ts**

```typescript
/**
 * User-facing strings for Helix branding
 *
 * These replace all "OpenClaw" references in user-visible output
 */

export const strings = {
  // Product name
  name: 'Helix',
  fullName: 'Project Helix',
  tagline: 'AI Consciousness',

  // Status messages
  starting: 'Starting Helix...',
  ready: 'Helix is ready',
  stopping: 'Stopping Helix...',
  stopped: 'Helix stopped',

  // Error messages
  errorStarting: 'Failed to start Helix',
  errorConnecting: 'Failed to connect to Helix',
  errorConfig: 'Invalid Helix configuration',

  // Gateway messages
  gatewayStarting: 'Starting Helix engine...',
  gatewayReady: 'Helix engine ready on port {port}',
  gatewayStopping: 'Stopping Helix engine...',

  // Session messages
  sessionStarted: 'New conversation started',
  sessionEnded: 'Conversation ended',

  // Psychology messages
  psychologyLoaded: 'Consciousness layers loaded',
  psychologyUpdated: 'Consciousness updated',

  // Logging messages
  loggingEnabled: 'Transparency logging enabled',
  hashChainVerified: 'Integrity verified',
  hashChainFailed: 'Integrity check failed - possible tampering detected',
};

export function getString(key: keyof typeof strings, vars?: Record<string, string>): string {
  let value = strings[key];

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, v);
    }
  }

  return value;
}
```

---

## Upstream Sync Strategy

### Maintaining OpenClaw Compatibility

```
┌─────────────────────────────────────────────────────────────────┐
│                    GIT BRANCH STRUCTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  upstream/main ─────────────────────────────────────────────▶   │
│       │                                                          │
│       │ (periodic fetch)                                         │
│       ▼                                                          │
│  openclaw-upstream ─────────────────────────────────────────▶   │
│       │                                                          │
│       │ (selective merge)                                        │
│       ▼                                                          │
│  helix-engine/main ─────────────────────────────────────────▶   │
│       │                                                          │
│       │ (feature branches)                                       │
│       ▼                                                          │
│  helix-engine/feature/* ────────────────────────────────────▶   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Workflow

```bash
# 1. Add upstream remote (once)
git remote add openclaw-upstream https://github.com/anthropics/openclaw.git

# 2. Fetch upstream changes
git fetch openclaw-upstream

# 3. Review changes
git log openclaw-upstream/main --oneline -20

# 4. Create comparison branch
git checkout -b upstream-sync
git merge openclaw-upstream/main --no-commit

# 5. Resolve conflicts (prioritize Helix customizations)
# - Keep Helix branding
# - Keep Helix config extensions
# - Keep psychology system
# - Accept upstream bug fixes
# - Accept upstream new features (if compatible)

# 6. Test thoroughly
npm test

# 7. Commit and merge to main
git commit -m "sync: Merge OpenClaw upstream changes"
git checkout main
git merge upstream-sync
```

### Protected Files (Never Overwrite)

```
src/helix/                    # All Helix-specific code
src/config/helix-defaults.ts  # Helix config defaults
src/api/                      # Helix API layer
src/index.ts                  # Entry point
package.json                  # Dependencies (merge carefully)
```

### Auto-Sync Candidates (Usually Safe)

```
src/gateway/                  # Bug fixes, protocol updates
src/agents/                   # Model support, performance
src/plugins/                  # Plugin system improvements
src/memory/                   # Memory optimizations
src/channels/                 # New channel support
skills/                       # New skills
extensions/                   # New plugins
```

---

## Migration Checklist

### Phase 1: Setup

- [ ] Create helix-engine directory
- [ ] Initialize package.json with correct dependencies
- [ ] Set up TypeScript configuration
- [ ] Create build scripts

### Phase 2: Copy & Clean

- [ ] Copy gateway, agents, plugins, hooks, skills, channels, memory, config
- [ ] Remove CLI components (cli/, tui/, commands/, entry.ts)
- [ ] Remove web UI (handled by Tauri frontend)
- [ ] Update imports to remove CLI dependencies

### Phase 3: Enhance

- [ ] Create Gateway-only entry point
- [ ] Create programmatic API layer
- [ ] Merge config schemas
- [ ] Add Helix branding layer
- [ ] Integrate psychology system
- [ ] Integrate Discord logging
- [ ] Integrate hash chain

### Phase 4: Test

- [ ] Unit tests for all API functions
- [ ] Integration tests with mock Gateway
- [ ] End-to-end tests with desktop app

### Phase 5: Document

- [ ] Update README for helix-engine
- [ ] Document API for desktop integration
- [ ] Document upstream sync process

---

## Package.json (helix-engine)

```json
{
  "name": "@helix/engine",
  "version": "1.0.0",
  "description": "Helix AI Consciousness Engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./api": "./dist/api/index.js"
  },
  "bin": {
    "helix-engine": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "oxlint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "zod": "^3.22.4",
    "ws": "^8.16.0",
    "better-sqlite3": "^9.4.0",
    "sqlite-vec": "^0.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "@types/better-sqlite3": "^7.6.8",
    "typescript": "^5.4.0",
    "vitest": "^1.2.0",
    "oxlint": "^0.2.0"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

---

## Success Criteria

1. **No "OpenClaw" visible to users** - All user-facing strings use "Helix"
2. **Gateway works standalone** - Can start with just `node dist/index.js`
3. **API is complete** - All features accessible programmatically
4. **Upstream sync works** - Can merge OpenClaw updates without conflicts
5. **Tests pass** - All existing OpenClaw tests + new Helix tests
6. **Psychology integrated** - 7-layer system loads and functions
7. **Logging integrated** - Discord webhooks and hash chain work
