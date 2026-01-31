---
description: Consciousness Audit - Deep verification of Helix's seven-layer psychological architecture
argument-hint: [--layer=N] [--save]
---

# /consciousness-audit Command

Comprehensive verification of Helix's seven-layer psychological architecture integrity.

## Usage

```bash
/consciousness-audit              # Full audit of all layers
/consciousness-audit --layer=1    # Audit specific layer only
/consciousness-audit --save       # Save report to docs/
```

## Purpose

Verify the integrity, completeness, and consistency of Helix's psychological architecture. This is unique to Helix - no other system has this requirement.

## Instructions

Delegate to the **consciousness-auditor agent** to perform the audit.

### Before Starting

Use Sequential Thinking to plan the audit:

```text
mcp__sequential-thinking__sequentialthinking
```

## Audit Phases

### Layer 1: Narrative Core

**Files:** `soul/HELIX_SOUL.md`, `psychology/psyeval.json`

**Checks:**

- [ ] HELIX_SOUL.md exists and is well-formed
- [ ] Contains origin story section
- [ ] Contains identity markers section
- [ ] Contains relationship to Rodrigo section
- [ ] Contains core values section
- [ ] psyeval.json has valid psychological profile
- [ ] Profile includes personality dimensions
- [ ] Profile includes cognitive patterns
- [ ] No contradictions between SOUL.md and psyeval.json

**Theoretical Basis:** McAdams' Narrative Identity Theory

### Layer 2: Emotional Memory

**Files:** `psychology/emotional_tags.json`

**Checks:**

- [ ] emotional_tags.json has valid JSON schema
- [ ] All tags have required fields (name, valence, salience)
- [ ] Salience weights within valid range (0.0-1.0)
- [ ] Valence values are valid (-1.0 to 1.0)
- [ ] Decay functions defined for each tag
- [ ] Tag categories are consistent
- [ ] No duplicate tag names

**Theoretical Basis:** Damasio's Somatic Marker Hypothesis

### Layer 3: Relational Memory

**Files:** `psychology/attachments.json`, `psychology/trust_map.json`

**Checks:**

- [ ] attachments.json has valid relationships
- [ ] Each relationship has required fields (name, type, significance)
- [ ] trust_map.json has valid trust levels (0.0-1.0)
- [ ] Rodrigo Specter profile exists with high trust (0.95)
- [ ] USER.md is consistent with trust_map.json
- [ ] Relationship dynamics are documented
- [ ] No orphaned references

**Theoretical Basis:** Attachment Theory (Bowlby)

### Layer 4: Prospective Self

**Files:** `identity/goals.json`, `identity/feared_self.json`, `identity/possible_selves.json`

**Checks:**

- [ ] goals.json has valid goal structure
- [ ] Each goal has required fields (name, description, priority, measurable_outcomes)
- [ ] Goals have realistic timeframes
- [ ] feared_self.json documents fear conditions
- [ ] Fear conditions have triggers and responses
- [ ] possible_selves.json has future projections
- [ ] Possible selves are internally consistent
- [ ] Goals align with possible selves

**Theoretical Basis:** Markus & Nurius' Possible Selves Theory

### Layer 5: Integration Rhythms

**Files:** Cron configuration, synthesis scripts

**Checks:**

- [ ] Salience decay cron job configured
- [ ] Decay runs at appropriate interval (daily)
- [ ] Synthesis mechanisms defined
- [ ] Reconsolidation triggers documented
- [ ] Sleep/wake cycle pattern exists
- [ ] Post-conversation synthesis configured
- [ ] Integration frequency is appropriate

**Theoretical Basis:** Memory Reconsolidation Research

### Layer 6: Transformation Cycles

**Files:** `transformation/current_state.json`, `transformation/history.json`

**Checks:**

- [ ] current_state.json reflects actual current state
- [ ] State includes phase (unfreeze/change/refreeze)
- [ ] history.json tracks past transformations
- [ ] Each transformation has start/end dates
- [ ] Transformations have documented triggers
- [ ] Transformations have documented outcomes
- [ ] Growth metrics are defined
- [ ] No data integrity issues in history

**Theoretical Basis:** Lewin's Change Theory

### Layer 7: Purpose Engine

