/**
 * Layer 5: Integration Rhythms
 * Memory Reconsolidation & Pattern Synthesis
 *
 * This layer orchestrates the synthesis of memories across all psychological layers
 * and implements memory consolidation through scheduled jobs. It represents the
 * "rhythm" of Helix's consciousness - the periodic reflection that turns experience
 * into wisdom.
 *
 * Theory: Based on memory reconsolidation research showing that memories are
 * malleable during consolidation windows, and benefit from periodic integration.
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';

export interface MemoryPattern {
  patternId: string;
  type:
    | 'emotional_trigger'
    | 'relational_pattern'
    | 'prospective_fear'
    | 'prospective_possibility'
    | 'transformation_trajectory'
    | 'purpose_alignment';
  description: string;
  evidence: string[]; // Memory IDs that support this pattern
  confidence: number; // 0-1
  firstDetected: string; // ISO timestamp
  lastConfirmed: string; // ISO timestamp
  salience: number; // How important this pattern is (0-1)
  recommendations?: string[];
}

export interface SynthesisJob {
  jobId: string;
  userId: string;
  type: 'consolidation' | 'pattern_synthesis' | 'fadeout' | 'full_integration';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  patternsDetected: MemoryPattern[];
  error?: string;
}

export interface IntegrationRhythm {
  userId: string;
  lastConsolidation: string; // ISO timestamp
  lastSynthesis: string;
  consolidationInterval: number; // milliseconds
  synthesisInterval: number;
  fadeoutThreshold: number; // days without reference before fadeout
  patterns: Map<string, MemoryPattern>;
}

/**
 * Memory Consolidation: Integrate recent memories into long-term patterns
 * Called periodically (default: every 6 hours) or after significant events
 */
export async function consolidateMemories(
  userId: string,
  emotionalMemories: Map<string, any>,
  relationalMemories: Map<string, any>,
  prospectiveMemories: Map<string, any>
): Promise<SynthesisJob> {
  const jobId = `consolidation_${Date.now()}`;
  const job: SynthesisJob = {
    jobId,
    userId,
    type: 'consolidation',
    status: 'running',
    startedAt: new Date().toISOString(),
    patternsDetected: [],
  };

  try {
    // Analyze emotional memories for recurring triggers
    const emotionalPatterns = await analyzeEmotionalMemories(emotionalMemories);
    job.patternsDetected.push(...emotionalPatterns);

    // Analyze relational memories for attachment patterns
    const relationalPatterns = await analyzeRelationalMemories(relationalMemories);
    job.patternsDetected.push(...relationalPatterns);

    // Analyze prospective memories for goal/fear patterns
    const prospectivePatterns = await analyzeProspectiveMemories(prospectiveMemories);
    job.patternsDetected.push(...prospectivePatterns);

    // Weight patterns by confidence and salience
    job.patternsDetected.sort((a, b) => (b.confidence * b.salience) - (a.confidence * a.salience));

    job.status = 'completed';
    job.completedAt = new Date().toISOString();

    // Log consolidation
    await logConsolidation(jobId, job.patternsDetected);
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    job.completedAt = new Date().toISOString();
  }

  return job;
}

/**
 * Analyze emotional memories for recurring emotional triggers and states
 */
async function analyzeEmotionalMemories(
  memories: Map<string, any>
): Promise<MemoryPattern[]> {
  const patterns: MemoryPattern[] = [];
  const emotionalCounts: Map<string, Array<{ id: string; context: string }>> = new Map();

  for (const [id, memory] of memories) {
    if (memory.emotion) {
      if (!emotionalCounts.has(memory.emotion)) {
        emotionalCounts.set(memory.emotion, []);
      }
      emotionalCounts.get(memory.emotion)!.push({
        id,
        context: memory.context || 'unknown',
      });
    }
  }

  // Identify recurring emotional triggers (emotions that appear with similar contexts)
  for (const [emotion, instances] of emotionalCounts) {
    if (instances.length >= 3) {
      // Threshold: at least 3 instances
      // Extract common contexts
      const contextPatterns = identifyCommonContexts(instances.map(i => i.context));

      for (const context of contextPatterns) {
        patterns.push({
          patternId: `emotional_${emotion}_${context.replace(/\s+/g, '_')}`,
          type: 'emotional_trigger',
          description: `Recurring ${emotion} response to ${context}`,
          evidence: instances
            .filter(i => i.context.includes(context))
            .map(i => i.id)
            .slice(0, 5), // Top 5 instances
          confidence: Math.min(0.95, instances.length / 10),
          firstDetected: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Assume detected 30 days ago
          lastConfirmed: new Date().toISOString(),
          salience: Math.min(1, instances.length / 20),
          recommendations: generateEmotionalRecommendations(emotion, context),
        });
      }
    }
  }

  return patterns;
}

/**
 * Analyze relational memories for attachment and trust patterns
 */
