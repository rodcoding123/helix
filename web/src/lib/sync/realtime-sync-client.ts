/**
 * Real-Time Sync Client for Web Platform
 *
 * Coordinates multi-device synchronization using Supabase Realtime
 * with automatic conflict detection and resolution
 */

import { createClient } from "@supabase/supabase-js";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/realtime-js";

import {
  VectorClockManager,
  ConflictTracker,
  type SyncableEntity,
  type Conflict,
  type VectorClock,
} from "./conflict-resolution";

/**
 * Change that was made locally
 */
export interface LocalChange {
  entity_type: "email" | "calendar_event" | "task" | "voice_memo";
  entity_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Change received from remote
 */
export interface DeltaChange {
  entity_type: string;
  entity_id: string;
  operation: string;
  changed_fields: Record<string, unknown>;
  vector_clock: VectorClock;
  deviceType?: string;
  timestamp: number;
}

/**
 * Sync client configuration
 */
export interface SyncClientConfig {
  userId: string;
  deviceId: string;
  supabaseUrl: string;
  supabaseKey: string;
  onDelta?: (change: DeltaChange) => Promise<void>;
  onConflict?: (conflict: Conflict) => Promise<void>;
  onConnectionChange?: (status: "connected" | "disconnected") => void;
}

/**
 * Real-Time Sync Client
 * Handles Supabase subscriptions and conflict resolution
 */
export class RealtimeSyncClient {
  private supabaseClient: any;
  private channels: Map<string, RealtimeChannel> = new Map();
  private vectorClocks = new VectorClockManager();
  private conflictTracker = new ConflictTracker();
  private offlineQueue: LocalChange[] = [];
  private isOffline = false;

