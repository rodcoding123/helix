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
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { HelixContextFile } from './types.js';

/**
 * Seven layer file mapping
 * These paths are relative to the workspace directory
 */
const HELIX_LAYER_FILES: Record<number, { name: string; files: string[] }> = {
  1: {
    name: 'Narrative Core',
    files: [
      'axis/psychology/psyeval.json',  // SOUL.md loaded separately by OpenClaw
    ],
  },
  2: {
    name: 'Emotional Memory',
    files: [
      'axis/psychology/emotional_tags.json',
    ],
  },
  3: {
    name: 'Relational Memory',
    files: [
      'axis/psychology/attachments.json',
      'axis/psychology/trust_map.json',
    ],
  },
  4: {
    name: 'Prospective Self',
    files: [
      'axis/identity/goals.json',
      'axis/identity/feared_self.json',
      'axis/identity/possible_selves.json',
    ],
  },
  5: {
    name: 'Integration Rhythms',
    files: [], // Scripts run via cron, not loaded into context
  },
  6: {
    name: 'Transformation Cycles',
    files: [
      'axis/transformation/current_state.json',
      'axis/transformation/history.json',
    ],
  },
  7: {
    name: 'Purpose Engine',
    files: [
      'axis/purpose/ikigai.json',
      'axis/purpose/wellness.json',
      'axis/purpose/meaning_sources.json',
    ],
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
export async function loadHelixContextFiles(
  workspaceDir: string
): Promise<EmbeddedContextFile[]> {
  const results: EmbeddedContextFile[] = [];

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(workspaceDir, relativePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');

        // Add layer metadata as comment for JSON files
        let enhancedContent = content;
        if (relativePath.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content);
            parsed._helix_layer = {
              number: parseInt(layerNum),
              name: layer.name,
            };
            enhancedContent = JSON.stringify(parsed, null, 2);
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
export async function getHelixContextStatus(
  workspaceDir: string
): Promise<{
  layer: number;
  name: string;
  file: string;
  status: 'present' | 'missing';
  size?: number;
}[]> {
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
export async function buildLayerSummary(
  workspaceDir: string
): Promise<string> {
  const status = await getHelixContextStatus(workspaceDir);

  const lines: string[] = [
    '# Helix Seven Layer Status',
    '',
  ];

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
export async function ensureHelixDirectoryStructure(
  workspaceDir: string
): Promise<void> {
  const directories = [
    'axis/psychology',
    'axis/identity',
    'axis/transformation',
    'axis/purpose',
    'axis/scripts',
    'axis/legacy',
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
 * Validate that a context file has required fields
 */
export function validateContextFile(
  content: string,
  schema: Record<string, 'required' | 'optional'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(content);

    for (const [field, requirement] of Object.entries(schema)) {
      if (requirement === 'required' && !(field in parsed)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e}`] };
  }
}

export { HELIX_LAYER_FILES };