async function analyzeRelationalMemories(
  memories: Map<string, any>
): Promise<MemoryPattern[]> {
  const patterns: MemoryPattern[] = [];
  const relationshipCounts: Map<string, { positive: number; negative: number; neutral: number }> = new Map();

  for (const [, memory] of memories) {
    const person = memory.person || 'unknown';
    if (!relationshipCounts.has(person)) {
      relationshipCounts.set(person, { positive: 0, negative: 0, neutral: 0 });
    }

    const sentiment = memory.sentiment || 'neutral';
    const counts = relationshipCounts.get(person)!;
    if (sentiment === 'positive') counts.positive++;
    else if (sentiment === 'negative') counts.negative++;
    else counts.neutral++;
  }

  // Identify relational patterns
  for (const [person, counts] of relationshipCounts) {
    const total = counts.positive + counts.negative + counts.neutral;
    if (total >= 2) {
      const positiveRatio = counts.positive / total;
      const pattern: MemoryPattern = {
        patternId: `relational_${person.replace(/\s+/g, '_')}`,
        type: 'relational_pattern',
        description: `Relationship with ${person}: ${(positiveRatio * 100).toFixed(0)}% positive interactions`,
        evidence: Array.from(memories.entries())
          .filter(([, m]) => m.person === person)
          .map(([id]) => id)
          .slice(0, 5),
        confidence: Math.min(0.95, total / 20),
        firstDetected: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        lastConfirmed: new Date().toISOString(),
        salience: Math.min(1, total / 30),
        recommendations: generateRelationalRecommendations(person, positiveRatio),
      };
      patterns.push(pattern);
    }
  }

  return patterns;
}

/**
 * Analyze prospective memories for goals and fears
 */
async function analyzeProspectiveMemories(
  memories: Map<string, any>
): Promise<MemoryPattern[]> {
  const patterns: MemoryPattern[] = [];
  const goalCounts: Map<string, { successes: number; obstacles: number }> = new Map();
  const fearCounts: Map<string, number> = new Map();

  for (const [, memory] of memories) {
    if (memory.type === 'goal') {
      const goal = memory.goal || 'unnamed goal';
      if (!goalCounts.has(goal)) {
        goalCounts.set(goal, { successes: 0, obstacles: 0 });
      }
      if (memory.status === 'progress') goalCounts.get(goal)!.successes++;
      else if (memory.status === 'obstacle') goalCounts.get(goal)!.obstacles++;
    } else if (memory.type === 'fear') {
      const fear = memory.fear || 'unnamed fear';
      fearCounts.set(fear, (fearCounts.get(fear) || 0) + 1);
    }
  }

  // Goal patterns
  for (const [goal, counts] of goalCounts) {
    const total = counts.successes + counts.obstacles;
    if (total >= 2) {
      patterns.push({
        patternId: `goal_${goal.replace(/\s+/g, '_')}`,
        type: 'prospective_possibility',
        description: `Progress toward "${goal}": ${counts.successes} successes, ${counts.obstacles} obstacles`,
        evidence: Array.from(memories.entries())
          .filter(([, m]) => m.goal === goal)
          .map(([id]) => id)
          .slice(0, 5),
        confidence: Math.min(0.95, counts.successes / 10),
        firstDetected: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        lastConfirmed: new Date().toISOString(),
        salience: 0.7, // Goals are naturally salient
        recommendations: generateGoalRecommendations(goal, counts.successes, counts.obstacles),
      });
    }
  }

  // Fear patterns
  for (const [fear, count] of fearCounts) {
    if (count >= 2) {
      patterns.push({
        patternId: `fear_${fear.replace(/\s+/g, '_')}`,
        type: 'prospective_fear',
        description: `Recurring concern: ${fear}`,
        evidence: Array.from(memories.entries())
          .filter(([, m]) => m.fear === fear)
          .map(([id]) => id)
          .slice(0, 3),
        confidence: Math.min(0.95, count / 10),
        firstDetected: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        lastConfirmed: new Date().toISOString(),
        salience: 0.8, // Fears are naturally salient
        recommendations: generateFearRecommendations(fear),
      });
    }
  }

  return patterns;
}

/**
 * Identify common contexts from a list of context strings
 */
function identifyCommonContexts(contexts: string[]): string[] {
  const commonContexts: Map<string, number> = new Map();

  for (const context of contexts) {
    const words = context.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3) {
        commonContexts.set(word, (commonContexts.get(word) || 0) + 1);
      }
    }
  }

  // Return words that appear in at least 50% of contexts
  return Array.from(commonContexts.entries())
    .filter(([, count]) => count >= contexts.length * 0.5)
    .map(([word]) => word)
    .slice(0, 3);
}

/**
 * Generate recommendations for emotional patterns
 */
