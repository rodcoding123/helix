/**
 * HELIX CONFLICT RESOLUTION
 * Handles sync conflicts between local and remote sessions
 *
 * Strategies:
 * - local-wins: Local changes always take precedence
 * - remote-wins: Remote changes always take precedence
 * - manual: User decides for each conflict
 * - merge: Attempt automatic merge (for compatible changes)
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  SyncConflict,
  SessionMessage,
  ConflictResolution,
} from "./types.js";

const log = createSubsystemLogger("helix:session:conflict");

export interface MergeResult {
  success: boolean;
  mergedMessage?: SessionMessage;
  error?: string;
}

export interface ConflictContext {
  localTimestamp: number;
  remoteTimestamp: number;
  localOrigin: string;
  remoteOrigin: string;
  messageRole: string;
}

/**
 * Analyze a conflict and suggest resolution
 */
export function analyzeConflict(conflict: SyncConflict): {
  suggestion: ConflictResolution;
  reason: string;
  canAutoMerge: boolean;
} {
  const local = conflict.localData;
  const remote = conflict.remoteData;

  // Same content = no conflict
  if (local.content === remote.content) {
    return {
      suggestion: "local-wins",
      reason: "Content is identical",
      canAutoMerge: true,
    };
  }

  // Metadata-only difference
  if (local.content === remote.content && local.role === remote.role) {
    return {
      suggestion: "merge",
      reason: "Only metadata differs",
      canAutoMerge: true,
    };
  }

  // One is empty - prefer non-empty
  if (!local.content.trim() && remote.content.trim()) {
    return {
      suggestion: "remote-wins",
      reason: "Local content is empty",
      canAutoMerge: true,
    };
  }

  if (local.content.trim() && !remote.content.trim()) {
    return {
      suggestion: "local-wins",
      reason: "Remote content is empty",
      canAutoMerge: true,
    };
  }

  // System messages - prefer more recent
  if (local.role === "system" && remote.role === "system") {
    return {
      suggestion: local.timestamp >= remote.timestamp ? "local-wins" : "remote-wins",
      reason: "Preferring more recent system message",
      canAutoMerge: true,
    };
  }

  // Assistant messages - might be able to merge if additive
  if (local.role === "assistant" && remote.role === "assistant") {
    const canMerge = canMergeAssistantMessages(local.content, remote.content);
    if (canMerge) {
      return {
        suggestion: "merge",
        reason: "Assistant responses can be combined",
        canAutoMerge: true,
      };
    }
  }

  // User messages - generally can't auto-merge
  if (local.role === "user" && remote.role === "user") {
    // If one is a prefix of the other (typing continuation)
    if (local.content.startsWith(remote.content) || remote.content.startsWith(local.content)) {
      return {
        suggestion: local.content.length >= remote.content.length ? "local-wins" : "remote-wins",
        reason: "One message is a continuation of the other",
        canAutoMerge: true,
      };
    }
  }

  // Default to manual resolution
  return {
    suggestion: "manual",
    reason: "Content differs significantly, manual review needed",
    canAutoMerge: false,
  };
}

/**
 * Check if two assistant messages can be merged
 */
function canMergeAssistantMessages(local: string, remote: string): boolean {
  // Check for common patterns that indicate mergeable content

  // Both are tool call responses
  if (local.includes("```") && remote.includes("```")) {
    // Different code blocks might be separate tool calls
    return true;
  }

  // One is a continuation
  if (local.endsWith("...") || remote.startsWith("...")) {
    return true;
  }

  // Very short messages (likely partial)
  if (local.length < 50 || remote.length < 50) {
    return true;
  }

  return false;
}

/**
 * Merge two messages
 */
