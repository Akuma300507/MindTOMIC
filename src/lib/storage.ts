import type { AppDatabase, Participant, Topic, EventImage } from '../types';

const STORAGE_KEYS = {
  DB: 'm2m_persisted_db',
  DELETED_PARTICIPANTS: 'm2m_deleted_participant_ids',
  DELETED_TOPICS: 'm2m_deleted_topic_ids',
  DELETED_IMAGES: 'm2m_deleted_image_ids',
};

function getStoredSet(key: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, set: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn(`[storage] Failed to save set to ${key}:`, err);
  }
}

export const LEGACY_DEFAULT_IDS = new Set<string>([
  'p-101', 'p-102', 'p-103', 'p-104', 'p-105', 'p-106', 'test-live-offline-projector-uuid',
  'top-1', 'top-2', 'top-3', 'top-4', 'top-5', 'top-6', 'top-7', 'top-8', 'top-9', 'top-10',
  'top-11', 'top-12', 'top-13', 'top-14', 'top-15', 'top-16', 'top-17', 'top-18', 'top-19', 'top-20',
  'top-21', 'top-22', 'top-23', 'top-24', 'top-25',
  'img-1', 'img-2', 'img-3', 'img-4', 'img-5', 'img-6', 'img-7', 'img-8',
]);

