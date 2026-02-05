/**
 * Gateway Sync Relay
 *
 * Coordinates real-time synchronization between web, iOS, and Android clients.
 * Receives changes from any device, applies to database, and broadcasts to other devices.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatewayWsClient } from "./types.js";

export interface DeltaChange extends Record<string, unknown> {
  entity_type: string;
  entity_id: string;
  operation: string;
  changed_fields: Record<string, unknown>;
  vector_clock: Record<string, number>;
  timestamp: number;
}

export interface ConflictDetected extends Record<string, unknown> {
  conflict_id: string;
  entity_type: string;
  entity_id: string;
  local_version: Record<string, unknown>;
  remote_version: Record<string, unknown>;
  timestamp: number;
}

export interface SyncMessage {
  type:
    | "sync.change"
    | "sync.conflict"
    | "sync.delta"
    | "sync.ack"
    | "sync.error"
    | "sync.resolve_conflict";
  payload?: Record<string, unknown>;
  change_id?: string;
  conflict_id?: string;
  error?: string;
}

/**
 * Relay that synchronizes changes across all connected devices
 */
export class SyncRelay {
  private connectedDevices = new Map<
    string,
    Map<string, GatewayWsClient>
  >();
  private pendingChanges = new Map<string, DeltaChange[]>();
  private conflictTracker = new Map<
    string,
    ConflictDetected
  >();

  constructor(
    private supabaseClient: SupabaseClient,
    private logger: {
      info: (msg: string) => void;
      warn: (msg: string) => void;
      error: (msg: string) => void;
    }
  ) {
    this.setupRealtimeListeners();
  }

  /**
   * Register a device connection
   */
  registerDevice(
    userId: string,
    deviceId: string,
    client: GatewayWsClient
  ): void {
    if (!this.connectedDevices.has(userId)) {
      this.connectedDevices.set(userId, new Map());
    }

    this.connectedDevices.get(userId)!.set(deviceId, client);
    this.logger.info(`Device registered: ${userId}/${deviceId}`);

    // Send pending changes to newly connected device
    this.sendPendingChanges(userId, deviceId);
  }

  /**
   * Unregister a device connection
   */
  unregisterDevice(userId: string, deviceId: string): void {
    this.connectedDevices.get(userId)?.delete(deviceId);
    this.logger.info(`Device unregistered: ${userId}/${deviceId}`);
  }

