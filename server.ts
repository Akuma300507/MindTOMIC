import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { MongoClient } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';

// Types representation for server
import type {
  AppDatabase,
  Participant,
  Topic,
  EventImage,
  CustomFieldDefinition,
  EventSettings,
  EventLog,
  LiveSyncState,
  StationState,
  StationStatus,
  StationWheelSpin,
  ProjectorDevice,
} from './src/types';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

// Cloudinary Configuration
if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  console.log('[cloudinary] Configured for persistent cloud media storage');
}

// MongoDB Database Client (Atlas)
let mongoDb: any = null;

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded image files and public assets statically
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(process.cwd(), 'public')));

// Initial default seed
const defaultSettings: EventSettings = {
  event: {
    name: 'MIND TO MIC',
    tagline: 'THINK. SPEAK. EXPRESS.',
    logoText: 'MIND TO MIC',
  },
  round1: {
    prepEnabled: true,
    prepTimeSeconds: 30,
    speechTimeSeconds: 120,
    buzzerEnabled: true,
    buzzerTimeSeconds: 120,
    allowImageReuse: false,
    warningBuzzerEnabled: true,
    warningTimeSeconds: 30,
    synchronizedSlots: true,
  },
  round2: {
    prepEnabled: false, // Round 2 starts speaking immediately
    prepTimeSeconds: 0,
    speechTimeSeconds: 120,
    buzzerEnabled: true,
    buzzerTimeSeconds: 120,
    activeWheelTopicCount: 16,
    topicReuseAllowed: false,
    warningBuzzerEnabled: true,
    warningTimeSeconds: 30,
    synchronizedSlots: true,
  },
  round3: {
    prepEnabled: false,
    prepTimeSeconds: 0,
    speechTimeSeconds: 120,
    buzzerEnabled: true,
    buzzerTimeSeconds: 120,
    warningBuzzerEnabled: true,
    warningTimeSeconds: 30,
  },
  buzzer: {
    laptopBuzzer: true,
    mobileBuzzer: true,
    volume: 90,
    sound: 'horn',
    autoBuzzerOnZero: true,
    prepSound: 'dual_alert',
    prepVolume: 85,
    warningSound: 'double_beep',
    warningVolume: 85,
  },
  stations: [
    { id: 'station-a', name: 'Station A', location: 'Room 101', handlerName: 'Alex Rivera', handlerPhone: '+1 (555) 234-5678', handlerRole: 'Stage Lead', handlerStatus: 'ready' },
    { id: 'station-b', name: 'Station B', location: 'Room 102', handlerName: 'Maya Lin', handlerPhone: '+1 (555) 345-6789', handlerRole: 'Timekeeper', handlerStatus: 'ready' },
    { id: 'station-c', name: 'Station C', location: 'Room 103', handlerName: 'Liam Carter', handlerPhone: '+1 (555) 456-7890', handlerRole: 'Coordinator', handlerStatus: 'ready' },
    { id: 'station-d', name: 'Station D', location: 'Auditorium Stage', handlerName: 'Sophia Chen', handlerPhone: '+1 (555) 567-8901', handlerRole: 'Stage Manager', handlerStatus: 'ready' },
  ],
};

const defaultCustomFields: CustomFieldDefinition[] = [];

// Blacklist of legacy sample data IDs to prevent accidental resurrection from browser local caches
const LEGACY_DEFAULT_IDS = new Set<string>([
  'p-101', 'p-102', 'p-103', 'p-104', 'p-105', 'p-106', 'test-live-offline-projector-uuid',
  'top-1', 'top-2', 'top-3', 'top-4', 'top-5', 'top-6', 'top-7', 'top-8', 'top-9', 'top-10',
  'top-11', 'top-12', 'top-13', 'top-14', 'top-15', 'top-16', 'top-17', 'top-18', 'top-19', 'top-20',
  'top-21', 'top-22', 'top-23', 'top-24', 'top-25',
  'img-1', 'img-2', 'img-3', 'img-4', 'img-5', 'img-6', 'img-7', 'img-8',
]);

const defaultParticipants: Participant[] = [];
const defaultTopics: Topic[] = [];
const defaultImages: EventImage[] = [];
const defaultHistory: EventLog[] = [];

function isParticipantCheckedIn(p?: Participant | null): boolean {
  if (!p) return false;
  if (p.checkedIn === false) return false;
  if (p.status === 'absent') return false;
  return Boolean(p.checkedIn === true || p.status === 'checked_in' || p.checkedInAt);
}

function createInitialStationState(
  id: string,
  name: string,
  location: string,
  handlerName?: string | null,
  handlerPhone?: string | null,
  handlerRole?: string | null,
  handlerStatus?: 'active' | 'ready' | 'on_break' | 'busy' | 'away',
  handlerNotes?: string | null
): StationState {
  return {
    id,
    name,
    location,
    currentRound: 1,
    status: 'WAITING',
    activeParticipantId: null,
    activeParticipant: null,
    selectedImageId: null,
    selectedImage: null,
    imageRotation: 0,
    selectedTopicId: null,
    selectedTopic: null,
    wheelSpin: null,
    timerMode: 'idle',
    timerStatus: 'idle',
    timerDuration: 120,
    timerStartTime: null,
    timerAccumulatedMs: 0,
    timerStopTime: null,
    timerTotalSeconds: 120,
    timerRemainingSeconds: 120,
    isTimerRunning: false,
    timerStartedAt: null,
    timerEndsAt: null,
    buzzerTimeSeconds: 120,
    buzzerPlayed: false,
    isOvertime: false,
    overtimeSeconds: 0,
    controllerDeviceId: null,
    controllerDeviceName: null,
    claimedByDeviceId: null,
    claimedByDeviceName: null,
    lastHeartbeat: 0,
    handlerName: handlerName || null,
    handlerPhone: handlerPhone || null,
    handlerRole: handlerRole || null,
    handlerStatus: handlerStatus || 'ready',
    handlerNotes: handlerNotes || null,
  };
}

function getInitialDatabase(): AppDatabase {
  const stations: Record<string, StationState> = {};
  (defaultSettings.stations || []).forEach((s) => {
    stations[s.id] = createInitialStationState(
      s.id,
      s.name,
      s.location,
      s.handlerName,
      s.handlerPhone,
      s.handlerRole,
      s.handlerStatus,
      s.handlerNotes
    );
  });

  return {
    participants: defaultParticipants,
    customFields: defaultCustomFields,
    topics: defaultTopics,
    images: defaultImages,
    round1Results: [],
    round2Results: [],
    round3Results: [],
    settings: defaultSettings,
    history: defaultHistory,
    stations,
    synchronizedSlots: {
      round1: {},
      round2: {},
    },
    liveSync: {
      currentRound: 1,
      activeParticipantId: null,
      timerMode: 'idle',
      timerRemainingSeconds: 120,
      timerTotalSeconds: 120,
      isTimerRunning: false,
      stationStates: stations,
    },
  };
}

let db: AppDatabase;

// Synchronous persistence for all mutations (Atomic write to tmp -> db.json and db.backup.json)
let saveTimeout: NodeJS.Timeout | null = null;
function persistDBSync() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    if (db && db.stations) {
      db.liveSync.stationStates = db.stations;
    }
    const jsonStr = JSON.stringify(db, null, 2);
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
    fs.copyFileSync(tmpFile, DB_FILE);
    try {
      fs.copyFileSync(tmpFile, DB_BACKUP_FILE);
    } catch {}
    try {
      fs.unlinkSync(tmpFile);
    } catch {}

    if (mongoDb) {
      mongoDb
        .collection('app_state')
        .updateOne(
          { _id: 'current_state' },
          { $set: { data: db, updatedAt: new Date() } },
          { upsert: true }
        )
        .catch((e: any) => console.error('[mongodb] sync persist error:', e));
    }
  } catch (err) {
    console.error('Failed to persist database synchronously:', err);
  }
}

// Immediate persistence: ensures any user mutation is immediately written to disk
function persistDB() {
  persistDBSync();
}

// Process exit handlers to ensure state is flushed on shutdown
process.on('SIGINT', () => {
  console.log('[server] Interrupted (SIGINT), flushing database...');
  persistDBSync();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[server] Terminated (SIGTERM), flushing database...');
  persistDBSync();
  process.exit(0);
});
process.on('beforeExit', () => {
  persistDBSync();
});

try {
  let loaded = false;
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        db = JSON.parse(raw);
        loaded = true;
      }
    } catch (parseErr) {
      console.warn('Warning: db.json was unreadable or corrupted, attempting backup recovery:', parseErr);
    }
  }

  // Fallback to backup if primary db.json was missing or corrupted
  if (!loaded && fs.existsSync(DB_BACKUP_FILE)) {
    try {
      const raw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        db = JSON.parse(raw);
        loaded = true;
        console.log('[storage] Successfully recovered database from db.backup.json!');
      }
    } catch (backupErr) {
      console.error('[storage] Backup file also failed to parse:', backupErr);
    }
  }

  if (loaded) {
    // Ensure all keys exist while strictly preserving existing user data
    if (!db.settings) db.settings = defaultSettings;
    if (!db.settings.stations || db.settings.stations.length === 0) {
      db.settings.stations = defaultSettings.stations;
    }
    if (!Array.isArray(db.participants)) db.participants = [];
    else db.participants = db.participants.filter((p) => !LEGACY_DEFAULT_IDS.has(p.id));

    if (!Array.isArray(db.topics)) db.topics = [];
    else db.topics = db.topics.filter((t) => !LEGACY_DEFAULT_IDS.has(t.id));

    if (!Array.isArray(db.images)) db.images = [];
    else db.images = db.images.filter((img) => !LEGACY_DEFAULT_IDS.has(img.id));

    if (!Array.isArray(db.customFields)) db.customFields = defaultCustomFields;
    if (!Array.isArray(db.round1Results)) db.round1Results = [];
    if (!Array.isArray(db.round2Results)) db.round2Results = [];
    if (!Array.isArray(db.round3Results)) db.round3Results = [];
    if (!Array.isArray(db.history)) db.history = [];
    else db.history = db.history.filter((h) => !h.participantId || !LEGACY_DEFAULT_IDS.has(h.participantId));
    if (!db.stations) db.stations = {};

    if (!db.synchronizedSlots) {
      db.synchronizedSlots = { round1: {}, round2: {} };
    } else {
      if (!db.synchronizedSlots.round1) db.synchronizedSlots.round1 = {};
      if (!db.synchronizedSlots.round2) db.synchronizedSlots.round2 = {};
    }
    if (db.settings.round1.synchronizedSlots === undefined) {
      db.settings.round1.synchronizedSlots = true;
    }
    if (db.settings.round2.synchronizedSlots === undefined) {
      db.settings.round2.synchronizedSlots = true;
    }

    // Ensure all configured stations have station states
    (db.settings.stations || []).forEach((s) => {
      if (!db.stations![s.id]) {
        db.stations![s.id] = createInitialStationState(s.id, s.name, s.location);
      } else {
        // Sync name & location
        db.stations![s.id].name = s.name;
        db.stations![s.id].location = s.location;
      }
    });

    // Ensure staged participants are valid
    if (db.stations) {
      Object.values(db.stations).forEach((station) => {
        if (station.activeParticipantId) {
          const p = db.participants.find((item) => item.id === station.activeParticipantId);
          if (!p) {
            station.activeParticipantId = null;
            station.activeParticipant = null;
          } else {
            station.activeParticipant = { ...p };
          }
        } else if (station.activeParticipant) {
          const p = db.participants.find((item) => item.id === station.activeParticipant?.id);
          if (!p) {
            station.activeParticipantId = null;
            station.activeParticipant = null;
          } else {
            station.activeParticipant = { ...p };
          }
        }
      });
    }

    if (db.liveSync?.activeParticipantId) {
      const p = db.participants.find((item) => item.id === db.liveSync.activeParticipantId);
      if (!p || !isParticipantCheckedIn(p)) {
        db.liveSync.activeParticipantId = null;
      }
    }

    // Ensure participants have qualification defaults
    db.participants.forEach((p) => {
      if (!p.round1Qualified) p.round1Qualified = 'pending';
      if (!p.round2Qualified) p.round2Qualified = 'pending';
      if (!p.round3Qualified) p.round3Qualified = 'pending';
    });

    // Ensure all images have imageId and name is set to ID (no titles revealed)
    db.images.forEach((img, idx) => {
      if (!img.imageId) {
        img.imageId = `IMG-${String(idx + 1).padStart(3, '0')}`;
      }
      img.name = img.imageId;
    });

    // Ensure all topics have topicId
    db.topics.forEach((t, idx) => {
      if (!t.topicId) {
        t.topicId = `TOP-${String(idx + 1).padStart(3, '0')}`;
      }
    });

    // Clean up redundant default phone number custom field
    if (db.customFields) {
      db.customFields = db.customFields.filter(
        (cf) => cf.id !== 'f_phone' && cf.key !== 'phone' && cf.name?.toLowerCase() !== 'phone number'
      );
    }

    // Strip stationId and stationName from images and topics so all media is universal
    if (Array.isArray(db.images)) {
      db.images.forEach((img: any) => {
        delete img.stationId;
        delete img.stationName;
      });
    }
    if (Array.isArray(db.topics)) {
      db.topics.forEach((t: any) => {
        delete t.stationId;
        delete t.stationName;
      });
    }

    // Ensure warning buzzer defaults exist on loaded db settings
    if (db.settings) {
      ['round1', 'round2', 'round3'].forEach((rnd) => {
        const r = (db.settings as any)[rnd];
        if (r) {
          if (r.warningBuzzerEnabled === undefined) r.warningBuzzerEnabled = true;
          if (r.warningTimeSeconds === undefined) r.warningTimeSeconds = 30;
        }
      });
      if (db.settings.buzzer) {
        if (!db.settings.buzzer.warningSound) db.settings.buzzer.warningSound = 'double_beep';
        if (db.settings.buzzer.warningVolume === undefined) db.settings.buzzer.warningVolume = 85;
      }
    }

    if (!db.liveSync) db.liveSync = getInitialDatabase().liveSync;
    db.liveSync.stationStates = db.stations;
    persistDBSync();
  } else {
    db = getInitialDatabase();
    persistDBSync();
  }
} catch (err) {
  console.error('Error loading db.json, recovering initial defaults', err);
  db = getInitialDatabase();
  persistDBSync();
}

// Helper to initialize and sync with MongoDB Atlas if configured
async function initMongo() {
  if (!process.env.MONGODB_URI) {
    console.log('[storage] Running with local filesystem storage (data/db.json)');
    return;
  }
  try {
    console.log('[mongodb] Connecting to MongoDB Atlas...');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    mongoDb = client.db('mindtomic');
    console.log('[mongodb] Connected successfully to MongoDB Atlas');

    const stateDoc = await mongoDb.collection('app_state').findOne({ _id: 'current_state' });
    if (stateDoc && stateDoc.data) {
      db = stateDoc.data;
      if (Array.isArray(db.participants)) {
        db.participants = db.participants.filter((p) => !LEGACY_DEFAULT_IDS.has(p.id));
      }
      if (Array.isArray(db.topics)) {
        db.topics = db.topics.filter((t) => !LEGACY_DEFAULT_IDS.has(t.id));
        db.topics.forEach((t: any) => {
          delete t.stationId;
          delete t.stationName;
        });
      }
      if (Array.isArray(db.images)) {
        db.images = db.images.filter((img) => !LEGACY_DEFAULT_IDS.has(img.id));
        db.images.forEach((img: any) => {
          delete img.stationId;
          delete img.stationName;
        });
      }
      persistDBSync();
      console.log('[mongodb] Loaded and synchronized cloud state from MongoDB Atlas');
    } else {
      await mongoDb.collection('app_state').updateOne(
        { _id: 'current_state' },
        { $set: { data: db, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log('[mongodb] Initialized cloud state in MongoDB Atlas');
    }
  } catch (err) {
    console.error('[mongodb] Connection failed, continuing with local storage:', err);
  }
}

// SSE clients for real-time mobile buzzer, station rooms, and projector sync
interface SSEClient {
  id: string;
  res: Response;
  type: 'projector' | 'buzzer' | 'organizer' | 'master';
  projectorDeviceId?: string;
  stationId?: string;
  channels: Set<string>;
}
const sseClients: SSEClient[] = [];

// Registry of active connected projector screens
const activeProjectors = new Map<string, ProjectorDevice>();

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client dropped
    }
  });
}

function broadcastToChannel(channel: string, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    if (client.channels.has(channel)) {
      try {
        client.res.write(payload);
      } catch {
        // client dropped
      }
    }
  });
}

function broadcastStationUpdate(stationId: string, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const targetChannel = `station:${stationId}`;
  sseClients.forEach((client) => {
    // Audio isolation: buzzer_trigger must ONLY be sent to clients explicitly listening to THIS station!
    // Never leak audio buzzers across stations or to general master channels!
    if (event === 'buzzer_trigger') {
      if (client.channels.has(targetChannel) || client.stationId === stationId) {
        try {
          client.res.write(payload);
        } catch {
          // client dropped
        }
      }
      return;
    }

    // State, timer, and metadata updates: broadcast to station subscribers, master supervisors, and organizer consoles
    if (
      client.channels.has(targetChannel) ||
      client.channels.has('master') ||
      client.type === 'master' ||
      client.type === 'organizer' ||
      client.channels.has('global')
    ) {
      try {
        client.res.write(payload);
      } catch {
        // client dropped
      }
    }
  });
}

function broadcastToProjector(projectorDeviceId: string, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const targetChannel = `projector:${projectorDeviceId}`;
  sseClients.forEach((client) => {
    if (client.channels.has(targetChannel) || client.projectorDeviceId === projectorDeviceId) {
      try {
        client.res.write(payload);
      } catch {
        // client dropped
      }
    }
  });
}

function broadcastProjectorsList() {
  const list = Array.from(activeProjectors.values());
  const payload = `event: projectors_updated\ndata: ${JSON.stringify({ projectors: list })}\n\n`;
  sseClients.forEach((client) => {
    if (
      client.channels.has('master') ||
      client.type === 'master' ||
      client.type === 'organizer' ||
      client.channels.has('global')
    ) {
      try {
        client.res.write(payload);
      } catch {}
    }
  });
}

