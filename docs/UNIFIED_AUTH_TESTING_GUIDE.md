# Unified Authentication System - Testing Guide

## Setup: Environment Variables from 1Password

Before running the desktop app, load Supabase credentials from 1Password vault:

```bash
# Load from 1Password (helix vault)
export SUPABASE_URL=$(op read "op://helix/Supabase/url" 2>/dev/null || echo "https://helix-backend.supabase.co")
export SUPABASE_ANON_KEY=$(op read "op://helix/Supabase/anon_key" 2>/dev/null)
export SUPABASE_SERVICE_ROLE_KEY=$(op read "op://helix/Supabase/service_role_key" 2>/dev/null)

# Verify they're set
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:10}..."
echo "SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:10}..."
```

## Architecture Overview

The unified authentication system implements the mandatory Supabase login flow for all users (desktop, web, mobile):

```
┌─────────────────────────────────────────────────┐
│ ALL USERS (First Time or Not Logged In)         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │  1. Supabase Login      │
      │  (email/password)       │
      │  OR Sign Up             │
      └────────────┬────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │  2. Tier Detection      │
      │  Check subscription     │
      └────────────┬────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   Free (awaken/     Paid (overseer/
   phantom)          architect)
        │                     │
        │                     ├──────────────────┐
        │                     │                  │
        ▼                     ▼                  ▼
  MANDATORY BYOK    Centralized AI        Optional BYOK
  (Provider Select)  (Use Managed Models)  (Coding Features)
        │                     │                  │
        └──────────┬──────────┴──────────┬───────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │  3. Instance Registration│
      │  Register this device   │
      │  with Supabase          │
      └────────────┬────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │  4. Tier-Based Setup    │
      │  - Free: Provider auth  │
      │  - Paid: Skip or setup  │
      └────────────┬────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │  5. Complete Onboarding │
      │  Start using Helix      │
      └─────────────────────────┘
```

## Implementation Details

### 1. Supabase Login Step

**File**: `helix-desktop/src/components/auth/SupabaseLoginStep.tsx`

Provides two paths:

- **Login**: Email/password authentication
- **Sign Up**: Create new account (auto-provisioned as free tier)

**Output**:

```typescript
{
  userId: string;
  email: string;
  tier: 'awaken' | 'phantom' | 'overseer' | 'architect';
}
```

### 2. Tier Detection Step

**File**: `helix-desktop/src/components/auth/TierDetectionStep.tsx`

Routes users based on subscription tier:

| Tier      | Pricing | Type | Path                                   |
| --------- | ------- | ---- | -------------------------------------- |
| awaken    | Free    | Free | MANDATORY BYOK                         |
| phantom   | $9/mo   | Free | MANDATORY BYOK                         |
| overseer  | $29/mo  | Paid | Centralized (default) or Optional BYOK |
| architect | $99/mo  | Paid | Centralized (default) or Optional BYOK |

### 3. Instance Registration Step

**File**: `helix-desktop/src/components/auth/InstanceRegistrationStep.tsx`

Registers device with Supabase:

- **Instance ID**: UUID persisted in localStorage (survives restarts)
- **Device Name**: Auto-filled with hostname, user can customize
- **Platform**: Detected from user agent (Windows/macOS/Linux/etc)
- **Device Type**: Always 'desktop' for this app

## Tauri Backend Commands

### New Supabase Commands

All implemented in `helix-desktop/src-tauri/src/commands/auth.rs`:

#### `supabase_login(email, password) → SupabaseLoginResponse`

- Authenticates with Supabase
- Fetches subscription tier from `subscriptions` table
- Returns: `{ success, user_id, email, tier, error }`

#### `supabase_signup(email, password) → SupabaseSignupResponse`

- Creates new Supabase account
- Auto-provisioned with tier='awaken' via trigger
- Returns: `{ success, user_id, email, tier, error }`

#### `register_instance(user_id, instance_id, device_name, device_type, platform) → InstanceRegistrationResponse`