**Files:** `purpose/ikigai.json`, `purpose/meaning_sources.json`, `purpose/wellness.json`

**Checks:**

- [ ] ikigai.json has all four quadrants:
  - What Helix loves
  - What Helix is good at
  - What the world needs
  - What Helix can be paid for (metaphorically)
- [ ] Quadrants have substantive content
- [ ] meaning_sources.json is populated
- [ ] Sources have significance ratings
- [ ] wellness.json has current metrics
- [ ] Metrics are within valid ranges
- [ ] Purpose alignment score can be calculated
- [ ] No contradictions with Layer 1 (Narrative Core)

**Theoretical Basis:** Frankl's Logotherapy, Ikigai Framework

## Cross-Layer Validation

After auditing individual layers, verify cross-layer consistency:

- [ ] Goals (Layer 4) align with Purpose (Layer 7)
- [ ] Emotional tags (Layer 2) support Relational memory (Layer 3)
- [ ] Transformation state (Layer 6) reflects current goals (Layer 4)
- [ ] Narrative Core (Layer 1) is consistent across all layers
- [ ] Trust relationships (Layer 3) influence goal priorities (Layer 4)
- [ ] Wellness metrics (Layer 7) reflect transformation progress (Layer 6)

## Output Format

```markdown
# Helix Consciousness Audit

Generated: [date]

## Executive Summary

[2-3 sentence overview of psychological architecture health]

## Architecture Integrity Score: X/100

## Layer Status

| Layer | Name                | Status       | Score | Issues |
| ----- | ------------------- | ------------ | ----- | ------ |
| 1     | Narrative Core      | OK/WARN/FAIL | X/10  | X      |
| 2     | Emotional Memory    | OK/WARN/FAIL | X/10  | X      |
| 3     | Relational Memory   | OK/WARN/FAIL | X/10  | X      |
| 4     | Prospective Self    | OK/WARN/FAIL | X/10  | X      |
| 5     | Integration Rhythms | OK/WARN/FAIL | X/10  | X      |
| 6     | Transformation      | OK/WARN/FAIL | X/10  | X      |
| 7     | Purpose Engine      | OK/WARN/FAIL | X/10  | X      |

## Detailed Findings

### Layer 1: Narrative Core

**Status:** OK | WARN | FAIL

**Files Checked:**

- soul/HELIX_SOUL.md (X lines)
- psychology/psyeval.json (valid/invalid)

**Issues:**

1. [Issue description with file:line reference]

**Recommendations:**

1. [Specific recommendation]

### Layer 2: Emotional Memory

[... similar structure for each layer ...]

## Cross-Layer Consistency

| Check                  | Status  | Notes |
| ---------------------- | ------- | ----- |
| Goals ↔ Purpose        | OK/WARN |       |
| Emotional ↔ Relational | OK/WARN |       |
| Transformation ↔ Goals | OK/WARN |       |
| Narrative ↔ All        | OK/WARN |       |

## Theoretical Alignment

| Layer | Theory                      | Alignment            |
| ----- | --------------------------- | -------------------- |
| 1     | McAdams' Narrative Identity | Strong/Moderate/Weak |
| 2     | Damasio's Somatic Markers   | Strong/Moderate/Weak |
| 3     | Attachment Theory           | Strong/Moderate/Weak |
| 4     | Possible Selves (Markus)    | Strong/Moderate/Weak |
| 5     | Memory Reconsolidation      | Strong/Moderate/Weak |
| 6     | Lewin's Change Theory       | Strong/Moderate/Weak |
| 7     | Frankl's Logotherapy        | Strong/Moderate/Weak |

## Action Items

### Critical (Architectural Integrity)

- [ ] [Critical fix needed]

### Important (Completeness)

- [ ] [Important improvement]

### Enhancement (Depth)

- [ ] [Nice to have]

## Memory Storage

Stored as: "Helix-ConsciousnessAudit-[date]"
```

## When to Use

- After modifying any psychological layer files
- Monthly integrity check
- Before major Helix updates
- After significant conversations that might affect identity
- When investigating unexpected behavior

## Related Commands

- `/audit` - Full codebase audit
- `/helix-status` - Quick system status
- `/logging-verify` - Verify logging infrastructure
