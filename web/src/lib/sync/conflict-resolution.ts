/**
 * Conflict Resolution for Multi-Device Synchronization
 *
 * Handles detection and resolution of concurrent modifications across devices
 * using vector clocks and multiple resolution strategies.
 */

/**
 * Vector clock for causality tracking
 * Maps device ID to logical timestamp
 */
export interface VectorClock {
  [deviceId: string]: number;
}

/**
 * Syncable entity with metadata
 */
export interface SyncableEntity {
  id: string;
  data: Record<string, unknown>;
  sync_meta: {
    vector_clock: VectorClock;
    last_modified_at: string;
    last_modified_by: string;
    last_modified_device: "web" | "ios" | "android";
    parent_version?: string;
    has_conflict: boolean;
  };
  content_hash: string;
}

/**
 * Conflict type detected during merge
 */
export interface Conflict {
  type: "concurrent_modification" | "version_mismatch" | "field_conflict";
  local: SyncableEntity;
  remote: SyncableEntity;
  commonAncestor?: SyncableEntity;
  conflictedFields?: string[];
  severity: "warning" | "critical";
}

/**
 * Resolution strategy for conflicts
 */
export type ResolutionStrategy =
  | "last_write_wins"
  | "three_way_merge"
  | "set_union"
  | "manual";

/**
 * Conflict Resolution Engine
 * Handles detection and merging of concurrent modifications
 */
export class ConflictResolutionEngine {
  /**
   * Detect if two modifications are concurrent (neither causally ordered)
   */
  static isClockConcurrent(local: VectorClock, remote: VectorClock): boolean {
    const allDevices = new Set([...Object.keys(local), ...Object.keys(remote)]);

    let localDominates = true;
    let remoteDominates = true;

    for (const device of allDevices) {
      const localTs = local[device] ?? 0;
      const remoteTs = remote[device] ?? 0;

      if (localTs < remoteTs) localDominates = false;
      if (remoteTs < localTs) remoteDominates = false;
    }

    // Concurrent if neither dominates
    return !localDominates && !remoteDominates;
  }

  /**
   * Check if one clock causally precedes another
   */
  static happensBefore(
    clock1: VectorClock,
    clock2: VectorClock
  ): boolean {
    const allDevices = new Set([
      ...Object.keys(clock1),
      ...Object.keys(clock2),
    ]);

    let atLeastOneLess = false;

    for (const device of allDevices) {
      const ts1 = clock1[device] ?? 0;
      const ts2 = clock2[device] ?? 0;

      if (ts1 > ts2) return false; // clock1 doesn't happen before clock2
      if (ts1 < ts2) atLeastOneLess = true;
    }

    return atLeastOneLess;
  }

  /**
   * Detect conflict between local and remote modifications
   */
  static detectConflict(
    local: SyncableEntity,
    remote: SyncableEntity,
    commonAncestor?: SyncableEntity
  ): Conflict | null {
    // No conflict if content is identical
    if (local.content_hash === remote.content_hash) {
      return null;
    }

    const localClock = local.sync_meta.vector_clock;
    const remoteClock = remote.sync_meta.vector_clock;

    // Check if clocks are concurrent
    if (this.isClockConcurrent(localClock, remoteClock)) {
      return {
        type: "concurrent_modification",
        local,
        remote,
        commonAncestor,
        severity: "critical",
      };
    }

    // Check for version mismatch
    if (
      local.sync_meta.parent_version !==
      remote.sync_meta.parent_version
    ) {
      return {
        type: "version_mismatch",
        local,
        remote,
        commonAncestor,
        severity: "warning",
      };
    }

    return null;
  }

  /**
   * Find conflicted fields by comparing old/new values
   */
  static findConflictedFields(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
    ancestor?: Record<string, unknown>
  ): string[] {
    const conflictedFields: string[] = [];
    const allKeys = new Set([
      ...Object.keys(local),
      ...Object.keys(remote),
      ...(ancestor ? Object.keys(ancestor) : []),
    ]);

    for (const key of allKeys) {
      const localVal = local[key];
      const remoteVal = remote[key];
      const ancestorVal = ancestor?.[key];

      // Both modified differently from ancestor
      if (
        ancestor &&
        localVal !== ancestorVal &&
        remoteVal !== ancestorVal &&
        localVal !== remoteVal
      ) {
        conflictedFields.push(key);
      }
      // Only check if different between local and remote
      else if (localVal !== remoteVal) {
        conflictedFields.push(key);
      }
    }

    return conflictedFields;
  }

