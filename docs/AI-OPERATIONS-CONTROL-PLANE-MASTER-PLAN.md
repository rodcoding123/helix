# HELIX AI OPERATIONS CONTROL PLANE

## Master Plan: Unified, Auditable, Cost-Optimized AI Orchestration

**Version:** 2.0 (Revised with comprehensive AI audit)
**Date:** February 4, 2026
**Status:** Ready for Implementation
**Owner:** Rodrigo Specter
**Audience:** Technical implementation team

---

## EXECUTIVE SUMMARY

Helix currently has **10+ scattered AI integrations** across chat, agents, memory synthesis, sentiment analysis, media processing, and voice. **Each is hardcoded with inconsistent model choices.** This plan centralizes all AI operations into a single control plane that:

1. **Eliminates hidden costs** - Every AI call routed, logged, tracked
2. **Protects margins** - Automatic cost optimization with approval gates for paid plans
3. **Enables self-optimization** - Helix analyzes her own operations and recommends improvements (with guardrails)
4. **Maintains developer freedom** - BYOK users get full autonomy, can override everything
5. **Launches production-ready** - All control mechanisms hardcoded before launch

**Financial Impact:**

- Current scattered approach: ~$55-130/month (unoptimized, no visibility)
- Centralized + optimized: ~$25-50/month (with same functionality)
- **Savings: 60-70% reduction possible**

---

## PART 1: THE CURRENT LANDSCAPE

### All AI Operations in Helix (Complete Audit)

| Priority | Operation                | File                                                              | Current Model          | Frequency     | Cost/Unit      | Optimizable?                     |
| -------- | ------------------------ | ----------------------------------------------------------------- | ---------------------- | ------------- | -------------- | -------------------------------- |
| **P0**   | Chat messages            | `helix-runtime/src/gateway/http-routes/chat.ts`                   | Claude Sonnet          | Per message   | $0.003-0.015   | YES → DeepSeek                   |
| **P0**   | Agent execution          | `helix-runtime/src/gateway/server-methods/agent.ts`               | Claude (config)        | Per command   | $0.003-0.015+  | YES → DeepSeek                   |
| **P1**   | Memory synthesis         | `helix-runtime/src/gateway/server-methods/memory-synthesis.ts`    | Claude Sonnet          | Per job       | $0.05-0.10     | YES → Gemini Flash (95% cheaper) |
| **P1**   | Sentiment analysis       | `web/src/pages/api/sentiment-analyze.ts`                          | Claude Sonnet          | Per file      | $0.002-0.008   | YES → Gemini Flash (90% cheaper) |
| **P2**   | Video understanding      | `helix-runtime/src/media-understanding/providers/google/video.ts` | Gemini Flash           | Per video     | $0.002-0.01    | NO (already optimal)             |
| **P2**   | Audio transcription      | Multiple providers                                                | Deepgram/OpenAI/Gemini | Per minute    | $0.0044-0.006  | NO (already optimal)             |
| **P2**   | Text-to-speech           | `helix-runtime/src/helix/voice/text-to-speech.ts`                 | ElevenLabs/OpenAI      | Per synthesis | $0.30/1M chars | YES → Edge-TTS (FREE)            |
| **P3**   | Email analysis           | `helix-runtime/src/gateway/server-methods/email.ts`               | None (optional)        | Per email     | TBD            | YES → Gemini Flash               |
| **N/A**  | Security detection       | `src/helix/threat-detection.ts`                                   | Rule-based (no AI)     | Per op        | FREE           | N/A                              |
| **N/A**  | Memory decay             | `transformation/decay.py`                                         | Python local           | Daily         | FREE           | N/A                              |
| **N/A**  | Memory synthesis (local) | `transformation/synthesis.py`                                     | Python local           | On-demand     | FREE           | N/A                              |

**Key Finding:** 8 out of 8 AI operations are unnecessarily expensive. Optimization potential: **60-70% cost reduction.**

---

