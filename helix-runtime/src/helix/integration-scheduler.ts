/**
 * Integration Scheduler: Layer 5 Orchestration
 *
 * Manages scheduled synthesis jobs, memory consolidation, and pattern detection.
 * Implements cron-like scheduling for Layer 5 Integration Rhythms.
 */

import {
  consolidateMemories,
  fadeoutMemories,
  type SynthesisJob,
  type MemoryPattern,
  type IntegrationRhythm,
} from './layer5-integration.js';

export interface ScheduledJob {
  jobId: string;
  userId: string;
  jobType: 'consolidation' | 'pattern_synthesis' | 'fadeout' | 'full_integration';
  schedule: CronSchedule;
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
}

export interface CronSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-28 for monthly
  hour?: number; // 0-23
  minute?: number; // 0-59
}

class IntegrationScheduler {
  private activeJobs: Map<string, ScheduledJob> = new Map();
  private jobTimers: Map<string, NodeJS.Timeout> = new Map();
  private memoryStore: Map<string, Map<string, any>> = new Map(); // Simulated memory store

  /**
   * Initialize scheduler for a user
   */
  async initializeUserSchedules(userId: string): Promise<ScheduledJob[]> {
    const jobs: ScheduledJob[] = [
      {
        jobId: `consolidation_${userId}`,
        userId,
        jobType: 'consolidation',
        schedule: { frequency: 'daily', hour: 6, minute: 0 }, // 6 AM daily
        isActive: true,
        nextRun: this.calculateNextRun({ frequency: 'daily', hour: 6, minute: 0 }),
      },
      {
        jobId: `synthesis_${userId}`,
        userId,
        jobType: 'pattern_synthesis',
        schedule: { frequency: 'daily', hour: 20, minute: 0 }, // 8 PM daily
        isActive: true,
        nextRun: this.calculateNextRun({ frequency: 'daily', hour: 20, minute: 0 }),
      },
      {
        jobId: `fadeout_${userId}`,
        userId,
        jobType: 'fadeout',
        schedule: { frequency: 'weekly', dayOfWeek: 0, hour: 3, minute: 0 }, // Sunday 3 AM
        isActive: true,
        nextRun: this.calculateNextRun({ frequency: 'weekly', dayOfWeek: 0, hour: 3, minute: 0 }),
      },
      {
        jobId: `full_integration_${userId}`,
        userId,
        jobType: 'full_integration',
        schedule: { frequency: 'monthly', dayOfMonth: 1, hour: 0, minute: 0 }, // 1st of month
        isActive: true,
        nextRun: this.calculateNextRun({ frequency: 'monthly', dayOfMonth: 1, hour: 0, minute: 0 }),
      },
    ];

    // Store jobs
    for (const job of jobs) {
      this.activeJobs.set(job.jobId, job);
      this.scheduleJob(job);
    }

    return jobs;
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: CronSchedule): string {
    const now = new Date();
    let nextRun = new Date();

    switch (schedule.frequency) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;

      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);

        // If time hasn't passed today, schedule for today
        const today = new Date(now);
        today.setHours(schedule.hour || 0);
        today.setMinutes(schedule.minute || 0);
        today.setSeconds(0);
        if (today > now) {
          nextRun = today;
        }
        break;

