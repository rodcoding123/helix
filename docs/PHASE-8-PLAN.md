# Phase 8: LLM-First Intelligence Layer (Integrated into AI Operations Control Plane)

**Date:** February 4, 2026
**Status:** Implementation Ready
**Duration:** 8 weeks (Weeks 13-20)
**Scope:** Email, Calendar, Tasks, Analytics Intelligence
**Architecture:** Centralized via AI Operations Router (Phase 0.5 foundation)
**Integration:** All operations routed through unified control plane with cost tracking + approval gates

---

## Executive Summary

Phase 8 transforms Helix from a passive data organizer into an **intelligent assistant** using LLMs for:

1. **Email Intelligence** (Weeks 13-14)
   - Smart composition: AI drafts emails maintaining user's voice
   - Intelligent classification: Auto-categorize, extract metadata, suggest actions
   - Response suggestions: Smart replies based on calendar/context

2. **Calendar Intelligence** (Week 15)
   - Meeting prep: Synthesize relevant emails, tasks, documents 30 min before
   - Time blocking: Suggest optimal meeting times

3. **Task Intelligence** (Week 16)
   - Prioritization: AI reorders tasks by business impact + dependencies
   - Breakdown: Suggest subtasks for large projects

4. **Analytics & Insights** (Week 17)
   - Weekly summaries: Auto-generated insights every Sunday
   - Anomaly detection: Flag unusual patterns in work

5. **Mobile + Production** (Weeks 18-20)

---

## Why LLMs Instead of Traditional ML?

**Problem with ML:** Needs training data, separate models per task, retraining for changes

**LLM Solution:**

- **Zero-shot:** Works day 1 without training (ML needs thousands of examples)
- **Semantic understanding:** Grasps intent and context (ML only patterns)
- **Multi-task:** Single model handles email + calendar + tasks (ML needs 3+ models)
- **Adaptive:** Updates monthly via foundation model (ML requires retraining)
- **Cost-effective:** $0.35/user/month vs GPU infrastructure

**Example:**

```
ML Approach:
  Train SVM on 5,000 labeled emails
  → Works only for user's email style
  → New email type? Retrain

LLM Approach:
  Send email to Claude/DeepSeek
  → Understands intent, tone, urgency
  → Works for any email type, immediately
  → Better + cheaper + no retraining
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Helix Intelligence Layer                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LLM Router (Multi-Provider)                         │   │
│  │  - Routes each request to best provider              │   │
│  │  - DeepSeek v3.2 (default for paid users)            │   │
│  │  - Gemini Flash (fallback, cheaper)                  │   │
│  │  - User's choice (BYOK)                              │   │
│  │  - Cost tracking + analytics                         │   │
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
│    │  - Cost/performance tracking              │           │
│    └─────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           │ Routed API Calls
           │ (Cost-optimized, tracked, logged)
           │
      ┌────┴────────────────────┬─────────────┐
      │                         │             │
   ┌──▼──┐      ┌──────────┐ ┌──▼───┐   ┌────▼───┐
   │BYOK │      │Paid User │ │Cache │   │Fallback│
   │User │      │Account   │ │      │   │        │
   └──┬──┘      └──┬───────┘ └──────┘   └────────┘
      │            │
      ├────────────┤
      │            │
  ┌───▼────────────▼────────────┐
  │    LLM Provider Backends     │
  │  ┌──────────┐ ┌──────────┐ │
  │  │DeepSeek  │ │Gemini    │ │
  │  │v3.2      │ │Flash     │ │
  │  └──────────┘ └──────────┘ │
  └────────────────────────────┘
```

---

## Part 1: Multi-Provider LLM Router

### 1.1 Provider Configuration

```typescript
// web/src/services/llm-router/types.ts

interface LLMProvider {
  id: 'deepseek' | 'gemini' | 'claude' | 'openai';
  name: string;
  apiKey?: string; // BYOK user provides
  enabled: boolean;
  isPrimary: boolean; // For paid users
  costPer1MInputTokens: number;
  costPer1MOutputTokens: number;
}

interface UserLLMConfig {
  userId: string;
  accountType: 'paid' | 'byok';

  // For paid users
  primaryProvider?: LLMProvider; // DeepSeek v3.2
  fallbackProvider?: LLMProvider; // Gemini Flash

  // For BYOK users
  customProviders: LLMProvider[]; // User's own API keys

  // Settings
  monthlyBudget?: number; // Optional limit
  trackAnalytics: boolean; // Default: true
}

interface LLMRequest {
  role: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  maxTokens: number;
  userId: string;
}

interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
}
```