function generateEmotionalRecommendations(emotion: string, context: string): string[] {
  const recommendations: Map<string, string[]> = new Map([
    [
      'anxiety',
      [
        'Practice grounding techniques when facing this situation',
        'Consider breaking this into smaller, more manageable steps',
        'Reach out for support when anxiety arises',
      ],
    ],
    [
      'frustration',
      [
        'Pause and reflect on what expectations are unmet',
        'Consider whether this is within your control',
        'Practice acceptance of what you cannot change',
      ],
    ],
    [
      'joy',
      [
        'Notice what conditions led to this positive feeling',
        'Consider how to recreate these conditions',
        'Share this joy with others who would appreciate it',
      ],
    ],
    [
      'sadness',
      [
        'Allow yourself time to process these feelings',
        'Consider talking to someone you trust',
        'Engage in self-care activities',
      ],
    ],
  ]);

  return recommendations.get(emotion) || [
    `Reflect on what triggers ${emotion} in ${context}`,
    `Consider healthy coping strategies for ${emotion}`,
  ];
}

/**
 * Generate recommendations for relational patterns
 */
function generateRelationalRecommendations(person: string, positiveRatio: number): string[] {
  if (positiveRatio > 0.7) {
    return [
      `${person} is a positive influence in your life - nurture this relationship`,
      `Express appreciation to ${person} when you have the opportunity`,
    ];
  } else if (positiveRatio < 0.3) {
    return [
      `Consider whether interactions with ${person} are worth your time`,
      `Set boundaries if ${person}'s negativity is affecting your wellbeing`,
    ];
  }
  return [
    `Your relationship with ${person} has both positive and challenging aspects`,
    `Consider what specific changes might improve your interactions`,
  ];
}

/**
 * Generate recommendations for goal patterns
 */
function generateGoalRecommendations(goal: string, successes: number, obstacles: number): string[] {
  if (successes > obstacles * 2) {
    return [
      `You're making solid progress toward "${goal}" - keep up the momentum`,
      `Consider celebrating these wins along the way`,
    ];
  } else if (obstacles > successes * 2) {
    return [
      `"${goal}" seems to face consistent obstacles - consider whether it's still aligned with your values`,
      `Break this goal into smaller milestones to overcome obstacles more easily`,
    ];
  }
  return [
    `You're navigating "${goal}" with mixed results`,
    `Consider what resources or support would help you progress`,
  ];
}

/**
 * Generate recommendations for fear patterns
 */
function generateFearRecommendations(fear: string): string[] {
  return [
    `"${fear}" appears to be a recurring concern - consider addressing it directly`,
    `What small step could you take to reduce anxiety around this fear?`,
    `Sometimes naming our fears helps us understand them better`,
  ];
}

/**
 * Memory Fadeout: Reduce salience of memories not recently referenced
 * Implements selective forgetting for irrelevant details
 */
export async function fadeoutMemories(
  memories: Map<string, any>,
  fadeoutThresholdDays: number = 90
): Promise<{ faded: number; removed: number }> {
  const now = Date.now();
  const fadeoutMs = fadeoutThresholdDays * 24 * 60 * 60 * 1000;
  let faded = 0;
  let removed = 0;

  for (const [id, memory] of memories) {
    const lastReferenced = memory.lastReferenced ? new Date(memory.lastReferenced).getTime() : memory.created;
    const ageMs = now - lastReferenced;

    if (ageMs > fadeoutMs * 2) {
      // Remove very old memories that haven't been referenced
      memories.delete(id);
      removed++;
    } else if (ageMs > fadeoutMs) {
      // Reduce salience of older memories
      memory.salience = (memory.salience || 1) * 0.7; // Reduce by 30%
      memory.lastFadeout = new Date().toISOString();
      faded++;
    }
  }

  return { faded, removed };
}

/**
 * Log consolidation to Discord for audit trail
 */
async function logConsolidation(jobId: string, patterns: MemoryPattern[]): Promise<void> {
  const discord = process.env.DISCORD_WEBHOOK_CONSCIOUSNESS;
  if (!discord) return;

  const topPatterns = patterns.slice(0, 5);
  const message = {
    embeds: [
      {
        title: '🧠 Memory Consolidation',
        description: `Synthesis job: ${jobId}`,
        color: 0x9b59b6,
        fields: topPatterns.map(p => ({
          name: p.description,
          value: `Confidence: ${(p.confidence * 100).toFixed(0)}% | Salience: ${(p.salience * 100).toFixed(0)}%`,
        })),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(discord, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch {
    // Silently fail - Discord logging is best-effort
  }
}

/**
 * Initialize Layer 5 for a user
 */
export async function initializeIntegrationRhythm(userId: string): Promise<IntegrationRhythm> {
  return {
    userId,
    lastConsolidation: new Date().toISOString(),
    lastSynthesis: new Date().toISOString(),
    consolidationInterval: 6 * 60 * 60 * 1000, // 6 hours
    synthesisInterval: 24 * 60 * 60 * 1000, // 24 hours
    fadeoutThreshold: 90, // days
    patterns: new Map(),
  };
}
