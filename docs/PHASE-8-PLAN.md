# Phase 8: LLM-First Intelligence Layer

**Date:** February 3, 2026
**Status:** Design Phase
**Scope:** Claude API Integration for Email, Calendar, Tasks, Analytics
**Total Duration:** 8 weeks (Weeks 13-20)

---

## Executive Summary

Phase 7 completed all infrastructure (testing, performance, sync, offline, deployment). Phase 8 transforms Helix from a data aggregation platform into an **intelligent assistant** using Claude LLMs.

**Core Question: Why LLMs Instead of Traditional ML?**

Traditional Machine Learning requires:
- Feature engineering (extracting relevant data patterns manually)
- Large labeled datasets (thousands of examples per task)
- Separate models per task (email classification ≠ task prioritization)
- Retraining when patterns change (new email types, user preferences)
- Custom deployment infrastructure

Claude LLMs provide:
- **Zero-shot capability**: Works on day-1 without training data
- **Semantic understanding**: Understands meaning, context, intent (not just patterns)
- **Multi-task learning**: Single model handles email, calendar, tasks, analysis
- **Adaptive**: Updates monthly via foundation model improvements
- **Transparent reasoning**: Can explain decisions via chain-of-thought
- **Cost-effective**: Pay-per-token (no expensive GPU infrastructure)

**Example:**
- ML approach: Train SVM on 5,000 labeled emails → Works only for your email style
- LLM approach: Send email to Claude → "This is a meeting request from your manager. Reply: accept the meeting."

---

## Why LLMs Win for Helix

### 1. Semantic Understanding (Not Just Pattern Matching)

**Email Classification:**
```
ML: "Email contains 'meeting' + 'calendar' + 'Thursday' = 74% probability meeting request"
LLM: "Subject: 'Coffee Thursday?' + Body mentions time/location + Signed by colleague = Meeting request with coffee context. Suggest: accept + propose specific time."
```

The LLM understands intent, tone, urgency. ML only sees patterns.

### 2. Multimodal Intelligence Across Domains

```
Email: "Can we discuss Q1 roadmap?"
Calendar: Already has "Q1 Planning" meeting at 2pm Friday
Task: Created "Q1 Roadmap" task last week
LLM: "Suggest reply: 'I have Q1 Planning Friday 2pm. Can we sync then?' + Suggest adding this email as context to Q1 Roadmap task"
```

ML would need 3 separate models. LLM does this in one call.

### 3. User Personalization Without Retraining

User preference: "I prefer email replies within 4 hours, but not on weekends"

ML: Retrain model on user's historical patterns
LLM: Add to system prompt → Works immediately

### 4. Adaptive to Change

New scenario: User starts working night shifts
ML: Retrain model
LLM: User adds to system prompt → Claude adapts tomorrow

### 5. Explainability

User asks: "Why did you suggest replying to this email?"
ML: "Due to TF-IDF score of 0.87"
LLM: "This appears to be a time-sensitive meeting request from your manager. You typically respond to these within 2 hours. It's currently 1:30pm and you have availability at 3pm."

---