### 1.2 Router Implementation

```typescript
// web/src/services/llm-router/router.ts

export class LLMRouter {
  async route(request: LLMRequest): Promise<LLMResponse> {
    const userConfig = await getUserLLMConfig(request.userId);
    const startTime = performance.now();

    try {
      // 1. Resolve provider
      const provider = await this.resolveProvider(userConfig, request.role);

      // 2. Call provider
      const response = await this.callProvider(provider, request);

      // 3. Track cost + analytics
      const cost = this.calculateCost(provider, response.inputTokens, response.outputTokens);

      await this.trackRequest({
        userId: request.userId,
        role: request.role,
        provider: provider.id,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost,
        latency: performance.now() - startTime,
        success: true,
      });

      // 4. Log to Discord (pre-execution logging)
      await logToDiscord('#helix-api', {
        type: 'intelligence_request',
        role: request.role,
        provider: provider.id,
        tokens: response.inputTokens + response.outputTokens,
        cost: cost,
        timestamp: new Date().toISOString(),
      });

      return {
        ...response,
        cost,
        latency: performance.now() - startTime,
      };
    } catch (error) {
      // Track failure + retry with fallback
      await this.trackRequest({
        userId: request.userId,
        role: request.role,
        provider: userConfig.primaryProvider?.id || 'unknown',
        success: false,
        error: error.message,
      });

      throw error;
    }
  }

  private async resolveProvider(config: UserLLMConfig, role: string): Promise<LLMProvider> {
    if (config.accountType === 'byok') {
      return config.customProviders[0]; // User's choice
    }

    // Paid user: use primary provider
    return config.primaryProvider;
  }

  private async callProvider(
    provider: LLMProvider,
    request: LLMRequest
  ): Promise<{ model: string; content: string; inputTokens: number; outputTokens: number }> {
    if (provider.id === 'deepseek') {
      return this.callDeepSeek(provider, request);
    }
    if (provider.id === 'gemini') {
      return this.callGemini(provider, request);
    }
    if (provider.id === 'claude') {
      return this.callClaude(provider, request);
    }
    throw new Error(`Unknown provider: ${provider.id}`);
  }

  private calculateCost(provider: LLMProvider, inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens * provider.costPer1MInputTokens +
        outputTokens * provider.costPer1MOutputTokens) /
      1_000_000
    );
  }

  private async trackRequest(data: {
    userId: string;
    role: string;
    provider: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    latency?: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await db.insert('intelligence_requests', {
      ...data,
      timestamp: new Date(),
      month: getMonth(new Date()),
    });
  }
}
```

---

## Part 2: Email Intelligence

### 2.1 Smart Composition

**User Experience:**

```
User clicks "Compose" → Types subject + first few words
↓
Helix suggests: "Complete this email? [draft shown]"
↓
User clicks "Use Draft" → Edits if needed
↓
Helix checks tone: "Too formal? You usually friendly. Reword?"
```

