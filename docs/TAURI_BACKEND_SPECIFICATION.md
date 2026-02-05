# Tauri Backend Specification - Desktop Auth Integration

This document specifies the Rust/Tauri backend commands required for the unified authentication system.

## Overview

The desktop app communicates with the Rust backend via Tauri's IPC bridge for:

1. Supabase authentication (login/signup)
2. Instance registration with Supabase
3. System information retrieval
4. OAuth credential management

---

## 1. Supabase Authentication Commands

### `supabase_login`

**Purpose**: Authenticate user with email/password and fetch their subscription tier

**Input**:

```typescript
{
  email: string;
  password: string;
}
```

**Output**:

```typescript
{
  success: boolean;
  user_id?: string;
  email?: string;
  tier?: 'awaken' | 'phantom' | 'overseer' | 'architect';
  error?: string;
}
```

**Implementation Notes**:

- Use Supabase REST API or JS SDK via Node.js HTTP client
- Credentials loaded from 1Password vault via `loadSecret('Supabase Anon Key')`
- Return JWT token and tier from `subscriptions` table
- Cache JWT in secure storage for subsequent API calls

**Supabase Query**:

```sql
SELECT
  auth.users.id,
  auth.users.email,
  subscriptions.tier
FROM auth.users
LEFT JOIN subscriptions ON auth.users.id = subscriptions.user_id
WHERE email = $1
```

---

### `supabase_signup`

**Purpose**: Create new user account and auto-provision with free tier

**Input**:

```typescript
{
  email: string;
  password: string;
}
```

**Output**:

```typescript
{
  success: boolean;
  user_id?: string;
  email?: string;
  tier?: string;  // Will be 'awaken'
  error?: string;
}
```

**Implementation Notes**:

- Use Supabase Auth REST API to create user
- Password requirements: minimum 8 characters
- Auto-triggers PostgreSQL function to create `subscriptions` row with tier='awaken'
- Return JWT and tier

**Supabase Query** (via trigger):

```sql
-- PostgreSQL trigger (already exists)
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_user_subscription_on_signup();

-- Function
CREATE FUNCTION create_user_subscription_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'awaken');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Instance Registration Commands

### `register_instance`

**Purpose**: Register this desktop instance with Supabase so web dashboard knows about it

**Input**:

```typescript
{
  user_id: string;
  instance_id: string; // UUID, persisted in localStorage
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'web';
  platform: string; // 'windows' | 'macos' | 'linux'
}
```

**Output**:

```typescript
{
  success: boolean;
  error?: string;
}
```

**Implementation Notes**:

- Insert row into `user_instances` table
- Use authenticated JWT from login
- Handle conflicts gracefully (update if exists)
- Store instance_id in `~/.openclaw/helix-instance-id.json` for persistence

**Supabase Query**:

```sql
INSERT INTO user_instances (user_id, instance_id, device_name, device_type, platform, last_heartbeat, is_online)
VALUES ($1, $2, $3, $4, $5, NOW(), true)
ON CONFLICT(instance_id) DO UPDATE SET
  device_name = $3,
  last_heartbeat = NOW(),
  is_online = true;
```

---

### `send_heartbeat`

**Purpose**: Periodic ping to keep instance online status fresh (call every 60 seconds)

**Input**:

```typescript
{
  instance_id: string;
}
```

**Output**:

```typescript
{
  success: boolean;
  error?: string;
}
```

**Implementation Notes**:

- Call from React component via `setInterval()`
- Doesn't require user context (instance_id is public key)
- Updates `last_heartbeat` and `is_online` fields

**Supabase Query**:

```sql
UPDATE user_instances SET
  last_heartbeat = NOW(),
  is_online = true