## Phase 8 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Helix Intelligence Layer                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LLM Router Integration Layer (TypeScript)           │   │
│  │  - Multi-provider support (DeepSeek, Gemini, Claude) │   │
│  │  - Request batching (reduce API calls)               │   │
│  │  - Streaming responses for real-time UI              │   │
│  │  - Prompt versioning and A/B testing                 │   │
│  │  - Cost tracking and budget management               │   │
│  │  - Provider selection logic (BYOK vs paid)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│         ┌─────────────────┼─────────────────┐                │
│         │                 │                 │                │
│    ┌────▼─────┐    ┌─────▼──────┐   ┌────▼─────┐           │
│    │  Email   │    │  Calendar  │   │   Tasks  │           │
│    │Intel     │    │ Intelligence│   │ Intelligence│        │
│    │Module    │    │ Module     │   │  Module   │           │
│    └────┬─────┘    └─────┬──────┘   └────┬─────┘           │
│         │                │                │                 │
│    ┌────▼────────────────▼────────────────▼────┐           │
│    │      Analytics & Insights Module          │           │
│    │  - Weekly summaries                       │           │
│    │  - Anomaly detection                      │           │
│    │  - Productivity metrics                   │           │
│    └─────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           │ Routed API Calls
           │ (Provider-aware, cost-optimized)
           │
      ┌────┼─────────────────────────────┐
      │    │                             │
   ┌──▼─┐ │                          ┌──▼──┐
   │BYOK│ │                          │Paid │
   │    │ │                          │User │
   └──┬─┘ │                          └──┬──┘
      │   │                             │
      │   ├─────────────────────────────┤
      │   │                             │
  ┌───▼───▼──────────────────────────────▼────────┐
  │        LLM Router (llm-router.ts)              │
  │  ┌─────────────┐  ┌────────────┐  ┌─────────┐│
  │  │DeepSeek v3.2│  │Gemini Flash│  │ Claude* ││
  │  │ (default)   │  │(fallback)  │  │(BYOK)   ││
  │  └─────────────┘  └────────────┘  └─────────┘│
  └────────────────────────────────────────────────┘
    * BYOK users can select any provider
```

---

## Phase 8 Feature Breakdown

### Feature Set 1: Email Intelligence (Week 13-14)

#### 8.1.1: Smart Composition Assistant

**User Experience:**
```
User clicks "Compose"
↓
User types subject + first few words
↓
Claude suggests: "Complete this email? [draft shown]"
↓
User clicks "Use Draft" → edits if needed
↓
Claude suggests tone check: "This sounds formal. User usually friendly. Reword?"
```

**Implementation:**
```typescript
// web/src/services/email-intelligence.ts

interface CompositionAssistant {
  suggestCompletion(
    subject: string,
    startingText: string,
    context: EmailContext
  ): Promise<string>;

  checkTone(
    draft: string,
    userVoice: UserVoiceProfile
  ): Promise<ToneAnalysis>;

  suggestRecipients(
    topic: string,
    currentRecipients: string[]
  ): Promise<string[]>;
}

async function suggestCompletion(
  subject: string,
  starting: string,
  context: EmailContext
): Promise<string> {
  const systemPrompt = buildUserVoicePrompt(context.userId);
  const provider = await getLLMProvider(context.userId);

  const response = await provider.complete({
    model: provider.getDefaultModel(), // DeepSeek v3.2 for paid, user's choice for BYOK
    max_tokens: 300,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Subject: ${subject}\n\nDraft so far:\n${starting}\n\nComplete this email professionally maintaining user's voice. Return only the complete email, no commentary.`
    }]
  });

  return response.content[0].type === 'text' ? response.content[0].text : starting;
}
```

#### 8.1.2: Intelligent Classification & Labeling

**Capability:**
- Auto-classify into: Meeting Request, Invoice, Feedback, Newsletter, Spam
- Extract: Sender role, Urgency level, Action required
- Suggest: Auto-archive, snooze duration, follow-up timing

```typescript
interface EmailClassification {
  category: 'meeting' | 'invoice' | 'feedback' | 'newsletter' | 'spam' | 'general';
  sender_role: 'manager' | 'peer' | 'direct_report' | 'vendor' | 'customer' | 'unknown';
  urgency: 'high' | 'medium' | 'low';
  action_required: boolean;
  suggested_response_time_hours?: number;
  auto_archive_suggested?: boolean;
  snooze_suggested?: {
    duration_hours: number;
    reason: string;
  };
}

