# HELIX AI OPERATIONS - ONE PAGE SUMMARY

## The Problem (Current)
- 10+ AI operations scattered across codebase
- Inconsistent model choices (Sonnet everywhere = expensive)
- Zero visibility into spending
- No centralized control
- Unpredictable costs

## The Solution (Proposed)

```
┌─────────────────────────────────────────────────────────────────┐
│                  ADMIN CONTROL PLANE (Web UI)                   │
│                                                                 │
│  Tier 1: Observability   Tier 2: Control       Tier 3: Helix   │
│  (View spend)            (Manual edits +       (Recommendations)│
│  (Monitor quality)       approval gates)       (Analysis only)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │  Unified AI Operations Router    │
              │  ├─ Config-driven               │
              │  ├─ Cost-aware routing          │
              │  ├─ Logging & tracking          │
              │  └─ Approval enforcement        │
              └────────────────┬────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
      ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
      │  DeepSeek    │  │ Gemini Flash │  │  Deepgram   │
      │   v3.2       │  │              │  │ + Edge-TTS  │
      │ $0.0027 in   │  │ $0.50 in     │  │   (FREE)    │
      │ $0.0108 out  │  │ $3.00 out    │  │             │
      └──────────────┘  └──────────────┘  └─────────────┘
```

## Model Routing (Smart & Cheap)

| Operation | Current | New | Savings | Why |
|-----------|---------|-----|---------|-----|
| Chat | Sonnet | DeepSeek | 99% | Just as good, 1/200th cost |
| Memory Synthesis | Sonnet $12.50/day | Gemini Flash | 95% | Routine analysis |
| Sentiment | Sonnet | Gemini Flash | 90% | Simple classification |
| TTS | ElevenLabs | Edge-TTS | 100% | Free alternatives exist |
| Audio Transcription | Multiple | Deepgram | No change | Already optimal |

**Total Monthly Savings: $350-400 (70% reduction)**

## The Three-Tier Admin Panel

### Tier 1: Observability (View-Only)
```
TODAY:  $8.43 / $50 daily budget
TREND:  $247/month (↓ 35% from optimization)
MODELS: DeepSeek (65%), Gemini (30%), Other (5%)
QUALITY: 0.91 avg
```

### Tier 2: Control (Approve Changes)
```
[ ] Switch memory synthesis: Gemini → DeepSeek
    └─ Savings: $358/month ✓
    └─ Quality: 0.95 → 0.92 (acceptable) ✓
    └─ [APPROVE] [REJECT]

[ ] Enable TTS caching
    └─ Speed: 1200ms → 50ms
    └─ Cost: No change
    └─ [APPROVE]
```

### Tier 3: Intelligence (Helix Recommends)
```
🤖 HELIX: "I've analyzed 3 days of operations.
   Here are my recommendations for you to approve:"

✓ Switch Memory Synthesis (safe, high savings)
✓ Enable Batching (night processing, big savings)
✓ Cache TTS (no cost, huge speed boost)

❌ Cannot execute changes (requires your approval)
❌ Cannot approve changes (you approve)
❌ Cannot override safety toggles (hardcoded)
```

## Safety Guardrails (Hardcoded)

```typescript
// These CANNOT be changed by Helix

✅ Helix can: Analyze, recommend, suggest
✅ Helix can: View all operations and costs

❌ Helix cannot: Execute cost changes without approval
❌ Helix cannot: Override safety toggles
❌ Helix cannot: Change models without approval
❌ Helix cannot: Approve decisions (you do)

RULE: Any decision affecting margins requires Rodrigo's approval
```

## Implementation Timeline

| Phase | Duration | Focus | Outcome |
|-------|----------|-------|---------|
| **0.5** | Weeks 1-2 | Unified control plane | All 10 ops routed through router |
| **0** | Weeks 3-4 | Conductor foundation | Autonomous operation ready |
| **1-5** | Weeks 5-12 | Orchestration, interface, coordination | Full system operational |

## Cost Projections (Optimized)

| Users | Monthly | Per User | Margin |
|-------|---------|----------|--------|
| 100 | $25 | $0.25 | 99% |
| 1,000 | $65 | $0.065 | 98% |
| 10,000 | $400 | $0.04 | 99% |

## For BYOK Users (No Margin Impact)

BYOK users can:
- ✅ Override any model
- ✅ Increase spending (they pay)
- ✅ Enable full Helix autonomy
- ✅ Control their own costs

Does NOT affect Helix's margins.

## The Key Difference from Before

| Before | After |
|--------|-------|
| Hardcoded: chat→Sonnet ($0.015/msg) | Configured: chat→DeepSeek ($0.00003/msg) |
| No visibility into spending | Real-time dashboard |
| No approval process | Money decisions blocked without approval |
| Can't optimize autonomously | Helix recommends optimizations (you approve) |
| User has no control | BYOK users get full autonomy |

## Launch Readiness

✅ All 10 AI operations identified
✅ Router design finalized
✅ Admin panel UI/UX designed
✅ Safety toggles hardcoded (Helix can't bypass)
✅ Cost projections validated
✅ Approval workflow specified
✅ BYOK strategy clear

🚀 **Ready to implement Phase 0.5 (control plane foundation)**

---

## Decision Points

1. **Models**: DeepSeek + Gemini Flash only (correct?)
2. **Tier 3**: Full (Observability + Control + Intelligence)?
3. **Phase 0.5**: Highest priority (build this first, then orchestration)?
4. **Safety**: Hardcoded toggles prevent Helix override (acceptable)?
5. **BYOK**: Users can do whatever they want (no margin impact - yes?)?