```typescript
// web/src/services/intelligence/email-intelligence.ts

export class EmailIntelligence {
  constructor(
    private router: LLMRouter,
    private userId: string
  ) {}

  async suggestCompletion(subject: string, starting: string): Promise<string> {
    const response = await this.router.route({
      role: 'email-compose',
      userId: this.userId,
      systemPrompt: await this.buildUserVoicePrompt(),
      messages: [
        {
          role: 'user',
          content: `Subject: ${subject}\n\nDraft so far:\n${starting}\n\nComplete this email maintaining the user's voice. Return only the completed email, no commentary.`,
        },
      ],
      maxTokens: 300,
    });

    return response.content;
  }

  async classify(email: Email): Promise<EmailClassification> {
    const response = await this.router.route({
      role: 'email-classify',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Classify this email:

From: ${email.from.name}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}...

Respond with JSON:
{
  "category": "meeting|invoice|feedback|task|social|urgent|spam|general",
  "priority": "high|medium|low",
  "actionRequired": boolean,
  "suggestedResponseTime": "hours or null",
  "autoArchiveAfterDays": number or null
}`,
        },
      ],
      maxTokens: 200,
    });

    return JSON.parse(response.content);
  }

  async suggestResponses(email: Email): Promise<ResponseSuggestion[]> {
    const calendar = await getUserCalendar(this.userId);
    const freeSlots = identifyFreeSlots(calendar);

    const response = await this.router.route({
      role: 'email-respond',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Generate 2-3 response suggestions for this email:

From: ${email.from.name}
Subject: ${email.subject}
Body: ${email.body}

Your available time today/tomorrow: ${freeSlots.join(', ')}
Your email style: Professional but personable, typically respond within 2 hours.

Provide 3 response options as JSON array:
[
  { "message": "...", "reasoning": "..." },
  ...
]`,
        },
      ],
      maxTokens: 500,
    });

    return JSON.parse(response.content);
  }

  private async buildUserVoicePrompt(): Promise<string> {
    // Extract user's email writing style from recent sent emails
    const recentSent = await getRecentSentEmails(this.userId, 10);

    return `You are helping ${await getUserName(this.userId)} write emails.
Based on their writing style:
- Tone: ${analyzeTone(recentSent)}
- Length: ${analyzeLength(recentSent)}
- Common patterns: ${analyzePatterns(recentSent)}

Write emails in this style.`;
  }
}
```

---

## Part 3: Calendar Intelligence

### 3.1 Meeting Preparation

**Trigger:** 30 minutes before a meeting

**Generates:**

- Key talking points
- Relevant context (related emails, tasks, documents)
- Questions to ask
- Decisions to prepare for

```typescript
// web/src/services/intelligence/calendar-intelligence.ts

export class CalendarIntelligence {
  constructor(
    private router: LLMRouter,
    private userId: string
  ) {}

