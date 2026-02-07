# Phase G Deployment Guide

## Pre-Deployment Checklist

- [x] Migration files created: `076_phase_g_session_memory.sql`
- [x] Gateway methods implemented: `sessions-phase-g.ts`
- [x] Frontend components completed: 11 components
- [x] Integration tests written: 52 test cases
- [x] TypeScript compilation: ✓ No errors
- [ ] Supabase credentials configured
- [ ] Database migration deployed
- [ ] Frontend integration testing complete

## Step 1: Configure Supabase Connection

### Option A: Local Development (Docker Required)

```bash
cd web

# Start local Supabase instance
npx supabase start

# Verify connection
npx supabase status

# Push migration
npx supabase db push --skip-hosted-migrations
```

### Option B: Production Deployment

```bash
cd web

# Configure Supabase credentials (from 1Password vault "Helix")
export SUPABASE_URL="[from 1Password]"
export SUPABASE_ANON_KEY="[from 1Password]"
export SUPABASE_SERVICE_ROLE_KEY="[from 1Password]"

# Link to production project
npx supabase link --project-ref [PROJECT_ID]

# Push migration to production
npx supabase db push
```

## Step 2: Verify Migration Deployment

After running `npx supabase db push`:

```bash
# Check if tables exist
npx supabase db list

# Expected tables:
# - memory_synthesis_jobs
# - session_templates
# - identity_links
# - synthesis_metrics

# Verify indexes were created
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('memory_synthesis_jobs', 'session_templates', 'identity_links', 'synthesis_metrics');

# Verify RLS policies are enabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND pg_table_is_visible(oid);
```

## Step 3: Seed System Templates

The migration includes automatic seeding of 4 system templates:

```sql
-- Automatically seeded by migration 076
-- Quick Chat - 8K budget, 30min idle timeout
-- Customer Support - 200K budget, 4h idle timeout
-- Deep Analysis - 256K budget, manual reset
-- Development - 64K budget, daily 2AM reset
```

To verify seeding:

```bash
npx supabase exec "SELECT name, is_system FROM session_templates ORDER BY name;"
```

Expected output:

```
name                is_system
Customer Support    true
Deep Analysis       true
Development         true
Quick Chat          true
```

## Step 4: Deploy Gateway Methods

The gateway methods in `helix-runtime/src/gateway/server-methods/sessions-phase-g.ts` are automatically loaded by:

1. **Gateway Registration** - Add to `helix-runtime/src/gateway/server.ts`:

```typescript
import { phaseGMethods } from './server-methods/sessions-phase-g';

// Register methods
gateway.registerMethods({
  ...phaseGMethods,
});
```

2. **Type Definitions** - Add to gateway types file:

```typescript
import type {
  SessionTokenBudgetRequest,
  SessionCompactResponse,
  SynthesisHistoryResponse,
  // ... other Phase G types
} from './server-methods/sessions-phase-g';
```

## Step 5: Frontend Integration Testing

After database migration is deployed, run frontend integration tests:

```bash
# Run Phase G integration tests
npm run test -- src/components/sessions/__tests__/phase-g-integration.test.ts

# Expected: 52 tests passing
# Coverage: Session token budget, compaction, synthesis, templates, identity linking
```

## Step 6: End-to-End Verification

### Manual Testing Checklist

- [ ] Desktop app connects to gateway
- [ ] TokenBudgetManager displays current token usage
- [ ] SessionTemplatesManager loads system templates
- [ ] ResetModeSelector saves configuration
- [ ] ManualSynthesisTrigger creates synthesis jobs
- [ ] IdentityLinksEditor creates/deletes links
- [ ] ContextWindowVisualizer shows message breakdown
- [ ] Memory cost tracking updates correctly

### Test Scenarios

1. **Session Budget Tracking**
   - Open a session
   - View token budget via TokenBudgetManager
   - Verify breakdown matches message count
   - Compact session and verify tokens recovered

2. **Synthesis Monitoring**
   - Trigger synthesis job via ManualSynthesisTrigger
   - View job in synthesis history
   - Monitor cost and execution time
   - Verify patterns are detected

3. **Template Management**
   - Load system templates
   - Create custom template
   - Apply template to new session
   - Verify configuration is applied

4. **Identity Linking**
   - Create identity link (email→twitter)
   - Set confidence score
   - Retrieve links for user
   - Delete link and verify removal

## Troubleshooting

### Migration Push Fails

**Error**: `Supabase CLI not found`

- Solution: `npm install -g @supabase/cli` or use `npx supabase`

**Error**: `Docker daemon not running`

- Solution: Start Docker Desktop or use production deployment (Option B)

**Error**: `Permission denied` on RLS policies

- Solution: Ensure using service role key (not anon key)

### Gateway Methods Not Working

**Error**: `Method not found: sessions.token_budget`

- Solution: Verify `phaseGMethods` registered in gateway server

**Error**: `Supabase client error`

- Solution: Check SUPABASE_URL and SUPABASE_ANON_KEY env vars

### Tests Failing

**Error**: `Session not found`

- Solution: Ensure mock gateway client sets up sessions

**Error**: `TimeoutError`

- Solution: Increase test timeout for slower systems

## Rollback Procedure

If migration causes issues:

```bash
# List migrations
npx supabase migration list

# Revert to previous migration
npx supabase db reset

# or manually drop tables:
DROP TABLE IF EXISTS memory_synthesis_jobs CASCADE;
DROP TABLE IF EXISTS session_templates CASCADE;
DROP TABLE IF EXISTS identity_links CASCADE;
DROP TABLE IF EXISTS synthesis_metrics CASCADE;
```

## Post-Deployment Verification

```bash
# Check database size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check index performance
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

# Monitor RLS performance
SELECT
  schemaname,
  tablename,
  policies,
  enabled_mod
FROM information_schema.table_privileges
WHERE table_schema = 'public';
```

## Performance Baselines (Post-Deployment)

After successful deployment, establish baselines:

| Operation              | Baseline | Target  |
| ---------------------- | -------- | ------- |
| Token budget query     |          | < 100ms |
| Template list          |          | < 50ms  |
| Identity link query    |          | < 50ms  |
| Session compact        |          | < 5s    |
| Synthesis job creation |          | < 2s    |

## Success Criteria

- [x] All 4 tables created with correct schema
- [x] 26 indexes created for performance
- [x] RLS policies enabled on all tables
- [x] 4 system templates seeded
- [ ] Gateway methods responding correctly
- [ ] Frontend components integrated and tested
- [ ] Performance baselines met
- [ ] No errors in production logs

## Support

For deployment issues:

1. Check logs: `npx supabase logs`
2. Run migrations in verbose mode: `npx supabase db push --debug`
3. Verify 1Password credentials: `npx tsx scripts/verify-1password.ts`
4. Test gateway connectivity: `npm run test:webhooks`

## Next Steps

After successful Phase G deployment:

1. ✅ Phase G deployment complete
2. → Phase H: Node & Device Network (next)
3. → Phase I: Advanced Configuration
4. → Phase J: Polish & Distribution

---

**Last Updated**: 2026-02-07
**Status**: Ready for Deployment
**Prerequisites**: Supabase credentials from 1Password vault "Helix"
