# Desktop Staging Deployment Guide

**Date**: February 6, 2026
**Phase**: Desktop Staging (Phase 1 of Post-Migration)
**Duration**: 1-2 weeks
**Status**: Ready for Deployment

---

## Overview

This guide covers deployment of the Phase 4 desktop implementation (Tauri + Supabase) to a staging environment for validation before production release.

---

## Environment Setup

### Prerequisites

- Node.js 22+
- Rust toolchain (for Tauri)
- Windows, macOS, or Linux development machine
- Supabase project linked (already configured)
- Git with main branch cloned

### System Requirements

```
Desktop: 2GB RAM minimum, 500MB disk space
Build: 4GB RAM, SSD recommended
Network: Stable internet (for Supabase sync)
```

---

## Staging Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGING ENVIRONMENT LAYOUT                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STAGING SUPABASE PROJECT                                          │
│  ├─ Same database schema as production                             │
│  ├─ Isolated test data (separate from production users)            │
│  ├─ RLS policies enforced                                          │
│  └─ conversation_insights table ready for synthesis results        │
│                                                                     │
│  DESKTOP APPLICATION (Tauri)                                       │
│  ├─ Environment: STAGING                                           │
│  ├─ Supabase URL: Staging Supabase project                         │
│  ├─ Features:                                                      │
│  │  ├─ Real-time message sync (<100ms)                            │
│  │  ├─ Offline message queueing                                    │
│  │  ├─ Cross-platform sync (desktop ↔ web)                        │
│  │  ├─ Scrolling bug fixed                                        │
│  │  └─ Sync status indicators                                      │
│  └─ Logging: Discord #helix-staging channel                       │
│                                                                     │
│  TEST SUITE                                                        │
│  ├─ Unit tests (offline queue, sync logic)                        │
│  ├─ Integration tests (desktop ↔ Supabase)                        │
│  ├─ E2E tests (full user workflows)                               │
│  └─ Performance tests (sync latency, offline behavior)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Build & Deployment Steps

### Step 1: Build Desktop Application

```bash
# Navigate to desktop directory
cd helix-desktop

# Install dependencies
npm install

# Build Tauri application
npm run tauri build

# Output:
# - Windows: helix-desktop/src-tauri/target/release/Helix.exe
# - macOS: helix-desktop/src-tauri/target/release/Helix.app
# - Linux: helix-desktop/src-tauri/target/release/helix
```

**Build Configuration** (already in tauri.conf.json):

- Bundle: MSI installer (Windows), DMG (macOS), AppImage (Linux)
- Minimum window size: 800x600
- Resizable: Yes
- Fullscreen: Yes (optional)

### Step 2: Configure Staging Environment

Create `.env.staging` in helix-desktop directory:

```env
# Staging Supabase Configuration
VITE_SUPABASE_URL=https://ncygunbukmpwhtzwbnvp.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key-here>

# Staging Feature Flags
VITE_ENVIRONMENT=staging
VITE_LOG_DISCORD=true
VITE_DISCORD_WEBHOOK=<staging-webhook-here>

# Performance Monitoring
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_OFFLINE_LOGGING=true

# Feature Toggles
VITE_ENABLE_VOICE_MEMOS=true
VITE_ENABLE_FILE_SYNC=true
VITE_ENABLE_GLOBAL_SHORTCUTS=true
```

### Step 3: Deploy to Staging

```bash
# Option 1: Local Testing (Developer Machine)
npm run dev
# App opens with hot-reload enabled
# Perfect for local testing

# Option 2: Staging Server Deployment
# If using AWS EC2, Azure VM, or similar:

# Create installer
npm run tauri build

# Transfer installer to staging server
scp helix-desktop/src-tauri/target/release/bundle/msi/Helix.msi user@staging-server:/tmp/

# Install on staging server
msiexec /i C:\tmp\Helix.msi /quiet

# Verify installation
"C:\Program Files\Helix\Helix.exe" --version
```

### Step 4: Verify Deployment

```bash
# Check application launch
helix-desktop start

# Verify Supabase connection
curl https://ncygunbukmpwhtzwbnvp.supabase.co/rest/v1/conversations \
  -H "Authorization: Bearer <token>" \
  -H "apikey: <anon-key>"

# Expected: 200 OK with empty array or conversation list
```

---

## Testing Plan

### Unit Tests (5 hours)

**File**: `helix-desktop/src/__tests__/`

```bash
# Run all unit tests
npm run test

# Target Coverage:
# - supabase-desktop-client.ts: 95%+ coverage
# - offline-sync-queue.ts: 95%+ coverage
# - useSupabaseChat.ts: 90%+ coverage
```

**Test Scenarios**:

1. **Supabase Client**
   - ✅ Load conversations
   - ✅ Load messages
   - ✅ Send message (online)
   - ✅ Create conversation
   - ✅ Real-time subscriptions
   - ✅ Disconnect cleanup

2. **Offline Sync Queue**
   - ✅ Add message to queue
   - ✅ Persist to localStorage
   - ✅ Restore from storage on init
   - ✅ Process queue with retries
   - ✅ Exponential backoff logic
   - ✅ Handle max retries

3. **React Hook (useSupabaseChat)**
   - ✅ Initialize with user
   - ✅ Load conversations
   - ✅ Select conversation
   - ✅ Load messages
   - ✅ Send message
   - ✅ Create new conversation
   - ✅ Sync queue integration

### Integration Tests (8 hours)

**Scenario 1: Online Message Flow**

```
1. User opens desktop app
2. Logs in to Supabase
3. Selects conversation
4. Types message
5. Sends message
6. Message appears immediately (optimistic)
7. Syncs to Supabase
8. Web browser sees message in real-time (<100ms)
✅ VERIFY: Message appears on web instantly
```

**Scenario 2: Offline Message Queueing**

```
1. User online, has messages flowing
2. Network disconnect (disable WiFi/ethernet)
3. Offline indicator appears
4. User types 3 messages
5. Each message appears locally (optimistic)
6. Queue count shows "3 pending"
7. Network reconnected
8. Messages sync automatically (exponential backoff)
9. Offline indicator clears
✅ VERIFY: All 3 messages synced, no duplicates
```

**Scenario 3: Cross-Platform Sync**

```
1. Open web chat and desktop app (same account)
2. Send message from web
3. Desktop receives in real-time (<100ms)
4. Send message from desktop
5. Web receives in real-time (<100ms)
6. Both show same conversation state
✅ VERIFY: Bi-directional sync working, no conflicts
```

**Scenario 4: Scrolling Bug Fix**

```
1. Load conversation with 100+ messages
2. Scroll to top (read history)
3. New message arrives from Helix
4. Verify NO auto-scroll (stays at top)
5. Send own message
6. Verify auto-scroll to bottom
7. Scroll away, new message arrives
8. Verify NO auto-scroll (stays where user is)
✅ VERIFY: Scrolling only auto-advances when at bottom
```

**Scenario 5: Session Management**

```
1. Create 5 conversations
2. Each has different message count
3. Switch between sessions quickly
4. Messages load correctly for each
5. Sync status updates correctly
✅ VERIFY: All sessions switch smoothly, correct messages
```

### End-to-End Tests (6 hours)

**Playwright Test Suite**: `helix-desktop/src/__tests__/desktop-e2e.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Desktop Chat E2E', () => {
  // Test 1: Full conversation workflow
  test('should create and send message in conversation', async () => {
    // 1. Launch app
    // 2. Login
    // 3. Create new conversation
    // 4. Send message
    // 5. Verify message appears
    // 6. Verify synced to Supabase
    // 7. Verify visible on web instantly
  });

  // Test 2: Offline workflow
  test('should queue messages when offline', async () => {
    // 1. Go offline
    // 2. Send 5 messages
    // 3. Verify queued locally
    // 4. Come back online
    // 5. Verify messages synced
  });

  // Test 3: Multi-session switching
  test('should handle session switching', async () => {
    // 1. Create 3 conversations
    // 2. Switch rapidly between sessions
    // 3. Verify correct messages load
    // 4. Verify sync continues
  });
});
```

### Performance Tests (4 hours)

**Metrics to Verify**:

```
Real-Time Sync:
  Target: <100ms from send to receive
  Method: Timestamp on send, timestamp on receive
  Accept: 99th percentile <200ms

Offline Queue:
  Target: Immediate message queuing
  Method: Measure queue add time
  Accept: <10ms

Auto-Sync:
  Target: <1s from online to synced
  Method: Track reconnect event to sync complete
  Accept: <2s (accounting for network latency)

UI Responsiveness:
  Target: <500ms for conversation switch
  Method: Measure state update to render
  Accept: <1s with network latency

Memory Usage:
  Target: <200MB stable (no growth over time)
  Method: Monitor process memory for 1 hour with activity
  Accept: <300MB sustained
```

### Load Testing (3 hours)

**Test 1: 1000 Messages in Single Conversation**

```bash
npm run test:load:messages

Simulate: Load conversation with 1000 messages
Measure:
  - Load time: target <2s
  - Memory: target <300MB
  - Scroll performance: target 60 FPS
  - Search (if implemented): target <500ms
```

**Test 2: 100 Conversations in Session List**