// SSE heartbeat to keep connections alive, refresh projector lastPing, and maintain synchronized clock offset
setInterval(() => {
  if (sseClients.length > 0) {
    const now = Date.now();
    broadcastSSE('heartbeat', { serverTime: now });
    activeProjectors.forEach((p) => {
      p.lastPing = now;
    });
  }
}, 10000);

function logAction(action: string, details: string, round?: 'Round 1' | 'Round 2' | 'Round 3' | 'General', participantId?: string, participantName?: string) {
  const newLog: EventLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    action,
    round: round || 'General',
    participantId,
    participantName,
    details,
  };
  db.history.unshift(newLog);
  if (db.history.length > 500) {
    db.history = db.history.slice(0, 500);
  }
  persistDB();
  broadcastSSE('history_updated', newLog);
}

// ================= API ROUTES =================

// High-precision server time endpoint for network clock synchronization
app.get('/api/time', (req: Request, res: Response) => {
  res.json({ serverTime: Date.now() });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), participantsCount: db.participants.length, serverTime: Date.now() });
});

// Full state
app.get('/api/state', (req: Request, res: Response) => {
  res.json(db);
});

// Restore / merge local client additions if missing on server
app.post('/api/sync-restore', (req: Request, res: Response) => {
  try {
    const { participants, topics, images } = req.body;
    let addedCount = 0;

    if (Array.isArray(participants)) {
      const existingIds = new Set(db.participants.map((p) => p.id));
      participants.forEach((p) => {
        if (p && p.id && !existingIds.has(p.id) && !LEGACY_DEFAULT_IDS.has(p.id)) {
          db.participants.push(p);
          existingIds.add(p.id);
          addedCount++;
        }
      });
    }

    if (Array.isArray(topics)) {
      const existingIds = new Set(db.topics.map((t) => t.id));
      topics.forEach((t) => {
        if (t && t.id && !existingIds.has(t.id) && !LEGACY_DEFAULT_IDS.has(t.id)) {
          db.topics.push(t);
          existingIds.add(t.id);
          addedCount++;
        }
      });
    }

    if (Array.isArray(images)) {
      const existingIds = new Set(db.images.map((img) => img.id));
      images.forEach((img) => {
        if (img && img.id && !existingIds.has(img.id) && !LEGACY_DEFAULT_IDS.has(img.id)) {
          db.images.push(img);
          existingIds.add(img.id);
          addedCount++;
        }
      });
    }

    if (addedCount > 0) {
      persistDB();
      if (Array.isArray(participants) && participants.length > 0) {
        broadcastSSE('participants_updated', db.participants);
      }
      if (Array.isArray(topics) && topics.length > 0) {
        broadcastSSE('topics_updated', db.topics);
      }
      if (Array.isArray(images) && images.length > 0) {
        broadcastSSE('images_updated', db.images);
      }
      logAction('State Restored', `Synchronized ${addedCount} locally preserved entity item(s) to server.`);
    }

    res.json({ success: true, addedCount });
  } catch (err: any) {
    console.error('Error in /api/sync-restore:', err);
    res.status(500).json({ error: err.message || 'Failed to sync restore' });
  }
});


// Reset database to completely clean new fresh state (Purge all data)
const handleCompleteDataReset = (req: Request, res: Response) => {
  try {
    // 1. Clean uploaded image files in UPLOADS_DIR (protecting custom logo files)
    if (fs.existsSync(UPLOADS_DIR)) {
      try {
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const file of files) {
          if (file.toLowerCase().includes('logo')) continue;
          try {
            fs.unlinkSync(path.join(UPLOADS_DIR, file));
          } catch {}
        }
      } catch (uploadErr) {
        console.warn('[reset] Error cleaning uploads folder:', uploadErr);
      }
    }

    // 2. Re-initialize database to an empty, fresh slate
    db = getInitialDatabase();
    db.participants = [];
    db.topics = [];
    db.images = [];
    db.round1Results = [];
    db.round2Results = [];
    db.round3Results = [];
    db.history = [];
    db.synchronizedSlots = {
      round1: {},
      round2: {},
    };
    db.liveSync = {
      currentRound: 1,
      activeParticipantId: null,
      timerMode: 'idle',
      timerRemainingSeconds: 120,
      timerTotalSeconds: 120,
      isTimerRunning: false,
      stationStates: db.stations,
    };

    // Ensure all stations are in clean WAITING status at Round 1
    if (db.stations) {
      Object.keys(db.stations).forEach((stId) => {
        const s = db.stations[stId];
        s.currentRound = 1;
        s.status = 'WAITING';
        s.activeParticipantId = null;
        s.activeParticipant = null;
        s.selectedImageId = null;
        s.selectedImage = null;
        s.imageRotation = 0;
        s.selectedTopicId = null;
        s.selectedTopic = null;
        s.wheelSpin = null;
        s.timerMode = 'idle';
        s.timerStatus = 'idle';
        s.timerDuration = 120;
        s.timerStartTime = null;
        s.timerAccumulatedMs = 0;
        s.timerStopTime = null;
        s.timerTotalSeconds = 120;
        s.timerRemainingSeconds = 120;
        s.isTimerRunning = false;
        s.timerStartedAt = null;
        s.timerEndsAt = null;
        s.buzzerTimeSeconds = 120;
        s.buzzerPlayed = false;
        s.isOvertime = false;
        s.overtimeSeconds = 0;
      });
    }

    persistDB();
    logAction('Reset All Data', 'Organizer performed a complete factory reset — purged all contestants, topics, images, and scores to start fresh.');

    // 3. Broadcast to all clients and station channels
    broadcastSSE('state_reset', db);
    broadcastSSE('participants_updated', db.participants);
    broadcastSSE('topics_updated', db.topics);
    broadcastSSE('images_updated', db.images);
    broadcastSSE('stations_updated', Object.values(db.stations));
    broadcastSSE('event_round_changed', {
      currentRound: 1,
      round2PermissionGranted: false,
      round3PermissionGranted: false,
      stations: db.stations,
    });
    broadcastSSE('history_updated', null);

    if (db.stations) {
      Object.keys(db.stations).forEach((stId) => {
        broadcastStationUpdate(stId, 'station_updated', db.stations[stId]);
      });
    }

    res.json({
      success: true,
      message: 'All data permanently deleted. System initialized to clean fresh state.',
      db,
    });
  } catch (err: any) {
    console.error('[reset-data] Error resetting database:', err);
    res.status(500).json({ error: err.message || 'Failed to perform complete data reset' });
  }
};

app.post('/api/reset-data', handleCompleteDataReset);
app.post('/api/event/reset-all', handleCompleteDataReset);

// Get connected projectors list
app.get('/api/projectors', (req: Request, res: Response) => {
  const projectors = Array.from(activeProjectors.values());
  res.json({ success: true, projectors });
});

// Remotely assign a projector device to a station channel
app.post('/api/projectors/:id/assign-station', (req: Request, res: Response) => {
  const projectorDeviceId = req.params.id;
  const { stationId } = req.body;

  if (!stationId) {
    return res.status(400).json({ error: 'stationId is required' });
  }

  const stationObj = getStation(stationId);
  const existing = activeProjectors.get(projectorDeviceId);
  if (existing) {
    existing.stationId = stationId;
    existing.stationName = stationObj?.name || stationId;
    activeProjectors.set(projectorDeviceId, existing);
  }

  // Update channels on matching sseClients
  sseClients.forEach((client) => {
    if (client.projectorDeviceId === projectorDeviceId) {
      Array.from(client.channels).forEach((ch) => {
        if (ch.startsWith('station:')) client.channels.delete(ch);
      });
      client.channels.add(`station:${stationId}`);
      client.stationId = stationId;
    }
  });

  // Direct notification to that specific projector's private room
  broadcastToProjector(projectorDeviceId, 'station_assigned', {
    projectorDeviceId,
    stationId,
    station: stationObj,
  });

  broadcastProjectorsList();
  logAction('Projector Assigned', `Admin bound screen ${projectorDeviceId} to ${stationObj?.name || stationId}.`);
  res.json({ success: true, projector: activeProjectors.get(projectorDeviceId) || { id: projectorDeviceId, stationId } });
});

// Admin sends a visual test ping directly to a specific projector screen
app.post('/api/projectors/:id/ping', (req: Request, res: Response) => {
  const projectorDeviceId = req.params.id;
  const { message } = req.body;

  broadcastToProjector(projectorDeviceId, 'projector_ping', {
    projectorDeviceId,
    timestamp: Date.now(),
    message: message || 'Ping received from Master Monitor',
  });

  res.json({ success: true, message: `Ping sent to projector ${projectorDeviceId}` });
});