  /**
   * Handle incoming delta change from a device
   */
  async handleDeltaChange(
    client: GatewayWsClient,
    delta: DeltaChange
  ): Promise<void> {
    const userId = client.userId || '';
    const deviceId = client.deviceId || '';

    try {
      // Increment vector clock for this device
      const vectorClock = this.incrementVectorClock(
        delta.vector_clock,
        deviceId
      );

      // Apply to database
      const result = await this.applyToDatabase(
        delta,
        userId,
        deviceId,
        vectorClock
      );

      // Check for conflicts
      if (result.conflict) {
        const conflict = result.conflict as ConflictDetected;
        this.conflictTracker.set(conflict.conflict_id, conflict);

        // Notify all devices of conflict
        await this.broadcastConflict(userId, conflict);

        // Notify originating device
        this.sendToClient(client, {
          type: "sync.conflict",
          payload: conflict,
        });
      } else {
        // Send ACK to originating device
        this.sendToClient(client, {
          type: "sync.ack",
          change_id: delta.entity_id,
        });
      }

      // Broadcast delta to other devices
      await this.broadcastDelta(userId, delta, deviceId);

      this.logger.info(
        `Processed delta: ${delta.entity_type}:${delta.entity_id} from ${deviceId}`
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to process delta";

      this.sendToClient(client, {
        type: "sync.error",
        error: errorMsg,
      });

      this.logger.error(
        `Failed to handle delta: ${errorMsg}`
      );
    }
  }

  /**
   * Handle conflict resolution from a device
   */
  async handleConflictResolution(
    client: GatewayWsClient,
    conflictId: string,
    resolution: Record<string, unknown>
  ): Promise<void> {
    const userId = client.userId || '';

    try {
      const conflict = this.conflictTracker.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      // Apply resolution to database
      const { data, error } = await this.supabaseClient
        .from("sync_conflicts")
        .update({
          resolution_strategy: "manual",
          resolution_data: resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: client.deviceId,
        })
        .eq("id", conflictId);

      if (error) throw error;

      // Broadcast resolution to all devices
      await this.broadcastResolution(userId, conflictId, resolution);

      // Remove from tracker
      this.conflictTracker.delete(conflictId);

      this.logger.info(`Resolved conflict: ${conflictId}`);
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to resolve conflict";

      this.sendToClient(client, {
        type: "sync.error",
        error: errorMsg,
      });

      this.logger.error(`Failed to resolve conflict: ${errorMsg}`);
    }
  }

  /**
   * Apply delta to database
   */
  private async applyToDatabase(
    delta: DeltaChange,
    userId: string,
    deviceId: string,
    vectorClock: Record<string, number>
  ): Promise<{
    success: boolean;
    conflict?: ConflictDetected;
  }> {
    const tableName = this.getTableName(delta.entity_type);
    const contentHash = this.hashContent(delta.changed_fields);

    try {
      // Get current version
      const { data: current } = await this.supabaseClient
        .from(tableName)
        .select("*")
        .eq("id", delta.entity_id)
        .single();

      // Check for conflict
      if (
        current &&
        current.content_hash &&
        current.content_hash !== contentHash
      ) {
        // Potential conflict - check vector clocks
        const currentClock =
          current.sync_meta?.vector_clock || {};
        const isConflict = !this.isClockCausal(
          vectorClock,
          currentClock
        );

        if (isConflict) {
          // Create conflict record
          const { data: conflictData } = await this.supabaseClient
            .from("sync_conflicts")
            .insert({
              user_id: userId,
              entity_type: delta.entity_type,
              entity_id: delta.entity_id,
              local_version: current,
              remote_version: {
                ...delta.changed_fields,
                sync_meta: { vector_clock: vectorClock },
              },
              has_conflict: true,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          return {
            success: false,
            conflict: {
              conflict_id: conflictData?.id || "",
              entity_type: delta.entity_type,
              entity_id: delta.entity_id,
              local_version: current,
              remote_version: delta.changed_fields,
              timestamp: Date.now(),
            },
          };
        }
      }

      // No conflict - apply the change
      const updateData = {
        ...delta.changed_fields,
        sync_meta: {
          vector_clock: vectorClock,
          last_modified_by: deviceId,
          last_modified_at: new Date().toISOString(),
        },
        content_hash: contentHash,
      };

      const { error } = await this.supabaseClient
        .from(tableName)
        .upsert(updateData)
        .eq("id", delta.entity_id);

      if (error) throw error;

      // Log change
      await this.supabaseClient
        .from("sync_change_log")
        .insert({
          user_id: userId,
          device_id: deviceId,
          entity_type: delta.entity_type,
          entity_id: delta.entity_id,
          operation: delta.operation,
          changed_fields: delta.changed_fields,
          vector_clock: vectorClock,
          content_hash: contentHash,
          applied_at: new Date().toISOString(),
        });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Database update failed: ${error instanceof Error ? error.message : "unknown"}`
      );
      throw error;
    }
  }

  /**
   * Broadcast delta to all other devices for the user
   */
  private async broadcastDelta(
    userId: string,
    delta: DeltaChange,
    excludeDeviceId: string
  ): Promise<void> {
    const userDevices = this.connectedDevices.get(userId);
    if (!userDevices) return;

    const message: SyncMessage = {
      type: "sync.delta",
      payload: delta,
    };

    for (const [deviceId, client] of userDevices.entries()) {
      if (deviceId === excludeDeviceId) continue;
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast conflict to all devices for the user
   */
  private async broadcastConflict(
    userId: string,
    conflict: ConflictDetected
  ): Promise<void> {
    const userDevices = this.connectedDevices.get(userId);
    if (!userDevices) return;

    const message: SyncMessage = {
      type: "sync.conflict",
      payload: conflict,
    };

    for (const client of userDevices.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast conflict resolution to all devices
   */
  private async broadcastResolution(
    userId: string,
    conflictId: string,
    resolution: Record<string, unknown>
  ): Promise<void> {
    const userDevices = this.connectedDevices.get(userId);
    if (!userDevices) return;

    const message: SyncMessage = {
      type: "sync.resolve_conflict",
      conflict_id: conflictId,
      payload: resolution,
    };

    for (const client of userDevices.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Send pending changes to newly connected device
   */
  private async sendPendingChanges(
    userId: string,
    deviceId: string
  ): Promise<void> {
    const pending = this.pendingChanges.get(userId) || [];
    if (pending.length === 0) return;

    const client = this.connectedDevices
      .get(userId)
      ?.get(deviceId);
    if (!client) return;

    for (const delta of pending) {
      this.sendToClient(client, {
        type: "sync.delta",
        payload: delta,
      });
    }

    this.pendingChanges.delete(userId);
  }

  /**
   * Send message to client
   */
  private sendToClient(
    client: GatewayWsClient,
    message: SyncMessage
  ): void {
    try {
      client.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(
        `Failed to send message to client: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  /**
   * Setup realtime listeners for database changes
   */
  private setupRealtimeListeners(): void {
    // Listen for changes from web clients
    this.supabaseClient
      .channel("database-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_change_log",
        },
        (payload) => {
          const change = payload.new as any;
          if (change?.user_id && change?.device_id) {
            const delta: DeltaChange = {
              entity_type: change.entity_type,
              entity_id: change.entity_id,
              operation: change.operation,
              changed_fields: change.changed_fields,
              vector_clock: change.vector_clock,
              timestamp: change.created_at,
            };

            // Queue for connected devices
            if (!this.pendingChanges.has(change.user_id)) {
              this.pendingChanges.set(change.user_id, []);
            }
            this.pendingChanges
              .get(change.user_id)!
              .push(delta);
          }
        }
      )
      .subscribe();
  }

  /**
   * Increment vector clock
   */
  private incrementVectorClock(
    clock: Record<string, number>,
    deviceId: string
  ): Record<string, number> {
    const newClock = { ...clock };
    newClock[deviceId] = (newClock[deviceId] || 0) + 1;
    return newClock;
  }

  /**
   * Check if clock A causally happened before clock B
   */
  private isClockCausal(
    a: Record<string, number>,
    b: Record<string, number>
  ): boolean {
    let atLeastOne = false;

    for (const deviceId in b) {
      const aValue = a[deviceId] || 0;
      const bValue = b[deviceId] || 0;

      if (aValue > bValue) {
        return false; // A happened after B
      }
      if (aValue < bValue) {
        atLeastOne = true;
      }
    }

    return atLeastOne;
  }

  /**
   * Get table name from entity type
   */
  private getTableName(entityType: string): string {
    const mapping: Record<string, string> = {
      email: "emails",
      calendar_event: "calendar_events",
      task: "tasks",
      voice_memo: "voice_memos",
    };
    return mapping[entityType] || entityType;
  }

  /**
   * Hash content for integrity checking
   */
  private hashContent(data: Record<string, unknown>): string {
    return JSON.stringify(data);
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalUsers: number;
    totalDevices: number;
    activeConflicts: number;
  } {
    let totalDevices = 0;

    for (const deviceMap of this.connectedDevices.values()) {
      totalDevices += deviceMap.size;
    }

    return {
      totalUsers: this.connectedDevices.size,
      totalDevices,
      activeConflicts: this.conflictTracker.size,
    };
  }
}

/**
 * Create singleton sync relay instance
 */
let syncRelayInstance: SyncRelay | null = null;

export function initializeSyncRelay(
  supabaseClient: SupabaseClient,
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  }
): SyncRelay {
  if (!syncRelayInstance) {
    syncRelayInstance = new SyncRelay(supabaseClient, logger);
  }
  return syncRelayInstance;
}

export function getSyncRelay(): SyncRelay {
  if (!syncRelayInstance) {
    throw new Error("SyncRelay not initialized");
  }
  return syncRelayInstance;
}
