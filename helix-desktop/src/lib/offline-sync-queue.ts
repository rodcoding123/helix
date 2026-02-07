/**
 * Offline Sync Queue
 *
 * Manages message queueing, persistence, and automatic syncing when connection restored.
 * Features:
 * - Persistent storage (Tauri filesystem or localStorage)
 * - Exponential backoff retry logic
 * - Optimistic UI updates
 * - Conflict resolution (last-write-wins)
 * - Network status detection
 */

import { Message } from './supabase-desktop-client.js';

// ============================================================================
// Storage Backend Detection
// ============================================================================

let tauri: any = null;
let isTauriAvailable = false;

// Try to import Tauri at runtime (browser-safe)
// This is set to false initially and set to true if Tauri is detected
const initTauri = async () => {
  try {
    tauri = await import('@tauri-apps/api/core').catch(() => null);
    isTauriAvailable = !!tauri;
  } catch {
    isTauriAvailable = false;
  }
};

// Start async initialization immediately
initTauri().catch(() => {
  isTauriAvailable = false;
});

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
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing = false;
  private syncListeners = new Set<(status: SyncStatus) => void>();
  private storageKey = 'helix-offline-queue';
  private storageDir = '.helix/queue';
  private storageFile = 'queue.json';
  private usesTauri = false;

  constructor(private storageEnabled = true) {
    this.usesTauri = isTauriAvailable;
    this.setupEventListeners();
    // Load synchronously from localStorage if available
    if (!this.usesTauri && this.storageEnabled) {
      try {
        const serialized = localStorage.getItem(this.storageKey);
        if (serialized) {
          this.queue = JSON.parse(serialized) as QueuedOperation[];
          console.log(`[sync-queue] Loaded ${this.queue.length} operations from localStorage`);
        }
      } catch (err) {
        console.error('[sync-queue] Failed to load from localStorage:', err);
      }
    }
  }

  /**
   * Async initialization (required for Tauri filesystem access)
   */
  async initialize(): Promise<void> {
    if (this.usesTauri && this.storageEnabled) {
      await this.loadFromStorage();
    }
  }

  /**
   * Add a message to queue
   */
  async queueMessage(message: Message): Promise<void> {
    const operation: QueuedOperation = {
      id: message.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `msg-${Date.now()}`),
      type: 'send_message',
      data: message,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 5,
    };

    this.queue.push(operation);
    await this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Remove operation from queue
   */
  async removeOperation(operationId: string): Promise<void> {
    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      await this.saveToStorage();
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
        await this.removeOperation(operation.id);
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
          await this.removeOperation(operation.id);
          failed++;
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.isSyncing = false;
    await this.saveToStorage();
    this.notifyListeners();

    return { synced, failed };
  }

  /**
   * Clear all queued operations
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.saveToStorage();
    this.notifyListeners();
  }

  // ==========================================
  // Private: Event Handling & Storage
  // ==========================================

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

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

  private async saveToStorage(): Promise<void> {
    if (!this.storageEnabled) return;

    try {
      const serialized = JSON.stringify(this.queue);

      if (this.usesTauri && tauri?.fs) {
        // Use Tauri filesystem for persistent storage
        try {
          await tauri.fs.createDir(this.storageDir, { recursive: true });
          const filePath = `${this.storageDir}/${this.storageFile}`;
          await tauri.fs.writeTextFile(filePath, serialized);
          console.log(`[sync-queue] Saved ${this.queue.length} operations to Tauri filesystem`);
        } catch (tauriErr) {
          console.warn('[sync-queue] Tauri save failed, falling back to localStorage:', tauriErr);
          localStorage.setItem(this.storageKey, serialized);
        }
      } else {
        // Fallback to localStorage
        localStorage.setItem(this.storageKey, serialized);
      }
    } catch (err) {
      console.error('[sync-queue] Failed to save to storage:', err);
    }
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.storageEnabled) return;

    try {
      let serialized: string | null = null;

      if (this.usesTauri && tauri?.fs) {
        // Try Tauri filesystem first
        try {
          const filePath = `${this.storageDir}/${this.storageFile}`;
          serialized = await tauri.fs.readTextFile(filePath);
          console.log(`[sync-queue] Loaded from Tauri filesystem`);
        } catch (tauriErr) {
          // File doesn't exist yet or Tauri error - fall back to localStorage
          if (localStorage.getItem(this.storageKey)) {
            console.log('[sync-queue] Tauri load failed, checking localStorage');
            serialized = localStorage.getItem(this.storageKey);
          }
        }
      } else {
        // Use localStorage only
        serialized = localStorage.getItem(this.storageKey);
      }

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
let initializePromise: Promise<void> | null = null;

/**
 * Get or create the singleton instance (with async initialization)
 */
export async function getOfflineSyncQueue(): Promise<OfflineSyncQueue> {
  if (!syncQueue) {
    syncQueue = new OfflineSyncQueue(true);
    initializePromise = syncQueue.initialize();
    await initializePromise;
  } else if (initializePromise) {
    await initializePromise;
  }
  return syncQueue;
}

/**
 * Create a new instance with async initialization
 */
export async function createOfflineSyncQueue(storageEnabled = true): Promise<OfflineSyncQueue> {
  syncQueue = new OfflineSyncQueue(storageEnabled);
  initializePromise = syncQueue.initialize();
  await initializePromise;
  return syncQueue;
}

/**
 * Get the sync queue synchronously (may not have loaded yet if Tauri)
 * Use getOfflineSyncQueue() instead for guaranteed initialization
 */
export function getOfflineSyncQueueSync(): OfflineSyncQueue {
  if (!syncQueue) {
    syncQueue = new OfflineSyncQueue(true);
    // Initialize asynchronously in the background
    syncQueue.initialize().catch((err) => {
      console.error('[sync-queue] Failed to initialize:', err);
    });
  }
  return syncQueue;
}