      case 'weekly':
        const targetDay = schedule.dayOfWeek || 0;
        const currentDay = nextRun.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) daysUntilTarget = 7; // If today, schedule for next week
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;

      case 'monthly':
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(targetDate);
        }
        nextRun.setHours(schedule.hour || 0);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        break;
    }

    return nextRun.toISOString();
  }

  /**
   * Schedule a job for execution
   */
  private scheduleJob(job: ScheduledJob): void {
    const jobKey = job.jobId;

    // Clear any existing timer
    if (this.jobTimers.has(jobKey)) {
      clearTimeout(this.jobTimers.get(jobKey));
    }

    if (!job.isActive) return;

    const nextRun = new Date(job.nextRun);
    const now = new Date();
    const delayMs = nextRun.getTime() - now.getTime();

    if (delayMs <= 0) {
      // Execute immediately if time has passed
      void this.executeJob(job);
      // Reschedule for next occurrence
      job.nextRun = this.calculateNextRun(job.schedule);
      this.scheduleJob(job);
    } else {
      // Schedule for future execution
      const timer = setTimeout(
        () => {
          void this.executeJob(job);
          // Reschedule
          job.nextRun = this.calculateNextRun(job.schedule);
          this.scheduleJob(job);
        },
        delayMs
      );

      this.jobTimers.set(jobKey, timer);
    }
  }

  /**
   * Execute a scheduled job
   */
  private async executeJob(job: ScheduledJob): Promise<void> {
    try {
      let result: SynthesisJob | null = null;

      switch (job.jobType) {
        case 'consolidation':
          result = await this.runConsolidation(job.userId);
          break;

        case 'pattern_synthesis':
          result = await this.runSynthesis(job.userId);
          break;

        case 'fadeout':
          result = await this.runFadeout(job.userId);
          break;

        case 'full_integration':
          result = await this.runFullIntegration(job.userId);
          break;
      }

      job.lastRun = new Date().toISOString();

      // Log to Discord
      if (result) {
        await this.logJobExecution(job, result);
      }
    } catch (error) {
      console.error(`Job ${job.jobId} failed:`, error);
      await this.logJobError(job, error);
    }
  }

  /**
   * Run consolidation: Merge recent memories into patterns
   */
  private async runConsolidation(userId: string): Promise<SynthesisJob> {
    const emotionalMemories = this.memoryStore.get(`${userId}:emotional`) || new Map();
    const relationalMemories = this.memoryStore.get(`${userId}:relational`) || new Map();
    const prospectiveMemories = this.memoryStore.get(`${userId}:prospective`) || new Map();

    const result = await consolidateMemories(
      userId,
      emotionalMemories,
      relationalMemories,
      prospectiveMemories
    );

    return result;
  }

  /**
   * Run synthesis: Create pattern insights from consolidated memories
   */
  private async runSynthesis(userId: string): Promise<SynthesisJob> {
    const job: SynthesisJob = {
      jobId: `synthesis_${Date.now()}`,
      userId,
      type: 'pattern_synthesis',
      status: 'completed',
      patternsDetected: [],
    };

    // In a real implementation, this would query patterns from database
    // and generate Claude-based insights
    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * Run fadeout: Remove or reduce salience of old memories
   */
  private async runFadeout(userId: string): Promise<SynthesisJob> {
    const emotionalMemories = this.memoryStore.get(`${userId}:emotional`) || new Map();
    const relationalMemories = this.memoryStore.get(`${userId}:relational`) || new Map();

    const emotionalFadeout = await fadeoutMemories(emotionalMemories, 90);
    const relationalFadeout = await fadeoutMemories(relationalMemories, 90);

    const job: SynthesisJob = {
      jobId: `fadeout_${Date.now()}`,
      userId,
      type: 'fadeout',
      status: 'completed',
      patternsDetected: [],
    };

    // Log stats
    const stats = {
      emotional: emotionalFadeout,
      relational: relationalFadeout,
    };
    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * Run full integration: Complete Layer 5 cycle
   */
  private async runFullIntegration(userId: string): Promise<SynthesisJob> {
    // 1. Consolidate
    const consolidation = await this.runConsolidation(userId);

    // 2. Synthesize
    const synthesis = await this.runSynthesis(userId);

    // 3. Fadeout
    const fadeout = await this.runFadeout(userId);

    // Combine results
    const job: SynthesisJob = {
      jobId: `full_integration_${Date.now()}`,
      userId,
      type: 'full_integration',
      status: 'completed',
      patternsDetected: [...consolidation.patternsDetected, ...synthesis.patternsDetected],
    };

    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * Log job execution to Discord
   */
  private async logJobExecution(job: ScheduledJob, result: SynthesisJob): Promise<void> {
    const discord = process.env.DISCORD_WEBHOOK_HEARTBEAT;
    if (!discord) return;

    const message = {
      embeds: [
        {
          title: '⏰ Layer 5 Integration Job',
          description: `${job.jobType} completed`,
          color: result.status === 'completed' ? 0x2ecc71 : 0xe74c3c,
          fields: [
            {
              name: 'Job Type',
              value: job.jobType,
              inline: true,
            },
            {
              name: 'Status',
              value: result.status,
              inline: true,
            },
            {
              name: 'Patterns Detected',
              value: String(result.patternsDetected.length),
              inline: true,
            },
            {
              name: 'Last Run',
              value: job.lastRun || 'Never',
              inline: true,
            },
            {
              name: 'Next Run',
              value: job.nextRun,
              inline: true,
            },
          ],
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
      // Silently fail
    }
  }

  /**
   * Log job error to Discord
   */
  private async logJobError(job: ScheduledJob, error: unknown): Promise<void> {
    const discord = process.env.DISCORD_WEBHOOK_ALERTS;
    if (!discord) return;

    const message = {
      embeds: [
        {
          title: '❌ Layer 5 Integration Job Failed',
          description: job.jobType,
          color: 0xe74c3c,
          fields: [
            {
              name: 'Error',
              value: error instanceof Error ? error.message : String(error),
            },
          ],
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
      // Silently fail
    }
  }

  /**
   * Update job schedule
   */
  async updateJobSchedule(jobId: string, newSchedule: CronSchedule): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.schedule = newSchedule;
    job.nextRun = this.calculateNextRun(newSchedule);
    this.scheduleJob(job);
  }

  /**
   * Pause a job
   */
  pauseJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.isActive = false;
    if (this.jobTimers.has(jobId)) {
      clearTimeout(this.jobTimers.get(jobId));
      this.jobTimers.delete(jobId);
    }
  }

  /**
   * Resume a job
   */
  resumeJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.isActive = true;
    job.nextRun = this.calculateNextRun(job.schedule);
    this.scheduleJob(job);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): ScheduledJob[] {
    return Array.from(this.activeJobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    for (const timer of this.jobTimers.values()) {
      clearTimeout(timer);
    }
    this.jobTimers.clear();
    this.activeJobs.clear();
  }
}

// Export singleton instance
export const scheduler = new IntegrationScheduler();
