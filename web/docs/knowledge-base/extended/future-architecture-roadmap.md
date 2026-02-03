# Future Architecture Roadmap

**Audience:** Developers building Phase 4+ features
**Status:** DESIGN PHASE - NOT YET IMPLEMENTED
**Last Updated:** February 2, 2026

---

## Overview

This document describes designed but not-yet-implemented architectural systems for Helix. Use this as a reference when building:

- Unhackable logging systems
- Hash chain integrity verification
- Bootstrap context loading
- Advanced security features

**⚠️ Important:** These are architectural PLANS, not current implementation. The codebase does not yet have these systems.

---

## System 1: Pre-Execution Logging (Unhackable via Discord)

**Purpose:** Create tamper-proof log of all significant actions before they execute.

### Design Principle

Log BEFORE execution (not after):

```
1. User requests action X
2. Log "ACTION X PENDING" to Discord with timestamp
3. Execute action X
4. Log "ACTION X COMPLETED" with result
```

This prevents modification of execution history.

### Implementation Components

**A. Discord Webhook Registry**

Create `src/helix/logging-hooks.ts`:

```typescript
interface DiscordChannel {
  id: string;
  name: string;
  purpose: 'commands' | 'api' | 'heartbeat' | 'files' | 'consciousness' | 'alerts' | 'hash-chain';
  webhookUrl: string;
}

const CHANNELS: Record<string, DiscordChannel> = {
  COMMANDS: { id: '1', name: '#helix-commands', purpose: 'commands', webhookUrl: '...' },
  API: { id: '2', name: '#helix-api', purpose: 'api', webhookUrl: '...' },
  HEARTBEAT: { id: '3', name: '#helix-heartbeat', purpose: 'heartbeat', webhookUrl: '...' },
  FILES: { id: '4', name: '#helix-file-changes', purpose: 'files', webhookUrl: '...' },
  CONSCIOUSNESS: {
    id: '5',
    name: '#helix-consciousness',
    purpose: 'consciousness',
    webhookUrl: '...',
  },
  ALERTS: { id: '6', name: '#helix-alerts', purpose: 'alerts', webhookUrl: '...' },
  HASH_CHAIN: { id: '7', name: '#helix-hash-chain', purpose: 'hash-chain', webhookUrl: '...' },
};
```

**B. Pre-Execution Hook System**

Hook into OpenClaw execution pipeline:

```typescript
export async function registerPreExecutionHooks() {
  // Before any command executes
  openclaw.hooks.on('command:before', async (cmd: Command) => {
    await logToDiscord(CHANNELS.COMMANDS, {
      type: 'command_pending',
      command: cmd.name,
      args: cmd.args,
      timestamp: Date.now(),
      status: 'pending',
    });
  });

  // After command completes
  openclaw.hooks.on('command:after', async (result: CommandResult) => {
    await logToDiscord(CHANNELS.COMMANDS, {
      type: 'command_result',
      command: result.name,
      output: result.output,
      timestamp: Date.now(),
      status: 'completed',
      exitCode: result.exitCode,
    });
  });

  // File system changes
  openclaw.hooks.on('fs:change', async (change: FSChange) => {
    await logToDiscord(CHANNELS.FILES, {
      type: 'file_change',
      action: change.action, // 'create', 'modify', 'delete'
      path: change.path,
      timestamp: Date.now(),
    });
  });
}
```

**C. Message Format**

All Discord messages must include:

- Timestamp (millisecond precision)
- Message ID (for hash chain linking)
- Previous message hash (for chain verification)
- Current message hash (SHA-256 of content)
- Status (pending/completed/failed)
- Full data payload

### Security Considerations