// SSE Endpoint for Live Sync and Buzzer with Scoped Channels
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const type = (req.query.type as 'projector' | 'buzzer' | 'organizer' | 'master') || 'organizer';
  const projectorDeviceId = (req.query.projector_device_id as string) || (req.headers['x-projector-device-id'] as string) || undefined;
  const stationId = (req.query.station as string) || undefined;

  const channels = new Set<string>();
  channels.add('global');

  if (type === 'master' || type === 'organizer' || !stationId || stationId === 'all') {
    channels.add('master');
  }

  if (stationId && stationId !== 'all') {
    channels.add(`station:${stationId}`);
  }

  if (projectorDeviceId) {
    channels.add(`projector:${projectorDeviceId}`);

    const stationObj = stationId ? getStation(stationId) : null;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = (req.headers['user-agent'] as string) || '';

    activeProjectors.set(projectorDeviceId, {
      id: projectorDeviceId,
      stationId: stationId || undefined,
      stationName: stationObj?.name || (stationId ? `Station ${stationId.replace('station-', '').toUpperCase()}` : undefined),
      connectedAt: Date.now(),
      lastPing: Date.now(),
      ip: clientIp,
      userAgent,
    });

    setTimeout(() => broadcastProjectorsList(), 50);
  }

  const client: SSEClient = { id: clientId, res, type, projectorDeviceId, stationId, channels };
  sseClients.push(client);

  // Send initial ping, live sync state, and server timestamp for clock calibration
  res.write(`event: connected\ndata: ${JSON.stringify({ 
    clientId, 
    liveSync: db.liveSync, 
    serverTime: Date.now(),
    projectorDeviceId,
    stationId,
    channels: Array.from(channels)
  })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);

    if (projectorDeviceId) {
      const hasOther = sseClients.some((c) => c.projectorDeviceId === projectorDeviceId);
      if (!hasOther) {
        activeProjectors.delete(projectorDeviceId);
        broadcastProjectorsList();
      }
    }
  });
});

// Buzzer trigger
app.post('/api/buzzer/trigger', (req: Request, res: Response) => {
  const { source, reason, round, participantName, stationId, soundType } = req.body;
  const isWarning = soundType === 'warning' || source === 'warning_buzzer';
  const triggerPayload = {
    timestamp: Date.now(),
    eventId: `buzzer-${Date.now()}-${stationId || 'global'}`,
    source: source || 'organizer',
    soundType: isWarning ? 'warning' : 'main',
    reason: reason || (isWarning ? 'Mid-Round Timing Warning' : 'Manual Buzzer'),
    round: round || 'General',
    sound: isWarning ? (db.settings.buzzer.warningSound || 'double_beep') : db.settings.buzzer.sound,
    volume: isWarning ? (db.settings.buzzer.warningVolume ?? 85) : db.settings.buzzer.volume,
    stationId: stationId || undefined,
  };

  db.liveSync.buzzerTimestamp = triggerPayload.timestamp;

  if (stationId && stationId !== 'all') {
    broadcastStationUpdate(stationId, 'buzzer_trigger', triggerPayload);
  } else {
    broadcastSSE('buzzer_trigger', triggerPayload);
  }

  logAction('Buzzer Triggered', `${reason || 'Manual Buzzer'} sounded by ${source || 'organizer'} (${round || 'General'}) ${participantName ? 'for ' + participantName : ''}${stationId ? ` [${stationId}]` : ''}`);

  res.json({ success: true, triggerPayload });
});

// Custom Buzzer Sound Upload / Management
app.post('/api/buzzer/custom-sound', (req: Request, res: Response) => {
  const { audioData, fileName } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  db.settings.buzzer.sound = 'custom';
  db.settings.buzzer.customAudioUrl = audioData;
  db.settings.buzzer.customAudioName = fileName || 'custom_buzzer_audio';

  persistDB();
  logAction('Custom Buzzer Updated', `Custom buzzer sound uploaded: ${fileName || 'custom audio'}`);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

app.delete('/api/buzzer/custom-sound', (req: Request, res: Response) => {
  db.settings.buzzer.sound = 'horn';
  delete db.settings.buzzer.customAudioUrl;
  delete db.settings.buzzer.customAudioName;

  persistDB();
  logAction('Custom Buzzer Reset', 'Custom buzzer sound removed, reset to classic air horn');
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

// Preparation Timer Buzzer (30s prep countdown end) Sound Upload / Management
app.post('/api/buzzer/prep-custom-sound', (req: Request, res: Response) => {
  const { audioData, fileName } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  if (!db.settings.buzzer) {
    db.settings.buzzer = { ...defaultSettings.buzzer };
  }

  db.settings.buzzer.prepSound = 'custom';
  db.settings.buzzer.prepCustomAudioUrl = audioData;
  db.settings.buzzer.prepCustomAudioName = fileName || 'custom_prep_buzzer_audio';

  persistDB();
  logAction('Prep Buzzer Updated', `Custom 30s prep buzzer uploaded: ${fileName || 'custom audio'}`);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

app.delete('/api/buzzer/prep-custom-sound', (req: Request, res: Response) => {
  if (!db.settings.buzzer) {
    db.settings.buzzer = { ...defaultSettings.buzzer };
  }

  db.settings.buzzer.prepSound = 'dual_alert';
  delete db.settings.buzzer.prepCustomAudioUrl;
  delete db.settings.buzzer.prepCustomAudioName;

  persistDB();
  logAction('Prep Buzzer Reset', 'Custom preparation buzzer reset to energetic dual alert');
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

// Warning Buzzer Sound Upload / Management
app.post('/api/buzzer/warning-custom-sound', (req: Request, res: Response) => {
  const { audioData, fileName } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  if (!db.settings.buzzer) {
    db.settings.buzzer = { ...defaultSettings.buzzer };
  }

  db.settings.buzzer.warningSound = 'custom';
  db.settings.buzzer.warningCustomAudioUrl = audioData;
  db.settings.buzzer.warningCustomAudioName = fileName || 'custom_warning_buzzer_audio';

  persistDB();
  logAction('Warning Buzzer Updated', `Custom warning buzzer uploaded: ${fileName || 'custom audio'}`);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

app.delete('/api/buzzer/warning-custom-sound', (req: Request, res: Response) => {
  if (!db.settings.buzzer) {
    db.settings.buzzer = { ...defaultSettings.buzzer };
  }

  db.settings.buzzer.warningSound = 'double_beep';
  delete db.settings.buzzer.warningCustomAudioUrl;
  delete db.settings.buzzer.warningCustomAudioName;

  persistDB();
  logAction('Warning Buzzer Reset', 'Custom warning buzzer reset to double beep');
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, buzzer: db.settings.buzzer });
});

// Live Sync (organizer updates projector & mobile display)
app.get('/api/live-sync', (req: Request, res: Response) => {
  res.json(db.liveSync);
});

app.post('/api/live-sync', (req: Request, res: Response) => {
  const updates: Partial<LiveSyncState> = req.body;
  db.liveSync = { ...db.liveSync, ...updates };
  broadcastSSE('live_sync_update', db.liveSync);
  res.json({ success: true, liveSync: db.liveSync });
});

// Synchronized Timer Action Endpoint
app.post('/api/timer/action', (req: Request, res: Response) => {
  const { action, phase, totalSeconds, remainingSeconds, round, endsAt, startedAt } = req.body;
  const now = Date.now();
  const effectiveStart = typeof startedAt === 'number' && Math.abs(now - startedAt) < 2500 ? startedAt : now;

  if (action === 'start') {
    const rem = typeof remainingSeconds === 'number' ? remainingSeconds : (totalSeconds || 120);
    const duration = totalSeconds || rem || 120;
    const activePhase = phase || 'speech';

    db.liveSync.timerMode = activePhase;
    db.liveSync.timerDuration = duration;
    db.liveSync.timerTotalSeconds = duration;
    db.liveSync.timerRemainingSeconds = rem;
    db.liveSync.isTimerRunning = true;
    db.liveSync.timerStatus = 'running';
    db.liveSync.timerStartTime = effectiveStart;
    db.liveSync.timerStartedAt = effectiveStart;
    db.liveSync.timerAccumulatedMs = 0;
    db.liveSync.timerEndsAt = typeof endsAt === 'number' ? endsAt : effectiveStart + rem * 1000;
    db.liveSync.timerStopTime = null;
    db.liveSync.isOvertime = false;
    db.liveSync.overtimeSeconds = 0;

    // Mirror to stations
    Object.values(db.stations).forEach((s) => {
      s.timerMode = activePhase;
      s.timerDuration = duration;
      s.timerTotalSeconds = duration;
      s.timerRemainingSeconds = rem;
      s.isTimerRunning = true;
      s.timerStatus = 'running';
      s.timerStartTime = effectiveStart;
      s.timerStartedAt = effectiveStart;
      s.timerAccumulatedMs = 0;
      s.timerEndsAt = db.liveSync.timerEndsAt;
      s.timerStopTime = null;
      s.isOvertime = false;
      s.overtimeSeconds = 0;
      s.status = activePhase === 'prep' ? 'PREPARING' : 'SPEAKING';
    });
  } else if (action === 'transition_to_speech') {
    const speechSec = totalSeconds || 120;
    db.liveSync.timerMode = 'speech';
    db.liveSync.timerDuration = speechSec;
    db.liveSync.timerTotalSeconds = speechSec;
    db.liveSync.timerRemainingSeconds = speechSec;
    db.liveSync.isTimerRunning = true;
    db.liveSync.timerStatus = 'running';
    db.liveSync.timerStartTime = now;
    db.liveSync.timerStartedAt = now;
    db.liveSync.timerAccumulatedMs = 0;
    db.liveSync.timerEndsAt = now + speechSec * 1000;
    db.liveSync.timerStopTime = null;
    db.liveSync.isOvertime = false;
    db.liveSync.overtimeSeconds = 0;

    Object.values(db.stations).forEach((s) => {
      s.timerMode = 'speech';
      s.timerDuration = speechSec;
      s.timerTotalSeconds = speechSec;
      s.timerRemainingSeconds = speechSec;
      s.isTimerRunning = true;
      s.timerStatus = 'running';
      s.timerStartTime = now;
      s.timerStartedAt = now;
      s.timerAccumulatedMs = 0;
      s.timerEndsAt = db.liveSync.timerEndsAt;
      s.timerStopTime = null;
      s.isOvertime = false;
      s.overtimeSeconds = 0;
      s.status = 'SPEAKING';
    });
  } else if (action === 'pause') {
    const runMs = db.liveSync.timerStartTime ? now - db.liveSync.timerStartTime : 0;
    db.liveSync.timerAccumulatedMs = (db.liveSync.timerAccumulatedMs || 0) + runMs;
    db.liveSync.timerStartTime = null;
    db.liveSync.timerStartedAt = null;
    db.liveSync.timerEndsAt = null;
    db.liveSync.timerStatus = 'paused';
    db.liveSync.isTimerRunning = false;
    const dur = db.liveSync.timerDuration || db.liveSync.timerTotalSeconds || 120;
    const totalElapsedSec = Math.floor(db.liveSync.timerAccumulatedMs / 1000);
    db.liveSync.timerRemainingSeconds = Math.max(0, dur - totalElapsedSec);

    Object.values(db.stations).forEach((s) => {
      s.timerAccumulatedMs = db.liveSync.timerAccumulatedMs;
      s.timerStartTime = null;
      s.timerStartedAt = null;
      s.timerEndsAt = null;
      s.timerStatus = 'paused';
      s.isTimerRunning = false;
      s.timerRemainingSeconds = db.liveSync.timerRemainingSeconds;
      s.status = 'PAUSED';
    });
  } else if (action === 'resume') {
    db.liveSync.timerStartTime = now;
    db.liveSync.timerStartedAt = now;
    db.liveSync.timerStatus = 'running';
    db.liveSync.isTimerRunning = true;
    const dur = db.liveSync.timerDuration || db.liveSync.timerTotalSeconds || 120;
    const totalElapsedSec = Math.floor((db.liveSync.timerAccumulatedMs || 0) / 1000);
    const remSec = Math.max(0, dur - totalElapsedSec);
    db.liveSync.timerEndsAt = now + remSec * 1000;
    db.liveSync.timerRemainingSeconds = remSec;

    Object.values(db.stations).forEach((s) => {
      s.timerStartTime = now;
      s.timerStartedAt = now;
      s.timerStatus = 'running';
      s.isTimerRunning = true;
      s.timerEndsAt = db.liveSync.timerEndsAt;
      s.timerRemainingSeconds = remSec;
      s.status = s.timerMode === 'prep' ? 'PREPARING' : 'SPEAKING';
    });
  } else if (action === 'stop' || action === 'reset') {
    const isReset = action === 'reset';
    const initSec = totalSeconds || db.liveSync.timerDuration || 120;
    db.liveSync.isTimerRunning = false;
    db.liveSync.timerStatus = isReset ? 'idle' : 'stopped';
    db.liveSync.timerMode = isReset ? 'idle' : 'stopped';
    db.liveSync.timerRemainingSeconds = isReset ? initSec : 0;
    db.liveSync.timerDuration = initSec;
    db.liveSync.timerTotalSeconds = initSec;
    db.liveSync.timerStartTime = null;
    db.liveSync.timerStartedAt = null;
    db.liveSync.timerAccumulatedMs = 0;
    db.liveSync.timerEndsAt = null;
    db.liveSync.isOvertime = false;
    db.liveSync.overtimeSeconds = 0;

    Object.values(db.stations).forEach((s) => {
      s.isTimerRunning = false;
      s.timerStatus = isReset ? 'idle' : 'stopped';
      s.timerMode = isReset ? 'idle' : 'stopped';
      s.timerRemainingSeconds = isReset ? initSec : 0;
      s.timerDuration = initSec;
      s.timerTotalSeconds = initSec;
      s.timerStartTime = null;
      s.timerStartedAt = null;
      s.timerAccumulatedMs = 0;
      s.timerEndsAt = null;
      s.isOvertime = false;
      s.overtimeSeconds = 0;
      s.status = isReset ? 'WAITING' : 'COMPLETED';
    });
  } else if (action === 'time_up' || action === 'limit_reached') {
    db.liveSync.isOvertime = true;
    db.liveSync.timerMode = 'speech';
    db.liveSync.buzzerTimestamp = now;

    const targetStationId = req.body.stationId;
    if (targetStationId && db.stations?.[targetStationId]) {
      const s = db.stations[targetStationId];
      s.isOvertime = true;
      s.buzzerPlayed = true;
      s.buzzerTimestamp = now;
      s.lastBuzzerEventId = `buzzer-${now}-${targetStationId}`;
      if (db.settings.buzzer.autoBuzzerOnZero) {
        broadcastStationUpdate(targetStationId, 'buzzer_trigger', {
          timestamp: now,
          eventId: s.lastBuzzerEventId,
          stationId: targetStationId,
          source: 'timer_auto',
          reason: 'Time Expired (00:00)',
          round: round || `Round ${s.currentRound}`,
          sound: db.settings.buzzer.sound,
          volume: db.settings.buzzer.volume,
        });
      }
    } else {
      if (db.settings.buzzer.autoBuzzerOnZero) {
        broadcastSSE('buzzer_trigger', {
          timestamp: now,
          eventId: `buzzer-${now}-global`,
          source: 'timer_auto',
          reason: 'Time Expired (00:00)',
          round: round || 'General',
          sound: db.settings.buzzer.sound,
          volume: db.settings.buzzer.volume,
        });
      }
    }
  }

  persistDB();
  broadcastSSE('timer_update', {
    timerMode: db.liveSync.timerMode,
    timerDuration: db.liveSync.timerDuration,
    timerTotalSeconds: db.liveSync.timerTotalSeconds,
    timerRemainingSeconds: db.liveSync.timerRemainingSeconds,
    isTimerRunning: db.liveSync.isTimerRunning,
    timerStartTime: db.liveSync.timerStartTime,
    timerStartedAt: db.liveSync.timerStartedAt,
    timerAccumulatedMs: db.liveSync.timerAccumulatedMs,
    timerEndsAt: db.liveSync.timerEndsAt,
    isOvertime: db.liveSync.isOvertime,
    overtimeSeconds: db.liveSync.overtimeSeconds,
    serverTime: now,
  });
  broadcastSSE('live_sync_update', { ...db.liveSync, serverTime: now });

  res.json({ success: true, liveSync: db.liveSync, serverTime: now });
});

// Atomic Round 1 Image Assignment (Universal pool across all stations)
app.post('/api/round1/assign-image', (req: Request, res: Response) => {
  const { participantId, participantName } = req.body;

  let candidates = db.images.filter((img) => img.status === 'available');
  if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
    candidates = db.images;
  }

  if (candidates.length === 0) {
    if (db.settings.round1.allowImageReuse && db.images.length > 0) {
      candidates = db.images;
    } else {
      return res.status(409).json({
        error: 'No unused images left in the pool. Reset image pool or allow image reuse in settings.',
      });
    }
  }

  // Random selection
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  // Mark as used
  if (!db.settings.round1.allowImageReuse) {
    chosen.status = 'used';
    chosen.usedByParticipantId = participantId;
    chosen.usedByParticipantName = participantName;
    chosen.usedAt = new Date().toISOString();
  }

  // Update live sync
  db.liveSync.currentRound = 1;
  if (participantId) {
    db.liveSync.activeParticipantId = participantId;
    const p = db.participants.find((item) => item.id === participantId);
    if (p) {
      p.round1ImageId = chosen.imageId || chosen.name || chosen.id;
    }
  }
  db.liveSync.activeItem = {
    type: 'image',
    title: chosen.imageId || chosen.name || chosen.id,
    mediaUrl: chosen.url,
    id: chosen.id,
  };

  persistDB();
  logAction('Image Assigned', `Assigned image "${chosen.name}" to contestant ${participantName || participantId || 'N/A'}`);
  broadcastSSE('images_updated', db.images);
  broadcastSSE('live_sync_update', db.liveSync);

  res.json({ success: true, image: chosen, liveSync: db.liveSync });
});

// Atomic Round 2 Topic Spin (Universal topic pool across devices & projector)
app.post('/api/round2/spin-topic', (req: Request, res: Response) => {
  const { participantId, participantName, wheelTopicIds } = req.body;

  // Pool of available topics from universal pool
  let pool = db.topics.filter((t) => t.status === 'available');
  if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
    pool = db.topics;
  }

  if (pool.length === 0) {
    if (db.settings.round2.topicReuseAllowed && db.topics.length > 0) {
      pool = db.topics;
    } else {
      return res.status(409).json({
        error: 'No unused topics left in the pool. Reset topic pool or allow topic reuse in settings.',
      });
    }
  }

  // Ensure selection is strictly among topics rendered on the active wheel (preserving wheel order)
  const wheelCount = db.settings.round2.activeWheelTopicCount || 20;
  let candidates: Topic[] = pool;
  if (Array.isArray(wheelTopicIds) && wheelTopicIds.length > 0) {
    const topicsMap = new Map(db.topics.map((t) => [t.id, t]));
    const fromWheel = wheelTopicIds
      .map((id) => topicsMap.get(id))
      .filter((t): t is Topic => Boolean(t) && (db.settings.round2.topicReuseAllowed || t.status === 'available'));
    if (fromWheel.length > 0) {
      candidates = fromWheel;
    } else {
      candidates = pool.slice(0, wheelCount);
    }
  } else {
    candidates = pool.slice(0, wheelCount);
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const targetIndex = candidates.findIndex((t) => t.id === chosen.id);

  if (!db.settings.round2.topicReuseAllowed) {
    chosen.status = 'used';
    chosen.usedByParticipantId = participantId;
    chosen.usedByParticipantName = participantName;
    chosen.usedAt = new Date().toISOString();
  }

  const spinDurationMs = 4800;
  const startedAt = Date.now();

  db.liveSync.currentRound = 2;
  if (participantId) {
    db.liveSync.activeParticipantId = participantId;
    const p = db.participants.find((item) => item.id === participantId);
    if (p) {
      p.round2TopicId = chosen.topicId || chosen.id;
    }
  }
  db.liveSync.wheelSpin = {
    isSpinning: true,
    targetTopicId: chosen.id,
    targetTopicTitle: chosen.topic,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
  };
  // Topic text remains hidden while wheel is spinning
  db.liveSync.activeItem = undefined;

  persistDB();
  logAction('Topic Spun', `Wheel spin initiated: landed on "${chosen.topic}" for contestant ${participantName || participantId || 'N/A'}`);

  broadcastSSE('wheel_spin_started', {
    topic: chosen,
    targetTopicId: chosen.id,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
  });
  broadcastSSE('topics_updated', db.topics);
  broadcastSSE('live_sync_update', db.liveSync);

  res.json({
    success: true,
    topic: chosen,
    startedAt,
    durationMs: spinDurationMs,
    liveSync: db.liveSync,
  });
});

// ================= STATION API ROUTES =================

// Helper to get initial wheel topics matching configured slice count
function getInitialStationWheelTopics(stationId: string, stationName?: string): Topic[] {
  if (!db || !db.topics || db.topics.length === 0) return [];
  const wheelCount = db.settings?.round2?.activeWheelTopicCount || 20;
  const reuseAllowed = db.settings?.round2?.topicReuseAllowed || false;

  const stationTopics = db.topics.filter(
    (t) => !t.stationId || t.stationId === 'all' || t.stationId === stationId || (stationName && t.stationId === stationName)
  );
  const pool = stationTopics.length > 0 ? stationTopics : db.topics;
  const available = reuseAllowed ? [...pool] : pool.filter((t) => t.status === 'available');

  const list: Topic[] = [...available];
  if (list.length < wheelCount) {
    for (const t of pool) {
      if (list.length >= wheelCount) break;
      if (!list.some((item) => item.id === t.id)) {
        list.push(t);
      }
    }
  }
  if (list.length < wheelCount) {
    for (const t of db.topics) {
      if (list.length >= wheelCount) break;
      if (!list.some((item) => item.id === t.id)) {
        list.push(t);
      }
    }
  }
  return list.slice(0, wheelCount);
}

// Helper to get or create station
function getStation(id: string): StationState {
  if (!db.stations) db.stations = {};
  if (!db.stations[id]) {
    const configStation = db.settings.stations?.find((s) => s.id === id);
    db.stations[id] = createInitialStationState(
      id,
      configStation?.name || `Station ${id.toUpperCase()}`,
      configStation?.location || 'Auditorium',
      configStation?.handlerName,
      configStation?.handlerPhone,
      configStation?.handlerRole,
      configStation?.handlerStatus,
      configStation?.handlerNotes
    );
  } else {
    // Backfill handler from settings if station already exists
    const configStation = db.settings.stations?.find((s) => s.id === id);
    if (configStation) {
      if (!db.stations[id].handlerName && configStation.handlerName) {
        db.stations[id].handlerName = configStation.handlerName;
      }
      if (!db.stations[id].handlerPhone && configStation.handlerPhone) {
        db.stations[id].handlerPhone = configStation.handlerPhone;
      }
      if (!db.stations[id].handlerRole && configStation.handlerRole) {
        db.stations[id].handlerRole = configStation.handlerRole;
      }
      if (!db.stations[id].handlerStatus && configStation.handlerStatus) {
        db.stations[id].handlerStatus = configStation.handlerStatus;
      }
    }
  }

  // Pre-populate Round 2 wheel topics if station is in Round 2
  if (
    db.stations[id].currentRound === 2 &&
    (!db.stations[id].activeWheelTopics || db.stations[id].activeWheelTopics.length === 0)
  ) {
    db.stations[id].activeWheelTopics = getInitialStationWheelTopics(id, db.stations[id].name);
  }

  return db.stations[id];
}

// Get all stations
app.get('/api/stations', (req: Request, res: Response) => {
  if (!db.stations) db.stations = {};
  res.json(Object.values(db.stations));
});

// Get single station
app.get('/api/stations/:id', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  res.json(station);
});

// Claim station (with takeover conflict detection)
app.post('/api/stations/:id/claim', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { deviceId, deviceName, force } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  const now = Date.now();
  const isCurrentlyControlled =
    station.controllerDeviceId &&
    station.controllerDeviceId !== deviceId &&
    now - (station.lastHeartbeat || 0) < 25000;

  if (isCurrentlyControlled && !force) {
    return res.status(409).json({
      conflict: true,
      currentDeviceName: station.controllerDeviceName || 'Another Device',
      message: `${station.name} is currently active on another device.`,
    });
  }

  station.controllerDeviceId = deviceId;
  station.controllerDeviceName = deviceName || `Device ${deviceId.slice(-4)}`;
  station.claimedByDeviceId = deviceId;
  station.claimedByDeviceName = deviceName || `Device ${deviceId.slice(-4)}`;
  station.lastHeartbeat = now;
  if (station.status === 'DISCONNECTED') {
    station.status = 'WAITING';
  }

  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', station);
  logAction('Station Claimed', `${station.controllerDeviceName} assumed control of ${station.name}`);
  res.json({ success: true, station });
});

// Heartbeat to keep station controller active
app.post('/api/stations/:id/heartbeat', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { deviceId, deviceName } = req.body;

  if (deviceId) {
    if (!station.controllerDeviceId || station.controllerDeviceId === deviceId || station.claimedByDeviceId === deviceId) {
      station.controllerDeviceId = deviceId;
      if (deviceName) station.controllerDeviceName = deviceName;
      station.claimedByDeviceId = deviceId;
      if (deviceName) station.claimedByDeviceName = deviceName;
      station.lastHeartbeat = Date.now();
    }
  }

  persistDB();
  res.json({ success: true, station });
});

// Release station control
app.post('/api/stations/:id/release', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { deviceId } = req.body;

  if (station.controllerDeviceId === deviceId || station.claimedByDeviceId === deviceId) {
    station.controllerDeviceId = null;
    station.controllerDeviceName = null;
    station.claimedByDeviceId = null;
    station.claimedByDeviceName = null;
    station.lastHeartbeat = 0;
    persistDB();
    broadcastStationUpdate(station.id, 'station_updated', station);
  }

  res.json({ success: true });
});

// Update Station Handler & Details
app.post('/api/stations/:id/handler', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { handlerName, handlerPhone, handlerRole, handlerStatus, handlerNotes, name, location } = req.body;

  if (handlerName !== undefined) station.handlerName = handlerName ? String(handlerName).trim() : null;
  if (handlerPhone !== undefined) station.handlerPhone = handlerPhone ? String(handlerPhone).trim() : null;
  if (handlerRole !== undefined) station.handlerRole = handlerRole ? String(handlerRole).trim() : null;
  if (handlerStatus !== undefined) station.handlerStatus = handlerStatus || 'ready';
  if (handlerNotes !== undefined) station.handlerNotes = handlerNotes || '';
  if (name !== undefined && name.trim()) station.name = name.trim();
  if (location !== undefined && location.trim()) station.location = location.trim();

  // Also sync to settings.stations if present
  if (db.settings.stations) {
    const sInSettings = db.settings.stations.find((s) => s.id === station.id);
    if (sInSettings) {
      if (station.name) sInSettings.name = station.name;
      if (station.location) sInSettings.location = station.location;
      sInSettings.handlerName = station.handlerName || undefined;
      sInSettings.handlerPhone = station.handlerPhone || undefined;
      sInSettings.handlerRole = station.handlerRole || undefined;
      sInSettings.handlerStatus = station.handlerStatus || undefined;
      sInSettings.handlerNotes = station.handlerNotes || undefined;
    }
  }

  persistDB();
  logAction('Station Handler Updated', `Updated handler for ${station.name}: ${station.handlerName || 'None'} (${station.handlerRole || 'Handler'})`);
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, station });
});

// Ping Station Handler / Controller
app.post('/api/stations/:id/ping', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { senderName, message } = req.body;
  const alertMsg = message || `Master Monitor pinged ${station.name}!`;

  logAction('Station Pinged', `${senderName || 'Master'} pinged ${station.name} (${station.handlerName || 'No handler'})`);
  broadcastStationUpdate(station.id, 'station_ping', {
    stationId: station.id,
    stationName: station.name,
    handlerName: station.handlerName,
    message: alertMsg,
    timestamp: Date.now(),
  });
  res.json({ success: true, message: 'Ping sent to station' });
});

// Helper to calculate round completion progress across stations (attendance-aware)
function checkRoundCompletionStatus(round: 1 | 2 | 3) {
  const stationDetails: Record<
    string,
    {
      stationId: string;
      stationName: string;
      total: number;
      arrivedCount: number;
      completed: number;
      absentCount: number;
      remaining: number;
      isComplete: boolean;
      pendingContestants: { id: string; name: string; participantNumber: string }[];
      absentContestants: { id: string; name: string; participantNumber: string }[];
    }
  > = {};
  let totalAcrossStations = 0;
  let arrivedAcrossStations = 0;
  let completedAcrossStations = 0;
  let absentAcrossStations = 0;
  let remainingAcrossStations = 0;
  const allPendingContestants: { id: string; name: string; participantNumber: string; stationName: string }[] = [];
  const allAbsentContestants: { id: string; name: string; participantNumber: string; stationName: string }[] = [];

  const stations = Object.values(db.stations || {});
  const participants = db.participants || [];
  const results =
    round === 1 ? db.round1Results || [] : round === 2 ? db.round2Results || [] : db.round3Results || [];

  stations.forEach((st) => {
    // Participants allocated to this station for this round
    const allocated = participants.filter((p) => {
      const stationMatches =
        p.stationId === st.id ||
        (round === 1 && p.round1StationId === st.id) ||
        (round === 2 && p.round2StationId === st.id) ||
        (round === 3 && p.round3StationId === st.id) ||
        (!p.stationId && st.id === 'station-a');

      if (!stationMatches) return false;

      // In Round 2, only qualified contestants participate
      if (round === 2 && p.round1Qualified !== 'qualified') return false;
      // In Round 3, only qualified contestants participate
      if (round === 3 && p.round2Qualified !== 'qualified') return false;

      // Ignore eliminated or disqualified contestants
      if (p.status === 'eliminated' || p.status === 'disqualified') return false;

      return true;
    });

    // Separate into arrived (checked-in) vs absent (never checked-in or marked absent)
    const arrived = allocated.filter((p) => isParticipantCheckedIn(p));
    const absent = allocated.filter((p) => !isParticipantCheckedIn(p));

    const completed = arrived.filter((p) => {
      const hasResult = results.some((r) => r.participantId === p.id);
      const statusCompleted =
        round === 1
          ? p.round1Status === 'completed'
          : round === 2
          ? p.round2Status === 'completed'
          : p.round3Status === 'completed';
      return hasResult || statusCompleted;
    });

    const pendingArrived = arrived.filter((p) => !completed.some((c) => c.id === p.id));

    // A station is complete if all arrived contestants have completed their speech
    const stationIsComplete = arrived.length > 0 ? pendingArrived.length === 0 : true;

    stationDetails[st.id] = {
      stationId: st.id,
      stationName: st.name,
      total: allocated.length,
      arrivedCount: arrived.length,
      completed: completed.length,
      absentCount: absent.length,
      remaining: pendingArrived.length,
      isComplete: stationIsComplete,
      pendingContestants: pendingArrived.map((p) => ({
        id: p.id,
        name: p.name,
        participantNumber: p.participantNumber,
      })),
      absentContestants: absent.map((p) => ({
        id: p.id,
        name: p.name,
        participantNumber: p.participantNumber,
      })),
    };

    totalAcrossStations += allocated.length;
    arrivedAcrossStations += arrived.length;
    completedAcrossStations += completed.length;
    absentAcrossStations += absent.length;
    remainingAcrossStations += pendingArrived.length;

    pendingArrived.forEach((p) => {
      allPendingContestants.push({
        id: p.id,
        name: p.name,
        participantNumber: p.participantNumber,
        stationName: st.name,
      });
    });

    absent.forEach((p) => {
      allAbsentContestants.push({
        id: p.id,
        name: p.name,
        participantNumber: p.participantNumber,
        stationName: st.name,
      });
    });
  });

  // Overall isComplete is true when all arrived contestants across stations have finished
  const isComplete = arrivedAcrossStations > 0 ? remainingAcrossStations === 0 : true;

  return {
    isComplete,
    totalParticipants: totalAcrossStations,
    arrivedParticipants: arrivedAcrossStations,
    completedParticipants: completedAcrossStations,
    absentParticipants: absentAcrossStations,
    remainingParticipants: remainingAcrossStations,
    pendingContestants: allPendingContestants,
    absentContestants: allAbsentContestants,
    stationDetails,
  };
}

// Get Synchronized Event Round Status across all stations
app.get('/api/event/round-status', (_req: Request, res: Response) => {
  const currentRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;
  res.json({
    currentRound,
    round2PermissionGranted: Boolean(db.liveSync?.round2PermissionGranted),
    round3PermissionGranted: Boolean(db.liveSync?.round3PermissionGranted),
    stagePermissions: db.liveSync?.stagePermissions || {},
    rounds: {
      1: checkRoundCompletionStatus(1),
      2: checkRoundCompletionStatus(2),
      3: checkRoundCompletionStatus(3),
    },
  });
});

// Dedicated Master Stage Permission & Launch Endpoint
app.post('/api/event/stage-permission', (req: Request, res: Response) => {
  const { targetRound, markAbsent, force } = req.body;
  if (![2, 3].includes(Number(targetRound))) {
    return res.status(400).json({ error: 'Permission target round must be 2 or 3.' });
  }

  const roundNum = Number(targetRound) as 2 | 3;
  const prevRound = (roundNum - 1) as 1 | 2;
  const status = checkRoundCompletionStatus(prevRound);

  if (!status.isComplete && !force) {
    return res.status(400).json({
      error: `Cannot authorize Round ${roundNum}: Round ${prevRound} still has ${status.remainingParticipants} arrived contestants in progress across stations.`,
      status,
    });
  }

  // If markAbsent is requested, resolve un-arrived contestants from the roster
  let markedAbsentCount = 0;
  if (markAbsent && db.participants) {
    db.participants.forEach((p) => {
      const wasCheckedIn = isParticipantCheckedIn(p);
      if (!wasCheckedIn && p.status !== 'eliminated' && p.status !== 'disqualified') {
        p.status = 'absent';
        if (prevRound === 1) {
          p.round1Status = 'not_started';
          p.round1Qualified = 'disqualified';
        } else if (prevRound === 2) {
          p.round2Status = 'not_started';
          p.round2Qualified = 'disqualified';
        }
        markedAbsentCount++;
      }
    });
  }

  if (!db.liveSync) {
    db.liveSync = {
      currentRound: roundNum,
      activeParticipantId: null,
      timerMode: 'idle',
      timerRemainingSeconds: 120,
      timerTotalSeconds: 120,
      isTimerRunning: false,
      stationStates: db.stations || {},
    };
  }

  // Grant permission
  if (roundNum === 2) {
    db.liveSync.round2PermissionGranted = true;
  } else if (roundNum === 3) {
    db.liveSync.round3PermissionGranted = true;
  }

  if (!db.liveSync.stagePermissions) {
    db.liveSync.stagePermissions = {};
  }
  const permKey = roundNum === 2 ? 'round2' : 'round3';
  db.liveSync.stagePermissions[permKey] = {
    granted: true,
    grantedAt: new Date().toISOString(),
    grantedBy: 'Master Supervisor',
    absentCount: markedAbsentCount,
  };

  // Synchronize all stations to the authorized round
  db.liveSync.currentRound = roundNum;
  const roundDuration =
    roundNum === 2
      ? db.settings.round2.speechTimeSeconds || 120
      : db.settings.round3.speechTimeSeconds || 120;

  if (db.stations) {
    Object.values(db.stations).forEach((station) => {
      station.currentRound = roundNum;
      station.status = 'WAITING';
      station.selectedImageId = null;
      station.selectedImage = null;
      station.selectedTopicId = null;
      station.selectedTopic = null;
      station.wheelSpin = null;
      if (roundNum === 2 && (!station.activeWheelTopics || station.activeWheelTopics.length === 0)) {
        station.activeWheelTopics = getInitialStationWheelTopics(station.id, station.name);
      }
      station.timerMode = 'idle';
      station.timerTotalSeconds = roundDuration;
      station.timerRemainingSeconds = roundDuration;
      station.isTimerRunning = false;
      station.timerStartedAt = null;
      station.timerEndsAt = null;

      if (station.activeParticipantId) {
        const p = db.participants.find((item) => item.id === station.activeParticipantId);
        if (
          !p ||
          (roundNum === 2 && p.round1Qualified !== 'qualified') ||
          (roundNum === 3 && p.round2Qualified !== 'qualified')
        ) {
          station.activeParticipantId = null;
          station.activeParticipant = null;
        }
      }
    });
  }

  persistDB();
  logAction(
    `Stage Permission Granted for Round ${roundNum}`,
    `Master authorized Round ${roundNum} start. Marked ${markedAbsentCount} no-shows as absent.`
  );
  broadcastSSE('event_round_changed', {
    currentRound: roundNum,
    stations: db.stations,
    round2PermissionGranted: db.liveSync.round2PermissionGranted,
    round3PermissionGranted: db.liveSync.round3PermissionGranted,
    stagePermissions: db.liveSync.stagePermissions,
  });
  broadcastSSE('stations_updated', Object.values(db.stations));
  broadcastSSE('participants_updated', db.participants);

  res.json({
    success: true,
    message: `Permission granted for Round ${roundNum}. All stations advanced to Round ${roundNum}.`,
    currentRound: roundNum,
    markedAbsentCount,
    round2PermissionGranted: db.liveSync.round2PermissionGranted,
    round3PermissionGranted: db.liveSync.round3PermissionGranted,
    stations: db.stations,
  });
});

// Synchronized Event Round Advancement (Advances all stations together!)
app.post('/api/event/set-round', (req: Request, res: Response) => {
  const { round, force } = req.body;
  if (![1, 2, 3].includes(Number(round))) {
    return res.status(400).json({ error: 'Invalid round number. Must be 1, 2, or 3.' });
  }

  const targetRound = Number(round) as 1 | 2 | 3;
  const currentRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;

  // If advancing forward, verify that preceding round is complete for arrived participants unless forced by Master
  if (targetRound > currentRound && !force) {
    const prevRound = (targetRound - 1) as 1 | 2;
    const prevStatus = checkRoundCompletionStatus(prevRound);
    if (!prevStatus.isComplete) {
      return res.status(400).json({
        error: `Cannot advance to Round ${targetRound}: Round ${prevRound} is still in progress across stations (${prevStatus.remainingParticipants} arrived contestants pending).`,
        details: prevStatus,
      });
    }
  }

  if (!db.liveSync) {
    db.liveSync = {
      currentRound: targetRound,
      activeParticipantId: null,
      timerMode: 'idle',
      timerRemainingSeconds: 120,
      timerTotalSeconds: 120,
      isTimerRunning: false,
      stationStates: db.stations || {},
    };
  } else {
    db.liveSync.currentRound = targetRound;
  }

  // Update permission flags accordingly
  if (targetRound >= 2) db.liveSync.round2PermissionGranted = true;
  if (targetRound >= 3) db.liveSync.round3PermissionGranted = true;
  if (targetRound === 1) {
    db.liveSync.round2PermissionGranted = false;
    db.liveSync.round3PermissionGranted = false;
  }

  // Set all stations to the new round simultaneously
  const roundDuration =
    targetRound === 1
      ? db.settings.round1.speechTimeSeconds || 120
      : targetRound === 2
      ? db.settings.round2.speechTimeSeconds || 120
      : db.settings.round3.speechTimeSeconds || 120;

  if (db.stations) {
    Object.values(db.stations).forEach((station) => {
      station.currentRound = targetRound;
      station.status = 'WAITING';
      station.selectedImageId = null;
      station.selectedImage = null;
      station.selectedTopicId = null;
      station.selectedTopic = null;
      station.wheelSpin = null;
      if (targetRound === 2 && (!station.activeWheelTopics || station.activeWheelTopics.length === 0)) {
        station.activeWheelTopics = getInitialStationWheelTopics(station.id, station.name);
      }
      station.timerMode = 'idle';
      station.timerTotalSeconds = roundDuration;
      station.timerRemainingSeconds = roundDuration;
      station.isTimerRunning = false;
      station.timerStartedAt = null;
      station.timerEndsAt = null;

      // Clear active contestant if they are not qualified for the new round
      if (station.activeParticipantId) {
        const p = db.participants.find((item) => item.id === station.activeParticipantId);
        if (
          !p ||
          (targetRound === 2 && p.round1Qualified !== 'qualified') ||
          (targetRound === 3 && p.round2Qualified !== 'qualified')
        ) {
          station.activeParticipantId = null;
          station.activeParticipant = null;
        }
      }
    });
  }

  persistDB();
  logAction('Competition Round Advanced', `All stations synchronized and advanced to Round ${targetRound}`);
  broadcastSSE('event_round_changed', {
    currentRound: targetRound,
    stations: db.stations,
    round2PermissionGranted: db.liveSync.round2PermissionGranted,
    round3PermissionGranted: db.liveSync.round3PermissionGranted,
  });
  broadcastSSE('stations_updated', Object.values(db.stations));

  res.json({
    success: true,
    currentRound: targetRound,
    round2PermissionGranted: db.liveSync.round2PermissionGranted,
    round3PermissionGranted: db.liveSync.round3PermissionGranted,
    stations: db.stations,
  });
});

// Set Station Round (Protected: Stations operate in sync with global event round)
app.post('/api/stations/:id/set-round', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { round, force } = req.body;

  if (![1, 2, 3].includes(Number(round))) {
    return res.status(400).json({ error: 'Invalid round number. Must be 1, 2, or 3.' });
  }

  const targetRound = Number(round) as 1 | 2 | 3;
  const currentGlobalRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;

  // Disallow individual stations from advancing ahead of the global event round unless forced by admin
  if (targetRound !== currentGlobalRound && !force) {
    return res.status(403).json({
      error: `Station cannot change round independently. The active competition round is Round ${currentGlobalRound}. All stations advance rounds together.`,
      currentGlobalRound,
      stationRound: station.currentRound,
    });
  }

  if (station.currentRound === targetRound && !force) {
    return res.json({ success: true, station });
  }

  station.currentRound = targetRound;
  station.status = 'WAITING';
  station.selectedImageId = null;
  station.selectedImage = null;
  station.selectedTopicId = null;
  station.selectedTopic = null;
  station.wheelSpin = null;
  if (targetRound === 2 && (!station.activeWheelTopics || station.activeWheelTopics.length === 0)) {
    station.activeWheelTopics = getInitialStationWheelTopics(station.id, station.name);
  }

  const roundDuration =
    station.currentRound === 1
      ? db.settings.round1.speechTimeSeconds || 120
      : station.currentRound === 2
      ? db.settings.round2.speechTimeSeconds || 120
      : db.settings.round3.speechTimeSeconds || 120;

  station.timerMode = 'idle';
  station.timerTotalSeconds = roundDuration;
  station.timerRemainingSeconds = roundDuration;
  station.isTimerRunning = false;
  station.timerStartedAt = null;
  station.timerEndsAt = null;

  persistDB();
  logAction('Station Round Updated', `${station.name} set to Round ${station.currentRound}`);
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, station });
});

// Set Station Active Participant
app.post('/api/stations/:id/set-participant', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { participantId } = req.body;

  let assignedParticipant: Participant | null = null;
  if (participantId) {
    const p = db.participants.find((item) => item.id === participantId);
    if (!p) {
      return res.status(404).json({
        error: 'Participant not found.',
        station,
      });
    }
    assignedParticipant = p;
  }

  const targetParticipantId = assignedParticipant ? assignedParticipant.id : null;

  // Idempotency: If already assigned to this participant, preserve current prompts and avoid broadcast storm
  if (station.activeParticipantId === targetParticipantId) {
    if (assignedParticipant) {
      station.activeParticipant = { ...assignedParticipant };
    } else {
      station.activeParticipant = null;
    }
    return res.json({ success: true, station });
  }

  station.activeParticipantId = targetParticipantId;
  station.activeParticipant = assignedParticipant ? { ...assignedParticipant } : null;

  if (!assignedParticipant) {
    // Participant was cleared
    station.selectedImageId = null;
    station.selectedImage = null;
    station.selectedTopicId = null;
    station.selectedTopic = null;
    station.wheelSpin = null;
    station.status = 'WAITING';
    station.isTimerRunning = false;
    station.timerStartedAt = null;
    station.timerEndsAt = null;
  } else {
    // Participant was assigned - resolve appropriate prompts based on current round
    const currentStationRound = (station.currentRound || db.liveSync?.currentRound || 1) as 1 | 2 | 3;

    if (currentStationRound === 1) {
      let resolvedImage: EventImage | null = null;

      // 1. Check if participant already has a finished result in round1Results
      const r1Res = db.round1Results.find((r) => r.participantId === assignedParticipant?.id);
      if (r1Res) {
        resolvedImage = db.images.find(
          (i) => i.id === r1Res.imageId || i.imageId === r1Res.imageId || i.name === r1Res.imageName
        ) || null;
      }

      // 2. Check if participant already had an image assigned during this session
      if (!resolvedImage && (assignedParticipant as any)?.round1ImageId) {
        const partImgId = (assignedParticipant as any).round1ImageId;
        resolvedImage = db.images.find(
          (i) => i.id === partImgId || i.imageId === partImgId || i.name === partImgId
        ) || null;
      }

      // NO automatic image generation on participant selection!
      // An image must only appear when the operator explicitly clicks "Random Image" or selects from gallery.
      station.selectedImage = resolvedImage;
      station.selectedImageId = resolvedImage ? resolvedImage.id : null;
      station.selectedTopicId = null;
      station.selectedTopic = null;
      station.wheelSpin = null;
      station.status = 'WAITING';
    } else if (currentStationRound === 2) {
      let resolvedTopic: Topic | null = null;
      const r2Res = db.round2Results.find((r) => r.participantId === assignedParticipant?.id);
      if (r2Res) {
        resolvedTopic = db.topics.find(
          (t) => t.id === r2Res.topicId || t.topic === r2Res.topicTitle
        ) || null;
      }

      station.selectedTopic = resolvedTopic;
      station.selectedTopicId = resolvedTopic?.id || null;
      station.selectedImageId = null;
      station.selectedImage = null;
      station.wheelSpin = null;
      station.status = 'WAITING';
    } else {
      station.selectedImageId = null;
      station.selectedImage = null;
      station.selectedTopicId = null;
      station.selectedTopic = null;
      station.wheelSpin = null;
      station.status = 'WAITING';
    }
  }

  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, station });
});

/**
 * Synchronized Slot Resolution Helper
 * Resolves or creates a deterministic slot item for Round 1 (Image) or Round 2 (Topic)
 * ensuring all stations get the identical item for slotIndex, while preventing
 * duplicates across different slots even when stations progress at different speeds.
 */
function getOrAssignSlotItem(
  round: 'round1' | 'round2',
  slotIndex: number,
  stationId?: string,
  preferredCandidateIds?: string[]
): { item: EventImage | Topic | null; isNew: boolean } {
  if (!db.synchronizedSlots) {
    db.synchronizedSlots = { round1: {}, round2: {} };
  }
  if (!db.synchronizedSlots[round]) {
    db.synchronizedSlots[round] = {};
  }

  // 1. Check if slot already has an item assigned
  const existingId = db.synchronizedSlots[round][slotIndex];
  if (existingId) {
    if (round === 'round1') {
      const img = db.images.find((i) => i.id === existingId || i.imageId === existingId);
      if (img) return { item: img, isNew: false };
    } else {
      const top = db.topics.find((t) => t.id === existingId || t.topicId === existingId);
      if (top) return { item: top, isNew: false };
    }
  }

  // 2. Not assigned yet -> First station reaching this slot!
  // Collect all item IDs already assigned across ANY slot in this round to prevent cross-slot repetition
  const assignedSlotIds = new Set<string>();
  Object.entries(db.synchronizedSlots[round]).forEach(([k, id]) => {
    if (Number(k) !== slotIndex && id) {
      assignedSlotIds.add(id);
    }
  });

  if (round === 'round1') {
    // Candidates not assigned to any other slot and compatible with this station
    const candidates = db.images.filter((img) => {
      if (stationId && img.stationId && img.stationId !== 'all' && img.stationId !== stationId) {
        return false;
      }
      return !assignedSlotIds.has(img.id) && !assignedSlotIds.has(img.imageId || '');
    });
    let pool = candidates.filter((i) => i.status === 'available');
    if (pool.length === 0) {
      pool = candidates.length > 0 ? candidates : db.images.filter((img) => !assignedSlotIds.has(img.id));
    }
    if (pool.length === 0) {
      pool = db.images;
    }
    if (pool.length === 0) return { item: null, isNew: false };

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    db.synchronizedSlots.round1[slotIndex] = chosen.id;
    persistDB();
    broadcastSSE('slots_updated', db.synchronizedSlots);

    // NOTE: We intentionally do NOT broadcast this image to other stations here.
    // Each station's operator must explicitly request an image via the assign-image endpoint.
    // When they do, getOrAssignSlotItem will return this same pre-chosen slot image (the
    // early-return above), ensuring synchronization without pushing images prematurely.

    return { item: chosen, isNew: true };
  } else {
    // Round 2 Topics
    const candidates = db.topics.filter(
      (t) => !assignedSlotIds.has(t.id) && !assignedSlotIds.has(t.topicId || '')
    );
    let pool = candidates.filter((t) => t.status === 'available');
    if (pool.length === 0) {
      pool = candidates.length > 0 ? candidates : db.topics.filter((t) => !assignedSlotIds.has(t.id));
    }
    if (pool.length === 0) {
      pool = db.topics;
    }
    if (pool.length === 0) return { item: null, isNew: false };

    let chosen: Topic;
    if (Array.isArray(preferredCandidateIds) && preferredCandidateIds.length > 0) {
      const wheelCandidates = pool.filter((t) => preferredCandidateIds.includes(t.id));
      if (wheelCandidates.length > 0) {
        chosen = wheelCandidates[Math.floor(Math.random() * wheelCandidates.length)];
      } else {
        chosen = pool[Math.floor(Math.random() * pool.length)];
      }
    } else {
      chosen = pool[Math.floor(Math.random() * pool.length)];
    }

    db.synchronizedSlots.round2[slotIndex] = chosen.id;
    persistDB();
    broadcastSSE('slots_updated', db.synchronizedSlots);

    // Synchronize any other stations currently waiting at this same heat slot in Round 2
    if (db.stations) {
      Object.values(db.stations).forEach((st) => {
        if (st.currentRound === 2 && st.activeParticipant) {
          const stResultsCount = db.round2Results.filter((r) => {
            const p = db.participants.find((item) => item.id === r.participantId);
            return p?.stationId === st.id || p?.round2StationId === st.id;
          }).length;
          const stSlot =
            typeof (st.activeParticipant as any).round2SlotIndex === 'number' &&
            (st.activeParticipant as any).round2SlotIndex >= 0
              ? (st.activeParticipant as any).round2SlotIndex
              : stResultsCount;

          if (stSlot === slotIndex && (!st.selectedTopic || st.selectedTopic.id !== chosen.id)) {
            st.selectedTopic = chosen;
            st.selectedTopicId = chosen.id;
            (st.activeParticipant as any).round2SlotIndex = slotIndex;
            (st.activeParticipant as any).round2TopicId = chosen.id;
            broadcastStationUpdate(st.id, 'station_updated', st);
          }
        }
      });
    }

    return { item: chosen, isNew: true };
  }
}

// Atomic Round 1 Image Assignment for Station (Supports Synchronized Heat Slots)
app.post('/api/stations/:id/assign-image', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const currentGlobalRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;
  if (currentGlobalRound !== 1) {
    return res.status(403).json({
      error: `Cannot assign images: The event is currently in Round ${currentGlobalRound}, not Round 1.`,
    });
  }
  const { participantId, participantName, slotIndex: reqSlotIndex, imageId } = req.body;

  if (participantId) {
    station.activeParticipantId = participantId;
    station.activeParticipant = db.participants.find((p) => p.id === participantId) || station.activeParticipant;
  }

  const targetParticipant = station.activeParticipant || (participantId ? db.participants.find((p) => p.id === participantId) : null);

  // Determine slot index dynamically based on turn order
  let slotIndex = typeof reqSlotIndex === 'number' && reqSlotIndex >= 0 ? reqSlotIndex : -1;
  if (slotIndex === -1 && targetParticipant) {
    if (typeof (targetParticipant as any).round1SlotIndex === 'number' && (targetParticipant as any).round1SlotIndex >= 0) {
      slotIndex = (targetParticipant as any).round1SlotIndex;
    }
  }
  if (slotIndex === -1) {
    slotIndex = db.round1Results.filter((r) => {
      const p = db.participants.find((item) => item.id === r.participantId);
      return p?.stationId === station.id || p?.round1StationId === station.id;
    }).length;
  }
  if (slotIndex === -1) slotIndex = 0;

  const isSynchronized = db.settings.round1.synchronizedSlots !== false;
  let chosen: EventImage | null = null;

  if (imageId) {
    const found = db.images.find((img) => img.id === imageId || img.imageId === imageId);
    if (found) {
      chosen = found;
      if (isSynchronized) {
        db.synchronizedSlots.round1[slotIndex] = chosen.id;
        persistDB();
        broadcastSSE('slots_updated', db.synchronizedSlots);
      }
    }
  }

  if (!chosen && isSynchronized) {
    const slotRes = getOrAssignSlotItem('round1', slotIndex, station.id);
    chosen = slotRes.item as EventImage | null;
  }

  if (!chosen) {
    // Build a station-aware pool, mirroring the frontend's stationImages filter:
    // 1. Dedicated pool: images explicitly assigned to this station
    // 2. Universal pool: images with no station assignment (or 'all')
    // Images assigned to a DIFFERENT station are always excluded.
    const eligibleImages = db.images.filter((img) => {
      if (img.stationId && img.stationId !== 'all' && img.stationId !== station.id) {
        return false; // belongs to a different station
      }
      return true;
    });
    const dedicatedImages = eligibleImages.filter((img) => img.stationId === station.id);
    const stationPool = dedicatedImages.length > 0 ? dedicatedImages : eligibleImages;

    // Filter out images already displayed on this station to ensure re-roll picks a different image
    let candidates: EventImage[] = stationPool.filter(
      (img) => img.status === 'available' && (!station.selectedImageId || img.id !== station.selectedImageId)
    );
    if (candidates.length === 0) {
      candidates = stationPool.filter((img) => img.status === 'available');
    }
    if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
      candidates = stationPool.filter((img) => !station.selectedImageId || img.id !== station.selectedImageId);
      if (candidates.length === 0) candidates = stationPool;
    }

    if (candidates.length === 0) {
      if (db.settings.round1.allowImageReuse && stationPool.length > 0) {
        candidates = stationPool;
      } else {
        return res.status(409).json({
          error: `No unused images available for this station. Please upload images or allow image reuse in settings.`,
        });
      }
    }

    chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (isSynchronized && chosen) {
      db.synchronizedSlots.round1[slotIndex] = chosen.id;
      persistDB();
      broadcastSSE('slots_updated', db.synchronizedSlots);
    }
  }

  // Mark as used globally if NOT in synchronized slots mode (synchronized slots are shared across stations for that slot)
  if (!db.settings.round1.allowImageReuse && !isSynchronized) {
    chosen.status = 'used';
    chosen.usedByParticipantId = station.activeParticipantId || undefined;
    chosen.usedByParticipantName = participantName || station.activeParticipant?.name || undefined;
    chosen.usedAt = new Date().toISOString();
  }

  station.selectedImageId = chosen.id;
  station.selectedImage = chosen;
  station.imageRotation = 0;
  station.currentRound = 1;

  if (station.activeParticipantId) {
    const p = db.participants.find((item) => item.id === station.activeParticipantId);
    if (p) {
      p.round1ImageId = chosen.imageId || chosen.name || chosen.id;
      p.round1SlotIndex = slotIndex;
      p.slotIndex = slotIndex;
    }
  }

  const hasPrep = (db.settings.round1.prepTimeSeconds || 0) > 0;
  if (hasPrep) {
    station.status = 'PREPARING';
    station.timerMode = 'prep';
    station.timerTotalSeconds = db.settings.round1.prepTimeSeconds || 30;
    station.timerRemainingSeconds = db.settings.round1.prepTimeSeconds || 30;
  } else {
    station.status = 'SPEAKING';
    station.timerMode = 'speech';
    station.timerTotalSeconds = db.settings.round1.speechTimeSeconds || 120;
    station.timerRemainingSeconds = db.settings.round1.speechTimeSeconds || 120;
  }

  station.isTimerRunning = false;
  station.timerStartedAt = null;
  station.timerEndsAt = null;

  persistDB();
  logAction('Image Assigned', `Assigned image "${chosen.name}" at ${station.name} (Heat Slot ${slotIndex + 1}) to contestant ${participantName || station.activeParticipant?.name || 'Contestant'}`);

  broadcastSSE('images_updated', db.images);
  broadcastStationUpdate(station.id, 'station_updated', station);

  res.json({ success: true, image: chosen, station, slotIndex });
});

// Rotate Image for Station
app.post('/api/stations/:id/rotate-image', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { rotation } = req.body;
  const nextRot = typeof rotation === 'number' ? ((rotation % 360) + 360) % 360 : (((station.imageRotation || 0) + 90) % 360);

  station.imageRotation = nextRot;
  if (station.selectedImage) {
    station.selectedImage.rotation = nextRot;
  }

  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, station, imageRotation: nextRot });
});

// Atomic Round 2 Topic Spin for Station (Supports Synchronized Heat Slots & Slot Preservation)
app.post('/api/stations/:id/spin-topic', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const currentGlobalRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;
  if (currentGlobalRound !== 2) {
    return res.status(403).json({
      error: `Cannot spin topic wheel: The event is currently in Round ${currentGlobalRound}, not Round 2.`,
    });
  }
  const { participantId, participantName, wheelTopicIds, slotIndex: reqSlotIndex } = req.body;

  if (participantId) {
    station.activeParticipantId = participantId;
    station.activeParticipant = db.participants.find((p) => p.id === participantId) || station.activeParticipant;
  }

  const targetParticipant = station.activeParticipant || (participantId ? db.participants.find((p) => p.id === participantId) : null);

  // Determine slot index dynamically based on turn order
  let slotIndex = typeof reqSlotIndex === 'number' && reqSlotIndex >= 0 ? reqSlotIndex : -1;
  if (slotIndex === -1 && targetParticipant) {
    if (typeof (targetParticipant as any).round2SlotIndex === 'number' && (targetParticipant as any).round2SlotIndex >= 0) {
      slotIndex = (targetParticipant as any).round2SlotIndex;
    }
  }
  if (slotIndex === -1) {
    slotIndex = db.round2Results.filter((r) => {
      const p = db.participants.find((item) => item.id === r.participantId);
      return p?.stationId === station.id || p?.round2StationId === station.id;
    }).length;
  }
  if (slotIndex === -1) slotIndex = 0;

  const isSynchronized = db.settings.round2.synchronizedSlots !== false;

  const assignedTopicIds = new Set<string>(Object.values(db.synchronizedSlots?.round2 || {}));

  // Universal topics pool, excluding topics assigned to other synchronized slots
  const availablePool = db.topics.filter(
    (t) => !isSynchronized || !assignedTopicIds.has(t.id) || db.synchronizedSlots?.round2[slotIndex] === t.id
  );
  let pool: Topic[] = availablePool.filter((t) => t.status === 'available');
  if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
    pool = availablePool.length > 0 ? availablePool : db.topics;
  }
  if (pool.length === 0) {
    pool = db.topics;
  }

  // Ensure candidates are selected from the active wheel slices (preserving wheel order)
  const wheelCount = db.settings.round2.activeWheelTopicCount || 20;
  let candidates: Topic[] = [];

  const topicsMap = new Map(db.topics.map((t) => [t.id, t]));

  if (Array.isArray(wheelTopicIds) && wheelTopicIds.length > 0) {
    // Preserve exact client slot count and order
    candidates = wheelTopicIds.map((id) => {
      const topic = topicsMap.get(id);
      // If topic is available or reuse allowed, keep it
      if (topic && (db.settings.round2.topicReuseAllowed || topic.status === 'available')) {
        return topic;
      }
      // Otherwise replace this slot with next unused topic
      const nextUnused = pool.find((p) => !wheelTopicIds.includes(p.id) && !candidates.some((c) => c?.id === p.id));
      return nextUnused || topic || pool[0];
    });
  } else if (station.activeWheelTopics && station.activeWheelTopics.length > 0) {
    candidates = [...station.activeWheelTopics];
  } else {
    candidates = pool.slice(0, wheelCount);
  }

  // Ensure candidates has no null/undefined and has at least 1 topic
  candidates = candidates.filter(Boolean);
  if (candidates.length === 0) {
    candidates = pool.slice(0, wheelCount);
  }

  let chosen: Topic;
  if (isSynchronized) {
    const slotRes = getOrAssignSlotItem('round2', slotIndex, station.id, candidates.map((c) => c.id));
    chosen = (slotRes.item as Topic) || candidates[0];
    // Guarantee that chosen topic is mounted onto the wheel slices!
    if (!candidates.some((c) => c.id === chosen.id)) {
      candidates[0] = chosen;
    }
  } else {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const targetIndex = candidates.findIndex((t) => t.id === chosen.id);

  // Update station active wheel topics to match this exact candidates list
  station.activeWheelTopics = [...candidates];

  if (station.activeParticipantId) {
    const p = db.participants.find((item) => item.id === station.activeParticipantId);
    if (p) {
      p.round2TopicId = chosen.topicId || chosen.id;
      p.round2SlotIndex = slotIndex;
      p.slotIndex = slotIndex;
    }
  }

  // Immediately claim as USED in backend (if not synchronized across stations for that slot)
  if (!db.settings.round2.topicReuseAllowed && !isSynchronized) {
    chosen.status = 'used';
    chosen.usedByParticipantId = station.activeParticipantId || undefined;
    chosen.usedByParticipantName = participantName || station.activeParticipant?.name || undefined;
    chosen.usedAt = new Date().toISOString();
  }

  const spinDurationMs = 4800;
  const startedAt = Date.now();

  station.currentRound = 2;
  // Keep topic hidden while wheel is spinning!
  station.selectedTopicId = null;
  station.selectedTopic = null;
  station.pendingTopic = chosen;
  station.status = 'SPINNING';
  station.wheelSpin = {
    isSpinning: true,
    targetTopicId: chosen.id,
    targetTopicTitle: chosen.topic,
    targetTopicCategory: chosen.category,
    targetSliceIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
  };

  persistDB();
  logAction('Topic Spun', `Wheel spin initiated at ${station.name} (Heat Slot ${slotIndex + 1}) for contestant ${participantName || station.activeParticipant?.name || 'Contestant'}`);

  broadcastStationUpdate(station.id, 'wheel_spin_started', {
    stationId: station.id,
    topic: chosen,
    targetTopicId: chosen.id,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
    slotIndex,
  });
  broadcastSSE('topics_updated', db.topics);
  broadcastStationUpdate(station.id, 'station_updated', station);

  res.json({
    success: true,
    topic: chosen,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
    station,
    slotIndex,
  });
});

// Complete Round 2 Spin -> Reveal topic, transition to Speaking mode & replace used slice on wheel
app.post('/api/stations/:id/spin-complete', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const speechSec = db.settings.round2.speechTimeSeconds || 120;

  // Reveal winning topic now that spin is fully complete
  const winningTopic = station.pendingTopic || station.selectedTopic || db.topics.find((t) => t.id === station.wheelSpin?.targetTopicId);
  if (winningTopic) {
    station.selectedTopic = winningTopic;
    station.selectedTopicId = winningTopic.id;

    // Slot-preservation topic replacement:
    // Replace the used topic in the wheel candidates with a fresh unused topic from the pool
    let currentWheel = (station.activeWheelTopics || station.wheelSpin?.wheelTopics || []).filter(Boolean);
    if (currentWheel.length === 0) {
      const wheelCount = db.settings.round2.activeWheelTopicCount || 20;
      currentWheel = db.topics.filter((t) => t && t.status === 'available').slice(0, wheelCount);
    }
    const targetIdx = currentWheel.findIndex((t) => t && t.id === winningTopic.id);
    if (targetIdx !== -1) {
      const assignedTopicIds = new Set(Object.values(db.synchronizedSlots?.round2 || {}));
      const replacement = db.topics.find(
        (t) => t && t.status === 'available' &&
               t.id !== winningTopic.id &&
               !currentWheel.some((w) => w && w.id === t.id) &&
               !assignedTopicIds.has(t.id) &&
               !assignedTopicIds.has(t.topicId || '')
      ) || db.topics.find(
        (t) => t && t.status === 'available' && t.id !== winningTopic.id && !currentWheel.some((w) => w && w.id === t.id)
      ) || db.topics.find(
        (t) => t && t.id !== winningTopic.id && !currentWheel.some((w) => w && w.id === t.id)
      );
      if (replacement) {
        currentWheel[targetIdx] = replacement;
      }
      station.activeWheelTopics = [...currentWheel].filter(Boolean);
    }
  }
  station.pendingTopic = undefined;
  station.wheelSpin = null;

  // Setup speaking timer ready for operator to start (avoid auto-start desync with operator dashboard)
  station.status = 'READY_TO_SPEAK';
  station.timerMode = 'speech';
  station.timerTotalSeconds = speechSec;
  station.timerRemainingSeconds = speechSec;
  station.isTimerRunning = false;
  station.timerStartedAt = null;
  station.timerEndsAt = null;

  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, station, winningTopic, activeWheelTopics: station.activeWheelTopics });
});

// Explicit endpoint to replace a used topic on a station's wheel
app.post('/api/stations/:id/wheel-replace', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { usedTopicId, replacementTopicId } = req.body;
  let currentWheel = (station.activeWheelTopics || []).filter(Boolean);
  const wheelCount = db.settings.round2.activeWheelTopicCount || 20;
  if (currentWheel.length === 0) {
    currentWheel = db.topics.filter((t) => t && t.status === 'available').slice(0, wheelCount);
  }

  if (usedTopicId) {
    const idx = currentWheel.findIndex((t) => t && t.id === usedTopicId);
    if (idx !== -1) {
      const assignedTopicIds = new Set(Object.values(db.synchronizedSlots?.round2 || {}));
      const replacement = replacementTopicId
        ? db.topics.find((t) => t && t.id === replacementTopicId)
        : db.topics.find(
            (t) => t && t.status === 'available' &&
                   t.id !== usedTopicId &&
                   !currentWheel.some((w) => w && w.id === t.id) &&
                   !assignedTopicIds.has(t.id) &&
                   !assignedTopicIds.has(t.topicId || '')
          ) || db.topics.find(
            (t) => t && t.status === 'available' && t.id !== usedTopicId && !currentWheel.some((w) => w && w.id === t.id)
          ) || db.topics.find(
            (t) => t && t.id !== usedTopicId && !currentWheel.some((w) => w && w.id === t.id)
          );
      if (replacement) {
        currentWheel[idx] = replacement;
      }
    }
  }
  station.activeWheelTopics = [...currentWheel].filter(Boolean);
  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', station);
  res.json({ success: true, activeWheelTopics: station.activeWheelTopics });
});

// Synchronized Slots Management Endpoints
app.get('/api/slots', (req: Request, res: Response) => {
  if (!db.synchronizedSlots) db.synchronizedSlots = { round1: {}, round2: {} };
  res.json({
    success: true,
    synchronizedSlots: db.synchronizedSlots,
  });
});

app.post('/api/slots/reset', (req: Request, res: Response) => {
  const { round } = req.body;
  if (!db.synchronizedSlots) db.synchronizedSlots = { round1: {}, round2: {} };
  if (!round || round === 'all' || round === 'round1') {
    db.synchronizedSlots.round1 = {};
    db.participants.forEach((p) => {
      delete p.round1ImageId;
      delete p.round1SlotIndex;
      delete p.slotIndex;
    });
    if (db.stations) {
      Object.values(db.stations).forEach((s) => {
        if (s.currentRound === 1) {
          s.selectedImage = null;
          s.selectedImageId = null;
        }
      });
    }
  }
  if (!round || round === 'all' || round === 'round2') {
    db.synchronizedSlots.round2 = {};
    db.participants.forEach((p) => {
      delete (p as any).round2TopicId;
      delete (p as any).round2SlotIndex;
    });
    if (db.stations) {
      Object.values(db.stations).forEach((s) => {
        if (s.currentRound === 2) {
          s.selectedTopic = null;
          s.selectedTopicId = null;
        }
      });
    }
  }
  persistDB();
  broadcastSSE('slots_updated', db.synchronizedSlots);
  if (db.stations) {
    broadcastSSE('stations_updated', Object.values(db.stations));
  }
  broadcastSSE('participants_updated', db.participants);
  logAction('Slots Reset', `Synchronized heat slots were reset (Round: ${round || 'all'})`);
  res.json({ success: true, synchronizedSlots: db.synchronizedSlots });
});

app.post('/api/slots/pregenerate', (req: Request, res: Response) => {
  const { count = 30, round = 'all' } = req.body;
  if (!db.synchronizedSlots) db.synchronizedSlots = { round1: {}, round2: {} };

  if (round === 'all' || round === 'round1') {
    const assignedIds = new Set<string>(Object.values(db.synchronizedSlots.round1));
    let available = db.images.filter((i) => !assignedIds.has(i.id) && !assignedIds.has(i.imageId || ''));
    for (let i = 0; i < count; i++) {
      if (!db.synchronizedSlots.round1[i]) {
        if (available.length === 0) available = [...db.images];
        if (available.length > 0) {
          const idx = Math.floor(Math.random() * available.length);
          const chosen = available.splice(idx, 1)[0];
          db.synchronizedSlots.round1[i] = chosen.id;
        }
      }
    }

    // Sync stations currently in Round 1
    if (db.stations) {
      Object.values(db.stations).forEach((st) => {
        if (st.currentRound === 1 && st.activeParticipant) {
          const stResultsCount = db.round1Results.filter((r) => {
            const p = db.participants.find((item) => item.id === r.participantId);
            return p?.stationId === st.id || p?.round1StationId === st.id;
          }).length;
          const stSlot =
            typeof (st.activeParticipant as any).round1SlotIndex === 'number' &&
            (st.activeParticipant as any).round1SlotIndex >= 0
              ? (st.activeParticipant as any).round1SlotIndex
              : stResultsCount;

          const slotImgId = db.synchronizedSlots.round1[stSlot];
          if (slotImgId && (!st.selectedImage || st.selectedImage.id !== slotImgId)) {
            const found = db.images.find((img) => img.id === slotImgId || img.imageId === slotImgId);
            if (found) {
              st.selectedImage = found;
              st.selectedImageId = found.id;
              (st.activeParticipant as any).round1SlotIndex = stSlot;
              (st.activeParticipant as any).round1ImageId = found.imageId || found.name || found.id;
            }
          }
        }
      });
    }
  }

  if (round === 'all' || round === 'round2') {
    const assignedIds = new Set<string>(Object.values(db.synchronizedSlots.round2));
    let available = db.topics.filter((t) => !assignedIds.has(t.id) && !assignedIds.has(t.topicId || ''));
    for (let i = 0; i < count; i++) {
      if (!db.synchronizedSlots.round2[i]) {
        if (available.length === 0) available = [...db.topics];
        if (available.length > 0) {
          const idx = Math.floor(Math.random() * available.length);
          const chosen = available.splice(idx, 1)[0];
          db.synchronizedSlots.round2[i] = chosen.id;
        }
      }
    }

    // Sync stations currently in Round 2
    if (db.stations) {
      Object.values(db.stations).forEach((st) => {
        if (st.currentRound === 2 && st.activeParticipant) {
          const stResultsCount = db.round2Results.filter((r) => {
            const p = db.participants.find((item) => item.id === r.participantId);
            return p?.stationId === st.id || p?.round2StationId === st.id;
          }).length;
          const stSlot =
            typeof (st.activeParticipant as any).round2SlotIndex === 'number' &&
            (st.activeParticipant as any).round2SlotIndex >= 0
              ? (st.activeParticipant as any).round2SlotIndex
              : stResultsCount;

          const slotTopicId = db.synchronizedSlots.round2[stSlot];
          if (slotTopicId && (!st.selectedTopic || st.selectedTopic.id !== slotTopicId)) {
            const found = db.topics.find((top) => top.id === slotTopicId || top.topicId === slotTopicId);
            if (found) {
              st.selectedTopic = found;
              st.selectedTopicId = found.id;
              (st.activeParticipant as any).round2SlotIndex = stSlot;
              (st.activeParticipant as any).round2TopicId = found.id;
            }
          }
        }
      });
    }
  }

  persistDB();
  broadcastSSE('slots_updated', db.synchronizedSlots);
  if (db.stations) {
    broadcastSSE('stations_updated', Object.values(db.stations));
  }
  logAction('Slots Pre-Generated', `Pre-generated ${count} synchronized heat slots for ${round || 'all rounds'}`);
  res.json({ success: true, synchronizedSlots: db.synchronizedSlots });
});

// Independent Station Timer Action with Shared Timestamp Synchronization & Continuous Overtime
app.post('/api/stations/:id/timer', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { action, phase, totalSeconds, remainingSeconds, round, endsAt, startedAt } = req.body;
  const now = Date.now();
  const effectiveStart = typeof startedAt === 'number' && Math.abs(now - startedAt) < 2500 ? startedAt : now;
  const roundSettings = (db.settings as any)[`round${station.currentRound}`] || db.settings.round1;

  if (action === 'start') {
    const currentGlobalRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;
    if (station.currentRound !== currentGlobalRound) {
      return res.status(403).json({
        error: `Station is currently in Round ${station.currentRound}, but the active event round is Round ${currentGlobalRound}. Timers can only be run for the active competition round.`,
      });
    }

    // Strict Round 1 check-in gating
    if (station.currentRound === 1 && station.activeParticipantId) {
      const activeP = db.participants.find((p) => p.id === station.activeParticipantId);
      if (activeP && !activeP.checkedIn && activeP.status !== 'checked_in') {
        return res.status(403).json({
          error: `Contestant ${activeP.name} has not checked in to the location yet. Check-in is required before Round 1 can be started.`,
        });
      }
    }

    const activePhase = phase || station.timerMode || (roundSettings.prepEnabled ? 'prep' : 'speech');
    const defaultSec = activePhase === 'prep' ? (roundSettings.prepTimeSeconds || 30) : (roundSettings.speechTimeSeconds || 120);
    const duration = totalSeconds || station.timerDuration || defaultSec;
    const rem = typeof remainingSeconds === 'number' ? remainingSeconds : duration;

    station.timerMode = activePhase;
    station.timerDuration = duration;
    station.timerTotalSeconds = duration;
    station.timerRemainingSeconds = rem;
    station.isTimerRunning = true;
    station.timerStatus = 'running';
    station.timerStartTime = effectiveStart;
    station.timerStartedAt = effectiveStart;
    station.timerAccumulatedMs = rem < duration ? Math.max(0, (duration - rem) * 1000) : 0;
    station.timerEndsAt = typeof endsAt === 'number' ? endsAt : effectiveStart + rem * 1000;
    station.timerStopTime = null;
    station.status = station.timerMode === 'prep' ? 'PREPARING' : 'SPEAKING';
    station.buzzerPlayed = false;
    station.isOvertime = false;
    station.overtimeSeconds = 0;
  } else if (action === 'pause') {
    const runMs = station.timerStartTime ? now - station.timerStartTime : 0;
    station.timerAccumulatedMs = (station.timerAccumulatedMs || 0) + runMs;
    station.timerStartTime = null;
    station.timerStartedAt = null;
    station.timerEndsAt = null;
    station.timerStatus = 'paused';
    station.isTimerRunning = false;
    station.status = 'PAUSED';

    const totalElapsedSec = Math.floor((station.timerAccumulatedMs || 0) / 1000);
    station.timerRemainingSeconds = Math.max(0, (station.timerDuration || 120) - totalElapsedSec);
  } else if (action === 'resume') {
    const currentGlobalRound = (db.liveSync?.currentRound || 1) as 1 | 2 | 3;
    if (station.currentRound !== currentGlobalRound) {
      return res.status(403).json({
        error: `Station is currently in Round ${station.currentRound}, but the active event round is Round ${currentGlobalRound}. Timers can only be run for the active competition round.`,
      });
    }

    // Strict Round 1 check-in gating
    if (station.currentRound === 1 && station.activeParticipantId) {
      const activeP = db.participants.find((p) => p.id === station.activeParticipantId);
      if (activeP && !activeP.checkedIn && activeP.status !== 'checked_in') {
        return res.status(403).json({
          error: `Contestant ${activeP.name} has not checked in to the location yet. Check-in is required before Round 1 can be started.`,
        });
      }
    }

    station.timerStartTime = now;
    station.timerStartedAt = now;
    station.timerStatus = 'running';
    station.isTimerRunning = true;
    station.status = station.timerMode === 'prep' ? 'PREPARING' : 'SPEAKING';

    const totalElapsedSec = Math.floor((station.timerAccumulatedMs || 0) / 1000);
    const remSec = Math.max(0, (station.timerDuration || 120) - totalElapsedSec);
    station.timerEndsAt = now + remSec * 1000;
  } else if (action === 'transition_to_speech') {
    // Prep complete: automatically transition directly to Speaking phase
    const speechSec = roundSettings.speechTimeSeconds || 120;
    station.timerMode = 'speech';
    station.timerDuration = speechSec;
    station.timerTotalSeconds = speechSec;
    station.timerRemainingSeconds = speechSec;
    station.isTimerRunning = true;
    station.timerStatus = 'running';
    station.timerStartTime = now;
    station.timerStartedAt = now;
    station.timerAccumulatedMs = 0;
    station.timerEndsAt = now + speechSec * 1000;
    station.timerStopTime = null;
    station.status = 'SPEAKING';
    station.buzzerPlayed = false;
    station.isOvertime = false;
    station.overtimeSeconds = 0;
  } else if (action === 'warning_buzzer') {
    if (roundSettings.warningBuzzerEnabled !== false) {
      const eventId = `warning-${now}-${station.id}`;
      broadcastStationUpdate(station.id, 'buzzer_trigger', {
        timestamp: now,
        eventId,
        stationId: station.id,
        stationName: station.name,
        source: 'warning_buzzer',
        soundType: 'warning',
        reason: 'Mid-Round Timing Warning',
        round: round || `Round ${station.currentRound}`,
        participantName: station.activeParticipant?.name,
        sound: db.settings.buzzer.warningSound || 'double_beep',
        volume: db.settings.buzzer.warningVolume ?? 85,
      });
    }
  } else if (action === 'limit_reached' || action === 'time_up') {
    // TIME LIMIT REACHED: trigger buzzer once, BUT KEEP TIMER RUNNING IN OVERTIME!
    station.buzzerPlayed = true;
    station.isOvertime = true;
    station.buzzerTimestamp = now;
    station.lastBuzzerEventId = `buzzer-${now}-${station.id}`;

    if (roundSettings.buzzerEnabled) {
      broadcastStationUpdate(station.id, 'buzzer_trigger', {
        timestamp: now,
        eventId: station.lastBuzzerEventId,
        stationId: station.id,
        stationName: station.name,
        source: 'time_limit',
        reason: 'Time Limit Reached (Overtime Begins)',
        round: round || `Round ${station.currentRound}`,
        participantName: station.activeParticipant?.name,
        sound: db.settings.buzzer.sound,
        volume: db.settings.buzzer.volume,
      });
    }
  } else if (action === 'stop' || action === 'stop_with_buzzer') {
    // STOP TIMER: Operator clicked Stop button -> freeze timer cleanly with NO sound and NO buzzer!
    const runMs = station.timerStartTime ? now - station.timerStartTime : 0;
    station.timerAccumulatedMs = (station.timerAccumulatedMs || 0) + runMs;
    station.timerStartTime = null;
    station.timerStartedAt = null;
    station.timerStopTime = now;
    station.timerEndsAt = null;
    station.isTimerRunning = false;
    station.timerStatus = 'stopped';
    station.status = 'TIME_UP';

    const totalElapsedSec = Math.floor(station.timerAccumulatedMs / 1000);
    const duration = station.timerDuration || 120;
    station.isOvertime = totalElapsedSec > duration;
    station.overtimeSeconds = station.isOvertime ? totalElapsedSec - duration : 0;
    // Deliberately NO buzzer sound, NO buzzerTimestamp, and NO buzzer_trigger SSE broadcast on stop
  } else if (action === 'reset') {
    const initSec = (roundSettings.prepEnabled && (roundSettings.prepTimeSeconds || 0) > 0)
      ? roundSettings.prepTimeSeconds
      : (roundSettings.speechTimeSeconds || 120);

    station.isTimerRunning = false;
    station.timerStatus = 'idle';
    station.status = 'WAITING';
    station.timerMode = 'idle';
    station.timerDuration = initSec;
    station.timerTotalSeconds = initSec;
    station.timerRemainingSeconds = initSec;
    station.timerAccumulatedMs = 0;
    station.timerStartTime = null;
    station.timerStartedAt = null;
    station.timerEndsAt = null;
    station.timerStopTime = null;
    station.buzzerPlayed = false;
    station.isOvertime = false;
    station.overtimeSeconds = 0;
  }

  persistDB();
  broadcastStationUpdate(station.id, 'station_updated', { ...station, serverTime: now });
  res.json({ success: true, station, serverTime: now });
});

// RESET ALL STATUSES (Master / Admin Command)
// Resets temporary event progress, timers, used images, used topics, active station states
// Preserves all permanent participant data!
app.post('/api/event/reset-all-statuses', (req: Request, res: Response) => {
  // 1. Reset all stations to initial WAITING state
  if (!db.stations) db.stations = {};
  (db.settings.stations || []).forEach((s) => {
    db.stations![s.id] = createInitialStationState(s.id, s.name, s.location);
  });

  // 2. Reset participants round statuses (DO NOT DELETE PARTICIPANT RECORDS!)
  db.participants.forEach((p) => {
    p.status = 'registered';
    p.checkedIn = false;
    delete p.checkedInAt;
    delete p.checkedInStationId;
    delete p.checkedInStationName;
    delete p.checkedInBy;
    p.round1Status = 'pending';
    p.round2Status = 'pending';
    p.round3Status = 'pending';
    p.round1Qualified = 'pending';
    p.round2Qualified = 'pending';
    p.round3Qualified = 'pending';
    delete p.qualificationReason;
    delete p.round1ImageId;
    delete p.round1SlotIndex;
    delete p.slotIndex;
    delete (p as any).round2TopicId;
    delete (p as any).round2SlotIndex;
  });

  // 3. Reset all images to available
  db.images.forEach((img) => {
    img.status = 'available';
    delete img.usedByParticipantId;
    delete img.usedByParticipantName;
    delete img.usedAt;
  });

  // 4. Reset all topics to available
  db.topics.forEach((t) => {
    t.status = 'available';
    delete t.usedByParticipantId;
    delete t.usedByParticipantName;
    delete t.usedAt;
  });

  // 5. Clear round results & synchronized slots
  db.round1Results = [];
  db.round2Results = [];
  db.round3Results = [];
  db.synchronizedSlots = { round1: {}, round2: {} };

  // 6. Reset global live sync
  const defaultSpeechSec = db.settings.round1.speechTimeSeconds || 120;
  db.liveSync = {
    currentRound: 1,
    activeParticipantId: null,
    timerMode: 'idle',
    timerRemainingSeconds: defaultSpeechSec,
    timerTotalSeconds: defaultSpeechSec,
    isTimerRunning: false,
    timerStartedAt: null,
    timerEndsAt: null,
    wheelSpin: null,
    activeItem: undefined,
    stationStates: db.stations,
  };

  // 7. Synchronously persist to database file immediately so refresh NEVER restores old state
  persistDBSync();

  logAction(
    'Reset All Statuses',
    'Organizer performed complete status reset: all timers, station activities, and item pools cleared.'
  );

  // 8. Realtime broadcast to all connected devices (Master, Stations, Projectors, Mobile)
  broadcastSSE('reset_all_statuses', {
    stations: db.stations,
    participants: db.participants,
    images: db.images,
    topics: db.topics,
    liveSync: db.liveSync,
  });
  broadcastSSE('state_reset', db);
  broadcastSSE('stations_updated', Object.values(db.stations));

  res.json({
    success: true,
    message: 'All event statuses, station activities, timers, and pools successfully reset.',
    db,
  });
});

// Start New Event (Resets rounds, results, images, topics without deleting participants)
app.post('/api/event/start-new', (req: Request, res: Response) => {
  // Reset all stations
  if (!db.stations) db.stations = {};
  (db.settings.stations || []).forEach((s) => {
    db.stations![s.id] = createInitialStationState(s.id, s.name, s.location);
  });

  // Reset participants round statuses
  db.participants.forEach((p) => {
    p.status = 'registered';
    p.checkedIn = false;
    delete p.checkedInAt;
    delete p.checkedInStationId;
    delete p.checkedInStationName;
    delete p.checkedInBy;
    p.round1Status = 'pending';
    p.round2Status = 'pending';
    p.round3Status = 'pending';
    delete p.round1ImageId;
    delete p.round1SlotIndex;
    delete p.slotIndex;
    delete (p as any).round2TopicId;
    delete (p as any).round2SlotIndex;
  });

  // Reset images
  db.images.forEach((img) => {
    img.status = 'available';
    delete img.usedByParticipantId;
    delete img.usedByParticipantName;
    delete img.usedAt;
  });

  // Reset topics
  db.topics.forEach((t) => {
    t.status = 'available';
    delete t.usedByParticipantId;
    delete t.usedByParticipantName;
    delete t.usedAt;
  });

  // Clear results & synchronized slots
  db.round1Results = [];
  db.round2Results = [];
  db.round3Results = [];
  db.synchronizedSlots = { round1: {}, round2: {} };

  // Reset Live Sync
  db.liveSync = {
    currentRound: 1,
    activeParticipantId: null,
    timerMode: 'idle',
    timerRemainingSeconds: db.settings.round1.speechTimeSeconds || 120,
    timerTotalSeconds: db.settings.round1.speechTimeSeconds || 120,
    isTimerRunning: false,
    timerStartedAt: null,
    timerEndsAt: null,
    locationId: 'station-a',
    wheelSpin: null,
    activeItem: db.images[0]
      ? {
          type: 'image',
          title: db.images[0].name,
          mediaUrl: db.images[0].url,
          id: db.images[0].id,
        }
      : undefined,
    stationStates: db.stations,
  };

  persistDBSync();
  logAction('Event Reset', 'Organizer started a fresh event. All round progress and item pools reset.');
  broadcastSSE('state_reset', db);
  broadcastSSE('stations_updated', Object.values(db.stations));

  res.json({ success: true, message: 'Fresh event initialized successfully.' });
});

// Participants CRUD
app.get('/api/participants', (req: Request, res: Response) => {
  res.json(db.participants);
});

app.post('/api/participants', (req: Request, res: Response) => {
  const p: Partial<Participant> = req.body;
  if (!p.name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const newId = `p-${Date.now()}`;
  const count = db.participants.length + 1;
  const participantNumber = p.participantNumber || `M2M-${String(count).padStart(3, '0')}`;

  const newParticipant: Participant = {
    id: newId,
    participantNumber,
    name: p.name.trim(),
    mobile: p.mobile?.trim() || p.phone?.trim() || p.customData?.phone || p.customData?.mobile || '',
    phone: p.phone?.trim() || p.mobile?.trim() || p.customData?.phone || p.customData?.mobile || '',
    stationId: p.stationId || '',
    stationName: p.stationName || '',
    status: p.status || 'active',
    round1Status: p.round1Status || 'pending',
    round2Status: p.round2Status || 'pending',
    round3Status: p.round3Status || 'pending',
    customData: p.customData || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.participants.push(newParticipant);
  persistDB();
  logAction('Participant Added', `Added ${newParticipant.name} (${newParticipant.participantNumber})`);
  broadcastSSE('participants_updated', db.participants);
  broadcastSSE('participant_created', newParticipant);
  res.json(newParticipant);
});

app.put('/api/participants/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.participants.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const updated: Participant = {
    ...db.participants[idx],
    ...req.body,
    id: db.participants[idx].id, // protect id
    updatedAt: new Date().toISOString(),
  };

  db.participants[idx] = updated;
  persistDB();
  logAction('Participant Updated', `Updated details for ${updated.name} (${updated.participantNumber})`);
  broadcastSSE('participants_updated', db.participants);
  broadcastSSE('participant_updated', updated);
  res.json(updated);
});

app.delete('/api/participants/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const target = db.participants.find((p) => p.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  db.participants = db.participants.filter((p) => p.id !== id);
  persistDB();
  logAction('Participant Deleted', `Deleted participant ${target.name} (${target.participantNumber})`);
  broadcastSSE('participants_updated', db.participants);
  broadcastSSE('participant_deleted', { id });
  res.json({ success: true, id });
});

// Delete all participants
const removeAllParticipantsHandler = (req: Request, res: Response) => {
  const count = db.participants.length;
  db.participants = [];
  // Clear active participant references in stations
  if (db.stations) {
    Object.values(db.stations).forEach((s: any) => {
      delete s.activeParticipantId;
      delete s.activeParticipant;
    });
  }
  if (db.liveSync) {
    db.liveSync.activeParticipantId = null;
  }
  persistDB();
  logAction('All Participants Deleted', `Removed all ${count} contestants from the roster`);
  broadcastSSE('participants_updated', db.participants);
  if (db.stations) {
    broadcastSSE('stations_updated', Object.values(db.stations));
  }
  res.json({ success: true, count, participants: [] });
};

app.delete('/api/participants', removeAllParticipantsHandler);
app.post('/api/participants/delete-all', removeAllParticipantsHandler);

app.post('/api/participants/batch', (req: Request, res: Response) => {
  const items: Partial<Participant>[] = req.body.participants || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No participants provided' });
  }

  const created: Participant[] = [];
  let counter = db.participants.length + 1;

  for (const item of items) {
    if (!item.name) continue;
    const p: Participant = {
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      participantNumber: item.participantNumber || `M2M-${String(counter++).padStart(3, '0')}`,
      name: item.name.trim(),
      mobile: item.mobile?.trim() || item.phone?.trim() || item.customData?.phone || item.customData?.mobile || '',
      phone: item.phone?.trim() || item.mobile?.trim() || item.customData?.phone || item.customData?.mobile || '',
      stationId: item.stationId || '',
      stationName: item.stationName || '',
      status: item.status || 'active',
      round1Status: item.round1Status || 'pending',
      round2Status: item.round2Status || 'pending',
      round3Status: item.round3Status || 'pending',
      customData: item.customData || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.participants.push(p);
    created.push(p);
  }

  persistDB();
  logAction('Batch Participant Import', `Imported ${created.length} participants into the event`);
  broadcastSSE('participants_updated', db.participants);
  broadcastSSE('participants_batch_imported', created);
  res.json({ success: true, count: created.length, participants: created });
});

app.post('/api/participants/station/batch', (req: Request, res: Response) => {
  const { participantIds, stationId, stationName, forRound } = req.body;
  if (!Array.isArray(participantIds)) {
    return res.status(400).json({ error: 'participantIds array is required' });
  }

  const targetStationId = stationId === 'unassign' || stationId === 'all' || !stationId ? '' : stationId;
  const targetStationName = targetStationId ? (stationName || resolveStationName(targetStationId) || '') : '';

  const updated: Participant[] = [];
  participantIds.forEach((id) => {
    const idx = db.participants.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const p = db.participants[idx];
      p.stationId = targetStationId;
      p.stationName = targetStationName;
      if (forRound === 1) {
        p.round1StationId = targetStationId;
        p.round1StationName = targetStationName;
      } else if (forRound === 2) {
        p.round2StationId = targetStationId;
        p.round2StationName = targetStationName;
      } else if (forRound === 3) {
        p.round3StationId = targetStationId;
        p.round3StationName = targetStationName;
      }
      p.updatedAt = new Date().toISOString();
      updated.push(p);
    }
  });

  persistDB();
  logAction(
    'Batch Station Assignment',
    `Assigned ${updated.length} participants to station: ${targetStationName || 'Unassigned'}${forRound ? ` for Round ${forRound}` : ''}`
  );
  broadcastSSE('participants_batch_updated', updated);
  res.json({ success: true, count: updated.length, participants: updated });
});

// Single participant move station (with round tracking)
app.post('/api/participants/:id/move-station', (req: Request, res: Response) => {
  const { id } = req.params;
  const { stationId, stationName, forRound } = req.body;
  const idx = db.participants.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const targetStationId = stationId === 'unassign' || stationId === 'all' || !stationId ? '' : stationId;
  const targetStationName = targetStationId ? (stationName || resolveStationName(targetStationId) || '') : '';

  const p = db.participants[idx];
  p.stationId = targetStationId;
  p.stationName = targetStationName;
  if (forRound === 1) {
    p.round1StationId = targetStationId;
    p.round1StationName = targetStationName;
  } else if (forRound === 2) {
    p.round2StationId = targetStationId;
    p.round2StationName = targetStationName;
  } else if (forRound === 3) {
    p.round3StationId = targetStationId;
    p.round3StationName = targetStationName;
  }
  p.updatedAt = new Date().toISOString();

  persistDB();
  logAction('Participant Station Moved', `Moved ${p.name} (${p.participantNumber}) to ${targetStationName || 'Unassigned'}${forRound ? ` for Round ${forRound}` : ''}`);
  broadcastSSE('participant_updated', p);
  res.json({ success: true, participant: p });
});

// Participant Arrival Check-In to Station/Location
app.post('/api/participants/:id/check-in', (req: Request, res: Response) => {
  const { id } = req.params;
  const { checkedIn = true, stationId, stationName, checkedInBy } = req.body;
  const idx = db.participants.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const p = db.participants[idx];
  const targetStationId = stationId || p.stationId || '';
  const targetStationName = stationName || p.stationName || resolveStationName(targetStationId) || '';

  if (checkedIn) {
    p.checkedIn = true;
    p.checkedInAt = new Date().toISOString();
    p.checkedInStationId = targetStationId;
    p.checkedInStationName = targetStationName;
    p.checkedInBy = checkedInBy || 'Station Master';
    if (!p.stationId && targetStationId) {
      p.stationId = targetStationId;
      p.stationName = targetStationName;
    }
    if (p.status === 'registered') {
      p.status = 'checked_in';
    }
  } else {
    p.checkedIn = false;
    delete p.checkedInAt;
    delete p.checkedInStationId;
    delete p.checkedInStationName;
    delete p.checkedInBy;
    if (p.status === 'checked_in') {
      p.status = 'registered';
    }
  }
  p.updatedAt = new Date().toISOString();

  // Sync if staged on any active station or auto-stage on station if empty
  if (db.stations) {
    Object.values(db.stations).forEach((st) => {
      if (st.activeParticipantId === p.id) {
        if (checkedIn) {
          st.activeParticipant = { ...p };
        } else {
          st.activeParticipantId = null;
          st.activeParticipant = null;
        }
        broadcastStationUpdate(st.id, 'station_updated', st);
      } else if (
        checkedIn &&
        !st.activeParticipantId &&
        (p.stationId === st.id || targetStationId === st.id || (!p.stationId && st.id === 'station-a'))
      ) {
        st.activeParticipantId = p.id;
        st.activeParticipant = { ...p };
        broadcastStationUpdate(st.id, 'station_updated', st);
      }
    });
  }

  persistDB();
  logAction(
    checkedIn ? 'Participant Checked In' : 'Participant Check-In Revoked',
    `${checkedIn ? 'Checked in' : 'Revoked check-in for'} ${p.name} (${p.participantNumber}) at ${targetStationName || 'Location'}`
  );
  broadcastSSE('participant_updated', p);
  res.json({ success: true, participant: p });
});

// Batch Participant Check-In
app.post('/api/participants/check-in/batch', (req: Request, res: Response) => {
  const { participantIds, checkedIn = true, stationId, stationName, checkedInBy } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds array is required' });
  }

  const targetStationId = stationId || '';
  const targetStationName = targetStationId ? (stationName || resolveStationName(targetStationId) || '') : '';
  const updated: Participant[] = [];

  participantIds.forEach((id) => {
    const idx = db.participants.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const p = db.participants[idx];
      const stnId = targetStationId || p.stationId || '';
      const stnName = targetStationName || p.stationName || resolveStationName(stnId) || '';

      if (checkedIn) {
        p.checkedIn = true;
        p.checkedInAt = new Date().toISOString();
        p.checkedInStationId = stnId;
        p.checkedInStationName = stnName;
        p.checkedInBy = checkedInBy || 'Station Master';
        if (!p.stationId && stnId) {
          p.stationId = stnId;
          p.stationName = stnName;
        }
        if (p.status === 'registered') {
          p.status = 'checked_in';
        }
      } else {
        p.checkedIn = false;
        delete p.checkedInAt;
        delete p.checkedInStationId;
        delete p.checkedInStationName;
        delete p.checkedInBy;
        if (p.status === 'checked_in') {
          p.status = 'registered';
        }
      }
      p.updatedAt = new Date().toISOString();
      updated.push(p);

      if (db.stations) {
        Object.values(db.stations).forEach((st) => {
          if (st.activeParticipantId === p.id) {
            if (checkedIn) {
              st.activeParticipant = { ...p };
            } else {
              st.activeParticipantId = null;
              st.activeParticipant = null;
            }
            broadcastStationUpdate(st.id, 'station_updated', st);
          } else if (
            checkedIn &&
            !st.activeParticipantId &&
            (p.stationId === st.id || targetStationId === st.id || (!p.stationId && st.id === 'station-a'))
          ) {
            st.activeParticipantId = p.id;
            st.activeParticipant = { ...p };
            broadcastStationUpdate(st.id, 'station_updated', st);
          }
        });
      }
    }
  });

  persistDB();
  logAction(
    checkedIn ? 'Batch Participant Check-In' : 'Batch Check-In Revoked',
    `${checkedIn ? 'Checked in' : 'Revoked check-in for'} ${updated.length} participants at ${targetStationName || 'Location'}`
  );
  broadcastSSE('participants_batch_updated', { updatedList: updated, participants: updated });
  res.json({ success: true, count: updated.length, participants: updated });
});

// Custom Fields
app.get('/api/custom-fields', (req: Request, res: Response) => {
  res.json(db.customFields);
});

app.post('/api/custom-fields', (req: Request, res: Response) => {
  const { name, key, type, options, required } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const generatedKey = (key || name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();
  const newField: CustomFieldDefinition = {
    id: `f_${Date.now()}`,
    name: name.trim(),
    key: generatedKey,
    type,
    options: options || [],
    required: !!required,
    isSystem: false,
  };

  db.customFields.push(newField);
  persistDB();
  logAction('Custom Field Added', `Added field '${newField.name}' of type '${newField.type}'`);
  res.json(newField);
});

app.put('/api/custom-fields/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.customFields.findIndex((f) => f.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });

  db.customFields[idx] = {
    ...db.customFields[idx],
    ...req.body,
    id: db.customFields[idx].id,
    isSystem: db.customFields[idx].isSystem,
  };

  persistDB();
  logAction('Custom Field Updated', `Updated field definition for '${db.customFields[idx].name}'`);
  res.json(db.customFields[idx]);
});

app.delete('/api/custom-fields/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const field = db.customFields.find((f) => f.id === id);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  if (field.isSystem) return res.status(400).json({ error: 'Cannot delete protected system field' });

  db.customFields = db.customFields.filter((f) => f.id !== id);
  persistDB();
  logAction('Custom Field Deleted', `Removed custom field '${field.name}'`);
  res.json({ success: true, id });
});

// Topics CRUD
app.get('/api/topics', (req: Request, res: Response) => {
  res.json(db.topics);
});

app.post('/api/topics', (req: Request, res: Response) => {
  const { topic, category, topicId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic text is required' });

  const newTopic: Topic = {
    id: `top-${Date.now()}`,
    topicId: topicId?.trim() || `TOP-${String(db.topics.length + 1).padStart(3, '0')}`,
    topic: topic.trim(),
    category: category?.trim() || 'General',
    status: 'available',
  };

  db.topics.push(newTopic);
  persistDB();
  logAction('Topic Created', `Added topic [${newTopic.topicId}]: "${newTopic.topic.substring(0, 40)}..."`);
  broadcastSSE('topics_updated', db.topics);
  res.json(newTopic);
});

app.put('/api/topics/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.topics.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Topic not found' });

  const { topic, category, topicId, status } = req.body;
  if (topic !== undefined) db.topics[idx].topic = topic.trim();
  if (category !== undefined) db.topics[idx].category = category.trim();
  if (topicId !== undefined) db.topics[idx].topicId = topicId.trim();
  if (status !== undefined) db.topics[idx].status = status;

  delete (db.topics[idx] as any).stationId;
  delete (db.topics[idx] as any).stationName;

  persistDB();
  broadcastSSE('topics_updated', db.topics);
  res.json(db.topics[idx]);
});

// Bulk update topic stations (kept as no-op for backward compatibility)
app.post('/api/topics/batch-station', (req: Request, res: Response) => {
  res.json({ success: true, count: 0, topics: [], allTopics: db.topics });
});

app.delete('/api/topics/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.topics = db.topics.filter((t) => t.id !== id);
  persistDB();
  broadcastSSE('topics_updated', db.topics);
  res.json({ success: true, id });
});

const removeAllTopicsHandler = (req: Request, res: Response) => {
  const count = db.topics.length;
  db.topics = [];
  // Clear topic references in stations
  (db.settings.stations || []).forEach((st) => {
    const s = db.stations && db.stations[st.id];
    if (s) {
      s.selectedTopicId = null;
      s.selectedTopic = null;
    }
  });
  if (db.stations) {
    Object.values(db.stations).forEach((s: any) => {
      s.selectedTopicId = null;
      s.selectedTopic = null;
    });
  }
  if (db.synchronizedSlots) {
    db.synchronizedSlots.round2 = {};
  }
  persistDB();
  logAction('All Topics Deleted', `Removed all ${count} topics from universal repository`);
  broadcastSSE('topics_updated', db.topics);
  if (db.stations) {
    broadcastSSE('stations_updated', Object.values(db.stations));
  }
  res.json({ success: true, count, topics: [] });
};

app.delete('/api/topics', removeAllTopicsHandler);
app.post('/api/topics/delete-all', removeAllTopicsHandler);

app.post('/api/topics/batch', (req: Request, res: Response) => {
  const items: { topic: string; category?: string; topicId?: string }[] = req.body.topics || [];
  const added: Topic[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.topic) continue;

    const t: Topic = {
      id: `top-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      topicId: item.topicId?.trim() || `TOP-${String(db.topics.length + i + 1).padStart(3, '0')}`,
      topic: item.topic.trim(),
      category: item.category?.trim() || 'General',
      status: 'available',
    };
    db.topics.push(t);
    added.push(t);
  }

  persistDB();
  logAction('Batch Topics Import', `Imported ${added.length} topics into universal repository`);
  broadcastSSE('topics_updated', db.topics);
  res.json({ success: true, count: added.length, topics: added });
});

