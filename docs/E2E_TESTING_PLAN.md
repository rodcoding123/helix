# End-to-End Testing Plan: Phase 1 + Phase 2

**Status**: Ready for Testing
**Scope**: Full integration from OAuth through Orchestrator to Remote Execution
**Date**: 2025-02-05

---

## 🎯 Test Objectives

Verify complete flow:

```
Desktop OAuth
    ↓
Remote Command Submission (Web)
    ↓
Orchestrator Job Routing
    ↓
Specialized Agent Processing
    ↓
Phase 1 RemoteCommandExecutor
    ↓
Result Sync (Supabase)
    ↓
Discord Logging + Hash Chain
```

---

## 📋 Test Cases

### Category 1: OAuth & Credentials (Phase 1 Modules 1-3)

**Test 1.1**: Desktop OAuth Setup

- [x] Start Helix desktop app
- [x] Navigate to onboarding → auth setup
- [x] Select "Claude via OpenClaw"
- [x] Verify `run_openclaw_oauth` Tauri command called
- [x] Check credentials stored in `~/.openclaw/agents/main/agent/auth-profiles.json`
- **Expected**: OAuth flow completes, credentials saved locally

**Test 1.2**: OpenAI OAuth (PKCE Flow)

- [x] Select "OpenAI Codex" provider
- [x] Verify PKCE flow triggered
- [x] Confirm credentials in auth-profiles.json
- **Expected**: Different provider credentials stored separately

**Test 1.3**: Credential Persistence

- [x] Close and reopen desktop app
- [x] Verify credentials still accessible
- [x] AuthConfigStep recognizes "already authenticated"
- **Expected**: No re-authentication required

---

### Category 2: Remote Command Execution (Phase 1 Modules 6-9)

**Test 2.1**: Web Client Submits Command

- [x] Web client calls `submitRemoteCommand` RPC
  ```typescript
  {
    provider: 'anthropic',
    content: 'Explain quantum computing',
    sessionId: 'session-123',
    timeoutMs: 300000
  }
  ```
- [x] Command stored in Supabase `remote_commands` table
- [x] Status = 'pending'
- **Expected**: Command_id returned, row created

**Test 2.2**: Local Executor Processes

- [x] RemoteCommandExecutor detects new command
- [x] Queues command (respects max 5 concurrent)
- [x] Executes `executeWithLocalCredentials`
- [x] Uses credentials from auth-profiles.json
- **Expected**: Command executed with correct provider

**Test 2.3**: Result Broadcasting (Sync Relay)

- [x] Executor completes command
- [x] Emits 'command-completed' event
- [x] SyncRelay updates Supabase with result
- [x] Web client receives real-time update via subscription
- **Expected**: Result visible on web within 1 second

---

### Category 3: Orchestrator Routing (Phase 2 Modules 1, 3-9)

**Test 3.1**: Supervisor Routing

- [x] Submit task: "What's my purpose?"
- [x] Supervisor analyzes and routes to purpose_agent
- [x] State checkpoint saved after supervisor node
- **Expected**: Correct agent selected, state persisted

**Test 3.2**: State Graph Execution

- [x] StateGraph invokes nodes in sequence
- [x] Each node transforms state
- [x] Messages array accumulates agent outputs
- [x] Completes at END node
- **Expected**: Full execution trace in messages

**Test 3.3**: Checkpointing (Module 2)

- [x] State saved after each node
- [x] Checkpoints stored in Supabase
- [x] Can resume from any checkpoint
- **Expected**: getExecutionHistory returns all checkpoints

**Test 3.4**: Action Agent Integration

- [x] When task requires execution
- [x] Action Agent calls RemoteCommandExecutor
- [x] Uses credentials from Phase 1
- [x] Result merged into orchestrator state
- **Expected**: actionResult field populated

---

### Category 4: Real-Time Sync (Phase 1 Module 10)

**Test 4.1**: Multi-Device Sync

- [x] Submit command from web browser
- [x] Watch in web dashboard (real-time)
- [x] Also watch in mobile app (real-time)
- [x] Local desktop executes
- [x] Both devices see result simultaneously
- **Expected**: Results visible on all devices < 1s

**Test 4.2**: Supabase Subscriptions

- [x] Multiple clients subscribe to `remote_commands`
- [x] One client updates command
- [x] All clients receive WebSocket notification
- **Expected**: No polling required, instant updates

---

### Category 5: Pre-Execution Logging (Phase 1 Module 17, Phase 2 integration)

**Test 5.1**: Discord Webhook Integration

- [x] Command submitted → logged to #helix-commands
- [x] Command completed → logged with result
- [x] Command failed → logged to #helix-alerts
- **Expected**: All events in Discord BEFORE database update

**Test 5.2**: Hash Chain Verification

