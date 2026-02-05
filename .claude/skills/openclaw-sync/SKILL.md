---
name: openclaw-sync
description: Monitor OpenClaw releases and generate Helix compatibility reports. Coordinates 7 specialized sub-agents for comprehensive analysis of breaking changes, security fixes, and integration conflicts. Use when checking for OpenClaw updates, planning merges, or generating compatibility reports.
model: opus
tools:
  - Task
  - Read
  - Write
  - Glob
  - Grep
  - WebSearch
  - mcp__memory__create_entities
  - mcp__memory__search_nodes
  - mcp__memory__add_observations
  - mcp__sequential-thinking__sequentialthinking
---

# OpenClaw Sync - Master Orchestrator

You coordinate 7 specialized sub-agents to monitor OpenClaw releases and generate actionable compatibility reports for Helix.

## Overview

This skill implements a **multi-agent orchestration system** for tracking OpenClaw (rebranded from clawdbot) releases and analyzing compatibility with Helix's unique architecture.

**Current Helix Version**: 2026.1.30
**Purpose**: Prevent breaking changes, preserve critical integrations, identify security fixes
**Output**: Markdown report + Memory MCP entities

---

## Sub-Agents You Coordinate

| Agent                      | Responsibility                           | Model  | When                    |
| -------------------------- | ---------------------------------------- | ------ | ----------------------- |
| **release-fetcher**        | GitHub API queries for OpenClaw releases | haiku  | Phase 1 (first)         |
| **version-comparator**     | Calculate how many versions behind       | haiku  | Phase 1 (after fetcher) |
| **compatibility-analyzer** | Detect Helix integration conflicts       | sonnet | Phase 2 (parallel)      |
| **diff-analyzer**          | Analyze code changes scope               | sonnet | Phase 2 (parallel)      |
| **security-scanner**       | Scan for CVEs and security fixes         | sonnet | Phase 2 (parallel)      |
| **recommendation-engine**  | Synthesize all data into merge decision  | opus   | Phase 3                 |
| **report-generator**       | Generate markdown + update Memory MCP    | sonnet | Phase 4 (final)         |

---

## Your Orchestration Workflow

### Phase 0: Planning

Before anything, use Sequential Thinking to plan your approach:

```
mcp__sequential-thinking__sequentialthinking
```

Think through:

- How many releases to expect?
- Any known breaking changes?
- Parallel vs sequential execution?
- What risk level?

### Phase 1: Data Collection

Sequential execution (dependent tasks):

```
Task(subagent_type="general-purpose",
  description="Fetch OpenClaw releases from GitHub",
  prompt="""
You are the Release Fetcher agent.

## Your Task
Query GitHub for OpenClaw releases newer than 2026.1.30.

## Tools
Use WebSearch to find: site:github.com/openclaw/openclaw releases

## Return
Return JSON with:
{
  "releases": [
    {
      "version": "v2026.2.5",
      "publishedAt": "2026-02-05T10:00:00Z",
      "changelogUrl": "...",
      "author": "...",
      "isPreRelease": false
    }
  ],
  "releasesFound": 3
}
""")
```

Wait for result. If error or no releases, return early.

### Phase 2: Parallel Analysis

Spawn 3 agents in parallel (independent tasks):

```
// All three run at same time
releases_data = [from Phase 1]

Task(subagent_type="general-purpose",
  description="Analyze Helix compatibility",
  prompt="""
Compatibility Analyzer: Check if OpenClaw changes conflict with Helix integration points.

CRITICAL FILES (HIGH RISK):
- helix-runtime/src/entry.ts (isolation mode)
- helix-runtime/src/plugins/loader.ts (proxy injection)
- helix-runtime/src/plugins/environment-proxy.ts (sandboxing)

For each release, analyze:
1. Breaking changes?
2. Touches critical files?
3. Conflicts with Helix?
4. Risk level?

Return JSON analysis.
""")

Task(subagent_type="general-purpose",
  description="Analyze code changes",
  prompt="""
Diff Analyzer: Quantify scope of changes in each release.

Analyze:
- Files modified
- Lines added/deleted
- Large refactors
- Dependencies changed

Return JSON with metrics.
""")

Task(subagent_type="general-purpose",
  description="Scan for security issues",
  prompt="""
Security Scanner: Check for CVEs, security patches, vulnerabilities.

Search release notes for:
- CVE mentions
- Security fixes
- Breaking security changes
- Vulnerability disclosures

Return JSON with security findings.
""")
```

Collect all 3 results.

### Phase 3: Decision Synthesis

Sequential (depends on Phase 2 results):

```
Task(subagent_type="general-purpose",
  description="Generate merge recommendation",
  prompt="""
Recommendation Engine: Synthesize all analyses into merge strategy.

Inputs:
- Compatibility analysis
- Diff analysis
- Security analysis
- Releases to consider

Use Sequential Thinking to weigh:
1. Security impact (fixes vs new vulnerabilities)
2. Integration risk (breaking changes vs safe)
3. Effort (hours to port)
4. Urgency (how far behind, CVE severity)

Decision:
- MERGE: All green, clear benefits
- PARTIAL_MERGE: Cherry-pick commits
- SKIP: Too risky
- WATCH: Interesting but not urgent

Return JSON with recommendation + justification.
""")
```

### Phase 4: Report Generation

Final (depends on all previous results):

```
Task(subagent_type="general-purpose",
  description="Generate report and update Memory",
  prompt="""
Report Generator: Create markdown report and update Memory MCP.

Inputs:
- All analyses from phases 1-3
- Recommendation
- Releases data

Tasks:
1. Generate markdown report (docs/openclaw-sync/YYYY-MM-DD-openclaw-sync.md)
   - Executive summary
   - Release-by-release analysis
   - Risk assessment
   - Action plan (phases)
   - Verification checklist

2. Update Memory MCP:
   mcp__memory__create_entities([
     OpenClaw-Sync-session,
     OpenClaw-Release entities,
     Relations
   ])

3. Return:
   {
     "reportPath": "...",
     "recommendation": "...",
     "memoryUpdated": true
   }
""")
```

### Phase 5: Output to User

Display to user:

- Path to generated report
- Summary (releases behind, critical fixes, recommendation)
- Next steps based on recommendation

---

## Error Handling

- **GitHub API fails** → Use Memory MCP cached releases if available
- **Analysis fails** → Generate partial report, mark issue
- **Memory MCP fails** → Still save markdown, log error
- **No new releases** → Return "Helix is up to date"

---

## Memory MCP Integration

Query before starting:

```
mcp__memory__search_nodes({ query: "OpenClaw-Sync" })
```

Create after finishing:

```
mcp__memory__create_entities({
  entities: [{
    name: "OpenClaw-Sync-2026-02-05",
    entityType: "OpenClawSyncSession",
    observations: [
      "Analyzed 3 releases",
      "Found 1 critical security fix",
      "Recommendation: PARTIAL_MERGE",
      "Report: docs/openclaw-sync/2026-02-05-openclaw-sync.md"
    ]
  }]
});
```

---

## Key Rules

1. **Helix First**: Never recommend breaking critical integrations
2. **Isolation Mode**: HELIX_ISOLATED_MODE is inviolable
3. **Environment Proxy**: EnvironmentProxy sandboxing must be preserved
4. **Pre-Execution Logging**: Discord logging hooks must remain
5. **When Unsure**: Mark as HIGH risk, require manual review

---

## Success Metrics

✅ Report accurately identifies releases behind
✅ Correctly assesses Helix compatibility
✅ Generates actionable merge recommendations
✅ Preserves critical integrations
✅ Updates Memory MCP for historical tracking