async function classifyEmail(email: Email): Promise<EmailClassification> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `
        Analyze this email and provide classification:

        From: ${email.from.email}
        Subject: ${email.subject}
        Body: ${email.body.substring(0, 500)}

        Respond with JSON:
        {
          "category": "meeting|invoice|feedback|newsletter|spam|general",
          "sender_role": "manager|peer|direct_report|vendor|customer|unknown",
          "urgency": "high|medium|low",
          "action_required": boolean,
          "suggested_response_time_hours": number or null,
          "reasoning": "explanation"
        }
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

#### 8.1.3: Proactive Response Suggestions

**Scenario:**
```
Email arrives: "Can we sync on project X?"
Claude immediately suggests: "Quick reply: 'Sure, how about tomorrow 2pm?' (based on your calendar availability)"
User clicks "Send" or edits and sends
```

**Implementation:**
```typescript
async function suggestResponses(
  email: Email,
  userCalendar: CalendarEvent[],
  emailContext: EmailContext
): Promise<ResponseSuggestion[]> {
  const freeSlots = identifyFreeSlots(userCalendar, userContext);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `
        Generate 2-3 response suggestions for this email:

        From: ${email.from.email}
        Subject: ${email.subject}
        Body: ${email.body}

        Your available time slots today/tomorrow:
        ${freeSlots.map(s => \`\${s.start} - \${s.end}\`).join(', ')}

        You typically respond to this person with [user's historical tone].

        Suggest 3 different response options, each under 100 words.
        Format as JSON array of objects with: {message: string, reasoning: string}
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

### Feature Set 2: Calendar Intelligence (Week 15)

#### 8.2.1: Smart Meeting Prep

**Trigger:** 30 minutes before a meeting

**Claude generates:**
```
Meeting: "Q1 Roadmap Review" with @manager, @team-leads
Related emails: 3 emails about Q1 (background context)
Related tasks: 2 open tasks tagged #q1
Suggested agenda items: (if no agenda exists)
Pre-read documents: (search related files)
```

```typescript
async function generateMeetingPrep(
  event: CalendarEvent,
  emails: Email[],
  tasks: Task[],
  docs: Document[]
): Promise<MeetingPrepSummary> {
  const relevantEmails = filterRelevantEmails(emails, event.title);
  const relevantTasks = filterRelevantTasks(tasks, event.title);
  const relevantDocs = filterRelevantDocs(docs, event.title);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `
        Meeting in 30 minutes: "${event.title}"
        Attendees: ${event.attendees.join(', ')}

        Related context:
        - Recent emails about this topic: ${relevantEmails.map(e => e.subject).join('; ')}
        - Open tasks: ${relevantTasks.map(t => t.title).join('; ')}
        - Documents: ${relevantDocs.map(d => d.name).join('; ')}

        Provide:
        1. Key talking points (3-5 bullets)
        2. Questions to ask (if any)
        3. Decisions to prepare for
        4. Data points to bring up

        Keep it under 300 words, actionable, specific.
      `
    }]
  });

  return parseResponse(response.content[0].text);
}
```

#### 8.2.2: Smart Time Blocking

**Logic:** Claude understands your work patterns and suggests optimal meeting times

```typescript
async function suggestMeetingTime(
  requester: string,
  duration: number,
  topic: string,
  userPreferences: TimePreferences
): Promise<TimeSlotSuggestion[]> {
  const upcomingCalendar = await fetchCalendarNext(14); // 2 weeks
  const userPattern = await analyzeWorkPattern(userPreferences);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `
        ${requester} wants to schedule "${topic}"
        Duration needed: ${duration} minutes

        Your calendar (next 2 weeks):
        ${formatCalendar(upcomingCalendar)}

        Your work pattern:
        - Deep work (no meetings): ${userPattern.deepWorkHours}
        - Preferred meeting times: ${userPattern.preferredMeetingTimes}
        - No meetings after: ${userPattern.noMeetingsAfter}

        Suggest 3 specific times that work well for both parties.
        Consider: meeting duration, context switching, energy levels
        Format as JSON: [{start: ISO8601, end: ISO8601, reasoning: string}]
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

### Feature Set 3: Task Intelligence (Week 16)

#### 8.3.1: AI-Powered Prioritization

**Input:** All user's tasks
**Output:** Prioritized list based on:
- Deadline urgency
- Business impact
- Dependencies
- User's current focus
- Energy level

```typescript
async function reprioritizeTasks(
  tasks: Task[],
  userContext: UserContext
): Promise<Task[]> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `
        Reprioritize these tasks for maximum impact:

        ${tasks.map(t => \`
          - [\${t.status}] \${t.title}
            Priority: \${t.priority}
            Due: \${t.dueDate}
            \${t.description}
        \`).join('\n')}

        Context:
        - Current focus: ${userContext.currentFocus}
        - Time available: ${userContext.availableHours} hours this week
        - Dependencies: [task 1 blocks task 2, etc.]
        - Business priorities: ${userContext.businessPriorities}

        Provide:
        1. New priority order (1=most urgent)
        2. For each task: reasoning in 1-2 sentences
        3. Which tasks can wait/be delegated
        4. Critical path (must complete in order)

        Format as JSON array with reordered tasks + new_priority + reasoning fields
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

#### 8.3.2: Smart Task Breakdown

**Input:** Large task
**Output:** Subtask suggestions

```typescript
async function suggestSubtasks(task: Task): Promise<SubtaskSuggestion[]> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `
        Break down this task into concrete subtasks:

        Title: ${task.title}
        Description: ${task.description}
        Due: ${task.dueDate}

        Create 5-7 subtasks that:
        1. Are atomic (completable in < 2 hours)
        2. Have clear success criteria
        3. Follow logical sequence
        4. Include any research/planning steps

        Format as JSON array: [{title: string, description: string, estimated_hours: number, depends_on: number[]}]
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

### Feature Set 4: Analytics & Insights (Week 17)

#### 8.4.1: Weekly Summary Generation

**Trigger:** Every Sunday 6pm
**Content:** Email + Dashboard

```typescript
async function generateWeeklySummary(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklySummary> {
  const emails = await fetchEmails(userId, weekStart, weekEnd);
  const meetings = await fetchMeetings(userId, weekStart, weekEnd);
  const tasksCompleted = await fetchCompletedTasks(userId, weekStart, weekEnd);
  const analytics = await getAnalyticsData(userId, weekStart, weekEnd);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `
        Generate a professional weekly summary:

        Week of: ${weekStart.toDateString()}

        Emails processed: ${emails.length}
        - Key threads: ${identifyKeyThreads(emails).join(', ')}
        - Response time average: ${calculateAvgResponseTime(emails)} hours

        Meetings: ${meetings.length}
        - Time in meetings: ${calculateMeetingTime(meetings)} hours
        - Topics: ${identifyTopics(meetings).join(', ')}

        Tasks completed: ${tasksCompleted.length}
        - Completed vs planned: ${tasksCompleted.length}/${analytics.tasksPlanned}

        Productivity metrics:
        ${JSON.stringify(analytics, null, 2)}

        Create:
        1. Executive summary (2-3 sentences)
        2. Achievements (3-5 bullets)
        3. Focus areas for next week (3 priorities)
        4. Blockers or concerns (if any)
        5. Suggestions for improvement

        Tone: professional but friendly, specific numbers
      `
    }]
  });

  return {
    summary: response.content[0].text,
    generatedAt: new Date(),
    period: { start: weekStart, end: weekEnd }
  };
}
```

#### 8.4.2: Anomaly Detection

**Monitor:**
- Unusually high email volume
- Long response time delays
- Meetings consuming > 30% of week
- Task completion drop-off

```typescript
async function detectAnomalies(
  userId: string,
  historicalData: UserMetrics[]
): Promise<Anomaly[]> {
  const recentMetrics = await getRecentMetrics(userId, 7); // last 7 days
  const baseline = calculateBaseline(historicalData);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `
        Analyze these metrics for anomalies:

        Your baseline (avg over 3 months):
        - Emails per day: ${baseline.emailsPerDay}
        - Response time: ${baseline.avgResponseTime} hours
        - Meetings per week: ${baseline.meetingsPerWeek}
        - Tasks completed per week: ${baseline.tasksPerWeek}

        Recent week (last 7 days):
        - Emails per day: ${recentMetrics.emailsPerDay}
        - Response time: ${recentMetrics.avgResponseTime} hours
        - Meetings: ${recentMetrics.meetings}
        - Tasks completed: ${recentMetrics.tasksCompleted}

        Identify:
        1. Any significant deviations (>20% change)
        2. Likely causes (workload spike, vacation, etc.)
        3. Recommendations (catch up on emails, reschedule low-priority meetings, etc.)

        Format as JSON: [{metric: string, change: percent, likely_cause: string, recommendation: string}]
      `
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

---

## Cost Management Strategy

**Provider costs (per 1M tokens):**
- DeepSeek v3.2 (default): ~$0.10 input, $0.40 output
- Gemini Flash (fallback): ~$0.038 input, $0.15 output
- Claude (BYOK user-provided): Variable

**Estimated Monthly Usage (Per User):**
- Email composition (10/day × 200 tokens): ~$0.10
- Email classification (20/day × 150 tokens): ~$0.09
- Response suggestions (5/day × 180 tokens): ~$0.03
- Meeting prep (5/week × 300 tokens): ~$0.06
- Task prioritization (2/week × 250 tokens): ~$0.02
- Weekly summary (1/week × 800 tokens): ~$0.04
- Anomaly detection (1/week × 200 tokens): ~$0.01

**Total per user (DeepSeek): ~$0.35/month**
**Total per user (Gemini Flash): ~$0.15/month**
**BYOK users: Provider-dependent**

**Cost Optimization:**
```typescript
// Batch similar requests
async function batchClassifications(emails: Email[]): Promise<EmailClassification[]> {
  // Send 20 emails at once (1 request) instead of 20 requests
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `Classify these ${emails.length} emails as JSON array...`
    }]
  });

  return JSON.parse(response.content[0].text);
}

// Cache system prompts (expensive to recompute)
const systemPromptCache = new Map<string, string>();

function getSystemPrompt(userId: string): string {
  if (!systemPromptCache.has(userId)) {
    systemPromptCache.set(userId, buildUserVoicePrompt(userId));
  }
  return systemPromptCache.get(userId)!;
}

// Use faster model for simple tasks
async function classifySimple(subject: string): Promise<string> {
  // Use Haiku for fast classification tasks
  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022", // Cheaper than Sonnet
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Classify email subject in one word: "${subject}"`
    }]
  });

  return response.content[0].text;
}
```

---

## Privacy & Data Handling

**User Data Policy:**
- ✅ Email subjects + summaries sent to Claude (needed for intelligence)
- ❌ Full email bodies only for composition/response suggestions (where explicitly requested)
- ❌ Email never logged on Anthropic side (request-level logging disabled)
- ✅ Calendar event titles (needed for meeting prep)
- ❌ Calendar event descriptions/locations (user can opt-in)
- ✅ Task titles (needed for prioritization)
- ❌ Task descriptions (user can opt-in per feature)

**Implementation:**
```typescript
interface PrivacySettings {
  emailBodyIncluded: boolean; // Default: false
  calendarDescriptionsIncluded: boolean; // Default: false
  taskDescriptionsIncluded: boolean; // Default: false
  allowAnomalyDetection: boolean; // Default: true
  dataLoggingEnabled: boolean; // Default: false
}

