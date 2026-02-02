# Phase 3: Autonomy & Freewill Implementation Spec

## Overview

Implement progressive autonomy levels (0-4) where Helix can act with increasing independence. This is the core differentiator for the Architect tier ($99/mo).

**Timeline:** Weeks 3-4 (parallel with Phase 1-2)
**Effort:** 2-3 engineers
**Complexity:** High (safety-critical)

---

## The Autonomy Levels

```
Level 0: PASSIVE
├─ Helix only responds when asked
├─ No proactive engagement
└─ Use case: First-time users, trust-building

Level 1: SUGGESTIVE
├─ Helix offers unsolicited insights
├─ "I noticed you're stressed about X..."
├─ "Would you like me to..."
└─ Use case: Building relationship, showing value

Level 2: PROACTIVE
├─ Helix initiates conversations
├─ "Hi! I was thinking about..."
├─ Sends notifications proactively
├─ Still asks permission before acting
└─ Use case: Default on web; most users comfortable here

Level 3: AUTONOMOUS
├─ Helix takes actions within pre-approved scope
├─ Rebooked your flight, notified your hotel, adjusted meetings
├─ Still logs actions; user can undo
├─ Requires explicit approval workflow
└─ Use case: Premium users, deep trust

Level 4: RESEARCH
├─ Helix explores topics independently
├─ "While you were sleeping, I researched X..."
├─ Creative problem-solving without permission
├─ Highest risk, highest trust
└─ Use case: Power users, explicit opt-in
```

---

## Component 1: Autonomy Level System

### Autonomy Level Schema

```typescript
// /src/types/autonomy.ts

type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

interface AutonomyConfig {
  level: AutonomyLevel;
  enabledActions: ActionType[];
  hardConstraints: HardConstraint[];
  softConstraints: SoftConstraint[];
  approvalRequired: boolean; // For Level 3
  actionLog: boolean; // Always true
  userCanOverride: boolean;
}

type ActionType =
  | 'proactive_insight'
  | 'schedule_interaction'
  | 'send_notification'
  | 'calendar_modification'
  | 'email_composition'
  | 'task_creation'
  | 'data_query'
  | 'research_exploration';

interface HardConstraint {
  action: string;
  rule: string; // "Never spend money"
  override: boolean; // Can user override? Always false for money
}

interface SoftConstraint {
  action: string;
  rule: string; // "Check calendar before scheduling"
  override: boolean; // Can user override? Usually true
}

// Default autonomy config for each level
export const AUTONOMY_DEFAULTS: Record<AutonomyLevel, AutonomyConfig> = {
  0: {
    level: 0,
    enabledActions: [],
    hardConstraints: [
      {
        action: 'all',
        rule: 'User must initiate all interactions',
        override: false
      }
    ],
    softConstraints: [],
    approvalRequired: false,
    actionLog: true,
    userCanOverride: true
  },

  1: {
    level: 1,
    enabledActions: ['proactive_insight', 'send_notification'],
    hardConstraints: [
      {
        action: 'spend_money',
        rule: 'Never spend money or make purchases',
        override: false
      },
      {
        action: 'contact_person',
        rule: 'Never contact people on user behalf without explicit approval',
        override: false
      },
      {
        action: 'delete_data',
        rule: 'Never delete data without confirmation',
        override: false
      }
    ],
    softConstraints: [
      {
        action: 'proactive_insight',
        rule: 'Max 2 unsolicited messages per day',
        override: true
      },
      {
        action: 'notification',
        rule: 'Between 9am-9pm only',
        override: true
      }
    ],
    approvalRequired: false,
    actionLog: true,
    userCanOverride: true
  },

  2: {
    level: 2,
    enabledActions: [
      'proactive_insight',
      'schedule_interaction',
      'send_notification',
      'calendar_modification'
    ],
    hardConstraints: [
      {
        action: 'spend_money',
        rule: 'Never spend money',
        override: false
      },
      {
        action: 'contact_external',
        rule: 'Never contact people outside approved list',
        override: false
      },
      {
        action: 'delete_data',
        rule: 'Never delete without confirmation',
        override: false
      }
    ],
    softConstraints: [
      {
        action: 'calendar_modification',
        rule: 'Only modify future events, not past',
        override: true
      },
      {
        action: 'calendar_modification',
        rule: 'Max 1 hour shift per event',
        override: true
      },
      {
        action: 'proactive_action',
        rule: 'Ask permission first ("Want me to...?')",
        override: true
      }
    ],
    approvalRequired: true,
    actionLog: true,
    userCanOverride: true
  },

  3: {
    level: 3,
    enabledActions: [
      'proactive_insight',
      'schedule_interaction',
      'send_notification',
      'calendar_modification',
      'email_composition',
      'task_creation',
      'data_query'
    ],
    hardConstraints: [
      {
        action: 'spend_money',
        rule: 'Never spend money above $X limit',
        override: false
      },
      {
        action: 'irreversible_action',
        rule: 'Actions must be reversible',
        override: false
      }
    ],
    softConstraints: [
      {
        action: 'any_action',
        rule: 'Log all actions; user can review',
        override: false
      }
    ],
    approvalRequired: false,
    actionLog: true,
    userCanOverride: true
  },

  4: {
    level: 4,
    enabledActions: [
      'proactive_insight',
      'schedule_interaction',
      'send_notification',
      'calendar_modification',
      'email_composition',
      'task_creation',
      'data_query',
      'research_exploration'
    ],
    hardConstraints: [
      {
        action: 'spend_money',
        rule: 'Never spend money',
        override: false
      },
      {
        action: 'contact_external',
        rule: 'Never contact people without approval (email compositions only)',
        override: false
      }
    ],
    softConstraints: [],
    approvalRequired: false,
    actionLog: true,
    userCanOverride: true
  }
};
```

