/**
 * HELIX TYPE DEFINITIONS
 * Shared types for the Helix logging system
 */

/**
 * Pre-execution command log entry
 */
export interface PreExecutionLog {
  id: string;
  command: string;
  workdir: string;
  timestamp: string;
  sessionKey?: string;
  elevated?: boolean;
}

/**
 * Post-execution command log entry
 */
export interface PostExecutionLog extends PreExecutionLog {
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  outputPreview: string;
}

/**
 * API pre-flight log entry
 */
export interface ApiPreFlightLog {
  model?: string;
  provider?: string;
  sessionKey?: string;
  timestamp: string;
  promptPreview?: string;
  requestId?: string;
}

/**
 * Discord embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
  title: string;
  color: number;
  description?: string;
  fields: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
}

/**
 * Discord webhook payload
 */
export interface DiscordPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

/**
 * Helix context file (for seven-layer loading)
 */
export interface HelixContextFile {
  path: string;
  content: string;
  layer?: number;
  description?: string;
}

/**
 * Seven layer file paths relative to workspace/axis/
 */
export const HELIX_LAYER_FILES: Record<number, { name: string; files: string[] }> = {
  1: {
    name: "Narrative Core",
    files: ["psychology/psyeval.json"],
  },
  2: {
    name: "Emotional Memory",
    files: ["psychology/emotional_tags.json"],
  },
  3: {
    name: "Relational Memory",
    files: ["psychology/attachments.json", "psychology/trust_map.json"],
  },
  4: {
    name: "Prospective Self",
    files: ["identity/goals.json", "identity/feared_self.json", "identity/possible_selves.json"],
  },
  5: {
    name: "Integration Rhythms",
    files: [], // Scripts run via cron, not loaded into context
  },
  6: {
    name: "Transformation Cycles",
    files: ["transformation/current_state.json", "transformation/history.json"],
  },
  7: {
    name: "Purpose Engine",
    files: ["purpose/ikigai.json", "purpose/wellness.json", "purpose/meaning_sources.json"],
  },
};
