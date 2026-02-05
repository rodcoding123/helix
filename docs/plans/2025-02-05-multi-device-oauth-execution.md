# Multi-Device OAuth Execution Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable seamless multi-device Helix usage where local device performs OAuth (Claude/OpenAI Codex), remote devices (mobile/web) send commands to local for execution via real-time sync, with results synced back seamlessly.

**Architecture:**

- **Local device (hub):** Always-on helix-runtime with OAuth'd credentials in `~/.openclaw/agents/main/agent/auth-profiles.json`
- **Remote devices (spokes):** Thin clients that authenticate via Helix Cloud account, send command payloads through Supabase sync relay
- **Execution model:** Remote sends command → Local executes with its credential → Result broadcasts back via sync relay
- **User experience:** Seamless, like this chat - user doesn't think about where execution happens

**Tech Stack:** TypeScript, Supabase real-time sync, OpenClaw OAuth (PKCE), Tauri (desktop), React (web), Supabase-sync-relay

---

## Phase 1: Desktop OAuth Integration (Local Device Authority)

### Task 1.1: Replace API Key Redirect with OpenClaw OAuth for Claude

**Files:**

- Modify: `helix-desktop/src/components/onboarding/steps/AuthConfigStep.tsx:125-129`
- Modify: `helix-desktop/src/hooks/useOAuth.ts`
- Create: `helix-desktop/src/services/openclaw-oauth.ts`
- Reference: `helix-runtime/src/commands/chutes-oauth.ts` (OAuth implementation)
- Reference: `helix-runtime/src/agents/auth-profiles/oauth.ts` (token storage)

**Step 1: Understand OpenClaw OAuth for Anthropic**

OpenClaw supports two auth flows for Anthropic:

1. **Setup-token flow** (simpler): User runs `claude setup-token`, pastes token
2. **Chutes OAuth** (PKCE): Browser-based OAuth redirect with local callback

For desktop, we'll use **setup-token flow initially** (simpler, no local callback server needed), with PKCE as future enhancement.

Read: `helix-runtime/docs/concepts/oauth.md` lines 51-63 (setup-token documentation)

**Step 2: Create OpenClaw OAuth service wrapper**

Create `helix-desktop/src/services/openclaw-oauth.ts`:

```typescript
/**
 * OpenClaw OAuth Integration for Desktop
 * Handles OAuth flows for Claude (Anthropic) and OpenAI Codex
 */

import { invoke } from '@tauri-apps/api/core';

export type OAuthProvider = 'anthropic' | 'openai-codex';

export interface OAuthFlowResult {
  success: boolean;
  provider: OAuthProvider;
  tokenType: 'oauth' | 'setup-token';
  storedInPath: string; // Path to auth-profiles.json
  error?: string;
}

/**
 * Initiate Anthropic setup-token OAuth flow
 * User runs: `claude setup-token`
 * Then pastes token into CLI prompt
 */
export async function initiateAnthropicSetupToken(): Promise<OAuthFlowResult> {
  try {
    // Invoke Tauri command to run: openclaw models auth setup-token --provider anthropic
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

/**
 * Initiate OpenAI Codex PKCE OAuth flow
 * Uses local callback on port 1456
 */
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

/**
 * Check if OAuth credentials are already stored
 */
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

**Step 3: Update Tauri command backend**

Modify `helix-desktop/src-tauri/src/commands/auth.rs` to add OAuth execution:

```rust
#[tauri::command]
pub async fn run_openclaw_oauth(
    provider: String,
    flow: String,
) -> Result<OAuthFlowResult, String> {
    // Construct OpenClaw command based on provider and flow
    let cmd = match (provider.as_str(), flow.as_str()) {
        ("anthropic", "setup-token") => {
            vec!["openclaw", "models", "auth", "setup-token", "--provider", "anthropic"]
        }
        ("openai-codex", "pkce") => {
            vec!["openclaw", "models", "auth", "login", "--provider", "openai-codex"]
        }
        _ => return Err(format!("Unsupported provider/flow: {}/{}", provider, flow)),
    };

    // Execute command via subprocess
    let output = Command::new(cmd[0])
        .args(&cmd[1..])
        .output()
        .map_err(|e| format!("Failed to execute OpenClaw: {}", e))?;

    // Parse output and return result
    if output.status.success() {
        Ok(OAuthFlowResult {
            success: true,
            provider: provider.clone(),
            tokenType: "setup-token".to_string(),
            stored_in_path: get_auth_profiles_path()?,
        })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn check_oauth_credentials(provider: String) -> Result<CheckCredentialsResult, String> {
    // Check if ~/.openclaw/agents/main/agent/auth-profiles.json contains provider creds
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

**Step 4: Update AuthConfigStep.tsx to use new OAuth service**

Modify `helix-desktop/src/components/onboarding/steps/AuthConfigStep.tsx`:

Replace lines 125-129:

```typescript
// Only GitHub Copilot has real OAuth - others use API keys
const REAL_OAUTH_PROVIDERS = ['github-copilot'];

// Providers that show the "Get API Key" button flow
const API_KEY_REDIRECT_PROVIDERS = [
  'token',
  'openai-codex',
  'google-gemini-cli',
  'google-antigravity',
  'minimax-portal',
  'qwen-portal',
];
```

With:

```typescript
// Providers with real OAuth support via OpenClaw
const REAL_OAUTH_PROVIDERS = ['github-copilot', 'token', 'openai-codex'];

// API Key redirect only for providers without OAuth
const API_KEY_REDIRECT_PROVIDERS = [
  'google-gemini-cli',
  'google-antigravity',
  'minimax-portal',
  'qwen-portal',
];
```

Add OAuth handler in component:

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
        token: 'oauth-credential', // Actual token managed by OpenClaw
      });
    } else {
      setError(result.error || 'OAuth flow failed');
    }
  } catch (err) {
    setError(String(err));
  }
};
```

**Step 5: Test desktop OAuth flow**

- Desktop onboarding should now offer "Sign in with OAuth" for Claude
- Clicking button launches OpenClaw setup-token or PKCE flow
- Credentials stored in `~/.openclaw/agents/main/agent/auth-profiles.json`
- Verify with: `openclaw models status`

---

### Task 1.2: Integrate OpenAI Codex PKCE OAuth (Port 1456 Callback)

**Files:**

- Reference: `helix-runtime/src/commands/chutes-oauth.ts` (PKCE implementation)
- Modify: `helix-desktop/src-tauri/src/commands/auth.rs`
- Modify: `helix-desktop/src/services/openclaw-oauth.ts`

**Step 1: Implement local callback listener in Tauri backend**

The PKCE flow needs to capture callbacks on `http://127.0.0.1:1456/auth/callback`.

Create `helix-desktop/src-tauri/src/commands/oauth-callback.rs`:

```rust
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct CallbackResult {
    pub code: String,
    pub state: String,
}

pub struct CallbackListener {
    // One-shot channel to receive callback result
    receiver: Mutex<Option<oneshot::Receiver<CallbackResult>>>,
}

impl CallbackListener {
    pub fn new() -> (Self, oneshot::Sender<CallbackResult>) {
        let (tx, rx) = oneshot::channel();
        (
            CallbackListener {
                receiver: Mutex::new(Some(rx)),
            },
            tx,
        )
    }

    pub async fn wait_for_callback(
        self,
        timeout_secs: u64,
    ) -> Result<CallbackResult, String> {
        let rx = self.receiver.lock().unwrap().take();
        let rx = rx.ok_or("Already consumed".to_string())?;

        tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            rx,
        )
        .await
        .map_err(|_| "Callback timeout".to_string())?
        .map_err(|e| format!("Channel error: {}", e))
    }
}

pub async fn start_callback_server(
    port: u16,
) -> Result<(String, oneshot::Sender<CallbackResult>), String> {
    let (listener, tx) = CallbackListener::new();
    let listener = Arc::new(listener);

    let handler = move |Query(query): Query<CallbackQuery>| {
        let listener = listener.clone();
        async move {
            match (query.code, query.state, query.error) {
                (Some(code), Some(state), None) => {
                    let _ = tx.send(CallbackResult { code, state });
                    (StatusCode::OK, "Authorization successful. You can close this window.")
                }
                _ => (StatusCode::BAD_REQUEST, "Invalid callback parameters"),
            }
        }
    };

    let app = Router::new()
        .route("/auth/callback", get(handler));

    let addr = format!("127.0.0.1:{}", port).parse()
        .map_err(|_| "Invalid address".to_string())?;

    tokio::spawn(async move {
        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await
    });

    Ok((format!("http://127.0.0.1:{}/auth/callback", port), tx))
}
```

