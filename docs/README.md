# Helix Documentation

Complete documentation for the Helix project, organized by audience and purpose.

## 📚 For Users

**Want to learn how to use Helix features?**

→ Go to **[Knowledge Base](/web/docs/knowledge-base/README.md)**

The knowledge base contains user-friendly guides:
- [Agent Templates](./knowledge-base/extended/agent-templates.md) - Discover and customize AI agents
- [Marketplace](./knowledge-base/extended/marketplace.md) - Find and share resources
- [Custom Tools](./knowledge-base/extended/custom-tools.md) - Create specialized AI functions
- [Skill Composition](./knowledge-base/extended/skill-composition.md) - Build multi-step workflows
- [Memory Synthesis](./knowledge-base/extended/memory-synthesis.md) - Analyze patterns and insights

✓ **Note:** Knowledge base is also accessible via the app's Help menu

---

## 🏗️ For Developers & Architects

**Want to understand the system architecture?**

### Current Implementation Status ⭐

**Start here for what's actually built:**

- [Phase 3 Current State](./PHASE-3-CURRENT-STATE.md) - What's implemented, in progress, and missing
- [Phase 2 Integration Analysis](./PHASE-2-INTEGRATION-ANALYSIS.md) - OpenClaw features vs. UI exposure
- [Documentation Cleanup Summary](./DOCUMENTATION-CLEANUP-SUMMARY.md) - How we reviewed and aligned all docs

### Core Architecture

**Foundation documents:**

- [Helix Technical Specification](./HELIX_TECHNICAL_SPEC.md) - Complete technical specification
- [Helix Autonomous Blueprint](./HELIX_AUTONOMOUS_BLUEPRINT.md) - Autonomy and freewill architecture
- [Living AI Architecture](./LIVING_AI_ARCHITECTURE_v1.md) - Psychological layer architecture

**Component specifications:**
- [Observatory Blueprint](./HELIX_OBSERVATORY_BLUEPRINT.md) - Web UI architecture
- [Observatory Code Blueprint](./HELIX_OBSERVATORY_CODE_BLUEPRINT.md) - React/Frontend implementation
- [Local Interface Blueprint](./HELIX_LOCAL_INTERFACE_BLUEPRINT.md) - Desktop app architecture

**Vision & Strategy:**

- [Helix Vision (Final)](./blueprints/HELIX-VISION-FINAL.md) - Core product vision
- [Freewill Vision](./blueprints/HELIX-FREEWILL-VISION.md) - Psychological architecture vision
- [Web Unique Features](./blueprints/WEB-UNIQUE-FEATURES.md) - Web platform differentiation

### Implementation References

**How things work:**
- [OpenClaw Analysis](./blueprints/OPENCLAW-ANALYSIS.md) - Gateway and tool execution
- [Platform Parity Matrix](./blueprints/PLATFORM-PARITY-MATRIX.md) - Web vs Desktop features
- [Web/Mobile Strategy](./blueprints/WEB-MOBILE-STRATEGY.md) - Cross-platform strategy

**Business & Operations:**
- [Pricing & Cost Analysis](./blueprints/PRICING-COST-ANALYSIS.md) - Cost model and pricing
- [User Showcase Analysis](./blueprints/USER-SHOWCASE-ANALYSIS.md) - Target user profiles

### Development Setup

**Getting started:**
- [1Password CI/CD Setup](./1PASSWORD-CICD-SETUP.md) - Secrets management setup
- [Deployment with 1Password](./DEPLOYMENT_WITH_1PASSWORD.md) - Production deployment
- [Layer 5 Cron Setup](./LAYER5_CRON_SETUP.md) - Scheduled job configuration

**Desktop Development:**
- [Desktop Signing Setup](/helix-desktop/docs/SIGNING-SETUP.md) - macOS app signing

### Current Implementation Plans

**Latest implementation directions:**
- [Phase 3 Desktop Secrets API](/docs/plans/2026-02-02-desktop-phase3-secrets-api.md)
- [Per-User Secrets Architecture](/docs/plans/2026-02-02-per-user-secrets-architecture.md)
- [Phase 3 Frontend Secrets Dashboard](/docs/plans/2026-02-02-phase3-frontend-secrets-dashboard.md)

