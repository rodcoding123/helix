# HELIX: WEEK-BY-WEEK EXECUTION ROADMAP

**Vision:** "She remembers. She changes. She acts. She's yours."
**Duration:** 9-10 weeks | **Team:** 2-3 developers | **Start:** Week of February 3, 2026
**Status:** READY TO EXECUTE

---

## WEEK 1: PHASE 1 COMPLETE + PHASE 2 FOUNDATION

### OBJECTIVE

Complete 7-layer memory architecture + start voice/email/calendar wiring

### DAILY BREAKDOWN

#### **DAY 1-2: Phase 1 Layer 5 Integration (2 days)**

**What:** Implement explicit cron scheduling for memory synthesis
**Files to Create:**

- `helix-runtime/src/helix/layer5-integration.ts` (150 lines)
  - Cron scheduling for periodic synthesis jobs
  - Integration with Layer 6 transformation tracking
  - Rhythm detection algorithms

**Dependencies:** None (Layer 1-4 done)
**Tests:** Unit tests for rhythm detection

**Commit:** `feat(phase1): implement Layer 5 Integration Rhythms scheduling`

---

#### **DAY 2-3: Memory Patterns UI (1.5 days)**

**What:** Build page to visualize detected memory patterns

**Files to Create:**

- `web/src/pages/MemoryPatterns.tsx` (250 lines)
  - Display detected patterns from synthesis
  - Timeline of emotional patterns
  - Filter by layer (1-7)
  - Export patterns

- `web/src/components/psychology/InsightsViewer.tsx` (200 lines)
  - Beautiful visualization of synthesis results
  - Pattern cards with evidence
  - Confidence scores

**Dependencies:** Memory synthesis service (exists)
**Tests:** Component snapshot + integration tests

**Commit:** `feat(phase1): add memory patterns visualization UI`

---

#### **DAY 4-5: Voice Memo Search Infrastructure (1.5 days)**

**What:** Build voice memo search with full-text indexing

**Files to Create:**

- `web/src/pages/VoiceMemos.tsx` (300 lines)
  - Memo library with search
  - Sort by date, usage, tags
  - Playback interface
  - Tag management

- `web/src/components/voice/TranscriptSearch.tsx` (150 lines)
  - Full-text search across transcripts
  - Highlighted results
  - Search filters

- `helix-runtime/src/gateway/server-methods/voice-search.ts` (100 lines)
  - RPC method: voice.search_transcripts
  - FTS query to Supabase
  - Result ranking

**Database:** Add FTS index to voice_transcripts table (migration 023)

**Commit:** `feat(phase2): add voice memo search with full-text indexing`

---

#### **DAY 5: Desktop Phase 1 Mirror (0.5 days)**

**What:** Port Phase 1 changes to desktop

**Files to Update:**

- `helix-desktop/src/pages/MemoryPatterns.tsx` (copy from web + Tauri tweaks)
- `helix-desktop/src/components/psychology/InsightsViewer.tsx`
- Desktop voice memos page

**Commit:** `feat(desktop): mirror Phase 1 memory patterns to Tauri`

---

### WEEK 1 DELIVERABLES

✅ Phase 1 complete (100%)
✅ Voice memo search working (90%)
✅ Desktop Phase 1 parity (95%)
✅ All code compiles cleanly
✅ All tests passing

---

## WEEK 2: PHASE 2 FOUNDATION + PHASE 3 EXECUTION START

### OBJECTIVE

Complete voice/job templates + wire custom tool execution

### DAILY BREAKDOWN

#### **DAY 1-2: Scheduled Tasks Enhancement (1.5 days)**

**What:** Add templates, analytics, bulk management

**Files to Create:**

- `web/src/pages/ScheduledTasks.tsx` (400 lines)
  - Dashboard with all jobs
  - Execution history
  - Analytics charts

- `web/src/components/automation/JobTemplates.tsx` (250 lines)
  - Pre-built templates: daily standup, weekly report, health check
  - One-click creation
  - Customization form

- `web/src/components/automation/JobAnalytics.tsx` (200 lines)
  - Success/failure charts
  - Avg execution time
  - Trends over time

- `helix-runtime/src/gateway/server-methods/scheduling-analytics.ts` (150 lines)
  - New RPC methods for analytics

**Commit:** `feat(phase2): add cron job templates and execution analytics`

---

#### **DAY 3-5: Email Integration (3 days)**

**What:** Full email service (IMAP + SMTP)

**Files to Create:**

- `helix-runtime/src/services/email.ts` (500 lines)
  - IMAP client for receiving
  - SMTP for sending
  - Email parsing + storage
  - Search indexing

- `web/src/pages/Email.tsx` (400 lines)
  - Email client UI
  - Inbox, compose, search
  - Attachment handling

