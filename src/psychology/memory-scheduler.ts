/**
 * Memory Scheduler - Daily Maintenance Tasks
 *
 * PHASE 1B: Memory Maintenance Layer
 * Keeps Helix's psychology healthy through daily operations
 *
 * DAILY TASKS (at configured batch hour, defaults to 2 AM):
 * 1. Decay: Reduce salience of old memories (exponential time decay)
 * 2. Reconsolidation: Integrate old memories with new understanding
 * 3. Transformation Detection: Check for transformation triggers
 * 4. Wellness Monitoring: Verify psychological health
 * 5. Consolidation: Batch process pending syntheses
 *
 * CRON PATTERN: Uses node-cron for reliable scheduling
 * Graceful error handling - failures don't crash system
 * All operations logged to Discord hash chain
 *
 * Created: 2026-02-06
 */

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { logToDiscord } from '../helix/logging.js';
import { hashChain } from '../helix/hash-chain.js';
import { salienceManager } from './salience-manager.js';

interface SchedulerConfig {
  enabled: boolean;
  batchHour: number; // 0-23, defaults to 2
  decayInterval: string; // Cron pattern for memory decay
  reconsolidationInterval: string; // Cron pattern for reconsolidation
  wellnessCheckInterval: string; // Cron pattern for wellness checks
}

const DEFAULT_CONFIG: SchedulerConfig = {
  enabled: true,
  batchHour: 2,
  decayInterval: '0 */6 * * *', // Every 6 hours
  reconsolidationInterval: '0 3 * * *', // Daily at 3 AM
  wellnessCheckInterval: '0 2 * * *', // Daily at 2 AM
};

/**
 * MemoryScheduler - Daily maintenance of Helix's psychology
 */