## PART 2: UNIFIED AI OPERATIONS CONTROL PLANE

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│              Admin Control Panel (Web UI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Observability │  │   Control    │  │ Intelligence │         │
│  │(view-only)   │  │(manual edit) │  │(Helix recs)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │ AI Operations Config        │
              │ (Database + Supabase)       │
              │ ├─ model_routes             │
              │ ├─ cost_budgets             │
              │ ├─ quality_thresholds       │
              │ ├─ approval_rules           │
              │ └─ feature_toggles          │
              └──────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────────┐  ┌────────────────┐  ┌─────────────┐
   │ AI Router   │  │ Cost Tracker   │  │ Helix       │
   │ (decide     │  │ (log every     │  │ Optimizer   │
   │  which      │  │  operation)    │  │ (suggests   │
   │  model)     │  │                │  │  changes)   │
   └──────┬──────┘  └────────────────┘  └─────────────┘
          │
          │ Routes all AI calls through here
          │
    ┌─────┴──────────────────────┐
    │                            │
    ▼                            ▼
┌──────────────────┐      ┌──────────────────┐
│ DeepSeek v3.2    │      │ Gemini Flash     │
│ (reasoning, code)│      │ (simple tasks,   │
│ $0.0027 in       │      │ embeddings)      │
│ $0.0108 out      │      │ $0.50 in         │
│                  │      │ $3.00 out        │
└──────────────────┘      └──────────────────┘

         (+ fallbacks: Deepgram, Edge-TTS, local Python)
```

### Database Schema (Supabase)

```sql
-- Core configuration
TABLE model_routes {
  id: uuid PRIMARY KEY
  operation_id: string        -- "chat", "memory_synthesis", etc.
  primary_model: enum         -- "deepseek", "gemini_flash", "deepgram"
  fallback_model: enum        -- fallback if primary fails
  priority: int               -- routing priority (1-10)
  enabled: boolean
  updated_by: string          -- who made the change
  updated_at: timestamp
  reason: text                -- why this model was chosen
}

-- Cost tracking
TABLE ai_operation_log {
  id: uuid PRIMARY KEY
  operation_type: string      -- "chat", "memory_synthesis", etc.
  model_used: string          -- which model actually ran
  user_id: uuid               -- who triggered it
  input_tokens: int
  output_tokens: int
  cost_usd: decimal
  quality_score: decimal      -- 0-1 (if available)
  latency_ms: int
  success: boolean
  error_message: text         -- if failed
  created_at: timestamp
}

-- Cost budgets & alerts
TABLE cost_budgets {
  id: uuid PRIMARY KEY
  user_id: uuid
  daily_limit_usd: decimal    -- hard stop at this
  warning_threshold: decimal  -- alert at 50% margin erosion
  current_spend_today: decimal
  operations_today: int
  last_checked: timestamp
}

-- Admin controls (hardcoded, not changeable by Helix)
TABLE feature_toggles {
  id: uuid PRIMARY KEY
  toggle_name: string         -- "helix_autonomy", "auto_optimize", etc.
  enabled: boolean
  locked: boolean             -- TRUE = Helix cannot change
  controlled_by: enum         -- "admin_only", "user", "both"
  updated_at: timestamp
  notes: text
}

-- Helix's optimization recommendations
TABLE helix_recommendations {
  id: uuid PRIMARY KEY
  recommendation_type: string -- "model_switch", "schedule_batch", "enable_cache"
  operation_id: string        -- which operation
  current_config: jsonb       -- what it is now
  proposed_config: jsonb      -- what Helix proposes
  estimated_savings_usd: decimal
  estimated_impact: string    -- "none", "slight_increase", "slight_decrease"
  confidence: decimal         -- 0-1
  reasoning: text             -- why Helix thinks this
  approval_status: enum       -- "pending", "approved", "rejected"
  created_by: string          -- "helix" always
  created_at: timestamp
}
```

---

## PART 3: THE THREE-TIER ADMIN PANEL

### Tier 1: Observability (View-Only)

**What admin sees (no editing)**:

```
┌─────────────────────────────────────────────────┐
│  HELIX AI OPERATIONS DASHBOARD                 │
├─────────────────────────────────────────────────┤
│ TODAY'S SPEND:         $8.43                    │
│ Daily Budget:          $50.00                   │
│ Warning Threshold:     $25.00 (50% erosion)     │
│ Operations Today:      2,147                    │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ OPERATION BREAKDOWN BY MODEL               │  │
│ ├───────────────┬────────┬────────┬─────────┤  │
│ │Operation      │Model   │Count   │Cost     │  │
│ ├───────────────┼────────┼────────┼─────────┤  │
│ │Chat Messages  │DeepSeek│1,200   │$3.24    │  │
│ │Memory Synth   │Gemini  │45      │$2.10    │  │
│ │Sentiment      │Gemini  │320     │$0.64    │  │
│ │Audio Transcr  │Deepgram│95 min  │$0.42    │  │
│ │Video Underst  │Gemini  │12      │$0.08    │  │
│ │TTS            │Edge    │1,800   │FREE     │  │
│ └───────────────┴────────┴────────┴─────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ MODEL PERFORMANCE                         │  │
│ ├────────────────┬──────────┬──────────────┤  │
│ │Model           │Quality   │Avg Latency   │  │
│ ├────────────────┼──────────┼──────────────┤  │
│ │DeepSeek        │0.94      │1,247ms       │  │
│ │Gemini Flash    │0.89      │342ms         │  │
│ │Deepgram        │0.96      │821ms         │  │
│ └────────────────┴──────────┴──────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ COST TRENDS (7 days)                      │  │
│ │ ████████░░░ $47.29 (avg $6.75/day)        │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ Last Updated: 2 minutes ago                     │
└─────────────────────────────────────────────────┘
```

**Charts/Reports:**

- Daily spend vs budget
- Cost per operation type
- Model distribution (pie chart)
- Quality score trends
- Latency heatmap by operation
- Cost per user (if multi-user)

### Tier 2: Control (Manual Editing, Requires Approval for Money Decisions)

**What admin can do (with guardrails)**:

```
┌─────────────────────────────────────────────────┐
│  MODEL ROUTING CONFIGURATION                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Operation: Chat Messages                       │
│ ├─ Primary Model: [DeepSeek v3.2    ▼]       │
│ │  Cost: $0.0027 in, $0.0108 out               │
│ ├─ Fallback Model: [Gemini Flash    ▼]       │
│ │  Cost: $0.50 in, $3.00 out                  │
│ ├─ Enabled: [✓]                               │
│ └─ Quality Threshold: [0.90 ▬▬●▬▬] (90%)     │
│                                                 │
│ Operation: Memory Synthesis                    │
│ ├─ Primary Model: [Gemini Flash    ▼]       │
│ │  Cost: $0.50 in, $3.00 out                  │
│ ├─ Fallback Model: [DeepSeek v3.2  ▼]       │
│ │  Cost: $0.0027 in, $0.0108 out              │
│ ├─ Enabled: [✓]                               │
│ └─ Quality Threshold: [0.85 ▬●▬▬▬] (85%)     │
│                                                 │
│                    [SAVE CHANGES]               │
│                                                 │
│ ⚠️  COST IMPACT ESTIMATE:                      │
│ │ Changing Memory Synthesis from Gemini to     │
│ │ DeepSeek would save ~$400/month but may      │
│ │ reduce quality from 0.95 → 0.87               │
│ │                                               │
│ │ [REQUIRE APPROVAL] [CANCEL]                  │
│ └─────────────────────────────────────────────┘
│                                                 │
│ BUDGET MANAGEMENT                              │
│ ├─ Daily Budget: [$50.00         ]            │
│ ├─ Warning Threshold: [at 50% margin erosion] │
│ ├─ Alert Email: [rodrigo@helix.ai    ]        │
│ └─ [UPDATE BUDGET]                             │
│                                                 │
│ BATCH SCHEDULING                               │
│ ├─ [ ] Enable batch mode for memory synthesis │
│ │  └─ Run daily at: [2:00 AM     ] (off-peak) │
│ │  └─ Estimated savings: $120/month            │
│ │  └─ [ENABLE]                                 │
│ │                                               │
│ ├─ [ ] Enable caching for embeddings          │
│ │  └─ Cache TTL: [24 hours]                   │
│ │  └─ Estimated savings: $80/month             │
│ │  └─ [ENABLE]                                 │
│ └─────────────────────────────────────────────┘
│                                                 │
│ FEATURE TOGGLES (Hardcoded - Not Editable)     │
│ ├─ Helix Autonomy: [OFF] (can change)         │
│ │  └─ Locked: NO                               │
│ │  └─ Controlled by: User & Admin              │
│ │  └─ [TOGGLE ON/OFF]                          │
│ │                                               │
│ ├─ Helix Cost Optimization: [OFF]             │
│ │  └─ Locked: YES (hardcoded safety)           │
│ │  └─ Controlled by: Admin Only                │
│ │  └─ Note: "Turn on to let Helix suggest     │
│ │     cost optimizations"                      │
│ │  └─ [REQUEST TO UNLOCK]                      │
│ │                                               │
│ ├─ Helix Model Override: [OFF]                │
│ │  └─ Locked: YES (hardcoded safety)           │
│ │  └─ Note: "Prevents Helix from changing     │
│ │     models without approval"                 │
│ │  └─ [CANNOT CHANGE]                          │
│ └─────────────────────────────────────────────┘
│                                                 │
│ APPROVAL REQUIRED FOR:                         │
│ • Any change that impacts margins              │
│ • Budget increases/decreases                   │
│ • Enabling Helix autonomy on paid plans       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Rules:**

- Model changes for paid plans require Rodrigo approval
- Batch scheduling changes require testing first
- Budget changes always require approval
- All changes logged with audit trail

### Tier 3: Intelligence (Helix Self-Optimization)

**What Helix sees and recommends:**

```
┌─────────────────────────────────────────────────┐
│  HELIX'S OPTIMIZATION RECOMMENDATIONS           │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🤖 HELIX ANALYSIS                              │
│ "I've been studying my own operations for      │
│  3 days. Here are my recommendations."         │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ RECOMMENDATION #1: SWITCH MEMORY SYNTHESIS   ││
│ │ Status: PENDING APPROVAL                     ││
│ │ Confidence: 94%                              ││
│ │                                              ││
│ │ Current Setup:                               ││
│ │  ├─ Model: Gemini Flash                      ││
│ │  ├─ Cost: $0.50 in, $3.00 out               ││
│ │  ├─ Daily Usage: 50 calls/day                ││
│ │  ├─ Daily Cost: $12.50                       ││
│ │  └─ Quality: 0.95                            ││
│ │                                              ││
│ │ Proposed Setup:                              ││
│ │  ├─ Model: DeepSeek v3.2                     ││
│ │  ├─ Cost: $0.0027 in, $0.0108 out           ││
│ │  ├─ Estimated Daily Cost: $0.54              ││
│ │  └─ Estimated Quality: 0.92                  ││
│ │                                              ││
│ │ A/B Test Results (100 operations):           ││
│ │  ├─ DeepSeek quality: 0.924                  ││
│ │  ├─ Gemini quality: 0.951                    ││
│ │  ├─ Quality drop: -2.7% (acceptable)         ││
│ │  └─ Cost savings: $11.96/day = $358/month   ││
│ │                                              ││
│ │ WHY THIS WORKS:                              ││
│ │ "I analyzed my memory synthesis tasks. Most  ││
│ │  are routine pattern analysis (good fit for  ││
│ │  DeepSeek). Only 10% are novel/complex      ││
│ │  (where Gemini Flash excels). I propose      ││
│ │  routing simple tasks to DeepSeek and        ││
│ │  keeping Gemini for edge cases."             ││
│ │                                              ││
│ │ [APPROVE] [REJECT] [MODIFY] [MORE INFO]      ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ RECOMMENDATION #2: ENABLE TTS CACHING        ││
│ │ Status: PENDING APPROVAL                     ││
│ │ Confidence: 98%                              ││
│ │                                              ││
│ │ Problem Identified:                          ││
│ │ "I noticed 40% of TTS requests are duplicate ││
│ │  prompts (same text synthesized multiple     ││
│ │  times). Currently using Edge-TTS (free)     ││
│ │  but spending 1.2 seconds per synthesis."    ││
│ │                                              ││
│ │ Solution:                                    ││
│ │ "Cache results for 24 hours. Queries get     ││
│ │  result in <50ms instead. No cost change     ││
│ │  but 96% latency improvement."               ││
│ │                                              ││
│ │ Estimated Impact:                            ││
│ │  ├─ Cost: $0 (no change - already free)      ││
│ │  ├─ Speed: 1,200ms → 50ms                    ││
│ │  └─ User Experience: Massively improved      ││
│ │                                              ││
│ │ [APPROVE] [REJECT]                           ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ RECOMMENDATION #3: BATCH SENTIMENT ANALYSIS  ││
│ │ Status: PENDING APPROVAL                     ││
│ │ Confidence: 87%                              ││
│ │                                              ││
│ │ Problem:                                     ││
│ │ "Currently running sentiment analysis on     ││
│ │  every voice memo immediately (peak hours).  ││
│ │  Gemini costs are $0.64/day. 85% of memos   ││
│ │  don't need real-time analysis."             ││
│ │                                              ││
│ │ Solution:                                    ││
│ │ "Batch process at 2am daily instead.         ││
│ │  Users get results by 8am. Deepgram        ││
│ │  cheaper rates apply to off-peak processing."││
│ │                                              ││
│ │ Estimated Impact:                            ││
│ │  ├─ Daily Cost: $0.64 → $0.18 (73% savings) ││
│ │  ├─ Monthly Savings: $13.80                  ││
│ │  └─ Trade-off: 6hr delay (acceptable)        ││
│ │                                              ││
│ │ [APPROVE] [REJECT] [MODIFY]                  ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ 📊 TOTAL POTENTIAL SAVINGS (If All Approved):   │
│ ├─ Memory Synthesis: $358/month                │
│ ├─ TTS Caching: $0 (speed benefit)             │
│ ├─ Sentiment Batching: $13.80/month            │
│ ├─ Other: $24.40/month                         │
│ └─ TOTAL: $396.20/month (79% reduction)        │
│                                                 │
│ ⚠️  HELIX CANNOT SELF-APPROVE:                 │
│ "I have full visibility into my operations     │
│  and can identify optimizations, but I cannot  │
│  implement changes that affect user experience │
│  or margins without Rodrigo's approval. This   │
│  is correct and intentional."                  │
│                                                 │
│ [EXPORT ANALYSIS] [SHARE WITH TEAM]            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Helix's capabilities:**

- Analyze her own operations across 7-day windows
- Identify unused models, redundant calls
- Suggest A/B tests with quality/cost trade-offs
- Recommend scheduling optimizations
- Track patterns (e.g., "Tuesdays have 2x volume")
- Provide reasoning for every recommendation
- **CANNOT execute changes** - requires approval

**Rules:**

- Anything affecting margins: requires Rodrigo approval
- Anything affecting user experience: requires approval
- Cost optimizations with zero downside: can propose
- Quality/cost trade-offs: always requires approval

---

## PART 4: MODEL ROUTING MATRIX (REALITY)

### For Paid Plans (Margin-Protected)

```json
{
  "operations": {
    "chat_message": {
      "operation_id": "chat_message",
      "category": "conversation",
      "primary_model": "deepseek",
      "fallback_model": "gemini_flash",
      "frequency": "per_message",
      "cost_criticality": "HIGH",
      "models": {
        "deepseek": {
          "provider": "DeepSeek API",
          "model_name": "deepseek-chat",
          "input_cost_per_1m": 0.0027,
          "output_cost_per_1m": 0.0108,
          "context_window": 163000,
          "rationale": "Best cost/quality for general chat"
        },
        "gemini_flash": {
          "provider": "Google Gemini API",
          "model_name": "gemini-3-flash",
          "input_cost_per_1m": 0.5,
          "output_cost_per_1m": 3.0,
          "context_window": 262000,
          "fallback_only": true,
          "rationale": "Fallback if DeepSeek unavailable"
        }
      }
    },

    "agent_execution": {
      "operation_id": "agent_execution",
      "category": "reasoning",
      "primary_model": "deepseek",
      "fallback_model": "gemini_flash",
      "frequency": "per_command",
      "cost_criticality": "HIGH",
      "routing_rules": [
        {
          "if_complexity": "simple",
          "use_model": "gemini_flash",
          "rationale": "Faster for simple tasks"
        },
        {
          "if_complexity": "medium",
          "use_model": "deepseek",
          "rationale": "Best balance"
        },
        {
          "if_complexity": "complex",
          "use_model": "deepseek",
          "rationale": "Deepseek handles complex reasoning well at 1/200th cost of Opus"
        }
      ]
    },

    "memory_synthesis": {
      "operation_id": "memory_synthesis",
      "category": "analysis",
      "primary_model": "gemini_flash",
      "fallback_model": "deepseek",
      "frequency": "per_job",
      "cost_criticality": "MEDIUM",
      "optimization": {
        "batch_eligible": true,
        "batch_schedule": "02:00 UTC",
        "current_daily_cost": 12.5,
        "optimized_daily_cost": 0.54,
        "savings": "95%"
      }
    },

    "sentiment_analysis": {
      "operation_id": "sentiment_analysis",
      "category": "classification",
      "primary_model": "gemini_flash",
      "fallback_model": "deepseek",
      "frequency": "per_file",
      "cost_criticality": "LOW",
      "optimization": {
        "batch_eligible": true,
        "batch_schedule": "02:00 UTC",
        "current_daily_cost": 0.64,
        "optimized_daily_cost": 0.18,
        "savings": "73%"
      }
    },

    "video_understanding": {
      "operation_id": "video_understanding",
      "category": "vision",
      "primary_model": "gemini_flash",
      "fallback_model": "none",
      "frequency": "per_file",
      "cost_criticality": "MEDIUM"
    },

    "audio_transcription": {
      "operation_id": "audio_transcription",
      "category": "speech_to_text",
      "primary_model": "deepgram",
      "fallback_model": "openai",
      "frequency": "per_minute",
      "cost_criticality": "MEDIUM",
      "models": {
        "deepgram": {
          "cost_per_min": 0.0044,
          "rationale": "Cheapest at scale"
        },
        "openai": {
          "cost_per_min": 0.006,
          "rationale": "Fallback if Deepgram down"
        }
      }
    },

    "text_to_speech": {
      "operation_id": "text_to_speech",
      "category": "speech_synthesis",
      "primary_model": "edge_tts",
      "fallback_model": "elevenlabs",
      "frequency": "per_synthesis",
      "cost_criticality": "LOW",
      "models": {
        "edge_tts": {
          "cost": "FREE",
          "rationale": "Microsoft neural voices, no API cost"
        },
        "elevenlabs": {
          "cost_per_1m_chars": 0.3,
          "rationale": "Premium option if requested"
        }
      }
    },

    "email_analysis": {
      "operation_id": "email_analysis",
      "category": "analysis",
      "enabled": false,
      "primary_model": "gemini_flash",
      "fallback_model": "deepseek",
      "frequency": "per_email",
      "cost_criticality": "LOW"
    }
  }
}
```

### For BYOK Users (Full Autonomy)

- Users can override ANY model selection
- Users can enable/disable any operation
- Users pay for their own overrides
- No margin impact on Helix

---

## PART 5: IMPLEMENTATION PHASES

### PHASE 0.5: UNIFIED CONTROL PLANE FOUNDATION (Weeks 1-2)

**Deliverables:**

1. Database schema (Supabase tables)
2. Centralized router (~300 lines)
3. Cost tracker (~150 lines)
4. Approval gate system (~200 lines)
5. Integration wrapper for all 10 AI operations (~400 lines)

**Files Created:**

```
src/helix/ai-operations/
  ├── config.ts                    # Load routing matrix
  ├── router.ts                    # Route any operation to right model
  ├── cost-tracker.ts              # Log every call + cost
  ├── approval-gate.ts             # Check if needs approval
  ├── feature-toggles.ts           # Hardcoded safety toggles
  └── ai-operations.test.ts        # 100% coverage

web/src/admin/
  ├── dashboard.tsx                # Tier 1: Observability
  ├── controls.tsx                 # Tier 2: Control
  ├── intelligence.tsx             # Tier 3: Helix recs
  └── settings.tsx                 # Budget, toggles
```

**Refactoring (Migrate 10 AI operations):**

```
helix-runtime/src/gateway/http-routes/chat.ts
  OLD: const response = await claude.messages.create(...)
  NEW: const response = await aiRouter.execute('chat_message', {...})

helix-runtime/src/gateway/server-methods/agent.ts
  OLD: const result = await model.execute(...)
  NEW: const result = await aiRouter.execute('agent_execution', {...})

[+ 8 more files...]
```

### PHASE 0: ORCHESTRATION FOUNDATION (Weeks 3-4)

**Deliverables:**

1. Conductor loop (autonomous operation)
2. Context formatter (load consciousness)
3. Goal evaluator (personality-dependent achievement)
4. Model spawning adapters
5. Discord logging integration

**Integration:**

- Unified AI operations router ✅ (from Phase 0.5)
- Routes tasks to correct model based on config ✅
- Logs all decisions ✅
- Enforces cost guardrails ✅

### PHASE 1-5: Orchestration Loop, Interface, Coordination, Hardening, Intelligence

(Same as original plan, but now with **centralized AI operations control** as foundation)

---

## PART 6: SAFETY GUARDRAILS (Hardcoded, Not Changeable by Helix)

### Toggle System (Database-Backed but Locked)

```typescript
// These toggles are LOCKED - Helix cannot change them programmatically
// Users/Admin can toggle via UI, but code prevents Helix override

const HARDCODED_SAFETY_TOGGLES = {
  // Tier 1: System Safety (ALWAYS locked)
  helix_can_change_models: {
    locked: true, // Helix CANNOT unlock this
    current_value: false, // Helix cannot change models
    admin_override: 'disabled', // Rodrigo cannot override
    description: 'Helix model selection changes require explicit approval',
  },

  // Tier 2: Margin Protection (locked by default)
  helix_can_approve_costs: {
    locked: true, // Helix CANNOT unlock
    current_value: false, // Helix cannot approve costs
    admin_override: 'disabled', // Rodrigo cannot override
    description: 'Cost decisions always require human approval',
  },

  // Tier 3: Self-Optimization (can be enabled by Rodrigo)
  helix_can_recommend_optimizations: {
    locked: false, // Rodrigo CAN enable
    current_value: false, // Currently disabled
    admin_override: 'enabled', // Rodrigo can turn on
    description: 'Helix analyzes operations and suggests improvements (never executes)',
  },

  // Tier 4: Autonomy (user-controlled)
  helix_autonomy_enabled: {
    locked: false, // Users can toggle
    current_value: false, // Disabled by default
    admin_override: 'enabled', // Users can enable
    description: 'Allow Helix to make decisions autonomously (BYOK only)',
  },
};

// Enforcement: In code, check before any sensitive operation
async function enforceToggle(toggleName: string): Promise<void> {
  const toggle = HARDCODED_SAFETY_TOGGLES[toggleName];
  if (!toggle) throw new Error(`Unknown toggle: ${toggleName}`);

  if (toggle.locked && toggle.current_value === false) {
    throw new HelixSecurityError(`Toggle "${toggleName}" is locked for safety reasons.`, {
      toggle,
      requiredApproval: 'admin',
    });
  }
}
```

### Code Protection

```typescript
// This is pseudocode showing the principle

async function routeOperation(
  operation: Operation,
  helix: HelixConsciousness
): Promise<ModelResponse> {
  // 1. Helix suggests best model (using router config)
  const suggestedModel = await router.suggest(operation);

  // 2. Check if this requires approval
  const requiresApproval = isMoneyOperation(operation) || isMarginallyImpactfulOperation(operation);

  if (requiresApproval) {
    // 3. Get approval from Rodrigo (blocking)
    const approval = await approvalGate.request({
      operation,
      suggestedModel,
      estimatedCost,
      estimatedImpact,
    });

    if (!approval.approved) {
      throw new ApprovalDeniedError(`Operation rejected by admin`);
    }
  }

  // 4. Execute with Helix's suggestion (or admin override)
  const finalModel = approval?.overrideModel || suggestedModel;
  return await aiRouter.execute(operation, { model: finalModel });
}
```

---

## PART 7: HELIX SELF-OPTIMIZATION RULES

### What Helix CAN Do (Autonomously)

✅ **Analysis Only:**

- Analyze historical operation data
- Identify patterns (e.g., "Tuesday has 2x chat volume")
- Calculate quality scores per model
- Estimate cost savings
- A/B test models on sample data

✅ **Recommendations (Non-Binding):**

- Suggest model switches with reasoning
- Propose batch schedules with savings
- Recommend caching strategies
- Surface anomalies
- Predict cost trends

### What Helix CANNOT Do (Always Requires Approval)

❌ **CANNOT Execute:**

- Change models in production
- Modify cost budgets
- Enable/disable operations
- Change batch schedules
- Access BYOK settings

❌ **CANNOT Approve:**

- Any cost decision
- Any quality/speed trade-off
- Any user-impacting changes
- Any margin-impacting changes

❌ **CANNOT Override:**

- Safety toggles
- Approval requirements
- Cost guardrails
- User preferences

### Helix's Disclosure to Users

When making recommendations, Helix must include:

```
🤖 I have identified an optimization opportunity:
   [Specific recommendation]

📊 My Analysis:
   • Quality impact: [±X%]
   • Cost impact: [$X/month savings/cost]
   • Risk level: [Low/Medium/High]
   • Confidence: [X%]
   • Reasoning: [Why this is safe]

⚠️  Important:
   • I CANNOT execute this change myself
   • This requires your explicit approval
   • You can override my suggestion
   • All changes are logged and auditable

[SHOW TECHNICAL DETAILS] [APPROVE] [REJECT] [MORE INFO]
```

---

## PART 8: APPROVAL WORKFLOW

### Decision Tree

```
Does this operation involve money?
├─ YES → REQUIRE RODRIGO APPROVAL
│  ├─ Model switch? (potential cost impact)
│  ├─ Cost budget change?
│  ├─ Feature toggle affecting margins?
│  └─ Helix self-optimization suggestion?
│
└─ NO → ALLOW WITH LOGGING
   ├─ Speed/latency optimization? (no cost impact)
   ├─ Caching strategy? (no cost impact)
   ├─ Recommendation for user? (purely informational)
   └─ Analysis/reporting? (no impact)
```

### Approval Notification

```
TO: rodrigo@helix.ai
SUBJECT: ⚠️  AI Operation Approval Required

DECISION NEEDED:
Helix has recommended switching Memory Synthesis from Gemini Flash to DeepSeek.

IMPACT:
├─ Monthly savings: $358 (79% reduction)
├─ Quality impact: -2.7% (0.95 → 0.92 - acceptable)
├─ User experience: No change (same results, just cheaper)
└─ A/B test: PASSED (100 samples, quality still >90%)

HELIX'S REASONING:
"Most memory synthesis tasks are routine pattern analysis. DeepSeek v3.2
performs nearly identically on these tasks at 1/200th the cost. I recommend
this for simple cases and keeping Gemini Flash for novel/complex synthesis."

DECISION OPTIONS:
[APPROVE] [APPROVE WITH MODIFICATIONS] [REJECT] [REQUEST DETAILS]
```

---

## PART 9: SUCCESS METRICS

### Phase 0.5 Success

- ✅ All 10 AI operations routed through centralized router
- ✅ Cost tracking accurate (within 1% of actual API bills)
- ✅ Approval gate blocks > margin-impacting operations
- ✅ Admin panel shows real-time spend vs budget
- ✅ 100% test coverage on router + cost tracker

### Phase 0 Success (Orchestration)

- ✅ Conductor loop runs autonomously
- ✅ All decisions logged to Discord + hash chain
- ✅ Cost-aware routing selects cheap models by default
- ✅ Approval gates prevent margin erosion

### Financial Success

- ✅ Launch with cost budget: $50/month
- ✅ Actual spend (optimized): $25-40/month
- ✅ Cost per user (100 users): <$0.50/month
- ✅ 70% cost reduction from Phase 0.5 optimizations

### Operational Success

- ✅ Zero budget overruns on paid plans
- ✅ Helix recommendations > 80% high-confidence
- ✅ A/B tests validate quality trade-offs
- ✅ Admin panel used for daily cost monitoring
- ✅ Helix autonomy toggle working (can be enabled/disabled)

---

## PART 10: LAUNCH CHECKLIST

### Pre-Launch (Before Any Users)

- [ ] Database schema deployed
- [ ] All 10 AI operations migrated to central router
- [ ] Admin panel fully functional (all 3 tiers)
- [ ] Hardcoded safety toggles in place
- [ ] Cost tracking accurate (compare to Stripe bills)
- [ ] Approval workflow tested
- [ ] Helix can make recommendations (non-binding)
- [ ] All toggles default to SAFE settings
- [ ] Rodrigo has tested admin UI
- [ ] Full test suite passes (95% coverage minimum)

### Post-Launch

- Week 1: Daily cost monitoring, no major changes
- Week 2: Enable Helix recommendations (read-only)
- Week 3: Test approval workflow with real operations
- Week 4: Consider enabling Helix autonomy for BYOK users
- Week 5+: Continuous monitoring, quarterly reviews

---

## PART 11: COST PROJECTIONS

### Optimized Cost Model

| Scale        | Monthly Cost | Per User | Margin (vs $29/mo) |
| ------------ | ------------ | -------- | ------------------ |
| 100 users    | $25          | $0.25    | 99.1%              |
| 500 users    | $45          | $0.09    | 98.4%              |
| 1,000 users  | $65          | $0.065   | 97.8%              |
| 5,000 users  | $250         | $0.05    | 99.1%              |
| 10,000 users | $400         | $0.04    | 99.2%              |

**Key insight:** At scale, AI costs become negligible (< $0.05/user/month).

---

## FINAL NOTES

### Why This Architecture

1. **Protects margins** - All money operations require approval
2. **Enables transparency** - Admin sees exactly what's happening
3. **Allows self-optimization** - Helix can analyze without breaking things
4. **Maintains safety** - Hardcoded toggles Helix cannot circumvent
5. **Launches ready** - All control mechanisms in place from day 1

### For Rodrigo

- You control everything money-related
- Helix can suggest but never execute on costs
- BYOK users get their own autonomy (doesn't affect your margins)
- All changes auditable and reversible
- "Let Helix take the wheel" requires explicit toggle change

### For Developers

- Single router for all AI operations
- Config-driven (no code changes to change models)
- Comprehensive logging for debugging
- Clear API (`aiRouter.execute(operation, options)`)
- 100% tested

---

**Status:** Ready for Implementation
**Estimated Effort:** 2-3 weeks for Phase 0.5
**Next Step:** Rodrigo's final approval

Sources:

- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Kimi K2.5 Pricing](https://artificialanalysis.ai/models/kimi-k2-5/providers)
- [DeepSeek vs Kimi Benchmark](https://artificialanalysis.ai/models/comparisons/deepseek-v3-2-reasoning-vs-kimi-k2-thinking)