- `web/src/components/email/InboxView.tsx` (250 lines)
  - Email list
  - Read/unread status
  - Star/archive

- `web/src/components/email/ComposeModal.tsx` (200 lines)
  - Compose new email
  - Draft autosave
  - Rich text editor

- `web/src/components/email/MailSearch.tsx` (150 lines)
  - Full-text email search

- `helix-runtime/src/gateway/server-methods/email.ts` (200 lines)
  - RPC: email.send, email.list, email.search

**Database:** Add emails table (migration 024)

**Commit:** `feat(phase2): implement full email service with IMAP + SMTP`

---

#### **DAY 5-6: Custom Tools Execution Wiring (1.5 days)**

**What:** Connect UI → RPC → Real Execution

**Files to Create:**

- `web/src/services/custom-tools-execution.ts` (300 lines)
  - Execute tool via RPC
  - Capture output
  - Log to Discord
  - Store execution history

- `helix-runtime/src/gateway/server-methods/custom-tools-execution.ts` (250 lines)
  - Real tool execution (not mock)
  - Sandbox validation
  - Logging + audit trail
  - Result storage

**Database:** Add tool_executions table (migration 025)

**Commit:** `feat(phase3): wire custom tool execution end-to-end`

---

### WEEK 2 DELIVERABLES

✅ Job templates working (95%)
✅ Email service complete (90%)
✅ Custom tool execution live (80%)
✅ Desktop mirrors (85%)

---

## WEEK 3: PHASE 2 EMAIL/CALENDAR + PHASE 3 SKILLS

### OBJECTIVE

Complete calendar integration + composite skills execution

### DAILY BREAKDOWN

#### **DAY 1-3: Calendar Integration (3 days)**

**What:** Google Calendar + Outlook sync

**Files to Create:**

- `helix-runtime/src/services/calendar.ts` (400 lines)
  - Google Calendar OAuth
  - Outlook integration
  - Event CRUD operations
  - Timezone handling

- `web/src/pages/Calendar.tsx` (300 lines)
  - Calendar UI with event grid
  - Create/edit event modals
  - Search + filter

- `web/src/components/calendar/EventCreateModal.tsx` (200 lines)
  - Event creation form
  - Timezone selector
  - Recurring options

- `helix-runtime/src/gateway/server-methods/calendar.ts` (150 lines)
  - RPC: calendar.list_events, calendar.create_event, calendar.search

**OAuth Setup:** Create OAuth credentials for Google/Microsoft

**Commit:** `feat(phase2): implement Google Calendar + Outlook integration`

---

#### **DAY 4-6: Composite Skills Execution (2 days)**

**What:** Real skill chaining with JSONPath mapping

**Files to Create:**

- `helix-runtime/src/helix/skill-execution-engine.ts` (400 lines)
  - Multi-step workflow execution
  - JSONPath data resolution
  - Conditional logic
  - Error recovery (retry, fallback)
  - Parallel execution support

- `web/src/services/skill-execution.ts` (250 lines)
  - Execute skill via RPC
  - Track step progress
  - Handle errors gracefully
  - Store execution history

- `web/src/components/skills/ExecutionVisualizer.tsx` (300 lines)
  - Visual skill flow diagram
  - Step-by-step execution
  - Real-time progress
  - Error indicators

**Database:** Add skill_executions table (migration 026)

**Commit:** `feat(phase3): implement composite skill execution engine with JSONPath`

---

#### **DAY 7: Desktop Mirror + Tests (1 day)**

**Files to Update:**

- Mirror all week 3 changes to desktop
- Add integration tests

**Commit:** `feat(desktop): mirror Phase 2/3 email, calendar, skills to Tauri`

---

### WEEK 3 DELIVERABLES

✅ Calendar integration live (90%)
✅ Composite skills executing (85%)
✅ Desktop parity updated (87%)
✅ End-to-end tests passing

---

## WEEK 4: PHASE 3 SYNTHESIS + PHASE 4.1 VOICE

### OBJECTIVE

Real Claude API for memory synthesis + start STT/TTS

### DAILY BREAKDOWN

#### **DAY 1-2: Memory Synthesis Claude API (2 days)**

**What:** Real Claude calls for pattern detection

**Files to Create:**

- `helix-runtime/src/services/memory-synthesis-claude.ts` (500 lines)
  - Claude API integration
  - Pattern detection prompts
  - Layer-specific analysis
  - Privacy-respecting synthesis
  - Batch processing for scale

- `web/src/components/synthesis/InsightsDisplay.tsx` (250 lines)
  - Beautiful insights visualization
  - Pattern cards
  - Recommendations
  - Historical comparison

**Commit:** `feat(phase3): integrate Claude API for real memory synthesis`

