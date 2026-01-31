/**
 * HELIX SESSION TYPES
 * Type definitions for session synchronization
 */

export type SessionOrigin = "local" | "observatory" | "mobile";
export type SessionStatus = "active" | "paused" | "completed" | "transferred";
export type ConflictResolution = "local-wins" | "remote-wins" | "manual" | "merge";

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  origin: SessionOrigin;
  metadata?: {
    toolCalls?: ToolCallRecord[];
    fileChanges?: FileChangeRecord[];
    commandOutputs?: CommandOutputRecord[];
    voiceTranscript?: VoiceTranscriptRecord;
  };
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  startTime: number;
  endTime?: number;
  status: "pending" | "running" | "completed" | "failed";
}

export interface FileChangeRecord {
  filePath: string;
  action: "create" | "edit" | "delete" | "rename";
  oldContent?: string;
  newContent?: string;
  diff?: string;
  timestamp: number;
}

export interface CommandOutputRecord {
  command: string;
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  startTime: number;
  endTime: number;
}

export interface VoiceTranscriptRecord {
  text: string;
  confidence: number;
  duration: number;
  provider: string;
}

export interface Session {
  id: string;
  userId: string;
  projectId?: string;
  workingDirectory: string;
  title?: string;
  status: SessionStatus;
  origin: SessionOrigin;
  startTime: number;
  lastActivity: number;
  endTime?: number;
  messages: SessionMessage[];
  context?: SessionContext;
  syncState?: SyncState;
}

export interface SessionContext {
  files: string[]; // Files referenced in session
  tools: string[]; // Tools used
  gitBranch?: string;
  gitCommit?: string;
  environment?: Record<string, string>;
}

export interface SyncState {
  lastSyncTime: number;
  localVersion: number;
  remoteVersion: number;
  pendingChanges: number;
  conflictCount: number;
}

export interface SyncConflict {
  id: string;
  sessionId: string;
  messageId: string;
  localData: SessionMessage;
  remoteData: SessionMessage;
  detectedAt: number;
  resolution?: ConflictResolution;
  resolvedAt?: number;
}

export interface SyncConfig {
  enabled: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  syncInterval: number; // ms
  conflictResolution: ConflictResolution;
  retryAttempts: number;
  retryDelay: number; // ms
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  syncInterval: 30000, // 30 seconds
  conflictResolution: "local-wins",
  retryAttempts: 3,
  retryDelay: 5000,
};

export interface SyncEvent {
  type:
    | "sync:start"
    | "sync:complete"
    | "sync:error"
    | "sync:conflict"
    | "session:transfer"
    | "session:resume";
  sessionId: string;
  timestamp: number;
  data?: unknown;
}

export interface TransferRequest {
  sessionId: string;
  fromOrigin: SessionOrigin;
  toOrigin: SessionOrigin;
  timestamp: number;
  userId: string;
}

export interface TransferResponse {
  success: boolean;
  sessionId: string;
  transferTime: number;
  error?: string;
}