```bash
npm run test:load:sessions

Simulate: Render 100 conversation list items
Measure:
  - Initial render: target <500ms
  - Scroll through list: target 60 FPS
  - Search filter: target <200ms
```

---

## Monitoring & Logging

### Discord Logging (Real-time)

Create staging Discord webhook:

1. Go to Discord server
2. Create #helix-staging channel
3. Add webhook to channel
4. Get webhook URL
5. Set in `.env.staging`

**Logged Events**:

- ✅ App startup (version, environment)
- ✅ User login/logout
- ✅ Conversation creation/deletion
- ✅ Message send success/failure
- ✅ Offline queue operations
- ✅ Sync completion
- ✅ Errors and exceptions
- ✅ Performance metrics

**Example Log Entry**:

```
[STAGING] 2026-02-10T14:32:10Z
Event: message_sent
User: rodrigo_specter
Conversation: chat-12345
Message ID: msg-67890
Sync Status: SUCCESS
Latency: 87ms
Details: Message synced to Supabase, visible on web
```

### Local Monitoring

**DevTools Integration**:

```typescript
// In DesktopChatRefactored.tsx
const [metrics, setMetrics] = useState({
  lastSyncTime: null,
  messageLatency: 0,
  queueLength: 0,
  isOnline: navigator.onLine,
  memoryUsage: 0
});

// Display in UI (dev mode only)
{process.env.NODE_ENV === 'development' && (
  <div className="monitoring-panel">
    <p>Last Sync: {metrics.lastSyncTime}</p>
    <p>Message Latency: {metrics.messageLatency}ms</p>
    <p>Queue: {metrics.queueLength}</p>
    <p>Memory: {metrics.memoryUsage}MB</p>
  </div>
)}
```

### Performance Monitoring

```bash
# Chrome DevTools
npm run dev -- --inspect

# Opens Chrome DevTools on localhost:9222
# Monitor:
# - Network tab: sync latencies
# - Performance tab: UI rendering
# - Memory tab: memory growth
# - Console: debug logs
```

---

## Troubleshooting Guide

### Issue: "Cannot find module @supabase/supabase-js"

**Solution**:

```bash
cd helix-desktop
npm install
npm run build
```

### Issue: "CORS error from Supabase"

**Solution**:

```
Likely cause: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY incorrect
Check:
  1. .env.staging has correct values
  2. Supabase project is accessible
  3. RLS policies allow anon key access
Fix:
  1. Verify .env.staging
  2. Check Supabase dashboard for project status
  3. Restart app after .env changes
```

### Issue: "Offline queue not persisting"

**Solution**:

```
Likely cause: localStorage disabled or full
Check:
  1. Browser localStorage available
  2. Sufficient disk space
  3. localStorage quota not exceeded
Debug:
  1. Open DevTools → Application → Local Storage
  2. Should show "helix-offline-queue" key
  3. Clear cache and restart if corrupted
```

### Issue: "Messages not syncing after coming online"

**Solution**:

```
Likely cause: Exponential backoff exhausted or network error
Check:
  1. Network connection is stable
  2. Supabase service status (check dashboard)
  3. RLS policies allow user to write
Debug:
  1. Check Discord #helix-staging for error logs
  2. Inspect DevTools Console for detailed error
  3. Clear offline queue and retry:
     localStorage.removeItem('helix-offline-queue')
     location.reload()
```

---

## Sign-Off Checklist

Before moving to production, verify all items:

### Code Quality

- [ ] All unit tests passing (npm run test)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] No console errors in DevTools
- [ ] No memory leaks detected
- [ ] Performance metrics all met

### Functionality

- [ ] Messages sync correctly online
- [ ] Offline queueing works
- [ ] Auto-sync on reconnect works
- [ ] Scrolling bug is fixed
- [ ] Cross-platform sync works (desktop ↔ web)
- [ ] Session switching works
- [ ] All edge cases handled

### Monitoring

- [ ] Discord logging working
- [ ] All events being logged
- [ ] Performance metrics visible
- [ ] Error reporting working

### User Testing

- [ ] Stakeholder approval received
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] UX smooth and intuitive
- [ ] Documentation complete

### Final Approval

- [ ] Code reviewed and approved
- [ ] Security review passed
- [ ] Architecture review passed
- [ ] Ready for production

---

## Next Steps

After staging validation (1-2 weeks):

1. Production deployment
2. Begin iOS development (SwiftUI)
3. Begin Android development (Jetpack Compose)
4. Beta testing on TestFlight and Google Play
5. App Store and Google Play submission

---

**Document Version**: 1.0
**Last Updated**: February 6, 2026
**Status**: READY FOR STAGING DEPLOYMENT