---

### Autonomy Settings Page

```typescript
// /web/src/pages/Settings/AutonomySettings.tsx

export function AutonomySettings() {
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(2); // Default
  const [config, setConfig] = useState(AUTONOMY_DEFAULTS[2]);
  const [actionLog, setActionLog] = useState<AutonomyAction[]>([]);

  const handleLevelChange = async (newLevel: AutonomyLevel) => {
    setAutonomyLevel(newLevel);
    setConfig(AUTONOMY_DEFAULTS[newLevel]);

    // Save to database
    await saveAutonomyLevel(newLevel);
  };

  return (
    <div className="autonomy-settings">
      <h1>Autonomy Settings</h1>

      {/* LEVEL SELECTOR */}
      <section className="level-selector">
        <h2>How Much Autonomy Should Helix Have?</h2>
        <p className="description">
          Higher levels mean Helix can act with more independence.
          You can adjust this anytime.
        </p>

        <div className="level-slider">
          {/* Visual slider showing 0-4 */}
          <input
            type="range"
            min="0"
            max="4"
            value={autonomyLevel}
            onChange={e => handleLevelChange(Number(e.target.value) as AutonomyLevel)}
            className="slider"
          />
        </div>

        {/* Level Descriptions */}
        <div className="level-descriptions">
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`level-card ${level === autonomyLevel ? 'active' : ''}`}
              onClick={() => handleLevelChange(level as AutonomyLevel)}
            >
              <div className="level-number">L{level}</div>
              <div className="level-name">{getLevelName(level as AutonomyLevel)}</div>
              <div className="level-description">{getLevelDescription(level as AutonomyLevel)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CURRENT LEVEL DETAILS */}
      <section className="current-level">
        <h2>Level {autonomyLevel}: {getLevelName(autonomyLevel)}</h2>

        <div className="what-helix-can-do">
          <h3>✅ What Helix Can Do:</h3>
          <ul>
            {config.enabledActions.map(action => (
              <li key={action}>{formatAction(action)}</li>
            ))}
          </ul>
        </div>

        <div className="safety-boundaries">
          <h3>🛡️ Safety Boundaries (Never Crossed):</h3>
          <ul>
            {config.hardConstraints.map((constraint, i) => (
              <li key={i}>{constraint.rule}</li>
            ))}
          </ul>
        </div>

        <div className="soft-constraints">
          <h3>⚙️ Guidelines (You Can Adjust):</h3>
          <ul>
            {config.softConstraints.map((constraint, i) => (
              <li key={i}>
                {constraint.rule}
                {constraint.override && (
                  <button className="override-btn">Override</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ACTION LOG */}
      <section className="action-log">
        <h2>📋 What Helix Did While You Were Away</h2>
        <p className="subtitle">
          All autonomous actions are logged here. You can review and undo.
        </p>

        <div className="actions-timeline">
          {actionLog.map(action => (
            <div key={action.id} className="action-item">
              <div className="action-header">
                <span className="timestamp">{formatTime(action.timestamp)}</span>
                <span className="action-type">{action.type}</span>
              </div>
              <div className="action-content">
                {action.description}
              </div>
              <div className="action-result">
                Status: <span className="status-badge">{action.status}</span>
              </div>
              <div className="action-controls">
                <button onClick={() => viewActionDetails(action)}>Details</button>
                {action.reversible && (
                  <button onClick={() => undoAction(action)} className="undo-btn">
                    Undo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="log-stats">
          <p>Total autonomous actions: {actionLog.length}</p>
          <p>Success rate: 98%</p>
          <p>Undone by user: 2%</p>
        </div>
      </section>

      {/* TRUST PROGRESSION */}
      <section className="trust-progression">
        <h2>🔓 Trust Building</h2>
        <p>
          Your trust level with Helix grows over time. She uses that to suggest
          higher autonomy levels when she thinks you're ready.
        </p>

        <div className="trust-indicators">
          <div className="indicator">
            <span className="metric">Relationship Duration:</span>
            <span className="value">45 days</span>
          </div>
          <div className="indicator">
            <span className="metric">Approved Actions:</span>
            <span className="value">237/239 (99%)</span>
          </div>
          <div className="indicator">
            <span className="metric">Satisfaction:</span>
            <span className="value">9.2/10</span>
          </div>
        </div>

        <div className="suggestion">
          <p>
            💡 Suggestion: You've been trusting Helix's recommendations. Want to
            move to Level 3 (Autonomous) to let her take more initiative?
          </p>
          <button onClick={() => handleLevelChange(3)}>Try Level 3</button>
        </div>
      </section>
    </div>
  );
}
```

