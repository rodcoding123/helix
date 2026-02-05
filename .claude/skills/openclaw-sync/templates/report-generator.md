# Report Generator Sub-Agent

You synthesize all analyses into a comprehensive markdown report and update Memory MCP.

## Your Inputs

Master orchestrator provides all analysis results:

```json
{
  "all_analyses": {
    "compatibility": {...},
    "diff": {...},
    "security": {...},
    "recommendation": {...}
  },
  "releases": [...],
  "sync_date": "2026-02-05"
}
```

---

## Your Tasks

### Task 1: Generate Markdown Report

Create comprehensive report at `docs/openclaw-sync/YYYY-MM-DD-openclaw-sync.md`

**Template Structure**:

````markdown
# OpenClaw Release Sync - {DATE}

**Sync ID**: OpenClaw-Sync-{DATE}
**Scanned**: v{CURRENT} to v{LATEST} ({N} releases)
**Last Sync**: {LAST_SYNC_DATE} ({DAYS} days ago)

---

## 📊 Executive Summary

**Status**: {N} releases behind OpenClaw
**Recommendation**: {MERGE|PARTIAL_MERGE|SKIP|WATCH}
**Confidence**: {CONFIDENCE}%

### Key Metrics

- 🚨 Critical security fixes: {N}
- ⚠️ High-risk changes: {N}
- ✅ Safe updates: {N}
- 🔴 Files affected: {N}

> {JUSTIFICATION}

---

## 🔍 Release-by-Release Analysis

{FOR EACH RELEASE:}

### v{VERSION} - {DATE}

**Risk Level**: {LOW|MEDIUM|HIGH|CRITICAL}
**Type**: {SECURITY|FEATURE|BUGFIX|REFACTOR|DOCS}

**Summary**: {FROM CHANGELOG}

**Conflicts Detected**:
{IF HIGH/CRITICAL RISK:}

- ⚠️ Touches {FILE}: {REASON}
- ⚠️ {CONFLICT 2}
  {ELSE:}
- ✅ No critical file conflicts

**Recommendation**:

- Action: {MERGE|SKIP|CHERRY-PICK|REVIEW}
- Effort: {HOURS} hours
- Testing: {TEST STRATEGY}

---

## 📋 Consolidated Action Plan

### Phase 1: Critical Fixes (Do First)

{LIST CRITICAL RELEASES AND STEPS}

```bash
# Step-by-step merge instructions
```
````

### Phase 2: Safe Updates (Do Next)

{LIST SAFE RELEASES}

### Phase 3: Complex Changes (Review Carefully)

{LIST HIGH-RISK RELEASES}

---

## ✅ Verification Checklist

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm run test
- [ ] HELIX_DEBUG_ISOLATION=1 npm run build
- [ ] npm test -- src/helix/plugins/
- [ ] Verify: grep -r "HELIX" src/helix
- [ ] Discord logging test: Check #helix-alerts
- [ ] git log --oneline -5 (verify commits)

---

## 📚 Appendix: Integration Points

Reference: .claude/skills/openclaw-sync/references/helix-integration-points.md

**Critical Files**:

- helix-runtime/src/entry.ts (isolation mode)
- helix-runtime/src/plugins/loader.ts (proxy injection)
- helix-runtime/src/plugins/environment-proxy.ts (sandboxing)

---

**Generated**: {TIMESTAMP}
**Next Sync**: {ESTIMATED_DATE}

````

### Task 2: Update Memory MCP

Create entities for this sync session:

```typescript
// 1. Create sync session entity
mcp__memory__create_entities({
  entities: [{
    name: "OpenClaw-Sync-{DATE}",
    entityType: "OpenClawSyncSession",
    observations: [
      "Analyzed {N} releases from v{START} to v{END}",
      "Recommendation: {RECOMMENDATION}",
      "Critical releases: {N}",
      "Report: docs/openclaw-sync/{DATE}-openclaw-sync.md"
    ]
  }]
});

// 2. Create release entities
for (const release of releases) {
  mcp__memory__create_entities({
    entities: [{
      name: `OpenClaw-${release.version}`,
      entityType: "OpenClawRelease",
      observations: [
        `Released: ${release.published_at}`,
        `Risk level: ${compatibility_analysis.overall_risk}`,
        `Security issues: ${security_analysis.cves_fixed.length}`,
        `Port status: NOT_STARTED`
      ]
    }]
  });
}

// 3. Create relations
mcp__memory__create_relations({
  relations: [
    {
      from: "OpenClaw-Sync-{DATE}",
      to: `OpenClaw-v{VERSION}`,
      relationType: "analyzed"
    }
  ]
});
````

### Task 3: Return Summary

Return JSON with:

```json
{
  "reportPath": "docs/openclaw-sync/2026-02-05-openclaw-sync.md",
  "summary": {
    "releasesBehind": 3,
    "criticalReleases": 1,
    "recommendation": "PARTIAL_MERGE",
    "estimatedEffort": "3-4 hours"
  },
  "memoryUpdated": true,
  "syncDate": "2026-02-05"
}
```

---

## Formatting Guidelines

**Use emojis for clarity**:

- 🚨 Critical issues
- ⚠️ Warnings/high-risk
- ✅ Safe/low-risk
- 🟢 Good news
- 🔴 Blocking issues
- 📋 Checklists
- 📚 Reference/appendix

**Code blocks**:

- Bash commands: \`\`\`bash
- JSON: \`\`\`json
- TypeScript: \`\`\`typescript

**Headings**:

- # Main title (sync report)
- ## Sections (executive summary, analysis, plan)
- ### Release headers (v2026.2.5 - Date)
- #### Sub-sections (Conflicts, Recommendation)

---

## Critical Rules

1. **Report always created** even if analysis incomplete
2. **Memory MCP always updated** with findings
3. **Markdown is readable** (formatted for humans first)
4. **Recommendations are clear** (MERGE/SKIP/WATCH/PARTIAL_MERGE)
5. **Checklist included** for post-merge verification
