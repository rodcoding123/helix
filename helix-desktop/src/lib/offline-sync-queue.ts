/**
 * Offline Sync Queue
 *
 * Manages message queueing, persistence, and automatic syncing when connection restored.
 * Features:
 * - Automatic persistence to localStorage
 * - Exponential backoff retry logic
 * - Optimistic UI updates
 * - Conflict resolution (last-write-wins)
 */

import { Message } from './supabase-desktop-client.js';

// ============================================================================
// Types
// ============================================================================

export interface QueuedOperation {
  id: string;
  type: 'send_message' | 'delete_message' | 'update_message';
  data: Message | { messageId: string; sessionKey: string };
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  queueLength: number;
  isSyncing: boolean;
  lastSyncTime?: number;
  failedCount: number;
}

// ============================================================================
// Offline Sync Queue Class
// ============================================================================

export class OfflineSyncQueue {
  private queue: QueuedOperation[] = [];
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private syncListeners = new Set<(status: SyncStatus) => void>();
  private storageKey = 'helix-offline-queue';

  constructor(private storageEnabled = true) {
    this.loadFromStorage();
    this.setupEventListeners();
  }

  /**
   * Add a message to queue
   */
  async queueMessage(message: Message): Promise<void> {
    const operation: QueuedOperation = {
      id: message.id || crypto.randomUUID(),
      type: 'send_message',
      data: message,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 5,
    };

    this.queue.push(operation);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Remove operation from queue
   */
  removeOperation(operationId: string): void {
    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Get next operation to process
   */
  getNextOperation(): QueuedOperation | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Get all operations
   */
  getAllOperations(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Get sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      isSyncing: this.isSyncing,
      failedCount: this.queue.filter((op) => op.retries >= op.maxRetries).length,
    };
  }

  /**
   * Subscribe to sync status changes
   */
  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    // Call immediately with current status
    listener(this.getStatus());
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Process sync queue (should be called by sync service)
   */
  async processQueue(
    syncFn: (operation: QueuedOperation) => Promise<void>
  ): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || !this.isOnline || this.queue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners();

    let synced = 0;
    let failed = 0;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        await syncFn(operation);
        this.removeOperation(operation.id);
        synced++;
      } catch (err) {
        operation.retries++;

        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, operation.retries), 30000);

        console.error(
          `[sync-queue] Failed to sync operation (attempt ${operation.retries}/${operation.maxRetries}):`,
          err
        );

        if (operation.retries >= operation.maxRetries) {
          console.error(
            `[sync-queue] Operation exceeded max retries, removing from queue:`,
            operation.id
          );
          this.removeOperation(operation.id);
          failed++;
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.isSyncing = false;
    this.saveToStorage();
    this.notifyListeners();

    return { synced, failed };
  }

  /**
   * Clear all queued operations
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  // ==========================================
  // Private: Event Handling & Storage
  // ==========================================

  private setupEventListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOnline(): void {
    this.isOnline = true;
    console.log('[sync-queue] Going online');
    this.notifyListeners();
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log('[sync-queue] Going offline');
    this.notifyListeners();
  }

  private saveToStorage(): void {
    if (!this.storageEnabled) return;

    try {
      const serialized = JSON.stringify(this.queue);
      localStorage.setItem(this.storageKey, serialized);
    } catch (err) {
      console.error('[sync-queue] Failed to save to storage:', err);
    }
  }

  private loadFromStorage(): void {
    if (!this.storageEnabled) return;

    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (serialized) {
        this.queue = JSON.parse(serialized) as QueuedOperation[];
        console.log(`[sync-queue] Loaded ${this.queue.length} operations from storage`);
      }
    } catch (err) {
      console.error('[sync-queue] Failed to load from storage:', err);
      this.queue = [];
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    for (const listener of this.syncListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[sync-queue] Listener error:', err);
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let syncQueue: OfflineSyncQueue | null = null;

export function getOfflineSyncQueue(): OfflineSyncQueue {
  if (!syncQueue) {
    syncQueue = new OfflineSyncQueue(true);
  }
  return syncQueue;
}

export function createOfflineSyncQueue(storageEnabled = true): OfflineSyncQueue {
  syncQueue = new OfflineSyncQueue(storageEnabled);
  return syncQueue;
}