app.post('/api/topics/reset-status', (req: Request, res: Response) => {
  db.topics.forEach((t) => {
    t.status = 'available';
    delete t.usedByParticipantId;
    delete t.usedByParticipantName;
    delete t.usedAt;
  });
  persistDB();
  logAction('Topics Reset', 'Reset all topics to available status');
  res.json({ success: true, message: 'All topics reset to available' });
});

// Helper to resolve station name from stationId
function resolveStationName(stationId?: string): string | undefined {
  if (!stationId || stationId === 'all') return undefined;
  const match = (db.settings.stations || []).find((s) => s.id === stationId) || (db.stations && db.stations[stationId]);
  return match?.name || (stationId.startsWith('station-') ? `Station ${stationId.replace('station-', '').toUpperCase()}` : stationId);
}

// Images CRUD
app.get('/api/images', (req: Request, res: Response) => {
  res.json(db.images);
});

app.post('/api/images', (req: Request, res: Response) => {
  const { name, url, imageId } = req.body;
  if (!url) return res.status(400).json({ error: 'Image URL is required' });

  const finalImageId = (imageId?.trim() || name?.trim() || `IMG-${String(db.images.length + 1).padStart(3, '0')}`).toUpperCase();

  const newImg: EventImage = {
    id: `img-${Date.now()}`,
    imageId: finalImageId,
    name: finalImageId,
    url: url.trim(),
    status: 'available',
  };

  db.images.push(newImg);
  persistDB();
  logAction('Image Added', `Added image with ID: "${newImg.imageId}"`);
  broadcastSSE('images_updated', db.images);
  res.json(newImg);
});

