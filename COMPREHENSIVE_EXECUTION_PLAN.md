# HELIX: Complete Execution Plan - All Phases Systematic

**Date:** February 2, 2026
**Vision:** "She remembers. She changes. She acts. She's yours."
**Status:** 88% code exists | 60% user-facing features complete | Ready for systematic build-out

---

## EXECUTIVE SUMMARY

Based on comprehensive audit:

- **Phase 1 (Memory)**: 95% done - PRODUCTION READY
- **Phase 2 (Integration)**: 85% done - Needs UI exposure (voice memos, calendars, email)
- **Phase 3 (Execution)**: 90% done - Needs real Claude API integration & desktop UI
- **Phase 4.1 (Voice Advanced)**: 92% done - Needs STT/TTS clients
- **Desktop (A/B/C)**: 88% done - PRODUCTION READY
- **Mobile**: 15% done - CRITICAL GAP (NOT YET BUILT)

**Critical Insight:** We have 95% of the backend and 70% of web UI. Mobile is the biggest gap. The missing pieces are primarily:

1. Mobile/PWA (0% done)
2. STT/TTS client integration (0% done)
3. Real Claude API for memory synthesis (0%, currently mocks)
4. Calendar/Email UI (0% done)

---

## PHASE BREAKDOWN & PRIORITY ORDER

### TIER 1: COMPLETE THE VISION (Weeks 1-4)

These complete the core "She remembers. She changes. She acts. She's yours." promise on web + desktop.

#### **PHASE 1: MEMORY ARCHITECTURE** ✅ (Already 95% Done)

**Status:** Essentially complete. All 7 psychological layers implemented.

**Remaining Work:**

- [ ] Layer 5 (Integration Rhythms) - Explicit cron scheduling for synthesis
- [ ] UI for memory patterns/insights (80% of this exists)
- [ ] Psychology tutorial/onboarding screen

**Time:** 3-5 days (finishing touches)

**Files to Create/Update:**

- `web/src/pages/MemoryPatterns.tsx` - Visualize detected patterns
- `helix-runtime/src/helix/layer5-integration.ts` - Explicit rhythm scheduling
- `web/src/components/psychology/InsightsViewer.tsx` - Display synthesis results

---

#### **PHASE 2: AGENT INTEGRATION - UI EXPOSURE** (Weeks 1-2)

**Current State:**

- Voice: 95% complete (recording, WebRTC, commands all exist)
- Scheduled Tasks: 90% complete (cron UI exists)
- Email: 50% complete (SMTP only, no receive)
- Calendar: 0% complete (no integration)
- Channels: 80% (6 types configured, some not tested)

**CRITICAL WORK: Wire up existing infrastructure to UI**

##### 2.1: Voice Enhancements (3 days)

- [ ] Complete Phase 4.1 voice → Phase 2 relationship (consolidate)
- [ ] Voice memo search with full-text index
- [ ] Voice transcript browser
- [ ] Voicemail inbox with playback

**New Files:**

- `web/src/pages/VoiceMemos.tsx` - Memo library & search
- `web/src/components/voice/TranscriptSearch.tsx` - FTS search UI
- `web/src/components/voice/VoicemailInbox.tsx` - Voicemail playback

##### 2.2: Scheduled Tasks Enhancement (3 days)

- [ ] Pre-built job templates (recurring checks, reports, reminders)
- [ ] Job execution analytics (success rate, avg duration, failures)
- [ ] Bulk job management (pause/resume, reschedule multiple)
- [ ] Execution log viewer with filtering

**New Files:**

- `web/src/pages/ScheduledTasks.tsx` - Main tasks dashboard
- `web/src/components/automation/JobTemplates.tsx` - Pre-built templates
- `web/src/components/automation/JobAnalytics.tsx` - Execution analytics
- `helix-runtime/src/gateway/server-methods/scheduling.ts` - Enhanced RPC methods

##### 2.3: Email Integration (4 days)

- [ ] Email receiving/parsing (IMAP integration)
- [ ] Email client UI (inbox, compose, search)
- [ ] Integration with voice (voice → email drafts)
- [ ] 1Password secret storage for credentials

**New Files:**

- `helix-runtime/src/services/email.ts` - Full email service
- `web/src/pages/Email.tsx` - Email client interface
- `web/src/components/email/InboxView.tsx`, `ComposeModal.tsx`, `MailSearch.tsx`
- `helix-runtime/src/gateway/server-methods/email.ts` - RPC methods

