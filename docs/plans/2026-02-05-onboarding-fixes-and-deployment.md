# Onboarding Fixes & Web Deployment Plan

> **For Claude:** Use this as the single source of truth for remaining onboarding work.
> Each task is self-contained with exact files, exact code, and verification steps.

**Goal:** Fix the cloud-chat Edge Function to use the existing AI control plane, fix onboarding completion logic, wire up Signup redirect, deploy to Supabase, and verify it works end-to-end.

---

## Critical Issues Found

1. **cloud-chat Edge Function hardcodes DeepSeek** — should use `ai_model_routes` for model selection
2. **`ai_operation_log` has FK to `ai_model_routes(operation_id)`** — "cloud-chat" operation doesn't exist yet, insert will fail
3. **Onboarding "6 message" threshold is arbitrary** — OpenClaw bootstraps via Q&A until profile is complete, not message count
4. **Signup.tsx doesn't redirect to /welcome** — only Login.tsx does
5. **ai_model_routes CHECK constraint** limits models to `claude-opus-4.5`, `deepseek-v3.2`, `gemini-2.0-flash` — Edge Function writes `deepseek-chat` which won't match

---

## Task A: Add cloud-chat operations to ai_model_routes

**File:** `web/supabase/migrations/057_cloud_chat_operations.sql`

```sql
-- Register cloud-chat operations in the AI control plane
-- These must exist before the cloud-chat Edge Function can log to ai_operation_log

INSERT INTO ai_model_routes (
  operation_id, operation_name, description,
  primary_model, fallback_model,
  cost_criticality, estimated_cost_usd,
  avg_input_tokens, avg_output_tokens
) VALUES
(
  'cloud-chat',
  'Cloud Chat',
  'General-purpose cloud-hosted chat with Helix personality and memory',
  'deepseek-v3.2', 'gemini-2.0-flash',
  'LOW', 0.0020,
  500, 300
),
(
  'cloud-chat-onboarding',
  'Onboarding Chat',
  'First-run conversational onboarding — Helix learns about the user',
  'deepseek-v3.2', 'gemini-2.0-flash',
  'LOW', 0.0020,
  500, 300
)
ON CONFLICT (operation_id) DO NOTHING;
```

**Verify:** Check that operations are in the control plane's Intelligence Settings page.

---

## Task B: Fix cloud-chat Edge Function

**File:** `web/supabase/functions/cloud-chat/index.ts`

### Changes needed:

1. **Read model from ai_model_routes** instead of hardcoding DeepSeek URL
2. **Write correct model_used value** matching the CHECK constraint (`deepseek-v3.2` not `deepseek-chat`)
3. **Replace 6-message threshold** with profile-completeness check (has name AND role)
4. **Add profile extraction** — parse user's name and role from conversation using simple pattern matching
5. **Support model fallback** — if primary model fails, try fallback_model from route config

### Profile extraction approach:

Instead of counting messages, after each assistant response, check if the user_profiles row has:

- `display_name IS NOT NULL` AND `role IS NOT NULL`
  If both are set, mark `onboarding_step = 'chat'`.

For extracting name/role from conversation, use a lightweight post-processing step:

- After the AI responds, scan the user's messages for name indicators ("I'm X", "call me X", "my name is X")
- Scan for role indicators ("I'm a X", "I work as X", "I do X")
- Update user_profiles if found

---

## Task C: Fix Signup.tsx redirect

**File:** `web/src/pages/Signup.tsx`

After successful signup, redirect to `/welcome` instead of whatever the current behavior is.

Find the success handler and change it to navigate to `/welcome`.

---

## Task D: Deploy to Supabase

### Prerequisites:

1. `supabase` CLI is available
2. 1Password CLI has DEEPSEEK_API_KEY

### Steps:

```bash
# 1. Apply migrations
cd web
supabase db push

# 2. Set Edge Function secrets
supabase secrets set DEEPSEEK_API_KEY=$(op read "op://...path.../DEEPSEEK_API_KEY")

# 3. Deploy Edge Functions
supabase functions deploy cloud-chat
supabase functions deploy intelligence-settings

# 4. Verify
supabase functions list
```

---

## Task E: End-to-end verification

1. Open web app locally (`npm run dev`)
2. Create new account via Signup
3. Verify redirect to `/welcome`
4. Chat with Helix in onboarding mode
5. Verify messages appear, typing indicator works
6. Verify quota display shows remaining messages
7. Check Supabase dashboard: `user_profiles` row created, `conversations` row with messages
8. Check `ai_operation_log` has entries with correct operation_id
9. Complete onboarding → verify redirect to `/dashboard`
10. Navigate to `/chat` → verify regular chat works
11. Check Intelligence Settings page shows cloud-chat operations

---

## Existing Infrastructure to Leverage (DO NOT duplicate)

| System                | Location                                         | What it does                |
| --------------------- | ------------------------------------------------ | --------------------------- |
| AI Router             | `web/src/services/intelligence/router-client.ts` | Routes operations to models |
| Intelligence Settings | `web/supabase/functions/intelligence-settings/`  | Manages AI config           |
| Control Plane         | `web/src/pages/ControlPlane.tsx`                 | Admin dashboard for AI ops  |
| Model Routes          | `ai_model_routes` table (migration 042)          | Central model registry      |
| Cost Tracking         | `ai_operation_log` table (migration 042)         | Operation audit log         |
| Realtime Sync         | `web/src/lib/sync/realtime-sync-client.ts`       | Cross-platform sync         |
| Conflict Resolution   | `web/src/lib/sync/conflict-resolution.ts`        | Vector clock sync           |
| Budget Enforcement    | `cost_budgets` table (migration 042)             | Daily/monthly limits        |

---

## Files Created So Far (Tasks 1-10 complete)

| File                                               | Status                                    |
| -------------------------------------------------- | ----------------------------------------- |
| `web/supabase/migrations/056_cloud_onboarding.sql` | Done — user_profiles, quotas              |
| `web/supabase/functions/cloud-chat/index.ts`       | **NEEDS FIX** — Tasks A+B                 |
| `web/src/lib/cloud-chat-client.ts`                 | Done                                      |
| `web/src/lib/cloud-chat-client.test.ts`            | Done — 9 tests                            |
| `web/src/hooks/useCloudChat.ts`                    | Done                                      |
| `web/src/hooks/useCloudChat.test.ts`               | Done — 5 tests                            |
| `web/src/pages/OnboardingChat.tsx`                 | Done                                      |
| `web/src/pages/OnboardingChat.test.tsx`            | Done — 10 tests                           |
| `web/src/pages/CloudChat.tsx`                      | Done                                      |
| `web/src/pages/CloudChat.test.tsx`                 | Done — 9 tests                            |
| `web/src/components/auth/ProtectedRoute.tsx`       | Modified — onboarding check               |
| `web/src/App.tsx`                                  | Modified — /welcome + /chat routes        |
| `web/src/pages/Login.tsx`                          | Modified — onboarding redirect            |
| `web/src/components/layout/Navbar.tsx`             | Modified — Chat link + hidden on /welcome |
| `web/src/pages/Signup.tsx`                         | **NEEDS FIX** — Task C                    |
