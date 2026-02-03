# /docs/ Cleanup Checklist

## Status: IN PROGRESS

This document tracks the cleanup of all documentation files across the Helix project.

---

## PART 1: WEB DOCS

### `/web/docs/guides/` (DUPLICATES - DELETE)

These are now in the knowledge base. Safe to delete.

- [ ] `AGENT_TEMPLATES.md` - ❌ DUPLICATE (moved to knowledge-base)
- [ ] `CUSTOM_TOOLS.md` - ❌ DUPLICATE (moved to knowledge-base)
- [ ] `MARKETPLACE.md` - ❌ DUPLICATE (moved to knowledge-base)
- [ ] `MEMORY_SYNTHESIS.md` - ❌ DUPLICATE (moved to knowledge-base)
- [ ] `SKILL_COMPOSITION.md` - ❌ DUPLICATE (moved to knowledge-base)

**Action:** Delete entire `/web/docs/guides/` folder

### `/web/docs/knowledge-base/` (KEEP - PROTECTED)

New protected knowledge base. Keep as-is.

- [x] Verified and protected

---

## PART 2: DESKTOP DOCS

### `/helix-desktop/docs/`

- [ ] `SIGNING-SETUP.md` - ✓ KEEP (development docs, not user-facing)

---

## PART 3: ROOT DOCS - BLUEPRINTS

### `/docs/blueprints/`

Architecture and design documents. Most are important.

- [ ] `AXIS_BLUEPRINT_v1.md` - Review (v1 - check if v2 exists)
- [ ] `FRICTION-ANALYSIS.md` - Review (analysis document)
- [ ] `HELIX-FREEWILL-VISION.md` - ✓ KEEP (core vision)
- [ ] `HELIX-VISION-FINAL.md` - ✓ KEEP (final vision doc)
- [ ] `OPENCLAW-ANALYSIS.md` - ✓ KEEP (technical analysis)
- [ ] `PLATFORM-PARITY-MATRIX.md` - ✓ KEEP (development reference)
- [ ] `PRICING-COST-ANALYSIS.md` - ✓ KEEP (business reference)
- [ ] `PRODUCT-FEATURES.md` - ✓ KEEP (feature reference)
- [ ] `USER-SHOWCASE-ANALYSIS.md` - Review (analysis document)
- [ ] `WEB-MOBILE-STRATEGY.md` - ✓ KEEP (strategy document)
- [ ] `WEB-UNIQUE-FEATURES.md` - ✓ KEEP (feature reference)

---

## PART 4: ROOT DOCS - NEW BLUEPRINTS

### `/docs/newbp/`

Most are planning/implementation notes from development. Candidates for archiving.

