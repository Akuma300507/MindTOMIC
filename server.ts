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
} from './src/types';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
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
  },
  round2: {
    prepEnabled: false, // Round 2 starts speaking immediately
    prepTimeSeconds: 0,
    speechTimeSeconds: 120,
    buzzerEnabled: true,
    buzzerTimeSeconds: 120,
    activeWheelTopicCount: 16,
    topicReuseAllowed: false,
  },
  round3: {
    prepEnabled: false,
    prepTimeSeconds: 0,
    speechTimeSeconds: 120,
    buzzerEnabled: true,
    buzzerTimeSeconds: 120,
  },
  buzzer: {
    laptopBuzzer: true,
    mobileBuzzer: true,
    volume: 90,
    sound: 'horn',
    autoBuzzerOnZero: true,
    prepSound: 'dual_alert',
    prepVolume: 85,
  },
  stations: [
    { id: 'station-a', name: 'Station A', location: 'Room 101', handlerName: 'Alex Rivera', handlerPhone: '+1 (555) 234-5678', handlerRole: 'Stage Lead', handlerStatus: 'ready' },
    { id: 'station-b', name: 'Station B', location: 'Room 102', handlerName: 'Maya Lin', handlerPhone: '+1 (555) 345-6789', handlerRole: 'Timekeeper', handlerStatus: 'ready' },
    { id: 'station-c', name: 'Station C', location: 'Room 103', handlerName: 'Liam Carter', handlerPhone: '+1 (555) 456-7890', handlerRole: 'Coordinator', handlerStatus: 'ready' },
    { id: 'station-d', name: 'Station D', location: 'Auditorium Stage', handlerName: 'Sophia Chen', handlerPhone: '+1 (555) 567-8901', handlerRole: 'Stage Manager', handlerStatus: 'ready' },
  ],
};

const defaultCustomFields: CustomFieldDefinition[] = [
  {
    id: 'f_phone',
    name: 'Phone Number',
    key: 'phone',
    type: 'text',
    required: false,
    isSystem: false,
  },
];

