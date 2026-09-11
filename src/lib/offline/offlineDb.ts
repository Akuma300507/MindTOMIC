/**
 * IndexedDB Persistent Data Layer
 * Mind to Mic Offline-First Architecture
 *
 * Provides resilient browser-side persistence for:
 * 1. sync_queue: Pending records created/modified offline awaiting backend sync.
 * 2. app_cache: Full snapshot of AppDatabase so the app can boot and render offline.
 */

import type { AppDatabase, SyncQueueItem, SyncStatus } from '../../types';

const DB_NAME = 'mindtomic_offline_db';
const DB_VERSION = 1;

const STORE_SYNC_QUEUE = 'sync_queue';
const STORE_APP_CACHE = 'app_cache';
const CACHE_KEY_CURRENT_DB = 'current_db';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or retrieves the singleton IndexedDB connection.
 */
function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Sync Queue Store: Holds pending, syncing, and retryable items
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        queueStore.createIndex('entityType', 'entityType', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 2. App Cache Store: Holds database snapshot for offline boot
      if (!db.objectStoreNames.contains(STORE_APP_CACHE)) {
        db.createObjectStore(STORE_APP_CACHE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('[IndexedDB] Database upgrade blocked by another open tab');
    };
  });

  return dbPromise;
}

/**
 * Saves or updates an item in the persistent sync queue.
 */
export async function saveQueueItem(item: SyncQueueItem): Promise<void> {
  try {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to save queue item:', err);
    throw err;
  }
}

/**
 * Retrieves a single queue item by its unique ID.
 */
export async function getQueueItem(id: string): Promise<SyncQueueItem | undefined> {
  try {
    const db = await getDb();
    return new Promise<SyncQueueItem | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as SyncQueueItem | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to get queue item:', err);
    return undefined;
  }
}

/**
 * Retrieves all items currently pending or failed synchronization, ordered chronologically.
 */
export async function getPendingQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await getDb();
    return new Promise<SyncQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncQueueItem[]) || [];
        // Filter for pending or failed items, ordered oldest first
        const pending = all
          .filter((item) => item.syncStatus === 'pending' || item.syncStatus === 'failed')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(pending);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to read pending queue:', err);
    return [];
  }
}

/**
 * Retrieves all items in the sync queue (regardless of status).
 */
export async function getAllQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await getDb();
    return new Promise<SyncQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as SyncQueueItem[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to get all queue items:', err);
    return [];
  }
}

/**
 * Updates the synchronization status and attempt counter for a queue item.
 */
export async function markQueueItemStatus(
  id: string,
  status: SyncStatus,
  error?: string,
  syncedAt?: string
): Promise<void> {
  try {
    const item = await getQueueItem(id);
    if (!item) return;

    item.syncStatus = status;
    item.lastAttemptAt = new Date().toISOString();
    if (status === 'syncing') {
      item.syncAttempts = (item.syncAttempts || 0) + 1;
    }
    if (status === 'synced') {
      item.syncedAt = syncedAt || new Date().toISOString();
      item.error = undefined;
    }
    if (error) {
      item.error = error;
    }

    await saveQueueItem(item);
  } catch (err) {
    console.error('[offlineDb] Failed to update queue item status:', err);
  }
}

/**
 * Deletes an item from the sync queue (e.g. after successful server commit).
 */
export async function removeQueueItem(id: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to remove queue item:', err);
  }
}

/**
 * Removes all successfully synced items from IndexedDB.
 */
export async function clearSyncedQueue(): Promise<void> {
  try {
    const all = await getAllQueueItems();
    const synced = all.filter((item) => item.syncStatus === 'synced');
    for (const item of synced) {
      await removeQueueItem(item.id);
    }
  } catch (err) {
    console.error('[offlineDb] Failed to clear synced queue:', err);
  }
}

/**
 * Clears the entire sync queue (admin/reset).
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to clear queue:', err);
  }
}

/**
 * Persists a complete snapshot of AppDatabase into IndexedDB.
 * Ensures the app can be refreshed or opened when offline.
 */
export async function saveCachedDb(appDb: AppDatabase): Promise<void> {
  try {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_APP_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_APP_CACHE);
      const req = store.put({
        key: CACHE_KEY_CURRENT_DB,
        data: appDb,
        cachedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to save cached database:', err);
  }
}

/**
 * Retrieves the cached AppDatabase snapshot from IndexedDB.
 */
export async function getCachedDb(): Promise<AppDatabase | null> {
  try {
    const db = await getDb();
    return new Promise<AppDatabase | null>((resolve, reject) => {
      const tx = db.transaction(STORE_APP_CACHE, 'readonly');
      const store = tx.objectStore(STORE_APP_CACHE);
      const req = store.get(CACHE_KEY_CURRENT_DB);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data as AppDatabase);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[offlineDb] Failed to get cached database:', err);
    return null;
  }
}