WHERE instance_id = $1;
```

---

## 3. System Information Commands

### `get_hostname`

**Purpose**: Get machine hostname for default device name

**Input**: None

**Output**:

```typescript
string; // e.g., "MacBook-Pro" or "DESKTOP-ABC123"
```

**Implementation Notes**:

- Use `std::env::consts::OS` for platform
- Use `hostname` crate to get system hostname
- Return user-friendly string

**Rust**:

```rust
use hostname;

#[tauri::command]
fn get_hostname() -> Result<String, String> {
    hostname::get()
        .map_err(|e| e.to_string())
        .map(|h| h.into_string().unwrap_or_default())
}
```

---

### `detect_claude_code`

**Purpose**: Check if Claude Code CLI is installed and authenticated

**Input**: None

**Output**:

```typescript
{
  cliAvailable: boolean;
  cliPath: string | null;
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null; // 'max' | 'pro' | null
  expiresAt: number | null; // Unix timestamp
}
```

**Implementation Notes**:

- Check common install paths: `/usr/local/bin/claude`, `%APPDATA%\Claude\claude.exe`
- Run `claude --version` to test availability
- Run `claude status` to check authentication
- Parse subscription info from `claude auth status` output

**Rust**:

```rust
#[tauri::command]
fn detect_claude_code() -> ClaudeCodeInfo {
    // 1. Find claude executable
    // 2. Run `claude --version`
    // 3. Run `claude auth status`
    // 4. Parse output
}
```

---

## 4. OAuth Commands

### `run_openclaw_oauth`

**Purpose**: Initiate OAuth flow for a provider (already exists, enhance for Supabase integration)

**Input**:

```typescript
{
  provider: 'anthropic' | 'openai-codex';
  flow: 'setup-token' | 'pkce';
}
```

**Output**:

```typescript
{
  success: boolean;
  provider: 'anthropic' | 'openai-codex';
  tokenType: 'oauth' | 'setup-token';
  storedInPath: string;
  error?: string;
}
```

**Implementation Notes**:

- Delegate to existing OpenClaw CLI integration
- After successful OAuth, optionally log to Supabase `instance_credentials_metadata`
- Store only hash of credential, never the full value

**Supabase Query** (optional audit):

```sql
INSERT INTO instance_credentials_metadata (instance_id, user_id, provider, credential_hash, scope)
VALUES ($1, $2, $3, sha256($4), 'general')
ON CONFLICT DO NOTHING;
```

---

## 5. Backend Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri Desktop App (TypeScript/React)          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Auth Components                          │  │
│  │  ├─ SupabaseLoginStep → calls supabase_login            │  │
│  │  ├─ TierDetectionStep → determines BYOK vs Centralized  │  │
│  │  └─ InstanceRegistrationStep → calls register_instance  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ IPC Bridge                          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              Tauri Backend (Rust - src-tauri/)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tauri Commands (@tauri::command macros)                │  │
│  │                                                          │  │
│  │  1. supabase_login(email, password)                    │  │
│  │  2. supabase_signup(email, password)                   │  │
│  │  3. register_instance(user_id, ...)                    │  │
│  │  4. send_heartbeat(instance_id)                        │  │
│  │  5. get_hostname()                                     │  │
│  │  6. detect_claude_code()                               │  │
│  │  7. run_openclaw_oauth(provider, flow)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓ (via secrets-loader)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Secrets Loader (1Password CLI)                         │  │
│  │  - Load SUPABASE_ANON_KEY from 1Password vault          │  │
│  │  - Load SUPABASE_SERVICE_ROLE_KEY for admin operations  │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓ (HTTPS REST API)                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                Supabase Backend (PostgreSQL + Auth)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tables                                                  │  │
│  │  - auth.users (Supabase managed)                        │  │
│  │  - subscriptions (tier, Stripe integration)             │  │
│  │  - user_instances (device tracking)                     │  │
│  │  - instance_credentials_metadata (audit trail)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Functions & Triggers                                   │  │
│  │  - create_user_subscription_on_signup()                 │  │
│  │  - RLS policies for instance access                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling

### Standardized Error Codes

```typescript
enum TauriErrorCode {
  // Auth errors
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  USER_EXISTS = 'USER_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  AUTH_FAILED = 'AUTH_FAILED',

