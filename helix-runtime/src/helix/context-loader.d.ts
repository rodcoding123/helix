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
import type { HelixContextFile } from "./types.js";
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
 * @param workspaceDir - The OpenClaw workspace directory
 * @returns Array of context files ready for embedding
 */
export declare function loadHelixContextFiles(workspaceDir: string): Promise<EmbeddedContextFile[]>;
/**
 * Load context files with detailed metadata
 */
export declare function loadHelixContextFilesDetailed(workspaceDir: string): Promise<HelixContextFile[]>;
/**
 * Get the status of all Helix context files
 * Useful for debugging and monitoring
 */
export declare function getHelixContextStatus(workspaceDir: string): Promise<{
    layer: number;
    name: string;
    file: string;
    status: "present" | "missing";
    size?: number;
}[]>;
/**
 * Create the expected directory structure for Helix
 */
export declare function ensureHelixDirectoryStructure(workspaceDir: string): Promise<void>;
/**
 * Check if Helix is configured in this workspace
 */
export declare function isHelixConfigured(workspaceDir: string): Promise<boolean>;
//# sourceMappingURL=context-loader.d.ts.map