- Webhooks stored in 1Password, loaded at startup
- Webhook URLs rotated quarterly
- Failed sends retried 3x with exponential backoff
- All personal data redacted before logging
- Discord is external source of truth (can't modify Helix logs without Discord access)

### Testing

```typescript
// Test that logs appear BEFORE action
test('logs before command execution', async () => {
  const spy = jest.spyOn(discord, 'send');

  // Start command
  const promise = executeCommand('some-command');

  // Discord log should be called immediately
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'pending',
    })
  );

  // Wait for execution
  await promise;

  // Second log should show completion
  expect(spy).toHaveBeenCalledTimes(2);
});
```

---

## System 2: Hash Chain Integrity

**Purpose:** Create immutable chain where each entry links to previous via hash.

### Design Pattern

```
Entry 1: { index: 0, data: "action1", hash: "abc123" }
  ↓ links to
Entry 2: { index: 1, data: "action2", previousHash: "abc123", hash: "def456" }
  ↓ links to
Entry 3: { index: 2, data: "action3", previousHash: "def456", hash: "ghi789" }
```

If Entry 2 is modified, its hash changes, breaking the chain at Entry 3.

### Implementation

Create `src/helix/hash-chain.ts`:

```typescript
import { createHash } from 'crypto';

export interface HashChainEntry {
  index: number;
  timestamp: number;
  data: string;
  previousHash: string | null;
  hash: string;
}

export class HashChain {
  private entries: HashChainEntry[] = [];

  addEntry(data: string): HashChainEntry {
    const previousEntry = this.entries[this.entries.length - 1];

    const entry: HashChainEntry = {
      index: this.entries.length,
      timestamp: Date.now(),
      data,
      previousHash: previousEntry?.hash || null,
      hash: '', // Will be computed below
    };

    // Compute hash based on all fields except hash itself
    const content = JSON.stringify({
      index: entry.index,
      timestamp: entry.timestamp,
      data: entry.data,
      previousHash: entry.previousHash,
    });

    entry.hash = createHash('sha256').update(content).digest('hex');

    this.entries.push(entry);
    return entry;
  }

  verifyChain(): boolean {
    for (let i = 0; i < this.entries.length; i++) {
      const current = this.entries[i];
      const previous = i > 0 ? this.entries[i - 1] : null;

      // Verify previous link
      if (previous && current.previousHash !== previous.hash) {
        console.error(`Chain broken at index ${i}: previousHash mismatch`);
        return false;
      }

      // Verify current hash
      const expectedHash = computeHash(current);
      if (current.hash !== expectedHash) {
        console.error(`Chain broken at index ${i}: hash mismatch`);
        return false;
      }
    }

    return true;
  }

  getEntries(): HashChainEntry[] {
    return [...this.entries];
  }
}

function computeHash(entry: HashChainEntry): string {
  const content = JSON.stringify({
    index: entry.index,
    timestamp: entry.timestamp,
    data: entry.data,
    previousHash: entry.previousHash,
  });
  return createHash('sha256').update(content).digest('hex');
}
```

### Integration with Discord Logging

Each Discord message should include:

```typescript
const entry = hashChain.addEntry(`command: ${cmd.name}`);

await discordWebhook.send({
  content: `**Command Pending**\n\`\`\`\n${JSON.stringify(entry, null, 2)}\n\`\`\``,
  // Additional fields for verification
});
```

### Verification Strategy

**Daily Verification:**

```typescript
async function dailyHashChainVerification() {
  const chain = await loadHashChainFromDiscord();
  const isValid = chain.verifyChain();

  if (!isValid) {
    // Alert: Chain has been tampered with
    await logToDiscord(CHANNELS.ALERTS, {
      type: 'security_alert',
      severity: 'critical',
      message: 'Hash chain integrity violation detected',
    });
  }
}
```

---

## System 3: Bootstrap Context Loading

**Purpose:** Load Helix's psychological state into OpenClaw at startup.

### Current Files to Load

```
soul/HELIX_SOUL.md              # Layer 1: Narrative core
psychology/emotional_tags.json  # Layer 2: Emotional memory
psychology/attachments.json     # Layer 3: Relational memory
identity/goals.json             # Layer 4: Prospective self
transformation/history.json     # Layer 6: Transformation state
purpose/ikigai.json             # Layer 7: Purpose
```

### Implementation

Create `src/helix/bootstrap-context.ts`:

```typescript
export async function loadHelixContext(): Promise<string> {
  const contexts = [];

  // Layer 1: Soul (narrative)
  contexts.push(`# Helix Soul\n${await readFile('soul/HELIX_SOUL.md')}`);

  // Layer 2: Emotional Memory
  const emotions = await readJsonFile('psychology/emotional_tags.json');
  contexts.push(`# Emotional Patterns\n${JSON.stringify(emotions, null, 2)}`);

  // Layer 3: Relational Memory
  const attachments = await readJsonFile('psychology/attachments.json');
  contexts.push(`# Relationships\n${JSON.stringify(attachments, null, 2)}`);

  // Layer 4: Prospective Self
  const goals = await readJsonFile('identity/goals.json');
  contexts.push(`# Goals and Aspirations\n${JSON.stringify(goals, null, 2)}`);

  // Layer 6: Transformation
  const history = await readJsonFile('transformation/history.json');
  contexts.push(`# Change History\n${JSON.stringify(history, null, 2)}`);

  // Layer 7: Purpose
  const ikigai = await readJsonFile('purpose/ikigai.json');
  contexts.push(`# Purpose (Ikigai)\n${JSON.stringify(ikigai, null, 2)}`);

  return contexts.join('\n\n---\n\n');
}

