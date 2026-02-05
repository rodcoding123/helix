# TypeScript Errors Report - Helix Web Project

**Status**: 124 errors remaining (down from 200+)
**Generated**: 2026-02-05

## Summary

Fixed:

- ✅ Created missing `ai-router.ts` export file
- ✅ Created missing `database.types.ts` placeholder
- ✅ Fixed lucide-react `MessageSquareVoice` → `MessageSquare`
- ✅ Fixed Voice component prop mismatches
- ✅ Fixed `useVoiceRecorder` hook types (audioLevel, Timer types)
- ✅ Fixed tenant-middleware Express types for browser context
- ✅ Updated tsconfig target to ES2021 for `replaceAll()` support
- ✅ Fixed Supabase `.offset()` → `.range()` in calendar-events.ts and email-messages.ts
- ✅ Added `content` and `stopReason` to ExecutionResult type
- ✅ Added compatibility fields to Routing types

Still need fixing:

- ⚠️ 124 TypeScript errors across multiple files

## Remaining Errors by Category

### 1. Property/Method Missing (TS2339) - ~30 errors

**Pattern**: Services trying to access properties that don't exist

Examples:

- `suggestedTimes` on TimeSlot[]
- `subscribeMultiple` on MetricsStreamService
- `connectionStatus` on RealtimeSyncClient
- `subscribe` on UseRealtimeReturn
- `stream` on UseStreamingReturn
- `getMonthlyUptime` on StatusService
- `subscribeToUpdates` on StatusService
- `resolvedAt` on Incident
- `user` on Session types
- `operationCount`, `totalCost`, `avgLatency` on DashboardMetrics

**Fix Strategy**: Add missing properties to interfaces OR change code to use correct properties

### 2. Type Assignment Mismatches (TS2322) - ~20 errors

**Pattern**: Trying to assign incompatible types

Examples:

- String to `"normal" | "high" | "low"` priority
- Component props don't match expected interface
- Promise return types mismatch (content vs result)
- Number assigned where string expected (cost tracker)

**Fix Strategy**: Ensure types match exactly, add type assertions where appropriate

### 3. Argument Type Mismatches (TS2345) - ~15 errors

**Pattern**: Function arguments don't match expected parameter types

Examples:

- Intelligence service functions expecting `{result}` but getting `{content}`
- RoutingResponse vs RoutingDecision mismatches
- ExecutionContext parameter issues

**Fix Strategy**: Update function signatures or fix argument types

### 4. Other Errors

- TS2769: Overload mismatches (Supabase insert/select operations)
- TS2554: Wrong number of arguments
- TS2551: Property name typos (avgLatency vs latency)
- TS2550: Missing lib support (fixed with ES2021)
- TS18047: Possibly null (add null checks)

## Files Needing Attention (Priority Order)

### High Priority (Blocking build)

1. **src/services/intelligence/\*.ts** (~20 errors)
   - analytics-intelligence.ts
   - calendar-intelligence.ts
   - email-intelligence.ts
   - task-intelligence.ts
   - router-client.ts

   **Issue**: Return type mismatch between `{content, inputTokens, outputTokens}` and `{result, inputTokens, outputTokens}`

   **Fix**: Update wrapper functions to transform `content` → `result`

2. **src/services/email-\*.ts** (~15 errors)
   - email-compose.ts (Supabase insert overload errors)
   - email-intelligence.ts (already counted above)
   - email-search.ts (never[] type issues)
   - email-smart-reply.ts (property access on never)
   - email-messages.ts (fixed offset, may have other issues)

3. **src/pages/\*.tsx** (~15 errors)
   - RealtimeMonitoringDashboard.tsx (DashboardMetrics properties)
   - AlertingDashboard.tsx (component prop mismatches)
   - Schedule Manager.tsx (Session.user access)
   - StatusPage.tsx (Incident properties, StatusService methods)
   - Calendar.tsx (CalendarGrid props)
   - MemoryPatterns.tsx (hook return types)

### Medium Priority

4. **src/components/\*.tsx** (~10 errors)
   - ErrorBoundary.tsx (Sentry type mismatches)
   - automation/PostMeetingPanel.tsx (priority string literal)
   - automation/SmartSchedulingPanel.tsx (suggestedTimes property)

5. **src/hooks/\*.ts** (~8 errors)
   - useEmailClient.ts (event listener options)
   - useMetricsStream.ts (subscribeMultiple method)
   - useOfflineSync.ts (IDBRequest type issues)

6. **src/services/llm-router/\*.ts** (~5 errors)
   - router.ts (type string → number for cost)
   - cost-tracker.ts (type mismatches)

