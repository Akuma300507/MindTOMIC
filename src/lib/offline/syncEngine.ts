/**
 * Background Synchronization Engine
 * Mind to Mic Offline-First Architecture
 *
 * Coordinates:
 * - Online / Offline detection
 * - Background queue processing
 * - Batch synchronization with backend API
 * - Exponential backoff and retry logic
 * - Reactive state broadcasting for UI indicators
 */

import type { SyncQueueItem, SyncStatus, SyncBatchRequest, SyncBatchResponse, AppDatabase } from '../../types';
import { getDeviceId } from './device';
import {
  saveQueueItem,
  getPendingQueue,
  removeQueueItem,
  markQueueItemStatus,
} from './offlineDb';

export type SyncEngineState = {
  isOnline: boolean;
  status: 'online' | 'offline' | 'syncing' | 'synced' | 'failed';
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type StateListener = (state: SyncEngineState) => void;
type ServerStateListener = (state: AppDatabase) => void;

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private status: SyncEngineState['status'] = 'online';
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;

  private listeners: Set<StateListener> = new Set();
  private serverStateListeners: Set<ServerStateListener> = new Set();
  private timer: any = null;
  private retryBackoffMs: number = 2000;
  private maxBackoffMs: number = 30000;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      // Initialize count and start periodic checker
      this.refreshPendingCount().then(() => {
        if (this.isOnline && this.pendingCount > 0) {
          this.syncNow();
        }
      });
      this.startPeriodicSync();
    }
  }

  public getState(): SyncEngineState {
    return {
      isOnline: this.isOnline,
      status: this.status,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onServerState(listener: ServerStateListener): () => void {
    this.serverStateListeners.add(listener);
    return () => {
      this.serverStateListeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('[SyncEngine] Listener error:', err);
      }
    });
  }

  private handleOnline() {
    this.isOnline = true;
    console.log('[SyncEngine] Reconnection detected: Network ONLINE');
    this.status = this.pendingCount > 0 ? 'syncing' : 'online';
    this.notify();
    this.syncNow();
  }

  private handleOffline() {
    this.isOnline = false;
    console.log('[SyncEngine] Disconnection detected: Network OFFLINE');
    this.status = 'offline';
    this.notify();
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const items = await getPendingQueue();
      this.pendingCount = items.length;
      if (!this.isOnline) {
        this.status = 'offline';
      } else if (this.pendingCount === 0 && this.status !== 'syncing') {
        this.status = 'synced';
      }
      this.notify();
      return this.pendingCount;
    } catch {
      return this.pendingCount;
    }
  }

  /**
   * Enqueues an item locally first into IndexedDB, then triggers sync if online.
   */
  public async enqueue(item: SyncQueueItem): Promise<void> {
    await saveQueueItem(item);
    await this.refreshPendingCount();

    if (this.isOnline) {
      // Trigger background sync without blocking the caller
      this.syncNow().catch((err) => {
        console.warn('[SyncEngine] Background sync deferred:', err);
      });
    } else {
      this.status = 'offline';
      this.notify();
    }
  }

  /**
   * Immediately processes the synchronization queue.
   */
  public async syncNow(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
      this.notify();
      return;
    }

    this.isSyncing = true;
    this.status = 'syncing';
    this.notify();

    try {
      const pendingItems = await getPendingQueue();
      if (pendingItems.length === 0) {
        this.status = this.isOnline ? 'synced' : 'offline';
        this.pendingCount = 0;
        this.isSyncing = false;
        this.notify();
        return;
      }

      console.log(`[SyncEngine] Processing sync batch: ${pendingItems.length} items`);

      // Mark all in progress
      for (const item of pendingItems) {
        await markQueueItemStatus(item.id, 'syncing');
      }

      const requestBody: SyncBatchRequest = {
        deviceId: getDeviceId(),
        items: pendingItems,
      };

      const response = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SyncBatchResponse = await response.json();

      if (data.success && Array.isArray(data.syncedIds)) {
        // Remove successfully committed records from IndexedDB queue
        for (const id of data.syncedIds) {
          await removeQueueItem(id);
        }

        // Reset retry backoff on success
        this.retryBackoffMs = 2000;
        this.lastSyncedAt = new Date().toISOString();
        this.lastError = null;

        await this.refreshPendingCount();

        if (this.pendingCount === 0) {
          this.status = 'synced';
        } else {
          this.status = 'syncing';
        }

        // Notify server state listeners if state was returned
        if (data.state) {
          this.serverStateListeners.forEach((fn) => {
            try {
              fn(data.state!);
            } catch (err) {
              console.error('[SyncEngine] ServerStateListener error:', err);
            }
          });
        }
      } else {
        throw new Error(data.message || 'Batch synchronization reported failure');
      }
    } catch (err: any) {
      console.warn('[SyncEngine] Sync attempt failed:', err?.message || err);
      this.lastError = err?.message || 'Network sync error';

      // Mark pending items as failed so they will be retried
      const items = await getPendingQueue();
      for (const item of items) {
        await markQueueItemStatus(item.id, 'failed', this.lastError || undefined);
      }

      await this.refreshPendingCount();
      this.status = this.isOnline ? 'failed' : 'offline';

      // Exponential backoff
      this.retryBackoffMs = Math.min(this.retryBackoffMs * 2, this.maxBackoffMs);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  private startPeriodicSync() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isOnline && this.pendingCount > 0 && !this.isSyncing) {
        this.syncNow();
      }
    }, 12000);
  }

  public destroy() {
    if (this.timer) clearInterval(this.timer);
    this.listeners.clear();
    this.serverStateListeners.clear();
  }
}

// Singleton SyncEngine instance
export const syncEngine = new SyncEngine();