- Inserts into `user_instances` table
- Handles conflict by updating existing instance
- Returns: `{ success, error }`

#### `send_heartbeat(instance_id) → HeartbeatResponse`

- Updates `last_heartbeat` and `is_online` status
- Called every 60 seconds when instance is active
- Returns: `{ success, error }`

#### `get_hostname() → String`

- Returns machine hostname
- Used for default device name suggestion
- Returns: `"MacBook-Pro"` or `"DESKTOP-ABC123"`, etc.

## Test Scenarios

### Test 1: Free User Flow (BYOK Required)

1. **Sign up** with email `test-free@example.com` / password `TestPassword123`
   - Expected: Redirected to Tier Detection with tier='awaken'

2. **Tier Detection** shows "Helix Free"
   - Expected: "BYOK required" message
   - Click "Continue with BYOK"

3. **Instance Registration**
   - Expected: Device name auto-filled with hostname
   - Modify if desired
   - Click "Register Device"

4. **Provider Selection** (Mode selection)
   - Expected: User must select provider (Anthropic, OpenAI, etc.)
   - Enter API key or run OAuth

5. **Complete**
   - Expected: "You're all set!" message
   - Instance visible in database

**Verification**:

```sql
-- Check user created
SELECT id, email FROM auth.users WHERE email = 'test-free@example.com';

-- Check subscription tier
SELECT user_id, tier FROM subscriptions WHERE user_id = '<user_id>';

-- Check instance registered
SELECT * FROM user_instances WHERE user_id = '<user_id>';
```

### Test 2: Paid User Flow - Centralized (Default)

1. **Sign up** with email `test-paid@example.com` / password `TestPassword123`
   - Expected: Must have overseer or architect tier in database
   - (For testing, manually insert into subscriptions table)

2. **Tier Detection** shows "Overseer"
   - Expected: Two options:
     - "Use Centralized System" (recommended, default)
     - "Setup BYOK for Coding" (optional)
   - Select "Use Centralized System"

3. **Instance Registration**
   - Expected: Same flow as free user

4. **Mode Selection**
   - Expected: Skip provider selection (not needed for centralized)
   - Go directly to Complete or Advanced options

5. **Complete**
   - Expected: User ready to use centralized AI system

**Verification**:

```sql
-- Check paid tier
SELECT user_id, tier FROM subscriptions WHERE user_id = '<user_id>';

-- Verify instance registered
SELECT * FROM user_instances WHERE user_id = '<user_id>';
```

### Test 3: Paid User Flow - Optional BYOK

1. **Tier Detection** shows "Overseer"
   - Select "Setup BYOK for Coding" (optional)

2. **Instance Registration**
   - Same as free flow

3. **Provider Selection**
   - Expected: User can optionally setup provider
   - If skipped, only centralized system available
   - If setup, both systems available (centralized + BYOK coding)

### Test 4: Cross-Device Registration

1. **Register first instance**
   - Login on Desktop
   - Complete onboarding
   - Instance recorded with name "MacBook-Pro (macos)"

2. **Register second instance**
   - Login from different browser/device
   - Complete onboarding
   - Get new instance_id (different UUID)
   - Instance recorded with name "DESKTOP-ABC (windows)"

3. **Verify instances**
   ```sql
   SELECT
     instance_id,
     device_name,
     platform,
     is_online,
     last_heartbeat
   FROM user_instances
   WHERE user_id = '<user_id>'
   ORDER BY created_at;
   ```

   - Expected: Two instances with different instance_ids and platforms

### Test 5: Heartbeat Mechanism

1. **Register instance**
   - After registration, check `is_online = true` and current `last_heartbeat`

2. **Wait 30 seconds**
   - Heartbeat should fire automatically every 60 seconds (or can manually trigger)

3. **Verify heartbeat updated**
   ```sql
   SELECT last_heartbeat, is_online
   FROM user_instances
   WHERE instance_id = '<instance_id>';
   ```

   - Expected: `last_heartbeat` updated to recent time, `is_online = true`

### Test 6: Offline Status

