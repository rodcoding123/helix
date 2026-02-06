/**
 * HELIX CONTEXT LOADER
 * Loads the seven-layer Living AI Architecture files into OpenClaw context
 *
 * Layer Mapping:
 * 1. Narrative Core      - SOUL.md (loaded by OpenClaw), psyeval.json
 * 2. Emotional Memory    - emotional_tags.json
 * 3. Relational Memory   - attachments.json, trust_map.json
 * 4. Prospective Self    - goals.json, feared_self.json, possible_selves.json
 * 5. Integration Rhythms - (cron scripts, not loaded into context)
 * 6. Transformation      - current_state.json, history.json
 * 7. Purpose Engine      - ikigai.json, wellness.json, meaning_sources.json
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { HelixContextFile } from "./types.js";
import { HELIX_LAYER_FILES } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("helix/context");

/**
 * Context file format compatible with OpenClaw's EmbeddedContextFile
 */
export interface EmbeddedContextFile {
  path: string;
  content: string;
}

/**
 * Load all Helix context files for a workspace
 *
 * @param workspaceDir - The Helix project directory or OpenClaw workspace directory
 * @returns Array of context files ready for embedding
 */
export async function loadHelixContextFiles(workspaceDir: string): Promise<EmbeddedContextFile[]> {
  const results: EmbeddedContextFile[] = [];

  // Try two possible locations:
  // 1. Helix project structure: workspaceDir/soul/, workspaceDir/psychology/, etc.
  // 2. OpenClaw workspace structure: workspaceDir/axis/psychology/, workspaceDir/axis/identity/, etc.
  const isProjectStructure = await isHelixConfigured(workspaceDir);
  const baseDir = isProjectStructure ? workspaceDir : path.join(workspaceDir, "axis");

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(baseDir, relativePath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");

        // Add layer metadata as comment for JSON files
        let enhancedContent = content;
        if (relativePath.endsWith(".json")) {
          try {
            const parsed = JSON.parse(content) as Record<string, unknown>;
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

        log.debug(`Loaded layer ${layerNum} file`, { path: relativePath });
      } catch {
        // File doesn't exist - skip silently
        // This is expected for optional files
      }
    }
  }

  log.info(`Loaded ${results.length} Helix context files from ${baseDir}`);
  return results;
}

/**
 * Load context files with detailed metadata
 */
export async function loadHelixContextFilesDetailed(
  workspaceDir: string,
): Promise<HelixContextFile[]> {
  const results: HelixContextFile[] = [];

  // Try two possible locations
  const isProjectStructure = await isHelixConfigured(workspaceDir);
  const baseDir = isProjectStructure ? workspaceDir : path.join(workspaceDir, "axis");

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(baseDir, relativePath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");

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
    status: "present" | "missing";
    size?: number;
  }[]
> {
  const status: {
    layer: number;
    name: string;
    file: string;
    status: "present" | "missing";
    size?: number;
  }[] = [];

  // Try two possible locations
  const isProjectStructure = await isHelixConfigured(workspaceDir);
  const baseDir = isProjectStructure ? workspaceDir : path.join(workspaceDir, "axis");

  for (const [layerNum, layer] of Object.entries(HELIX_LAYER_FILES)) {
    for (const relativePath of layer.files) {
      const fullPath = path.join(baseDir, relativePath);

      try {
        const stats = await fs.stat(fullPath);
        status.push({
          layer: parseInt(layerNum),
          name: layer.name,
          file: relativePath,
          status: "present",
          size: stats.size,
        });
      } catch {
        status.push({
          layer: parseInt(layerNum),
          name: layer.name,
          file: relativePath,
          status: "missing",
        });
      }
    }
  }

  return status;
}

/**
 * Create the expected directory structure for Helix
 */
export async function ensureHelixDirectoryStructure(workspaceDir: string): Promise<void> {
  const directories = [
    "axis/psychology",
    "axis/identity",
    "axis/transformation",
    "axis/purpose",
    "axis/scripts",
    "axis/legacy",
  ];

  for (const dir of directories) {
    const fullPath = path.join(workspaceDir, dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  log.info("Ensured Helix directory structure exists");
}

/**
 * Check if Helix is configured in this workspace
 * Detects both project structure (soul/, psychology/, etc.) and OpenClaw workspace structure (axis/)
 */
export async function isHelixConfigured(workspaceDir: string): Promise<boolean> {
  // Check for Helix project structure: soul/, psychology/, identity/
  const requiredDirs = ["soul", "psychology", "identity"];

  // Check if Helix project structure exists
  let hasProjectStructure = true;
  for (const dir of requiredDirs) {
    try {
      const dirPath = path.join(workspaceDir, dir);
      await fs.access(dirPath);
    } catch {
      hasProjectStructure = false;
      break;
    }
  }

  if (hasProjectStructure) {
    return true; // Helix project structure found
  }

  // Check if it's OpenClaw workspace structure instead (axis/)
  try {
    const axisDir = path.join(workspaceDir, "axis");
    await fs.access(axisDir);
    return true; // OpenClaw workspace structure found
  } catch {
    return false; // Neither structure found
  }
}