const defaultParticipants: Participant[] = [
  {
    id: 'p-101',
    participantNumber: 'M2M-001',
    name: 'Aarav Sharma',
    mobile: '+91 98765 43210',
    phone: '+91 98765 43210',
    stationId: 'station-a',
    stationName: 'Station A',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+91 98765 43210', mobile: '+91 98765 43210' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-102',
    participantNumber: 'M2M-002',
    name: 'Maya Chen',
    mobile: '+1 415 555 0192',
    phone: '+1 415 555 0192',
    stationId: 'station-b',
    stationName: 'Station B',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+1 415 555 0192', mobile: '+1 415 555 0192' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-103',
    participantNumber: 'M2M-003',
    name: 'Lucas Dupont',
    mobile: '+33 6 12 34 56 78',
    phone: '+33 6 12 34 56 78',
    stationId: 'station-a',
    stationName: 'Station A',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+33 6 12 34 56 78', mobile: '+33 6 12 34 56 78' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-104',
    participantNumber: 'M2M-004',
    name: 'Priya Patel',
    mobile: '+91 91234 56789',
    phone: '+91 91234 56789',
    stationId: 'station-c',
    stationName: 'Station C',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+91 91234 56789', mobile: '+91 91234 56789' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-105',
    participantNumber: 'M2M-005',
    name: 'David Kim',
    mobile: '+82 10 9876 5432',
    phone: '+82 10 9876 5432',
    stationId: 'station-d',
    stationName: 'Station D',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+82 10 9876 5432', mobile: '+82 10 9876 5432' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-106',
    participantNumber: 'M2M-006',
    name: 'Zara Al-Mansoor',
    mobile: '+971 50 123 4567',
    phone: '+971 50 123 4567',
    stationId: 'station-b',
    stationName: 'Station B',
    status: 'active',
    round1Status: 'pending',
    round2Status: 'pending',
    round3Status: 'pending',
    customData: { phone: '+971 50 123 4567', mobile: '+971 50 123 4567' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultTopics: Topic[] = [
  { id: 'top-1', topicId: 'TOP-001', topic: 'Is AI creative or merely a parrot of human culture?', category: 'Technology', status: 'available' },
  { id: 'top-2', topicId: 'TOP-002', topic: 'The Power of Silence in an Age of Constant Noise', category: 'Philosophy', status: 'available' },
  { id: 'top-3', topicId: 'TOP-003', topic: 'Should college degrees remain the benchmark for intellect?', category: 'Education', status: 'available' },
  { id: 'top-4', topicId: 'TOP-004', topic: 'Digital Privacy: A Universal Right or a Modern Myth?', category: 'Society', status: 'available' },
  { id: 'top-5', topicId: 'TOP-005', topic: 'Can empathy be taught or is it hardwired?', category: 'Psychology', status: 'available' },
  { id: 'top-6', topicId: 'TOP-006', topic: 'The Myth of the Overnight Success Story', category: 'Mindset', status: 'available' },
  { id: 'top-7', topicId: 'TOP-007', topic: 'Why Failure is the Highest Form of Curriculum', category: 'Mindset', status: 'available' },
  { id: 'top-8', topicId: 'TOP-008', topic: 'Are algorithms polarizing human empathy?', category: 'Technology', status: 'available' },
  { id: 'top-9', topicId: 'TOP-009', topic: 'The Future of Clean Energy: Science vs Politics', category: 'Environment', status: 'available' },
  { id: 'top-10', topicId: 'TOP-010', topic: 'Is Cancel Culture Accountability or Retribution?', category: 'Culture', status: 'available' },
  { id: 'top-11', topicId: 'TOP-011', topic: 'The Vanishing Art of Deep Focused Work', category: 'Productivity', status: 'available' },
  { id: 'top-12', topicId: 'TOP-012', topic: 'Does Wealth Obligate Philanthropy?', category: 'Ethics', status: 'available' },
  { id: 'top-13', topicId: 'TOP-013', topic: 'Space Colonization vs Fixing Earth: Where should billions go?', category: 'Future', status: 'available' },
  { id: 'top-14', topicId: 'TOP-014', topic: 'The Illusion of Infinite Free Time', category: 'Time', status: 'available' },
  { id: 'top-15', topicId: 'TOP-015', topic: 'Is Social Media Making Us lonelier together?', category: 'Society', status: 'available' },
  { id: 'top-16', topicId: 'TOP-016', topic: 'Leadership in Crisis: Decisiveness vs Compassion', category: 'Leadership', status: 'available' },
  { id: 'top-17', topicId: 'TOP-017', topic: 'The Paradox of Choice: Does more freedom bring happiness?', category: 'Philosophy', status: 'available' },
  { id: 'top-18', topicId: 'TOP-018', topic: 'Virtual Reality vs Physical Reality: The new divide', category: 'Technology', status: 'available' },
  { id: 'top-19', topicId: 'TOP-019', topic: 'Who is responsible for climate action: Individuals or Corporations?', category: 'Environment', status: 'available' },
  { id: 'top-20', topicId: 'TOP-020', topic: 'The Price of Perfectionism in Youth', category: 'Psychology', status: 'available' },
  { id: 'top-21', topicId: 'TOP-021', topic: 'Can Humor be used as an Instrument of Truth?', category: 'Culture', status: 'available' },
  { id: 'top-22', topicId: 'TOP-022', topic: 'Why We Need More Generalists, Not Just Specialists', category: 'Career', status: 'available' },
  { id: 'top-23', topicId: 'TOP-023', topic: 'The Ethics of Human Genetic Engineering', category: 'Bioethics', status: 'available' },
  { id: 'top-24', topicId: 'TOP-024', topic: 'The Art of Disagreeing Without Becoming Enemies', category: 'Communication', status: 'available' },
  { id: 'top-25', topicId: 'TOP-025', topic: 'Will Automation Create a Leisure Society or Economic Despair?', category: 'Economics', status: 'available' },
];

const defaultImages: EventImage[] = [
  {
    id: 'img-1',
    imageId: 'IMG-001',
    name: 'IMG-001',
    url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-2',
    imageId: 'IMG-002',
    name: 'IMG-002',
    url: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-3',
    imageId: 'IMG-003',
    name: 'IMG-003',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-4',
    imageId: 'IMG-004',
    name: 'IMG-004',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-5',
    imageId: 'IMG-005',
    name: 'IMG-005',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-6',
    imageId: 'IMG-006',
    name: 'IMG-006',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-7',
    imageId: 'IMG-007',
    name: 'IMG-007',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
  {
    id: 'img-8',
    imageId: 'IMG-008',
    name: 'IMG-008',
    url: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=1200&q=80',
    status: 'available',
  },
];

const defaultHistory: EventLog[] = [
  {
    id: 'log-1',
    timestamp: new Date().toISOString(),
    action: 'Event Initialized',
    round: 'General',
    details: 'Mind to Mic competition platform booted with initial participant and topic roster.',
  },
];

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

try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
    // Ensure all keys exist
    if (!db.settings) db.settings = defaultSettings;
    if (!db.settings.stations || db.settings.stations.length === 0) {
      db.settings.stations = defaultSettings.stations;
    }
    if (!db.participants) db.participants = defaultParticipants;
    if (!db.topics) db.topics = defaultTopics;
    if (!db.images) db.images = defaultImages;
    if (!db.customFields) db.customFields = defaultCustomFields;
    if (!db.round1Results) db.round1Results = [];
    if (!db.round2Results) db.round2Results = [];
    if (!db.round3Results) db.round3Results = [];
    if (!db.history) db.history = defaultHistory;
    if (!db.stations) db.stations = {};

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

    if (!db.liveSync) db.liveSync = getInitialDatabase().liveSync;
    db.liveSync.stationStates = db.stations;
  } else {
    db = getInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Error loading db.json, resetting to initial defaults', err);
  db = getInitialDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
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
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      } catch {}
      console.log('[mongodb] Loaded cloud state from MongoDB Atlas');
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

// Helper to persist data to disk and MongoDB Atlas
let saveTimeout: NodeJS.Timeout | null = null;
function persistDB() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      if (db.stations) {
        db.liveSync.stationStates = db.stations;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');

      if (mongoDb) {
        await mongoDb.collection('app_state').updateOne(
          { _id: 'current_state' },
          { $set: { data: db, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    } catch (err) {
      console.error('Failed to persist database:', err);
    }
  }, 100);
}

// Synchronous persistence for critical actions like Reset
function persistDBSync() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    if (db.stations) {
      db.liveSync.stationStates = db.stations;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    if (mongoDb) {
      mongoDb.collection('app_state').updateOne(
        { _id: 'current_state' },
        { $set: { data: db, updatedAt: new Date() } },
        { upsert: true }
      ).catch((e: any) => console.error('[mongodb] sync persist error:', e));
    }
  } catch (err) {
    console.error('Failed to persist database synchronously:', err);
  }
}

// SSE clients for real-time mobile buzzer & projector sync
interface SSEClient {
  id: string;
  res: Response;
  type: 'projector' | 'buzzer' | 'organizer';
}
const sseClients: SSEClient[] = [];

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

// SSE heartbeat to keep connections alive and maintain synchronized clock offset
setInterval(() => {
  if (sseClients.length > 0) {
    broadcastSSE('heartbeat', { serverTime: Date.now() });
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

// Reset database to initial factory defaults
app.post('/api/reset-data', (req: Request, res: Response) => {
  db = getInitialDatabase();
  persistDB();
  logAction('Reset All Data', 'Organizer restored factory defaults for the event database.');
  broadcastSSE('state_reset', db);
  res.json({ success: true, message: 'Database reset to initial template state.' });
});

// SSE Endpoint for Live Sync and Buzzer
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const type = (req.query.type as 'projector' | 'buzzer' | 'organizer') || 'organizer';
  const client: SSEClient = { id: clientId, res, type };
  sseClients.push(client);

  // Send initial ping, live sync state, and server timestamp for clock calibration
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, liveSync: db.liveSync, serverTime: Date.now() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Buzzer trigger
app.post('/api/buzzer/trigger', (req: Request, res: Response) => {
  const { source, reason, round, participantName } = req.body;
  const triggerPayload = {
    timestamp: Date.now(),
    source: source || 'organizer',
    reason: reason || 'Manual Buzzer',
    round: round || 'General',
    sound: db.settings.buzzer.sound,
    volume: db.settings.buzzer.volume,
  };

  db.liveSync.buzzerTimestamp = triggerPayload.timestamp;
  broadcastSSE('buzzer_trigger', triggerPayload);
  logAction('Buzzer Triggered', `${reason || 'Manual Buzzer'} sounded by ${source || 'organizer'} (${round || 'General'}) ${participantName ? 'for ' + participantName : ''}`);

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

    Object.values(db.stations).forEach((s) => {
      s.isOvertime = true;
      s.buzzerPlayed = true;
      s.buzzerTimestamp = now;
    });

    if (db.settings.buzzer.autoBuzzerOnZero) {
      broadcastSSE('buzzer_trigger', {
        timestamp: now,
        source: 'timer_auto',
        reason: 'Time Expired (00:00)',
        round: round || 'General',
        sound: db.settings.buzzer.sound,
        volume: db.settings.buzzer.volume,
      });
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

// Atomic Round 1 Image Assignment (No-repeat across devices/stations)
app.post('/api/round1/assign-image', (req: Request, res: Response) => {
  const { participantId, participantName, stationId } = req.body;

  // Filter available images (respecting station-specific images if stationId is provided)
  let candidates: EventImage[] = [];
  if (stationId && stationId !== 'all') {
    const stationCandidates = db.images.filter(
      (img) => img.stationId === stationId || img.stationId === resolveStationName(stationId)
    );
    if (stationCandidates.length > 0) {
      candidates = stationCandidates.filter((img) => img.status === 'available');
      if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
        candidates = stationCandidates;
      }
    }
  }

  if (candidates.length === 0) {
    // Exclude images explicitly assigned to other stations!
    const otherStationImages = db.images.filter(
      (img) => img.stationId && img.stationId !== 'all' && img.stationId !== stationId
    );
    const availablePool = db.images.filter((img) => !otherStationImages.includes(img));
    candidates = availablePool.filter((img) => img.status === 'available');
    if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
      candidates = availablePool.length > 0 ? availablePool : db.images;
    }
  }

  if (candidates.length === 0) {
    if (db.settings.round1.allowImageReuse && db.images.length > 0) {
      candidates = db.images;
    } else {
      return res.status(409).json({
        error: 'No unused images left in the pool for this station. Reset image pool or allow image reuse in settings.',
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

// Atomic Round 2 Topic Spin (synchronized spin across devices & projector)
app.post('/api/round2/spin-topic', (req: Request, res: Response) => {
  const { participantId, participantName, stationId, wheelTopicIds } = req.body;

  // Pool of available topics strictly isolated for station if specified
  let pool: Topic[] = [];
  if (stationId && stationId !== 'all') {
    const stationCandidates = db.topics.filter((t) => t.stationId === stationId);
    if (stationCandidates.length > 0) {
      pool = stationCandidates.filter((t) => t.status === 'available');
      if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
        pool = stationCandidates;
      }
    }
  }

  if (pool.length === 0) {
    const otherStationTopics = stationId && stationId !== 'all'
      ? db.topics.filter((t) => t.stationId && t.stationId !== 'all' && t.stationId !== stationId)
      : [];
    const availablePool = db.topics.filter((t) => !otherStationTopics.includes(t));
    pool = availablePool.filter((t) => t.status === 'available');
    if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
      pool = availablePool.length > 0 ? availablePool : db.topics;
    }
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
  station.lastHeartbeat = now;
  if (station.status === 'DISCONNECTED') {
    station.status = 'WAITING';
  }

  persistDB();
  broadcastSSE('station_updated', station);
  logAction('Station Claimed', `${station.controllerDeviceName} assumed control of ${station.name}`);
  res.json({ success: true, station });
});

// Heartbeat to keep station controller active
app.post('/api/stations/:id/heartbeat', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { deviceId, deviceName } = req.body;

  if (deviceId) {
    if (!station.controllerDeviceId || station.controllerDeviceId === deviceId) {
      station.controllerDeviceId = deviceId;
      if (deviceName) station.controllerDeviceName = deviceName;
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

  if (station.controllerDeviceId === deviceId) {
    station.controllerDeviceId = null;
    station.controllerDeviceName = null;
    station.lastHeartbeat = 0;
    persistDB();
    broadcastSSE('station_updated', station);
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
  broadcastSSE('station_updated', station);
  res.json({ success: true, station });
});

// Ping Station Handler / Controller
app.post('/api/stations/:id/ping', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { senderName, message } = req.body;
  const alertMsg = message || `Master Monitor pinged ${station.name}!`;

  logAction('Station Pinged', `${senderName || 'Master'} pinged ${station.name} (${station.handlerName || 'No handler'})`);
  broadcastSSE('station_ping', {
    stationId: station.id,
    stationName: station.name,
    handlerName: station.handlerName,
    message: alertMsg,
    timestamp: Date.now(),
  });
  res.json({ success: true, message: 'Ping sent to station' });
});

// Set Station Round (Round is station-specific, not event-global!)
app.post('/api/stations/:id/set-round', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { round } = req.body;

  if (![1, 2, 3].includes(Number(round))) {
    return res.status(400).json({ error: 'Invalid round number. Must be 1, 2, or 3.' });
  }

  station.currentRound = Number(round) as 1 | 2 | 3;
  station.status = 'WAITING';
  station.selectedImageId = null;
  station.selectedImage = null;
  station.selectedTopicId = null;
  station.selectedTopic = null;
  station.wheelSpin = null;

  db.liveSync.currentRound = station.currentRound;
  db.liveSync.wheelSpin = null;
  db.liveSync.activeItem = undefined;

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

  db.liveSync.timerMode = 'idle';
  db.liveSync.timerTotalSeconds = roundDuration;
  db.liveSync.timerRemainingSeconds = roundDuration;
  db.liveSync.isTimerRunning = false;
  db.liveSync.timerStartedAt = null;
  db.liveSync.timerEndsAt = null;

  persistDB();
  logAction('Station Round Updated', `${station.name} switched to Round ${station.currentRound}`);
  broadcastSSE('station_updated', station);
  broadcastSSE('live_sync_update', db.liveSync);
  res.json({ success: true, station });
});

// Set Station Active Participant
app.post('/api/stations/:id/set-participant', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { participantId } = req.body;

  station.activeParticipantId = participantId || null;
  station.activeParticipant = participantId
    ? db.participants.find((p) => p.id === participantId) || null
    : null;

  db.liveSync.activeParticipantId = participantId || null;
  db.liveSync.activeItem = undefined;
  db.liveSync.wheelSpin = null;

  // Reset current station item if contestant changes
  station.selectedImageId = null;
  station.selectedImage = null;
  station.selectedTopicId = null;
  station.selectedTopic = null;
  station.wheelSpin = null;
  station.status = 'WAITING';

  persistDB();
  broadcastSSE('station_updated', station);
  broadcastSSE('live_sync_update', db.liveSync);
  res.json({ success: true, station });
});

// Atomic Round 1 Image Assignment for Station (Global Uniqueness)
app.post('/api/stations/:id/assign-image', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { participantId, participantName } = req.body;

  if (participantId) {
    station.activeParticipantId = participantId;
    station.activeParticipant = db.participants.find((p) => p.id === participantId) || station.activeParticipant;
  }

  // Filter available images strictly for THIS station to prevent repeating across stations
  const stationId = station.id;
  const stationCandidates = db.images.filter(
    (img) => img.stationId === stationId || img.stationId === station.name
  );

  let candidates: EventImage[] = [];
  if (stationCandidates.length > 0) {
    candidates = stationCandidates.filter((img) => img.status === 'available');
    if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
      candidates = stationCandidates;
    }
  } else {
    // If no images are assigned specifically to this station, use unassigned or all-station images
    // Strictly exclude images that belong to other stations!
    const otherStationImages = db.images.filter(
      (img) => img.stationId && img.stationId !== 'all' && img.stationId !== stationId && img.stationId !== station.name
    );
    const availablePool = db.images.filter((img) => !otherStationImages.includes(img));
    candidates = availablePool.filter((img) => img.status === 'available');
    if (candidates.length === 0 && db.settings.round1.allowImageReuse) {
      candidates = availablePool.length > 0 ? availablePool : db.images;
    }
  }

  if (candidates.length === 0) {
    if (db.settings.round1.allowImageReuse && db.images.length > 0) {
      candidates = stationCandidates.length > 0 ? stationCandidates : db.images;
    } else {
      return res.status(409).json({
        error: `No unused images available for ${station.name}. Please upload images assigned to ${station.name} or allow image reuse in settings.`,
      });
    }
  }

  // Random selection
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  // Mark as used globally
  if (!db.settings.round1.allowImageReuse) {
    chosen.status = 'used';
    chosen.usedByParticipantId = station.activeParticipantId || undefined;
    chosen.usedByParticipantName = participantName || station.activeParticipant?.name || undefined;
    chosen.usedAt = new Date().toISOString();
  }

  station.selectedImageId = chosen.id;
  station.selectedImage = chosen;
  station.currentRound = 1;

  if (station.activeParticipantId) {
    const p = db.participants.find((item) => item.id === station.activeParticipantId);
    if (p) {
      p.round1ImageId = chosen.imageId || chosen.name || chosen.id;
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
  logAction('Image Assigned', `Assigned image "${chosen.name}" at ${station.name} to contestant ${participantName || station.activeParticipant?.name || 'Contestant'}`);

  // Mirror to liveSync
  db.liveSync.currentRound = 1;
  if (station.activeParticipantId) db.liveSync.activeParticipantId = station.activeParticipantId;
  db.liveSync.activeItem = {
    type: 'image',
    title: chosen.imageId || chosen.name || chosen.id,
    mediaUrl: chosen.url,
    id: chosen.id,
  };
  db.liveSync.timerMode = station.timerMode;
  db.liveSync.timerTotalSeconds = station.timerTotalSeconds;
  db.liveSync.timerRemainingSeconds = station.timerRemainingSeconds;
  db.liveSync.isTimerRunning = false;
  db.liveSync.timerStartedAt = null;
  db.liveSync.timerEndsAt = null;

  broadcastSSE('images_updated', db.images);
  broadcastSSE('station_updated', station);
  broadcastSSE('live_sync_update', db.liveSync);

  res.json({ success: true, image: chosen, station });
});

// Atomic Round 2 Topic Spin for Station (Single Source of Truth, Global Uniqueness)
app.post('/api/stations/:id/spin-topic', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { participantId, participantName, wheelTopicIds } = req.body;

  if (participantId) {
    station.activeParticipantId = participantId;
    station.activeParticipant = db.participants.find((p) => p.id === participantId) || station.activeParticipant;
  }

  // Filter available topics strictly for THIS station to prevent repeating across stations
  const stationId = station.id;
  const otherStationTopics = db.topics.filter(
    (t) => t.stationId && t.stationId !== 'all' && t.stationId !== stationId && t.stationId !== station.name
  );
  const stationCandidates = db.topics.filter(
    (t) => t.stationId === stationId || t.stationId === station.name
  );

  let pool: Topic[] = [];
  if (stationCandidates.length > 0) {
    pool = stationCandidates.filter((t) => t.status === 'available');
    if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
      pool = stationCandidates;
    }
  } else {
    // Unassigned or universal topics, strictly excluding other stations' topics
    const availablePool = db.topics.filter((t) => !otherStationTopics.includes(t));
    pool = availablePool.filter((t) => t.status === 'available');
    if (pool.length === 0 && db.settings.round2.topicReuseAllowed) {
      pool = availablePool.length > 0 ? availablePool : db.topics;
    }
  }

  if (pool.length === 0) {
    if (db.settings.round2.topicReuseAllowed && db.topics.length > 0) {
      pool = stationCandidates.length > 0 ? stationCandidates : db.topics;
    } else {
      return res.status(409).json({
        error: `No unused topics available for ${station.name}. Please upload topics assigned to ${station.name} or allow topic reuse in settings.`,
      });
    }
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

  // Select EXACTLY ONE topic in backend from the wheel candidates
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const targetIndex = candidates.findIndex((t) => t.id === chosen.id);

  // Update station active wheel topics to match this exact candidates list
  station.activeWheelTopics = [...candidates];

  if (station.activeParticipantId) {
    const p = db.participants.find((item) => item.id === station.activeParticipantId);
    if (p) {
      p.round2TopicId = chosen.topicId || chosen.id;
    }
  }

  // Immediately claim as USED in backend
  if (!db.settings.round2.topicReuseAllowed) {
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

  // Mirror to liveSync without revealing activeItem text until spin completes
  db.liveSync.currentRound = 2;
  if (station.activeParticipantId) db.liveSync.activeParticipantId = station.activeParticipantId;
  db.liveSync.activeItem = undefined;
  db.liveSync.wheelSpin = station.wheelSpin;

  persistDB();
  logAction('Topic Spun', `Wheel spin initiated at ${station.name} for contestant ${participantName || station.activeParticipant?.name || 'Contestant'}`);

  broadcastSSE('wheel_spin_started', {
    stationId: station.id,
    topic: chosen,
    targetTopicId: chosen.id,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
  });
  broadcastSSE('topics_updated', db.topics);
  broadcastSSE('station_updated', station);
  broadcastSSE('live_sync_update', db.liveSync);

  res.json({
    success: true,
    topic: chosen,
    targetIndex: targetIndex >= 0 ? targetIndex : 0,
    wheelTopics: candidates,
    startedAt,
    durationMs: spinDurationMs,
    station,
  });
});

// Complete Round 2 Spin -> Reveal topic and transition to Speaking mode
app.post('/api/stations/:id/spin-complete', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const speechSec = db.settings.round2.speechTimeSeconds || 120;

  // Reveal winning topic now that spin is fully complete
  const winningTopic = station.pendingTopic || station.selectedTopic || db.topics.find((t) => t.id === station.wheelSpin?.targetTopicId);
  if (winningTopic) {
    station.selectedTopic = winningTopic;
    station.selectedTopicId = winningTopic.id;
    db.liveSync.activeItem = {
      type: 'topic',
      title: winningTopic.topic,
      id: winningTopic.id,
      category: winningTopic.category,
    };

    // Slot-preservation topic replacement:
    // Replace the used topic in the wheel candidates with a fresh unused topic from the pool
    let currentWheel = (station.activeWheelTopics || station.wheelSpin?.wheelTopics || []).filter(Boolean);
    if (currentWheel.length === 0) {
      const wheelCount = db.settings.round2.activeWheelTopicCount || 20;
      currentWheel = db.topics.filter((t) => t && t.status === 'available').slice(0, wheelCount);
    }
    const targetIdx = currentWheel.findIndex((t) => t && t.id === winningTopic.id);
    if (targetIdx !== -1) {
      const replacement = db.topics.find(
        (t) => t && t.status === 'available' && t.id !== winningTopic.id && !currentWheel.some((w) => w && w.id === t.id)
      );
      if (replacement) {
        currentWheel[targetIdx] = replacement;
      }
      station.activeWheelTopics = [...currentWheel].filter(Boolean);
    }
  }
  station.pendingTopic = undefined;
  station.wheelSpin = null;
  db.liveSync.wheelSpin = null;

  // Setup speaking timer ready for operator to start (avoid auto-start desync with operator dashboard)
  station.status = 'READY_TO_SPEAK';
  station.timerMode = 'speech';
  station.timerTotalSeconds = speechSec;
  station.timerRemainingSeconds = speechSec;
  station.isTimerRunning = false;
  station.timerStartedAt = null;
  station.timerEndsAt = null;

  db.liveSync.timerMode = 'speech';
  db.liveSync.timerTotalSeconds = speechSec;
  db.liveSync.timerRemainingSeconds = speechSec;
  db.liveSync.isTimerRunning = false;
  db.liveSync.timerStartedAt = null;
  db.liveSync.timerEndsAt = null;

  persistDB();
  broadcastSSE('station_updated', station);
  broadcastSSE('live_sync_update', db.liveSync);
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
      const replacement = replacementTopicId
        ? db.topics.find((t) => t && t.id === replacementTopicId)
        : db.topics.find(
            (t) => t && t.status === 'available' && t.id !== usedTopicId && !currentWheel.some((w) => w && w.id === t.id)
          );
      if (replacement) {
        currentWheel[idx] = replacement;
      }
    }
  }
  station.activeWheelTopics = [...currentWheel].filter(Boolean);
  persistDB();
  broadcastSSE('station_updated', station);
  res.json({ success: true, activeWheelTopics: station.activeWheelTopics });
});

// Independent Station Timer Action with Shared Timestamp Synchronization & Continuous Overtime
app.post('/api/stations/:id/timer', (req: Request, res: Response) => {
  const station = getStation(req.params.id);
  const { action, phase, totalSeconds, remainingSeconds, round, endsAt, startedAt } = req.body;
  const now = Date.now();
  const effectiveStart = typeof startedAt === 'number' && Math.abs(now - startedAt) < 2500 ? startedAt : now;
  const roundSettings = (db.settings as any)[`round${station.currentRound}`] || db.settings.round1;

  if (action === 'start') {
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
    station.timerAccumulatedMs = 0;
    station.timerEndsAt = typeof endsAt === 'number' ? endsAt : effectiveStart + rem * 1000;
    station.timerStopTime = null;
    station.status = station.timerMode === 'prep' ? 'PREPARING' : 'SPEAKING';
    station.buzzerPlayed = false;
    station.isOvertime = false;
    station.overtimeSeconds = 0;

    db.liveSync.timerMode = station.timerMode;
    db.liveSync.timerStatus = 'running';
    db.liveSync.timerDuration = station.timerDuration;
    db.liveSync.timerTotalSeconds = station.timerTotalSeconds;
    db.liveSync.timerRemainingSeconds = station.timerRemainingSeconds;
    db.liveSync.isTimerRunning = true;
    db.liveSync.timerStartTime = station.timerStartTime;
    db.liveSync.timerStartedAt = station.timerStartedAt;
    db.liveSync.timerAccumulatedMs = station.timerAccumulatedMs;
    db.liveSync.timerEndsAt = station.timerEndsAt;
    db.liveSync.timerStopTime = null;
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

    db.liveSync.isTimerRunning = false;
    db.liveSync.timerStatus = 'paused';
    db.liveSync.timerRemainingSeconds = station.timerRemainingSeconds;
    db.liveSync.timerAccumulatedMs = station.timerAccumulatedMs;
    db.liveSync.timerStartTime = null;
    db.liveSync.timerStartedAt = null;
    db.liveSync.timerEndsAt = null;
  } else if (action === 'resume') {
    station.timerStartTime = now;
    station.timerStartedAt = now;
    station.timerStatus = 'running';
    station.isTimerRunning = true;
    station.status = station.timerMode === 'prep' ? 'PREPARING' : 'SPEAKING';

    const totalElapsedSec = Math.floor((station.timerAccumulatedMs || 0) / 1000);
    const remSec = Math.max(0, (station.timerDuration || 120) - totalElapsedSec);
    station.timerEndsAt = now + remSec * 1000;

    db.liveSync.timerStartTime = now;
    db.liveSync.timerStartedAt = now;
    db.liveSync.timerStatus = 'running';
    db.liveSync.isTimerRunning = true;
    db.liveSync.timerEndsAt = station.timerEndsAt;
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

    db.liveSync.timerMode = 'speech';
    db.liveSync.timerStatus = 'running';
    db.liveSync.timerDuration = speechSec;
    db.liveSync.timerTotalSeconds = speechSec;
    db.liveSync.timerRemainingSeconds = speechSec;
    db.liveSync.isTimerRunning = true;
    db.liveSync.timerStartTime = now;
    db.liveSync.timerStartedAt = now;
    db.liveSync.timerAccumulatedMs = 0;
    db.liveSync.timerEndsAt = station.timerEndsAt;
    db.liveSync.timerStopTime = null;
  } else if (action === 'limit_reached' || action === 'time_up') {
    // TIME LIMIT REACHED: trigger buzzer once, BUT KEEP TIMER RUNNING IN OVERTIME!
    station.buzzerPlayed = true;
    station.isOvertime = true;
    station.buzzerTimestamp = now;
    station.lastBuzzerEventId = `buzzer-${now}-${station.id}`;

    db.liveSync.buzzerPlayed = true;
    db.liveSync.isOvertime = true;
    db.liveSync.buzzerTimestamp = now;

    if (roundSettings.buzzerEnabled) {
      broadcastSSE('buzzer_trigger', {
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

    db.liveSync.isTimerRunning = false;
    db.liveSync.timerStatus = 'stopped';
    db.liveSync.timerStopTime = now;
    db.liveSync.timerStartTime = null;
    db.liveSync.timerStartedAt = null;
    db.liveSync.timerEndsAt = null;
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

    db.liveSync.isTimerRunning = false;
    db.liveSync.timerStatus = 'idle';
    db.liveSync.timerMode = 'idle';
    db.liveSync.timerDuration = initSec;
    db.liveSync.timerTotalSeconds = initSec;
    db.liveSync.timerRemainingSeconds = initSec;
    db.liveSync.timerAccumulatedMs = 0;
    db.liveSync.timerStartTime = null;
    db.liveSync.timerStartedAt = null;
    db.liveSync.timerEndsAt = null;
    db.liveSync.timerStopTime = null;
    db.liveSync.buzzerPlayed = false;
    db.liveSync.isOvertime = false;
    db.liveSync.overtimeSeconds = 0;
  }

  persistDB();
  broadcastSSE('station_updated', { ...station, serverTime: now });
  broadcastSSE('live_sync_update', { ...db.liveSync, serverTime: now });
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
    p.status = 'active';
    p.round1Status = 'pending';
    p.round2Status = 'pending';
    p.round3Status = 'pending';
    p.round1Qualified = 'pending';
    p.round2Qualified = 'pending';
    p.round3Qualified = 'pending';
    delete p.qualificationReason;
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

  // 5. Clear round results
  db.round1Results = [];
  db.round2Results = [];
  db.round3Results = [];

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
    p.status = 'active';
    p.round1Status = 'pending';
    p.round2Status = 'pending';
    p.round3Status = 'pending';
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

  // Clear results
  db.round1Results = [];
  db.round2Results = [];
  db.round3Results = [];

  // Reset Live Sync
  db.liveSync = {
    currentRound: 1,
    activeParticipantId: db.participants[0]?.id || null,
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
  broadcastSSE('participant_deleted', { id });
  res.json({ success: true, id });
});

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
  const { topic, category, topicId, stationId, stationName } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic text is required' });

  const finalStId = !stationId || stationId === 'all' || stationId === 'universal' ? undefined : stationId;
  const finalStName = finalStId ? (stationName || resolveStationName(finalStId)) : undefined;

  const newTopic: Topic = {
    id: `top-${Date.now()}`,
    topicId: topicId?.trim() || `TOP-${String(db.topics.length + 1).padStart(3, '0')}`,
    topic: topic.trim(),
    category: category?.trim() || 'General',
    stationId: finalStId,
    stationName: finalStName,
    status: 'available',
  };

  db.topics.push(newTopic);
  persistDB();
  logAction('Topic Created', `Added topic [${newTopic.topicId}]: "${newTopic.topic.substring(0, 40)}..." (${newTopic.stationName || 'Universal'})`);
  broadcastSSE('topics_updated', db.topics);
  res.json(newTopic);
});

app.put('/api/topics/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.topics.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Topic not found' });

  const bodyStationId = req.body.stationId;
  let finalStId = db.topics[idx].stationId;
  let finalStName = db.topics[idx].stationName;

  if (bodyStationId !== undefined) {
    if (!bodyStationId || bodyStationId === 'all' || bodyStationId === 'universal') {
      finalStId = undefined;
      finalStName = undefined;
    } else {
      finalStId = bodyStationId;
      finalStName = req.body.stationName || resolveStationName(bodyStationId);
    }
  }

  db.topics[idx] = {
    ...db.topics[idx],
    ...req.body,
    stationId: finalStId,
    stationName: finalStName,
    id: db.topics[idx].id,
  };

  persistDB();
  broadcastSSE('topics_updated', db.topics);
  res.json(db.topics[idx]);
});

// Bulk update topic stations
app.post('/api/topics/batch-station', (req: Request, res: Response) => {
  const { topicIds, stationId, stationName } = req.body;
  if (!Array.isArray(topicIds)) {
    return res.status(400).json({ error: 'topicIds array is required' });
  }

  const targetStationId = !stationId || stationId === 'all' || stationId === 'universal' ? undefined : stationId;
  const targetStationName = targetStationId ? (stationName || resolveStationName(targetStationId)) : undefined;

  const updated: Topic[] = [];
  topicIds.forEach((id) => {
    const t = db.topics.find((item) => item.id === id);
    if (t) {
      t.stationId = targetStationId;
      t.stationName = targetStationName;
      updated.push(t);
    }
  });

  persistDB();
  logAction('Batch Topic Station Assignment', `Assigned ${updated.length} topics to ${targetStationName || 'Universal / All Stations'}`);
  broadcastSSE('topics_updated', db.topics);
  res.json({ success: true, count: updated.length, topics: updated, allTopics: db.topics });
});

app.delete('/api/topics/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.topics = db.topics.filter((t) => t.id !== id);
  persistDB();
  broadcastSSE('topics_updated', db.topics);
  res.json({ success: true, id });
});

app.post('/api/topics/batch', (req: Request, res: Response) => {
  const items: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }[] = req.body.topics || [];
  const defaultStationId = req.body.stationId === 'all' || !req.body.stationId ? undefined : req.body.stationId;
  const defaultStationName = defaultStationId ? (req.body.stationName || resolveStationName(defaultStationId)) : undefined;

  const added: Topic[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.topic) continue;
    const stId = item.stationId === 'all' ? undefined : (item.stationId || defaultStationId);
    const stName = stId ? (item.stationName || resolveStationName(stId)) : undefined;

    const t: Topic = {
      id: `top-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      topicId: item.topicId?.trim() || `TOP-${String(db.topics.length + i + 1).padStart(3, '0')}`,
      topic: item.topic.trim(),
      category: item.category?.trim() || 'General',
      stationId: stId,
      stationName: stName,
      status: 'available',
    };
    db.topics.push(t);
    added.push(t);
  }

  persistDB();
  logAction('Batch Topics Import', `Imported ${added.length} topics into topic repository`);
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
  const { name, url, imageId, stationId, stationName } = req.body;
  if (!url) return res.status(400).json({ error: 'Image URL is required' });

  const finalImageId = (imageId?.trim() || name?.trim() || `IMG-${String(db.images.length + 1).padStart(3, '0')}`).toUpperCase();
  const assignedStationId = stationId && stationId !== 'all' ? stationId : undefined;
  const assignedStationName = stationName || resolveStationName(assignedStationId);

  const newImg: EventImage = {
    id: `img-${Date.now()}`,
    imageId: finalImageId,
    name: finalImageId,
    url: url.trim(),
    stationId: assignedStationId,
    stationName: assignedStationName,
    status: 'available',
  };

  db.images.push(newImg);
  persistDB();
  logAction('Image Added', `Added image with ID: "${newImg.imageId}"${assignedStationName ? ' for ' + assignedStationName : ''}`);
  broadcastSSE('images_updated', db.images);
  res.json(newImg);
});

app.put('/api/images/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const img = db.images.find((i) => i.id === id);
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const { imageId, name, status, url, stationId, stationName } = req.body;
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
  if (stationId !== undefined) {
    img.stationId = stationId && stationId !== 'all' ? stationId : undefined;
    img.stationName = stationName || resolveStationName(img.stationId);
  }

  persistDB();
  logAction('Image Updated', `Updated image ID "${img.imageId}" (${img.stationName || 'All Stations'})`);
  broadcastSSE('images_updated', db.images);
  res.json(img);
});

// Batch update image stations
app.post('/api/images/batch-station', (req: Request, res: Response) => {
  const { imageIds, stationId, stationName } = req.body;
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({ error: 'imageIds array is required' });
  }

  const assignedStationId = stationId && stationId !== 'all' ? stationId : undefined;
  const assignedStationName = stationName || resolveStationName(assignedStationId);

  const updated: EventImage[] = [];
  db.images.forEach((img) => {
    if (imageIds.includes(img.id)) {
      img.stationId = assignedStationId;
      img.stationName = assignedStationName;
      updated.push(img);
    }
  });

  persistDB();
  logAction('Images Reassigned', `Assigned ${updated.length} image(s) to ${assignedStationName || 'All Stations'}`);
  broadcastSSE('images_updated', db.images);
  res.json({ success: true, count: updated.length, images: updated, allImages: db.images });
});

// Laptop Image Upload Endpoint (Saves to persistent online uploads directory or Cloudinary)
app.post('/api/images/upload', async (req: Request, res: Response) => {
  try {
    const { images, name, base64, imageId, stationId, stationName } = req.body;
    const itemsToProcess: Array<{ name?: string; imageId?: string; base64: string; stationId?: string; stationName?: string }> = [];

    if (Array.isArray(images)) {
      itemsToProcess.push(...images);
    } else if (base64) {
      itemsToProcess.push({ name: name || 'Uploaded Image', imageId, base64, stationId, stationName });
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

      const itemStationId = (item.stationId && item.stationId !== 'all') ? item.stationId : (stationId && stationId !== 'all' ? stationId : undefined);
      const itemStationName = item.stationName || stationName || resolveStationName(itemStationId);

      const assignedId = (item.imageId?.trim() || `IMG-${String(db.images.length + 1).padStart(3, '0')}`).toUpperCase();
      const newImg: EventImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        imageId: assignedId,
        name: assignedId,
        url: imageUrl,
        stationId: itemStationId,
        stationName: itemStationName,
        status: 'available',
      };

      db.images.push(newImg);
      createdImages.push(newImg);
    }

    persistDB();
    logAction('Images Uploaded', `Uploaded ${createdImages.length} image(s) with assigned IDs to repository.`);
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
  res.json({ success: true, id });
});

app.post('/api/images/reset-status', (req: Request, res: Response) => {
  db.images.forEach((img) => {
    img.status = 'available';
    delete img.usedByParticipantId;
    delete img.usedByParticipantName;
    delete img.usedAt;
  });
  persistDB();
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
