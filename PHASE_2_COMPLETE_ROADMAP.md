# Phase 2 Implementation Roadmap - 5 Week Complete Plan

**Date:** February 3, 2026
**Status:** Week 3 Complete, Weeks 4-5 Planned
**Total Scope:** 7 Tracks, 200+ hours, 15,000+ lines of production code
**Goal:** Complete Phase 2 (Custom Tools, Composite Skills, Memory Synthesis, Email, Calendar, Voice, Mobile PWA)

---

## PHASE 2 OVERVIEW

| Week | Track            | Feature                              | Status      | Details             |
| ---- | ---------------- | ------------------------------------ | ----------- | ------------------- |
| 1-2  | T1-2, T6.1, T8   | Layer 5 + Voice + PWA                | ✅ COMPLETE | 64 tests, 3,200 LOC |
| 3    | T3               | Email Integration                    | ✅ COMPLETE | 53 tests, 3,950 LOC |
| 4    | T4               | Calendar Foundation                  | 🔄 PLANNED  | 40 hours, 20 tests  |
| 5    | T5, T6.2-6.3, T7 | Voice Recording + Mobile PWA + Tests | 🔄 PLANNED  | 80 hours, 40 tests  |

---

## WEEK 3 COMPLETION SUMMARY ✅

**Track 3: Email Integration (COMPLETE)**

- Task 3.1: Database schema (5 tables, 15+ indexes)
- Task 3.2: RPC methods (14 handlers, 1,052 lines)
- Task 3.3: React components (6 components, 2,512 lines)
- Tests: 53 passing (19 RPC + 34 component)
- Commits: 3 (database + RPC + UI)
- Code Quality: 0 errors, 100% tests passing

**Cumulative Progress:**

- Production Code: 7,150 lines (Week 2: 3,200 + Week 3: 3,950)
- Tests Passing: 117 (Week 2: 64 + Week 3: 53)
- Features Complete: 3 major (Layer 5, Voice, Email)
- Commits: 7 total

---

## WEEK 4 TRACK DETAILS

### Track 4: Phase 2 Calendar Foundation (40 hours)

**Goal:** Gmail-style calendar with event sync, recurring rules, and Layer 5 integration

#### Task 4.1: Calendar Database Schema (8 hours)

**Files:**

- `web/supabase/migrations/030_calendar_integration.sql` (NEW)

**Tables:**

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id), -- Sync source (Google Calendar, iCal, etc.)
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  attendees JSONB, -- [{ email, name, status: 'accepted'|'pending'|'declined' }]
  recurrence_rule TEXT, -- RFC 5545 RRULE format
  event_id TEXT, -- Provider's event ID (for sync)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, event_id)
);

CREATE TABLE calendar_attendees (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT, -- 'accepted', 'pending', 'declined'
  response_date TIMESTAMP
);