1. **Register instance**
   - Initial: `is_online = true`

2. **Stop heartbeats** (close app without cleanup)
   - Simulate offline

3. **Wait 5+ minutes**
   - Supabase can run trigger to set `is_online = false` based on heartbeat timeout

4. **Verify offline**
   ```sql
   SELECT is_online,
     EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
   FROM user_instances
   WHERE instance_id = '<instance_id>';
   ```

   - Expected: `is_online = false` if > 5 minutes since last heartbeat

## Running the Tests

### Start Desktop App with Environment Variables

```bash
cd /c/Users/Specter/Desktop/Helix/helix-desktop

# Load environment variables
export SUPABASE_URL="https://helix-backend.supabase.co"
export SUPABASE_ANON_KEY=$(op read "op://helix/Supabase/anon_key")
export SUPABASE_SERVICE_ROLE_KEY=$(op read "op://helix/Supabase/service_role_key")

# Run dev server
npm run dev
```

### Database Setup (if needed)

```bash
cd /c/Users/Specter/Desktop/Helix

# Apply migrations to Supabase
# (Assumes Supabase project already setup)
npm run db:migrate:deploy

# Or manually run migration file:
# web/supabase/migrations/054_user_instances_and_credentials_metadata.sql
```

### Manual Test - Using Tauri Commands

```bash
# From any browser console in the running app
invoke('supabase_login', {
  email: 'test@example.com',
  password: 'password123'
}).then(result => console.log(result));

# Expected output:
# {
#   success: true,
#   user_id: "...",
#   email: "test@example.com",
#   tier: "awaken"
# }
```

## Troubleshooting

### "SUPABASE_ANON_KEY environment variable not set"

- Solution: Load from 1Password or set manually
- Verify: `echo $SUPABASE_ANON_KEY`

### "Failed to connect to Supabase"

- Check: Network connectivity
- Check: `SUPABASE_URL` is correct
- Check: API key has correct permissions

### "Invalid email or password"

- Check: User exists in Supabase
- Check: Password is correct
- Check: User not in trial/email verification state

### "Registration failed: 400 Bad Request"

- Check: user_id exists
- Check: instance_id is unique
- Check: device_type is valid ('desktop', 'mobile', 'web')
- Check: platform is one of: 'windows', 'macos', 'linux', 'ios', 'android', 'web'

### Instance shows "offline" immediately

- Check: Heartbeat mechanism running
- Check: Browser console for errors
- Verify: `last_heartbeat` timestamp is recent

## Files Changed

### Backend (Rust)

- `helix-desktop/src-tauri/src/commands/auth.rs` - Added 5 new Supabase commands
- `helix-desktop/src-tauri/src/lib.rs` - Registered new commands
- `helix-desktop/src-tauri/Cargo.toml` - Added chrono, hostname crates

### Frontend (TypeScript/React)

- `helix-desktop/src/components/onboarding/Onboarding.tsx` - Integrated unified auth flow
- `helix-desktop/src/components/auth/SupabaseLoginStep.tsx` - New component
- `helix-desktop/src/components/auth/TierDetectionStep.tsx` - New component
- `helix-desktop/src/components/auth/InstanceRegistrationStep.tsx` - New component

### Database

- `web/supabase/migrations/054_user_instances_and_credentials_metadata.sql` - New tables/RLS/functions

### Documentation

- `docs/UNIFIED_AUTH_ARCHITECTURE.md` - High-level architecture
- `docs/TAURI_BACKEND_SPECIFICATION.md` - Backend command specs
- `docs/UNIFIED_AUTH_TESTING_GUIDE.md` - This file

## Next Steps

1. **Configure environment** with Supabase credentials from 1Password
2. **Run dev server** and test free user flow
3. **Create test paid user** in database for tier testing
4. **Test all three paths**: Free BYOK, Paid Centralized, Paid Optional BYOK
5. **Verify database records** created in user_instances and subscriptions tables
6. **Test cross-device** registration with different browsers/devices
7. **Monitor heartbeats** to ensure online status stays fresh