  // Instance errors
  INSTANCE_ALREADY_EXISTS = 'INSTANCE_ALREADY_EXISTS',
  INVALID_DEVICE_NAME = 'INVALID_DEVICE_NAME',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',

  // System errors
  SUPABASE_UNREACHABLE = 'SUPABASE_UNREACHABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

### Error Response Format

```typescript
{
  success: false;
  error: string;  // Human-readable error
  code?: TauriErrorCode;  // Machine-readable code
}
```

---

## 7. Security Considerations

### JWT Token Storage

- **Frontend**: Store JWT in localStorage (HttpOnly not available in desktop)
- **Backend**: Include JWT in `Authorization: Bearer` header for all Supabase requests
- **Expiration**: Refresh token before expiry (Supabase default: 1 hour)

### Instance ID Persistence

- **Storage**: `~/.openclaw/helix-instance-id.json`
- **Format**:
  ```json
  {
    "instance_id": "uuid-here",
    "created_at": "2025-02-05T00:00:00Z"
  }
  ```
- **Permissions**: User-readable only (mode 0600)

### Credential Hashing

- **Never store raw credentials**
- Use SHA-256 or bcrypt for credential hashes
- Example:
  ```rust
  use sha2::Sha256;
  let hash = format!("{:x}", Sha256::digest(credential_bytes));
  ```

---

## 8. Testing Commands

### Local Testing Without Supabase

For development, mock responses:

```rust
#[cfg(debug_assertions)]
#[tauri::command]
fn supabase_login(email: String, password: String) -> LoginResponse {
    if email == "test@example.com" {
        LoginResponse {
            success: true,
            user_id: Some("user-123".to_string()),
            tier: Some("overseer".to_string()),
            error: None,
        }
    } else {
        LoginResponse {
            success: false,
            error: Some("Invalid credentials".to_string()),
            ..Default::default()
        }
    }
}
```

### Test Endpoints

```bash
# Test auth
curl -X POST http://localhost:8080/__tauri_api__ \
  -d '{"cmd": "supabase_login", "email": "test@example.com", "password": "password123"}'

# Test instance registration
curl -X POST http://localhost:8080/__tauri_api__ \
  -d '{"cmd": "register_instance", "user_id": "user-123", "instance_id": "instance-uuid", "device_name": "Test"}'
```

---

## 9. Implementation Checklist

- [ ] Add `supabase_login` command
- [ ] Add `supabase_signup` command
- [ ] Add `register_instance` command
- [ ] Add `send_heartbeat` command (optional heartbeat endpoint)
- [ ] Add `get_hostname` command
- [ ] Add `detect_claude_code` command
- [ ] Enhance `run_openclaw_oauth` for Supabase integration
- [ ] Create database migration for `user_instances` table
- [ ] Create database migration for `instance_credentials_metadata` table
- [ ] Test all commands locally
- [ ] Test error handling
- [ ] Add unit tests for each command
- [ ] Add integration tests with mock Supabase
- [ ] Document rate limits (if applicable)

---

## 10. Related Files

| File                                                             | Purpose                           |
| ---------------------------------------------------------------- | --------------------------------- |
| `helix-desktop/src/components/auth/SupabaseLoginStep.tsx`        | Frontend login UI                 |
| `helix-desktop/src/components/auth/TierDetectionStep.tsx`        | Tier selection UI                 |
| `helix-desktop/src/components/auth/InstanceRegistrationStep.tsx` | Instance setup UI                 |
| `src/lib/secrets-loader.ts`                                      | Load Supabase keys from 1Password |
| `helix-desktop/src-tauri/src/main.rs`                            | Tauri command registration        |
| `web/supabase/migrations/`                                       | DB schema (to be updated)         |
