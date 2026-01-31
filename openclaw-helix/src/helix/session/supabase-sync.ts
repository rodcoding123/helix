/**
 * HELIX SUPABASE SESSION SYNC
 * Synchronizes sessions between local and Observatory (Supabase backend)
 *
 * Features:
 * - Real-time session sync via Supabase
 * - Conflict detection and resolution
 * - Session transfer between local/remote
 * - Offline queue with retry logic
 */

import { EventEmitter } from "events";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  type Session,
  type SessionMessage,
  type SyncConfig,
  type SyncState,
  type SyncConflict,
  type TransferRequest,
  type TransferResponse,
  type SyncEvent,
  type SessionOrigin,
  DEFAULT_SYNC_CONFIG,
} from "./types.js";

const log = createSubsystemLogger("helix:session:sync");

// Supabase client types (would be from @supabase/supabase-js)
interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
  channel: (name: string) => SupabaseChannel;
  removeChannel: (channel: SupabaseChannel) => Promise<void>;
}

interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseQueryBuilder;
  update: (data: unknown) => SupabaseQueryBuilder;
  upsert: (data: unknown) => SupabaseQueryBuilder;
  delete: () => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  gt: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
  then: (resolve: (result: { data: unknown[]; error: Error | null }) => void) => Promise<void>;
}

interface SupabaseChannel {
  on: (
    event: string,
    filter: { event: string; schema: string; table: string },
    callback: (payload: unknown) => void
  ) => SupabaseChannel;
  subscribe: (callback?: (status: string) => void) => SupabaseChannel;
}

/**
 * Session sync manager using Supabase
 */
export class SupabaseSessionSync extends EventEmitter {
  private config: SyncConfig;
  private client: SupabaseClient | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private channel: SupabaseChannel | null = null;

  // Local state
  private sessions: Map<string, Session> = new Map();
  private pendingChanges: Map<string, SessionMessage[]> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();

  // Sync state
  private isSyncing = false;
  private lastSyncTime = 0;
  private retryCount = 0;

  constructor(config: Partial<SyncConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    log.info("Session sync initialized", { enabled: this.config.enabled });
  }

  /**
   * Initialize Supabase connection
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      log.info("Session sync disabled");
      return;
    }

    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      log.warn("Supabase credentials not configured, sync disabled");
      return;
    }

    try {
      // Dynamic import to avoid bundling Supabase if not needed
      // @ts-expect-error - @supabase/supabase-js is an optional peer dependency
      const { createClient } = await import("@supabase/supabase-js");
      this.client = createClient(this.config.supabaseUrl, this.config.supabaseKey) as unknown as SupabaseClient;

      // Set up real-time subscriptions
      this.setupRealtimeSubscription();

      // Start periodic sync
      this.startSyncTimer();

      log.info("Session sync connected to Supabase");
    } catch (err) {
      log.error("Failed to initialize Supabase:", { error: String(err) });
      throw err;
    }
  }

  /**
   * Create a new session
   */
  async createSession(session: Omit<Session, "id" | "syncState">): Promise<Session> {
    const fullSession: Session = {
      ...session,
      id: this.generateSessionId(),
      syncState: {
        lastSyncTime: Date.now(),
        localVersion: 1,
        remoteVersion: 0,
        pendingChanges: 0,
        conflictCount: 0,
      },
    };

    this.sessions.set(fullSession.id, fullSession);

    // Sync to remote
    if (this.client) {
      await this.syncSessionToRemote(fullSession);
    }

    this.emitEvent({
      type: "sync:complete",
      sessionId: fullSession.id,
      timestamp: Date.now(),
    });

    return fullSession;
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, message: Omit<SessionMessage, "id" | "sessionId">): Promise<SessionMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fullMessage: SessionMessage = {
      ...message,
      id: this.generateMessageId(),
      sessionId,
    };

    session.messages.push(fullMessage);
    session.lastActivity = Date.now();

    // Track pending changes
    if (!this.pendingChanges.has(sessionId)) {
      this.pendingChanges.set(sessionId, []);
    }
    this.pendingChanges.get(sessionId)!.push(fullMessage);

    if (session.syncState) {
      session.syncState.localVersion++;
      session.syncState.pendingChanges++;
    }

    // Immediate sync for important messages
    if (this.client && this.config.enabled) {
      this.scheduleSyncSoon();
    }

