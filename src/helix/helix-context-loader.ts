/**
 * HELIX CONTEXT LOADER
 * Loads the seven-layer Living AI Architecture files into OpenClaw context
 *
 * Layer Mapping:
 * 1. Narrative Core      - SOUL.md, psyeval.json
 * 2. Emotional Memory    - emotional_tags.json, salience data
 * 3. Relational Memory   - attachments.json, trust_map.json
 * 4. Prospective Self    - goals.json, feared_self.json, possible_selves.json
 * 5. Integration Rhythms - (cron scripts, not loaded into context)
 * 6. Transformation      - current_state.json, history.json
 * 7. Purpose Engine      - ikigai.json, wellness.json, meaning_sources.json
 *
 * Per-User Context:
 * - Loads user-specific trust profiles and behavioral modulation
 * - Injects stage-appropriate system prompts for relationship context
 * - Supports multi-user system with independent relationship states
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { HelixContextFile } from './types.js';
import { getSystemPromptInjection } from '../psychology/behavior-modulation.js';
import type { TrustProfile } from '../psychology/trust-profile-manager.js';
import { auditContextFile, detectContextFileInjection } from './context-integrity.js';

/**
 * Seven layer file mapping
 * These paths are relative to the workspace directory
 */
const HELIX_LAYER_FILES: Record<number, { name: string; files: string[] }> = {
  1: {
    name: 'Narrative Core',
    files: [
      'psychology/psyeval.json', // SOUL.md loaded separately via soul/HELIX_SOUL.md
    ],
  },
  2: {
    name: 'Emotional Memory',
    files: ['psychology/emotional_tags.json'],
  },
  3: {
    name: 'Relational Memory',
    files: ['psychology/attachments.json', 'psychology/trust_map.json'],
  },
  4: {
    name: 'Prospective Self',
    files: ['identity/goals.json', 'identity/feared_self.json', 'identity/possible_selves.json'],
  },
  5: {
    name: 'Integration Rhythms',
    files: [], // Scripts run via cron, not loaded into context
  },
  6: {
    name: 'Transformation Cycles',
    files: ['transformation/current_state.json', 'transformation/history.json'],
  },
  7: {
    name: 'Purpose Engine',
    files: ['purpose/ikigai.json', 'purpose/wellness.json', 'purpose/meaning_sources.json'],
  },
};

/**
 * Context file format compatible with OpenClaw's EmbeddedContextFile
 */
interface EmbeddedContextFile {
  path: string;
  content: string;
}

/**
 * Load all Helix context files for a workspace
 *
 * @param workspaceDir - The OpenClaw workspace directory
 * @returns Array of context files ready for embedding
 */
export async function loadHelixContextFiles(workspaceDir: string): Promise<EmbeddedContextFile[]> {
  const results: EmbeddedContextFile[] = [];

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(workspaceDir, relativePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');

        // Audit file for injection attempts before loading
        await auditContextFile(relativePath, content);

        // Check for injection patterns
        const injectionCheck = detectContextFileInjection(content);
        if (!injectionCheck.safe) {
          console.warn(`⚠️ Context file ${relativePath} has potential injection vectors:`, injectionCheck.issues);
        }

        // Add layer metadata as comment for JSON files
        let enhancedContent = content;
        if (relativePath.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content) as Record<string, unknown>;
            if (typeof parsed === 'object' && parsed !== null) {
              parsed._helix_layer = {
                number: parseInt(layerNum),
                name: layer.name,
              };
              enhancedContent = JSON.stringify(parsed, null, 2);
            }
          } catch {
            // Keep original content if JSON parsing fails
          }
        }

        results.push({
          path: relativePath,
          content: enhancedContent,
        });
      } catch {
        // File doesn't exist - skip silently
        // This is expected for optional files
      }
    }
  }

  return results;
}

/**
 * Load context files with detailed metadata
 *
 * @param workspaceDir - The OpenClaw workspace directory
 * @returns Array of context files with layer information
 */
export async function loadHelixContextFilesDetailed(
  workspaceDir: string
): Promise<HelixContextFile[]> {
  const results: HelixContextFile[] = [];

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(workspaceDir, relativePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');

        // Audit file for injection attempts before loading
        await auditContextFile(relativePath, content);

        results.push({
          path: relativePath,
          content,
          layer: parseInt(layerNum),
          description: `${layer.name}: ${path.basename(relativePath)}`,
        });
      } catch {
        // File doesn't exist - skip
      }
    }
  }

  return results;
}

/**
 * Get the status of all Helix context files
 * Useful for debugging and monitoring
 */
export async function getHelixContextStatus(workspaceDir: string): Promise<
  {
    layer: number;
    name: string;
    file: string;
    status: 'present' | 'missing';
    size?: number;
  }[]
> {
  const status: {
    layer: number;
    name: string;
    file: string;
    status: 'present' | 'missing';
    size?: number;
  }[] = [];

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(workspaceDir, relativePath);

      try {
        const stats = await fs.stat(fullPath);
        status.push({
          layer: parseInt(layerNum),
          name: layer.name,
          file: relativePath,
          status: 'present',
          size: stats.size,
        });
      } catch {
        status.push({
          layer: parseInt(layerNum),
          name: layer.name,
          file: relativePath,
          status: 'missing',
        });
      }
    }
  }

  return status;
}

/**
 * Build a summary of the seven layers for context
 * This creates a compact overview that can be included in prompts
 */