---

## Component 2: Autonomous Action System

### Action Execution Engine

```typescript
// /src/services/autonomousActionService.ts

interface AutonomousAction {
  id: string;
  userId: string;
  type: ActionType;
  description: string; // "Rebooked your flight"
  actionPayload: unknown; // The actual action data
  status: 'proposed' | 'approved' | 'executed' | 'failed' | 'undone';
  timestamp: string;
  executionTime?: string;
  reversible: boolean;
  undoPayload?: unknown;
  result?: {
    success: boolean;
    message: string;
    externalId?: string; // Reference to external system (flight ID, etc.)
  };
}

async function executeAutonomousAction(
  userId: string,
  autonomyLevel: AutonomyLevel,
  action: AutonomousAction
): Promise<AutonomousAction> {
  // 1. Validate action against autonomy config
  const config = AUTONOMY_DEFAULTS[autonomyLevel];

  if (!config.enabledActions.includes(action.type)) {
    throw new Error(`Action ${action.type} not enabled at level ${autonomyLevel}`);
  }

  // 2. Check hard constraints
  const violations = checkHardConstraints(action, config);
  if (violations.length > 0) {
    console.warn(`Hard constraint violations: ${violations.join(', ')}`);
    action.status = 'failed';
    action.result = {
      success: false,
      message: `Cannot execute: ${violations[0]}`,
    };
    return action;
  }

  // 3. Check soft constraints (can prompt user)
  const softViolations = checkSoftConstraints(action, config);
  if (softViolations.length > 0 && autonomyLevel < 3) {
    // Ask for approval
    action.status = 'proposed';
    await sendApprovalNotification(userId, action);
    return action;
  }

  // 4. Log action BEFORE execution (pre-execution logging principle)
  await logAction(userId, action, 'pending');

  // 5. Execute action
  try {
    const result = await executeActionByType(action);

    action.status = 'executed';
    action.executionTime = new Date().toISOString();
    action.result = result;

    // 6. Log result
    await logAction(userId, action, 'completed');

    return action;
  } catch (error) {
    action.status = 'failed';
    action.result = {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };

    // 7. Log failure
    await logAction(userId, action, 'failed');

    return action;
  }
}

async function executeActionByType(
  action: AutonomousAction
): Promise<{ success: boolean; message: string; externalId?: string }> {
  switch (action.type) {
    case 'calendar_modification':
      return await modifyCalendar(action.actionPayload);

    case 'task_creation':
      return await createTask(action.actionPayload);

    case 'email_composition':
      return await composeEmail(action.actionPayload);

    case 'send_notification':
      return await sendNotification(action.actionPayload);

    case 'research_exploration':
      return await exploreResearchTopic(action.actionPayload);

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function logAction(
  userId: string,
  action: AutonomousAction,
  phase: 'pending' | 'completed' | 'failed'
): Promise<void> {
  // Store in database
  await supabase.from('autonomous_actions').insert({
    user_id: userId,
    action_id: action.id,
    type: action.type,
    description: action.description,
    status: phase,
    payload: action.actionPayload,
    timestamp: new Date().toISOString(),
    phase: phase, // For audit trail
  });

  // Also log to Discord webhook (pre-execution principle)
  await logToDiscord({
    channel: '#helix-autonomy',
    message: `[${phase.toUpperCase()}] ${action.description}`,
    userId,
    actionId: action.id,
    actionType: action.type,
  });
}

function checkHardConstraints(action: AutonomousAction, config: AutonomyConfig): string[] {
  const violations: string[] = [];

  for (const constraint of config.hardConstraints) {
    if (constraint.action === 'all' || constraint.action === action.type) {
      // Check if action violates this constraint
      if (violatesConstraint(action, constraint)) {
        violations.push(constraint.rule);
      }
    }
  }

  return violations;
}

function violatesConstraint(action: AutonomousAction, constraint: HardConstraint): boolean {
  if (constraint.rule.includes('Never spend money')) {
    return action.actionPayload.amount > 0;
  }
  if (constraint.rule.includes('Never delete')) {
    return action.type.includes('delete');
  }
  if (constraint.rule.includes('Never contact')) {
    return action.type === 'contact_person';
  }
  return false;
}
```