app.put('/api/images/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const img = db.images.find((i) => i.id === id);
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const { imageId, name, status, url } = req.body;
  if (imageId !== undefined) {
    img.imageId = imageId.trim().toUpperCase();
    img.name = img.imageId;
  }
  if (name !== undefined && !imageId) {
    img.name = name.trim();
    if (!img.imageId) img.imageId = img.name;
  }
  if (status !== undefined) img.status = status;
  if (url !== undefined) img.url = url.trim();

  delete (img as any).stationId;
  delete (img as any).stationName;

  persistDB();
  logAction('Image Updated', `Updated image ID "${img.imageId}"`);
  broadcastSSE('images_updated', db.images);
  res.json(img);
});

// Batch update image stations (kept as no-op for backward compatibility)
app.post('/api/images/batch-station', (req: Request, res: Response) => {
  res.json({ success: true, count: 0, images: [], allImages: db.images });
});

// Laptop Image Upload Endpoint (Saves to persistent online uploads directory or Cloudinary)
app.post('/api/images/upload', async (req: Request, res: Response) => {
  try {
    const { images, name, base64, imageId } = req.body;
    const itemsToProcess: Array<{ name?: string; imageId?: string; base64: string }> = [];

    if (Array.isArray(images)) {
      itemsToProcess.push(...images);
    } else if (base64) {
      itemsToProcess.push({ name: name || 'Uploaded Image', imageId, base64 });
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const createdImages: EventImage[] = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      let data = item.base64;
      let ext = 'jpg';

      const match = data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
      if (match) {
        ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        data = data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      }

      const buffer = Buffer.from(data, 'base64');
      const cleanName = (item.imageId || item.name || 'image').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      let imageUrl = `/uploads/${filename}`;

      // Upload to Cloudinary if cloud credentials are present
      if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'mind_to_mic',
                public_id: filename.replace(/\.[^/.]+$/, ''),
                resource_type: 'image',
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(buffer);
          });
          imageUrl = uploadResult.secure_url;
        } catch (cloudErr) {
          console.error('[cloudinary] upload error, falling back to local file storage:', cloudErr);
          fs.writeFileSync(filePath, buffer);
        }
      } else {
        fs.writeFileSync(filePath, buffer);
      }

      const assignedId = (item.imageId?.trim() || `IMG-${String(db.images.length + 1).padStart(3, '0')}`).toUpperCase();
      const newImg: EventImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        imageId: assignedId,
        name: assignedId,
        url: imageUrl,
        status: 'available',
      };

      db.images.push(newImg);
      createdImages.push(newImg);
    }

    persistDB();
    logAction('Images Uploaded', `Uploaded ${createdImages.length} image(s) with assigned IDs to universal repository.`);
    broadcastSSE('images_updated', db.images);

    res.json({
      success: true,
      count: createdImages.length,
      images: createdImages,
      allImages: db.images,
    });
  } catch (err: any) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: err.message || 'Failed to process image upload' });
  }
});

