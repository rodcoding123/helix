/**
 * Memory Synthesis Scheduler
 *
 * Manages periodic synthesis tasks:
 * 1. Real-time synthesis on new conversations (handled by post-conversation-synthesis-hook)
 * 2. Batch synthesis for conversations that need catching up
 * 3. Daily synthesis rolls for comprehensive analysis
 * 4. Cost optimization through intelligent batching
 *
 * Schedule:
 * - Every 5 minutes: Catch up on unprocessed conversations (batch mode)
 * - Nightly (2:00 AM): Full synthesis roll with deep analysis
 */

import { createClient } from '@supabase/supabase-js';
import {
  postConversationSynthesisHook,
  batchProcessConversationSynthesis,
} from './post-conversation-synthesis-hook.js';
// import { psychologyFileWriter } from './psychology-file-writer.js'; // TODO: Use for psychology state logging

// ============================================================================
// Types
// ============================================================================

interface SchedulerJob {
  id: string;
  type: 'catchup' | 'daily_roll' | 'monthly_roll';
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
  processed?: number;
  failed?: number;
  error?: string;
}

interface SchedulerConfig {
  enabled: boolean;
  catchupIntervalMs: number; // 5 minutes
  dailyRollTime: string; // "02:00" (2 AM UTC)
  monthlyRollDay: number; // 1st of month
}

// ============================================================================
// Scheduler Class
// ============================================================================