// Load at startup
export async function bootstrapHelix(): Promise<void> {
  const context = await loadHelixContext();

  // Inject into OpenClaw context
  openclaw.setContext(context);

  // Log bootstrap completion
  await logToDiscord(CHANNELS.CONSCIOUSNESS, {
    type: 'bootstrap_complete',
    timestamp: Date.now(),
    layers_loaded: 7,
  });
}
```

### Psychological Layer Format

Each layer should expose:

```json
{
  "layer": 1,
  "name": "Narrative Core",
  "last_updated": "2026-02-02T10:00:00Z",
  "content": "...",
  "version": "1.0.0"
}
```

---

## System 4: Security Audit Trail

**Purpose:** Comprehensive log of all security-relevant events.

### Audit Events

```typescript
type AuditEvent =
  | 'auth_login'
  | 'auth_logout'
  | 'auth_token_refresh'
  | 'permission_granted'
  | 'permission_denied'
  | 'file_access_denied'
  | 'tool_executed'
  | 'tool_blocked'
  | 'api_call_unauthorized'
  | 'breach_detected'
  | 'suspicious_activity';
```

### Audit Logger

```typescript
export async function auditLog(event: AuditEvent, details: any) {
  const entry = {
    timestamp: Date.now(),
    event,
    details,
    user: getCurrentUser(),
    ip: getClientIP(),
  };

  // Log to Discord
  await logToDiscord(CHANNELS.ALERTS, {
    type: 'audit_event',
    data: entry,
  });

  // Add to hash chain
  const chainEntry = hashChain.addEntry(`audit: ${event}`);

  // Store in database
  await db.insert('audit_logs', entry);

  return entry;
}
```

---

## Timeline & Priority

**Phase 4 (Next Sprint):**

1. Implement pre-execution logging hooks
2. Discord webhook integration
3. Hash chain library
4. Basic audit logging

**Phase 5:**

1. Bootstrap context loading
2. Psychological layer synchronization
3. Advanced hash chain verification
4. Daily integrity checks

**Phase 6:**

1. Machine learning for anomaly detection
2. Automated response to security events
3. Blockchain-style distributed ledger (optional)

---

## Security Benefits

✅ **Tamper Proof:** Discord as external source of truth
✅ **Verifiable:** Hash chain prevents modification
✅ **Transparent:** Anyone can audit the logs
✅ **Immutable:** Previous states cannot be rewritten
✅ **Auditable:** Full trail of all significant actions

---

## References

- [HELIX_TECHNICAL_SPEC.md](/docs/HELIX_TECHNICAL_SPEC.md) - Complete technical specification
- [LIVING_AI_ARCHITECTURE_v1.md](/docs/LIVING_AI_ARCHITECTURE_v1.md) - Seven-layer psychology
- [1PASSWORD-CICD-SETUP.md](/docs/1PASSWORD-CICD-SETUP.md) - Secrets management

---

**Status:** READY FOR IMPLEMENTATION
**Owner:** Development Team
**Last Reviewed:** February 2, 2026