app.delete('/api/images/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.images = db.images.filter((img) => img.id !== id);
  persistDB();
  broadcastSSE('images_updated', db.images);
  res.json({ success: true, id });
});

const removeAllImagesHandler = (req: Request, res: Response) => {
  const count = db.images.length;
  db.images = [];
  // Clear image references in stations
  (db.settings.stations || []).forEach((st) => {
    const s = db.stations && db.stations[st.id];
    if (s) {
      s.selectedImageId = null;
      s.selectedImage = null;
    }
  });
  if (db.stations) {
    Object.values(db.stations).forEach((s: any) => {
      s.selectedImageId = null;
      s.selectedImage = null;
    });
  }
  if (db.synchronizedSlots) {
    db.synchronizedSlots.round1 = {};
  }
  db.participants.forEach((p) => {
    delete p.round1ImageId;
  });
  persistDB();
  logAction('All Images Deleted', `Removed all ${count} images from universal repository`);
  broadcastSSE('images_updated', db.images);
  if (db.stations) {
    broadcastSSE('stations_updated', Object.values(db.stations));
  }
  broadcastSSE('participants_updated', db.participants);
  res.json({ success: true, count, images: [] });
};

app.delete('/api/images', removeAllImagesHandler);
app.post('/api/images/delete-all', removeAllImagesHandler);