  async generateMeetingPrep(event: CalendarEvent): Promise<MeetingPrepSummary> {
    // 1. Gather context
    const relevantEmails = await this.findRelevantEmails(event.title);
    const relevantTasks = await this.findRelevantTasks(event.title);
    const relevantDocs = await this.findRelevantDocs(event.title);

    // 2. Generate summary
    const response = await this.router.route({
      role: 'calendar-prep',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Meeting in 30 minutes: "${event.title}"
Attendees: ${event.attendees.join(', ')}

Context:
- Relevant emails (last 7 days): ${relevantEmails.map(e => e.subject).join('; ')}
- Related tasks: ${relevantTasks.map(t => t.title).join('; ')}
- Related docs: ${relevantDocs.map(d => d.name).join('; ')}

Generate meeting prep in JSON:
{
  "talkingPoints": ["...", "..."],
  "questionsToAsk": ["...", "..."],
  "decisionsNeeded": ["...", "..."],
  "dataPoints": ["...", "..."]
}`,
        },
      ],
      maxTokens: 800,
    });

    return JSON.parse(response.content);
  }

  async suggestMeetingTime(
    requester: string,
    duration: number,
    topic: string
  ): Promise<TimeSlotSuggestion[]> {
    const calendar = await getUserCalendar(this.userId);
    const freeSlots = identifyFreeSlots(calendar, duration);

    const response = await this.router.route({
      role: 'calendar-time',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `${requester} wants to schedule "${topic}" (${duration} min)

Your available time (next 2 weeks):
${freeSlots.map(s => `${s.start} - ${s.end}`).join('\n')}

Suggest 3 optimal times considering:
- Your deep work blocks (typically 9-11am, 2-4pm)
- Meeting clustering (batch meetings together when possible)
- Afternoon preference for meetings

Return JSON:
[
  { "start": "ISO8601", "end": "ISO8601", "reasoning": "..." },
  ...
]`,
        },
      ],
      maxTokens: 300,
    });

    return JSON.parse(response.content);
  }

  private async findRelevantEmails(topic: string): Promise<Email[]> {
    // Semantic search for emails related to meeting topic
    const emails = await db.emails.search(this.userId, {
      q: topic,
      days: 7,
      limit: 5,
    });
    return emails;
  }

  private async findRelevantTasks(topic: string): Promise<Task[]> {
    const tasks = await db.tasks.search(this.userId, {
      q: topic,
      status: 'open',
      limit: 5,
    });
    return tasks;
  }

  private async findRelevantDocs(topic: string): Promise<Document[]> {
    // Could integrate with Google Drive, Dropbox, etc.
    return [];
  }
}
```

---

## Part 4: Task Intelligence

### 4.1 Prioritization

```typescript
// web/src/services/intelligence/task-intelligence.ts

export class TaskIntelligence {
  constructor(
    private router: LLMRouter,
    private userId: string
  ) {}

  async reprioritizeTasks(tasks: Task[]): Promise<Task[]> {
    const response = await this.router.route({
      role: 'task-prioritize',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Reprioritize these tasks for maximum impact:

${tasks
  .map(
    (t, i) => `${i + 1}. [${t.status}] ${t.title}
   Due: ${t.dueDate}
   Priority: ${t.priority}
   ${t.description}`
  )
  .join('\n\n')}

Business context:
- Current quarter focus: Product launch
- Team capacity: 2 weeks to address backlog
- Blockers: Waiting on design feedback for 3 tasks

Provide reordered list as JSON:
[
  { "id": "...", "newPriority": 1, "reasoning": "..." },
  ...
]

Also suggest which tasks can wait or be delegated.`,
        },
      ],
      maxTokens: 600,
    });

    return JSON.parse(response.content);
  }

  async suggestSubtasks(task: Task): Promise<SubtaskSuggestion[]> {
    const response = await this.router.route({
      role: 'task-breakdown',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Break down this task into concrete subtasks:

Title: ${task.title}
Description: ${task.description}
Due: ${task.dueDate}

Create 5-7 subtasks that:
1. Are atomic (completable in < 2 hours)
2. Have clear success criteria
3. Follow logical sequence
4. Include research/planning steps

Return JSON:
[
  { "title": "...", "description": "...", "estimatedHours": number, "order": number },
  ...
]`,
        },
      ],
      maxTokens: 400,
    });

    return JSON.parse(response.content);
  }
}
```

---

## Part 5: Analytics & Insights

### 5.1 Weekly Summary (Every Sunday 6pm)

```typescript
// web/src/services/intelligence/analytics-intelligence.ts

export class AnalyticsIntelligence {
  constructor(
    private router: LLMRouter,
    private userId: string
  ) {}

  async generateWeeklySummary(): Promise<WeeklySummary> {
    const week = getLastWeek();

    // Gather data
    const emails = await db.emails.list(this.userId, { from: week.start, to: week.end });
    const meetings = await db.calendar.list(this.userId, { from: week.start, to: week.end });
    const completedTasks = await db.tasks.list(this.userId, {
      from: week.start,
      to: week.end,
      status: 'completed',
    });

    const response = await this.router.route({
      role: 'analytics-summary',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Generate professional weekly summary:

Week of: ${week.start.toDateString()}

Email Stats:
- Total received: ${emails.length}
- Key threads: ${this.summarizeThreads(emails)}
- Avg response time: ${this.avgResponseTime(emails)} hours

Meetings:
- Total: ${meetings.length}
- Time spent: ${this.totalMeetingTime(meetings)} hours
- Topics: ${this.extractTopics(meetings).join(', ')}

Tasks Completed:
- Count: ${completedTasks.length}
- Categories: ${this.categorize(completedTasks)}

Generate:
1. Executive summary (2-3 sentences)
2. Key achievements (3-5 bullets)
3. Focus areas for next week (3 priorities)
4. Blockers/concerns (if any)
5. Recommendations

Keep it professional, specific, actionable.`,
        },
      ],
      maxTokens: 1000,
    });

    return {
      summary: response.content,
      generatedAt: new Date(),
      period: { start: week.start, end: week.end },
    };
  }

  async detectAnomalies(): Promise<Anomaly[]> {
    const metrics = await this.calculateMetrics();
    const baseline = await this.getBaseline();

    const response = await this.router.route({
      role: 'analytics-anomaly',
      userId: this.userId,
      messages: [
        {
          role: 'user',
          content: `Detect anomalies in this week's activity:

Your Baseline (3-month average):
- Emails/day: ${baseline.emailsPerDay}
- Response time: ${baseline.avgResponseTime} hours
- Meetings/week: ${baseline.meetingsPerWeek}
- Tasks completed/week: ${baseline.tasksPerWeek}

This Week:
- Emails/day: ${metrics.emailsPerDay}
- Response time: ${metrics.avgResponseTime} hours
- Meetings: ${metrics.meetings}
- Tasks completed: ${metrics.tasksCompleted}

Identify:
1. Significant deviations (> 20%)
2. Likely causes
3. Recommendations

Return as JSON:
[
  { "metric": "...", "change": "percent", "cause": "...", "recommendation": "..." },
  ...
]`,
        },
      ],
      maxTokens: 400,
    });

    return JSON.parse(response.content);
  }

  private summarizeThreads(emails: Email[]): string {
    // Group by conversation thread, return top 3
    return '...';
  }

  private avgResponseTime(emails: Email[]): number {
    // Calculate average time to respond to received emails
    return 0;
  }

  // ... other helper methods
}
```

---

## Part 6: Settings UI (Cross-Platform)

Users should see:

- Which providers are connected
- Monthly cost/budget
- Which intelligence features are enabled

```
┌──────────────────────────────────────────────┐
│ Intelligence Settings                         │
├──────────────────────────────────────────────┤
│                                              │
│ 🔗 Provider Connection                       │
│ ├─ Primary: DeepSeek v3.2    [✓ Connected] │
│ ├─ Fallback: Gemini Flash    [✓ Connected] │
│ └─ [+ Add Custom Provider (BYOK)]           │
│                                              │
│ 💰 Monthly Costs                             │
│ ├─ This Month: $0.84 / Unlimited            │
│ ├─ Email Intelligence:  $0.34               │
│ ├─ Calendar Intelligence: $0.42             │
│ ├─ Analytics: $0.08                         │
│ └─ ☑️ Warn me at 75% budget                 │
│                                              │
│ ✨ Features (All Enabled)                    │
│ ├─ ☑️ Email composition                     │
│ ├─ ☑️ Email classification                  │
│ ├─ ☑️ Email response suggestions            │
│ ├─ ☑️ Meeting prep                          │
│ ├─ ☑️ Time blocking                         │
│ ├─ ☑️ Task prioritization                   │
│ ├─ ☑️ Task breakdown                        │
│ ├─ ☑️ Weekly summaries                      │
│ └─ ☑️ Anomaly detection                     │
│                                              │
│                     [Save Settings]          │
└──────────────────────────────────────────────┘
```

---

## Part 7: Implementation Roadmap

### Week 13: LLM Router Foundation

- [ ] Multi-provider abstraction (DeepSeek, Gemini, Claude)
- [ ] Provider configuration & credential storage
- [ ] Cost tracking & analytics database
- [ ] Pre-execution logging to Discord
- [ ] Unit tests (provider implementations)

### Week 14: Settings UI

- [ ] Web settings page (React + Tailwind)
- [ ] iOS settings view (SwiftUI)
- [ ] Android settings screen (Compose)
- [ ] Provider connection flow
- [ ] Integration tests

### Week 15: Email Intelligence

- [ ] Composition assistance
- [ ] Classification engine
- [ ] Response suggestions
- [ ] React component integration
- [ ] Tests

### Week 16: Calendar Intelligence

- [ ] Meeting preparation
- [ ] Time blocking suggestions
- [ ] iOS/Android components
- [ ] Tests

### Week 17: Task Intelligence + Analytics

- [ ] Task prioritization
- [ ] Task breakdown
- [ ] Weekly summary (Sunday 6pm scheduler)
- [ ] Anomaly detection
- [ ] Analytics dashboard
- [ ] Tests

### Week 18: Mobile Integration

- [ ] iOS full feature set
- [ ] Android full feature set
- [ ] Cross-platform consistency
- [ ] E2E tests

### Week 19: Optimization & Polish

- [ ] Performance tuning (latency < 2s for composition)
- [ ] Streaming responses for real-time UI
- [ ] Error handling & fallbacks
- [ ] Cost optimization

### Week 20: Production Deployment

- [ ] Security audit (no secrets in logs)
- [ ] Performance testing
- [ ] User documentation
- [ ] Production rollout

---

## Success Criteria

### Phase 8A (Foundation - Week 13-14)

- ✅ LLM router handles all provider types without code changes
- ✅ Cost tracking accurate (verified against provider invoices)
- ✅ Zero sensitive data in Discord logs
- ✅ Settings UI works on Web, iOS, Android

### Phase 8B (Intelligence - Week 15-17)

- ✅ Email composition: 90%+ user approval
- ✅ Email classification: 95%+ accuracy (validated by user feedback)
- ✅ Response suggestions: 80%+ usage rate
- ✅ Meeting prep: Generated 30 seconds before meeting starts
- ✅ Task prioritization: 85%+ of suggestions accepted
- ✅ Weekly summary: Generated every Sunday 6pm
- ✅ Anomaly detection: 0 false positives in first week

### Phase 8C (Mobile - Week 18)

- ✅ All features working on iOS native UI
- ✅ All features working on Android native UI
- ✅ Cross-platform data consistency

### Phase 8D (Production - Week 20)

- ✅ 99.5% uptime for all LLM calls
- ✅ Average latency: < 2 seconds for composition
- ✅ Zero unplanned failures in first 30 days
- ✅ All logs pre-execution and complete
- ✅ Hash chain verified immutable

---

## Cost Estimate

**Provider costs (per 1M tokens):**

- DeepSeek v3.2: $0.10 input, $0.40 output
- Gemini Flash: $0.038 input, $0.15 output
- Claude: Varies by model

**Per-user monthly cost (conservative):**

- Email composition: $0.10
- Email classification: $0.09
- Email responses: $0.03
- Meeting prep: $0.06
- Task prioritization: $0.02
- Analytics: $0.05
- **Total: ~$0.35/user/month** (Helix absorbs)

---

## Critical Files to Create

**New Services:**

```
web/src/services/llm-router/
  ├─ types.ts (150 lines)
  ├─ router.ts (300 lines)
  ├─ providers/
  │  ├─ deepseek.ts (150 lines)
  │  ├─ gemini.ts (150 lines)
  │  └─ claude.ts (150 lines)
  └─ cost-tracker.ts (100 lines)