export function mergeMessages(
  local: SessionMessage,
  remote: SessionMessage,
  strategy: "append" | "prepend" | "smart" = "smart"
): MergeResult {
  try {
    let mergedContent: string;

    switch (strategy) {
      case "append":
        mergedContent = `${local.content}\n\n${remote.content}`;
        break;

      case "prepend":
        mergedContent = `${remote.content}\n\n${local.content}`;
        break;

      case "smart":
        mergedContent = smartMerge(local.content, remote.content);
        break;
    }

    const mergedMessage: SessionMessage = {
      ...local,
      content: mergedContent,
      timestamp: Math.max(local.timestamp, remote.timestamp),
      metadata: mergeMetadata(local.metadata, remote.metadata),
    };

    return {
      success: true,
      mergedMessage,
    };
  } catch (err) {
    log.error("Merge failed:", { error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * Smart merge that tries to combine content intelligently
 */
function smartMerge(local: string, remote: string): string {
  // If one is a prefix of the other, use the longer one
  if (local.startsWith(remote)) {
    return local;
  }
  if (remote.startsWith(local)) {
    return remote;
  }

  // Find common prefix
  let commonPrefixLength = 0;
  const minLength = Math.min(local.length, remote.length);
  for (let i = 0; i < minLength; i++) {
    if (local[i] === remote[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }

  // Find common suffix
  let commonSuffixLength = 0;
  for (let i = 0; i < minLength - commonPrefixLength; i++) {
    if (local[local.length - 1 - i] === remote[remote.length - 1 - i]) {
      commonSuffixLength++;
    } else {
      break;
    }
  }

  // If significant overlap, merge
  if (commonPrefixLength > 20 || commonSuffixLength > 20) {
    const prefix = local.substring(0, commonPrefixLength);
    const localMiddle = local.substring(commonPrefixLength, local.length - commonSuffixLength);
    const remoteMiddle = remote.substring(commonPrefixLength, remote.length - commonSuffixLength);
    const suffix = local.substring(local.length - commonSuffixLength);

    // Combine middle parts if they differ
    if (localMiddle !== remoteMiddle) {
      return `${prefix}${localMiddle}${remoteMiddle}${suffix}`;
    }
    return local;
  }

  // No significant overlap - append with separator
  return `${local}\n\n---\n\n${remote}`;
}

/**
 * Merge metadata from two messages
 */
function mergeMetadata(
  local?: SessionMessage["metadata"],
  remote?: SessionMessage["metadata"]
): SessionMessage["metadata"] {
  if (!local && !remote) return undefined;
  if (!local) return remote;
  if (!remote) return local;

  return {
    toolCalls: [...(local.toolCalls || []), ...(remote.toolCalls || [])].filter(
      (tc, i, arr) => arr.findIndex((t) => t.id === tc.id) === i
    ),
    fileChanges: [...(local.fileChanges || []), ...(remote.fileChanges || [])].filter(
      (fc, i, arr) =>
        arr.findIndex((f) => f.filePath === fc.filePath && f.timestamp === fc.timestamp) === i
    ),
    commandOutputs: [...(local.commandOutputs || []), ...(remote.commandOutputs || [])].filter(
      (co, i, arr) => arr.findIndex((c) => c.startTime === co.startTime) === i
    ),
    voiceTranscript: local.voiceTranscript || remote.voiceTranscript,
  };
}

/**
 * Create a conflict resolution dialog data
 */
export function createConflictDialogData(conflict: SyncConflict): {
  title: string;
  description: string;
  localPreview: string;
  remotePreview: string;
  options: { value: ConflictResolution; label: string; description: string }[];
} {
  const analysis = analyzeConflict(conflict);
  const local = conflict.localData;
  const remote = conflict.remoteData;

  const truncate = (s: string, len: number) =>
    s.length > len ? s.substring(0, len) + "..." : s;

  return {
    title: "Sync Conflict Detected",
    description: `A message was modified in both local and remote sessions. ${analysis.reason}`,
    localPreview: truncate(local.content, 500),
    remotePreview: truncate(remote.content, 500),
    options: [
      {
        value: "local-wins",
        label: "Keep Local",
        description: `Use the local version (${new Date(local.timestamp).toLocaleTimeString()})`,
      },
      {
        value: "remote-wins",
        label: "Keep Remote",
        description: `Use the remote version (${new Date(remote.timestamp).toLocaleTimeString()})`,
      },
      {
        value: "merge",
        label: "Merge Both",
        description: analysis.canAutoMerge
          ? "Automatically combine both versions"
          : "Manually combine both versions",
      },
    ],
  };
}

/**
 * Apply automatic resolution based on configured strategy
 */
export function autoResolve(
  conflict: SyncConflict,
  defaultStrategy: ConflictResolution
): { resolution: ConflictResolution; result?: SessionMessage } {
  const analysis = analyzeConflict(conflict);

  // Use suggestion if auto-mergeable, otherwise use default
  if (analysis.canAutoMerge) {
    if (analysis.suggestion === "merge") {
      const mergeResult = mergeMessages(conflict.localData, conflict.remoteData);
      if (mergeResult.success) {
        return { resolution: "merge", result: mergeResult.mergedMessage };
      }
    }
    return { resolution: analysis.suggestion };
  }

  // Fall back to default strategy
  return { resolution: defaultStrategy };
}