app.post('/api/images/reset-status', (req: Request, res: Response) => {
  db.images.forEach((img) => {
    img.status = 'available';
    delete img.usedByParticipantId;
    delete img.usedByParticipantName;
    delete img.usedAt;
  });
  persistDB();
  broadcastSSE('images_updated', db.images);
  logAction('Images Reset', 'Reset all images to available status');
  res.json({ success: true, message: 'All images reset to available' });
});

// Settings API
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.settings);
});

app.put('/api/settings', (req: Request, res: Response) => {
  db.settings = {
    ...db.settings,
    ...req.body,
  };
  persistDB();
  logAction('Settings Updated', 'Organizer modified event configuration');
  broadcastSSE('settings_updated', db.settings);
  res.json(db.settings);
});

// Logo management API
app.post('/api/settings/logo', (req: Request, res: Response) => {
  const { logoData, fileName } = req.body;
  if (!logoData) {
    return res.status(400).json({ error: 'No logo data provided' });
  }
  db.settings.event = {
    ...db.settings.event,
    customLogoUrl: logoData,
    customLogoName: fileName || 'custom_logo',
  };
  persistDB();
  logAction('Logo Updated', `Brand logo updated: ${fileName || 'custom logo'}`);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, settings: db.settings });
});

app.delete('/api/settings/logo', (req: Request, res: Response) => {
  if (db.settings.event) {
    delete db.settings.event.customLogoUrl;
    delete db.settings.event.customLogoName;
  }
  persistDB();
  logAction('Logo Reset', 'Brand logo reset to default Mind to Mic logo');
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, settings: db.settings });
});