    return fullMessage;
  }

  /**
   * Resume a session from remote
   */
  async resumeSession(sessionId: string): Promise<Session | null> {
    if (!this.client) {
      log.warn("Cannot resume session: Supabase not connected");
      return null;
    }

    try {
      const { data, error } = await this.client
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        log.error("Failed to fetch session:", { error: String(error) });
        return null;
      }

      if (!data) {
        return null;
      }

      const session = data as Session;
      session.status = "active";
      session.origin = "local"; // Now local

      this.sessions.set(session.id, session);

      this.emitEvent({
        type: "session:resume",
        sessionId: session.id,
        timestamp: Date.now(),
        data: { previousOrigin: session.origin },
      });

      return session;
    } catch (err) {
      log.error("Error resuming session:", { error: String(err) });
      return null;
    }
  }

  /**
   * Transfer session to another origin
   */
  async transferSession(request: TransferRequest): Promise<TransferResponse> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return {
        success: false,
        sessionId: request.sessionId,
        transferTime: 0,
        error: "Session not found",
      };
    }

    const startTime = Date.now();

    try {
      // Mark session as transferred
      session.status = "transferred";
      session.origin = request.toOrigin;

      // Sync final state
      if (this.client) {
        await this.syncSessionToRemote(session);
      }

      // Create transfer record
      if (this.client) {
        await this.client.from("session_transfers").insert({
          session_id: request.sessionId,
          from_origin: request.fromOrigin,
          to_origin: request.toOrigin,
          user_id: request.userId,
          timestamp: request.timestamp,
        });
      }

      this.emitEvent({
        type: "session:transfer",
        sessionId: request.sessionId,
        timestamp: Date.now(),
        data: { from: request.fromOrigin, to: request.toOrigin },
      });

      return {
        success: true,
        sessionId: request.sessionId,
        transferTime: Date.now() - startTime,
      };
    } catch (err) {
      log.error("Session transfer failed:", { error: String(err) });
      return {
        success: false,
        sessionId: request.sessionId,
        transferTime: Date.now() - startTime,
        error: String(err),
      };
    }
  }

  /**
   * Get local session
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all local sessions
   */
  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get pending conflicts
   */
  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(conflictId: string, resolution: SyncConflict["resolution"]): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    conflict.resolution = resolution;
    conflict.resolvedAt = Date.now();

    const session = this.sessions.get(conflict.sessionId);
    if (!session) return;

    // Apply resolution
    switch (resolution) {
      case "local-wins":
        // Keep local data, overwrite remote
        await this.syncSessionToRemote(session);
        break;
      case "remote-wins":
        // Replace local with remote
        const messageIndex = session.messages.findIndex((m) => m.id === conflict.messageId);
        if (messageIndex >= 0) {
          session.messages[messageIndex] = conflict.remoteData;
        }
        break;
      case "merge":
        // Attempt to merge (append both)
        // This is a simple strategy - real merge would be more complex
        const localMsg = session.messages.find((m) => m.id === conflict.messageId);
        if (localMsg) {
          localMsg.content = `[Local]\n${conflict.localData.content}\n\n[Remote]\n${conflict.remoteData.content}`;
        }
        break;
    }

    this.conflicts.delete(conflictId);

    if (session.syncState) {
      session.syncState.conflictCount = this.conflicts.size;
    }
  }

  /**
   * Force sync now
   */
  async syncNow(): Promise<void> {
    if (!this.client || this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Sync all sessions with pending changes
      for (const [sessionId, changes] of this.pendingChanges.entries()) {
        if (changes.length === 0) continue;

        const session = this.sessions.get(sessionId);
        if (!session) continue;

        await this.syncSessionToRemote(session);
        this.pendingChanges.set(sessionId, []);

        if (session.syncState) {
          session.syncState.lastSyncTime = Date.now();
          session.syncState.pendingChanges = 0;
        }
      }

      // Pull remote changes
      await this.pullRemoteChanges();

      this.lastSyncTime = Date.now();
      this.retryCount = 0;

      this.emitEvent({
        type: "sync:complete",
        sessionId: "*",
        timestamp: Date.now(),
        data: { duration: Date.now() - startTime },
      });
    } catch (err) {
      log.error("Sync failed:", { error: String(err) });
      this.retryCount++;

      this.emitEvent({
        type: "sync:error",
        sessionId: "*",
        timestamp: Date.now(),
        data: { error: String(err), retryCount: this.retryCount },
      });

      // Retry logic
      if (this.retryCount < this.config.retryAttempts) {
        setTimeout(() => this.syncNow(), this.config.retryDelay);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Stop sync
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.channel && this.client) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }

    log.info("Session sync stopped");
  }

  // ==================== Private Methods ====================

  private setupRealtimeSubscription(): void {
    if (!this.client) return;

    this.channel = this.client
      .channel("session-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_messages",
        },
        (payload: unknown) => {
          this.handleRemoteChange(payload);
        }
      )
      .subscribe((status: string) => {
        log.debug("Realtime subscription status:", { status });
      });
  }

  private handleRemoteChange(payload: unknown): void {
    // Handle incoming changes from other origins
    const data = payload as { eventType: string; new: SessionMessage; old: SessionMessage };

    if (data.eventType === "INSERT" && data.new) {
      const message = data.new;
      const session = this.sessions.get(message.sessionId);

      if (session && message.origin !== "local") {
        // Check for conflicts
        const existingMessage = session.messages.find((m) => m.id === message.id);
        if (existingMessage && existingMessage.content !== message.content) {
          // Conflict detected
          const conflict: SyncConflict = {
            id: `conflict-${Date.now()}`,
            sessionId: message.sessionId,
            messageId: message.id,
            localData: existingMessage,
            remoteData: message,
            detectedAt: Date.now(),
          };

          this.conflicts.set(conflict.id, conflict);

          if (session.syncState) {
            session.syncState.conflictCount++;
          }

          this.emitEvent({
            type: "sync:conflict",
            sessionId: message.sessionId,
            timestamp: Date.now(),
            data: { conflict },
          });
        } else if (!existingMessage) {
          // New message from remote
          session.messages.push(message);
          session.lastActivity = Date.now();

          if (session.syncState) {
            session.syncState.remoteVersion++;
          }
        }
      }
    }
  }

  private async syncSessionToRemote(session: Session): Promise<void> {
    if (!this.client) return;

    try {
      // Upsert session
      await this.client.from("sessions").upsert({
        id: session.id,
        user_id: session.userId,
        project_id: session.projectId,
        working_directory: session.workingDirectory,
        title: session.title,
        status: session.status,
        origin: session.origin,
        start_time: session.startTime,
        last_activity: session.lastActivity,
        end_time: session.endTime,
        context: session.context,
        local_version: session.syncState?.localVersion,
      });

      // Upsert messages
      if (session.messages.length > 0) {
        const messages = session.messages.map((m) => ({
          id: m.id,
          session_id: m.sessionId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          origin: m.origin,
          metadata: m.metadata,
        }));

        await this.client.from("session_messages").upsert(messages);
      }
    } catch (err) {
      log.error("Failed to sync session to remote:", { error: String(err) });
      throw err;
    }
  }

  private async pullRemoteChanges(): Promise<void> {
    if (!this.client) return;

    try {
      // Fetch sessions updated since last sync
      const { data: remoteSessions, error } = (await this.client
        .from("sessions")
        .select("*")
        .gt("last_activity", this.lastSyncTime)
        .order("last_activity", { ascending: false })
        .limit(100)) as { data: Session[] | null; error: Error | null };

      if (error) {
        throw error;
      }

      if (remoteSessions) {
        for (const remoteSession of remoteSessions) {
          const localSession = this.sessions.get(remoteSession.id);

          if (!localSession) {
            // New session from remote
            this.sessions.set(remoteSession.id, remoteSession);
          } else if (
            remoteSession.lastActivity > localSession.lastActivity &&
            remoteSession.origin !== "local"
          ) {
            // Remote is newer and from different origin
            // Merge messages
            await this.mergeRemoteMessages(localSession, remoteSession);
          }
        }
      }
    } catch (err) {
      log.error("Failed to pull remote changes:", { error: String(err) });
      throw err;
    }
  }

  private async mergeRemoteMessages(local: Session, remote: Session): Promise<void> {
    if (!this.client) return;

    // Fetch remote messages
    const { data: remoteMessages, error } = (await this.client
      .from("session_messages")
      .select("*")
      .eq("session_id", remote.id)
      .gt("timestamp", local.lastActivity)) as { data: SessionMessage[] | null; error: Error | null };

    if (error || !remoteMessages) {
      return;
    }

    // Add non-conflicting messages
    for (const remoteMsg of remoteMessages) {
      const existing = local.messages.find((m) => m.id === remoteMsg.id);
      if (!existing) {
        local.messages.push(remoteMsg);
      }
    }

    // Sort by timestamp
    local.messages.sort((a, b) => a.timestamp - b.timestamp);
    local.lastActivity = Date.now();

    if (local.syncState) {
      local.syncState.remoteVersion = remote.syncState?.localVersion || 0;
    }
  }

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncNow();
    }, this.config.syncInterval);
  }

  private scheduleSyncSoon(): void {
    // Debounce - sync in 2 seconds if no other changes
    setTimeout(() => {
      if (this.pendingChanges.size > 0) {
        this.syncNow();
      }
    }, 2000);
  }

  private emitEvent(event: SyncEvent): void {
    this.emit(event.type, event);
    this.emit("sync:event", event);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * Create and initialize session sync
 */
export async function createSessionSync(config?: Partial<SyncConfig>): Promise<SupabaseSessionSync> {
  const sync = new SupabaseSessionSync(config);
  await sync.initialize();
  return sync;
}