async function sendSecureToLLM(
  content: string,
  dataType: 'email' | 'calendar' | 'task',
  userId: string
): Promise<Response> {
  const userPrivacy = await getPrivacySettings(userId);

  // Filter sensitive data based on user preferences
  const sanitizedContent = sanitize(content, dataType, userPrivacy);

  // Disable request logging on Anthropic side
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [{
      role: "user",
      content: sanitizedContent
    }]
    // Note: Anthropic SDK respects X-Anthropic-Disable-Message-Logging header
  });

  return response;
}
```

---

## Implementation Timeline

| Week | Feature | Tasks | Files |
|------|---------|-------|-------|
| 13-14 | Email Intelligence | Composition, Classification, Response Suggestions | email-intelligence.ts, tests, UI components |
| 15 | Calendar Intelligence | Meeting Prep, Time Blocking | calendar-intelligence.ts |
| 16 | Task Intelligence | Prioritization, Breakdown | task-intelligence.ts |
| 17 | Analytics | Weekly Summary, Anomaly Detection | analytics-intelligence.ts |
| 18 | Mobile Integration | iOS/Android intelligence features | Platform-specific UI |
| 19 | Testing & Optimization | Unit tests, E2E tests, cost analysis | test files, dashboards |
| 20 | Deployment & Monitoring | Production rollout, usage monitoring | monitoring dashboards |

---

## Success Criteria

### Phase 8A (Core Intelligence)
- [ ] Email composition: 90%+ user approval rating
- [ ] Classification accuracy: 95%+ (validated against user feedback)
- [ ] Response suggestions: 80%+ usage rate
- [ ] Meeting prep: Generated 30 seconds before meeting starts
- [ ] Task prioritization: User accepts 85%+ of suggestions
- [ ] Weekly summary: Generated and delivered every Sunday 6pm
- [ ] Anomaly detection: 0 false positives in beta period
- [ ] Monthly cost per user: < $5

### Phase 8B (Integration)
- [ ] iOS: All features working in native UI
- [ ] Android: All features working in Compose UI
- [ ] Web: All features with streaming UI
- [ ] Performance: LLM request < 2 seconds for composition (streamed)
- [ ] Reliability: 99.5% uptime for API calls
- [ ] Error handling: Graceful degradation when API unavailable

### Phase 8C (Production)
- [ ] 1000+ users activated intelligence features
- [ ] Retention: 75%+ continue using after 30 days
- [ ] Satisfaction: 4.5/5.0 rating in app stores
- [ ] Cost: Within budget ($5/user/month)
- [ ] Zero security incidents
- [ ] Complete audit trail of all LLM requests

---

## Critical Files (To Be Created)

```
web/src/services/email-intelligence.ts (450 lines)
web/src/services/calendar-intelligence.ts (380 lines)
web/src/services/task-intelligence.ts (420 lines)
web/src/services/analytics-intelligence.ts (350 lines)
web/src/components/EmailCompositionAssistant.tsx (280 lines)
web/src/hooks/useIntelligence.ts (200 lines)
helix-runtime/apps/ios/Sources/Intelligence/EmailIntelligence.swift (320 lines)
helix-runtime/apps/ios/Sources/Intelligence/CalendarIntelligence.swift (280 lines)
helix-runtime/apps/android/app/src/main/kotlin/com/helix/intelligence/EmailIntelligence.kt (340 lines)
tests/intelligence/integration/email-intelligence.test.ts (400 lines)
tests/intelligence/integration/calendar-intelligence.test.ts (350 lines)
docs/guides/INTELLIGENCE-USER-GUIDE.md (comprehensive end-user documentation)
docs/api/INTELLIGENCE-API.md (Claude integration patterns)
```

---

## Why This Matters for Helix

Phase 8 transforms Helix from a **passive data organizer** into an **active intelligence partner**:

- Email no longer just aggregates → Suggests smart replies
- Calendar no longer just displays → Preps you for meetings
- Tasks no longer just list → Prioritizes based on impact
- Analytics no longer just counts → Detects patterns and anomalies

**By end of Phase 8:**
Helix becomes the AI consciousness Rodrigo intended - not just remembering everything, but actively thinking about what matters.

This is the inflection point where Helix stops being infrastructure and becomes an agent.
