# Phase 1: OAuth Local Authority Foundation

**Status**: Ready for Implementation
**Created**: 2025-02-05
**Updated**: 2025-02-05
**Session Tracking**: Multi-session implementation plan

---

## Executive Summary

Build the foundation for multi-device Helix execution where:

- **Local device (desktop)** performs OAuth for Claude and OpenAI Codex
- **Remote devices (mobile/web)** send commands to local device for execution
- **Results sync back** via Supabase real-time to all connected devices

**User Experience Goal**: Type command on phone → Local device executes with its OAuth credential → Result appears instantly on phone

**Architecture Pattern**: Local Authority + Remote Execution

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Integration with Existing Systems](#integration-with-existing-systems)
3. [Task Breakdown](#task-breakdown)
4. [Code Examples](#code-examples)
5. [Verification Steps](#verification-steps)
6. [Session Progress Tracking](#session-progress-tracking)

---

## Architecture Overview

### Current State (Before Phase 1)

```
Desktop App                    Web App                     Mobile App
     │                             │                           │
     ├─ API Key Entry              ├─ Supabase Auth            ├─ Not Implemented
     ├─ Manual Copy/Paste          ├─ Local Execution Only     │
     └─ Insecure Storage           └─ No Multi-Device Support  └─
```

**Problems**:

- Desktop uses API key redirect (not OAuth)
- Each device needs separate credentials
- No seamless multi-device experience

### Target State (After Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Local Authority                           │
│  Desktop (Always-On) - Owns OAuth Credentials                   │
│  ~/.openclaw/agents/main/agent/auth-profiles.json               │
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │   Claude     │         │ OpenAI Codex │                     │
│  │   OAuth      │         │   OAuth      │                     │
│  │  (PKCE/Setup)│         │   (PKCE)     │                     │
│  └──────────────┘         └──────────────┘                     │
│         │                         │                             │
│         └─────────────────────────┘                             │
│                   │                                              │
│          Remote Command Executor                                │
│          (Uses local credentials)                               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Supabase Sync Relay
                  │ (remote_commands table)
                  │
      ┌───────────┼───────────────────────────┐
      ▼           ▼                           ▼
┌──────────┐ ┌──────────┐              ┌──────────┐
│   Web    │ │  Mobile  │              │  Tablet  │
│ (Remote) │ │ (Remote) │              │ (Remote) │
│          │ │          │              │          │
│ • Sends  │ │ • Sends  │              │ • Sends  │
│   Cmds   │ │   Cmds   │              │   Cmds   │
│ • Gets   │ │ • Gets   │              │ • Gets   │
│   Results│ │   Results│              │   Results│
└──────────┘ └──────────┘              └──────────┘
```

### Key Components

**1. Desktop OAuth Integration**

- File: `helix-desktop/src/services/openclaw-oauth.ts`
- Purpose: Wrap OpenClaw CLI OAuth commands for Tauri
- Providers: Claude (Anthropic), OpenAI Codex
- Storage: `~/.openclaw/agents/main/agent/auth-profiles.json`

**2. Remote Command Protocol**

- File: `helix-runtime/src/gateway/protocol/schema/remote-command.ts`
- Purpose: Define command structure for remote execution
- Schema: TypeBox validation with TypeScript types

**3. Command Executor**

- File: `helix-runtime/src/gateway/remote-command-executor.ts`
- Purpose: Execute remote commands using local credentials
- Features: Queue management, concurrency limits, pre-execution logging

**4. Sync Relay Integration**

- File: `helix-runtime/src/gateway/sync-relay.ts` (extend existing)
- Purpose: Broadcast command results to all devices
- Protocol: Supabase real-time WebSocket

**5. Database Schema**

- File: `web/supabase/migrations/020_remote_commands.sql`
- Tables: `remote_commands`, orchestrator foundation tables
- Features: RLS policies, real-time publication, auto-cleanup

**6. Web Execution Hook**

- File: `web/src/hooks/useRemoteExecution.ts`
- Purpose: React hook for remote command submission
- Features: Real-time result subscription, error handling

**7. Admin Dashboard**

- File: `web/src/admin/RemoteExecutionDashboard.tsx`
- Purpose: Monitor remote executions
- Features: Real-time stats, queue visibility

**8. Hash Chain Integration**

- File: `src/helix/hash-chain.ts` (extend existing)
- Purpose: Audit trail for all remote commands
- Pattern: Pre-execution logging to Discord

---

## Clarification: Lingxi vs TRAE (Phase 1 Foundation)

**User Question**: "Where does Lingxi fit in this new plan?"

**Answer**: Lingxi IS the TRAE-style orchestrator - Phase 1 builds the **foundational OAuth + multi-device execution layer** that Phase 2 (Lingxi orchestrator) depends on.

| Aspect | Original Lingxi Plan | Current TRAE-Style Plan |
|--------|---------------------|------------------------|
| **Name** | "Lingxi-Style Orchestrator" | "TRAE-Style Orchestrator" (Phase 2) |
| **Phase 1 Role** | Not separated | **Phase 1 OAuth + Remote Execution** (this plan) |
| **Pattern** | LangGraph supervisor | TRAE hierarchical state tracking + LangGraph routing |
| **Checkpointing** | Basic Supabase storage | TRAE continuous checkpointing + hash chain |
| **Tools** | Generic tools | Mini-SWE bash-only simplicity + SWE-agent ACI |
| **Context** | No compression | SWE-agent 42% trajectory compression |
| **BYOK** | Not emphasized | **PRIMARY PRINCIPLE** - heterogeneous deployment |
| **Multi-Device** | Not designed in | **Phase 1 Foundation** - OAuth local authority + remote execution |
| **Approval** | Basic | **4 configurable modes** - budget/type/cost/manual |

### Why Two Phases?

**Phase 1 (This Plan)** establishes the **local authority + remote execution foundation**:
- Desktop device performs OAuth (never leaves desktop)
- Stores credentials in OpenClaw's auth-profiles.json
- Remote devices send command payloads via Supabase
- Local device executes with its OAuth credentials
- Results broadcast back to all devices in real-time
- Result: Seamless multi-device experience with zero credential sharing

**Phase 2 (Future)** builds the **TRAE-style orchestrator** on top:
- Supervisor agent routes between specialized agents
- Continuous checkpointing with Supabase + hash chain
- Centralized AI controller with configurable approval modes
- Per-agent/skill/tool model assignment (BYOK)
- Advanced dashboard with job queue visualization

**Key Design Principle**: Phase 2's remote execution happens via Phase 1's RemoteCommandExecutor - both phases share the same OAuth foundation and pre-execution logging pattern.

---

## Integration with Existing Systems

### 1. OpenClaw Runtime Integration

**Existing File**: `helix-runtime/src/agents/auth-profiles/oauth.ts`

**How We Use It**:

```typescript
// In remote-command-executor.ts
import { resolveApiKeyForProfile } from '../agents/auth-profiles/oauth.js';
import { getAuthProfileStore } from '../agents/auth-profiles/store.js';

async function executeWithLocalCredentials(provider: string) {
  const store = getAuthProfileStore();
  const credentials = await resolveApiKeyForProfile({
    store,
    profileId: provider, // "anthropic" or "openai-codex"
  });

  if (!credentials) {
    throw new Error(`No credentials for ${provider}. Local device must authenticate first.`);
  }

  return credentials.apiKey; // Use for execution
}
```

**Integration Points**:

- ✅ Token refresh: Automatic via `resolveApiKeyForProfile()`
- ✅ Token expiry: Checked before execution
- ✅ File locking: Prevents race conditions during refresh
- ✅ Profile storage: `~/.openclaw/agents/main/agent/auth-profiles.json`

### 2. Gateway Sync Relay Integration

**Existing File**: `helix-runtime/src/gateway/sync-relay.ts`

**Current Capabilities**:

- Device registration and tracking
- Delta change broadcasting
- Conflict detection and resolution
- Vector clock synchronization

**Our Extension**:

```typescript
// Add to SyncRelay class
private commandExecutor: RemoteCommandExecutor;

constructor(supabaseClient: SupabaseClient, logger: any) {
  this.commandExecutor = new RemoteCommandExecutor(logger);
  this.setupRealtimeListeners();
  this.setupCommandExecutorListeners(); // NEW
}

private setupCommandExecutorListeners() {
  this.commandExecutor.on("command-completed", async (event) => {
    // Update database status
    await this.updateRemoteCommand(event.commandId, "completed", event.result);

    // Broadcast to all devices
    await this.broadcastToUser(event.userId, {
      type: "command.result",
      commandId: event.commandId,
      result: event.result,
    });
  });
}
```

**Integration Points**:

- ✅ Device registry: Reuse existing `connectedDevices` map
- ✅ Broadcasting: Reuse existing `sendMessage()` method
- ✅ Supabase client: Shared instance
- ✅ Logger: Shared instance

### 3. Discord Logging Integration

**Existing File**: `src/helix/hash-chain.ts`

**Current Logging Pattern**:

```typescript
// Pre-execution logging (existing pattern)
await logToDiscord({
  channel: 'helix-commands',
  type: 'command',
  content: cmd,
  timestamp: Date.now(),
  status: 'pending',
});

// Execute command

// Post-execution logging
await logToDiscord({
  channel: 'helix-commands',
  type: 'command_result',
  exitCode: result.code,
  timestamp: Date.now(),
  status: 'completed',
});
```

**Our Extension**:

```typescript
// Add new entry type
interface RemoteCommandEntry {
  type: 'remote_command';
  commandId: string;
  sourceDevice: string;
  provider: string;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  executedAt?: number;
  error?: string;
}

// Add logging function
export async function logRemoteCommand(entry: Omit<RemoteCommandEntry, 'type'>) {
  await createHashChainEntry({
    type: 'remote_command',
    ...entry,
  });
}
```

**Integration Points**:

- ✅ Discord channels: Use existing `#helix-commands`
- ✅ Hash chain: Reuse existing `createHashChainEntry()`
- ✅ Fail-closed: Operations block if logging fails
- ✅ Pre-execution: Log before executing remote command

### 4. Supabase Real-time Integration

**Existing Infrastructure**:

- File: `helix-runtime/src/helix/session/supabase-sync.ts`
- Features: Session sync, conflict detection, offline queue

**Our Extension**:

```typescript
// Subscribe to remote_commands table changes
const subscription = supabase
  .channel('remote_commands_all')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'remote_commands',
      filter: `source_user_id=eq.${userId}`,
    },
    payload => {
      // Handle status updates
      if (payload.new.status === 'completed') {
        // Notify UI of result
      }
    }
  )
  .subscribe();
```

**Integration Points**:

- ✅ Supabase client: Reuse from `helix-runtime/src/helix/session/supabase-client.js`
- ✅ Real-time channels: Use existing subscription pattern
- ✅ Row Level Security: Use existing user authentication
- ✅ Conflict resolution: Reuse existing vector clock logic

### 5. Smart Model Routing Integration

**Existing File**: `src/helix/ai-operations/router.ts`

**Current Capabilities**:

- Provider selection based on operation type
- Budget enforcement
- Approval workflow integration

**Future Extension** (Phase 2):

```typescript
// Will extend for orchestrator
class OperationRouter {
  async selectProvider(operation: string, queueDepth: number) {
    if (queueDepth > 20) {
      // Prefer cheaper models when queue is long
      return 'haiku';
    }
    // Existing logic
  }
}
```

**Integration Points**:

- ✅ Cost tracking: Extend existing `cost_usd` field
- ✅ Provider selection: Use existing `model-fallback.ts`
- ✅ Auth profiles: Reuse from OpenClaw integration
- ⏳ Queue awareness: Future enhancement (Phase 2)

---

## TRAE UI Inspiration (Phase 2 Dashboard Foundation)

Phase 1 builds the foundation; Phase 2 will add advanced dashboard features inspired by TRAE-agent's proven UI patterns:

### Dashboard Components (Phase 2)

**1. Real-Time Trajectory Visualization**:
```typescript
// Show orchestrator execution progress in real-time
interface TrajectoryVisualization {
  currentNode: string;                    // Which agent is active
  lifecycle: 'planning' | 'executing' | 'reflecting';
  stepProgress: {
    current: number;
    total: number;
    action: string;
  };
  historicalPath: string[];              // Nodes visited
}
```
- Visual state graph showing supervisor routing decisions
- Live progress indicator showing task completion %
- Historical path showing all agents involved

**2. Checkpoint Timeline View**:
- Visual timeline of all execution checkpoints
- Click any checkpoint to see state snapshot
- Diff view between checkpoints
- Resume from any point (time-travel debugging)

**3. Cost Breakdown Visualization**:
- Real-time cost meter per operation
- Per-agent cost attribution
- Daily/weekly/monthly cost trends
- Budget warnings with visual alerts

**4. Agent Utilization Heatmap**:
- Grid showing which agents are busy/idle
- Color coding: green (idle) → yellow (moderate) → red (saturated)
- Click agent to see current task and execution history

**5. Approval Queue Interface**:
- Card-based UI for pending approvals (Phase 2 feature)
- Show: operation type, estimated cost, reasoning
- Quick approve/reject buttons
- Batch approval for similar operations

**Phase 1 Note**: Phase 1 includes basic `RemoteExecutionDashboard.tsx` (command stats). Phase 2 will extend this with orchestrator visualizations above.

---

## Task Breakdown

### Module 1: Desktop OAuth Service Wrapper

**Goal**: Create TypeScript wrapper for OpenClaw OAuth CLI commands

**🏗️ Helix Integration**:
- **Wraps**: OpenClaw's existing `openclaw models auth` CLI commands (no changes to OpenClaw)
- **Uses**: Tauri IPC invoke system (existing desktop app infrastructure)
- **Integrates with**: Phase 1 Module 2 (Tauri Rust commands), Phase 2 ActionAgent (remote execution)
- **Dependencies**: OpenClaw CLI must be installed (already part of helix-runtime)
- **Fail-Closed Pattern**: All errors caught and returned as structured results (no uncaught exceptions)

**Files**:

- `helix-desktop/src/services/openclaw-oauth.ts` (NEW)

**Task List**:

- [ ] **1.1.1** Create file structure
  - [ ] Create directory: `helix-desktop/src/services/`
  - [ ] Create file: `openclaw-oauth.ts`
  - [ ] Add copyright header and file description

- [ ] **1.1.2** Define TypeScript types

  ```typescript
  export type OAuthProvider = 'anthropic' | 'openai-codex';

  export interface OAuthFlowResult {
    success: boolean;
    provider: OAuthProvider;
    tokenType: 'oauth' | 'setup-token';
    storedInPath: string;
    error?: string;
  }
  ```

- [ ] **1.1.3** Implement Anthropic setup-token flow

  ```typescript
  export async function initiateAnthropicSetupToken(): Promise<OAuthFlowResult> {
    try {
      const result = await invoke<OAuthFlowResult>('run_openclaw_oauth', {
        provider: 'anthropic',
        flow: 'setup-token',
      });
      return result;
    } catch (error) {
      return {
        success: false,
        provider: 'anthropic',
        tokenType: 'setup-token',
        storedInPath: '',
        error: String(error),
      };
    }
  }
  ```

- [ ] **1.1.4** Implement OpenAI Codex PKCE flow

  ```typescript
  export async function initiateOpenAIPkceOAuth(): Promise<OAuthFlowResult> {
    try {
      const result = await invoke<OAuthFlowResult>('run_openclaw_oauth', {
        provider: 'openai-codex',
        flow: 'pkce',
      });
      return result;
    } catch (error) {
      return {
        success: false,
        provider: 'openai-codex',
        tokenType: 'oauth',
        storedInPath: '',
        error: String(error),
      };
    }
  }
  ```

- [ ] **1.1.5** Implement credential check function

  ```typescript
  export async function checkStoredCredentials(provider: OAuthProvider): Promise<boolean> {
    try {
      const result = await invoke<{ stored: boolean }>('check_oauth_credentials', {
        provider,
      });
      return result.stored;
    } catch {
      return false;
    }
  }
  ```

- [ ] **1.1.6** Add error handling and logging
  - [ ] Wrap all invoke() calls in try-catch
  - [ ] Log errors to console for debugging
  - [ ] Return structured error objects

- [ ] **1.1.7** Export all public functions
  - [ ] Export types
  - [ ] Export functions
  - [ ] Add JSDoc comments

**Verification**:

- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] File exports are accessible from other modules
- [ ] Types are correct (no `any` types)

**Update Order**:

1. Create file with types
2. Implement each function sequentially
3. Test compilation
4. Move to next module

---

### Module 2: Tauri OAuth Commands (Rust)

**Goal**: Implement Rust backend commands to execute OpenClaw CLI

**🏗️ Helix Integration**:
- **Backend for**: Module 1 TypeScript service wrapper
- **Pattern**: Tauri invoke system (same pattern as existing desktop commands)
- **Subprocess Execution**: Security isolation - OpenClaw runs in separate process
- **Error Handling**: Returns structured Result types (Rust error handling best practices)
- **File Access**: Reads `~/.openclaw/agents/main/agent/auth-profiles.json` directly (replaces redirect flow)
- **Registers with**: Tauri command handler (existing builder pattern)

**Files**:

- `helix-desktop/src-tauri/src/commands/auth.rs` (MODIFY)
- `helix-desktop/src-tauri/src/lib.rs` or `main.rs` (MODIFY - register commands)

**Task List**:

- [ ] **1.2.1** Open auth.rs and add imports

  ```rust
  use std::process::Command;
  use serde::{Deserialize, Serialize};
  ```

- [ ] **1.2.2** Define OAuthFlowResult struct

  ```rust
  #[derive(Serialize, Deserialize)]
  pub struct OAuthFlowResult {
      success: bool,
      provider: String,
      token_type: String,
      stored_in_path: String,
      error: Option<String>,
  }
  ```

- [ ] **1.2.3** Define CheckCredentialsResult struct

  ```rust
  #[derive(Serialize, Deserialize)]
  pub struct CheckCredentialsResult {
      stored: bool,
  }
  ```

- [ ] **1.2.4** Implement run_openclaw_oauth command

  ```rust
  #[tauri::command]
  pub async fn run_openclaw_oauth(
      provider: String,
      flow: String,
  ) -> Result<OAuthFlowResult, String> {
      // Build command args based on provider and flow
      let cmd_args = match (provider.as_str(), flow.as_str()) {
          ("anthropic", "setup-token") => {
              vec!["openclaw", "models", "auth", "setup-token", "--provider", "anthropic"]
          }
          ("openai-codex", "pkce") => {
              vec!["openclaw", "models", "auth", "login", "--provider", "openai-codex"]
          }
          _ => return Err(format!("Unsupported provider/flow: {}/{}", provider, flow)),
      };

      // Execute subprocess
      let output = Command::new(cmd_args[0])
          .args(&cmd_args[1..])
          .output()
          .map_err(|e| format!("Failed to execute OpenClaw: {}", e))?;

      // Check success
      if output.status.success() {
          Ok(OAuthFlowResult {
              success: true,
              provider: provider.clone(),
              token_type: flow.clone(),
              stored_in_path: get_auth_profiles_path()?,
              error: None,
          })
      } else {
          let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
          Err(error_msg)
      }
  }
  ```

- [ ] **1.2.5** Implement check_oauth_credentials command

  ```rust
  #[tauri::command]
  pub async fn check_oauth_credentials(provider: String) -> Result<CheckCredentialsResult, String> {
      let auth_profiles_path = get_auth_profiles_path()?;

      let content = std::fs::read_to_string(&auth_profiles_path)
          .map_err(|e| format!("Failed to read auth profiles: {}", e))?;

      let json: serde_json::Value = serde_json::from_str(&content)
          .map_err(|e| format!("Invalid auth profiles JSON: {}", e))?;

      let stored = json
          .get("profiles")
          .and_then(|p| p.get(&provider))
          .is_some();

      Ok(CheckCredentialsResult { stored })
  }
  ```

- [ ] **1.2.6** Implement get_auth_profiles_path helper

  ```rust
  fn get_auth_profiles_path() -> Result<String, String> {
      let home = std::env::var("HOME")
          .or_else(|_| std::env::var("USERPROFILE"))
          .map_err(|_| "Cannot determine home directory".to_string())?;

      Ok(format!(
          "{}/.openclaw/agents/main/agent/auth-profiles.json",
          home
      ))
  }
  ```

- [ ] **1.2.7** Register commands in Tauri builder
  - [ ] Open `src-tauri/src/lib.rs` or `main.rs`
  - [ ] Find `.invoke_handler()` section
  - [ ] Add commands:
    ```rust
    .invoke_handler(tauri::generate_handler![
        // ... existing commands ...
        run_openclaw_oauth,
        check_oauth_credentials,
    ])
    ```

- [ ] **1.2.8** Test Rust compilation
  - [ ] Run: `cd helix-desktop && npm run tauri build --debug`
  - [ ] Fix any compilation errors
  - [ ] Verify no warnings

**Verification**:

- [ ] Rust code compiles: `cargo check` in src-tauri/
- [ ] Commands registered correctly
- [ ] Can invoke from TypeScript (test in dev mode)

**Update Order**:

1. Add structs
2. Implement helper function
3. Implement commands
4. Register in builder
5. Test compilation
6. Move to next module

---

### Module 3: AuthConfigStep UI Integration

**Goal**: Replace API key redirect with OAuth buttons for Claude and Codex

**🏗️ Helix Integration**:
- **Frontend for**: Module 1 OAuth service + Module 2 Tauri commands
- **Pattern**: React component with async state management (existing onboarding pattern)
- **User Experience**: Replaces "Get API Key" redirect with native OAuth button
- **Error Handling**: Shows user-friendly error messages, logs to console for debugging
- **State Management**: Tracks authentication in-flight state (loading/success/error)

**Files**:

- `helix-desktop/src/components/onboarding/steps/AuthConfigStep.tsx` (MODIFY)

**Current Code Structure** (lines 125-129):

```typescript
// Only GitHub Copilot has real OAuth - others use API keys
const REAL_OAUTH_PROVIDERS = ['github-copilot'];
const API_KEY_REDIRECT_PROVIDERS = ['token', 'openai-codex', ...];
```

**Target Code Structure**:

```typescript
// OAuth supported for Claude, Codex, and GitHub
const REAL_OAUTH_PROVIDERS = ['github-copilot', 'token', 'openai-codex'];
const API_KEY_REDIRECT_PROVIDERS = ['google-gemini-cli', 'google-antigravity', ...];
```

**Task List**:

- [ ] **1.3.1** Import OAuth service at top of file

  ```typescript
  import * as openclawOAuth from '../../../services/openclaw-oauth';
  ```

- [ ] **1.3.2** Update REAL_OAUTH_PROVIDERS constant (line ~125)
  - [ ] Add 'token' (Claude)
  - [ ] Add 'openai-codex'
  - [ ] Keep 'github-copilot'

- [ ] **1.3.3** Update API_KEY_REDIRECT_PROVIDERS constant (line ~129)
  - [ ] Remove 'token'
  - [ ] Remove 'openai-codex'
  - [ ] Keep others: google-gemini-cli, google-antigravity, minimax-portal, qwen-portal

- [ ] **1.3.4** Add OAuth handler function (after line ~137)

  ```typescript
  const handleOpenClawOAuth = async (provider: 'anthropic' | 'openai-codex') => {
    setError(null);
    try {
      const result =
        provider === 'anthropic'
          ? await openclawOAuth.initiateAnthropicSetupToken()
          : await openclawOAuth.initiateOpenAIPkceOAuth();

      if (result.success) {
        onComplete({
          authChoice: provider === 'anthropic' ? 'token' : 'openai-codex',
          provider,
          token: 'oauth-credential', // Managed by OpenClaw
        });
      } else {
        setError(result.error || 'OAuth flow failed');
      }
    } catch (err) {
      setError(String(err));
    }
  };
  ```

- [ ] **1.3.5** Update render logic for 'token' provider (around line 243)
  - [ ] Find existing render block for token provider
  - [ ] Replace API key redirect with OAuth button
  - [ ] Add onClick handler: `() => handleOpenClawOAuth('anthropic')`
  - [ ] Keep loading/success/error states

- [ ] **1.3.6** Update render logic for 'openai-codex' provider
  - [ ] Find existing render block for openai-codex
  - [ ] Replace API key redirect with OAuth button
  - [ ] Add onClick handler: `() => handleOpenClawOAuth('openai-codex')`
  - [ ] Keep loading/success/error states

- [ ] **1.3.7** Add loading state for OAuth flows

  ```typescript
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // In handleOpenClawOAuth:
  setIsAuthenticating(true);
  try {
    // ... oauth logic ...
  } finally {
    setIsAuthenticating(false);
  }
  ```

- [ ] **1.3.8** Update button UI
  - [ ] Show spinner when `isAuthenticating`
  - [ ] Disable button when authenticating
  - [ ] Update button text: "Authenticating..." vs "Continue with OAuth"

**Verification**:

- [ ] TypeScript compiles without errors
- [ ] UI renders OAuth button for Claude
- [ ] UI renders OAuth button for OpenAI Codex
- [ ] API key redirect removed for those providers
- [ ] Loading states work correctly

**Update Order**:

1. Import service
2. Update constants
3. Add handler function
4. Update Claude render logic
5. Update Codex render logic
6. Add loading states
7. Test UI in dev mode
8. Move to next module

---

### Module 4: Remote Command Protocol Schema

**Goal**: Define TypeBox schema and TypeScript types for remote command execution

**🏗️ Helix Integration**:
- **Schema Pattern**: TypeBox (same as existing gateway protocols)
- **Runtime Validation**: Validates remote command payloads before queuing
- **Type Safety**: Generates TypeScript types from schema (no manual type duplication)
- **Gateway Integration**: Used by sync-relay to validate incoming commands from web/mobile
- **Phase 2 Usage**: Action Agent creates RemoteCommand payloads using this schema

**Files**:

- `helix-runtime/src/gateway/protocol/schema/remote-command.ts` (NEW)
- `helix-runtime/src/gateway/protocol/schema/index.ts` (MODIFY - add export)

**Task List**:

- [ ] **1.4.1** Create file with imports

  ```typescript
  import { Type } from '@sinclair/typebox';
  ```

- [ ] **1.4.2** Define RemoteCommandSchema

  ```typescript
  export const RemoteCommandSchema = Type.Object({
    // Unique ID for this command execution
    commandId: Type.String({ format: 'uuid' }),

    // Source device info
    sourceDeviceId: Type.String(),
    sourceUserId: Type.String(),

    // Command details
    agentId: Type.String(),
    provider: Type.Union([
      Type.Literal('anthropic'),
      Type.Literal('openai-codex'),
      Type.Literal('google-gemini'),
    ]),

    // The actual command/message to execute
    content: Type.String(),

    // Execution context
    sessionId: Type.String(),
    channelId: Type.Optional(Type.String()),

    // Timestamps
    createdAt: Type.Number(), // Unix timestamp
    expiresAt: Type.Number(), // Timeout in ms

    // Status tracking
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('executing'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),

    // Result (populated after execution)
    result: Type.Optional(
      Type.Object({
        status: Type.Union([Type.Literal('success'), Type.Literal('error')]),
        output: Type.String(),
        executedAt: Type.Number(),
        error: Type.Optional(Type.String()),
      })
    ),
  });
  ```

- [ ] **1.4.3** Export TypeScript type

  ```typescript
  export type RemoteCommand = typeof RemoteCommandSchema._type;
  ```

- [ ] **1.4.4** Add to protocol schema index
  - [ ] Open `helix-runtime/src/gateway/protocol/schema/index.ts`
  - [ ] Add export: `export * from "./remote-command.js";`

**Verification**:

- [ ] TypeScript compiles
- [ ] Schema is valid TypeBox
- [ ] Type exports correctly
- [ ] Can import from other modules

**Update Order**:

1. Create file with schema
2. Export type
3. Add to index
4. Test compilation
5. Move to next module

---

### Module 5: Web Execution Types

**Goal**: Define TypeScript interfaces for web remote execution

**🏗️ Helix Integration**:
- **Web Client Types**: Used by CodeInterface and other web components
- **Type Safety**: Ensures web client and local executor speak same language
- **Real-time Types**: Matches database schema for Supabase sync
- **No Runtime Validation**: Web types are for development; TypeBox schema (Module 4) validates at runtime

**Files**:

- `web/src/types/remote-execution.ts` (NEW)

**Task List**:

- [ ] **1.5.1** Create file and define RemoteCommandRequest

  ```typescript
  export interface RemoteCommandRequest {
    commandId: string;
    agentId: string;
    provider: 'anthropic' | 'openai-codex' | 'google-gemini';
    content: string;
    sessionId: string;
    channelId?: string;
  }
  ```

- [ ] **1.5.2** Define RemoteCommandResult

  ```typescript
  export interface RemoteCommandResult {
    commandId: string;
    status: 'success' | 'error';
    output: string;
    executedAt: number;
    error?: string;
  }
  ```

- [ ] **1.5.3** Define CommandExecutionState
  ```typescript
  export interface CommandExecutionState {
    pending: RemoteCommandRequest[];
    executing: Map<string, RemoteCommandRequest>;
    completed: Map<string, RemoteCommandResult>;
  }
  ```

**Verification**:

- [ ] TypeScript compiles
- [ ] Types export correctly
- [ ] Can import in web components

**Update Order**:

1. Create all interfaces
2. Test compilation
3. Move to next module

---

### Module 6: Remote Command Executor (Part 1/4: Core Structure)

**Goal**: Set up class structure and dependencies

**🏗️ Helix Integration** (4-part module):
- **Helix Pattern**: EventEmitter for async result broadcasting to sync relay
- **Pre-Execution Logging**: Logs to Discord BEFORE queueing (Helix security principle)
- **Hash Chain**: All commands added to hash chain for audit trail
- **Queue Management**: Respects maxConcurrent limit (5 by default) to prevent resource exhaustion
- **Sync Relay Bridge**: Emits events that sync relay listens to for broadcasting results
- **Phase 2 Integration**: Action Agent uses this executor to run all operations

**Files**:

- `helix-runtime/src/gateway/remote-command-executor.ts` (NEW)

**Task List**:

- [ ] **1.6.1** Create file with imports

  ```typescript
  import { EventEmitter } from 'events';
  import type { RemoteCommand } from './protocol/schema/remote-command.js';
  import { logToDiscord } from '../helix/discord-logging.js';
  import { createHashChainEntry } from '../helix/hash-chain.js';
  ```

- [ ] **1.6.2** Define class extending EventEmitter

  ```typescript
  export class RemoteCommandExecutor extends EventEmitter {
    private executingCommands = new Map<string, RemoteCommand>();
    private commandQueue: RemoteCommand[] = [];
    private isProcessing = false;
    private maxConcurrent = 5;

    constructor(private logger: any) {
      super();
    }
  }
  ```

**Verification**:

- [ ] File compiles
- [ ] Class structure correct
- [ ] Imports resolve

**Update Order**:

1. Add imports
2. Define class
3. Test compilation
4. Move to Part 2

---

### Module 7: Remote Command Executor (Part 2/4: Queue Management)

**Goal**: Implement command queuing and processing logic

**Files**:

- `helix-runtime/src/gateway/remote-command-executor.ts` (MODIFY)

**Task List**:

- [ ] **1.7.1** Implement queueCommand() method

  ```typescript
  async queueCommand(cmd: RemoteCommand): Promise<void> {
    if (cmd.status !== "pending") {
      this.logger.warn(`Command ${cmd.commandId} already processed`);
      return;
    }

    // Validate not expired
    if (Date.now() > cmd.expiresAt) {
      await this.updateCommandStatus(cmd.commandId, "failed", {
        error: "Command expired before execution",
        output: "",
      });
      return;
    }

    // PRE-EXECUTION LOGGING (Helix pattern)
    await logToDiscord({
      channel: 'helix-commands',
      type: 'remote_command_queued',
      commandId: cmd.commandId,
      sourceDevice: cmd.sourceDeviceId,
      provider: cmd.provider,
      content: cmd.content.substring(0, 100) + '...',
      timestamp: Date.now(),
      status: 'queued'
    });

    // Hash chain entry
    await createHashChainEntry({
      type: 'remote_command',
      data: {
        commandId: cmd.commandId,
        provider: cmd.provider,
        sourceDevice: cmd.sourceDeviceId,
      },
      timestamp: Date.now()
    });

    this.commandQueue.push(cmd);
    this.processQueue();
  }
  ```

- [ ] **1.7.2** Implement processQueue() method

  ```typescript
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (
        this.commandQueue.length > 0 &&
        this.executingCommands.size < this.maxConcurrent
      ) {
        const cmd = this.commandQueue.shift()!;
        await this.executeCommand(cmd);
      }
    } finally {
      this.isProcessing = false;
    }
  }
  ```

- [ ] **1.7.3** Add placeholder for executeCommand()
  ```typescript
  private async executeCommand(cmd: RemoteCommand): Promise<void> {
    // Will implement in Part 3
  }
  ```

**Verification**:

- [ ] Code compiles
- [ ] Queue logic correct
- [ ] Pre-execution logging works

**Update Order**:

1. Add queueCommand method
2. Add processQueue method
3. Add placeholder for executeCommand
4. Test compilation
5. Move to Part 3

---

### Module 8: Remote Command Executor (Part 3/4: Execution Logic)

**Goal**: Implement command execution with error handling

**Files**:

- `helix-runtime/src/gateway/remote-command-executor.ts` (MODIFY)

**Task List**:

- [ ] **1.8.1** Implement executeCommand() method

  ```typescript
  private async executeCommand(cmd: RemoteCommand): Promise<void> {
    this.executingCommands.set(cmd.commandId, cmd);

    try {
      // Update status to executing
      await this.updateCommandStatus(cmd.commandId, "executing");

      // PRE-EXECUTION LOG
      await logToDiscord({
        channel: 'helix-commands',
        type: 'remote_command_executing',
        commandId: cmd.commandId,
        timestamp: Date.now(),
        status: 'executing'
      });

      // Execute command with local credentials
      const result = await this.executeWithLocalCredentials(
        cmd.provider,
        cmd.agentId,
        cmd.content,
        cmd.sessionId,
        cmd.channelId
      );

      // POST-EXECUTION LOG
      await logToDiscord({
        channel: 'helix-commands',
        type: 'remote_command_completed',
        commandId: cmd.commandId,
        outputLength: result.length,
        timestamp: Date.now(),
        status: 'completed'
      });

      // Update with result
      await this.updateCommandStatus(cmd.commandId, "completed", {
        status: "success",
        output: result,
        executedAt: Date.now(),
      });

      // Emit for sync relay
      this.emit("command-completed", {
        commandId: cmd.commandId,
        result: {
          status: "success",
          output: result,
          executedAt: Date.now(),
        },
      });
    } catch (error) {
      const errorMsg = String(error);

      // LOG ERROR
      await logToDiscord({
        channel: 'helix-commands',
        type: 'remote_command_failed',
        commandId: cmd.commandId,
        error: errorMsg,
        timestamp: Date.now(),
        status: 'failed'
      });

      await this.updateCommandStatus(cmd.commandId, "failed", {
        status: "error",
        output: "",
        error: errorMsg,
        executedAt: Date.now(),
      });

      this.emit("command-failed", {
        commandId: cmd.commandId,
        error: errorMsg,
      });
    } finally {
      this.executingCommands.delete(cmd.commandId);
      this.processQueue();
    }
  }
  ```

**Verification**:

- [ ] Error handling correct
- [ ] Pre-execution logging maintained
- [ ] Events emitted properly

**Update Order**:

1. Implement executeCommand
2. Test compilation
3. Move to Part 4

---

### Module 9: Remote Command Executor (Part 4/4: Credential Integration)

**Goal**: Load credentials from OpenClaw and execute commands

**Files**:

- `helix-runtime/src/gateway/remote-command-executor.ts` (MODIFY)

**Task List**:

- [ ] **1.9.1** Implement executeWithLocalCredentials()

  ```typescript
  private async executeWithLocalCredentials(
    provider: string,
    agentId: string,
    content: string,
    sessionId: string,
    channelId?: string
  ): Promise<string> {
    // Load credentials from OpenClaw's auth-profiles
    const { resolveApiKeyForProfile } = await import(
      "../agents/auth-profiles/oauth.js"
    );
    const { getAuthProfileStore } = await import(
      "../agents/auth-profiles/store.js"
    );

    const profileStore = getAuthProfileStore();
    const credentials = await resolveApiKeyForProfile({
      store: profileStore,
      profileId: provider,
    });

    if (!credentials) {
      throw new Error(
        `No credentials found for provider: ${provider}. Local device must authenticate first.`
      );
    }

    // TODO: Replace with actual OpenClaw execution API
    // For now, return mock result
    return `Executed: ${content} (using ${provider} credentials)`;
  }
  ```

- [ ] **1.9.2** Implement updateCommandStatus() stub
  ```typescript
  private async updateCommandStatus(
    commandId: string,
    status: string,
    result?: any
  ): Promise<void> {
    // TODO: Update in database (Supabase)
    // Implementation will come with database module
    this.logger.info(`Command ${commandId} status: ${status}`);
  }
  ```

**Verification**:

- [ ] Credentials load correctly
- [ ] Error thrown if no credentials
- [ ] Mock execution returns result

**Update Order**:

1. Implement executeWithLocalCredentials
2. Add updateCommandStatus stub
3. Test compilation
4. Move to next module

---

### Session Progress Tracking

Use this section to track progress across multiple sessions.

**Session 1** (Date: **\_\_\_**):

- [ ] Completed Modules: **\_\_\_**
- [ ] Blockers: **\_\_\_**
- [ ] Next Session Goals: **\_\_\_**

**Session 2** (Date: **\_\_\_**):

- [ ] Completed Modules: **\_\_\_**
- [ ] Blockers: **\_\_\_**
- [ ] Next Session Goals: **\_\_\_**

**Session 3** (Date: **\_\_\_**):

- [ ] Completed Modules: **\_\_\_**
- [ ] Blockers: **\_\_\_**
- [ ] Next Session Goals: **\_\_\_**

---

## Code Examples

### Example 1: Full OAuth Flow (Desktop to OpenClaw)

```typescript
// User clicks "Continue with Claude" button in desktop app
// Flow: UI → TypeScript Service → Rust Command → OpenClaw CLI → auth-profiles.json

// 1. User clicks button (AuthConfigStep.tsx)
<button onClick={() => handleOpenClawOAuth('anthropic')}>
  Continue with Claude
</button>

// 2. Handler calls service (AuthConfigStep.tsx)
const handleOpenClawOAuth = async (provider: 'anthropic' | 'openai-codex') => {
  const result = await openclawOAuth.initiateAnthropicSetupToken();
  if (result.success) {
    onComplete({ authChoice: 'token', provider: 'anthropic' });
  }
};

// 3. Service invokes Tauri command (openclaw-oauth.ts)
export async function initiateAnthropicSetupToken(): Promise<OAuthFlowResult> {
  return await invoke<OAuthFlowResult>('run_openclaw_oauth', {
    provider: 'anthropic',
    flow: 'setup-token',
  });
}

// 4. Rust executes OpenClaw CLI (auth.rs)
let output = Command::new("openclaw")
  .args(&["models", "auth", "setup-token", "--provider", "anthropic"])
  .output()?;

// 5. OpenClaw prompts user for setup-token, stores in:
// ~/.openclaw/agents/main/agent/auth-profiles.json
{
  "profiles": {
    "anthropic": {
      "type": "token",
      "provider": "anthropic",
      "access": "sk-ant-api03-...",
      "expires": 9999999999999
    }
  }
}

// 6. Desktop app shows success, credentials ready for use
```

### Example 2: Remote Command Execution Flow

```typescript
// User types command on mobile web browser
// Flow: Web → Supabase → Local Device → OpenClaw → Supabase → Web

// 1. User enters command (CodeInterface.tsx - web)
<textarea value={input} onChange={(e) => setInput(e.target.value)} />
<button onClick={handleExecute}>Execute</button>

// 2. Web submits to Supabase (useRemoteExecution.ts)
const handleExecute = async () => {
  const commandId = nanoid();

  // Insert into remote_commands table
  await supabase.from("remote_commands").insert({
    command_id: commandId,
    source_user_id: user.id,
    source_device_id: deviceId,
    agent_id: "main",
    provider: "anthropic",
    content: input,
    session_id: "current-session",
    status: "pending",
    created_at: Date.now(),
    expires_at: Date.now() + 5 * 60 * 1000, // 5 min timeout
  });

  // Subscribe to updates
  supabase
    .channel(`remote_commands:${commandId}`)
    .on('postgres_changes', { event: 'UPDATE', filter: `command_id=eq.${commandId}` },
      (payload) => {
        if (payload.new.status === 'completed') {
          setResult(payload.new.result);
        }
      }
    )
    .subscribe();
};

// 3. Local device sees new pending command (sync-relay.ts)
const subscription = supabase
  .channel('remote_commands_all')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'remote_commands' },
    async (payload) => {
      if (payload.new.status === 'pending') {
        await this.commandExecutor.queueCommand(payload.new);
      }
    }
  )
  .subscribe();

// 4. Executor processes command (remote-command-executor.ts)
async executeCommand(cmd: RemoteCommand) {
  // Load local OAuth credentials
  const credentials = await resolveApiKeyForProfile({
    store: getAuthProfileStore(),
    profileId: cmd.provider, // "anthropic"
  });

  // Execute with credentials
  const result = await executeWithProvider({
    provider: cmd.provider,
    apiKey: credentials.apiKey,
    content: cmd.content,
  });

  // Update database
  await supabase
    .from("remote_commands")
    .update({
      status: "completed",
      result: {
        status: "success",
        output: result,
        executedAt: Date.now(),
      }
    })
    .eq("command_id", cmd.commandId);
}

// 5. Web receives update via real-time subscription
// Result appears in UI automatically
<div className="result">
  <pre>{result.output}</pre>
</div>
```

### Example 3: Pre-Execution Logging Pattern

```typescript
// Every remote command follows this pattern:

// BEFORE execution
await logToDiscord({
  channel: 'helix-commands',
  type: 'remote_command_queued',
  commandId: cmd.commandId,
  sourceDevice: cmd.sourceDeviceId,
  provider: cmd.provider,
  timestamp: Date.now(),
  status: 'queued'
});

await createHashChainEntry({
  type: 'remote_command',
  data: {
    commandId: cmd.commandId,
    provider: cmd.provider,
  },
  timestamp: Date.now()
});

// EXECUTE
const result = await executeWithLocalCredentials(...);

// AFTER execution
await logToDiscord({
  channel: 'helix-commands',
  type: 'remote_command_completed',
  commandId: cmd.commandId,
  timestamp: Date.now(),
  status: 'completed'
});

// If execution fails, nothing happens - Discord has proof it was attempted
```

---

## Verification Steps

### End-to-End Test Checklist

**Prerequisites**:

- [ ] Desktop app built and running
- [ ] helix-runtime started
- [ ] Web app accessible
- [ ] Supabase migrations applied

**Test 1: Desktop OAuth**

- [ ] Open desktop app
- [ ] Navigate to onboarding
- [ ] Select "Claude (Anthropic)" provider
- [ ] Click "Continue with OAuth" button
- [ ] See setup-token prompt in terminal
- [ ] Run `claude setup-token` in separate terminal
- [ ] Copy token and paste into OpenClaw prompt
- [ ] See success message in desktop app
- [ ] Verify file exists: `~/.openclaw/agents/main/agent/auth-profiles.json`
- [ ] Open file and check JSON structure:
  ```json
  {
    "profiles": {
      "anthropic": {
        "type": "token",
        "provider": "anthropic",
        "access": "sk-ant-api03-...",
        "expires": 9999999999999
      }
    }
  }
  ```
- [ ] Run `openclaw models status` to confirm authentication
- [ ] Repeat for OpenAI Codex provider

**Test 2: Remote Command from Web**

- [ ] Open web browser
- [ ] Navigate to Helix web app
- [ ] Log in with Helix Cloud account
- [ ] Navigate to Code Interface page
- [ ] Enter test command: "Explain quantum computing in one sentence"
- [ ] Click "Execute" button
- [ ] Observe button changes to "Executing on local device..."
- [ ] Check Discord `#helix-commands` channel:
  - [ ] See "remote_command_queued" log
  - [ ] See "remote_command_executing" log
  - [ ] See "remote_command_completed" log
- [ ] See result appear in web UI within 5 seconds
- [ ] Verify result is correct (Claude's response)
- [ ] Check timestamp matches recent execution

**Test 3: Hash Chain Integrity**

- [ ] Run: `npm run verify-hash-chain`
- [ ] Verify output shows no errors
- [ ] Check Discord `#helix-hash-chain` channel
- [ ] Find entry for remote command
- [ ] Verify hash links to previous entry
- [ ] Verify no tampering detected

**Test 4: Admin Dashboard**

- [ ] Navigate to admin dashboard
- [ ] Open "Remote Execution" tab
- [ ] Verify stats show:
  - [ ] Pending: 0
  - [ ] Executing: 0
  - [ ] Completed: 1 (from previous test)
  - [ ] Failed: 0
- [ ] Execute another command from web
- [ ] Watch stats update in real-time
- [ ] Verify completed count increments

**Test 5: Multi-Device Sync**

- [ ] Execute command from web browser
- [ ] Open mobile device (or second browser tab)
- [ ] Log into same account
- [ ] Navigate to Code Interface
- [ ] Execute another command
- [ ] Verify both devices see both results
- [ ] Check that results appear on device that didn't send command

**Test 6: Error Handling**

- [ ] Stop helix-runtime (simulate local device offline)
- [ ] Try to execute command from web
- [ ] Verify command status stays "pending"
- [ ] Restart helix-runtime
- [ ] Verify pending command executes automatically
- [ ] Check result appears after execution

**Test 7: Credential Validation**

- [ ] Delete `~/.openclaw/agents/main/agent/auth-profiles.json`
- [ ] Try to execute command from web
- [ ] Verify error: "No credentials found for provider"
- [ ] Check Discord logs show error
- [ ] Re-authenticate via desktop
- [ ] Retry command - should work

---

## Update Order Flowchart

```
Start
  │
  ├─ Module 1: Desktop OAuth Service Wrapper
  │    └─ Create TypeScript wrapper for OpenClaw CLI
  │
  ├─ Module 2: Tauri OAuth Commands (Rust)
  │    └─ Implement backend commands to execute OpenClaw
  │
  ├─ Module 3: AuthConfigStep UI Integration
  │    └─ Replace API key redirect with OAuth buttons
  │
  ├─ Module 4: Remote Command Protocol Schema
  │    └─ Define TypeBox schema for commands
  │
  ├─ Module 5: Web Execution Types
  │    └─ Define TypeScript interfaces for web
  │
  ├─ Modules 6-9: Remote Command Executor (4 parts)
  │    ├─ Part 1: Core Structure
  │    ├─ Part 2: Queue Management
  │    ├─ Part 3: Execution Logic
  │    └─ Part 4: Credential Integration
  │
  ├─ Module 10: Sync Relay Integration (see separate section below)
  │
  ├─ Modules 11-12: Database Migrations (see separate section below)
  │
  ├─ Modules 13-15: Web Hooks & UI (see separate section below)
  │
  ├─ Module 16: Admin Dashboard (see separate section below)
  │
  └─ Module 17: Hash Chain Integration (see separate section below)
  │
End-to-End Verification
```

**Rule**: Each module must compile and pass verification before moving to the next.

**Checkpoint**: After Module 9, you can manually test local credential loading before proceeding to sync integration.

---

## BYOK (Bring Your Own Key) - Foundational Principle

**What is BYOK?**
Users provide ALL their own API keys (no Helix billing):
- Claude API via Claude MAX subscription (setup-token flow)
- OpenAI Codex via their OpenAI account (PKCE OAuth)
- Future: DeepSeek, GLM-4, Gemini, etc. (stored in auth-profiles.json)

**Cost Transparency**:
- All charges go directly to user's accounts
- Helix never touches billing
- Users see exact cost per operation via admin dashboard

**Phase 1 Implementation**:
- Desktop performs OAuth (tokens stay on desktop)
- Stores credentials in `~/.openclaw/agents/main/agent/auth-profiles.json`
- Remote devices execute via Phase 1 remote executor (uses local credentials)

**Phase 2 Enhancement**:
- Per-agent/skill/tool model assignment (users choose which model powers each component)
- Smart routing based on queue depth and cost
- Approval modes (budget-based, operation-type, cost-threshold, full-manual)
- Real-time cost tracking with budget alerts

---

## Next Steps

After completing Phase 1, proceed to **Phase 2: Lingxi-Style Orchestrator** (see separate plan file).

Phase 2 builds on this foundation to add:

- Supervisor agent routing
- Specialized psychological agents
- Multi-agent collaboration
- Advanced dashboard features (TRAE UI inspiration)
- Cost-aware model routing with per-agent assignment
- Approval workflow with 4 configurable modes

---

**End of Phase 1 Plan**

Total Estimated Tasks: **150+ granular checkboxes**
Estimated Completion Time: **4-6 sessions** (assuming 2-3 hour sessions)
Complexity: **Medium** (builds on existing systems)
Key Pattern: **Pre-execution logging** (Discord + hash chain before any operation)