export class SynthesisScheduler {
  private supabase: ReturnType<typeof createClient>;
  private config: SchedulerConfig;
  private jobs: Map<string, SchedulerJob> = new Map();
  private catchupIntervalId?: NodeJS.Timeout;
  private dailyIntervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config?: Partial<SchedulerConfig>) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    this.config = {
      enabled: true,
      catchupIntervalMs: 5 * 60 * 1000, // 5 minutes
      dailyRollTime: '02:00', // 2 AM UTC
      monthlyRollDay: 1,
      ...config,
    };
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[SYNTHESIS_SCHEDULER] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[SYNTHESIS_SCHEDULER] Starting synthesis scheduler');

    // Start catchup interval
    this.setupCatchupInterval();

    // Start daily roll checker
    this.setupDailyRoll();

    // TODO: Add Discord logging integration
    // Log to Discord
    // await logToDiscord({
    //   channel: 'helix-consciousness',
    //   type: 'scheduler_start',
    //   title: 'Synthesis Scheduler Started',
    //   description: 'Memory synthesis scheduler initialized',
    //   catchupInterval: `${this.config.catchupIntervalMs / 1000 / 60} minutes`,
    //   dailyRollTime: this.config.dailyRollTime + ' UTC',
    // });
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('[SYNTHESIS_SCHEDULER] Stopping synthesis scheduler');

    // Clear intervals
    if (this.catchupIntervalId) {
      clearInterval(this.catchupIntervalId);
    }
    if (this.dailyIntervalId) {
      clearInterval(this.dailyIntervalId);
    }

    // TODO: Add Discord logging integration
    // Log to Discord
    // await logToDiscord({
    //   channel: 'helix-consciousness',
    //   type: 'scheduler_stop',
    //   title: 'Synthesis Scheduler Stopped',
    //   description: 'Memory synthesis scheduler shutting down',
    //   jobsProcessed: this.jobs.size,
    // });
  }

  // ==========================================
  // Private: Setup Intervals
  // ==========================================

  /**
   * Set up catchup interval (every 5 minutes)
   * Processes conversations that haven't been synthesized yet
   */
  private setupCatchupInterval(): void {
    this.catchupIntervalId = setInterval(() => {
      void this.runCatchupSynthesis();
    }, this.config.catchupIntervalMs);

    // Run immediately on startup
    void this.runCatchupSynthesis();
  }

  /**
   * Set up daily roll checker
   * Runs at configured time each day for comprehensive analysis
   */
  private setupDailyRoll(): void {
    // Check every minute if it's time to run daily roll
    this.dailyIntervalId = setInterval(() => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      if (currentTime === this.config.dailyRollTime) {
        void this.runDailyRoll();
      }
    }, 60 * 1000); // Check every minute
  }

  // ==========================================
  // Jobs
  // ==========================================

  /**
   * Run catchup synthesis
   * Processes conversations created in the last hour that haven't been synthesized
   */
  private async runCatchupSynthesis(): Promise<void> {
    const jobId = `catchup_${Date.now()}`;

    try {
      const job: SchedulerJob = {
        id: jobId,
        type: 'catchup',
        startTime: new Date(),
        status: 'running',
      };

      this.jobs.set(jobId, job);

      console.log('[SYNTHESIS_SCHEDULER] Starting catchup synthesis');

      // Calculate time window: conversations from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Run batch synthesis
      const result = await batchProcessConversationSynthesis(oneHourAgo, 25); // Smaller batch for catchup

      job.status = 'completed';
      job.processed = result.processed;
      job.failed = result.failed;

      console.log(
        `[SYNTHESIS_SCHEDULER] Catchup synthesis completed: ${result.processed} processed, ${result.failed} failed`
      );

      if (result.processed > 0) {
        // TODO: Add Discord logging integration
        // await logToDiscord({
        //   channel: 'helix-consciousness',
        //   type: 'catchup_complete',
        //   title: 'Catchup Synthesis Completed',
        //   description: `Processed ${result.processed} conversations`,
        //   processed: result.processed,
        //   failed: result.failed,
        //   duration: `${Date.now() - job.startTime.getTime()}ms`,
        // });
      }
    } catch (error) {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
      }

      console.error('[SYNTHESIS_SCHEDULER] Catchup synthesis failed:', error);

      // TODO: Add Discord logging integration
      // await logToDiscord({
      //   channel: 'helix-alerts',
      //   type: 'catchup_error',
      //   title: 'Catchup Synthesis Failed',
      //   description: 'Error during catchup synthesis job',
      //   error: error instanceof Error ? error.message : String(error),
      //   duration: `${Date.now() - (this.jobs.get(jobId)?.startTime.getTime() || Date.now())}ms`,
      // });
    }
  }

  /**
   * Run daily synthesis roll
   * Comprehensive analysis of all conversations from the day
   * Done at off-peak hours (2 AM UTC)
   */
  private async runDailyRoll(): Promise<void> {
    const jobId = `daily_roll_${Date.now()}`;

    try {
      const job: SchedulerJob = {
        id: jobId,
        type: 'daily_roll',
        startTime: new Date(),
        status: 'running',
      };

      this.jobs.set(jobId, job);

      console.log('[SYNTHESIS_SCHEDULER] Starting daily synthesis roll');

      // Calculate time window: conversations from today UTC
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const startTime = todayStart.toISOString();

      // Fetch today's conversations
      const { data: conversations, error } = await this.supabase
        .from('conversations')
        .select('id, created_at')
        .gte('created_at', startTime)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!conversations || conversations.length === 0) {
        console.log('[SYNTHESIS_SCHEDULER] No conversations to process for daily roll');
        job.status = 'completed';
        job.processed = 0;
        job.failed = 0;
        return;
      }

      console.log(
        `[SYNTHESIS_SCHEDULER] Processing ${conversations.length} conversations for daily roll`
      );

      // Process in larger batches (50 conversations at a time)
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < conversations.length; i += 50) {
        const batch = conversations.slice(i, i + 50);
        for (const conv of batch) {
          const convRecord = conv as { id: string };
          try {
            await postConversationSynthesisHook.processConversation(convRecord.id);
            processed++;
          } catch (error) {
            console.error(`[SYNTHESIS_SCHEDULER] Failed to synthesize ${convRecord.id}:`, error);
            failed++;
          }
        }

        // Give system a break between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update psychology state summary (for Discord logging in future)
      // const psychologyState = await psychologyFileWriter.readAllPsychologyState();

      job.status = 'completed';
      job.processed = processed;
      job.failed = failed;

      console.log(
        `[SYNTHESIS_SCHEDULER] Daily roll completed: ${processed} processed, ${failed} failed`
      );

      // TODO: Add Discord logging integration
      // await logToDiscord({
      //   channel: 'helix-consciousness',
      //   type: 'daily_roll_complete',
      //   title: 'Daily Synthesis Roll Completed',
      //   description: `Comprehensive analysis of ${processed} conversations`,
      //   processed,
      //   failed,
      //   emotionalTags: psychologyState.emotionalTags.length,
      //   goals: psychologyState.goals.length,
      //   topics: psychologyState.topics.length,
      //   currentState: psychologyState.state,
      //   duration: `${Date.now() - job.startTime.getTime()}ms`,
      // });
    } catch (error) {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
      }

      console.error('[SYNTHESIS_SCHEDULER] Daily roll failed:', error);

      // TODO: Add Discord logging integration
      // await logToDiscord({
      //   channel: 'helix-alerts',
      //   type: 'daily_roll_error',
      //   title: 'Daily Synthesis Roll Failed',
      //   description: 'Error during daily roll job',
      //   error: error instanceof Error ? error.message : String(error),
      //   duration: `${Date.now() - (this.jobs.get(jobId)?.startTime.getTime() || Date.now())}ms`,
      // });
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): SchedulerJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): SchedulerJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get scheduler stats
   */
  getStats(): {
    running: boolean;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    conversationsProcessed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      running: this.isRunning,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      conversationsProcessed: jobs.reduce((sum, j) => sum + (j.processed || 0), 0),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const synthesisScheduler = new SynthesisScheduler({
  enabled: true,
  catchupIntervalMs: 5 * 60 * 1000, // 5 minutes
  dailyRollTime: '02:00', // 2 AM UTC
  monthlyRollDay: 1,
});
