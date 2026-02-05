# Unified Authentication Architecture - CRITICAL REFACTOR

## Current Issue: Broken Onboarding Flow

All three platforms (Web, Desktop, Mobile) have **separate, incompatible authentication flows**:

### Web Current Flow

```
Landing Page → Signup (Supabase) → Auto-provisioned tier='awaken' → Dashboard
❌ Missing: Tier selection, BYOK setup, pricing decision
```

### Desktop Current Flow

```
OAuth Provider Selection → Setup-token/PKCE/Device Flow → Complete
❌ Missing: Supabase login, tier detection, instance registration
```

### Mobile (Future)

```
❌ Not implemented yet
```

**Problem**: Users have no unified account. Desktop doesn't know who the user is in the web dashboard.

---

## Required Unified Architecture

### ALL Platforms: Step 1 - Mandatory Supabase Authentication

```typescript
// Every platform starts here
LOGIN_STEP: {
  email: string;      // Supabase Auth
  password: string;   // Supabase Auth

  Output: {
    userId: string;
    email: string;
    tier: 'awaken' | 'phantom' | 'overseer' | 'architect';
    subscription: {
      current_period_start: number;
      current_period_end: number;
      stripe_subscription_id?: string;
    };
  }
}
```

### ALL Platforms: Step 2 - Tier-Aware Path Selection

```typescript
TIER_DETECTION_STEP: {
  if tier in ['awaken', 'phantom']:
    // Free users - MANDATORY BYOK
    → Path A: BYOK Setup (Provider Selection → OAuth)

  else if tier in ['overseer', 'architect']:
    // Paid users - Two options
    → Path B1: Centralized System (default, no setup needed)
    → Path B2: Optional BYOK for coding features (provider selection)
}
```

### Path A: Free Users (BYOK Mandatory)

```
1. Provider Selection (existing: Claude, OpenAI, GitHub, etc.)
2. OAuth Flow (existing: setup-token, PKCE, device flow)
3. Credentials Storage (device-specific)
   - Desktop: ~/.openclaw/agents/main/agent/auth-profiles.json
   - Web: Browser localStorage (with IndexedDB encryption)
   - Mobile: Secure keychain
4. Optional Integrations (Discord, etc.)
```

### Path B1: Paid Users - Centralized System (Default)

```
✅ No setup needed
✅ Credentials stored server-side (managed by us)
✅ Access to AIOperationRouter (DeepSeek, Gemini, OpenAI)
✅ Cost budgeting and approval workflows
✅ Optional: Later add BYOK for coding via settings
```

### Path B2: Paid Users - BYOK for Coding (Optional)

```
1. Show: "Coding Features (Optional BYOK)"
   - "Use centralized system (default) - managed models"
   - "BYOK setup - bring your own Claude API key"
2. If choosing BYOK:
   - Same Path A flow (provider selection → OAuth)
   - Store credentials device-specifically
   - Use for coding operations only
3. Other operations still use centralized system
```

### Platform-Specific: Instance Registration (Desktop/Mobile Only)

```typescript
INSTANCE_REGISTRATION_STEP: {
  // Only after Supabase login + tier detection

  instance_id: string;  // Generated on first launch
  device_name: string;  // User can customize
  device_type: 'desktop' | 'mobile' | 'web';
  platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android';

  → Save to Supabase table: `user_instances`
  → Web dashboard can now see which devices are connected
  → Remote command executor knows where to send commands
}
```

---

## Data Model Changes Required

### Supabase: New Tables

#### `user_instances` (for cross-device tracking)

```sql
CREATE TABLE user_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  instance_id TEXT NOT NULL UNIQUE,  -- Device identifier
  device_name TEXT,                  -- e.g., "My MacBook"
  device_type TEXT,                  -- 'desktop' | 'mobile' | 'web'
  platform TEXT,                     -- 'windows' | 'macos' | 'linux' | 'ios' | 'android'
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, instance_id)
);

-- RLS: Users can only see their own instances
CREATE POLICY "Users see own instances"
  ON user_instances FOR SELECT
  USING (auth.uid() = user_id);
```

#### `instance_credentials_metadata` (audit trail only - NOT storing keys!)

```sql
CREATE TABLE instance_credentials_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT,                -- 'anthropic', 'openai-codex', etc.
  credential_hash TEXT NOT NULL, -- Hash only, never full key
  scope TEXT,                   -- 'general' | 'coding-only'
  added_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,

  -- Audit trail: when, where, what
  FOREIGN KEY(instance_id) REFERENCES user_instances(instance_id)
);

-- RLS: Only instance owner and admins can see
CREATE POLICY "Users see own instance credentials"
  ON instance_credentials_metadata FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Implementation Roadmap

### Phase 1: Web App (Lowest Risk)

1. Add Supabase tier detection after login
2. Show tier-based UI path
3. For paid users: Display "Already set up with centralized system"
4. For free users: Redirect to BYOK setup screen (existing UI)
5. Instance registration: Store web instance in `user_instances`

### Phase 2: Desktop App (Medium Risk)

1. Add SupabaseLoginStep before any OAuth
2. Add TierDetectionStep after login
3. Add InstanceRegistrationStep after tier path chosen
4. Integrate with existing BYOK setup flow
5. Store instance_id in ~/.openclaw config for reuse across restarts

### Phase 3: Mobile App (Future)

1. Same flow as desktop
2. Store instance_id in secure keychain
3. Integrate with mobile credential storage

### Phase 4: Cross-Device Sync (Advanced)

1. Web dashboard shows all user instances
2. Can trigger remote command execution from web → desktop
3. Real-time status updates (online/offline)
4. Instance management UI (rename, remove, etc.)

---

## Technical Implementation Details

### Required Tauri Commands (for Desktop)

```typescript
// Authentication
interface SupabaseLoginRequest {
  email: string;
  password: string;
}
interface SupabaseLoginResponse {
  success: boolean;
  user_id?: string;
  tier?: string;
  error?: string;
}

