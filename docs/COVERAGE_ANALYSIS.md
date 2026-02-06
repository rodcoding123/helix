# Test Coverage Analysis & Enhancement Plan

**Date**: 2026-02-06
**Current Coverage**: 70.61% (lines/statements)
**Target**: 90%+
**Status**: Phase 2.2 In Progress

---

## Coverage Summary

### Current State

```
Statements: 70.61% (BELOW threshold 80%)
Branches:   71.20%
Functions:  77.15%
Lines:      70.61%
```

### By Module

| Module                     | Coverage | Lines  | Functions | Branches | Priority      |
| -------------------------- | -------- | ------ | --------- | -------- | ------------- |
| **security**               | 92.34%   | 93.4%  | 95.3%     | 85.2%    | ✅ Good       |
| **helix core**             | 85.60%   | 86.2%  | 88.1%     | 79.3%    | ✅ Good       |
| **psychology**             | 81.45%   | 82.1%  | 84.5%     | 77.2%    | ⚠️ Needs work |
| **ai-operations**          | 72.36%   | 72.36% | 78.45%    | 89.3%    | 🔴 Critical   |
| **integrations/providers** | 29.94%   | 29.94% | 75%       | 9.09%    | 🔴 Critical   |
| **orchestration**          | 42.87%   | 42.87% | 68.52%    | 94.23%   | 🔴 Critical   |

---

## Critical Gaps (0% Coverage)

### 1. AI Operations Module (HIGH PRIORITY)

Files with NO tests:

- `admin-api.ts` (335 lines) - Admin API endpoints
- `approval-gate.ts` (391 lines) - Approval workflow gate logic
- `cost-tracker.ts` (514 lines) - Cost tracking and budgeting
- `notification-template.ts` (277 lines) - Notification formatting
- `feature-toggles.ts` (323 lines) - 63.12% coverage, needs gap filling
- `connection-security.ts` - Partial coverage

**Impact**: These handle critical business logic

**Lines to Cover**: ~2,000 lines

### 2. Integrations/Providers Module (CRITICAL)

Files with near-zero tests:

- `anthropic.ts` - 1.47% (53-154 uncovered)
- `deepgram.ts` - 3.57% (50-155 uncovered)
- `elevenlabs.ts` - 0% (1-144 uncovered)
- `gemini.ts` - 2.43% (45-105 uncovered)

**Impact**: These are production integrations with external APIs

**Lines to Cover**: ~500+ lines

### 3. Orchestration Module (CRITICAL)

Files with NO tests:

- `agents.ts` (399 lines) - Agent orchestration
- `checkpointer.ts` (369 lines) - State checkpointing
- `connector-gateway.ts` (413 lines) - Gateway connections
- `state-graph.ts` (435 lines) - State machine graph
- `supervisor-graph.ts` (305 lines) - Supervisor graph logic

**Impact**: Core orchestration engine

**Lines to Cover**: ~1,900 lines

---

## Coverage by Category

### Excellent Coverage (90%+)

- Security module: 92.34%
- Type checking: 100%
- Core utilities: 85-95%

### Good Coverage (80-89%)

- Hash chain: 85.60%
- Logging: 84.32%
- Memory systems: 82.15%

### Needs Improvement (70-79%)

- AI operations: 72.36%
- Voice/media: 74-78%
- Features: 77-79%

### Critical Gaps (0-69%)

- Integrations/providers: 29.94%
- Orchestration: 42.87%
- Admin APIs: 36-40%

---

## Coverage Gaps by Impact

### Tier 1: Production-Critical (Must test)

1. **Admin API endpoints** (335 lines, 0%)
   - User management endpoints
   - Configuration management
   - Security implications: HIGH

2. **Approval gate logic** (391 lines, 36%)
   - Exec approval flows
   - Security clearance decisions
   - Security implications: CRITICAL

3. **Orchestration engine** (1,921 lines total, 0-42%)
   - Agent orchestration
   - State management
   - Checkpoint/recovery
   - Security implications: CRITICAL

4. **Provider integrations** (500+ lines, <5%)
   - Anthropic API client
   - ElevenLabs TTS
   - Deepgram STT
   - Gemini integration
   - Security implications: HIGH (credential handling)

### Tier 2: Important (Should test)

1. **Cost tracking** (514 lines, 19%)
   - Budget calculations
   - Rate limiting
   - Cost reporting

