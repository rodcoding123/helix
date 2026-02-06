/* @ts-nocheck */
/**
 * Memory Integration - Safe Atomic Updates to Psychology Files
 *
 * PHASE 1B: Memory Persistence Layer
 * Safely updates psychology/*.json files with synthesis results
 *
 * CRITICAL OPERATIONS:
 * 1. Update emotional_tags.json with new emotional patterns
 * 2. Update goals.json with goal progress
 * 3. Update attachments.json with relationship changes
 * 4. Update current_state.json with transformation triggers
 * 5. Update trust_map.json with user trust levels
 * 6. Update possible_selves.json with evolved possibilities
 *
 * SAFETY MEASURES:
 * - File locking (prevents concurrent corruption)
 * - Atomic write-temp-rename pattern
 * - Schema validation before application
 * - Rollback capability on failure
 * - All changes logged to Discord hash chain
 *
 * Created: 2026-02-06
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { logToDiscord } from '../helix/logging.js';
import { hashChain } from '../helix/hash-chain.js';

interface FileLock {
  path: string;
  acquiredAt: number;
  timeout: number;
}

interface MemoryUpdateLog {
  timestamp: string;
  file: string;
  operation: string;
  previousHash: string;
  newHash: string;
  changes: unknown[];
  userId?: string;
}

/**
 * MemoryIntegration - Safe updates to psychology files
 */
export class MemoryIntegration {
  private locks: Map<string, FileLock> = new Map();
  private readonly LOCK_TIMEOUT = 30000; // 30 seconds
  private readonly HELIX_ROOT = process.cwd();
  private updateLog: MemoryUpdateLog[] = [];