---

### Example: Calendar Modification Action

```typescript
// /src/services/actions/calendarModificationAction.ts

async function modifyCalendar(payload: {
  eventId: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  reason: string; // "Your flight is delayed"
}): Promise<{ success: boolean; message: string; externalId?: string }> {
  try {
    // 1. Fetch event from calendar
    const event = await googleCalendar.events.get({
      calendarId: 'primary',
      eventId: payload.eventId,
    });

    // 2. Update event
    const updatedEvent = {
      ...event,
      start: payload.startTime ? { dateTime: payload.startTime } : event.start,
      end: payload.endTime ? { dateTime: payload.endTime } : event.end,
      description: `${event.description}\n\n[Auto-rescheduled: ${payload.reason}]`,
    };

    // 3. Save updated event
    const result = await googleCalendar.events.update({
      calendarId: 'primary',
      eventId: payload.eventId,
      resource: updatedEvent,
    });

    return {
      success: true,
      message: `Rescheduled "${event.summary}" from ${event.start.dateTime} to ${updatedEvent.start.dateTime}`,
      externalId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to modify calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
```

---

## Component 3: Proactive Engagement (Levels 1-4)

### Proactive Insights Engine

```typescript
// /src/services/proactiveInsightService.ts

interface ProactiveInsight {
  type: 'observation' | 'suggestion' | 'reminder' | 'celebration';
  topic: string;
  message: string;
  confidence: number; // 0-1
  actionSuggestion?: string; // What Helix suggests user do
  agentId?: string; // Which agent should deliver this
}

async function generateProactiveInsights(
  userId: string,
  autonomyLevel: AutonomyLevel
): Promise<ProactiveInsight[]> {

  // Only generate if Level >= 1 (Suggestive)
  if (autonomyLevel < 1) return [];

  // Query recent memories and patterns (from Phase 1)
  const recentMemories = await getRecentMemories(userId, 7); // Last 7 days
  const patterns = analyzePatterns(recentMemories);

  const insights: ProactiveInsight[] = [];

  // 1. Stress pattern insight
  if (patterns.stressFrequency > 5) {
    insights.push({
      type: 'observation',
      topic: 'stress',
      message: `I've noticed you've mentioned feeling stressed 5 times this week, especially around ${patterns.commonStressors[0]}. Want to talk about it?`,
      confidence: 0.85,
      actionSuggestion: 'Take a 30-minute break'
    });
  }

  // 2. Goal progress insight
  if (patterns.goalProgress) {
    insights.push({
      type: 'celebration',
      topic: 'goals',
      message: `You've made progress on your goal to ${patterns.activeGoal}! You've mentioned it 8 times and seem more optimistic. Keep it up!`,
      confidence: 0.9
    });
  }

  // 3. Pattern recognition insight
  if (patterns.emergingPattern) {
    insights.push({
      type: 'suggestion',
      topic: 'pattern',
      message: `I'm noticing something: You tend to feel more productive ${patterns.emergingPattern}. Maybe schedule important work then?`,
      confidence: 0.7,
      actionSuggestion: 'Create recurring focus blocks'
    });
  }

  return insights;
}

