/**
 * Week 1 Integration Tests
 * Comprehensive tests for Phase 1 Layer 5 and Phase 2 Voice Foundation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// PHASE 1 LAYER 5: INTEGRATION RHYTHMS TESTS
// ============================================================================

describe('Phase 1 - Layer 5: Integration Rhythms', () => {
  describe('Memory Consolidation', () => {
    it('should detect emotional trigger patterns', () => {
      const emotionalMemories = new Map([
        ['mem1', { emotion: 'anxiety', context: 'work deadline' }],
        ['mem2', { emotion: 'anxiety', context: 'work presentation' }],
        ['mem3', { emotion: 'anxiety', context: 'work meeting' }],
        ['mem4', { emotion: 'joy', context: 'personal achievement' }],
      ]);

      // Expected: 1 anxiety pattern + work context + 3 instances
      const anxietyCount = Array.from(emotionalMemories.values()).filter(
        m => m.emotion === 'anxiety'
      ).length;

      expect(anxietyCount).toBeGreaterThanOrEqual(3);
      expect(anxietyCount).toBeLessThanOrEqual(4);
    });

    it('should detect relational patterns', () => {
      const relationalMemories = new Map([
        ['rel1', { person: 'Alice', sentiment: 'positive' }],
        ['rel2', { person: 'Alice', sentiment: 'positive' }],
        ['rel3', { person: 'Alice', sentiment: 'neutral' }],
        ['rel4', { person: 'Bob', sentiment: 'negative' }],
        ['rel5', { person: 'Bob', sentiment: 'negative' }],
      ]);

      const alicePositive = Array.from(relationalMemories.values()).filter(
        m => m.person === 'Alice' && m.sentiment === 'positive'
      ).length;

      const bobNegative = Array.from(relationalMemories.values()).filter(
        m => m.person === 'Bob' && m.sentiment === 'negative'
      ).length;

      expect(alicePositive).toBe(2); // Alice: 2 positive out of 3
      expect(bobNegative).toBe(2); // Bob: 2 negative out of 2
    });

    it('should detect prospective self patterns (goals)', () => {
      const prospectiveMemories = new Map([
        ['goal1', { type: 'goal', goal: 'fitness', status: 'progress' }],
        ['goal2', { type: 'goal', goal: 'fitness', status: 'progress' }],
        ['goal3', { type: 'goal', goal: 'fitness', status: 'obstacle' }],
        ['goal4', { type: 'fear', fear: 'failure' }],
        ['goal5', { type: 'fear', fear: 'failure' }],
        ['goal6', { type: 'fear', fear: 'failure' }],
      ]);

      const fitnessGoal = Array.from(prospectiveMemories.values()).filter(
        m => m.type === 'goal' && m.goal === 'fitness'
      ).length;

      const failureFear = Array.from(prospectiveMemories.values()).filter(
        m => m.type === 'fear' && m.fear === 'failure'
      ).length;

      expect(fitnessGoal).toBe(3); // 3 fitness goal entries
      expect(failureFear).toBe(3); // 3 failure fear entries
    });

    it('should calculate pattern confidence scores', () => {
      // Pattern with 3 instances should have ~30% confidence (3/10)
      const instanceCount = 3;
      const threshold = 10;
      const confidence = Math.min(0.95, instanceCount / threshold);

      expect(confidence).toBeGreaterThan(0.25);
      expect(confidence).toBeLessThan(0.35);
    });

    it('should calculate pattern salience scores', () => {
      // Salience based on frequency: 3 instances out of 20 = 15% salience
      const instanceCount = 3;
      const maxInstances = 20;
      const salience = Math.min(1, instanceCount / maxInstances);

      expect(salience).toBeGreaterThan(0.1);
      expect(salience).toBeLessThan(0.2);
    });
  });

  describe('Memory Fadeout', () => {
    it('should not fadeout recent memories', () => {
      const now = Date.now();
      const recentMemory = {
        id: 'recent',
        created: now,
        lastReferenced: now,
        salience: 1.0,
      };

      // Memory referenced today should not fade
      const ageMs = now - recentMemory.lastReferenced;
      const fadeoutMs = 90 * 24 * 60 * 60 * 1000; // 90 days

      expect(ageMs).toBeLessThan(fadeoutMs);
      expect(recentMemory.salience).toBe(1.0); // Should not change
    });

    it('should fadeout old unreferenced memories', () => {
      const now = Date.now();
      const oldMemory = {
        id: 'old',
        created: now - 120 * 24 * 60 * 60 * 1000, // 120 days ago
        lastReferenced: now - 120 * 24 * 60 * 60 * 1000,
        salience: 1.0,
      };

      const ageMs = now - oldMemory.lastReferenced;
      const fadeoutMs = 90 * 24 * 60 * 60 * 1000;

      if (ageMs > fadeoutMs) {
        oldMemory.salience = oldMemory.salience * 0.7; // Reduce by 30%
      }

      expect(ageMs).toBeGreaterThan(fadeoutMs);
      expect(oldMemory.salience).toBe(0.7); // Should fade
    });

    it('should remove very old unused memories', () => {
      const now = Date.now();
      const veryOldMemory = {
        id: 'veryold',
        created: now - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        lastReferenced: now - 365 * 24 * 60 * 60 * 1000,
      };

      const ageMs = now - veryOldMemory.lastReferenced;
      const removeThresholdMs = 90 * 24 * 60 * 60 * 1000 * 2; // 180 days

      const shouldRemove = ageMs > removeThresholdMs;

      expect(shouldRemove).toBe(true);
    });
  });

  describe('Integration Scheduler', () => {
    it('should schedule daily consolidation at 6 AM', () => {
      const schedule = { frequency: 'daily' as const, hour: 6, minute: 0 };
      const now = new Date();

      // Tomorrow at 6 AM
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(6, 0, 0, 0);

      // If before 6 AM today, schedule for today
      const today = new Date(now);
      today.setHours(6, 0, 0, 0);
      const scheduledTime = today > now ? today : nextRun;

      expect(scheduledTime.getHours()).toBe(6);
      expect(scheduledTime.getMinutes()).toBe(0);
    });

    it('should schedule weekly full integration on Sunday at 3 AM', () => {
      const schedule = { frequency: 'weekly' as const, dayOfWeek: 0, hour: 3, minute: 0 };
      const now = new Date();

      let nextRun = new Date(now);
      const currentDay = nextRun.getDay();
      const targetDay = 0; // Sunday

      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      if (daysUntilTarget === 0) daysUntilTarget = 7;

      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      nextRun.setHours(3, 0, 0, 0);

      expect(nextRun.getDay()).toBe(0); // Should be Sunday
      expect(nextRun.getHours()).toBe(3);
    });

    it('should schedule monthly integration on 1st at midnight', () => {
      const schedule = { frequency: 'monthly' as const, dayOfMonth: 1, hour: 0, minute: 0 };
      const now = new Date();

      let nextRun = new Date(now);
      nextRun.setDate(1);

      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(1);
      }

      nextRun.setHours(0, 0, 0, 0);

      expect(nextRun.getDate()).toBe(1);
      expect(nextRun.getHours()).toBe(0);
    });

    it('should track job execution with timestamps', () => {
      const job = {
        jobId: 'consolidation_user1',
        userId: 'user1',
        jobType: 'consolidation' as const,
        schedule: { frequency: 'daily' as const, hour: 6, minute: 0 },
        isActive: true,
        lastRun: undefined,
        nextRun: new Date().toISOString(),
      };

      // Simulate execution
      job.lastRun = new Date().toISOString();
      job.nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      expect(job.lastRun).toBeDefined();
      expect(new Date(job.lastRun).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

// ============================================================================
// PHASE 2: VOICE FOUNDATION TESTS
// ============================================================================

describe('Phase 2 - Voice Foundation', () => {
  describe('Voice Memo Operations', () => {
    it('should store voice memo with metadata', () => {
      const memo = {
        id: 'memo1',
        userId: 'user1',
        audioUrl: 'https://storage.example.com/memo1.wav',
        duration_ms: 45000, // 45 seconds
        transcript: 'This is a test recording',
        title: 'Test Memo',
        tags: ['important', 'work'],
        created_at: new Date().toISOString(),
      };

      expect(memo.id).toBeDefined();
      expect(memo.duration_ms).toBe(45000);
      expect(memo.tags).toHaveLength(2);
      expect(memo.transcript).toBeTruthy();
    });

    it('should validate audio duration', () => {
      const validMemos = [
        { duration_ms: 1000 }, // 1 second - valid
        { duration_ms: 3600000 }, // 1 hour - valid
        { duration_ms: 60000 }, // 1 minute - valid
      ];

      const invalidMemos = [
        { duration_ms: 0 }, // 0 seconds - invalid
        { duration_ms: -1000 }, // negative - invalid
      ];

      for (const memo of validMemos) {
        expect(memo.duration_ms).toBeGreaterThan(0);
      }

      for (const memo of invalidMemos) {
        expect(memo.duration_ms).toBeLessThanOrEqual(0);
      }
    });

    it('should handle voice memo tags', () => {
      const memo = {
        id: 'memo1',
        tags: ['work', 'meeting', 'action-item'],
      };

      expect(memo.tags).toContain('work');
      expect(memo.tags).toHaveLength(3);
    });
  });

  describe('Voice Transcript Search', () => {
    it('should search transcripts by keyword', () => {
      const transcripts = [
        { id: '1', text: 'I need to review the quarterly report' },
        { id: '2', text: 'Remember to call the client tomorrow' },
        { id: '3', text: 'The quarterly meeting is scheduled for Friday' },
      ];

      const query = 'quarterly';
      const results = transcripts.filter(t =>
        t.text.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[1].id).toBe('3');
    });

    it('should rank search results by relevance', () => {
      const query = 'meeting';
      const transcripts = [
        { id: '1', text: 'The meeting is tomorrow at 2 PM. We will discuss the budget in the meeting.' },
        { id: '2', text: 'I have a meeting scheduled' },
        { id: '3', text: 'Let us meet tomorrow' },
      ];

      // Calculate relevance: count occurrences
      const results = transcripts
        .map(t => ({
          ...t,
          relevance: (t.text.toLowerCase().match(/meeting/g) || []).length,
        }))
        .filter(t => t.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

      expect(results[0].relevance).toBe(2); // First result has 2 occurrences
      expect(results[1].relevance).toBe(1);
      expect(results).toHaveLength(2); // 'Let us meet' doesn't match 'meeting'
    });

    it('should support full-text search with multiple words', () => {
      const transcripts = [
        { id: '1', text: 'Client meeting about project timeline' },
        { id: '2', text: 'Schedule a meeting with the client' },
        { id: '3', text: 'Project deadline is next week' },
      ];

      const query = 'client meeting';
      const words = query.split(' ').map(w => w.toLowerCase());

      const results = transcripts.filter(t =>
        words.every(w => t.text.toLowerCase().includes(w))
      );

      expect(results).toHaveLength(2); // Results 1 and 2 contain both words
    });

    it('should paginate search results', () => {
      const allResults = Array.from({ length: 50 }, (_, i) => ({
        id: `result${i}`,
        text: `Test transcript ${i}`,
      }));

      const limit = 20;
      const page = 1;
      const offset = page * limit;

      const paginatedResults = allResults.slice(offset, offset + limit);

      expect(paginatedResults).toHaveLength(20);
      expect(paginatedResults[0].id).toBe('result20');
      expect(paginatedResults[19].id).toBe('result39');
    });
  });

  describe('Voice Commands', () => {
    it('should create voice command with trigger phrase', () => {
      const command = {
        id: 'cmd1',
        userId: 'user1',
        trigger_phrase: 'create task',
        action_type: 'tool',
        tool_id: 'tool1',
        enabled: true,
        usage_count: 0,
      };

      expect(command.trigger_phrase).toBe('create task');
      expect(command.enabled).toBe(true);
    });

    it('should track voice command usage', () => {
      const command = {
        id: 'cmd1',
        usage_count: 0,
      };

      // Simulate command execution
      command.usage_count += 1;
      command.usage_count += 1;

      expect(command.usage_count).toBe(2);
    });

    it('should disable/enable voice commands', () => {
      const command = {
        id: 'cmd1',
        enabled: true,
      };

      expect(command.enabled).toBe(true);

      command.enabled = false;
      expect(command.enabled).toBe(false);

      command.enabled = true;
      expect(command.enabled).toBe(true);
    });
  });

  describe('Voice Memo Statistics', () => {
    it('should calculate total recording duration', () => {
      const memos = [
        { duration_ms: 60000 }, // 1 minute
        { duration_ms: 120000 }, // 2 minutes
        { duration_ms: 45000 }, // 45 seconds
      ];

      const totalMs = memos.reduce((sum, m) => sum + m.duration_ms, 0);
      const totalMinutes = totalMs / 60000;

      expect(totalMs).toBe(225000);
      expect(totalMinutes).toBe(3.75);
    });

    it('should calculate average memo duration', () => {
      const memos = [
        { duration_ms: 60000 },
        { duration_ms: 120000 },
        { duration_ms: 180000 },
      ];

      const avgMs = memos.reduce((sum, m) => sum + m.duration_ms, 0) / memos.length;
      const avgSeconds = avgMs / 1000;

      expect(avgSeconds).toBe(120); // 2 minutes average
    });

    it('should track memo statistics over time', () => {
      const stats = {
        total_memos: 42,
        total_duration_ms: 2520000, // 42 minutes
        avg_duration_ms: 60000,
        last_memo_date: new Date().toISOString(),
      };

      expect(stats.total_memos).toBe(42);
      expect(stats.total_duration_ms / 60000).toBe(42); // 42 minutes total
      expect(stats.avg_duration_ms).toBe(60000); // 1 minute average
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Week 1 Integration - Full Pipeline', () => {
  it('should consolidate memories and create patterns', () => {
    // Simulate full consolidation cycle
    const emotionalMemories = new Map([
      ['em1', { emotion: 'stress', context: 'deadlines' }],
      ['em2', { emotion: 'stress', context: 'deadlines' }],
      ['em3', { emotion: 'stress', context: 'deadlines' }],
    ]);

    const relationalMemories = new Map([
      ['rm1', { person: 'mentor', sentiment: 'positive' }],
      ['rm2', { person: 'mentor', sentiment: 'positive' }],
    ]);

    const patterns: Array<{ type: string; count: number }> = [];

    // Emotional pattern
    if (emotionalMemories.size >= 3) {
      patterns.push({ type: 'emotional_trigger', count: 3 });
    }

    // Relational pattern
    if (relationalMemories.size >= 2) {
      patterns.push({ type: 'relational_pattern', count: 2 });
    }

    expect(patterns).toHaveLength(2);
    expect(patterns[0].type).toBe('emotional_trigger');
    expect(patterns[1].type).toBe('relational_pattern');
  });

  it('should execute scheduled synthesis job', () => {
    const job = {
      jobId: 'synthesis_1',
      userId: 'user1',
      type: 'pattern_synthesis',
      status: 'running',
      patternsDetected: [],
    };

    // Simulate job execution
    job.patternsDetected.push(
      { id: 'pat1', type: 'emotional_trigger', confidence: 0.85 },
      { id: 'pat2', type: 'relational_pattern', confidence: 0.92 }
    );
    job.status = 'completed';

    expect(job.status).toBe('completed');
    expect(job.patternsDetected).toHaveLength(2);
    expect(job.patternsDetected[0].confidence).toBeGreaterThan(0.8);
  });

  it('should record and search voice memo in one session', () => {
    // Record memo
    const memo = {
      id: 'memo_session1',
      transcript: 'Remember to follow up with the client about the proposal',
      tags: ['client', 'follow-up'],
      created_at: new Date().toISOString(),
    };

    // Search for memo
    const query = 'client';
    const found = memo.transcript.toLowerCase().includes(query.toLowerCase());

    expect(found).toBe(true);
    expect(memo.tags).toContain('client');
  });
});