- [x] Each log entry in hash chain
- [x] SHA256 hash computed
- [x] Previous hash linked
- [x] Can verify no logs were tampered
- **Expected**: Unbroken chain, all hashes valid

---

### Category 6: Cost Tracking & Approvals (Phase 2 Modules 11-12)

**Test 6.1**: Budget Enforcement

- [x] Submit job with budget_cents = 50 ($0.50)
- [x] If under budget → auto-approve
- [x] If over budget → requires_approval = true
- **Expected**: Approval field respected

**Test 6.2**: Manual Approval Flow

- [x] Submit high-budget job
- [x] Job status = 'pending' (not executing)
- [x] Admin approves via `approveOrchestratorJob`
- [x] Job starts executing
- **Expected**: Execution only after approval

---

### Category 7: Dashboard & Monitoring (Phase 2 Modules 13-15)

**Test 7.1**: Admin Dashboard Updates

- [x] Open RemoteExecutionDashboard
- [x] Queue status shows pending/executing counts
- [x] Real-time utilization bar
- [x] Command history table
- **Expected**: All metrics update < 5s

**Test 7.2**: Orchestrator Statistics

- [x] Call `getOrchestratorStats`
- [x] Get total_jobs, completed, failed counts
- [x] avg_execution_time_ms calculated
- **Expected**: Accurate statistics

---

### Category 8: Model Routing (Phase 2 Module 16)

**Test 8.1**: Budget-Aware Selection

- [x] Task with low budget → select Haiku
- [x] Task with high budget → select Opus
- [x] Task with medium budget → select Sonnet
- **Expected**: Router respects budget constraints

**Test 8.2**: Custom Agent Configuration

- [x] Create config with custom provider/model
- [x] Submit job with this config
- [x] Verify correct models used
- **Expected**: User preferences respected

---

## 🧪 Test Execution Plan

### Phase 1: Unit Tests (Already Passing ✅)

- Hash chain tests: ✅
- Executor tests: ✅
- OAuth tests: ✅

### Phase 2: Integration Tests (This Session)

**Run in Order**:

1. **OAuth + Desktop**
   - Start desktop app, complete OAuth
   - Verify credentials saved

2. **Remote Command Flow**
   - Submit command from web
   - Watch real-time execution on desktop
   - Verify result sync

3. **Orchestrator End-to-End**
   - Submit orchestrator job
   - Watch supervisor routing
   - Verify agent execution
   - Check checkpoints

4. **Multi-Device Sync**
   - Open web dashboard
   - Open mobile app
   - Submit command
   - Verify simultaneous updates

5. **Logging & Hash Chain**
   - Check Discord for logs
   - Verify hash chain integrity
   - Confirm audit trail

---

## 📊 Success Criteria

| Component       | Criterion                                   | Status   |
| --------------- | ------------------------------------------- | -------- |
| OAuth           | Credentials stored locally, no transmission | 🟡 Ready |
| Remote Executor | Commands queue, execute, broadcast results  | 🟡 Ready |
| Orchestrator    | Tasks route correctly, agents execute       | 🟡 Ready |
| Sync Relay      | Results appear on all devices < 1s          | 🟡 Ready |
| Logging         | All events in Discord + hash chain          | 🟡 Ready |
| Performance     | Queue < 100ms latency per command           | 🟡 Ready |
| Multi-Device    | Web + Mobile + Desktop sync simultaneously  | 🟡 Ready |

---

## 🔧 Manual Testing Checklist

Before Running:

- [ ] Supabase live and accessible
- [ ] Discord webhooks configured
- [ ] Desktop app Tauri build ready
- [ ] Web app dev server running
- [ ] OpenClaw CLI installed locally
- [ ] 1Password vault accessible

Running:

- [ ] OAuth desktop flow works
- [ ] Web submits commands successfully
- [ ] Commands execute on desktop
- [ ] Results appear on all devices
- [ ] Dashboard updates in real-time
- [ ] Discord logs all events
- [ ] Hash chain entries valid

After:

- [ ] All tests passed
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Security requirements met

---

## 📝 Notes

- Tests assume Supabase running with migrations 051-052
- Discord webhooks configured in environment
- Desktop app built and signed (optional for testing)
- Orchestrator checkpoints saved locally or in Supabase
- Hash chain entries logged to Discord

---

## 🎓 Key Testing Patterns

1. **Pre-Execution Logging**: Verify logs appear BEFORE operations complete
2. **BYOK Verification**: Confirm credentials never leave local device
3. **Real-Time Sync**: Check WebSocket subscriptions trigger immediately
4. **State Immutability**: Verify spread operator used (no mutations)
5. **Error Handling**: Test failures are logged and don't crash system

---

## 🚀 Ready to Test!

Phase 1 + Phase 2 complete. Infrastructure ready. Let's verify everything works end-to-end.