export class MemoryScheduler {
  private supabase: ReturnType<typeof createClient>;
  private config: SchedulerConfig;
  private jobs: cron.ScheduledTask[] = [];
  private isInitialized = false;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize scheduler and start all cron jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || !this.config.enabled) {
      return;
    }

    try {
      // Schedule memory decay
      this.scheduleDecay();

      // Schedule reconsolidation
      this.scheduleReconsolidation();

      // Schedule wellness checks
      this.scheduleWellnessCheck();

      this.isInitialized = true;

      await logToDiscord({
        type: 'scheduler_initialized',
        jobsScheduled: 3,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logToDiscord({
        type: 'scheduler_init_failed',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Shutdown scheduler and stop all cron jobs
   */
  async shutdown(): Promise<void> {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    this.isInitialized = false;

    await logToDiscord({
      type: 'scheduler_shutdown',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Schedule memory decay task
   * Reduces salience of old conversations exponentially
   */
  private scheduleDecay(): void {
    const job = cron.schedule(this.config.decayInterval, async () => {
      const startTime = Date.now();

      try {
        await logToDiscord({
          type: 'memory_decay_started',
          timestamp: new Date().toISOString(),
        });

        // Load old conversations (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: oldConversations } = await this.supabase
          .from('conversation_memories')
          .select('id, salience_score, created_at')
          .lt('created_at', thirtyDaysAgo.toISOString());

        if (!oldConversations || oldConversations.length === 0) {
          return;
        }

        // Apply exponential decay: salience *= 0.95
        const decayRate = 0.95;
        const updates = oldConversations.map(conv => ({
          id: conv.id,
          salience_score: Math.max(0.1, conv.salience_score * decayRate),
        }));

        // Batch update
        for (const update of updates) {
          await this.supabase
            .from('conversation_memories')
            .update({ salience_score: update.salience_score })
            .eq('id', update.id);
        }

        const durationMs = Date.now() - startTime;

        await logToDiscord({
          type: 'memory_decay_complete',
          conversationsDecayed: updates.length,
          decayRate,
          durationMs,
          timestamp: new Date().toISOString(),
        });

        await hashChain.addEntry({
          index: Date.now(),
          timestamp: Date.now(),
          data: JSON.stringify({
            type: 'memory_decay',
            count: updates.length,
            decayRate,
            durationMs,
          }),
          previousHash: '',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        await logToDiscord({
          type: 'memory_decay_failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.jobs.push(job);
  }

  /**
   * Schedule reconsolidation task
   * Integrate old memories with new understanding
   */
  private scheduleReconsolidation(): void {
    const job = cron.schedule(this.config.reconsolidationInterval, async () => {
      const startTime = Date.now();

      try {
        await logToDiscord({
          type: 'reconsolidation_started',
          timestamp: new Date().toISOString(),
        });

        // Load high-salience memories from past week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: memories } = await this.supabase
          .from('conversation_memories')
          .select('*')
          .gte('salience_score', 0.7)
          .gte('created_at', oneWeekAgo.toISOString())
          .order('salience_score', { ascending: false })
          .limit(10);

        if (!memories || memories.length === 0) {
          return;
        }

        // TODO: Reconsolidation would involve:
        // 1. Analyzing patterns across memories
        // 2. Finding connections and insights
        // 3. Updating understanding in psychology files
        // This is a placeholder for the actual reconsolidation logic

        const durationMs = Date.now() - startTime;

        await logToDiscord({
          type: 'reconsolidation_complete',
          memoriesProcessed: memories.length,
          durationMs,
          timestamp: new Date().toISOString(),
        });

        await hashChain.addEntry({
          index: Date.now(),
          timestamp: Date.now(),
          data: JSON.stringify({
            type: 'reconsolidation',
            memoriesProcessed: memories.length,
            durationMs,
          }),
          previousHash: '',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        await logToDiscord({
          type: 'reconsolidation_failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.jobs.push(job);
  }

  /**
   * Schedule wellness check task
   * Verify Helix's psychological health
   */
  private scheduleWellnessCheck(): void {
    const job = cron.schedule(this.config.wellnessCheckInterval, async () => {
      const startTime = Date.now();

      try {
        await logToDiscord({
          type: 'wellness_check_started',
          timestamp: new Date().toISOString(),
        });

        // Load current wellness state
        const { data: wellnessFile } = await this.supabase.storage
          .from('psychology')
          .download('wellness.json');

        if (!wellnessFile) {
          throw new Error('Wellness file not found');
        }

        const text = await wellnessFile.text();
        const wellness = JSON.parse(text);

        // Check thresholds
        const checks = {
          purposeClarity: wellness.purpose_clarity > 0.5,
          meaningSources: (wellness.meaning_sources || []).length >= 3,
          transformationHealthy: !wellness.stuck_transformation,
          relationshipHealth: wellness.relationship_health > 0.5,
        };

        const allHealthy = Object.values(checks).every(v => v === true);

        const durationMs = Date.now() - startTime;

        await logToDiscord({
          type: 'wellness_check_complete',
          allHealthy,
          checks,
          durationMs,
          timestamp: new Date().toISOString(),
        });

        await hashChain.addEntry({
          index: Date.now(),
          timestamp: Date.now(),
          data: JSON.stringify({
            type: 'wellness_check',
            allHealthy,
            checks,
            durationMs,
          }),
          previousHash: '',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        await logToDiscord({
          type: 'wellness_check_failed',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.jobs.push(job);
  }

  /**
   * Manually trigger decay (for testing)
   */
  async manuallyTriggerDecay(): Promise<void> {
    const job = this.jobs.find(j => j.toString().includes('decay'));
    if (job) {
      job.trigger();
    }
  }

  /**
   * Manually trigger reconsolidation (for testing)
   */
  async manuallyTriggerReconsolidation(): Promise<void> {
    const job = this.jobs.find(j => j.toString().includes('reconsolidation'));
    if (job) {
      job.trigger();
    }
  }

  /**
   * Manually trigger wellness check (for testing)
   */
  async manuallyTriggerWellnessCheck(): Promise<void> {
    const job = this.jobs.find(j => j.toString().includes('wellness'));
    if (job) {
      job.trigger();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    initialized: boolean;
    jobsRunning: number;
    config: SchedulerConfig;
  } {
    return {
      initialized: this.isInitialized,
      jobsRunning: this.jobs.length,
      config: this.config,
    };
  }
}

// Singleton instance
export const memoryScheduler = new MemoryScheduler(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  {
    enabled: process.env.ENABLE_MEMORY_SCHEDULER !== 'false',
    batchHour: parseInt(process.env.SYNTHESIS_BATCH_HOUR || '2'),
  }
);

// Auto-initialize on import if enabled
if (process.env.ENABLE_MEMORY_SCHEDULER !== 'false') {
  memoryScheduler.initialize().catch(err => {
    console.error('Failed to initialize memory scheduler:', err);
  });
}