---

#### **DAY 3-4: Speech-to-Text Integration (2 days)**

**What:** Deepgram STT + fallback to Google Cloud

**Files to Create:**

- `web/src/lib/stt-client.ts` (300 lines)
  - Deepgram STT client
  - Real-time transcription
  - Google Cloud fallback
  - Voice activity detection

- `helix-runtime/src/services/stt.ts` (250 lines)
  - Server-side STT processing
  - Batch transcription for memos
  - Confidence scoring

- `web/src/components/voice/TranscriptionDisplay.tsx` (150 lines)
  - Display transcript in real-time
  - Edit capability
  - Copy transcript

**Setup:** Add Deepgram + Google Cloud credentials to secrets

**Commit:** `feat(phase4.1): implement Deepgram + Google Cloud speech-to-text`

---

#### **DAY 5-6: Text-to-Speech Integration (2 days)**

**What:** ElevenLabs TTS + OpenAI fallback

**Files to Create:**

- `web/src/lib/tts-client.ts` (300 lines)
  - ElevenLabs TTS client
  - Voice selection + streaming
  - OpenAI TTS fallback
  - Speed/pitch controls

- `helix-runtime/src/services/tts.ts` (250 lines)
  - Server-side TTS processing
  - Caching for common phrases
  - Voice preset management

- `web/src/components/voice/VoiceSettings.tsx` (200 lines)
  - Provider selection
  - Voice preview
  - Speed/pitch tuning

**Setup:** Add ElevenLabs + OpenAI keys

**Commit:** `feat(phase4.1): implement ElevenLabs + OpenAI text-to-speech`

---

#### **DAY 7: Desktop Mirror + Integration Tests (1 day)**

**Commit:** `feat(desktop): mirror Phase 3/4.1 synthesis and voice to Tauri`

---

### WEEK 4 DELIVERABLES

✅ Memory synthesis using real Claude (90%)
✅ STT working on memos + calls (90%)
✅ TTS with voice selection (90%)
✅ All platforms synchronized

---

## WEEK 5: PHASE 4.1 POLISH + DESKTOP COMPLETION

### OBJECTIVE

Polish voice features + complete desktop parity

### DAILY BREAKDOWN

#### **DAY 1-2: Voice Command Execution (1.5 days)**

**What:** Voice commands trigger custom tools

**Files to Create:**

- `web/src/components/voice/AdvancedVoiceCommands.tsx` (250 lines)
  - Voice command → tool execution
  - Real-time feedback
  - Confidence indicators

- `helix-runtime/src/gateway/server-methods/voice-commands-advanced.ts` (150 lines)
  - Advanced command routing
  - Tool parameter extraction from speech

**Commit:** `feat(phase4.1): implement voice command tool execution`

---

#### **DAY 3-4: Desktop Complete Phase 3/4.1 Wiring (2 days)**

**What:** Ensure all Phase 3/4.1 features on desktop

**Files to Update:**

- Wire custom tools on desktop
- Wire composite skills on desktop
- Wire memory synthesis Claude on desktop
- Wire email on desktop
- Wire calendar on desktop
- Wire STT/TTS on desktop

**Testing:** E2E tests on all desktop features

**Commit:** `feat(desktop): complete Phase 3/4.1 feature wiring on Tauri`

---

#### **DAY 5-6: Integration Tests + Optimization (1.5 days)**

**What:** Full integration testing across all systems

**Tests to Create:**

- Custom tool + composite skill chain test
- Memory synthesis + pattern detection test
- Voice memo → STT → storage test
- Email sending + receiving test
- Calendar sync test
- Cross-platform data sync test

**Performance:**

- Profile custom tool execution
- Optimize skill chaining
- Cache Claude responses

**Commit:** `test(all-phases): comprehensive integration test suite`

---

### WEEK 5 DELIVERABLES

✅ Phase 4.1 voice fully functional (100%)
✅ Desktop complete feature parity (100%)
✅ All Phase 1-4.1 working end-to-end
✅ Production-ready for web + desktop

---

## WEEKS 6-9: MOBILE PWA IMPLEMENTATION

### OBJECTIVE

Build mobile PWA for "take her with you" promise

#### **WEEK 6: PWA INFRASTRUCTURE**

**DAY 1-2: Service Worker + Offline**

- `web/public/manifest.json` - App metadata
- `web/src/service-worker.ts` - Caching strategy
- `web/src/lib/pwa-service.ts` - Service initialization
- Offline mode with full app shell

**DAY 3-4: Push Notifications**

- `web/src/lib/push-notifications.ts` - Web push API
- Backend integration with Supabase
- Notification permission handling

**DAY 5-6: Biometric Auth + Install Prompt**