// Inspire 2K26 Logo API
app.post('/api/settings/inspire-logo', (req: Request, res: Response) => {
  const { logoData, fileName } = req.body;
  if (!logoData) {
    return res.status(400).json({ error: 'No logo data provided' });
  }
  db.settings.event = {
    ...db.settings.event,
    inspireLogoUrl: logoData,
    inspireLogoName: fileName || 'inspire_logo',
  };
  persistDB();
  logAction('Inspire Logo Updated', `Inspire logo updated: ${fileName || 'custom image'}`);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, settings: db.settings });
});

app.delete('/api/settings/inspire-logo', (req: Request, res: Response) => {
  if (db.settings.event) {
    delete db.settings.event.inspireLogoUrl;
    delete db.settings.event.inspireLogoName;
  }
  persistDB();
  logAction('Inspire Logo Reset', 'Inspire logo reset to default vector asset');
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, settings: db.settings });
});

// History Logs API
app.get('/api/history', (req: Request, res: Response) => {
  res.json(db.history);
});

app.post('/api/history', (req: Request, res: Response) => {
  const { action, details, round, participantId, participantName } = req.body;
  logAction(action, details, round, participantId, participantName);
  res.json({ success: true });
});

app.delete('/api/history', (req: Request, res: Response) => {
  db.history = [];
  persistDB();
  res.json({ success: true, message: 'History cleared' });
});

// Results API
app.get('/api/results', (req: Request, res: Response) => {
  res.json({
    round1: db.round1Results,
    round2: db.round2Results,
    round3: db.round3Results,
  });
});

app.post('/api/results/round1', (req: Request, res: Response) => {
  const result = req.body;
  result.id = `r1-${Date.now()}`;

  // Update participant status
  const p = db.participants.find((item) => item.id === result.participantId);
  if (p) {
    if (!result.participantNumber) result.participantNumber = p.participantNumber;
    if (!result.mobile) result.mobile = p.mobile || p.phone || p.customData?.phone || '';
    p.round1Status = result.status;
    p.round1ImageId = result.imageId || result.imageName;
    if (typeof result.slotIndex === 'number' && result.slotIndex >= 0) {
      p.round1SlotIndex = result.slotIndex;
      p.slotIndex = result.slotIndex;
    }
    if (result.qualification) {
      p.round1Qualified = result.qualification;
      if (result.qualification === 'disqualified') p.status = 'eliminated';
      else if (result.qualification === 'qualified' && p.status === 'eliminated') p.status = 'active';
    }
  }

  db.round1Results.push(result);

  // Update image status
  if (!db.settings.round1.allowImageReuse) {
    const img = db.images.find((i) => i.id === result.imageId || i.imageId === result.imageId);
    if (img) {
      img.status = 'used';
      img.usedByParticipantId = result.participantId;
      img.usedByParticipantName = result.participantName;
      img.usedAt = new Date().toISOString();
    }
  }

  persistDB();
  logAction('Round 1 Completed', `Participant ${result.participantName} completed Round 1 speech (${result.speechDurationSeconds}s)`, 'Round 1', result.participantId, result.participantName);
  broadcastSSE('result_added', { round: 1, result });
  res.json(result);
});

app.post('/api/results/round2', (req: Request, res: Response) => {
  const result = req.body;
  result.id = `r2-${Date.now()}`;

  const p = db.participants.find((item) => item.id === result.participantId);
  if (p) {
    if (!result.participantNumber) result.participantNumber = p.participantNumber;
    if (!result.mobile) result.mobile = p.mobile || p.phone || p.customData?.phone || '';
    p.round2Status = result.status;
    p.round2TopicId = result.topicId;
    if (typeof result.slotIndex === 'number' && result.slotIndex >= 0) {
      p.round2SlotIndex = result.slotIndex;
      p.slotIndex = result.slotIndex;
    }
    if (result.qualification) {
      p.round2Qualified = result.qualification;
      if (result.qualification === 'disqualified') p.status = 'eliminated';
      else if (result.qualification === 'qualified' && p.status === 'eliminated') p.status = 'active';
    }
  }

  db.round2Results.push(result);

  // Update topic status
  if (!db.settings.round2.topicReuseAllowed) {
    const top = db.topics.find((t) => t.id === result.topicId || t.topicId === result.topicId);
    if (top) {
      top.status = 'used';
      top.usedByParticipantId = result.participantId;
      top.usedByParticipantName = result.participantName;
      top.usedAt = new Date().toISOString();
    }
  }

  persistDB();
  logAction('Round 2 Completed', `Participant ${result.participantName} completed Round 2 on topic "${result.topic}" (${result.speechDurationSeconds}s)`, 'Round 2', result.participantId, result.participantName);
  broadcastSSE('result_added', { round: 2, result });
  res.json(result);
});

app.post('/api/results/round3', (req: Request, res: Response) => {
  const result = req.body;
  result.id = `r3-${Date.now()}`;

  const p = db.participants.find((item) => item.id === result.participantId);
  if (p) {
    if (!result.participantNumber) result.participantNumber = p.participantNumber;
    if (!result.mobile) result.mobile = p.mobile || p.phone || p.customData?.phone || '';
    p.round3Status = result.status;
    if (result.qualification) {
      p.round3Qualified = result.qualification;
      if (result.qualification === 'disqualified') p.status = 'eliminated';
      else if (result.qualification === 'qualified' && p.status === 'eliminated') p.status = 'active';
    }
  }

  db.round3Results.push(result);

  persistDB();
  logAction('Round 3 Completed', `Participant ${result.participantName} completed Round 3 speech (${result.speechDurationSeconds}s)`, 'Round 3', result.participantId, result.participantName);
  broadcastSSE('result_added', { round: 3, result });
  res.json(result);
});

// QUALIFICATION API: Single participant qualification toggle/update
app.post('/api/qualification', (req: Request, res: Response) => {
  const { participantId, round, status, reason } = req.body;
  const p = db.participants.find((item) => item.id === participantId);
  if (!p) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (round === 1) {
    p.round1Qualified = status;
    const r = db.round1Results.find((res) => res.participantId === participantId);
    if (r) {
      r.qualification = status;
      if (reason !== undefined) r.qualificationReason = reason;
    }
  } else if (round === 2) {
    p.round2Qualified = status;
    const r = db.round2Results.find((res) => res.participantId === participantId);
    if (r) {
      r.qualification = status;
      if (reason !== undefined) r.qualificationReason = reason;
    }
  } else if (round === 3) {
    p.round3Qualified = status;
    const r = db.round3Results.find((res) => res.participantId === participantId);
    if (r) {
      r.qualification = status;
      if (reason !== undefined) r.qualificationReason = reason;
    }
  }

  if (reason) p.qualificationReason = reason;

  if (status === 'disqualified') {
    p.status = 'eliminated';
  } else if (status === 'qualified' && p.status === 'eliminated') {
    p.status = 'active';
  }

  p.updatedAt = new Date().toISOString();
  persistDB();
  logAction(
    'Qualification Updated',
    `Participant ${p.name} marked as ${status.toUpperCase()} in Round ${round}`,
    `Round ${round}` as any,
    p.id,
    p.name
  );
  broadcastSSE('qualification_updated', { participantId, round, status, reason, participant: p });
  res.json({ success: true, participant: p });
});

// BATCH QUALIFICATION API: Set multiple participants as qualified/disqualified
app.post('/api/qualification/batch', (req: Request, res: Response) => {
  const { participantIds, round, status } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds array is required' });
  }

  const updatedList: Participant[] = [];
  participantIds.forEach((pid: string) => {
    const p = db.participants.find((item) => item.id === pid);
    if (p) {
      if (round === 1) {
        p.round1Qualified = status;
        const r = db.round1Results.find((res) => res.participantId === pid);
        if (r) r.qualification = status;
      } else if (round === 2) {
        p.round2Qualified = status;
        const r = db.round2Results.find((res) => res.participantId === pid);
        if (r) r.qualification = status;
      } else if (round === 3) {
        p.round3Qualified = status;
        const r = db.round3Results.find((res) => res.participantId === pid);
        if (r) r.qualification = status;
      }

      if (status === 'disqualified') p.status = 'eliminated';
      else if (status === 'qualified' && p.status === 'eliminated') p.status = 'active';

      p.updatedAt = new Date().toISOString();
      updatedList.push(p);
    }
  });

  persistDB();
  logAction(
    'Batch Qualification',
    `Updated ${updatedList.length} contestants to ${status.toUpperCase()} in Round ${round}`
  );
  broadcastSSE('participants_batch_updated', { round, status, updatedList });
  res.json({ success: true, count: updatedList.length, participants: updatedList });
});

// START SERVER WITH VITE INTEGRATION
async function startServer() {
  await initMongo();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/uploads/**', '**/_old_phase1_scaffold/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mind to Mic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
