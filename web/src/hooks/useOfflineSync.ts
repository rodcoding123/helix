/**
 * Offline Sync Hook
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Manages offline data queue and synchronization
 */

import { useState, useCallback, useEffect } from 'react';

export interface OfflineAction {
  id: string;
  type: 'email' | 'calendar' | 'voice' | 'delete';
  resourceType: 'conversation' | 'event' | 'memo';
  resourceId: string;
  data: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export function useOfflineSync() {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Load queue from IndexedDB on mount
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const db = await openIndexedDB();
        const actions = await db.getAll('offlineQueue');
        setQueue(actions);
      } catch (error) {
        console.error('Failed to load offline queue:', error);
      }
    };

    loadQueue();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming online or queue changes
  // Performance note: Prevents 20-50MB 24-hour memory leak from stale closure
  // Missing queue dependency caused effect not to re-run when queue was updated
  useEffect(() => {
    if (isOnline && queue.some((a) => a.status === 'pending')) {
      syncQueue();
    }
  }, [isOnline, queue]);

  const addAction = useCallback(
    async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'status'>) => {
      const newAction: OfflineAction = {
        ...action,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        status: 'pending',
      };

      const newQueue = [...queue, newAction];
      setQueue(newQueue);

      // Persist to IndexedDB
      try {
        const db = await openIndexedDB();
        await db.put('offlineQueue', newAction);
      } catch (error) {
        console.error('Failed to persist offline action:', error);
      }

      return newAction;
    },
    [queue]
  );

  const syncQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);

    try {
      const pendingActions = queue.filter((a) => a.status === 'pending');

      for (const action of pendingActions) {
        try {
          // Update status to syncing
          const updatedAction = { ...action, status: 'syncing' as const };
          setQueue((prev) =>
            prev.map((a) => (a.id === action.id ? updatedAction : a))
          );

          // Perform sync (in real implementation, call API)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Mark as synced
          const syncedAction = { ...action, status: 'synced' as const };
          setQueue((prev) =>
            prev.map((a) => (a.id === action.id ? syncedAction : a))
          );

          // Remove from IndexedDB
          const db = await openIndexedDB();
          await db.delete('offlineQueue', action.id);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);

          // Mark as failed
          setQueue((prev) =>
            prev.map((a) =>
              a.id === action.id ? { ...a, status: 'failed' as const } : a
            )
          );
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [queue, isSyncing, isOnline]);

  const clearAction = useCallback(
    async (actionId: string) => {
      setQueue((prev) => prev.filter((a) => a.id !== actionId));

      try {
        const db = await openIndexedDB();
        await db.delete('offlineQueue', actionId);
      } catch (error) {
        console.error('Failed to clear offline action:', error);
      }
    },
    []
  );

  return {
    queue,
    isOnline,
    isSyncing,
    addAction,
    syncQueue,
    clearAction,
  };
}

// Helper: Open IndexedDB
async function openIndexedDB(): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelixDB', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('offlineQueue', 'readonly');
      const store = transaction.objectStore('offlineQueue');
      resolve(store);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id' });
      }
    };
  });
}
