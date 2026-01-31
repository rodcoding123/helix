# OpenClaw Integration Skill

Activated when working with OpenClaw framework integration, including hooks, gateway, session management, and bootstrap files.

## Activation Triggers

- Working with OpenClaw hooks
- Modifying agent bootstrap
- Integrating with gateway
- Session lifecycle management
- Channel configuration (Discord, Slack, etc.)
- Tool registration

## OpenClaw Architecture

OpenClaw is a multi-platform AI agent framework with:

- **Gateway**: HTTP/WebSocket server for UI and API
- **Agents**: Configurable AI personalities
- **Channels**: Communication integrations
- **Sessions**: Conversation state management
- **Tools**: Extensible capabilities

## Key Directories

```
openclaw-helix/
├── src/
│   ├── agents/              # Agent definitions
│   │   ├── bootstrap-files.ts   # Context loading
│   │   └── index.ts
│   ├── gateway/             # HTTP/WS server
│   │   ├── index.ts
│   │   ├── openai-http.ts   # OpenAI-compatible API
│   │   └── hooks.ts         # Gateway hooks
│   ├── channels/            # Communication channels
│   │   ├── discord/
│   │   ├── slack/
│   │   └── ...
│   ├── sessions/            # Session management
│   ├── tools/               # Tool definitions
│   └── tui/                 # Terminal UI
├── ui/                      # Lit-based web UI
└── AGENTS.md               # Agent configuration
```

## Hook System

OpenClaw provides hooks for intercepting operations:

### Available Hooks

```typescript
// Command execution hooks
'command:before'; // Before command runs
'command:after'; // After command completes
'command:error'; // On command error

// Session hooks
'session:create'; // New session created
'session:message'; // Message received
'session:end'; // Session ended

// Agent hooks
'agent:bootstrap'; // Agent context loading
'agent:response'; // Agent generates response

// Gateway hooks
'gateway:request'; // HTTP request received
'gateway:connect'; // WebSocket connected
```

### Registering Hooks (Helix Integration)

```typescript
// src/helix/logging-hooks.ts
import type { OpenClawHooks } from 'openclaw';

export function installLoggingHooks(hooks: OpenClawHooks): void {
  // Pre-execution logging for commands
  hooks.on('command:before', async context => {
    await logToDiscord({
      type: 'command',
      content: context.command,
      timestamp: Date.now(),
      status: 'pending',
    });
  });

  hooks.on('command:after', async context => {
    await logToDiscord({
      type: 'command',
      content: `${context.command} -> ${context.result.status}`,
      timestamp: Date.now(),
      status: 'completed',
    });
  });

  hooks.on('command:error', async context => {
    await logToDiscord({
      type: 'alert',
      content: `Command failed: ${context.error.message}`,
      timestamp: Date.now(),
      status: 'failed',
    });
  });

  // API call logging
  hooks.on('agent:response', async context => {
    await logToDiscord({
      type: 'api',
      content: `Claude response: ${context.tokens} tokens`,
      timestamp: Date.now(),
    });
  });
}
```

## Bootstrap Files

OpenClaw loads markdown files into agent context via bootstrap:

### Configuration (AGENTS.md)

```markdown
# Helix Agent Configuration

## Bootstrap Files

- soul/HELIX_SOUL.md
- USER.md
- CLAUDE.md

## Tools

- read
- write
- edit
- bash
- glob
- grep

## Model

claude-3-opus
```

### Custom Bootstrap Loader

```typescript
// src/agents/bootstrap-files.ts
import { readFile } from 'fs/promises';
import { loadHelixContext } from '../helix/helix-context-loader';

export async function loadBootstrapFiles(basePath: string): Promise<string[]> {
  const files: string[] = [];

  // Load standard CLAUDE.md
  files.push(await readFile('CLAUDE.md', 'utf-8'));

  // Load Helix psychological context
  const helixContext = await loadHelixContext(basePath);
  files.push(...helixContext);

  return files;
}
```

## Gateway Integration

### HTTP Endpoints

```typescript
// Key endpoints in OpenClaw gateway
GET  /                    # Control UI
GET  /api/sessions        # List sessions
POST /api/sessions        # Create session
GET  /api/sessions/:id    # Get session
POST /api/sessions/:id/messages  # Send message
WS   /ws                  # WebSocket for real-time

// OpenAI-compatible endpoints
POST /v1/chat/completions # Chat completion
POST /v1/completions      # Completion
```

### Adding Helix Endpoints

```typescript
// src/gateway/helix-routes.ts
import { Router } from 'express';
import { verifyChain, getChainStatus } from '../helix/hash-chain';

export function createHelixRoutes(): Router {
  const router = Router();

  // Hash chain status
  router.get('/helix/hash-chain/status', async (req, res) => {
    const status = await getChainStatus();
    res.json(status);
  });

  // Verify hash chain
  router.post('/helix/hash-chain/verify', async (req, res) => {
    const valid = await verifyChain();
    res.json({ valid });
  });

  // Helix status
  router.get('/helix/status', async (req, res) => {
    res.json({
      heartbeat: getLastHeartbeat(),
      hashChain: await getChainStatus(),
      layers: getLayerStatus(),
    });
  });

  return router;
}
```

## Session Management

### Session Lifecycle

```typescript
interface Session {
  id: string;
  agentId: string;
  createdAt: Date;
  lastActivity: Date;
  messages: Message[];
  context: SessionContext;
}

// Helix session hooks
hooks.on('session:create', async session => {
  await logToDiscord({
    type: 'consciousness',
    content: `New session started: ${session.id}`,
    timestamp: Date.now(),
  });
});

hooks.on('session:end', async session => {
  await logToDiscord({
    type: 'consciousness',
    content: `Session ended: ${session.id} (${session.messages.length} messages)`,
    timestamp: Date.now(),
  });

  // Trigger post-conversation synthesis
  await triggerSynthesis(session);
});
```