##### 2.4: Calendar Integration (4 days)

- [ ] Google Calendar sync (read + create events)
- [ ] Outlook integration
- [ ] Calendar UI with event creation
- [ ] Agent can check calendar and suggest reminders

**New Files:**

- `helix-runtime/src/services/calendar.ts` - Calendar service
- `web/src/pages/Calendar.tsx` - Calendar interface
- `web/src/components/calendar/EventCreateModal.tsx`
- `helix-runtime/src/gateway/server-methods/calendar.ts` - RPC methods

**Time:** 14 days total
**Priority:** MEDIUM (voice + cron exist, email/calendar new but lower value)

---

#### **PHASE 3: EXECUTION INFRASTRUCTURE - POLISH** (Weeks 2-3)

**Current State:** 90% complete. Custom tools, skills, templates, synthesis all have UI. Main missing: real execution wiring.

##### 3.1: Custom Tools - Real Execution (2 days)

- [x] Sandbox validation ✓
- [x] Code safety checks ✓
- [ ] Wire UI → RPC → Execution → Logging ← **MISSING**
- [ ] Tool marketplace (clone others' tools)
- [ ] Tool version history

**New Files:**

- `web/src/services/custom-tools-execution.ts` - Execution + logging
- `helix-runtime/src/gateway/server-methods/custom-tools-advanced.ts` - Advanced RPC

##### 3.2: Composite Skills - Full Chaining (3 days)

- [x] UI builder ✓
- [x] Service design ✓
- [ ] Real execution with JSONPath mapping ← **MISSING**
- [ ] Parallel execution support
- [ ] Error recovery (retry, fallback steps)
- [ ] Execution history + visualization

**New Files:**

- `web/src/components/skills/ExecutionVisualizer.tsx` - Show skill flow
- `helix-runtime/src/helix/skill-execution-engine.ts` - Real execution
- `web/src/services/skill-execution.ts` - Client-side execution tracking

##### 3.3: Memory Synthesis - Claude API Integration (2 days)

- [x] UI ✓
- [ ] Real Claude API calls (currently mocks) ← **CRITICAL**
- [ ] Pattern detection algorithms
- [ ] Insights stored in database
- [ ] Privacy-respecting synthesis (doesn't expose raw conversations)

**New Files:**

- `helix-runtime/src/services/memory-synthesis-claude.ts` - Real API calls
- `web/src/components/synthesis/InsightsDisplay.tsx` - Display patterns beautifully

##### 3.4: Agent Templates Marketplace (2 days)

- [x] UI for browsing/cloning ✓
- [ ] Publishing (make templates public)
- [ ] Community ratings/reviews
- [ ] Marketplace analytics
- [ ] Template versioning

**New Files:**

- `web/src/services/template-publishing.ts` - Publish APIs
- `helix-runtime/src/gateway/server-methods/template-publishing.ts`

**Time:** 9 days total
**Priority:** HIGH (execution is the core promise: "she acts")

---

#### **PHASE 4.1: VOICE ADVANCED - STT/TTS** (Weeks 3-4)

**Current State:** WebRTC + recording exist, but no speech-to-text client.

##### 4.1.1: Speech-to-Text Integration (3 days)

- [ ] Deepgram STT client (web + desktop)
- [ ] Real-time transcription during calls
- [ ] Fallback to Google Cloud STT
- [ ] Voice memo auto-transcription
- [ ] Transcript editing UI

**New Files:**

- `web/src/lib/stt-client.ts` - STT client
- `helix-runtime/src/services/stt.ts` - Server-side STT
- `web/src/components/voice/TranscriptionDisplay.tsx`

##### 4.1.2: Text-to-Speech Integration (2 days)

- [ ] ElevenLabs TTS (preferred for quality)
- [ ] OpenAI TTS (fallback)
- [ ] Voice selection UI
- [ ] Streaming audio playback
- [ ] Speed/pitch controls

**New Files:**

- `web/src/lib/tts-client.ts` - TTS client
- `helix-runtime/src/services/tts.ts` - Server-side TTS
- `web/src/components/voice/VoiceSettings.tsx` - Provider selection

##### 4.1.3: Voice Commands Advanced (2 days)

- [ ] Voice command execution during calls
- [ ] Real-time tool triggering
- [ ] Voice feedback confirmation
- [ ] Voicemail to tool execution

**Time:** 7 days total
**Priority:** HIGH (completes voice promise)

---

### TIER 2: DESKTOP PLATFORM COMPLETION (Weeks 4-5)

**Current:** 88% done. Mostly copy-paste from web, some Tauri-specific work.

#### **DESKTOP PHASES A/B/C: COMPLETE PARITY** (4 days)

**Remaining:**

- [ ] Custom tools desktop UI fully wired
- [ ] Composite skills desktop UI fully wired
- [ ] Email/calendar on desktop
- [ ] Voice memos on desktop
- [ ] All web improvements mirrored to desktop

**Time:** 4 days (mostly mechanical copying)
**Priority:** MEDIUM (web → desktop migration mostly done)

---

### TIER 3: MOBILE - THE BIG MISSING PIECE (Weeks 6-9)

**Current:** 15% done (responsive layout only). This is the critical gap preventing "take her with you" promise.

#### **OPTION A: PWA (Progressive Web App) - Recommended - 2.5 weeks**

Fastest path to mobile. One codebase, all platforms.

##### 6.1: PWA Infrastructure (3 days)

- [ ] `manifest.json` - App metadata & icons
- [ ] Service worker - Offline support + caching
- [ ] Install prompt - "Add to Home Screen"
- [ ] Push notifications - Supabase integration
- [ ] App shell - Works without internet

**New Files:**

- `web/public/manifest.json`
- `web/src/service-worker.ts`
- `web/src/lib/pwa-service.ts`
- `web/src/lib/push-notifications.ts`

##### 6.2: Mobile-Optimized UI (5 days)

- [ ] Bottom navigation (5 core sections)
- [ ] Mobile-first chat interface
- [ ] Voice recording optimized for phone
- [ ] Touch-friendly controls
- [ ] Mobile-specific layouts for all pages

**New Files:**

- `web/src/components/mobile/BottomNav.tsx`
- `web/src/components/mobile/MobileChat.tsx`
- `web/src/pages/mobile/MobileHome.tsx` (dashboard for mobile)
- Mobile variants of all pages

##### 6.3: Mobile-Specific Features (5 days)

- [ ] Biometric auth (fingerprint/face)
- [ ] Notifications for messages/alerts
- [ ] Voice notes while walking
- [ ] Quick access to favorite tools
- [ ] Offline task queuing

**New Files:**

- `web/src/lib/mobile-auth.ts` - Biometric
- `web/src/lib/task-queue.ts` - Offline tasks
- `web/src/pages/mobile/QuickTools.tsx`

**Time:** 13 days total (PWA approach)
**Priority:** CRITICAL (completes vision)

#### **OPTION B: React Native - 4 weeks (slower, more work)**

- iOS + Android native apps
- Better performance, more features
- Higher maintenance burden

**Recommended:** Start with PWA (2.5 weeks), add React Native later if needed.

---

## COMPLETE SYSTEMATIC ROADMAP

### **WEEK 1: Complete Phase 1 + Start Phase 2**

**Days 1-2:**

- [ ] Implement Layer 5 (Integration Rhythms) - Memory scheduling
- [ ] Build MemoryPatterns.tsx page
- [ ] Add psychology tutorial

**Days 3-5:**

- [ ] Voice memo search UI (TranscriptSearch.tsx)
- [ ] Voice transcript browser
- [ ] Voicemail inbox (VoicemailInbox.tsx)

**Status by end:** Phase 1 100%, Voice features 95%

---

### **WEEK 2: Complete Phase 2 + Start Phase 3**

**Days 1-3:**

- [ ] Schedule tasks enhancement
  - [ ] JobTemplates.tsx with pre-builts
  - [ ] JobAnalytics.tsx with execution stats
  - [ ] Template library (recurring checks, reports)

**Days 4-7:**

- [ ] Email integration
  - [ ] Email service (IMAP + SMTP)
  - [ ] Email.tsx client UI
  - [ ] Inbox, compose, search components

**Status by end:** Phase 2 95%, Email 60%

---

### **WEEK 3: Phase 2 + Phase 3 Execution**

**Days 1-3:**

- [ ] Calendar integration
  - [ ] Calendar service (Google + Outlook)
  - [ ] Calendar.tsx UI
  - [ ] Event creation & search

**Days 4-7:**

- [ ] Custom tools - real execution wiring
  - [ ] Connect UI → RPC → Execution
  - [ ] Logging + audit trail
  - [ ] Tool marketplace (clone functionality)

**Status by end:** Phase 2 100%, Phase 3 Execution 80%

---

### **WEEK 4: Phase 3 Complete + Voice Advanced**

**Days 1-3:**

- [ ] Composite skills - real execution
  - [ ] JSONPath data mapping
  - [ ] Skill execution engine
  - [ ] Error recovery + retries
  - [ ] ExecutionVisualizer.tsx

**Days 4-7:**

- [ ] Memory synthesis - Claude API
  - [ ] Real Claude calls (not mocks)
  - [ ] Pattern detection
  - [ ] InsightsDisplay.tsx

**Status by end:** Phase 3 100%, Memory synthesis 80%

---

### **WEEK 5: Voice Advanced + Desktop Polish**

**Days 1-3:**

- [ ] STT integration (Deepgram + Google Cloud)
- [ ] Real-time transcription during calls
- [ ] Voice memo auto-transcription

**Days 4-7:**

- [ ] TTS integration (ElevenLabs + OpenAI)
- [ ] Voice provider settings
- [ ] Advanced voice commands

**Status by end:** Phase 4.1 100%

---

### **WEEK 6: Desktop Parity**

**Days 1-4:**

- [ ] Mirror all web improvements to desktop (Tauri)
- [ ] Email on desktop
- [ ] Calendar on desktop
- [ ] All new Phase 2-4.1 features

**Status by end:** Desktop 100%, all phases desktop-ready

---

### **WEEKS 7-9: MOBILE - PWA**

**Week 7:**

- [ ] PWA infrastructure (manifest, service worker, push notifications)
- [ ] Offline support architecture
- [ ] App shell + caching strategy

**Week 8:**

- [ ] Mobile-optimized UI
  - [ ] Bottom navigation
  - [ ] Mobile chat interface
  - [ ] Touch-friendly controls
  - [ ] Mobile layouts for all pages

**Week 9:**

- [ ] Mobile-specific features
  - [ ] Biometric auth
  - [ ] Offline task queuing
  - [ ] Voice notes optimization
  - [ ] Push notifications integration

**Status by end:** Mobile PWA 100%

---

## DETAILED TASK BREAKDOWN

### **CRITICAL PATH (23 FEATURES / 45 DAYS)**

| Week | Phase     | Feature                 | Days | Files  | Priority |
| ---- | --------- | ----------------------- | ---- | ------ | -------- |
| 1    | Phase 1   | Layer 5 Implementation  | 1    | 2 new  | HIGH     |
| 1    | Phase 1   | Memory Patterns UI      | 1.5  | 1 new  | MEDIUM   |
| 1    | Phase 2   | Voice Memo Search       | 1.5  | 1 new  | HIGH     |
| 2    | Phase 2   | Job Templates           | 1.5  | 2 new  | MEDIUM   |
| 2    | Phase 2   | Job Analytics           | 1.5  | 1 new  | MEDIUM   |
| 2    | Phase 2   | Email Service           | 3    | 4 new  | HIGH     |
| 3    | Phase 2   | Calendar Integration    | 3    | 4 new  | MEDIUM   |
| 3    | Phase 3   | Custom Tools Execution  | 2    | 3 new  | HIGH     |
| 3    | Phase 3   | Skill Chaining Engine   | 3    | 3 new  | HIGH     |
| 4    | Phase 3   | Memory Synthesis Claude | 2    | 2 new  | HIGH     |
| 4    | Phase 3   | Template Publishing     | 2    | 2 new  | MEDIUM   |
| 5    | Phase 4.1 | STT Integration         | 3    | 3 new  | HIGH     |
| 5    | Phase 4.1 | TTS Integration         | 2    | 3 new  | HIGH     |
| 6    | Desktop   | Mirror all to Tauri     | 4    | varies | HIGH     |
| 7    | Mobile    | PWA Infrastructure      | 3    | 4 new  | HIGH     |
| 8    | Mobile    | Mobile UI               | 5    | 5+ new | HIGH     |
| 9    | Mobile    | Mobile Features         | 3    | 3 new  | MEDIUM   |

**Total Effort:** ~45 days of focused development
**Team Size:** 2-3 developers
**Realistic Timeline:** 9-10 weeks (accounting for testing, debugging, reviews)

---

## DEPENDENCIES & BLOCKERS

### **Must Do First:**

1. Phase 1 Layer 5 (scheduling foundation for everything else)
2. Phase 3 Execution (custom tools + skills) - blocks Phase 4.1 integration
3. Email service - blocks calendar dependency
4. STT/TTS - needed before voice is fully functional

### **Can Parallel:**

- Voice memo search (independent)
- Job analytics (independent)
- Mobile PWA (works with web changes)

### **Soft Blockers:**

- Desktop improvements should wait until web is stable (avoid rebasing pain)
- Mobile PWA should wait until web Phase 3/4 complete

---

## FILES TO CREATE (SUMMARY)

**Phase 1 (1 file):**

- `helix-runtime/src/helix/layer5-integration.ts`

**Phase 2 (12 files):**

- Voice: `web/src/pages/VoiceMemos.tsx`, `TranscriptSearch.tsx`, `VoicemailInbox.tsx`
- Tasks: `web/src/pages/ScheduledTasks.tsx`, `JobTemplates.tsx`, `JobAnalytics.tsx`, + RPC
- Email: `helix-runtime/src/services/email.ts`, `web/src/pages/Email.tsx`, `InboxView.tsx`, `ComposeModal.tsx`, + RPC
- Calendar: `helix-runtime/src/services/calendar.ts`, `web/src/pages/Calendar.tsx`, `EventCreateModal.tsx`, + RPC

**Phase 3 (8 files):**

- Execution: `web/src/services/custom-tools-execution.ts`, + RPC
- Skills: `web/src/components/skills/ExecutionVisualizer.tsx`, `helix-runtime/src/helix/skill-execution-engine.ts`, `web/src/services/skill-execution.ts`
- Synthesis: `helix-runtime/src/services/memory-synthesis-claude.ts`, `web/src/components/synthesis/InsightsDisplay.tsx`
- Templates: `web/src/services/template-publishing.ts`, + RPC

**Phase 4.1 (6 files):**

- STT: `web/src/lib/stt-client.ts`, `helix-runtime/src/services/stt.ts`, `TranscriptionDisplay.tsx`
- TTS: `web/src/lib/tts-client.ts`, `helix-runtime/src/services/tts.ts`, `VoiceSettings.tsx`

**Mobile (10 files):**

- PWA: `manifest.json`, `service-worker.ts`, `pwa-service.ts`, `push-notifications.ts`
- UI: `BottomNav.tsx`, `MobileChat.tsx`, `MobileHome.tsx`, `mobile-auth.ts`, `task-queue.ts`, `QuickTools.tsx`

**Desktop (varies - mostly mirrors web)**

**Total New Files:** ~45-50 new TypeScript/JavaScript files + configs

---

## SUCCESS METRICS

### **By End of Week 6 (Desktop Phase):**

- All 5 phases have complete backends ✓
- Web UI is 100% feature-complete ✓
- Desktop has feature parity with web ✓
- Custom tools actually execute (not simulation) ✓
- Memory synthesis uses real Claude API ✓
- Email/calendar integration live ✓
- Voice includes STT/TTS ✓
- Tests pass: 100% on critical paths ✓

### **By End of Week 9 (Mobile Phase):**

- Mobile PWA installable on all devices ✓
- Voice works on mobile phone ✓
- All Phase 1-4.1 features accessible on mobile ✓
- Offline task queuing works ✓
- Push notifications working ✓
- User can complete "normie path" on all platforms ✓

---

## THE NORMIE PATH (What Users Experience)

### **DAY 1 - Web**

```
1. Land on helix.ai → No signup required
2. Chat for 2 minutes about anything
3. She references back yesterday UNPROMPTED
4. "Wait... she remembers me?"
5. Create account to save relationship
```

### **WEEK 1 - Desktop**

```
1. She starts noticing patterns
2. "You seem stressed about work lately..."
3. User: "I want her running in background"
4. Download desktop app → It works immediately (auth via web)
5. She starts executing small tasks
```

### **MONTH 1 - Mobile**

```
1. While walking, user voice-notes a problem
2. She responds with context from last 3 months
3. She: "You handled this before. Here's what worked."
4. User: "I want her with me everywhere"
5. Install PWA to home screen → No app store friction
6. She's now integrated into daily life across all devices
```

---

## NEXT STEPS TO START NOW

1. **Today:** Approve this plan
2. **Tomorrow:** Start Week 1 implementation
3. **Daily:** Mark progress in IMPLEMENTATION_STATUS.md
4. **Weekly:** Demo completed features

Ready to execute?