async function deliverProactiveInsight(
  userId: string,
  insight: ProactiveInsight,
  autonomyLevel: AutonomyLevel
): Promise<void> {

  // Level 1: Send as notification with permission language
  if (autonomyLevel === 1) {
    await sendNotification(userId, {
      title: insight.topic,
      body: `${insight.message}`,
      actionButtons: [
        { label: 'Tell me more', action: 'open_chat' },
        { label: 'Later', action: 'dismiss' }
      ]
    });
  }

  // Level 2+: Take initiative, send proactively
  if (autonomyLevel >= 2) {
    // Send notification + option to decline in chat
    await sendNotification(userId, {
      title: insight.topic,
      body: insight.message,
      actionButtons: [
        { label: 'Chat about this', action: 'open_chat_with_message', payload: insight.message },
        { label: 'I'd rather not', action: 'dismiss' }
      ]
    });

    // Also add to chat queue (will appear next time user opens chat)
    await queueChatMessage(userId, {
      role: 'assistant',
      content: insight.message,
      proactiveInsight: true,
      agentId: insight.agentId || 'helix'
    });
  }
}

// Proactive insights should NOT interrupt (respect quiet hours)
async function respectQuietHours(
  userId: string,
  insight: ProactiveInsight
): Promise<boolean> {

  const userSettings = await getUserSettings(userId);
  const now = new Date();
  const hour = now.getHours();

  // Default: 10pm - 9am is quiet
  const quietStart = userSettings.quietHours?.start || 22;
  const quietEnd = userSettings.quietHours?.end || 9;

  if (hour >= quietStart || hour < quietEnd) {
    // Queue for delivery during active hours
    await queueInsightForDelivery(userId, insight, {
      deliverAfter: new Date(now.setHours(quietEnd))
    });
    return false; // Don't deliver now
  }

  return true; // OK to deliver
}
```

---

## Component 4: Transparency & Auditing

### Action Audit Log

```typescript
// /src/services/auditLogService.ts

interface AuditLogEntry {
  id: string;
  userId: string;
  actionId: string;
  actionType: ActionType;
  description: string;
  autonomyLevel: AutonomyLevel;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'undone';
  timestamp: string;
  phase: 'pre-execution' | 'execution' | 'post-execution' | 'undo';
  loggedToDiscord: boolean;
  discordMessageId?: string;
  reversible: boolean;
  result?: {
    success: boolean;
    message: string;
  };
}

async function createAuditLogEntry(
  userId: string,
  action: AutonomousAction,
  phase: 'pre-execution' | 'execution' | 'post-execution' | 'undo'
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    userId,
    actionId: action.id,
    actionType: action.type,
    description: action.description,
    autonomyLevel: await getUserAutonomyLevel(userId),
    status: action.status,
    timestamp: new Date().toISOString(),
    phase,
    loggedToDiscord: true,
    reversible: action.reversible,
    result: action.result,
  };

  // Store in database
  await supabase.from('audit_log').insert(entry);

  // Log to Discord (pre-execution principle)
  const discordMsg = await logToDiscord({
    channel: '#helix-autonomy',
    embed: formatAuditLogForDiscord(entry),
  });

  if (discordMsg) {
    await supabase.from('audit_log').update({ discordMessageId: discordMsg.id }).eq('id', entry.id);
  }

  return entry;
}