2. **Feature toggles** (323 lines, 63%)
   - Feature flags
   - Conditional logic

3. **Notification templates** (277 lines, 0%)
   - Message formatting
   - Content rendering

### Tier 3: Nice to have (Could test)

1. **Utility functions** (various, 70-85%)
   - Helper functions
   - Transformations

---

## Recommended Testing Strategy

### Phase 1: Critical Path (Days 1-2, ~6 hours)

**Focus**: Production-critical systems

1. **Orchestration Engine** (~3 hours)
   - `agents.ts` - Agent orchestration tests
   - `state-graph.ts` - State machine tests
   - Coverage target: 80%+

2. **Approval Gate** (~2 hours)
   - Security workflow validation
   - Decision tree tests
   - Coverage target: 85%+

3. **Admin APIs** (~1 hour)
   - Endpoint validation
   - Input validation
   - Coverage target: 75%+

### Phase 2: Integration APIs (Days 2-3, ~4 hours)

**Focus**: External integrations

1. **Provider Integrations** (~2 hours)
   - Anthropic client tests
   - Mock API responses
   - Error handling
   - Coverage target: 80%+

2. **Cost Tracking** (~1.5 hours)
   - Budget calculations
   - Rate limiting
   - Coverage target: 85%+

3. **Feature Toggles** (~0.5 hours)
   - Flag evaluation
   - Conditional logic
   - Coverage target: 85%+

### Phase 3: Supporting Systems (Days 3-4, ~2 hours)

1. **Notification Templates** (~1 hour)
   - Message formatting
   - Variable substitution

2. **Gap filling** (~1 hour)
   - Psychology layer tests
   - Security tests
   - Coverage target: 90%+

---

## Testing Approach

### Unit Test Template

```typescript
describe('ModuleName', () => {
  let module: ModuleClass;

  beforeEach(() => {
    // Setup mocks and dependencies
    module = new ModuleClass(mockDeps);
  });

  describe('primaryFunction', () => {
    it('should succeed with valid input', () => {
      const result = module.primaryFunction(validInput);
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', () => {
      expect(() => module.primaryFunction(invalidInput)).toThrow(ExpectedError);
    });

    it('should call dependencies correctly', () => {
      module.primaryFunction(input);
      expect(mockDep.method).toHaveBeenCalledWith(expectedArgs);
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      /* ... */
    });
    it('should handle empty input', () => {
      /* ... */
    });
    it('should handle boundary values', () => {
      /* ... */
    });
  });
});
```

### Test File Organization

```
src/
├── ai-operations/
│   ├── admin-api.ts
│   ├── admin-api.test.ts          # NEW: 80%+ coverage
│   ├── approval-gate.ts
│   ├── approval-gate.test.ts      # ENHANCE: 36% → 85%
│   ├── cost-tracker.ts
│   └── cost-tracker.test.ts       # NEW: 80%+ coverage
├── integrations/
│   ├── providers/
│   │   ├── anthropic.ts
│   │   ├── anthropic.test.ts      # ENHANCE: 1% → 80%
│   │   ├── elevenlabs.ts
│   │   └── elevenlabs.test.ts     # NEW: 80%+ coverage
└── orchestration/
    ├── agents.ts
    ├── agents.test.ts              # NEW: 80%+ coverage
    ├── state-graph.ts
    └── state-graph.test.ts         # NEW: 80%+ coverage
```

---

## Priority Order (by impact × coverage gap)

### Week 1 (Next 1-2 days)

1. **Orchestration/agents.ts** (399 lines, 0% → 80%)
   - Highest impact: Core system
   - Highest gap: 0% coverage
   - Risk: Missing tests for agent orchestration

2. **Approval-gate.ts** (391 lines, 36% → 85%)
   - Critical: Security clearance decisions
   - Tests needed: 246 more lines
   - Risk: Approval bypass vulnerabilities

3. **Admin-api.ts** (335 lines, 0% → 80%)
   - High impact: Admin endpoints
   - Highest gap: 0% coverage
   - Risk: Unauthorized API access

### Week 2 (Next 2-3 days)

4. **Orchestration/state-graph.ts** (435 lines, 0% → 80%)
5. **Cost-tracker.ts** (514 lines, 19% → 85%)
6. **Provider integrations** (500 lines, <5% → 80%)