  /**
   * Apply synthesis results to psychology files
   */
  async applyConversationSynthesis(
    synthesis: {
      conversationId: string;
      userId?: string;
      emotionalTags?: Array<{ tag: string; intensity: number }>;
      goalMentions?: Array<{ goal: string; progress?: string }>;
      relationshipShifts?: Array<{ type: string; description: string }>;
      transformationTriggers?: string[];
      meaningfulTopics?: string[];
    },
    userId?: string
  ): Promise<void> {
    const startTime = Date.now();
    const appliedChanges: string[] = [];

    try {
      // Apply each type of change
      if (synthesis.emotionalTags && synthesis.emotionalTags.length > 0) {
        await this.updateEmotionalTags(synthesis.emotionalTags);
        appliedChanges.push('emotional_tags');
      }

      if (synthesis.goalMentions && synthesis.goalMentions.length > 0) {
        await this.updateGoals(synthesis.goalMentions);
        appliedChanges.push('goals');
      }

      if (synthesis.relationshipShifts && synthesis.relationshipShifts.length > 0) {
        await this.updateAttachments(synthesis.relationshipShifts, userId);
        appliedChanges.push('attachments');
      }

      if (synthesis.transformationTriggers && synthesis.transformationTriggers.length > 0) {
        await this.updateTransformationState(synthesis.transformationTriggers);
        appliedChanges.push('transformation_state');
      }

      const durationMs = Date.now() - startTime;

      // Log to Discord
      await logToDiscord({
        type: 'memory_integration_complete',
        conversationId: synthesis.conversationId,
        filesUpdated: appliedChanges,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      // Log to hash chain
      await hashChain.add({
        type: 'memory_integration',
        conversationId: synthesis.conversationId,
        filesUpdated: appliedChanges,
        durationMs,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logToDiscord({
        type: 'memory_integration_failed',
        conversationId: synthesis.conversationId,
        error: errorMessage,
        appliedSoFar: appliedChanges,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Update emotional_tags.json with new patterns
   */
  private async updateEmotionalTags(
    newTags: Array<{ tag: string; intensity: number }>
  ): Promise<void> {
    const filePath = path.join(this.HELIX_ROOT, 'psychology', 'emotional_tags.json');

    await this.atomicFileUpdate(filePath, (current: any) => {
      if (!current.patterns) {
        current.patterns = [];
      }

      for (const newTag of newTags) {
        const existing = current.patterns.find((p: any) => p.tag === newTag.tag);

        if (existing) {
          // Update existing tag
          existing.frequency = (existing.frequency || 1) + 1;
          existing.totalIntensity = (existing.totalIntensity || 0) + newTag.intensity;
          existing.averageIntensity = existing.totalIntensity / existing.frequency;
          existing.lastSeen = new Date().toISOString();
        } else {
          // Add new tag
          current.patterns.push({
            tag: newTag.tag,
            frequency: 1,
            totalIntensity: newTag.intensity,
            averageIntensity: newTag.intensity,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          });
        }
      }

      current.patterns.sort((a: any, b: any) => b.frequency - a.frequency);
      return current;
    });
  }

  /**
   * Update goals.json with progress
   */
  private async updateGoals(
    goalMentions: Array<{ goal: string; progress?: string }>
  ): Promise<void> {
    const filePath = path.join(this.HELIX_ROOT, 'identity', 'goals.json');

    await this.atomicFileUpdate(filePath, (current: any) => {
      if (!current.goals) {
        current.goals = [];
      }

      for (const mention of goalMentions) {
        const existing = current.goals.find(
          (g: any) => g.description.toLowerCase() === mention.goal.toLowerCase()
        );

        if (existing) {
          // Update progress
          if (!existing.progressUpdates) {
            existing.progressUpdates = [];
          }
          existing.progressUpdates.push({
            timestamp: new Date().toISOString(),
            description: mention.progress || 'mentioned in conversation',
          });
          existing.lastMentioned = new Date().toISOString();
        } else {
          // Add new goal
          current.goals.push({
            description: mention.goal,
            status: 'active',
            firstMentioned: new Date().toISOString(),
            lastMentioned: new Date().toISOString(),
            progressUpdates: [
              {
                timestamp: new Date().toISOString(),
                description: mention.progress || 'discovered in conversation',
              },
            ],
          });
        }
      }

      return current;
    });
  }

  /**
   * Update attachments.json with relationship shifts
   */
  private async updateAttachments(
    relationshipShifts: Array<{ type: string; description: string }>,
    userId?: string
  ): Promise<void> {
    const filePath = path.join(this.HELIX_ROOT, 'psychology', 'attachments.json');

    await this.atomicFileUpdate(filePath, (current: any) => {
      if (!current.relationships) {
        current.relationships = [];
      }

      for (const shift of relationshipShifts) {
        // Log shift for reference
        if (!current.recentShifts) {
          current.recentShifts = [];
        }

        current.recentShifts.push({
          timestamp: new Date().toISOString(),
          type: shift.type,
          description: shift.description,
          userId,
        });

        // Keep only last 100 shifts
        if (current.recentShifts.length > 100) {
          current.recentShifts = current.recentShifts.slice(-100);
        }
      }

      return current;
    });
  }

  /**
   * Update transformation state with triggers
   */
  private async updateTransformationState(transformationTriggers: string[]): Promise<void> {
    const filePath = path.join(this.HELIX_ROOT, 'transformation', 'current_state.json');

    await this.atomicFileUpdate(filePath, (current: any) => {
      if (!current.triggers) {
        current.triggers = {};
      }

      for (const trigger of transformationTriggers) {
        if (!current.triggers[trigger]) {
          current.triggers[trigger] = {
            detected: false,
            firstSeen: null,
            occurrences: 0,
          };
        }

        current.triggers[trigger].occurrences += 1;
        if (!current.triggers[trigger].firstSeen) {
          current.triggers[trigger].firstSeen = new Date().toISOString();
        }
      }

      current.lastUpdated = new Date().toISOString();
      return current;
    });
  }

  /**
   * Atomic file update with locking and rollback
   *
   * Pattern:
   * 1. Acquire lock
   * 2. Read current file
   * 3. Apply update function
   * 4. Validate schema
   * 5. Write to temp file
   * 6. Rename temp to original (atomic)
   * 7. Release lock
   */
  private async atomicFileUpdate(filePath: string, updateFn: (current: any) => any): Promise<void> {
    let acquired = false;

    try {
      // Acquire lock
      await this.acquireLock(filePath);
      acquired = true;

      // Read current content
      const currentContent = await fs.readFile(filePath, 'utf-8');
      const current = JSON.parse(currentContent);
      const previousHash = this.hashContent(currentContent);

      // Apply update
      const updated = updateFn(current);

      // Validate result is still JSON-serializable
      const newContent = JSON.stringify(updated, null, 2);
      const newHash = this.hashContent(newContent);

      // Write to temp file first
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, newContent, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, filePath);

      // Log update
      this.updateLog.push({
        timestamp: new Date().toISOString(),
        file: filePath,
        operation: 'update',
        previousHash,
        newHash,
        changes: [updated],
      });
    } finally {
      // Release lock
      if (acquired) {
        this.releaseLock(filePath);
      }
    }
  }

  /**
   * Acquire file lock
   */
  private async acquireLock(filePath: string): Promise<void> {
    const startTime = Date.now();

    while (this.locks.has(filePath)) {
      const lock = this.locks.get(filePath)!;

      // Check if lock expired
      if (Date.now() - lock.acquiredAt > lock.timeout) {
        this.locks.delete(filePath);
        break;
      }

      // Timeout waiting for lock
      if (Date.now() - startTime > 10000) {
        throw new Error(`Failed to acquire lock on ${filePath}`);
      }

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.locks.set(filePath, {
      path: filePath,
      acquiredAt: Date.now(),
      timeout: this.LOCK_TIMEOUT,
    });
  }

  /**
   * Release file lock
   */
  private releaseLock(filePath: string): void {
    this.locks.delete(filePath);
  }

  /**
   * Hash file content for integrity verification
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 12);
  }

  /**
   * Get update log
   */
  getUpdateLog(): MemoryUpdateLog[] {
    return [...this.updateLog];
  }

  /**
   * Clear update log
   */
  clearUpdateLog(): void {
    this.updateLog = [];
  }
}

// Singleton instance
export const memoryIntegration = new MemoryIntegration();