---

## 📋 Documentation Structure

```
/docs/
├── README.md (this file)
│
├── PHASE-3-CURRENT-STATE.md             # ⭐ What's actually implemented (Status dashboard)
├── PHASE-2-GAPS-STRATEGIC-DECISION.md   # Why Phase 2 features were deferred
├── DOCUMENTATION-CLEANUP-SUMMARY.md     # How we aligned docs to implementation
│
├── blueprints/                          # Architecture & design docs
│   ├── HELIX-VISION-FINAL.md           # Product vision
│   ├── HELIX-FREEWILL-VISION.md        # Psychology architecture
│   ├── OPENCLAW-ANALYSIS.md            # Gateway analysis
│   ├── PLATFORM-PARITY-MATRIX.md       # Web vs Desktop
│   ├── WEB-UNIQUE-FEATURES.md          # Web differentiation
│   ├── WEB-MOBILE-STRATEGY.md          # Strategy
│   ├── PRICING-COST-ANALYSIS.md        # Business model
│   ├── USER-SHOWCASE-ANALYSIS.md       # Target users
│   └── FRICTION-ANALYSIS.md            # UX analysis
│
├── Root level technical specs
│   ├── HELIX_TECHNICAL_SPEC.md         # Complete spec
│   ├── HELIX_AUTONOMOUS_BLUEPRINT.md   # Autonomy spec
│   ├── HELIX_LOCAL_INTERFACE_BLUEPRINT.md
│   ├── HELIX_OBSERVATORY_BLUEPRINT.md  # Web UI
│   ├── HELIX_OBSERVATORY_CODE_BLUEPRINT.md
│   ├── LIVING_AI_ARCHITECTURE_v1.md    # Layer architecture
│   ├── HELIX_WEBSITE_BRAND_TONE.md     # Brand guide
│   └── LAYER5_CRON_SETUP.md            # Cron jobs
│
├── Deployment & Operations
│   ├── 1PASSWORD-CICD-SETUP.md         # Secrets setup
│   └── DEPLOYMENT_WITH_1PASSWORD.md    # Deployment guide
│
├── plans/                              # Current implementation plans
│   ├── 2026-02-02-desktop-phase3-secrets-api.md
│   ├── 2026-02-02-per-user-secrets-architecture.md
│   └── 2026-02-02-phase3-frontend-secrets-dashboard.md
│
├── newbp/                              # High-level references
│   ├── ALL-PHASES-SUMMARY.md          # Phase 1-3 overview
│   ├── README-IMPLEMENTATION-PLAN.md   # Implementation guide
│   └── GROWTH-IMPROVEMENT-ROADMAP.md   # Strategic roadmap
│
├── archive/                            # Historical documents
│   ├── daily-logs/                     # Daily standup logs
│   ├── phase-reports/                  # Phase completion reports
│   ├── planning/                       # Old implementation specs
│   └── README.md                       # Archive guide
│
└── knowledge-base/                     # USER DOCUMENTATION ⭐
    ├── README.md
    ├── INTEGRATION.md (developer guide)
    ├── extended/
    │   ├── agent-templates.md
    │   ├── marketplace.md
    │   ├── custom-tools.md
    │   ├── skill-composition.md
    │   └── memory-synthesis.md
    └── core/ (future core feature guides)
```

---

## 🎯 Quick Navigation by Role

### Product Manager

→ [Product Vision](./blueprints/HELIX-VISION-FINAL.md)
→ [Growth Roadmap](./newbp/GROWTH-IMPROVEMENT-ROADMAP.md)
→ [Phase 3 Current State](./PHASE-3-CURRENT-STATE.md)
→ [Pricing Model](./blueprints/PRICING-COST-ANALYSIS.md)

### Backend Developer
→ [Technical Specification](./HELIX_TECHNICAL_SPEC.md)
→ [Autonomous Blueprint](./HELIX_AUTONOMOUS_BLUEPRINT.md)
→ [OpenClaw Analysis](./blueprints/OPENCLAW-ANALYSIS.md)
→ [Current Plans](./plans/)