#[tauri::command]
async fn supabase_login(email: String, password: String) -> SupabaseLoginResponse { ... }

#[tauri::command]
async fn supabase_signup(email: String, password: String) -> SupabaseLoginResponse { ... }

// Instance Registration
interface RegisterInstanceRequest {
  user_id: string;
  device_name: string;
  platform: string;
}

#[tauri::command]
async fn register_instance(req: RegisterInstanceRequest) -> Result<String, String> { ... }

// Heartbeat (keep-alive)
#[tauri::command]
async fn send_heartbeat(instance_id: String) -> Result<(), String> { ... }
```

### Required Web/React Changes

```typescript
// 1. Update useAuth hook to include tier
export interface UseAuthReturn {
  user: AuthUser | null;
  tier: 'awaken' | 'phantom' | 'overseer' | 'architect' | null;  // NEW
  // ... existing fields
}

// 2. New Tier Detection Component
export function TierDetectionStep({ tier, onPathSelect }: TierDetectionStepProps) {
  if (tier === 'awaken' || tier === 'phantom') {
    return <ByokRequiredPath />;  // Mandatory provider selection
  }

  if (tier === 'overseer' || tier === 'architect') {
    return <PaidUserOptions />;   // Choice: centralized or BYOK
  }
}

// 3. Instance tracking in localStorage
localStorage.setItem('helix_instance_id', uuidv4());
localStorage.setItem('helix_user_tier', tier);
```

### Required Backend Changes (OpenClaw/Gateway)

```typescript
// 1. Supabase client integration in Rust backend
// Create Supabase REST client for tier verification

// 2. Tier-aware routing in gateway
async fn route_operation(user_id: String, operation: String) {
  let tier = get_user_tier_from_supabase(user_id).await;

  if is_free_tier(tier) {
    // Only BYOK-based operations allowed
    route_to_byok_executor(user_id, operation).await
  } else {
    // Can use centralized AI router
    let decision = ai_operation_router.decide(operation).await;
    execute_with_routed_model(decision).await
  }
}

// 3. Instance heartbeat listener
#[tauri::command]
async fn send_heartbeat(instance_id: String) {
  db.query(
    "UPDATE user_instances SET last_heartbeat = NOW(), is_online = true WHERE instance_id = $1",
    [&instance_id]
  ).await;
}
```

---

## Critical Questions for Implementation

1. **Supabase Integration in Rust**:
   - Is there already a Supabase Rust client in the project?
   - What's the strategy for Supabase credentials in the backend?
   - Should we use Supabase JWT for auth, or REST API with service key?

2. **Instance Identification**:
   - Should instance_id be persistent (stored in config) or per-session?
   - How do we handle reinstalls / config reset?
   - Should users be able to rename instances?

3. **Credential Scope**:
   - For paid users with BYOK for coding: how do we enforce "coding-only" scope?
   - Should there be a separate credential for coding vs general use?
   - Can user have multiple BYOK credentials (e.g., one Claude, one OpenAI)?

4. **Web Instance Tracking**:
   - Should web app count as an "instance" (browser-based)?
   - How do we track multiple browser tabs/windows?
   - Should there be a browser plugin for credential injection?

5. **Cost Tracking**:
   - For BYOK: Cost is user's responsibility (we don't track)
   - For centralized: AIOperationRouter tracks costs
   - Should we show cost estimates before operations for BYOK users?

6. **Offline Behavior**:
   - What happens if user is offline during login?
   - Should desktop cache last-known tier locally?
   - How do we handle tier downgrade (paid → free)?

---

## Security Considerations

### Keys Never Transmitted

✅ BYOK credentials stay on device (OpenClaw auth-profiles.json)
✅ Web BYOK stored in IndexedDB with device-local encryption
✅ Never sent to Helix servers

### Audit Trail

✅ Hash of credentials stored (for verification, not recovery)
✅ Last-used timestamp for each credential
✅ Pre-execution logging to Discord
✅ Hash chain integrity verification

### Tier Verification

✅ Server-side check on each operation
✅ Can't client-side override tier
✅ Stripe webhook updates tier in real-time
✅ Expired subscriptions block centralized access

---

## Migration Plan (If Already Have Users)

**Current**: Web users signed up without tier consideration
**Future**: Tier detection + onboarding

**For Existing Users**:

1. All auto-provisioned with tier='awaken'
2. Don't force re-authentication
3. Add tier selection to settings (with Stripe link)
4. Show "Upgrade" prompt in main dashboard
5. Free plan never requires setup (can delay forever)

---

## Success Criteria

- [ ] Web: Supabase login → tier detection → (BYOK or centralized) → dashboard
- [ ] Desktop: Supabase login → instance registration → BYOK/centralized → dashboard
- [ ] Mobile: Same flow as desktop (when implemented)
- [ ] Cross-device: Web dashboard shows all user's connected instances
- [ ] Paid users: Transparent access to centralized AI models (no BYOK setup)
- [ ] Free users: Mandatory BYOK setup before using
- [ ] All credentials: Never transmitted to Helix servers