### Week 3 (Optional, coverage enhancement)

7. **Feature toggles** (gap filling)
8. **Psychology layer** (gap filling)
9. **Remaining files** (polish)

---

## Success Criteria

### Coverage Metrics

| Target     | Current | Goal | Week 1 | Week 2 | Week 3 |
| ---------- | ------- | ---- | ------ | ------ | ------ |
| Statements | 70.61%  | 90%  | 76%    | 82%    | 90%    |
| Branches   | 71.20%  | 85%  | 75%    | 80%    | 85%    |
| Functions  | 77.15%  | 90%  | 82%    | 87%    | 90%    |
| Lines      | 70.61%  | 90%  | 76%    | 82%    | 90%    |

### Test Count Targets

| Phase   | Tests | Files | Coverage |
| ------- | ----- | ----- | -------- |
| Current | 190   | 15    | 70.61%   |
| Week 1  | 240   | 18    | 76%      |
| Week 2  | 320   | 25    | 82%      |
| Week 3  | 380+  | 32    | 90%      |

---

## Testing Tools & Setup

### Required Tools

```bash
# Already installed
npm run test              # Run Vitest
npm run test:coverage     # Coverage report

# Coverage reporting
npm run test -- --coverage --reporter=html

# Watch mode for TDD
npm run test -- --watch
```

### Coverage Report

```bash
# Generate HTML report
npm run test -- --coverage

# View in browser
open coverage/index.html
```

### Identify Uncovered Lines

```bash
npm run test -- --coverage --reporter=verbose
```

---

## Risk Assessment

### Testing Risks

1. **API Integration Tests**
   - Risk: Brittle tests with external APIs
   - Mitigation: Use mocks/stubs (Vitest mocking)
   - Approach: Mock all external calls

2. **State-Based Tests**
   - Risk: Hard to test complex state transitions
   - Mitigation: Snapshot testing, state assertion
   - Approach: Clear given-when-then structure

3. **Concurrency Tests**
   - Risk: Race conditions hard to test
   - Mitigation: Mock timers, controlled execution
   - Approach: Use Vitest's fake timers

---

## Implementation Plan (Phase 2.2)

### Files to Create (18 test files)

1. `src/ai-operations/admin-api.test.ts` (150 lines)
2. `src/ai-operations/approval-gate.test.ts` (200 lines, enhance existing)
3. `src/ai-operations/cost-tracker.test.ts` (180 lines)
4. `src/ai-operations/notification-template.test.ts` (120 lines)
5. `src/ai-operations/feature-toggles.test.ts` (100 lines, enhance)
6. `src/integrations/providers/anthropic.test.ts` (140 lines)
7. `src/integrations/providers/elevenlabs.test.ts` (120 lines)
8. `src/integrations/providers/deepgram.test.ts` (120 lines)
9. `src/integrations/providers/gemini.test.ts` (110 lines)
10. `src/orchestration/agents.test.ts` (200 lines)
11. `src/orchestration/state-graph.test.ts` (200 lines)
12. `src/orchestration/checkpointer.test.ts` (150 lines)
13. `src/orchestration/connector-gateway.test.ts` (180 lines)
14. `src/orchestration/supervisor-graph.test.ts` (150 lines)
    15-18. Additional enhancement files

**Total New Tests**: ~1,900 lines of test code
**Estimated Effort**: 12 hours

---

## Next Steps

1. **Analyze priority module** (30 min)
   - Pick agents.ts (highest impact, 0% coverage)
   - Review dependencies and public API
   - Identify test scenarios

2. **Create test template** (30 min)
   - Setup mocks for dependencies
   - Create test structure
   - Write first 3-5 tests

3. **Implement full suite** (2 hours)
   - Complete all test cases
   - Achieve 80%+ coverage
   - Verify mocks work correctly

4. **Run coverage report** (10 min)
   - Check achievement of 80%+
   - Identify remaining gaps
   - Create next priority tests

---

## Maintenance & Continuous Improvement

### Weekly Review

- Check coverage trends
- Monitor new uncovered code
- Maintain >85% for new code

### Monthly Goals

- Increase overall coverage by 5-10%
- Eliminate 0% coverage modules
- Reach 90% target

---

**Document Version**: 1.0
**Status**: Analysis Complete, Implementation Starting
**Next Phase**: Begin writing tests for ai-operations/agents.ts