### Frontend Developer
→ [Observatory Blueprint](./HELIX_OBSERVATORY_BLUEPRINT.md)
→ [Observatory Code Blueprint](./HELIX_OBSERVATORY_CODE_BLUEPRINT.md)
→ [Platform Parity](./blueprints/PLATFORM-PARITY-MATRIX.md)
→ [Knowledge Base Integration](./knowledge-base/INTEGRATION.md)

### DevOps / Infrastructure
→ [1Password Setup](./1PASSWORD-CICD-SETUP.md)
→ [Deployment Guide](./DEPLOYMENT_WITH_1PASSWORD.md)
→ [Layer 5 Cron](./LAYER5_CRON_SETUP.md)

### Mobile Developer
→ [Web/Mobile Strategy](./blueprints/WEB-MOBILE-STRATEGY.md)
→ [Local Interface](./HELIX_LOCAL_INTERFACE_BLUEPRINT.md)

### Desktop Developer
→ [Local Interface Blueprint](./HELIX_LOCAL_INTERFACE_BLUEPRINT.md)
→ [Signing Setup](/helix-desktop/docs/SIGNING-SETUP.md)
→ [Platform Parity](./blueprints/PLATFORM-PARITY-MATRIX.md)

---

## 📖 For Learning the System

**Complete onboarding path:**

1. **Understand the vision** → [Final Vision](./blueprints/HELIX-VISION-FINAL.md)
2. **Learn the architecture** → [Technical Spec](./HELIX_TECHNICAL_SPEC.md)
3. **Understand psychology** → [Freewill Vision](./blueprints/HELIX-FREEWILL-VISION.md)
4. **Review layers** → [Living AI Architecture](./LIVING_AI_ARCHITECTURE_v1.md)
5. **See it all together** → [Phase Summary](./newbp/ALL-PHASES-SUMMARY.md)
6. **Understand constraints** → [Platform Parity](./blueprints/PLATFORM-PARITY-MATRIX.md)
7. **Pick your stack** → Role-specific guides above

---

## 🔍 Finding Specific Topics

| Topic | Document |
|-------|----------|
| How agents work | [Autonomous Blueprint](./HELIX_AUTONOMOUS_BLUEPRINT.md) |
| Memory architecture | [Living AI Architecture](./LIVING_AI_ARCHITECTURE_v1.md) |
| Web UI | [Observatory Blueprint](./HELIX_OBSERVATORY_BLUEPRINT.md) |
| Desktop app | [Local Interface Blueprint](./HELIX_LOCAL_INTERFACE_BLUEPRINT.md) |
| Secrets management | [1Password Setup](./1PASSWORD-CICD-SETUP.md) |
| Deployment | [Deployment Guide](./DEPLOYMENT_WITH_1PASSWORD.md) |
| Phase 3 Implementation | [Phase 3 Current State](./PHASE-3-CURRENT-STATE.md) |
| User guides | [Knowledge Base](./knowledge-base/README.md) |
| Cost model | [Pricing Analysis](./blueprints/PRICING-COST-ANALYSIS.md) |
| Strategy | [Growth Roadmap](./newbp/GROWTH-IMPROVEMENT-ROADMAP.md) |

---

## 📝 Documentation Maintenance

### Active Documentation
These files are actively used and updated:
- `/blueprints/` - Architecture and design
- `/plans/` - Current implementation plans
- Root level `.md` files - Technical specifications
- `/web/docs/knowledge-base/` - User documentation (protected)

### Historical Documentation
These files are archived for reference:
- `/archive/` - Old planning documents and phase reports
- Some `/newbp/` files - Historical implementation notes

### How to Update Documentation
1. For user guides: Update files in `/web/docs/knowledge-base/`
2. For architecture: Update files in `/blueprints/` or root
3. For deprecated info: Move to `/archive/` with explanation
4. Maintain this README as single source of truth

---

## 🚀 Last Updated

- **Knowledge Base**: February 2026 (v1.0.0)
- **Architecture**: Ongoing
- **Plans**: February 2026

---

**Need help?** See the Knowledge Base for user documentation or reach out to the development team for technical questions.