**Step 2: Modify run_openclaw_oauth to handle PKCE callback**

```rust
#[tauri::command]
pub async fn run_openclaw_oauth_pkce(
    provider: String,
) -> Result<OAuthFlowResult, String> {
    // Start callback listener on port 1456
    let (callback_uri, tx) = start_callback_server(1456).await?;

    // Run OpenClaw with callback URI
    let output = Command::new("openclaw")
        .args(&[
            "models",
            "auth",
            "login",
            "--provider",
            &provider,
            "--redirect-uri",
            &callback_uri,
        ])
        .output()
        .map_err(|e| format!("Failed to execute OpenClaw: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // Wait for callback (3 minute timeout)
    let callback = tokio::time::timeout(
        std::time::Duration::from_secs(180),
        wait_for_callback(tx),
    )
    .await
    .map_err(|_| "OAuth callback timeout".to_string())??;

    Ok(OAuthFlowResult {
        success: true,
        provider: provider.clone(),
        token_type: "oauth".to_string(),
        stored_in_path: get_auth_profiles_path()?,
    })
}
```

---

## Phase 2: Remote Command Execution via Sync Relay

### Task 2.1: Define Remote Command Execution Protocol

**Files:**

- Create: `helix-runtime/src/gateway/protocol/schema/remote-command.ts`
- Create: `web/src/types/remote-execution.ts`
- Reference: `helix-runtime/src/gateway/sync-relay.ts` (sync infrastructure)
- Reference: `helix-runtime/src/helix/session/supabase-sync.ts` (session sync)

**Step 1: Define command payload schema**

Create `helix-runtime/src/gateway/protocol/schema/remote-command.ts`:

```typescript
import { Type } from '@sinclair/typebox';

/**
 * Remote command execution request from mobile/web to local device
 * Synced through Supabase, executed on local with its OAuth credentials
 */
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
    Type.Literal('pending'), // Waiting for local execution
    Type.Literal('executing'), // Being processed
    Type.Literal('completed'), // Done, result ready
    Type.Literal('failed'), // Error occurred
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

export type RemoteCommand = typeof RemoteCommandSchema._type;
```

**Step 2: Create web types for remote execution**

Create `web/src/types/remote-execution.ts`:

```typescript
export interface RemoteCommandRequest {
  commandId: string;
  agentId: string;
  provider: 'anthropic' | 'openai-codex' | 'google-gemini';
  content: string;
  sessionId: string;
  channelId?: string;
}

export interface RemoteCommandResult {
  commandId: string;
  status: 'success' | 'error';
  output: string;
  executedAt: number;
  error?: string;
}

export interface CommandExecutionState {
  pending: RemoteCommandRequest[];
  executing: Map<string, RemoteCommandRequest>;
  completed: Map<string, RemoteCommandResult>;
}
```

---

### Task 2.2: Implement Remote Command Queue in Local Runtime

**Files:**

- Create: `helix-runtime/src/gateway/remote-command-executor.ts`
- Modify: `helix-runtime/src/gateway/sync-relay.ts` (add command handling)
- Modify: `helix-runtime/src/gateway/boot.ts` (initialize executor on startup)

**Step 1: Create remote command executor**

Create `helix-runtime/src/gateway/remote-command-executor.ts`:

```typescript
import { EventEmitter } from 'events';
import type { RemoteCommand } from './protocol/schema/remote-command.js';
import { logToDiscord } from '../helix/discord-logging.js';

export class RemoteCommandExecutor extends EventEmitter {
  private executingCommands = new Map<string, RemoteCommand>();
  private commandQueue: RemoteCommand[] = [];
  private isProcessing = false;
  private maxConcurrent = 5; // Max parallel executions

  constructor(private logger: any) {
    super();
  }

  /**
   * Queue a remote command for execution
   */
  async queueCommand(cmd: RemoteCommand): Promise<void> {
    if (cmd.status !== 'pending') {
      this.logger.warn(`Command ${cmd.commandId} already processed`);
      return;
    }

    // Validate not expired
    if (Date.now() > cmd.expiresAt) {
      await this.updateCommandStatus(cmd.commandId, 'failed', {
        error: 'Command expired before execution',
        output: '',
      });
      return;
    }

    this.commandQueue.push(cmd);
    this.processQueue();
  }

  /**
   * Process command queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.commandQueue.length > 0 && this.executingCommands.size < this.maxConcurrent) {
        const cmd = this.commandQueue.shift()!;
        await this.executeCommand(cmd);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single command with local credentials
   */
  private async executeCommand(cmd: RemoteCommand): Promise<void> {
    this.executingCommands.set(cmd.commandId, cmd);

    try {
      // Update status to executing
      await this.updateCommandStatus(cmd.commandId, 'executing');

      // Log execution attempt to Discord
      await logToDiscord({
        type: 'remote_command',
        content: `Remote execution requested: ${cmd.content.substring(0, 100)}...`,
        deviceId: cmd.sourceDeviceId,
        provider: cmd.provider,
      });

      // Execute command with local credentials
      // This uses the local device's OAuth token from auth-profiles.json
      const result = await this.executeWithLocalCredentials(
        cmd.provider,
        cmd.agentId,
        cmd.content,
        cmd.sessionId,
        cmd.channelId
      );

      // Update with result
      await this.updateCommandStatus(cmd.commandId, 'completed', {
        status: 'success',
        output: result,
        executedAt: Date.now(),
      });

      // Emit event for sync relay to broadcast result
      this.emit('command-completed', {
        commandId: cmd.commandId,
        result: {
          status: 'success',
          output: result,
          executedAt: Date.now(),
        },
      });
    } catch (error) {
      const errorMsg = String(error);
      await this.updateCommandStatus(cmd.commandId, 'failed', {
        status: 'error',
        output: '',
        error: errorMsg,
        executedAt: Date.now(),
      });

      this.emit('command-failed', {
        commandId: cmd.commandId,
        error: errorMsg,
      });
    } finally {
      this.executingCommands.delete(cmd.commandId);
      // Process next command in queue
      this.processQueue();
    }
  }

  /**
   * Execute command using local device's OAuth credentials
   * Credentials loaded from ~/.openclaw/agents/main/agent/auth-profiles.json
   */
  private async executeWithLocalCredentials(
    provider: string,
    agentId: string,
    content: string,
    sessionId: string,
    channelId?: string
  ): Promise<string> {
    // Load credentials for this provider from OpenClaw's auth-profiles
    const { resolveApiKeyForProfile } = await import('../agents/auth-profiles/oauth.js');

    const store = require('../agents/auth-profiles/store.js');
    const profileStore = store.getAuthProfileStore();

    const credentials = await resolveApiKeyForProfile({
      store: profileStore,
      profileId: provider, // e.g., "anthropic", "openai-codex"
    });

    if (!credentials) {
      throw new Error(
        `No credentials found for provider: ${provider}. Local device must authenticate first.`
      );
    }

    // Execute command via OpenClaw with these credentials
    const { executeWithProvider } = await import('../agents/executor/provider-executor.js');

    return await executeWithProvider({
      provider,
      apiKey: credentials.apiKey,
      agentId,
      content,
      sessionId,
      channelId,
    });
  }

  /**
   * Update command status in database
   * Status changes synced to remote device via sync relay
   */
  private async updateCommandStatus(
    commandId: string,
    status: string,
    result?: any
  ): Promise<void> {
    // Update in database (synced to all devices via Supabase)
    // This triggers sync relay to broadcast to requesting device
  }
}
```

**Step 2: Integrate with sync relay**

Modify `helix-runtime/src/gateway/sync-relay.ts` to handle remote commands:

```typescript
/**
 * Handle incoming remote command from mobile/web device
 */
async handleRemoteCommand(
  client: GatewayWsClient,
  command: RemoteCommand
): Promise<void> {
  this.logger.info(`Remote command received: ${command.commandId}`);

  // Validate device is authenticated
  if (!client.userId || !client.deviceId) {
    return this.sendErrorResponse(client, "Not authenticated");
  }

  // Queue for local execution
  await this.commandExecutor.queueCommand(command);

  // Acknowledge receipt to remote device
  await this.sendMessage(client, {
    type: "command.acknowledged",
    commandId: command.commandId,
  });
}

/**
 * Broadcast command execution result to all devices
 */
async broadcastCommandResult(
  userId: string,
  commandId: string,
  result: any
): Promise<void> {
  const devices = this.connectedDevices.get(userId);
  if (!devices) return;

  const message = {
    type: "command.result",
    commandId,
    result,
  };

  for (const [_, client] of devices) {
    await this.sendMessage(client, message);
  }
}
```