  /**
   * Resolve conflict using specified strategy
   */
  static async resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Promise<SyncableEntity> {
    switch (strategy) {
      case "last_write_wins":
        return this.resolveLWW(conflict);

      case "three_way_merge":
        if (!conflict.commonAncestor) {
          throw new Error(
            "Three-way merge requires commonAncestor"
          );
        }
        return this.resolveThreeWayMerge(conflict);

      case "set_union":
        return this.resolveSetUnion(conflict);

      case "manual":
        throw new ConflictRequiresManualResolution(conflict);

      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  /**
   * Last-Write-Wins: Keep the version with most recent modification time
   */
  private static resolveLWW(conflict: Conflict): SyncableEntity {
    const localTime = new Date(
      conflict.local.sync_meta.last_modified_at
    ).getTime();
    const remoteTime = new Date(
      conflict.remote.sync_meta.last_modified_at
    ).getTime();

    const winner = localTime >= remoteTime
      ? conflict.local
      : conflict.remote;

    return {
      ...winner,
      sync_meta: {
        ...winner.sync_meta,
        has_conflict: false,
      },
    };
  }

  /**
   * Three-Way Merge: Combine changes from both branches
   * Detects non-conflicting changes that can be merged safely
   */
  private static resolveThreeWayMerge(conflict: Conflict): SyncableEntity {
    if (!conflict.commonAncestor) {
      throw new Error("Three-way merge requires commonAncestor");
    }

    const merged: Record<string, unknown> = { ...conflict.commonAncestor.data };
    const conflictedFields = this.findConflictedFields(
      conflict.local.data,
      conflict.remote.data,
      conflict.commonAncestor.data
    );

    // Apply non-conflicting changes from both sides
    for (const key of Object.keys(conflict.local.data)) {
      if (!conflictedFields.includes(key)) {
        merged[key] = conflict.local.data[key];
      }
    }

    for (const key of Object.keys(conflict.remote.data)) {
      if (!conflictedFields.includes(key)) {
        merged[key] = conflict.remote.data[key];
      }
    }

    // For conflicted fields, prefer remote (newer modification)
    for (const key of conflictedFields) {
      merged[key] = conflict.remote.data[key];
    }

    return {
      ...conflict.local,
      data: merged,
      sync_meta: {
        ...conflict.remote.sync_meta,
        has_conflict: conflictedFields.length > 0,
      },
    };
  }

  /**
   * Set Union: Merge arrays by taking union of all elements
   */
  private static resolveSetUnion(conflict: Conflict): SyncableEntity {
    const merged: Record<string, unknown> = { ...conflict.local.data };

    for (const [key, remoteValue] of Object.entries(conflict.remote.data)) {
      const localValue = conflict.local.data[key];

      if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        // Union of arrays
        const combined = [
          ...new Set([...localValue, ...remoteValue]),
        ];
        merged[key] = combined;
      } else {
        // Prefer local for non-arrays
        merged[key] = localValue;
      }
    }

    return {
      ...conflict.local,
      data: merged,
      sync_meta: {
        ...conflict.remote.sync_meta,
        has_conflict: false,
      },
    };
  }

  /**
   * Calculate merge statistics
   */
  static calculateMergeStats(
    local: SyncableEntity,
    remote: SyncableEntity,
    merged: SyncableEntity
  ): MergeStatistics {
    const fieldsChanged = Object.keys(merged.data).length;
    const localChanges = Object.keys(local.data).length;
    const remoteChanges = Object.keys(remote.data).length;

    return {
      fieldsChanged,
      fieldsFromLocal: localChanges,
      fieldsFromRemote: remoteChanges,
      mergedAt: new Date(),
    };
  }
}

/**
 * Error thrown when manual resolution is required
 */
export class ConflictRequiresManualResolution extends Error {
  constructor(public conflict: Conflict) {
    super(
      `Conflict requires manual resolution: ${conflict.type}`
    );
  }
}

/**
 * Merge statistics
 */
export interface MergeStatistics {
  fieldsChanged: number;
  fieldsFromLocal: number;
  fieldsFromRemote: number;
  mergedAt: Date;
}

/**
 * Vector Clock Manager
 */
export class VectorClockManager {
  private clocks: Map<string, VectorClock> = new Map();

  /**
   * Increment clock for a device
   */
  incrementClock(deviceId: string): VectorClock {
    const clock = this.clocks.get(deviceId) ?? {};
    clock[deviceId] = (clock[deviceId] ?? 0) + 1;
    this.clocks.set(deviceId, clock);
    return clock;
  }

  /**
   * Merge clocks (take maximum of each device's timestamp)
   */
  mergeClock(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const merged: VectorClock = { ...clock1 };

    for (const [device, ts] of Object.entries(clock2)) {
      merged[device] = Math.max(merged[device] ?? 0, ts);
    }

    return merged;
  }

  /**
   * Get current clock for device
   */
  getClock(deviceId: string): VectorClock {
    return this.clocks.get(deviceId) ?? {};
  }
}

/**
 * Conflict Statistics
 */
export interface ConflictStatistics {
  totalConflicts: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  resolutionMethods: Record<ResolutionStrategy, number>;
  conflictRate: number; // percentage
  averageResolutionTime: number; // ms
}

/**
 * Conflict Tracker
 */
export class ConflictTracker {
  private conflicts: Conflict[] = [];
  private resolutions: Map<string, ResolutionStrategy> = new Map();

  /**
   * Track a detected conflict
   */
  trackConflict(conflict: Conflict): void {
    this.conflicts.push(conflict);
  }

  /**
   * Record conflict resolution
   */
  recordResolution(
    conflictId: string,
    strategy: ResolutionStrategy
  ): void {
    this.resolutions.set(conflictId, strategy);
  }

  /**
   * Get conflict statistics
   */
  getStatistics(): ConflictStatistics {
    const resolved = this.resolutions.size;
    const unresolved = this.conflicts.length - resolved;
    const methods: Record<ResolutionStrategy, number> = {
      last_write_wins: 0,
      three_way_merge: 0,
      set_union: 0,
      manual: 0,
    };

    for (const strategy of this.resolutions.values()) {
      methods[strategy]++;
    }

    return {
      totalConflicts: this.conflicts.length,
      resolvedConflicts: resolved,
      unresolvedConflicts: unresolved,
      resolutionMethods: methods,
      conflictRate:
        this.conflicts.length > 0
          ? (unresolved / this.conflicts.length) * 100
          : 0,
      averageResolutionTime: 0, // Would track actual times
    };
  }
}