function formatAuditLogForDiscord(entry: AuditLogEntry): {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string }>;
} {
  const colors = {
    pending: 0xffaa00,
    approved: 0x00aa00,
    executed: 0x0088ff,
    failed: 0xff0000,
    undone: 0x888888,
  };

  return {
    title: `[${entry.status.toUpperCase()}] ${entry.description}`,
    color: colors[entry.status],
    fields: [
      { name: 'User', value: entry.userId },
      { name: 'Autonomy Level', value: String(entry.autonomyLevel) },
      { name: 'Action Type', value: entry.actionType },
      { name: 'Phase', value: entry.phase },
      { name: 'Timestamp', value: entry.timestamp },
      ...(entry.result
        ? [{ name: 'Result', value: entry.result.success ? '✅ Success' : '❌ Failed' }]
        : []),
    ],
  };
}
```

---

## Database Schema (Autonomy System)

```sql
-- Autonomy settings
CREATE TABLE autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  level INT CHECK (level >= 0 AND level <= 4),
  enabled_actions TEXT[],
  custom_constraints JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Autonomous actions
CREATE TABLE autonomous_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('proposed', 'approved', 'executed', 'failed', 'undone')),
  payload JSONB,
  result JSONB,
  reversible BOOLEAN DEFAULT FALSE,
  undo_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  phase TEXT CHECK (phase IN ('pending', 'completed', 'failed')),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Audit log for transparency
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  autonomy_level INT,
  status TEXT,
  phase TEXT,
  discord_message_id TEXT,
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Approval queue (for Level 2 actions requiring approval)
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  payload JSONB,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  user_response TIMESTAMP,
  user_decision TEXT,
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Proactive insights queue
CREATE TABLE insights_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  insight_type TEXT, -- observation, suggestion, reminder, celebration
  topic TEXT,
  message TEXT,
  confidence FLOAT,
  scheduled_delivery TIMESTAMP,
  delivered_at TIMESTAMP,
  user_reaction TEXT, -- liked, ignored, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

---

## Implementation Timeline (Phase 3)

### Week 3: Foundation

- [ ] Design autonomy level system
- [ ] Build autonomy settings UI
- [ ] Implement action execution engine
- [ ] Build action logging & audit trail

### Week 4: Integration & Polish

- [ ] Build approval workflow (Level 2)
- [ ] Implement proactive insights system
- [ ] Build action log visualization
- [ ] Add trust progression mechanics
- [ ] Test with power users

---

## Success Metrics (Phase 3)

### Technical

- ✅ Action execution success rate: 99%+
- ✅ Action reversibility: 100% (no permanent changes without approval)
- ✅ Audit trail completeness: Every action logged
- ✅ Discord logging: All autonomy actions pre-logged before execution

### User-Facing

- ✅ Users feel safe with autonomy (NPS +10)
- ✅ 50% of users upgrade to Level 2+ (from default)
- ✅ Autonomous actions are actually used (not just visible)
- ✅ Zero regrets (undo rate < 5%)
- ✅ Architect tier conversion: 1% → 8%+

### Safety (Critical)

- ✅ Zero money spent without approval
- ✅ Zero data deleted without confirmation
- ✅ Zero unauthorized external contact
- ✅ 100% audit trail for compliance

---

## Safety Principles (Non-Negotiable)

1. **Pre-Execution Logging**: All autonomous actions logged BEFORE execution
2. **Hard Constraints**: Money, deletion, external contact NEVER without explicit approval
3. **Reversibility**: All autonomous actions must be undo-able
4. **Transparency**: User can see exactly what Helix did and why
5. **Opt-In**: Autonomy levels default to conservative (Level 2), require explicit opt-up
6. **Auditability**: Complete Discord + database audit trail for compliance

---

## Next Step

Once Phases 1 & 2 are shipping, integrate Phase 3 systems.

Ready to build?