web/src/services/intelligence/
  ├─ email-intelligence.ts (400 lines)
  ├─ calendar-intelligence.ts (350 lines)
  ├─ task-intelligence.ts (300 lines)
  └─ analytics-intelligence.ts (350 lines)
```

**New UI:**

```
web/src/pages/Settings/
  └─ IntelligenceSettings.tsx (400 lines)

helix-runtime/apps/ios/Sources/Intelligence/
  ├─ EmailIntelligence.swift (300 lines)
  └─ CalendarIntelligence.swift (250 lines)

helix-runtime/apps/android/app/src/main/kotlin/com/helix/intelligence/
  ├─ EmailIntelligence.kt (300 lines)
  └─ CalendarIntelligence.kt (250 lines)
```

**Tests:**

```
tests/intelligence/
  ├─ email-intelligence.test.ts (400 lines)
  ├─ calendar-intelligence.test.ts (350 lines)
  ├─ task-intelligence.test.ts (300 lines)
  └─ analytics-intelligence.test.ts (300 lines)
```

**Database:**

```sql
-- Track all intelligence requests for analytics
CREATE TABLE intelligence_requests (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  role TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  inputTokens INT,
  outputTokens INT,
  cost DECIMAL,
  latency INT,
  success BOOLEAN,
  error TEXT,
  timestamp TIMESTAMP,
  month TEXT
);

-- Track monthly costs per user
CREATE TABLE user_monthly_spend (
  userId UUID PRIMARY KEY,
  month TEXT PRIMARY KEY,
  totalCost DECIMAL,
  byRole JSONB
);
```

---

## Next Steps

1. **Review & Approve** - Confirm architecture before coding
2. **Week 13: Execution** - Build router + settings UI
3. **Week 14-17: Features** - Intelligence modules
4. **Week 18-20: Polish & Deploy** - Mobile + production

Ready to proceed with Week 13?