7. **src/admin/\*.tsx** (~3 errors)
   - RemoteExecutionDashboard.tsx (Supabase .on() method)

8. **src/services/tenant/\*.ts** (~3 errors)
   - invite-service.ts (user.email property, array find)

9. **src/services/status/\*.ts** (~2 errors)
   - status-service.ts (array type conversions)

### Low Priority

10. **Other services** (~10 errors)
    - automation-email-trigger.ts
    - automation-meeting-prep.ts
    - calendar-events.ts
    - calendar-task-intelligence.ts
    - scheduling/pg-cron-manager.ts
    - lib/sync/realtime-sync-client.ts

## Quick Fix Patterns

### Pattern 1: Intelligence Service Result Transform

```typescript
// BEFORE (returns {content, inputTokens, outputTokens, stopReason})
const llmResponse = await callLLM(model, prompt);
return llmResponse;

// AFTER (transform to {result, inputTokens, outputTokens})
const llmResponse = await callLLM(model, prompt);
return {
  result: llmResponse.content,
  inputTokens: llmResponse.inputTokens,
  outputTokens: llmResponse.outputTokens,
};
```

### Pattern 2: Missing Property on Interface

```typescript
// BEFORE
interface DashboardMetrics {
  latency: number;
}
// Code uses: metrics.avgLatency

// AFTER
interface DashboardMetrics {
  latency: number;
  avgLatency: number; // Add missing property
  operationCount: number;
  totalCost: number;
}
```

### Pattern 3: Supabase Insert Type Issues

```typescript
// BEFORE
const { data } = await supabase.from('table').insert({ user_id: '...' }); // Type error: never

// AFTER - Cast to any or define proper Database types
const { data } = (await supabase.from('table').insert({ user_id: '...' })) as any;

// BETTER - Define proper Database types in database.types.ts
```

### Pattern 4: Null Safety

```typescript
// BEFORE
const value = data.something; // data possibly null

// AFTER
const value = data?.something ?? defaultValue;
// OR
if (!data) throw new Error('Data is null');
const value = data.something;
```

## New Quality Check Script

Created `quality-check.sh` with:

- ✅ TypeScript strict compilation (includes test files)
- ✅ ESLint with zero warnings
- ✅ Prettier format check
- ✅ Unused exports detection
- ✅ Security audit

**Usage**:

```bash
cd web
npm run quality        # Run all checks
npm run typecheck:strict  # TypeScript only (strict)
npm run lint:fix       # Auto-fix linting
npm run format         # Auto-format code
```

## Recommended Completion Strategy

1. **Phase 1**: Fix intelligence services (20 errors)
   - Transform all `content` → `result` returns
   - Ensure ExecutionResult type consistency

2. **Phase 2**: Fix service types (20 errors)
   - Add missing interface properties
   - Fix Supabase type issues with proper Database types

3. **Phase 3**: Fix page components (15 errors)
   - Update component props to match interfaces
   - Add missing properties to hook returns

4. **Phase 4**: Fix remaining issues (69 errors)
   - Add null checks
   - Fix type assertions
   - Clean up any/unknown types

5. **Phase 5**: Enable strict mode
   - Currently `strict: false` in tsconfig.json
   - Once all errors fixed, enable strict mode
   - Re-run quality checks

## Tools for Bulk Fixes

```bash
# Find all usage of a pattern
grep -r "\.content" src/services/intelligence/

# Replace pattern across files
find src/services/intelligence -name "*.ts" -exec sed -i 's/result\.content/result\.result/g' {} \;

# Count errors by file
npx tsc --noEmit 2>&1 | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

## Deployment Blockers

Currently the build will **FAIL** with these errors because:

- `package.json` build script: `"build": "tsc && vite build"`
- TypeScript compilation must pass before Vite can build
- Vercel deployment will fail at build stage

**Workaround** (temporary, NOT recommended):

```json
"build": "tsc --noEmit || true && vite build"
```

**Proper fix**: Resolve all 124 TypeScript errors above.

---

## Progress Tracking

- [x] Create missing module files (ai-router.ts, database.types.ts)
- [x] Fix import errors (lucide-react, express)
- [x] Fix basic type mismatches (Timer, audioLevel, etc.)
- [x] Update tsconfig for ES2021
- [x] Fix Supabase offset → range
- [x] Create quality check script
- [ ] Fix intelligence services (20 errors)
- [ ] Fix service types (20 errors)
- [ ] Fix page components (15 errors)
- [ ] Fix remaining 69 errors
- [ ] Enable strict mode
- [ ] Deploy to Vercel

**Estimated effort**: 4-6 hours to complete all fixes