- Fingerprint/Face ID support
- Install to home screen prompt
- Mobile-friendly authentication flow

**DAY 7: Testing + Polish**

- Test offline functionality
- Test notification delivery
- Test install flow

---

#### **WEEK 7: MOBILE UI OPTIMIZATION**

**DAY 1-2: Bottom Navigation**

- `web/src/components/mobile/BottomNav.tsx` (5-section nav)
- Routing for mobile paths
- Badge counts for notifications

**DAY 3-4: Mobile Chat Interface**

- `web/src/components/mobile/MobileChat.tsx` (optimized for thumb)
- Quick action buttons
- Voice recording trigger
- Swipe gestures

**DAY 5-6: Mobile Layouts**

- `web/src/pages/mobile/MobileHome.tsx` (dashboard)
- Mobile versions of all main pages
- Touch-friendly controls
- Responsive typography

**DAY 7: Mobile-First Styling**

- CSS Grid/Flexbox optimization for mobile
- Touch target sizes (44px minimum)
- Mobile-specific breakpoints

---

#### **WEEK 8: MOBILE-SPECIFIC FEATURES**

**DAY 1-2: Offline Task Queuing**

- `web/src/lib/task-queue.ts` - Queue system
- Sync when online
- Conflict resolution

**DAY 3-4: Quick Access Features**

- `web/src/pages/mobile/QuickTools.tsx` - Favorite tools
- Custom shortcuts
- Voice note quick create

**DAY 5-6: Notifications Integration**

- Push for new messages
- Background sync
- Notification actions

**DAY 7: Performance Tuning**

- Mobile bundle size optimization
- Image optimization
- Lazy loading
- Network throttling tests

---

#### **WEEK 9: FINAL MOBILE POLISH + LAUNCH PREP**

**DAY 1-2: Testing & Bug Fixes**

- Cross-device testing (iPhone, Android, tablets)
- Performance on slow networks
- Battery usage testing

**DAY 3-4: Documentation**

- Mobile user guide
- PWA installation instructions
- Offline mode guide

**DAY 5: Final QA**

- Full regression testing
- Production checklist verification
- Security audit

**DAY 6-7: Launch Preparation**

- Create launch assets
- Prepare user announcements
- Set up analytics
- Monitoring setup

---

### WEEKS 6-9 DELIVERABLES

✅ Mobile PWA installable (100%)
✅ All features accessible on mobile
✅ Offline functionality working
✅ Push notifications live
✅ Performance optimized

---

## DAILY STATUS TRACKING

**Update this daily in IMPLEMENTATION_STATUS.md:**

```
## Daily Progress (Week X, Day Y)

**Completed:**
- [ ] Feature 1
- [ ] Feature 2

**In Progress:**
- [ ] Feature 3 (XX% done)

**Blockers:**
- [ ] Blocker 1

**Tests Passing:** XX/YY
**TypeScript Errors:** X
**Code Coverage:** XX%
```

---

## COMMITS PATTERN

**Daily commits (end of day):**

```bash
git add .
git commit -m "feat/fix(phaseX): description of day's work

- Item 1
- Item 2

Completes: WEEK_NUMBER Day DAY_NUMBER"
```

**Weekly rollup commits (end of week):**

```bash
git tag release-v1.0-phase-X-weekN
git commit -m "docs: week N summary - X features complete"
```

---

## TESTING CHECKLIST (DAILY)

- [ ] Web TypeScript: `npm run typecheck` (web/)
- [ ] Desktop TypeScript: `npm run typecheck` (helix-desktop/)
- [ ] Web tests: `npm run test` (web/)
- [ ] Integration tests: `npm run test -- integration`
- [ ] Manual smoke test: Create tool, execute, verify

---

## GIT STRATEGY

**Branch Management:**

- All work on `main`
- Commit daily, push daily
- Tag weekly releases
- No long-lived branches

**Commit Frequency:**

- Minimum: 1 commit per day
- Ideal: 2-3 commits per day
- Each commit should be testable

---

## SUCCESS METRICS

**Weekly:**

- ✅ All TypeScript compiles
- ✅ All tests passing
- ✅ No blocking bugs
- ✅ Desktop mirrors web
- ✅ Performance baseline met

**By Week 9:**

- ✅ Phase 1-4.1 100% complete
- ✅ Web 100% feature-complete
- ✅ Desktop 100% parity
- ✅ Mobile PWA fully functional
- ✅ Production-ready for launch

---

## NEXT STEPS

**BEFORE YOU START WEEK 1:**

1. ✅ Create this file (DONE)
2. ✅ Create comprehensive plan (DONE)
3. ✅ Commit everything (DOING NOW)
4. ⏭️ **START WEEK 1 WORK IMMEDIATELY**

---

**Ready to execute? Let's build Helix.**