export const storageService = {
  /**
   * Load entire database from local browser persistence.
   * Returns null if nothing stored or invalid.
   */
  loadPersistedDatabase(): AppDatabase | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEYS.DB);
      if (!raw) return null;
      const db = JSON.parse(raw) as AppDatabase;
      if (!db || typeof db !== 'object') return null;

      // Filter out any items recorded as deleted by the user or legacy defaults
      const deletedParticipants = getStoredSet(STORAGE_KEYS.DELETED_PARTICIPANTS);
      const deletedTopics = getStoredSet(STORAGE_KEYS.DELETED_TOPICS);
      const deletedImages = getStoredSet(STORAGE_KEYS.DELETED_IMAGES);

      if (Array.isArray(db.participants)) {
        db.participants = db.participants.filter((p) => !deletedParticipants.has(p.id) && !LEGACY_DEFAULT_IDS.has(p.id));
      }
      if (Array.isArray(db.topics)) {
        db.topics = db.topics.filter((t) => !deletedTopics.has(t.id) && !LEGACY_DEFAULT_IDS.has(t.id));
      }
      if (Array.isArray(db.images)) {
        db.images = db.images.filter((img) => !deletedImages.has(img.id) && !LEGACY_DEFAULT_IDS.has(img.id));
      }

      return db;
    } catch (err) {
      console.warn('[storage] Failed to load database from localStorage:', err);
      return null;
    }
  },

  /**
   * Save the entire database snapshot to localStorage.
   */
  savePersistedDatabase(db: AppDatabase): void {
    try {
      if (typeof localStorage === 'undefined' || !db) return;
      localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(db));
    } catch (err) {
      console.warn('[storage] Failed to persist database snapshot to localStorage:', err);
    }
  },

  /**
   * Record a participant as explicitly deleted by the user.
   */
  recordDeletedParticipant(id: string): void {
    const set = getStoredSet(STORAGE_KEYS.DELETED_PARTICIPANTS);
    set.add(id);
    saveStoredSet(STORAGE_KEYS.DELETED_PARTICIPANTS, set);
  },

  /**
   * Record a topic as explicitly deleted by the user.
   */
  recordDeletedTopic(id: string): void {
    const set = getStoredSet(STORAGE_KEYS.DELETED_TOPICS);
    set.add(id);
    saveStoredSet(STORAGE_KEYS.DELETED_TOPICS, set);
  },

  /**
   * Record an image as explicitly deleted by the user.
   */
  recordDeletedImage(id: string): void {
    const set = getStoredSet(STORAGE_KEYS.DELETED_IMAGES);
    set.add(id);
    saveStoredSet(STORAGE_KEYS.DELETED_IMAGES, set);
  },

  /**
   * Clear deletion tracking records (e.g. when resetting or starting a fresh event).
   */
  clearDeletedRecords(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(STORAGE_KEYS.DELETED_PARTICIPANTS);
      localStorage.removeItem(STORAGE_KEYS.DELETED_TOPICS);
      localStorage.removeItem(STORAGE_KEYS.DELETED_IMAGES);
    } catch {}
  },

  /**
   * Reset local storage completely.
   */
  clearAll(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(STORAGE_KEYS.DB);
      this.clearDeletedRecords();
    } catch {}
  },

  /**
   * Reconcile server database with local persistent database.
   * Ensures that user-added participants, topics, and images that exist locally
   * but are missing from the server (e.g. if the server restarted with defaults)
   * are preserved and detected for auto-sync.
   */
  reconcileWithServerState(
    serverDb: AppDatabase,
    localDb: AppDatabase | null
  ): {
    mergedDb: AppDatabase;
    hasLocalAdditions: boolean;
    localAdditions: {
      participants: Participant[];
      topics: Topic[];
      images: EventImage[];
    };
  } {
    if (!localDb) {
      // Still enforce client deletion records against server state
      const deletedParticipants = getStoredSet(STORAGE_KEYS.DELETED_PARTICIPANTS);
      const deletedTopics = getStoredSet(STORAGE_KEYS.DELETED_TOPICS);
      const deletedImages = getStoredSet(STORAGE_KEYS.DELETED_IMAGES);

      const sanitizedDb: AppDatabase = {
        ...serverDb,
        participants: (serverDb.participants || []).filter((p) => !deletedParticipants.has(p.id)),
        topics: (serverDb.topics || []).filter((t) => !deletedTopics.has(t.id)),
        images: (serverDb.images || []).filter((img) => !deletedImages.has(img.id)),
      };

      this.savePersistedDatabase(sanitizedDb);
      return {
        mergedDb: sanitizedDb,
        hasLocalAdditions: false,
        localAdditions: { participants: [], topics: [], images: [] },
      };
    }

    const deletedParticipants = getStoredSet(STORAGE_KEYS.DELETED_PARTICIPANTS);
    const deletedTopics = getStoredSet(STORAGE_KEYS.DELETED_TOPICS);
    const deletedImages = getStoredSet(STORAGE_KEYS.DELETED_IMAGES);

    // Filter server items against deletion records and legacy defaults
    const serverParticipants = (serverDb.participants || []).filter((p) => !deletedParticipants.has(p.id) && !LEGACY_DEFAULT_IDS.has(p.id));
    const serverTopics = (serverDb.topics || []).filter((t) => !deletedTopics.has(t.id) && !LEGACY_DEFAULT_IDS.has(t.id));
    const serverImages = (serverDb.images || []).filter((img) => !deletedImages.has(img.id) && !LEGACY_DEFAULT_IDS.has(img.id));

    const serverParticipantIdMap = new Map(serverParticipants.map((p) => [p.id, p]));
    const serverTopicIdMap = new Map(serverTopics.map((t) => [t.id, t]));
    const serverImageIdMap = new Map(serverImages.map((i) => [i.id, i]));

    // Find any local additions not on server (excluding legacy defaults)
    const localOnlyParticipants: Participant[] = [];
    (localDb.participants || []).forEach((p) => {
      if (!deletedParticipants.has(p.id) && !LEGACY_DEFAULT_IDS.has(p.id) && !serverParticipantIdMap.has(p.id)) {
        localOnlyParticipants.push(p);
      }
    });

    const localOnlyTopics: Topic[] = [];
    (localDb.topics || []).forEach((t) => {
      if (!deletedTopics.has(t.id) && !LEGACY_DEFAULT_IDS.has(t.id) && !serverTopicIdMap.has(t.id)) {
        localOnlyTopics.push(t);
      }
    });

    const localOnlyImages: EventImage[] = [];
    (localDb.images || []).forEach((img) => {
      if (!deletedImages.has(img.id) && !LEGACY_DEFAULT_IDS.has(img.id) && !serverImageIdMap.has(img.id)) {
        localOnlyImages.push(img);
      }
    });

    // Merge: server list + local additions
    const mergedParticipants = [...serverParticipants, ...localOnlyParticipants];
    const mergedTopics = [...serverTopics, ...localOnlyTopics];
    const mergedImages = [...serverImages, ...localOnlyImages];

    const mergedDb: AppDatabase = {
      ...serverDb,
      participants: mergedParticipants,
      topics: mergedTopics,
      images: mergedImages,
    };

    this.savePersistedDatabase(mergedDb);

    const hasLocalAdditions =
      localOnlyParticipants.length > 0 || localOnlyTopics.length > 0 || localOnlyImages.length > 0;

    return {
      mergedDb,
      hasLocalAdditions,
      localAdditions: {
        participants: localOnlyParticipants,
        topics: localOnlyTopics,
        images: localOnlyImages,
      },
    };
  },
};