- [ ] `ALL-PHASES-SUMMARY.md` - Review (summary document)
- [ ] `COST-ANALYSIS-DEEPSEEK-GEMINI.md` - Archive (outdated analysis)
- [ ] `DAY3-1PASSWORD-INTEGRATION-SUMMARY.md` - Archive (daily log)
- [ ] `ENGINEER-3-COMPLETION-REPORT.md` - Archive (completion report)
- [ ] `ENGINEER-3-FINAL-REPORT.md` - Archive (final report)
- [ ] `GROWTH-IMPROVEMENT-ROADMAP.md` - Review (roadmap)
- [ ] `IMPLEMENTATION-DECISION-CHECKLIST.md` - Archive (decision log)
- [ ] `IMPLEMENTATION-GAP-ANALYSIS.md` - Archive (analysis)
- [ ] `IMPLEMENTATION-READY-DEEPSEEK-GEMINI.md` - Archive (outdated)
- [ ] `IMPLEMENTATION-READY-SUMMARY.md` - Archive (summary)
- [ ] `MEMORY-DASHBOARD-IMPLEMENTATION.md` - Archive (implementation note)
- [ ] `PARALLEL-EXECUTION-ROADMAP.md` - Archive (roadmap)
- [ ] `PHASE-1-2-3-COMPLETE-BUILD.md` - Archive (build summary)
- [ ] `PHASE-1-COMPLETION-REPORT.md` - Archive (report)
- [ ] `PHASE-1-IMPLEMENTATION-SEQUENCE.md` - Archive (sequence)
- [ ] `PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md` - Archive (spec)
- [ ] `PHASE-1-TEST-RESULTS.md` - Archive (test results)
- [ ] `PHASE-2-3-UNIFIED-FREEWILL-ARCHITECTURE.md` - Archive (architecture)
- [ ] `PHASE-2-AGENT-CREATION-SPEC.md` - Archive (spec)
- [ ] `PHASE-3-AUTONOMY-FREEWILL-SPEC.md` - Archive (spec)
- [ ] `QUICK-REFERENCE-WEEK1.md` - Archive (weekly reference)
- [ ] `README-IMPLEMENTATION-PLAN.md` - Review (overview)
- [ ] `SECURITY_FIXES.md` - Archive (historical log)
- [ ] `SECURITY_IMPLEMENTATION_COMPLETE.md` - Archive (completion)
- [ ] `SECURITY-COMPLETION-SUMMARY.md` - Archive (summary)
- [ ] `SERVICES-1PASSWORD-MIGRATION.md` - Archive (migration note)
- [ ] `START-HERE-DEEPSEEK-GEMINI.md` - Archive (outdated)
- [ ] `STRATEGIC-RECOMMENDATIONS.md` - Archive (recommendations)
- [ ] `TECHNICAL-READINESS-ASSESSMENT.md` - Archive (assessment)
- [ ] `TODAY-BUILD-EVERYTHING.md` - Archive (daily log)
- [ ] `VALIDATION-BEFORE-SHIPPING.md` - Archive (validation)
- [ ] `WEEK-1-BUILD-COMPLETE.md` - Archive (weekly log)
- [ ] `WEEK-1-DAY-1-COMPLETION.md` - Archive (daily log)
- [ ] `WEEK-1-DAY-3-UPDATED-PLAN.md` - Archive (daily log)
- [ ] `WEEK-1-KICKOFF-PLAN.md` - Archive (kickoff)

---

## PART 5: ROOT DOCS - OTHER FILES

### Root Level Files

- [ ] `AXIS_BLUEPRINT_v1.md` - Archive (v1, check for v2)
- [ ] `1PASSWORD-CICD-SETUP.md` - ✓ KEEP (development reference)
- [ ] `DEPLOYMENT_WITH_1PASSWORD.md` - ✓ KEEP (deployment reference)
- [ ] `HELIX_AUTONOMOUS_BLUEPRINT.md` - ✓ KEEP (core blueprint)
- [ ] `HELIX_LOCAL_INTERFACE_BLUEPRINT.md` - ✓ KEEP (interface spec)
- [ ] `HELIX_OBSERVATORY_BLUEPRINT.md` - ✓ KEEP (observatory spec)
- [ ] `HELIX_OBSERVATORY_CODE_BLUEPRINT.md` - ✓ KEEP (code blueprint)
- [ ] `HELIX_TECHNICAL_SPEC.md` - ✓ KEEP (technical spec)
- [ ] `HELIX_WEBSITE_BRAND_TONE.md` - ✓ KEEP (brand guide)
- [ ] `LAYER5_CRON_SETUP.md` - ✓ KEEP (cron configuration)
- [ ] `LIVING_AI_ARCHITECTURE_v1.md` - ✓ KEEP (architecture)
- [ ] `MIGRATION_TO_1PASSWORD.md` - Archive (historical)

### Root `/docs/plans/` Files

- [ ] `2026-02-02-desktop-phase3-secrets-api.md` - ✓ KEEP (recent plan)
- [ ] `2026-02-02-per-user-secrets-architecture.md` - ✓ KEEP (recent plan)
- [ ] `2026-02-02-phase3-frontend-secrets-dashboard.md` - ✓ KEEP (recent plan)

---

## Summary

**Total Files Reviewed:** 67
**To Delete:** 5 (web/docs/guides duplicates)
**To Archive:** ~30 (old planning documents)
**To Keep:** ~32 (active development and architecture)

**Archive Destination:** Consider creating `/docs/archive/` or `/docs/historical/` for old planning documents

---

## Legend

- ✓ KEEP - Keep in current location
- ❌ DELETE - Remove completely (duplicates)
- Archive - Move to archive folder (historical/outdated)
- Review - Read file to determine action