CREATE TABLE calendar_sync_log (
  id UUID PRIMARY KEY,
  account_id UUID,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT, -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**

- Full-text search on event title + description
- Recurrence rule support (RFC 5545 RRULE)
- Attendee RSVP tracking
- Multi-account calendar sync (Google, Outlook, iCal)
- Integration with email attendees

#### Task 4.2: Calendar RPC Methods (16 hours)

**File:**

- `helix-runtime/src/gateway/server-methods/calendar.ts` (NEW - 800 lines)

**RPC Methods:**

- `calendar.add_event` - Create new event
- `calendar.get_events` - Get events for date range
- `calendar.search_events` - Full-text search
- `calendar.update_event` - Edit event
- `calendar.delete_event` - Delete event
- `calendar.create_recurring` - Create recurring event (RRULE)
- `calendar.update_attendees` - Manage attendees
- `calendar.sync_calendar` - Sync with external calendar
- `calendar.get_sync_status` - Check sync progress
- `calendar.get_calendar_view` - Get month/week/day view

#### Task 4.3: Calendar React Component (16 hours)

**Files:**

- `web/src/pages/CalendarView.tsx` (NEW - 400 lines)
- `web/src/components/calendar/CalendarGrid.tsx` (NEW - 350 lines)
- `web/src/components/calendar/EventDetail.tsx` (NEW - 200 lines)
- `web/src/components/calendar/CreateEventModal.tsx` (NEW - 250 lines)
- `web/src/hooks/useCalendarClient.ts` (NEW - 200 lines)
- `web/src/__tests__/CalendarView.test.tsx` (NEW - 400 lines, 20 tests)

**Features:**

- Month/week/day view toggle
- Event creation/editing modal
- Recurring event support
- Attendee RSVP display
- Color-coded event types
- Drag-and-drop rescheduling
- Integration with email attendees

#### Timeline for Track 4:

- Monday-Tuesday: Database schema (Task 4.1)
- Wednesday-Thursday: RPC methods (Task 4.2)
- Friday: React components (Task 4.3)
- Continuous: Testing (20 tests, all passing)
- Friday EOD: Commit and ready for Week 5

---

## WEEK 5 TRACK DETAILS

### Track 5: Phase 2 Voice Recording UI (24 hours)

**Goal:** Real-time voice recording with transcription and synthesis integration

#### Task 5.1: Voice Recording Component (24 hours)

**Files:**

- `web/src/components/voice/VoiceRecorder.tsx` (NEW - 350 lines)
- `web/src/components/voice/AudioVisualizer.tsx` (NEW - 200 lines)
- `web/src/hooks/useVoiceRecorder.ts` (NEW - 250 lines)
- `helix-desktop/src/commands/audio.rs` (NEW - 300 lines - Tauri audio capture)
- `web/src/__tests__/VoiceRecorder.test.tsx` (NEW - 300 lines, 15 tests)

**Features:**

- Real-time audio visualization
- Recording timer with MM:SS format
- MediaRecorder API (web) + Tauri audio (desktop)
- Auto-transcription via Deepgram API
- Tag-based organization
- Keyword extraction for synthesis
- Save to database with metadata

---

### Track 6.2-6.3: Mobile PWA (24 hours)

**Goal:** Responsive mobile components with offline sync

#### Task 6.2: Mobile Responsive Components (12 hours)

**Files:**

- `web/src/components/mobile/MobileEmailList.tsx` (NEW - 200 lines)
- `web/src/components/mobile/MobileCalendarView.tsx` (NEW - 200 lines)
- `web/src/components/mobile/MobileVoiceMemos.tsx` (NEW - 150 lines)
- Tailwind breakpoints for mobile-first design

**Features:**

- Responsive breakpoints (sm, md, lg, xl)
- Touch-optimized UI (larger tap targets)
- Mobile navigation drawer
- Bottom sheet for modals
- Swipe gestures

#### Task 6.3: Offline Sync Database (12 hours)

**Files:**

- `web/src/lib/offline-sync.ts` (NEW - 300 lines)
- Supabase migrations for offline queue

**Features:**

- LocalStorage queue for offline actions
- Sync when reconnected
- Conflict resolution
- State reconciliation

---

### Track 7: Integration Tests (32 hours)

**Goal:** E2E tests across web/desktop/mobile, cross-platform sync verification

#### Task 7.1: E2E Test Suite (16 hours)

**Files:**

- `web/tests/e2e/phase2-complete.spec.ts` (NEW - 1000 lines, 25 tests)

**Test Scenarios:**

- Complete email workflow (add account → sync → send)
- Calendar multi-account sync
- Voice recording → transcription → synthesis
- Cross-platform sync (web → desktop → mobile)
- Offline → online transitions
- Concurrent operations (email + calendar + voice)

#### Task 7.2: Performance & Security Tests (16 hours)

**Tests:**

- Virtual scrolling performance (1000+ items)
- Search debouncing verification
- XSS attack vectors
- CSRF protection
- Rate limiting
- Memory leak detection
- Bundle size verification

---

## COMPLETE 5-WEEK TIMELINE

```
WEEK 1-2: Core Infrastructure
├── Track 1: Layer 5 Desktop (Memory Patterns, Scheduler)
├── Track 2: Voice Foundation (Desktop + PWA)
├── Track 6.1: Service Worker + offline support
├── Track 8: Documentation + status
└── Result: 64 tests, 3,200 LOC ✅

WEEK 3: Email Integration
├── Track 3.1: Database (5 tables, 15+ indexes)
├── Track 3.2: RPC (14 methods)
├── Track 3.3: React (6 components)
└── Result: 53 tests, 3,950 LOC ✅

WEEK 4: Calendar Foundation
├── Track 4.1: Database (3 tables, sync tracking)
├── Track 4.2: RPC (10 methods)
├── Track 4.3: React (5 components)
└── Result: 20 tests, 3,200 LOC (projected)

WEEK 5: Voice Recording + Mobile + Integration
├── Track 5: Voice Recording (audio + transcription)
├── Track 6.2-6.3: Mobile PWA (responsive + offline)
├── Track 7: E2E Tests (25 tests, full integration)
└── Result: 40 tests, 3,100 LOC (projected)

TOTAL PHASE 2:
├── Production Code: 15,000+ lines
├── Tests: 177+ (all passing)
├── Features: 7 tracks complete
├── Database: 25+ tables
├── Components: 25+ major
└── Quality: Zero errors, 100% test pass rate
```

---

## EXECUTION STRATEGY FOR WEEKS 4-5

### Track 4 (Calendar) - Sequential Execution

**Day 1 (Monday):** Database schema + migrations

- Create 3 tables (calendar_events, calendar_attendees, calendar_sync_log)
- Add 10+ indexes for event search and sync tracking
- Verify schema with SQL tests
- Commit: "feat(database): add calendar schema with event sync tracking"

**Day 2-3 (Tuesday-Wednesday):** RPC Methods

- Implement 10 RPC handlers (500 lines each)
- Calendar view queries (month/week/day)
- Recurring event RRULE parsing
- Attendee RSVP management
- Test with 10 RPC tests
- Commit: "feat(calendar): implement RPC methods for event management"

**Day 4-5 (Thursday-Friday):** React Components

- CalendarView page (month/week/day toggle)
- Event detail modal with attendee management
- Create event modal with recurrence rules
- Color-coded event types
- Custom hook (useCalendarClient)
- Test with 10 component tests
- Commit: "feat(calendar): implement CalendarView with 5 components and tests"

### Track 5 (Voice Recording) - Day 1-2 (Monday-Tuesday)

**Task 5.1:** Voice Recorder component

- Real-time audio visualization
- Recording timer
- Transcription integration (Deepgram)
- Tag management
- Test with 15 tests
- Commit: "feat(voice): implement voice recording with real-time transcription"

### Track 6.2-6.3 (Mobile PWA) - Day 3-4 (Wednesday-Thursday)

**Mobile components:**

- Responsive breakpoints (Tailwind)
- Touch-optimized UI
- Mobile navigation
- Test with 10 tests

**Offline sync:**

- LocalStorage queue
- Sync reconciliation
- Conflict resolution
- Test with 10 tests

Commit: "feat(mobile): add responsive PWA components with offline sync"

### Track 7 (Integration Tests) - Day 5 (Friday)

**E2E test suite:**

- Full email workflow (25 tests)
- Calendar sync validation
- Voice recording pipeline
- Cross-platform integration
- Performance benchmarks

Commit: "test(phase2): add 25 E2E integration tests for complete Phase 2"

---

## DEPLOYMENT & VERIFICATION

After Week 5 completion:

1. **Full Test Suite:**

   ```bash
   npm run test
   # Expected: 177+ tests passing
   ```

2. **Type Checking:**

   ```bash
   npm run typecheck
   # Expected: 0 errors
   ```

3. **Code Quality:**

   ```bash
   npm run quality
   # ESLint: 0 violations
   # Prettier: 0 issues
   # Tests: 100% passing
   ```

4. **Desktop Build:**

   ```bash
   npm run desktop:build
   # All components compiled
   # Layer 5 + Voice + Email working
   ```

5. **Final Verification:**
   - Email account creation → sync → send ✓
   - Calendar event creation → attendee sync ✓
   - Voice recording → transcription → synthesis ✓
   - Web/Desktop/Mobile feature parity ✓
   - Offline → online sync ✓

---

## SUCCESS CRITERIA

**Code Quality:**

- ✅ 0 TypeScript errors
- ✅ 100% test pass rate (177+ tests)
- ✅ ESLint compliant
- ✅ DOMPurify XSS protection
- ✅ Virtual scrolling performance verified

**Features Complete:**

- ✅ Email: Account management, threading, search, sync
- ✅ Calendar: Event management, recurring, attendees, sync
- ✅ Voice: Recording, transcription, synthesis integration
- ✅ Mobile: Responsive design, offline support
- ✅ Cross-platform: Web, Desktop (Tauri), PWA

**Database:**

- ✅ 25+ tables, fully indexed
- ✅ Full-text search on all content
- ✅ Cascade deletes for data integrity
- ✅ Sync state tracking

**Documentation:**

- ✅ Complete specs for all tracks
- ✅ Implementation plans with step-by-step instructions
- ✅ Weekly progress reports
- ✅ Architecture documentation

---

## WHAT'S NEXT AFTER PHASE 2

**Phase 3: Execution Engines (3 weeks)**

- Custom tool execution (sandboxed)
- Composite skill chaining
- Memory synthesis with Claude

**Phase 4: Voice Enhancements (2 weeks)**

- Voice command shortcuts
- Voicemail playback
- Two-way voice conversations

**Phase 5+: Final Integration**

- Cross-platform mobile apps
- Cloud sync infrastructure
- Full end-to-end encryption

---

## CURRENT STATUS

✅ **Week 3 Complete:** Email Integration (Track 3) - DONE
🔄 **Week 4 Planned:** Calendar Foundation (Track 4) - READY
🔄 **Week 5 Planned:** Voice Recording + Mobile + Tests (T5-7) - READY

**Ready to Execute:** Yes, all specs written, implementation plans ready

---

**Last Updated:** February 3, 2026
**Next Update:** End of Week 4 (February 10, 2026)
**Complete Phase 2 Target:** February 14, 2026