  constructor(private config: SyncClientConfig) {
    this.supabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    // Monitor network status
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  /**
   * Initialize sync client and subscribe to changes
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.subscribeToEmails(),
        this.subscribeToCalendar(),
        this.subscribeToTasks(),
        this.subscribeToChangeLog(),
        this.subscribeToPresence(),
      ]);

      this.updateConnectionStatus("connected");
    } catch (error) {
      console.error("Failed to initialize sync client:", error);
      this.updateConnectionStatus("disconnected");
      throw error;
    }
  }

  /**
   * Subscribe to email changes
   */
  private async subscribeToEmails(): Promise<void> {
    const channel = this.supabaseClient
      .channel(`emails:${this.config.userId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "emails",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload: any) => this.handleEmailChange(payload)
      )
      .subscribe();

    this.channels.set("emails", channel);
  }

  /**
   * Subscribe to calendar event changes
   */
  private async subscribeToCalendar(): Promise<void> {
    const channel = this.supabaseClient
      .channel(`calendar:${this.config.userId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload: any) => this.handleCalendarChange(payload)
      )
      .subscribe();

    this.channels.set("calendar", channel);
  }

  /**
   * Subscribe to task changes
   */
  private async subscribeToTasks(): Promise<void> {
    const channel = this.supabaseClient
      .channel(`tasks:${this.config.userId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload: any) => this.handleTaskChange(payload)
      )
      .subscribe();

    this.channels.set("tasks", channel);
  }

  /**
   * Subscribe to sync change log
   */
  private async subscribeToChangeLog(): Promise<void> {
    const channel = this.supabaseClient
      .channel(`changeLog:${this.config.userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_change_log",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload: any) => this.handleChangeLog(payload)
      )
      .subscribe();

    this.channels.set("changeLog", channel);
  }

  /**
   * Subscribe to presence updates
   */
  private async subscribeToPresence(): Promise<void> {
    const channel = this.supabaseClient
      .channel(`presence:${this.config.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_presence",
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload: any) => this.handlePresenceChange(payload)
      )
      .subscribe();

    this.channels.set("presence", channel);

    // Update own presence
    await this.updatePresence();
  }

  /**
   * Handle email change from remote
   */
  private async handleEmailChange(
    payload: RealtimePostgresChangesPayload<SyncableEntity>
  ): Promise<void> {
    if (payload.eventType === "DELETE") {
      return; // Handle separately
    }

    const newData = payload.new as SyncableEntity;
    const oldData = (payload.old as SyncableEntity) || null;

    // Create delta change
    const delta: DeltaChange = {
      entity_type: "email",
      entity_id: newData.id,
      operation: payload.eventType,
      changed_fields: this.computeChangedFields(oldData, newData),
      vector_clock: newData.sync_meta.vector_clock,
      timestamp: Date.now(),
    };

    // Invoke callback
    if (this.config.onDelta) {
      await this.config.onDelta(delta);
    }
  }

  /**
   * Handle calendar event change from remote
   */
  private async handleCalendarChange(
    payload: RealtimePostgresChangesPayload<SyncableEntity>
  ): Promise<void> {
    if (payload.eventType === "DELETE") {
      return;
    }

    const newData = payload.new as SyncableEntity;

    const delta: DeltaChange = {
      entity_type: "calendar_event",
      entity_id: newData.id,
      operation: payload.eventType,
      changed_fields: {},
      vector_clock: newData.sync_meta.vector_clock,
      timestamp: Date.now(),
    };

    if (this.config.onDelta) {
      await this.config.onDelta(delta);
    }
  }

  /**
   * Handle task change from remote
   */
  private async handleTaskChange(
    payload: RealtimePostgresChangesPayload<SyncableEntity>
  ): Promise<void> {
    if (payload.eventType === "DELETE") {
      return;
    }

    const newData = payload.new as SyncableEntity;

    const delta: DeltaChange = {
      entity_type: "task",
      entity_id: newData.id,
      operation: payload.eventType,
      changed_fields: {},
      vector_clock: newData.sync_meta.vector_clock,
      timestamp: Date.now(),
    };

    if (this.config.onDelta) {
      await this.config.onDelta(delta);
    }
  }

  /**
   * Handle sync change log entry
   */
  private async handleChangeLog(payload: any): Promise<void> {
    const change = payload.new;

    // Check for conflicts
    if (change.has_conflict) {
      // Fetch full conflict details
      const { data: conflict } = await this.supabaseClient
        .from("sync_conflicts")
        .select("*")
        .eq("id", change.conflict_id)
        .single();

      if (conflict && this.config.onConflict) {
        await this.config.onConflict(conflict);
      }
    }
  }

  /**
   * Handle presence changes
   */
  private async handlePresenceChange(payload: any): Promise<void> {
    // Update device presence
    const presence = payload.new;
    console.log(`Device online: ${presence.device_id} (${presence.platform})`);
  }

  /**
   * Apply local change and sync to remote
   */
  async applyLocalChange(change: LocalChange): Promise<void> {
    // Update vector clock
    const vectorClock = this.vectorClocks.incrementClock(
      this.config.deviceId
    );

    // If offline, queue the change
    if (this.isOffline) {
      this.offlineQueue.push(change);
      return;
    }

    try {
      // Send change to remote
      const { error } = await this.supabaseClient
        .from("sync_change_log")
        .insert({
          user_id: this.config.userId,
          device_id: this.config.deviceId,
          entity_type: change.entity_type,
          entity_id: change.entity_id,
          operation: change.operation,
          changed_fields: change.data,
          vector_clock: vectorClock,
          content_hash: this.hashContent(change.data),
          created_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to apply local change:", error);
      // Queue for retry
      this.offlineQueue.push(change);
    }
  }

  /**
   * Handle going online
   */
  private async handleOnline(): Promise<void> {
    this.isOffline = false;
    this.updateConnectionStatus("connected");

    // Sync queued changes
    await this.syncOfflineQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOffline = true;
    this.updateConnectionStatus("disconnected");
  }

  /**
   * Sync offline queue to server
   */
  private async syncOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const change of queue) {
      try {
        await this.applyLocalChange(change);
      } catch (error) {
        console.error("Failed to sync offline change:", error);
        this.offlineQueue.push(change);
      }
    }
  }

  /**
   * Update user presence
   */
  private async updatePresence(): Promise<void> {
    await this.supabaseClient.from("sync_presence").upsert({
      user_id: this.config.userId,
      device_id: this.config.deviceId,
      platform: "web",
      status: "online",
      current_context: "app",
      app_version: "2026.1",
      last_seen: new Date().toISOString(),
    });
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(
    status: "connected" | "disconnected"
  ): void {
    this.connectionStatus = status;
    if (this.config.onConnectionChange) {
      this.config.onConnectionChange(status);
    }
  }

  /**
   * Compute changed fields between old and new
   */
  private computeChangedFields(
    oldData: SyncableEntity | null,
    newData: SyncableEntity
  ): Record<string, unknown> {
    if (!oldData) {
      return newData.data;
    }

    const changed: Record<string, unknown> = {};

    for (const [key, newValue] of Object.entries(newData.data)) {
      const oldValue = oldData.data[key];
      if (oldValue !== newValue) {
        changed[key] = newValue;
      }
    }

    return changed;
  }

  /**
   * Hash content for integrity checking
   */
  private hashContent(data: Record<string, unknown>): string {
    // In real implementation, use SHA256
    return JSON.stringify(data);
  }

  /**
   * Get conflict statistics
   */
  getConflictStatistics() {
    return this.conflictTracker.getStatistics();
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.unsubscribe();
    }
    this.channels.clear();
  }
}

/**
 * React Hook for Sync Client
 */
export function useSyncClient(userId: string, deviceId?: string) {
  const [status, setStatus] = React.useState<"connected" | "disconnected">(
    "disconnected"
  );
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);

  const client = React.useMemo(() => {
    return new RealtimeSyncClient({
      userId,
      deviceId: deviceId || generateDeviceId(),
      supabaseUrl: process.env.REACT_APP_SUPABASE_URL!,
      supabaseKey: process.env.REACT_APP_SUPABASE_KEY!,
      onDelta: (delta) => {
        // Handle delta change
        console.log("Delta received:", delta);
        return Promise.resolve();
      },
      onConflict: (conflict) => {
        setConflicts((prev) => [...prev, conflict]);
        return Promise.resolve();
      },
      onConnectionChange: setStatus,
    });
  }, [userId, deviceId]);

  React.useEffect(() => {
    client.initialize();
    return () => {
      client.cleanup();
    };
  }, [client]);

  return { status, conflicts, client };
}

/**
 * Generate unique device ID
 */
function generateDeviceId(): string {
  const stored = localStorage.getItem("__deviceId");
  if (stored) return stored;

  const deviceId = `web-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("__deviceId", deviceId);
  return deviceId;
}

// Import React for hook usage
import * as React from "react";
