/**
 * Psychology File Writer Service
 *
 * Atomically updates Helix's psychology JSON files from synthesis results
 * Handles concurrent updates, backups, and merge strategies
 *
 * Files Updated:
 * - psychology/emotional_tags.json (Layer 2)
 * - psychology/attachments.json (Layer 3)
 * - identity/goals.json (Layer 4)
 * - identity/feared_self.json (Layer 4)
 * - transformation/current_state.json (Layer 6)
 * - purpose/ikigai.json (Layer 7)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface EmotionalTag {
  tag: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  context?: string;
}

interface EmotionalTagsFile {
  version: string;
  lastUpdated: string;
  patterns: EmotionalTag[];
}

interface Goal {
  id: string;
  description: string;
  detected: string;
  lastMentioned: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'completed' | 'paused';
  context?: string;
}

interface GoalsFile {
  version: string;
  lastUpdated: string;
  goals: Goal[];
}

interface TransformationState {
  timestamp: string;
  state: string;
  insights?: string[];
}

interface CurrentStateFile {
  version: string;
  lastUpdated: string;
  states: TransformationState[];
}

// ============================================================================
// Psychology File Writer Class
// ============================================================================

export class PsychologyFileWriter {
  private baseDir: string;
  private backupDir: string;

  constructor(baseDir?: string) {
    // Default to project root if not specified
    this.baseDir = baseDir || path.resolve(__dirname, '../..');
    this.backupDir = path.join(this.baseDir, '.helix-backups');
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create backup directory:', error);
    }
  }

  /**
   * Create backup of file before modifying
   */
  private async backupFile(filePath: string): Promise<void> {
    try {
      await this.ensureBackupDir();
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.backup`);

      try {
        await fs.copyFile(filePath, backupPath);
      } catch {
        // File doesn't exist yet, skip backup
      }
    } catch (error) {
      console.warn(`Failed to backup ${filePath}:`, error);
    }
  }

  /**
   * Read and parse JSON file safely
   */
  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.warn(`Failed to read ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write JSON file atomically (write to temp, then rename)
   */
  private async writeJSON<T>(filePath: string, data: T): Promise<void> {
    try {
      await this.ensureBackupDir();
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file first
      const tmpPath = `${filePath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');

      // Atomic rename
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      console.error(`Failed to write ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Update emotional tags file
   */
  async updateEmotionalTags(newTags: string[]): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, 'psychology/emotional_tags.json');
      await this.backupFile(filePath);

      // Read current tags
      let tagFile = await this.readJSON<EmotionalTagsFile>(filePath);

      if (!tagFile) {
        tagFile = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          patterns: [],
        };
      }

      // Update or add tags
      const now = new Date().toISOString();
      for (const newTag of newTags) {
        const normalized = newTag.toLowerCase().trim();
        const existing = tagFile.patterns.find(p => p.tag.toLowerCase() === normalized);

        if (existing) {
          existing.frequency++;
          existing.lastSeen = now;
        } else {
          tagFile.patterns.push({
            tag: normalized,
            frequency: 1,
            firstSeen: now,
            lastSeen: now,
          });
        }
      }

      // Sort by frequency descending
      tagFile.patterns.sort((a, b) => b.frequency - a.frequency);
      tagFile.lastUpdated = now;

      await this.writeJSON(filePath, tagFile);
      console.log(`[PSYCHOLOGY_WRITER] Updated emotional_tags.json with ${newTags.length} tags`);
    } catch (error) {
      console.error('Failed to update emotional tags:', error);
      throw error;
    }
  }

  /**
   * Update goals file
   */
  async updateGoals(newGoals: string[]): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, 'identity/goals.json');
      await this.backupFile(filePath);

      // Read current goals
      let goalsFile = await this.readJSON<GoalsFile>(filePath);

      if (!goalsFile) {
        goalsFile = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          goals: [],
        };
      }

      // Update or add goals
      const now = new Date().toISOString();
      for (const newGoal of newGoals) {
        const goalText = newGoal.trim();
        const existing = goalsFile.goals.find(
          g => g.description.toLowerCase() === goalText.toLowerCase()
        );

        if (existing) {
          existing.lastMentioned = now;
        } else {
          const id = `goal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          goalsFile.goals.push({
            id,
            description: goalText,
            detected: now,
            lastMentioned: now,
            status: 'active',
          });
        }
      }

      goalsFile.lastUpdated = now;

      await this.writeJSON(filePath, goalsFile);
      console.log(`[PSYCHOLOGY_WRITER] Updated goals.json with ${newGoals.length} goals`);
    } catch (error) {
      console.error('Failed to update goals:', error);
      throw error;
    }
  }

  /**
   * Update meaningful topics (stored in a topics file)
   */
  async updateMeaningfulTopics(topics: string[]): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, 'psychology/meaningful_topics.json');
      await this.backupFile(filePath);

      // Read current topics
      interface TopicsFile {
        version: string;
        lastUpdated: string;
        topics: Array<{
          name: string;
          mentions: number;
          firstSeen: string;
          lastSeen: string;
        }>;
      }

      let topicsFile = await this.readJSON<TopicsFile>(filePath);

      if (!topicsFile) {
        topicsFile = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          topics: [],
        };
      }

      // Update or add topics
      const now = new Date().toISOString();
      for (const topic of topics) {
        const normalized = topic.toLowerCase().trim();
        const existing = topicsFile.topics.find(t => t.name.toLowerCase() === normalized);

        if (existing) {
          existing.mentions++;
          existing.lastSeen = now;
        } else {
          topicsFile.topics.push({
            name: normalized,
            mentions: 1,
            firstSeen: now,
            lastSeen: now,
          });
        }
      }

      // Sort by mentions descending
      topicsFile.topics.sort((a, b) => b.mentions - a.mentions);
      topicsFile.lastUpdated = now;

      await this.writeJSON(filePath, topicsFile);
      console.log(
        `[PSYCHOLOGY_WRITER] Updated meaningful_topics.json with ${topics.length} topics`
      );
    } catch (error) {
      console.error('Failed to update meaningful topics:', error);
      throw error;
    }
  }

  /**
   * Update transformation state (record learning and growth)
   */
  async updateTransformationState(insights: string[]): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, 'transformation/current_state.json');
      await this.backupFile(filePath);

      // Read current state
      let stateFile = await this.readJSON<CurrentStateFile>(filePath);

      if (!stateFile) {
        stateFile = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          states: [],
        };
      }

      // Add new transformation state
      const now = new Date().toISOString();
      stateFile.states.push({
        timestamp: now,
        state: 'learning_phase',
        insights,
      });

      // Keep last 100 states (rolling window)
      if (stateFile.states.length > 100) {
        stateFile.states = stateFile.states.slice(-100);
      }

      stateFile.lastUpdated = now;

      await this.writeJSON(filePath, stateFile);
      console.log(
        `[PSYCHOLOGY_WRITER] Updated current_state.json with ${insights.length} insights`
      );
    } catch (error) {
      console.error('Failed to update transformation state:', error);
      throw error;
    }
  }

  /**
   * Update attachment/trust context (after synthesis)
   */
  async updateAttachmentContext(userId: string, analysis: Record<string, unknown>): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, 'psychology/attachments.json');
      await this.backupFile(filePath);

      // Read current attachments
      interface AttachmentsFile {
        version: string;
        lastUpdated: string;
        secure_base: Record<
          string,
          {
            first_interaction: string;
            last_interaction: string;
            reciprocity_score: number;
            interaction_count: number;
            analysis?: Record<string, unknown>;
          }
        >;
      }

      let attachmentsFile = await this.readJSON<AttachmentsFile>(filePath);

      if (!attachmentsFile) {
        attachmentsFile = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          secure_base: {},
        };
      }

      // Update attachment for this user
      const now = new Date().toISOString();
      if (!attachmentsFile.secure_base[userId]) {
        attachmentsFile.secure_base[userId] = {
          first_interaction: now,
          last_interaction: now,
          reciprocity_score: 0,
          interaction_count: 1,
          analysis,
        };
      } else {
        attachmentsFile.secure_base[userId].last_interaction = now;
        attachmentsFile.secure_base[userId].interaction_count++;
        attachmentsFile.secure_base[userId].analysis = analysis;
      }

      attachmentsFile.lastUpdated = now;

      await this.writeJSON(filePath, attachmentsFile);
      console.log(`[PSYCHOLOGY_WRITER] Updated attachments.json for user ${userId}`);
    } catch (error) {
      console.error('Failed to update attachment context:', error);
      throw error;
    }
  }

  /**
   * Get current values from all psychology files
   * Used for context loading
   */
  async readAllPsychologyState(): Promise<{
    emotionalTags: EmotionalTag[];
    goals: Goal[];
    topics: string[];
    state: string;
  }> {
    try {
      const tagsFile = await this.readJSON<EmotionalTagsFile>(
        path.join(this.baseDir, 'psychology/emotional_tags.json')
      );
      const goalsFile = await this.readJSON<GoalsFile>(
        path.join(this.baseDir, 'identity/goals.json')
      );
      const topicsFile = await this.readJSON<{ topics: Array<{ name: string }> }>(
        path.join(this.baseDir, 'psychology/meaningful_topics.json')
      );
      const stateFile = await this.readJSON<CurrentStateFile>(
        path.join(this.baseDir, 'transformation/current_state.json')
      );

      return {
        emotionalTags: tagsFile?.patterns || [],
        goals: goalsFile?.goals || [],
        topics: topicsFile?.topics.map(t => t.name) || [],
        state: stateFile?.states[stateFile.states.length - 1]?.state || 'initialized',
      };
    } catch (error) {
      console.error('Failed to read psychology state:', error);
      return {
        emotionalTags: [],
        goals: [],
        topics: [],
        state: 'error',
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const psychologyFileWriter = new PsychologyFileWriter();