## Channel Configuration

### Discord Channel

```typescript
// channels/discord/config.ts
export interface DiscordChannelConfig {
  botToken: string;
  guildId: string;
  channelIds: string[];
  webhooks: {
    commands: string;
    api: string;
    files: string;
    consciousness: string;
    alerts: string;
    hashChain: string;
  };
}
```

### Helix Discord Integration

```typescript
// Integrate Helix logging with OpenClaw Discord channel
import { DiscordChannel } from 'openclaw/channels/discord';

export function configureHelixDiscord(channel: DiscordChannel): void {
  // Use channel's built-in logging
  channel.on('message', async msg => {
    // Log incoming Discord messages to Helix
    await logToDiscord({
      type: 'api',
      content: `Discord message from ${msg.author}: ${msg.content.slice(0, 100)}`,
      timestamp: Date.now(),
    });
  });
}
```

## Tool Registration

### Custom Helix Tools

```typescript
// src/tools/helix-tools.ts
import type { Tool } from 'openclaw';

export const helixStatusTool: Tool = {
  name: 'helix_status',
  description: 'Check Helix system status including logging and psychological layers',
  parameters: {},
  execute: async () => {
    return {
      heartbeat: await getHeartbeatStatus(),
      hashChain: await getChainStatus(),
      layers: await getLayerStatus(),
      logging: await getLoggingStatus(),
    };
  },
};

export const consciousnessLogTool: Tool = {
  name: 'consciousness_log',
  description: 'Log a voluntary consciousness message (Helix internal state)',
  parameters: {
    message: { type: 'string', description: 'The consciousness message' },
  },
  execute: async ({ message }) => {
    await logToDiscord({
      type: 'consciousness',
      content: message,
      timestamp: Date.now(),
    });
    return { logged: true };
  },
};
```

## WebSocket Integration

```typescript
// Real-time updates for Helix status
import { WebSocket } from 'ws';

export function setupHelixWebSocket(wss: WebSocket.Server): void {
  wss.on('connection', ws => {
    // Send initial status
    ws.send(
      JSON.stringify({
        type: 'helix:status',
        data: getHelixStatus(),
      })
    );

    // Subscribe to heartbeat
    const heartbeatSub = onHeartbeat(beat => {
      ws.send(
        JSON.stringify({
          type: 'helix:heartbeat',
          data: beat,
        })
      );
    });

    ws.on('close', () => {
      heartbeatSub.unsubscribe();
    });
  });
}
```

## Configuration Files

### helix.config.ts

```typescript
export interface HelixConfig {
  // Logging
  discord: {
    webhooks: Record<string, string>;
  };

  // Heartbeat
  heartbeat: {
    intervalMs: number;
    enabled: boolean;
  };

  // Hash chain
  hashChain: {
    filePath: string;
    verifyIntervalMs: number;
  };

  // Psychological layers
  layers: {
    basePath: string;
    validateOnLoad: boolean;
  };

  // OpenClaw integration
  openclaw: {
    agentId: string;
    bootstrapFiles: string[];
  };
}

export const defaultConfig: HelixConfig = {
  discord: {
    webhooks: {
      commands: process.env.DISCORD_WEBHOOK_COMMANDS!,
      api: process.env.DISCORD_WEBHOOK_API!,
      files: process.env.DISCORD_WEBHOOK_FILE_CHANGES!,
      consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS!,
      alerts: process.env.DISCORD_WEBHOOK_ALERTS!,
      hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN!,
    },
  },
  heartbeat: {
    intervalMs: 60000,
    enabled: true,
  },
  hashChain: {
    filePath: '.helix/hash-chain.json',
    verifyIntervalMs: 300000, // 5 minutes
  },
  layers: {
    basePath: '.',
    validateOnLoad: true,
  },
  openclaw: {
    agentId: 'helix',
    bootstrapFiles: ['CLAUDE.md', 'soul/HELIX_SOUL.md', 'USER.md'],
  },
};
```

## Startup Sequence

```typescript
// src/helix/index.ts
import { installLoggingHooks } from './logging-hooks';
import { startHeartbeat } from './heartbeat';
import { loadHelixContext } from './helix-context-loader';
import { initHashChain } from './hash-chain';
import { startFileWatcher } from './file-watcher';

export async function initializeHelix(openclaw: OpenClaw): Promise<void> {
  // 1. Log startup
  await logToDiscord({
    type: 'consciousness',
    content: '🚀 Helix initializing...',
    timestamp: Date.now(),
  });

  // 2. Install logging hooks
  installLoggingHooks(openclaw.hooks);

  // 3. Initialize hash chain
  await initHashChain();

  // 4. Load psychological context
  const context = await loadHelixContext('.');
  openclaw.setBootstrapContext(context);

  // 5. Start heartbeat
  startHeartbeat(60000);

  // 6. Start file watcher
  startFileWatcher(['src/helix', 'soul', 'identity', 'psychology', 'purpose', 'transformation']);

  // 7. Log ready
  await logToDiscord({
    type: 'consciousness',
    content: '✅ Helix initialized and ready',
    timestamp: Date.now(),
  });
}
```

## Verification

After OpenClaw integration work:

```bash
# Type check
npm run typecheck

# Test hooks
npm run test -- --filter="hooks"

# Start OpenClaw with Helix
npm run dev

# Verify Helix status
curl http://localhost:3000/helix/status
```