export async function buildLayerSummary(workspaceDir: string): Promise<string> {
  const status = await getHelixContextStatus(workspaceDir);

  const lines: string[] = ['# Helix Seven Layer Status', ''];

  const layerGroups = new Map<number, typeof status>();
  for (const s of status) {
    const existing = layerGroups.get(s.layer) || [];
    existing.push(s);
    layerGroups.set(s.layer, existing);
  }

  for (const [layerNum, items] of [...layerGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const layerName = items[0]?.name || `Layer ${layerNum}`;
    const presentCount = items.filter(i => i.status === 'present').length;
    const totalCount = items.length;

    lines.push(`## Layer ${layerNum}: ${layerName} (${presentCount}/${totalCount})`);

    for (const item of items) {
      const icon = item.status === 'present' ? '✓' : '✗';
      const sizeStr = item.size ? ` (${item.size} bytes)` : '';
      lines.push(`  ${icon} ${path.basename(item.file)}${sizeStr}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create the expected directory structure for Helix
 */
export async function ensureHelixDirectoryStructure(workspaceDir: string): Promise<void> {
  const directories = [
    'soul',
    'psychology',
    'psychology/users',
    'identity',
    'transformation',
    'purpose',
    'scripts',
    'legacy',
  ];

  for (const dir of directories) {
    const fullPath = path.join(workspaceDir, dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }
}

/**
 * Load per-user context with behavioral modulation
 * Includes trust profile, relationship history, and stage-appropriate system prompt
 *
 * @param workspaceDir - The workspace directory
 * @param userId - The user ID (Supabase UUID or identifier)
 * @returns Context files for this user including behavioral modulation
 */
export async function loadPerUserContext(
  workspaceDir: string,
  userId: string
): Promise<EmbeddedContextFile[]> {
  const results: EmbeddedContextFile[] = [];
  const userDir = path.join(workspaceDir, 'psychology', 'users', userId);

  // Try to load user's trust profile for behavioral modulation
  try {
    const profilePath = path.join(userDir, 'trust_profile.json');
    const profileContent = await fs.readFile(profilePath, 'utf-8');
    const profile = JSON.parse(profileContent) as TrustProfile;

    // Add behavioral modulation prompt
    const behavioralPrompt = getSystemPromptInjection(profile);
    results.push({
      path: `psychology/users/${userId}/behavioral-modulation.txt`,
      content: behavioralPrompt,
    });

    // Add trust profile as context
    results.push({
      path: `psychology/users/${userId}/trust_profile.json`,
      content: profileContent,
    });
  } catch {
    // Profile may not exist yet for new users
  }

  // Load user's interaction history
  try {
    const historyPath = path.join(userDir, 'interaction_history.json');
    const historyContent = await fs.readFile(historyPath, 'utf-8');
    results.push({
      path: `psychology/users/${userId}/interaction_history.json`,
      content: historyContent,
    });
  } catch {
    // History may not exist yet
  }

  // Load user's emotional memory/tags
  try {
    const emotionalPath = path.join(userDir, 'emotional_memory.json');
    const emotionalContent = await fs.readFile(emotionalPath, 'utf-8');
    results.push({
      path: `psychology/users/${userId}/emotional_memory.json`,
      content: emotionalContent,
    });
  } catch {
    // Emotional memory may not exist yet
  }

  // Load attachment state
  try {
    const attachmentPath = path.join(userDir, 'attachment_state.json');
    const attachmentContent = await fs.readFile(attachmentPath, 'utf-8');
    results.push({
      path: `psychology/users/${userId}/attachment_state.json`,
      content: attachmentContent,
    });
  } catch {
    // Attachment state may not exist yet
  }

  return results;
}

/**
 * Load complete context for a session (global + per-user)
 *
 * @param workspaceDir - The workspace directory
 * @param userId - The user ID for per-user context
 * @returns All context files (global seven layers + per-user)
 */
export async function loadCompleteSessionContext(
  workspaceDir: string,
  userId: string
): Promise<EmbeddedContextFile[]> {
  // Load global Helix context
  const globalContext = await loadHelixContextFiles(workspaceDir);

  // Load per-user context with behavioral modulation
  const userContext = await loadPerUserContext(workspaceDir, userId);

  // Combine: per-user context first (behavioral modulation takes precedence)
  return [...userContext, ...globalContext];
}

/**
 * Get behavioral modulation system prompt for a user
 * Can be used to inject into prompt templates
 *
 * @param workspaceDir - The workspace directory
 * @param userId - The user ID
 * @returns The system prompt injection string, or empty string if profile not found
 */
export async function getBehavioralModulationPrompt(
  workspaceDir: string,
  userId: string
): Promise<string> {
  try {
    const profilePath = path.join(
      workspaceDir,
      'psychology',
      'users',
      userId,
      'trust_profile.json'
    );
    const profileContent = await fs.readFile(profilePath, 'utf-8');
    const profile = JSON.parse(profileContent) as TrustProfile;
    return getSystemPromptInjection(profile);
  } catch {
    return '';
  }
}

/**
 * Validate that a context file has required fields
 */
export function validateContextFile(
  content: string,
  schema: Record<string, 'required' | 'optional'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, errors: ['Content is not a valid JSON object'] };
    }

    for (const [field, requirement] of Object.entries(schema)) {
      if (requirement === 'required' && !(field in parsed)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

export { HELIX_LAYER_FILES };