---

### Task 2.3: Implement Remote Command UI in Web/Mobile

**Files:**

- Create: `web/src/hooks/useRemoteExecution.ts`
- Modify: `web/src/pages/CodeInterface.tsx`
- Create: `web/src/components/RemoteCommandStatus.tsx`

**Step 1: Create remote execution hook**

Create `web/src/hooks/useRemoteExecution.ts`:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RemoteCommandRequest, RemoteCommandResult } from '../types/remote-execution';
import { nanoid } from 'nanoid';

export function useRemoteExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<RemoteCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  const executeRemotely = useCallback(
    async (
      content: string,
      agentId: string,
      provider: 'anthropic' | 'openai-codex' | 'google-gemini',
      sessionId: string,
      channelId?: string
    ) => {
      setIsExecuting(true);
      setError(null);
      setResult(null);

      const commandId = nanoid();
      const now = Date.now();

      try {
        // Send command to sync relay
        const { error: insertError } = await supabase.from('remote_commands').insert({
          command_id: commandId,
          source_user_id: (await supabase.auth.getUser()).data.user?.id,
          source_device_id: localStorage.getItem('device_id'),
          agent_id: agentId,
          provider,
          content,
          session_id: sessionId,
          channel_id: channelId,
          status: 'pending',
          created_at: now,
          expires_at: now + 5 * 60 * 1000, // 5 minute timeout
        });

        if (insertError) throw insertError;

        // Subscribe to result changes
        const subscription = supabase
          .from(`remote_commands:command_id=eq.${commandId}`)
          .on('*', (payload: any) => {
            if (payload.new.status === 'completed') {
              setResult({
                commandId,
                status: payload.new.result.status,
                output: payload.new.result.output,
                executedAt: payload.new.result.executed_at,
                error: payload.new.result.error,
              });
              setIsExecuting(false);
              subscription.unsubscribe();
            } else if (payload.new.status === 'failed') {
              setError(payload.new.result.error || 'Execution failed');
              setIsExecuting(false);
              subscription.unsubscribe();
            }
          })
          .subscribe();

        subscriptionRef.current = subscription;
      } catch (err) {
        setError(String(err));
        setIsExecuting(false);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    isExecuting,
    result,
    error,
    executeRemotely,
  };
}
```

**Step 2: Integrate into CodeInterface**

Modify `web/src/pages/CodeInterface.tsx` to use remote execution:

```typescript
import { useRemoteExecution } from "../hooks/useRemoteExecution";

export function CodeInterface() {
  const { isExecuting, result, error, executeRemotely } = useRemoteExecution();
  const [input, setInput] = useState("");

  const handleExecute = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    await executeRemotely(
      input,
      "main", // agentId
      "anthropic", // provider - should be user-selected
      "current-session", // sessionId
      undefined // channelId
    );
  };

  return (
    <div className="code-interface">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter command..."
      />

      <button onClick={handleExecute} disabled={isExecuting}>
        {isExecuting ? "Executing..." : "Execute"}
      </button>

      {result && (
        <div className="result success">
          <pre>{result.output}</pre>
        </div>
      )}

      {error && <div className="result error">{error}</div>}
    </div>
  );
}
```

---

## Phase 3: Database Schema & Sync Integration

### Task 3.1: Create Remote Commands Table in Supabase

**Files:**

- Database migration

**Step 1: Create migration file**

In Supabase dashboard, run migration:

```sql
-- Create remote_commands table
CREATE TABLE IF NOT EXISTS remote_commands (
  command_id UUID PRIMARY KEY,
  source_user_id UUID NOT NULL REFERENCES auth.users(id),
  source_device_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai-codex', 'google-gemini')),
  content TEXT NOT NULL,
  session_id TEXT NOT NULL,
  channel_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  result JSONB,
  executed_at BIGINT,
  error TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for status lookups
CREATE INDEX remote_commands_status ON remote_commands(status);

-- Index for user + created_at
CREATE INDEX remote_commands_user_time ON remote_commands(source_user_id, created_at DESC);

-- RLS policy: Users can only see their own commands
ALTER TABLE remote_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commands"
  ON remote_commands
  FOR SELECT
  USING (auth.uid() = source_user_id);

CREATE POLICY "Users can insert own commands"
  ON remote_commands
  FOR INSERT
  WITH CHECK (auth.uid() = source_user_id);

-- Realtime subscription for command updates
ALTER PUBLICATION supabase_realtime ADD TABLE remote_commands;
```

---

## Phase 4: Error Handling & Token Lifecycle

### Task 4.1: Handle Token Refresh During Remote Execution

**Files:**

- Reference: `helix-runtime/src/agents/auth-profiles/oauth.ts` (token refresh logic)
- Modify: `helix-runtime/src/gateway/remote-command-executor.ts`

**Implementation:**

The remote command executor (Task 2.2) already handles token refresh through `resolveApiKeyForProfile()` which:

- Checks token expiry
- Automatically refreshes if expired (using file lock to prevent race conditions)
- Returns fresh credentials for execution

No additional code needed - OpenClaw's token refresh system handles this automatically.

---

### Task 4.2: Handle Execution Errors & Retry Logic

**Files:**

- Modify: `helix-runtime/src/gateway/remote-command-executor.ts`
- Modify: `web/src/hooks/useRemoteExecution.ts`

**Step 1: Add error classification to executor**

```typescript
private async executeCommand(cmd: RemoteCommand): Promise<void> {
  // ... existing setup ...

  try {
    // ... execution ...
  } catch (error) {
    const errorMsg = String(error);

    // Classify error for retry decision
    const isRetryable = this.isRetryableError(errorMsg);
    const maxRetries = 3;
    const currentRetry = cmd.retryCount || 0;

    if (isRetryable && currentRetry < maxRetries) {
      // Reschedule for retry with backoff
      await this.scheduleRetry(cmd, currentRetry + 1);
    } else {
      // Final failure
      await this.updateCommandStatus(cmd.commandId, "failed", {
        status: "error",
        output: "",
        error: errorMsg,
        final: !isRetryable,
        retryCount: currentRetry,
      });
    }
  }
}

private isRetryableError(error: string): boolean {
  // Token refresh failures, network timeouts, etc.
  const retryPatterns = [
    /token.*refresh/i,
    /timeout/i,
    /network.*error/i,
    /temporarily unavailable/i,
  ];
  return retryPatterns.some((p) => p.test(error));
}
```

---

## Phase 5: Testing & Verification

### Task 5.1: Integration Tests

**Files:**

- Create: `helix-runtime/src/gateway/remote-command-executor.test.ts`
- Create: `web/src/hooks/__tests__/useRemoteExecution.test.ts`

**Tests to cover:**

1. Remote command queuing and execution
2. Token refresh during execution
3. Command timeout and expiration
4. Concurrent execution limits
5. Error handling and retries
6. WebSocket/sync relay broadcasting

---

## Execution Checklist

- [ ] Phase 1.1: Desktop OAuth for Claude (setup-token flow)
- [ ] Phase 1.2: Desktop OAuth for OpenAI Codex (PKCE with port 1456)
- [ ] Phase 2.1: Define remote command protocol schema
- [ ] Phase 2.2: Implement remote command executor
- [ ] Phase 2.3: Implement web remote execution UI
- [ ] Phase 3.1: Create Supabase remote_commands table
- [ ] Phase 4.1: Token refresh during execution (auto via OpenClaw)
- [ ] Phase 4.2: Error handling and retry logic
- [ ] Phase 5.1: Integration tests
- [ ] Manual testing: Send command from web, execute on local, see result on web
- [ ] Manual testing: Switch devices mid-execution, command completes
- [ ] Git commits: One per task with proper messaging

---

## Success Criteria

✅ Desktop app performs OAuth for Claude & OpenAI Codex locally
✅ Credentials stored in OpenClaw's auth-profiles.json
✅ Web/mobile send commands via Supabase sync
✅ Local device executes with its OAuth credentials
✅ Results broadcast back to all connected devices
✅ User experience seamless (type on phone, executes on local, result on phone)
✅ No manual API key entry needed
✅ Multi-device sync transparent to user
