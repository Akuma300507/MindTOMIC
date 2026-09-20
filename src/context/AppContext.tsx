import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  type AppDatabase,
  type Participant,
  type Topic,
  type EventImage,
  type CustomFieldDefinition,
  type EventSettings,
  type EventLog,
  type LiveSyncState,
  type PageId,
  type Round1Result,
  type Round2Result,
  type Round3Result,
  type StationState,
  type DeviceRole,
  type ProjectorDevice,
} from '../types';
import { isParticipantCheckedIn } from '../lib/participantUtils';
import { api } from '../lib/api';
import { soundEngine } from '../lib/audio';
import { getServerNow, recordServerTimestamp } from '../lib/timeSync';
import { storageService } from '../lib/storage';

export interface TakeoverModalInfo {
  stationId: string;
  stationName: string;
  currentDeviceName: string;
  resolve: (confirm: boolean) => void;
}

export interface ResetStatusesModalInfo {
  resolve: (confirm: boolean) => void;
}

interface AppContextType {
  db: AppDatabase | null;
  loading: boolean;
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  activeParticipant: Participant | null;
  setActiveParticipant: (p: Participant | null) => void;
  selectNextParticipant: (customList?: Participant[]) => void;
  isConnected: boolean;
  soundUnlocked: boolean;
  unlockSound: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;

  // Station & Device Management
  deviceId: string;
  deviceRole: DeviceRole;
  setDeviceRole: (role: DeviceRole) => void;
  currentStationId: string | null;
  setCurrentStationId: (id: string | null) => void;
  currentStation: StationState | null;
  allStations: StationState[];
  projectorStationId: string | null;
  setProjectorStationId: (id: string | null) => void;
  claimStation: (stationId: string, force?: boolean) => Promise<boolean>;
  releaseStation: (stationId?: string) => Promise<void>;
  takeoverModal: TakeoverModalInfo | null;
  closeTakeoverModal: (confirm: boolean) => void;

  // Projector Devices Management
  projectorDeviceId: string;
  connectedProjectors: ProjectorDevice[];
  assignProjectorStation: (deviceId: string, stationId: string) => Promise<void>;
  pingProjectorDevice: (deviceId: string, message?: string) => Promise<void>;
  refreshConnectedProjectors: () => Promise<void>;
  projectorPingNotification: { timestamp: number; message: string } | null;
  clearProjectorPingNotification: () => void;

  // Event Stage & Competition Round Management
  currentEventRound: 1 | 2 | 3;
  round2PermissionGranted: boolean;
  round3PermissionGranted: boolean;
  grantStagePermission: (
    targetRound: 2 | 3,
    markAbsent?: boolean,
    force?: boolean
  ) => Promise<{ success: boolean; message?: string; markedAbsentCount?: number }>;
  advanceCompetitionRound: (round: 1 | 2 | 3, force?: boolean) => Promise<{ success: boolean; message?: string }>;
  getStationRoundProgress: (stationId: string, round: 1 | 2 | 3) => {
    total: number;
    arrivedCount: number;
    completed: number;
    absentCount: number;
    remaining: number;
    isComplete: boolean;
    pendingParticipants: Participant[];
    absentParticipants: Participant[];
  };
  getGlobalRoundProgress: (round: 1 | 2 | 3) => {
    total: number;
    arrivedCount: number;
    completed: number;
    absentCount: number;
    remaining: number;
    isComplete: boolean;
    pendingParticipants: Participant[];
    absentParticipants: Participant[];
    stationProgress: Record<string, {
      total: number;
      arrivedCount: number;
      completed: number;
      absentCount: number;
      remaining: number;
      isComplete: boolean;
      pendingParticipants: Participant[];
      absentParticipants: Participant[];
    }>;
  };

  // Station Actions
  setStationRound: (stationId: string, round: 1 | 2 | 3, force?: boolean) => Promise<void>;
  setStationParticipant: (stationId: string, participantId: string | null) => Promise<void>;
  updateStationHandler: (stationId: string, data: {
    handlerName?: string | null;
    handlerPhone?: string | null;
    handlerRole?: string | null;
    handlerStatus?: 'active' | 'ready' | 'on_break' | 'busy' | 'away';
    handlerNotes?: string | null;
    name?: string;
    location?: string;
  }) => Promise<void>;
  pingStation: (stationId: string, senderName?: string, message?: string) => Promise<void>;
  assignStationImage: (stationId: string, slotIndex?: number, imageId?: string) => Promise<EventImage>;
  rotateStationImage: (stationId: string, rotation?: number) => Promise<void>;
  spinStationTopic: (stationId: string, wheelTopicIds?: string[], slotIndex?: number) => Promise<{ topic: Topic; targetIndex?: number; wheelTopics?: Topic[]; startedAt: number; durationMs: number; station?: StationState; slotIndex?: number }>;
  completeStationSpin: (stationId: string) => Promise<void>;
  replaceStationWheelTopic: (stationId: string, usedTopicId: string, replacementTopicId?: string) => Promise<{ success: boolean; station: StationState; activeWheelTopics: Topic[] }>;
  sendStationTimerAction: (stationId: string, payload: {
    action: 'start' | 'pause' | 'stop' | 'stop_with_buzzer' | 'reset' | 'time_up' | 'transition_to_speech';
    phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
    startedAt?: number;
  }) => Promise<void>;

  // Master / Admin
  resetStatusesModal: ResetStatusesModalInfo | null;
  requestResetAllStatuses: () => Promise<boolean>;
  closeResetStatusesModal: (confirm: boolean) => void;
  executeResetAllStatuses: () => Promise<void>;

  // Participants
  addParticipant: (p: Partial<Participant>) => Promise<Participant>;
  updateParticipant: (id: string, p: Partial<Participant>) => Promise<Participant>;
  deleteParticipant: (id: string) => Promise<void>;
  deleteAllParticipants: () => Promise<void>;
  importParticipants: (list: Partial<Participant>[]) => Promise<number>;
  batchSetStation: (participantIds: string[], stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => Promise<any>;
  moveParticipantStation: (participantId: string, stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => Promise<Participant>;
  checkInParticipant: (
    id: string,
    options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
  ) => Promise<Participant>;
  batchCheckInParticipants: (
    participantIds: string[],
    options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
  ) => Promise<{ count: number; participants: Participant[] }>;
  // Custom Fields
  addCustomField: (field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  updateCustomField: (id: string, field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  deleteCustomField: (id: string) => Promise<void>;
  // Topics
  addTopic: (topic: string, category?: string, topicId?: string, stationId?: string, stationName?: string) => Promise<Topic>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<Topic>;
  deleteTopic: (id: string) => Promise<void>;
  deleteAllTopics: () => Promise<void>;
  importTopics: (list: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }[], defaultStationId?: string) => Promise<number>;
  batchUpdateTopicStations: (
    topicIds: string[],
    stationId?: string,
    stationName?: string
  ) => Promise<{ success: boolean; count: number; topics: Topic[]; allTopics: Topic[] }>;
  resetTopicsStatus: () => Promise<void>;
  // Images
  addImage: (imageIdOrName: string, url: string, stationId?: string, stationName?: string) => Promise<EventImage>;
  updateImage: (id: string, updates: Partial<EventImage>) => Promise<EventImage>;
  uploadImages: (payload: {
    images?: Array<{ imageId?: string; name?: string; base64: string; stationId?: string; stationName?: string }>;
    name?: string;
    base64?: string;
    imageId?: string;
    stationId?: string;
    stationName?: string;
  }) => Promise<{ success: boolean; count: number; images: EventImage[]; allImages: EventImage[] }>;
  batchUpdateImageStations: (
    imageIds: string[],
    stationId?: string,
    stationName?: string
  ) => Promise<{ success: boolean; count: number; images: EventImage[]; allImages: EventImage[] }>;
  deleteImage: (id: string) => Promise<void>;
  deleteAllImages: () => Promise<void>;
  resetImagesStatus: () => Promise<void>;
  // Settings
  updateSettings: (settings: Partial<EventSettings>) => Promise<EventSettings>;
  // Results
  saveRound1Result: (res: Omit<Round1Result, 'id'>) => Promise<any>;
  saveRound2Result: (res: Omit<Round2Result, 'id'>) => Promise<any>;
  saveRound3Result: (res: Omit<Round3Result, 'id'>) => Promise<any>;
  // Qualification
  setQualification: (
    participantId: string,
    round: 1 | 2 | 3,
    status: 'qualified' | 'disqualified' | 'pending',
    reason?: string
  ) => Promise<Participant>;
  batchSetQualification: (
    participantIds: string[],
    round: 1 | 2 | 3,
    status: 'qualified' | 'disqualified' | 'pending'
  ) => Promise<Participant[]>;
  // Buzzer & Sound
  triggerBuzzer: (reason?: string, round?: string) => Promise<void>;
  playBuzzerLocal: () => void;
  triggerWarningBuzzer: (reason?: string, round?: string) => Promise<void>;
  playWarningBuzzerLocal: () => void;
  uploadCustomBuzzer: (audioData: string, fileName?: string) => Promise<void>;
  resetCustomBuzzer: () => Promise<void>;
  uploadCustomPrepBuzzer: (audioData: string, fileName?: string) => Promise<void>;
  resetCustomPrepBuzzer: () => Promise<void>;
  uploadCustomWarningBuzzer: (audioData: string, fileName?: string) => Promise<void>;
  resetCustomWarningBuzzer: () => Promise<void>;
  uploadCustomLogo: (logoData: string, fileName?: string) => Promise<void>;
  resetCustomLogo: () => Promise<void>;
  uploadInspireLogo: (logoData: string, fileName?: string) => Promise<void>;
  resetInspireLogo: () => Promise<void>;
  // Live Sync & Timer
  updateLiveSync: (updates: Partial<LiveSyncState>) => Promise<void>;
  sendTimerAction: (payload: {
    action: 'start' | 'pause' | 'stop' | 'reset' | 'time_up' | 'transition_to_speech' | 'stop_with_buzzer';
    phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
    startedAt?: number;
  }) => Promise<void>;
  // Atomic Round 1 & Round 2 operations
  assignRound1Image: (stationId?: string) => Promise<EventImage>;
  spinRound2Topic: (stationId?: string) => Promise<{ topic: Topic; startedAt: number; durationMs: number }>;
  // History & Maintenance
  clearHistory: () => Promise<void>;
  clearLogs: () => Promise<void>;
  startNewEvent: () => Promise<void>;
  resetAllData: () => Promise<void>;
  reloadState: () => Promise<void>;
  // Global Shortcut action hooks
  onTimerStartPause?: () => void;
  setOnTimerStartPause: (fn: (() => void) | undefined) => void;
  onTimerStop?: () => void;
  setOnTimerStop: (fn: (() => void) | undefined) => void;
  onTimerReset?: () => void;
  setOnTimerReset: (fn: (() => void) | undefined) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase | null>(() => storageService.loadPersistedDatabase());
  const dbRef = useRef<AppDatabase | null>(db);
  dbRef.current = db;
  useEffect(() => {
    dbRef.current = db;
  }, [db]);
  const [loading, setLoading] = useState(() => !storageService.loadPersistedDatabase());

  // Stable Device Identification
  const [deviceId] = useState<string>(() => {
    try {
      let id = localStorage.getItem('m2m_device_id');
      if (!id) {
        id = `dev-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('m2m_device_id', id);
      }
      return id;
    } catch {
      return `dev-${Date.now()}`;
    }
  });

  // Unique Projector Device ID (User requirement: Check localStorage for 'projector_device_id', if absent generate and save)
  const [projectorDeviceId] = useState<string>(() => {
    try {
      let id = localStorage.getItem('projector_device_id');
      if (!id) {
        id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem('projector_device_id', id);
      }
      return id;
    } catch {
      return `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    }
  });

  const [connectedProjectors, setConnectedProjectors] = useState<ProjectorDevice[]>([]);
  const [projectorPingNotification, setProjectorPingNotification] = useState<{ timestamp: number; message: string } | null>(null);

  const clearProjectorPingNotification = useCallback(() => {
    setProjectorPingNotification(null);
  }, []);

  const refreshConnectedProjectors = useCallback(async () => {
    try {
      const data = await api.getConnectedProjectors();
      const list = Array.isArray(data) ? data : ((data as any)?.projectors || []);
      setConnectedProjectors(list);
    } catch (err) {
      console.error('Failed to fetch connected projectors:', err);
      setConnectedProjectors([]);
    }
  }, []);

  const assignProjectorStation = useCallback(async (devId: string, stId: string) => {
    await api.assignProjectorStation(devId, stId);
    await refreshConnectedProjectors();
  }, [refreshConnectedProjectors]);

  const pingProjectorDevice = useCallback(async (devId: string, message?: string) => {
    await api.pingProjectorDevice(devId, message);
  }, []);

  const [deviceRole, setDeviceRoleState] = useState<DeviceRole>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRole = urlParams.get('role') as DeviceRole | null;
      if (urlRole && ['station', 'master', 'projector'].includes(urlRole)) return urlRole;
      const urlPage = urlParams.get('page');
      if (urlPage === 'projector') return 'projector';
      if (urlPage === 'master') return 'master';
      const saved = localStorage.getItem('m2m_device_role') as DeviceRole | null;
      if (saved && ['station', 'master', 'projector'].includes(saved)) {
        if (saved === 'projector' && urlPage && urlPage !== 'projector') return 'station';
        return saved;
      }
    } catch {}
    return 'station';
  });

  const setDeviceRole = useCallback((role: DeviceRole) => {
    setDeviceRoleState(role);
    try {
      localStorage.setItem('m2m_device_role', role);
    } catch {}
  }, []);

  const [currentStationId, setCurrentStationIdState] = useState<string | null>(() => {
    try {
      const urlStation = new URLSearchParams(window.location.search).get('station');
      if (urlStation) return urlStation;
      const saved = localStorage.getItem('m2m_current_station_id');
      if (saved) return saved;
    } catch {}
    return 'station-a';
  });

  const setCurrentStationId = useCallback((id: string | null) => {
    setCurrentStationIdState(id);
    try {
      if (id) {
        localStorage.setItem('m2m_current_station_id', id);
      } else {
        localStorage.removeItem('m2m_current_station_id');
      }
    } catch {}

    // Auto-switch active participant to match new station
    if (id && id !== 'all') {
      const currentDb = dbRef.current;
      if (currentDb?.participants) {
        const staged = currentDb.stations?.[id]?.activeParticipant;
        if (staged) {
          setActiveParticipant(staged);
        } else {
          // Do not auto-stage contestants; keep current only if it belongs to this station, otherwise reset
          setActiveParticipant((currPart) => {
            if (currPart && (currPart.stationId === id || currPart.checkedInStationId === id)) return currPart;
            return null;
          });
        }
      }
    }
  }, []);

  const currentStationIdRef = useRef<string | null>(currentStationId);
  useEffect(() => {
    currentStationIdRef.current = currentStationId;
  }, [currentStationId]);

  const deviceRoleRef = useRef<DeviceRole>(deviceRole);
  useEffect(() => {
    deviceRoleRef.current = deviceRole;
  }, [deviceRole]);

  const [projectorStationId, setProjectorStationIdState] = useState<string | null>(() => {
    try {
      const urlStation = new URLSearchParams(window.location.search).get('projector_station');
      if (urlStation) return urlStation;
      return localStorage.getItem('m2m_projector_station_id') || 'station-a';
    } catch {}
    return 'station-a';
  });

  const setProjectorStationId = useCallback((id: string | null) => {
    setProjectorStationIdState(id);
    try {
      if (id) {
        localStorage.setItem('m2m_projector_station_id', id);
      } else {
        localStorage.removeItem('m2m_projector_station_id');
      }
    } catch {}
  }, []);

  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    try {
      const urlPage = new URLSearchParams(window.location.search).get('page') as PageId | null;
      if (
        urlPage &&
        [
          'dashboard',
          'master',
          'participants',
          'round1',
          'round2',
          'round3',
          'topics',
          'images',
          'results',
          'settings',
          'excel',
          'history',
          'buzzer',
          'projector',
        ].includes(urlPage)
      ) {
        return urlPage;
      }
    } catch {
      // ignore
    }
    return 'dashboard';
  });
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Takeover confirmation modal state
  const [takeoverModal, setTakeoverModal] = useState<TakeoverModalInfo | null>(null);

  // Reset statuses confirmation modal state
  const [resetStatusesModal, setResetStatusesModal] = useState<ResetStatusesModalInfo | null>(null);

  // Buzzer Debounce Tracker (prevents double-sounding)
  const lastPlayedBuzzerEventId = useRef<string>('');
  const lastPlayedBuzzerTime = useRef<number>(0);

  // Shortcut listeners references using useRef to avoid re-rendering entire provider
  const timerStartPauseRef = useRef<(() => void) | undefined>(undefined);
  const timerStopRef = useRef<(() => void) | undefined>(undefined);
  const timerResetRef = useRef<(() => void) | undefined>(undefined);

  const setOnTimerStartPause = useCallback((fn: (() => void) | undefined) => {
    timerStartPauseRef.current = fn;
  }, []);

  const setOnTimerStop = useCallback((fn: (() => void) | undefined) => {
    timerStopRef.current = fn;
  }, []);

  const setOnTimerReset = useCallback((fn: (() => void) | undefined) => {
    timerResetRef.current = fn;
  }, []);

  const unlockSound = useCallback(() => {
    const success = soundEngine.unlock();
    if (success) {
      setSoundUnlocked(true);
    }
  }, []);

  const playBuzzerLocal = useCallback(() => {
    const currentDb = dbRef.current;
    if (currentDb?.settings?.buzzer?.laptopBuzzer !== false) {
      soundEngine.playBuzzer(
        currentDb?.settings?.buzzer?.sound || 'horn',
        currentDb?.settings?.buzzer?.volume ?? 90,
        currentDb?.settings?.buzzer?.customAudioUrl
      );
    }
  }, []);

  const playBuzzerWithDebounce = useCallback((eventId?: string) => {
    const now = Date.now();
    if (eventId && lastPlayedBuzzerEventId.current === eventId) {
      return; // Already played for this event
    }
    if (now - lastPlayedBuzzerTime.current < 1200) {
      return; // Debounced within 1.2s
    }
    if (eventId) {
      lastPlayedBuzzerEventId.current = eventId;
    }
    lastPlayedBuzzerTime.current = now;
    playBuzzerLocal();
  }, [playBuzzerLocal]);

  const playWarningBuzzerLocal = useCallback(() => {
    const currentDb = dbRef.current;
    if (currentDb?.settings?.buzzer?.laptopBuzzer !== false) {
      soundEngine.playWarningBuzzer(
        currentDb?.settings?.buzzer?.warningSound || 'double_beep',
        currentDb?.settings?.buzzer?.warningVolume ?? 85,
        currentDb?.settings?.buzzer?.warningCustomAudioUrl
      );
    }
  }, []);

  const playWarningBuzzerWithDebounce = useCallback((eventId?: string) => {
    const now = Date.now();
    if (eventId && lastPlayedBuzzerEventId.current === eventId) {
      return;
    }
    if (now - lastPlayedBuzzerTime.current < 1200) {
      return;
    }
    if (eventId) {
      lastPlayedBuzzerEventId.current = eventId;
    }
    lastPlayedBuzzerTime.current = now;
    playWarningBuzzerLocal();
  }, [playWarningBuzzerLocal]);

  const reloadState = useCallback(async () => {
    try {
      const serverState = await api.getState();
      const localState = storageService.loadPersistedDatabase();
      const { mergedDb, hasLocalAdditions, localAdditions } = storageService.reconcileWithServerState(
        serverState,
        localState
      );
      setDb(mergedDb);

      if (hasLocalAdditions) {
        api.syncRestore(localAdditions).catch((syncErr) => {
          console.warn('[sync] Background sync of local additions to server failed:', syncErr);
        });
      }

      // Initialize active participant from staged station participant or station participant
      setActiveParticipant((current) => {
        if (current) return current;
        if (!mergedDb.participants || mergedDb.participants.length === 0) return null;
        if (currentStationId && currentStationId !== 'all') {
          const staged = mergedDb.stations?.[currentStationId]?.activeParticipant;
          if (staged) return staged;
        }
        return null;
      });
    } catch (err) {
      console.error('Failed to load initial state from server, falling back to persistent storage:', err);
      const localState = storageService.loadPersistedDatabase();
      if (localState) {
        setDb(localState);
      }
    } finally {
      setLoading(false);
    }
  }, [currentStationId]);

  useEffect(() => {
    reloadState();
    refreshConnectedProjectors();
  }, [reloadState, refreshConnectedProjectors]);

  // Periodic heartbeat for claimed station operator
  useEffect(() => {
    if (deviceRole !== 'station' || !currentStationId) return;

    const stationName = db?.stations?.[currentStationId]?.name || currentStationId;
    const interval = setInterval(() => {
      api.heartbeatStation(currentStationId, deviceId, `${stationName} Operator`);
    }, 10000);

    return () => clearInterval(interval);
  }, [deviceRole, currentStationId, deviceId, db?.stations]);

  // Derived current station & station list
  const currentStation = useMemo(() => {
    if (!db?.stations || !currentStationId) return null;
    return db.stations[currentStationId] || null;
  }, [db?.stations, currentStationId]);

  const allStations = useMemo(() => {
    if (!db?.stations) return [];
    return Object.values(db.stations);
  }, [db?.stations]);

  const setStationParticipant = useCallback(
    async (stationId: string, participantId: string | null) => {
      // Optimistically update station state in db immediately
      const currentDb = dbRef.current;
      const targetParticipant =
        participantId && currentDb?.participants
          ? currentDb.participants.find((p) => p.id === participantId) || null
          : null;

      setDb((prev) => {
        if (!prev) return prev;
        const currentStations = prev.stations || {};
        const station = currentStations[stationId];
        if (!station) return prev;

        // When selecting a participant, only restore an image if this participant already had one assigned previously
        let optimisticImage: EventImage | null = null;
        let optimisticImageId: string | null = null;
        if (targetParticipant) {
          const r1Res = (prev.round1Results || []).find((r) => r.participantId === targetParticipant.id);
          const savedImgId = r1Res?.imageId || (targetParticipant as any)?.round1ImageId;
          if (savedImgId) {
            const found = prev.images?.find((i) => i.id === savedImgId || i.imageId === savedImgId);
            if (found) {
              optimisticImage = found;
              optimisticImageId = found.id;
            }
          }
        }

        const updatedStation: StationState = {
          ...station,
          activeParticipantId: participantId,
          activeParticipant: targetParticipant,
          selectedImage: optimisticImage,
          selectedImageId: optimisticImageId,
        };

        const nextStations = { ...currentStations, [stationId]: updatedStation };
        return {
          ...prev,
          stations: nextStations,
          liveSync: {
            ...prev.liveSync,
            stationStates: nextStations,
          },
        };
      });

      try {
        const res = await api.setStationParticipant(stationId, participantId);
        setDb((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stations: { ...(prev.stations || {}), [stationId]: res.station },
          };
        });
      } catch (err) {
        console.error('Failed to set station participant on server:', err);
      }
    },
    []
  );

  // Active Competition Stage derived from liveSync
  const currentEventRound: 1 | 2 | 3 = (db?.liveSync?.currentRound || 1) as 1 | 2 | 3;
  const round2PermissionGranted = Boolean(db?.liveSync?.round2PermissionGranted || currentEventRound >= 2);
  const round3PermissionGranted = Boolean(db?.liveSync?.round3PermissionGranted || currentEventRound >= 3);

  // Station Round Completion Progress calculation (attendance-grounded)
  const getStationRoundProgress = useCallback(
    (stationId: string, round: 1 | 2 | 3) => {
      const participants = db?.participants || [];
      const results =
        round === 1 ? db?.round1Results || [] : round === 2 ? db?.round2Results || [] : db?.round3Results || [];

      const allocated = participants.filter((p) => {
        const stationMatches =
          p.stationId === stationId ||
          (round === 1 && p.round1StationId === stationId) ||
          (round === 2 && p.round2StationId === stationId) ||
          (round === 3 && p.round3StationId === stationId) ||
          (!p.stationId && stationId === 'station-a');

        if (!stationMatches) return false;
        if (round === 2 && p.round1Qualified !== 'qualified') return false;
        if (round === 3 && p.round2Qualified !== 'qualified') return false;
        if (p.status === 'eliminated' || p.status === 'disqualified') return false;
        return true;
      });

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
      const remaining = pendingArrived.length;
      const isComplete = arrived.length > 0 ? remaining === 0 : true;

      return {
        total: allocated.length,
        arrivedCount: arrived.length,
        completed: completed.length,
        absentCount: absent.length,
        remaining,
        isComplete,
        pendingParticipants: pendingArrived,
        absentParticipants: absent,
      };
    },
    [db?.participants, db?.round1Results, db?.round2Results, db?.round3Results]
  );

  const getGlobalRoundProgress = useCallback(
    (round: 1 | 2 | 3) => {
      let total = 0;
      let arrived = 0;
      let completed = 0;
      let absent = 0;
      let remaining = 0;
      const allPending: Participant[] = [];
      const allAbsent: Participant[] = [];
      const stationMap: Record<string, ReturnType<typeof getStationRoundProgress>> = {};

      allStations.forEach((st) => {
        const prog = getStationRoundProgress(st.id, round);
        stationMap[st.id] = prog;
        total += prog.total;
        arrived += prog.arrivedCount;
        completed += prog.completed;
        absent += prog.absentCount;
        remaining += prog.remaining;
        allPending.push(...prog.pendingParticipants);
        allAbsent.push(...prog.absentParticipants);
      });

      return {
        total,
        arrivedCount: arrived,
        completed,
        absentCount: absent,
        remaining,
        isComplete: arrived > 0 ? remaining === 0 : true,
        pendingParticipants: allPending,
        absentParticipants: allAbsent,
        stationProgress: stationMap,
      };
    },
    [allStations, getStationRoundProgress]
  );

  const advanceCompetitionRound = useCallback(
    async (round: 1 | 2 | 3, force?: boolean): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await api.setEventRound(round, force);
        setDb((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stations: res.stations,
            liveSync: {
              ...prev.liveSync,
              currentRound: res.currentRound,
              round2PermissionGranted: res.round2PermissionGranted ?? (res.currentRound >= 2),
              round3PermissionGranted: res.round3PermissionGranted ?? (res.currentRound >= 3),
              stationStates: res.stations,
            },
          };
        });
        return { success: true, message: `Successfully advanced all stations to Round ${round}` };
      } catch (err: any) {
        console.error('Failed to advance competition round:', err);
        return { success: false, message: err?.message || 'Failed to advance competition round' };
      }
    },
    []
  );

  const grantStagePermission = useCallback(
    async (
      targetRound: 2 | 3,
      markAbsent = true,
      force = false
    ): Promise<{ success: boolean; message?: string; markedAbsentCount?: number }> => {
      try {
        const res = await api.grantStagePermission(targetRound, markAbsent, force);
        setDb((prev) => {
          if (!prev) return prev;
          let updatedParticipants = prev.participants;
          if (markAbsent && res.markedAbsentCount > 0) {
            updatedParticipants = prev.participants.map((p) => {
              if (!isParticipantCheckedIn(p) && p.status !== 'eliminated' && p.status !== 'disqualified') {
                return {
                  ...p,
                  status: 'absent' as const,
                  round1Qualified: 'disqualified' as const,
                };
              }
              return p;
            });
          }
          return {
            ...prev,
            participants: updatedParticipants,
            stations: res.stations,
            liveSync: {
              ...prev.liveSync,
              currentRound: res.currentRound,
              round2PermissionGranted: res.round2PermissionGranted ?? (res.currentRound >= 2),
              round3PermissionGranted: res.round3PermissionGranted ?? (res.currentRound >= 3),
              stationStates: res.stations,
            },
          };
        });
        return {
          success: true,
          message: res.message || `Stage permission granted for Round ${targetRound}`,
          markedAbsentCount: res.markedAbsentCount,
        };
      } catch (err: any) {
        console.error('Failed to grant stage permission:', err);
        return { success: false, message: err?.message || 'Failed to grant stage permission' };
      }
    },
    []
  );

  // Station claim & takeover
  const claimStation = useCallback(
    async (stationId: string, force: boolean = false): Promise<boolean> => {
      try {
        const station = db?.stations?.[stationId];
        const res = await api.claimStation(
          stationId,
          deviceId,
          `${station?.name || 'Station'} Operator`,
          force
        );

        if (res.conflict) {
          return new Promise<boolean>((resolve) => {
            setTakeoverModal({
              stationId,
              stationName: station?.name || stationId,
              currentDeviceName: res.currentDeviceName || 'Another Device',
              resolve,
            });
          });
        }
        return Boolean(res.success);
      } catch (err: any) {
        console.error('Failed to claim station:', err);
        return false;
      }
    },
    [deviceId, db?.stations]
  );

  const closeTakeoverModal = useCallback(
    async (confirm: boolean) => {
      if (!takeoverModal) return;
      const { stationId, resolve } = takeoverModal;
      setTakeoverModal(null);
      if (confirm) {
        const success = await claimStation(stationId, true);
        resolve(success);
      } else {
        resolve(false);
      }
    },
    [takeoverModal, claimStation]
  );

  const releaseStation = useCallback(
    async (stationId?: string) => {
      const targetId = stationId || currentStationId;
      if (targetId && deviceId) {
        await api.releaseStation(targetId, deviceId);
      }
    },
    [currentStationId, deviceId]
  );

  // Station Actions
  const setStationRound = useCallback(
    async (stationId: string, round: 1 | 2 | 3, force?: boolean) => {
      const res = await api.setStationRound(stationId, round, force);
      setDb((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stations: { ...(prev.stations || {}), [stationId]: res.station },
        };
      });
    },
    []
  );

  const updateStationHandler = useCallback(
    async (
      stationId: string,
      data: {
        handlerName?: string | null;
        handlerPhone?: string | null;
        handlerRole?: string | null;
        handlerStatus?: 'active' | 'ready' | 'on_break' | 'busy' | 'away';
        handlerNotes?: string | null;
        name?: string;
        location?: string;
      }
    ) => {
      const res = await api.updateStationHandler(stationId, data);
      setDb((prev) => {
        if (!prev) return prev;
        const updatedStations = { ...(prev.stations || {}), [stationId]: res.station };
        const updatedSettingsStations = (prev.settings.stations || []).map((s) =>
          s.id === stationId
            ? {
                ...s,
                ...(data.name ? { name: data.name } : {}),
                ...(data.location ? { location: data.location } : {}),
                handlerName: data.handlerName || undefined,
                handlerPhone: data.handlerPhone || undefined,
                handlerRole: data.handlerRole || undefined,
                handlerStatus: data.handlerStatus || undefined,
                handlerNotes: data.handlerNotes || undefined,
              }
            : s
        );
        return {
          ...prev,
          stations: updatedStations,
          settings: {
            ...prev.settings,
            stations: updatedSettingsStations,
          },
        };
      });
    },
    []
  );

  const pingStation = useCallback(
    async (stationId: string, senderName?: string, message?: string) => {
      await api.pingStation(stationId, senderName, message);
    },
    []
  );

  const assignStationImage = useCallback(
    async (stationId: string, slotIndex?: number, imageId?: string) => {
      const station = db?.stations?.[stationId];
      const res = await api.assignStationImage(
        stationId,
        station?.activeParticipantId || undefined,
        station?.activeParticipant?.name || undefined,
        slotIndex,
        imageId
      );
      setDb((prev) => {
        if (!prev) return prev;
        const updatedImages = prev.images.map((img) => (img.id === res.image.id ? res.image : img));
        return {
          ...prev,
          images: updatedImages,
          stations: { ...(prev.stations || {}), [stationId]: res.station },
        };
      });
      return res.image;
    },
    [db?.stations]
  );

  const rotateStationImage = useCallback(
    async (stationId: string, rotation?: number) => {
      const res = await api.rotateStationImage(stationId, rotation);
      setDb((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stations: { ...(prev.stations || {}), [stationId]: res.station },
        };
      });
    },
    []
  );

  const spinStationTopic = useCallback(
    async (stationId: string, wheelTopicIds?: string[], slotIndex?: number) => {
      const station = db?.stations?.[stationId];
      const res = await api.spinStationTopic(
        stationId,
        station?.activeParticipantId || undefined,
        station?.activeParticipant?.name || undefined,
        wheelTopicIds,
        slotIndex
      );
      setDb((prev) => {
        if (!prev) return prev;
        const updatedTopics = prev.topics.map((t) => (t.id === res.topic.id ? res.topic : t));
        return {
          ...prev,
          topics: updatedTopics,
          stations: { ...(prev.stations || {}), [stationId]: res.station },
        };
      });
      return res;
    },
    [db?.stations]
  );

  const completeStationSpin = useCallback(async (stationId: string) => {
    const res = await api.completeStationSpin(stationId);
    setDb((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stations: { ...(prev.stations || {}), [stationId]: res.station },
      };
    });
  }, []);

  const replaceStationWheelTopic = useCallback(
    async (stationId: string, usedTopicId: string, replacementTopicId?: string) => {
      const res = await api.replaceStationWheelTopic(stationId, usedTopicId, replacementTopicId);
      setDb((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stations: { ...(prev.stations || {}), [stationId]: res.station },
        };
      });
      return res;
    },
    []
  );

  const sendStationTimerAction = useCallback(
    async (
      stationId: string,
      payload: {
        action: 'start' | 'pause' | 'stop' | 'stop_with_buzzer' | 'reset' | 'time_up' | 'transition_to_speech';
        phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
        totalSeconds?: number;
        remainingSeconds?: number;
        round?: string;
        endsAt?: number;
        startedAt?: number;
      }
    ) => {
      const serverNow = getServerNow();
      const finalPayload = {
        ...payload,
        startedAt: payload.action === 'start' ? (payload.startedAt || serverNow) : payload.startedAt,
      };

      // Immediate local zero-delay buzzer trigger ONLY on natural Time Up (Stop button must NOT play buzzer)
      if (payload.action === 'time_up') {
        const roundNum = db?.stations?.[stationId]?.currentRound || 1;
        const roundSettings = (db?.settings as any)?.[`round${roundNum}`] || db?.settings?.round1;
        if (roundSettings?.buzzerEnabled !== false) {
          const localEventId = `buzzer-${Date.now()}-${stationId}`;
          playBuzzerWithDebounce(localEventId);
        }
      }

      // Optimistic local state update for instant zero-lag response
      if (payload.action === 'start') {
        setDb((prev) => {
          if (!prev) return prev;
          const targetStation = prev.stations?.[stationId];
          if (!targetStation) return prev;
          const duration = payload.totalSeconds || targetStation.timerDuration || 120;
          const rem = typeof payload.remainingSeconds === 'number' ? payload.remainingSeconds : duration;
          const updated: StationState = {
            ...targetStation,
            timerMode: payload.phase || targetStation.timerMode || 'speech',
            timerDuration: duration,
            timerTotalSeconds: duration,
            timerRemainingSeconds: rem,
            isTimerRunning: true,
            timerStatus: 'running',
            timerStartTime: finalPayload.startedAt,
            timerStartedAt: finalPayload.startedAt,
            timerAccumulatedMs: rem < duration ? Math.max(0, (duration - rem) * 1000) : 0,
            timerEndsAt: (finalPayload.startedAt || serverNow) + rem * 1000,
            timerStopTime: null,
            status: (payload.phase || targetStation.timerMode) === 'prep' ? 'PREPARING' : 'SPEAKING',
            buzzerPlayed: false,
            isOvertime: false,
            overtimeSeconds: 0,
          };
          const stations = { ...(prev.stations || {}), [stationId]: updated };
          return {
            ...prev,
            stations,
            liveSync: {
              ...prev.liveSync,
              stationStates: stations,
            },
          };
        });
      }

      const res = await api.sendStationTimerAction(stationId, finalPayload);
      if (res.serverTime) recordServerTimestamp(res.serverTime);
      setDb((prev) => {
        if (!prev) return prev;
        const stations = { ...(prev.stations || {}), [stationId]: res.station };
        return {
          ...prev,
          stations,
          liveSync: {
            ...prev.liveSync,
            stationStates: stations,
          },
        };
      });
    },
    [playBuzzerWithDebounce]
  );

  // RESET ALL STATUSES (Master / Admin)
  const requestResetAllStatuses = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setResetStatusesModal({ resolve });
    });
  }, []);

  const closeResetStatusesModal = useCallback((confirm: boolean) => {
    if (!resetStatusesModal) return;
    const { resolve } = resetStatusesModal;
    setResetStatusesModal(null);
    resolve(confirm);
  }, [resetStatusesModal]);

  const executeResetAllStatuses = useCallback(async () => {
    const res = await api.resetAllStatuses();
    setDb(res.db);
    setActiveParticipant(null);
  }, []);

  // Real-time SSE Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      const sseUrl = new URL('/api/events', window.location.origin);
      if (projectorDeviceId) {
        sseUrl.searchParams.set('projector_device_id', projectorDeviceId);
      }
      const effectiveRole = currentPage === 'master' ? 'master' : deviceRole;
      if (effectiveRole === 'master') {
        sseUrl.searchParams.set('type', 'master');
      } else {
        if (currentStationId && currentStationId !== 'all') {
          sseUrl.searchParams.set('station', currentStationId);
        }
        if (deviceRole) {
          sseUrl.searchParams.set('type', deviceRole);
        }
      }

      eventSource = new EventSource(sseUrl.toString());

      eventSource.addEventListener('connected', (e) => {
        setIsConnected(true);
        try {
          const payload = JSON.parse(e.data);
          if (payload?.serverTime) recordServerTimestamp(payload.serverTime);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('heartbeat', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.serverTime) recordServerTimestamp(payload.serverTime);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('buzzer_trigger', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const devStation = currentStationIdRef.current;

          // STRICT MULTI-STATION AUDIO ISOLATION:
          // 1. If this buzzer event specifies a stationId:
          //    It MUST ONLY sound on devices/projectors currently operating or assigned to THAT station!
          //    If this device is on another station (e.g. Station B while buzzer is for Station A), SILENCE IT!
          if (payload?.stationId) {
            if (devStation && devStation !== 'all' && payload.stationId !== devStation) {
              return; // Station mismatch -> Silence immediately!
            }
          }

          // 2. If this device is operating a specific station (e.g. Station B):
          //    Never play ANY timer/time_limit buzzers unless specifically addressed to THIS station!
          //    This prevents un-isolated global timer alarms from disrupting this station's ongoing speech.
          if (devStation && devStation !== 'all') {
            const isTimerBuzzer =
              payload?.source === 'time_limit' ||
              payload?.source === 'timer' ||
              payload?.source === 'timer_auto' ||
              payload?.reason?.toLowerCase().includes('time');
            if (isTimerBuzzer && payload?.stationId !== devStation) {
              return; // Silence timer alarm from other station!
            }
          }

          if (payload?.soundType === 'warning' || payload?.source === 'warning_buzzer') {
            playWarningBuzzerWithDebounce(payload?.eventId);
          } else {
            playBuzzerWithDebounce(payload?.eventId);
          }
        } catch (err) {
          console.error('Failed to handle buzzer SSE event:', err);
        }
      });

      eventSource.addEventListener('station_updated', (e) => {
        try {
          const updatedStation: StationState & { serverTime?: number } = JSON.parse(e.data);
          if (updatedStation.serverTime) recordServerTimestamp(updatedStation.serverTime);
          setDb((prev) => {
            if (!prev) return prev;
            const stations = { ...(prev.stations || {}), [updatedStation.id]: updatedStation };
            return {
              ...prev,
              stations,
              liveSync: {
                ...prev.liveSync,
                stationStates: stations,
              },
            };
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('stations_updated', (e) => {
        try {
          const raw = JSON.parse(e.data);
          const stationList: (StationState & { serverTime?: number })[] = Array.isArray(raw)
            ? raw
            : Object.values(raw || {});
          if (stationList[0]?.serverTime) recordServerTimestamp(stationList[0].serverTime);
          setDb((prev) => {
            if (!prev) return prev;
            const stations = { ...(prev.stations || {}) };
            stationList.forEach((s) => {
              if (s && s.id) {
                stations[s.id] = s;
              }
            });
            return {
              ...prev,
              stations,
              liveSync: {
                ...prev.liveSync,
                stationStates: stations,
              },
            };
          });
        } catch (err) {
          console.error('Failed to handle stations_updated SSE:', err);
        }
      });

      eventSource.addEventListener('live_sync_update', (e) => {
        try {
          const syncData = JSON.parse(e.data);
          if (syncData.serverTime) recordServerTimestamp(syncData.serverTime);
          setDb((prev) => (prev ? { ...prev, liveSync: syncData } : prev));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('timer_update', (e) => {
        try {
          const timerData = JSON.parse(e.data);
          if (timerData.serverTime) recordServerTimestamp(timerData.serverTime);
          setDb((prev) =>
            prev ? { ...prev, liveSync: { ...prev.liveSync, ...timerData } } : prev
          );
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('wheel_spin_started', (e) => {
        try {
          const spinData = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const updatedStation = spinData.stationId && prev.stations?.[spinData.stationId]
              ? {
                  ...prev.stations[spinData.stationId],
                  wheelSpin: {
                    isSpinning: true,
                    targetTopicId: spinData.topic.id,
                    targetTopicTitle: spinData.topic.topic,
                    targetTopicCategory: spinData.topic.category,
                    targetSliceIndex: spinData.targetIndex ?? 0,
                    wheelTopics: spinData.wheelTopics,
                    startedAt: spinData.startedAt,
                    durationMs: spinData.durationMs,
                  },
                }
              : null;
            return {
              ...prev,
              stations: updatedStation && prev.stations
                ? { ...prev.stations, [spinData.stationId]: updatedStation }
                : prev.stations,
            };
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('settings_updated', (e) => {
        try {
          const settings = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, settings };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('images_updated', (e) => {
        try {
          const images = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, images };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('topics_updated', (e) => {
        try {
          const topics = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, topics };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('slots_updated', (e) => {
        try {
          const synchronizedSlots = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, synchronizedSlots };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error('Failed to handle slots_updated SSE:', err);
        }
      });

      eventSource.addEventListener('reset_all_statuses', (e) => {
        try {
          const data = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = {
              ...prev,
              stations: data.stations,
              participants: data.participants,
              images: data.images,
              topics: data.topics,
              liveSync: data.liveSync,
              round1Results: [],
              round2Results: [],
              round3Results: [],
            };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
          setActiveParticipant(null);
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('state_reset', (e) => {
        try {
          const resetDb = JSON.parse(e.data);
          storageService.clearAll();
          storageService.savePersistedDatabase(resetDb);
          setDb(resetDb);
          setActiveParticipant(null);
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participants_updated', (e) => {
        try {
          const participants: Participant[] = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, participants };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participant_created', (e) => {
        try {
          const participant: Participant = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            if (prev.participants.some((p) => p.id === participant.id)) return prev;
            const nextDb = { ...prev, participants: [...prev.participants, participant] };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participant_deleted', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          storageService.recordDeletedParticipant(id);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = { ...prev, participants: prev.participants.filter((p) => p.id !== id) };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participants_batch_imported', (e) => {
        try {
          const created: Participant[] = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const existingIds = new Set(prev.participants.map((p) => p.id));
            const newItems = created.filter((p) => !existingIds.has(p.id));
            const nextDb = { ...prev, participants: [...prev.participants, ...newItems] };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participant_updated', (e) => {
        try {
          const participant: Participant = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = {
              ...prev,
              participants: prev.participants.map((p) => (p.id === participant.id ? participant : p)),
            };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
          setActiveParticipant((curr) => {
            if (curr?.id === participant.id) {
              return participant;
            }
            return curr;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('qualification_updated', (e) => {
        try {
          const { participant } = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = {
              ...prev,
              participants: prev.participants.map((p) => (p.id === participant.id ? participant : p)),
            };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
          setActiveParticipant((curr) => (curr?.id === participant.id ? participant : curr));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participants_batch_updated', (e) => {
        try {
          const raw = JSON.parse(e.data);
          const list: Participant[] = Array.isArray(raw)
            ? raw
            : raw?.updatedList || raw?.participants || [];
          const map = new Map(list.map((p: Participant) => [p.id, p]));
          setDb((prev) => {
            if (!prev) return prev;
            const nextDb = {
              ...prev,
              participants: prev.participants.map((p) => (map.has(p.id) ? (map.get(p.id) as Participant) : p)),
            };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
          setActiveParticipant((curr) => {
            if (!curr) return null;
            const updated = map.get(curr.id);
            if (updated) {
              return updated;
            }
            return curr;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('event_round_changed', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { currentRound, stations } = payload;
          setDb((prev) => {
            if (!prev) return prev;
            const updatedStations = stations || prev.stations;
            const nextDb = {
              ...prev,
              stations: updatedStations,
              liveSync: {
                ...prev.liveSync,
                currentRound,
                round2PermissionGranted: payload.round2PermissionGranted ?? (currentRound >= 2),
                round3PermissionGranted: payload.round3PermissionGranted ?? (currentRound >= 3),
                stagePermissions: payload.stagePermissions || prev.liveSync?.stagePermissions,
                stationStates: updatedStations,
              },
            };
            storageService.savePersistedDatabase(nextDb);
            return nextDb;
          });
        } catch (err) {
          console.error('Failed to handle event_round_changed SSE:', err);
        }
      });

      eventSource.addEventListener('projectors_updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const list = Array.isArray(payload) ? payload : (payload?.projectors || []);
          if (Array.isArray(list)) {
            setConnectedProjectors(list);
          }
        } catch (err) {
          console.error('Failed to handle projectors_updated SSE:', err);
        }
      });

      eventSource.addEventListener('station_assigned', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.stationId) {
            setCurrentStationIdState(payload.stationId);
            try {
              localStorage.setItem('projector_assigned_station', payload.stationId);
              localStorage.setItem('m2m_current_station_id', payload.stationId);
              const url = new URL(window.location.href);
              url.searchParams.set('station', payload.stationId);
              window.history.replaceState({}, '', url.toString());
            } catch {}
          }
        } catch (err) {
          console.error('Failed to handle station_assigned SSE:', err);
        }
      });

      eventSource.addEventListener('projector_ping', (e) => {
        try {
          const payload = JSON.parse(e.data);
          setProjectorPingNotification({
            timestamp: payload?.timestamp || Date.now(),
            message: payload?.message || 'Test Ping from Master Monitor',
          });
        } catch (err) {
          console.error('Failed to handle projector_ping SSE:', err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [playBuzzerWithDebounce, currentStationId, deviceRole, projectorDeviceId, currentPage]);

  // Background station timer progression watcher:
  // Automatically transitions stations from prep to speech and triggers time_up even when operator is on other pages (e.g. Participants)
  useEffect(() => {
    const checkStationTimers = () => {
      const currentDb = dbRef.current;
      if (!currentDb?.stations) return;
      const now = getServerNow();

      Object.values(currentDb.stations).forEach((st) => {
        if (!st.isTimerRunning || st.timerStatus !== 'running') return;

        // Auto-transition from prep to speech when prep ends
        if (st.timerMode === 'prep' && st.timerEndsAt && now >= st.timerEndsAt) {
          sendStationTimerAction(st.id, {
            action: 'transition_to_speech',
            phase: 'speech',
          }).catch((err) => console.error('Failed auto transition to speech:', err));
        }

        // Auto-trigger time_up buzzer when speech timer reaches 0
        if (st.timerMode === 'speech' && !st.buzzerPlayed && st.timerEndsAt && now >= st.timerEndsAt) {
          sendStationTimerAction(st.id, {
            action: 'time_up',
            phase: 'speech',
            remainingSeconds: 0,
          }).catch((err) => console.error('Failed auto time_up:', err));
        }
      });
    };

    const interval = setInterval(checkStationTimers, 400);
    return () => clearInterval(interval);
  }, [sendStationTimerAction]);

  // Fullscreen helper
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Next participant selector (round-aware and qualification-gated)
  const selectNextParticipant = useCallback(
    (customList?: Participant[]) => {
      const currentDb = dbRef.current;
      if (!currentDb || !currentDb.participants || currentDb.participants.length === 0) return;

      const targetStationId =
        currentStationId && currentStationId !== 'all'
          ? currentStationId
          : (allStations[0]?.id || 'station-a');

      let candidateList = customList;
      if (!candidateList || candidateList.length === 0) {
        let pool = currentDb.participants;
        if (currentPage === 'round2') {
          // Round 2 is for contestants who qualified in Round 1
          const r1Qualifiers = currentDb.participants.filter(
            (p) => p.round1Qualified === 'qualified'
          );
          pool = r1Qualifiers.length > 0 ? r1Qualifiers : currentDb.participants;
        } else if (currentPage === 'round3') {
          // Round 3 is for contestants who qualified in Round 2
          const r2Qualifiers = currentDb.participants.filter(
            (p) => p.round2Qualified === 'qualified'
          );
          pool = r2Qualifiers.length > 0 ? r2Qualifiers : currentDb.participants;
        } else {
          // Round 1 or other pages: active, non-eliminated contestants
          const r1Eligible = currentDb.participants.filter(
            (p) => p.status !== 'eliminated' && p.round1Qualified !== 'disqualified'
          );
          pool = r1Eligible.length > 0 ? r1Eligible : currentDb.participants;
        }

        // If a station is selected, prioritize contestants assigned to this station
        if (targetStationId) {
          const stationSpecific = pool.filter(
            (p) =>
              p.stationId === targetStationId ||
              p.checkedInStationId === targetStationId ||
              !p.stationId
          );
          candidateList = stationSpecific.length > 0 ? stationSpecific : pool;
        } else {
          candidateList = pool;
        }
      }

      if (!candidateList || candidateList.length === 0) return;

      // Current staged participant on this station or locally active
      const stagedId =
        currentDb.stations?.[targetStationId]?.activeParticipantId ||
        currentDb.stations?.[targetStationId]?.activeParticipant?.id;

      const currentIdx = stagedId
        ? candidateList.findIndex((p) => p.id === stagedId)
        : activeParticipant
        ? candidateList.findIndex((p) => p.id === activeParticipant.id)
        : -1;

      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % candidateList.length : 0;
      const nextParticipant = candidateList[nextIdx] ?? null;

      if (nextParticipant) {
        setActiveParticipant(nextParticipant);

        if (targetStationId) {
          // Immediately stage on station and broadcast to projector
          setStationParticipant(targetStationId, nextParticipant.id).catch((err) => {
            console.error('Failed to stage next participant on station:', err);
          });
        }
      }
    },
    [currentPage, currentStationId, allStations, activeParticipant, setStationParticipant]
  );

  // Custom Buzzer
  const uploadCustomBuzzer = useCallback(async (audioData: string, fileName?: string) => {
    const res = await api.uploadCustomBuzzer(audioData, fileName);
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  const resetCustomBuzzer = useCallback(async () => {
    const res = await api.resetCustomBuzzer();
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  // Custom Preparation Timer Buzzer (30s prep countdown end)
  const uploadCustomPrepBuzzer = useCallback(async (audioData: string, fileName?: string) => {
    const res = await api.uploadCustomPrepBuzzer(audioData, fileName);
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  const resetCustomPrepBuzzer = useCallback(async () => {
    const res = await api.resetCustomPrepBuzzer();
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  // Custom Warning Timing Buzzer
  const uploadCustomWarningBuzzer = useCallback(async (audioData: string, fileName?: string) => {
    const res = await api.uploadCustomWarningBuzzer(audioData, fileName);
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  const resetCustomWarningBuzzer = useCallback(async () => {
    const res = await api.resetCustomWarningBuzzer();
    setDb((prev) => (prev ? { ...prev, settings: { ...prev.settings, buzzer: res.buzzer } } : prev));
  }, []);

  // Custom Logo Management
  const uploadCustomLogo = useCallback(async (logoData: string, fileName?: string) => {
    const res = await api.uploadCustomLogo(logoData, fileName);
    setDb((prev) => (prev ? { ...prev, settings: res.settings } : prev));
  }, []);

  const resetCustomLogo = useCallback(async () => {
    const res = await api.resetCustomLogo();
    setDb((prev) => (prev ? { ...prev, settings: res.settings } : prev));
  }, []);

  // Inspire 2K26 Logo Management
  const uploadInspireLogo = useCallback(async (logoData: string, fileName?: string) => {
    const res = await api.uploadInspireLogo(logoData, fileName);
    setDb((prev) => (prev ? { ...prev, settings: res.settings } : prev));
  }, []);

  const resetInspireLogo = useCallback(async () => {
    const res = await api.resetInspireLogo();
    setDb((prev) => (prev ? { ...prev, settings: res.settings } : prev));
  }, []);

  // Synchronized Timer Action
  const sendTimerAction = useCallback(
    async (payload: {
      action: 'start' | 'pause' | 'stop' | 'reset' | 'time_up' | 'transition_to_speech' | 'stop_with_buzzer';
      phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
      totalSeconds?: number;
      remainingSeconds?: number;
      round?: string;
      endsAt?: number;
      startedAt?: number;
    }) => {
      try {
        const res = await api.sendTimerAction(payload);
        setDb((prev) => (prev ? { ...prev, liveSync: res.liveSync } : prev));
      } catch (err) {
        console.error('Failed to send timer action:', err);
      }
    },
    []
  );

  // Atomic Round 1 image assignment
  const assignRound1Image = useCallback(
    async (stationId?: string) => {
      const res = await api.assignRound1Image({
        participantId: activeParticipant?.id,
        participantName: activeParticipant?.name,
        stationId,
      });
      setDb((prev) => {
        if (!prev) return prev;
        const updatedImages = prev.images.map((img) => (img.id === res.image.id ? res.image : img));
        return { ...prev, images: updatedImages, liveSync: res.liveSync };
      });
      return res.image;
    },
    [activeParticipant?.id, activeParticipant?.name]
  );

  // Atomic Round 2 topic spin
  const spinRound2Topic = useCallback(
    async (stationId?: string) => {
      const res = await api.spinRound2Topic({
        participantId: activeParticipant?.id,
        participantName: activeParticipant?.name,
        stationId,
      });
      setDb((prev) => {
        if (!prev) return prev;
        const updatedTopics = prev.topics.map((t) => (t.id === res.topic.id ? res.topic : t));
        return { ...prev, topics: updatedTopics, liveSync: res.liveSync };
      });
      return res;
    },
    [activeParticipant?.id, activeParticipant?.name]
  );

  // Start fresh event
  const startNewEvent = useCallback(async () => {
    storageService.clearDeletedRecords();
    await api.startNewEvent();
    await reloadState();
  }, [reloadState]);

  // Buzzer
  const triggerBuzzer = useCallback(
    async (reason: string = 'Manual Buzzer', round: string = 'General') => {
      unlockSound();
      playBuzzerLocal();
      await api.triggerBuzzer({
        source: 'organizer',
        reason,
        round,
        participantName: activeParticipant?.name,
        stationId: currentStationId || undefined,
      });
    },
    [activeParticipant?.name, currentStationId, unlockSound, playBuzzerLocal]
  );

  const triggerWarningBuzzer = useCallback(
    async (reason: string = 'Warning Buzzer', round: string = 'General') => {
      unlockSound();
      playWarningBuzzerLocal();
      await api.triggerBuzzer({
        source: 'warning_buzzer',
        reason,
        round,
        participantName: activeParticipant?.name,
        stationId: currentStationId || undefined,
      });
    },
    [activeParticipant?.name, currentStationId, unlockSound, playWarningBuzzerLocal]
  );

  // Keyboard shortcuts (SPACE, S, R, B, N, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in input, textarea, or select
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        timerStartPauseRef.current?.();
      } else if (e.key === 's' || e.key === 'S') {
        timerStopRef.current?.();
      } else if (e.key === 'r' || e.key === 'R') {
        timerResetRef.current?.();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        triggerBuzzer('Keyboard Shortcut (B)');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        selectNextParticipant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerBuzzer, toggleFullscreen, selectNextParticipant]);

  // Participants actions
  const addParticipant = useCallback(async (p: Partial<Participant>) => {
    const created = await api.addParticipant(p);
    setDb((prev) => {
      const nextDb = prev ? { ...prev, participants: [...prev.participants, created] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    setActiveParticipant((curr) => curr || created);
    return created;
  }, []);

  const updateParticipant = useCallback(async (id: string, p: Partial<Participant>) => {
    const updated = await api.updateParticipant(id, p);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            participants: prev.participants.map((item) => (item.id === id ? updated : item)),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    setActiveParticipant((curr) => (curr?.id === id ? updated : curr));
    return updated;
  }, []);

  const deleteParticipant = useCallback(async (id: string) => {
    storageService.recordDeletedParticipant(id);
    await api.deleteParticipant(id);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            participants: prev.participants.filter((item) => item.id !== id),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    setActiveParticipant((curr) => (curr?.id === id ? null : curr));
  }, []);

  const deleteAllParticipants = useCallback(async () => {
    const ids = db?.participants?.map((p) => p.id) || [];
    if (ids.length > 0) {
      storageService.recordDeletedParticipants(ids);
    }
    await api.deleteAllParticipants();
    setDb((prev) => {
      const nextDb = prev ? { ...prev, participants: [] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    setActiveParticipant(null);
  }, [db?.participants]);

  const importParticipants = useCallback(async (list: Partial<Participant>[]) => {
    const res = await api.batchAddParticipants(list);
    await reloadState();
    return res.count;
  }, [reloadState]);

  const batchSetStation = useCallback(
    async (participantIds: string[], stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => {
      const res = await api.batchSetStation(participantIds, stationId, stationName, forRound);
      setDb((prev) => {
        if (!prev) return prev;
        const map = new Map(res.participants.map((p) => [p.id, p]));
        const nextDb = {
          ...prev,
          participants: prev.participants.map((p) => (map.has(p.id) ? (map.get(p.id) as Participant) : p)),
        };
        storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      return res;
    },
    []
  );

  const moveParticipantStation = useCallback(
    async (participantId: string, stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => {
      const res = await api.moveParticipantStation(participantId, stationId, stationName, forRound);
      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = {
          ...prev,
          participants: prev.participants.map((p) => (p.id === participantId ? res.participant : p)),
        };
        storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      return res.participant;
    },
    []
  );

  const checkInParticipant = useCallback(
    async (
      id: string,
      options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
    ) => {
      const res = await api.checkInParticipant(id, options);
      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = {
          ...prev,
          participants: prev.participants.map((p) => (p.id === id ? res.participant : p)),
        };
        storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      setActiveParticipant((curr) => {
        if (curr?.id === id) {
          return res.participant;
        }
        return curr;
      });
      return res.participant;
    },
    []
  );

  const batchCheckInParticipants = useCallback(
    async (
      participantIds: string[],
      options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
    ) => {
      const res = await api.batchCheckInParticipants(participantIds, options);
      setDb((prev) => {
        if (!prev) return prev;
        const map = new Map(res.participants.map((p) => [p.id, p]));
        const nextDb = {
          ...prev,
          participants: prev.participants.map((p) => (map.has(p.id) ? (map.get(p.id) as Participant) : p)),
        };
        storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      setActiveParticipant((curr) => {
        if (!curr) return null;
        const updated = res.participants.find((p) => p.id === curr.id);
        if (updated) {
          return updated;
        }
        return curr;
      });
      return { count: res.count, participants: res.participants };
    },
    []
  );

  // Custom fields
  const addCustomField = useCallback(async (field: Partial<CustomFieldDefinition>) => {
    const created = await api.addCustomField(field);
    setDb((prev) => {
      const nextDb = prev ? { ...prev, customFields: [...prev.customFields, created] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return created;
  }, []);

  const updateCustomField = useCallback(async (id: string, field: Partial<CustomFieldDefinition>) => {
    const updated = await api.updateCustomField(id, field);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            customFields: prev.customFields.map((f) => (f.id === id ? updated : f)),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return updated;
  }, []);

  const deleteCustomField = useCallback(async (id: string) => {
    await api.deleteCustomField(id);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            customFields: prev.customFields.filter((f) => f.id !== id),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
  }, []);

  // Topics
  const addTopic = useCallback(async (topic: string, category?: string, topicId?: string, stationId?: string, stationName?: string) => {
    const created = await api.addTopic({ topic, category, topicId, stationId, stationName });
    setDb((prev) => {
      const nextDb = prev ? { ...prev, topics: [...prev.topics, created] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return created;
  }, []);

  const updateTopic = useCallback(async (id: string, updates: Partial<Topic>) => {
    const updated = await api.updateTopic(id, updates);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            topics: prev.topics.map((t) => (t.id === id ? updated : t)),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return updated;
  }, []);

  const deleteTopic = useCallback(async (id: string) => {
    storageService.recordDeletedTopic(id);
    await api.deleteTopic(id);
    setDb((prev) => {
      const nextDb = prev ? { ...prev, topics: prev.topics.filter((t) => t.id !== id) } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
  }, []);

  const deleteAllTopics = useCallback(async () => {
    const allIds = (db?.topics || []).map((t) => t.id);
    storageService.recordDeletedTopics(allIds);
    await api.deleteAllTopics();
    setDb((prev) => {
      const nextDb = prev ? { ...prev, topics: [] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
  }, [db?.topics]);

  const importTopics = useCallback(async (list: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }[], defaultStationId?: string) => {
    const res = await api.batchAddTopics(list, defaultStationId);
    await reloadState();
    return res.count;
  }, [reloadState]);

  const batchUpdateTopicStations = useCallback(
    async (topicIds: string[], stationId?: string, stationName?: string) => {
      const res = await api.batchUpdateTopicStations(topicIds, stationId, stationName);
      setDb((prev) => {
        const nextDb = prev ? { ...prev, topics: res.allTopics } : prev;
        if (nextDb) storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      return res;
    },
    []
  );

  const resetTopicsStatus = useCallback(async () => {
    await api.resetTopicsStatus();
    await reloadState();
  }, [reloadState]);

  // Images
  const addImage = useCallback(async (imageIdOrName: string, url: string, stationId?: string, stationName?: string) => {
    const created = await api.addImage({ imageId: imageIdOrName, name: imageIdOrName, url, stationId, stationName });
    setDb((prev) => {
      const nextDb = prev ? { ...prev, images: [...prev.images, created] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return created;
  }, []);

  const updateImage = useCallback(async (id: string, updates: Partial<EventImage>) => {
    const updated = await api.updateImage(id, updates);
    setDb((prev) => {
      const nextDb = prev
        ? {
            ...prev,
            images: prev.images.map((img) => (img.id === id ? updated : img)),
          }
        : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return updated;
  }, []);

  const uploadImages = useCallback(
    async (payload: {
      images?: Array<{ imageId?: string; name?: string; base64: string; stationId?: string; stationName?: string }>;
      name?: string;
      base64?: string;
      imageId?: string;
      stationId?: string;
      stationName?: string;
    }) => {
      const res = await api.uploadImages(payload);
      setDb((prev) => {
        const nextDb = prev ? { ...prev, images: res.allImages } : prev;
        if (nextDb) storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      return res;
    },
    []
  );

  const batchUpdateImageStations = useCallback(
    async (imageIds: string[], stationId?: string, stationName?: string) => {
      const res = await api.batchUpdateImageStations(imageIds, stationId, stationName);
      setDb((prev) => {
        const nextDb = prev ? { ...prev, images: res.allImages } : prev;
        if (nextDb) storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      return res;
    },
    []
  );

  const deleteImage = useCallback(async (id: string) => {
    storageService.recordDeletedImage(id);
    await api.deleteImage(id);
    setDb((prev) => {
      const nextDb = prev ? { ...prev, images: prev.images.filter((img) => img.id !== id) } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
  }, []);

  const deleteAllImages = useCallback(async () => {
    const allIds = (db?.images || []).map((img) => img.id);
    storageService.recordDeletedImages(allIds);
    await api.deleteAllImages();
    setDb((prev) => {
      const nextDb = prev ? { ...prev, images: [] } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
  }, [db?.images]);

  const resetImagesStatus = useCallback(async () => {
    await api.resetImagesStatus();
    await reloadState();
  }, [reloadState]);

  // Settings
  const updateSettings = useCallback(async (updates: Partial<EventSettings>) => {
    const updated = await api.updateSettings(updates);
    setDb((prev) => {
      const nextDb = prev ? { ...prev, settings: updated } : prev;
      if (nextDb) storageService.savePersistedDatabase(nextDb);
      return nextDb;
    });
    return updated;
  }, []);

  // Results
  const saveRound1Result = useCallback(async (res: Omit<Round1Result, 'id'>) => {
    const saved = await api.saveRound1Result(res);
    await reloadState();
    return saved;
  }, [reloadState]);

  const saveRound2Result = useCallback(async (res: Omit<Round2Result, 'id'>) => {
    const saved = await api.saveRound2Result(res);
    await reloadState();
    return saved;
  }, [reloadState]);

  const saveRound3Result = useCallback(async (res: Omit<Round3Result, 'id'>) => {
    const saved = await api.saveRound3Result(res);
    await reloadState();
    return saved;
  }, [reloadState]);

  // Qualification methods
  const setQualification = useCallback(
    async (
      participantId: string,
      round: 1 | 2 | 3,
      status: 'qualified' | 'disqualified' | 'pending',
      reason?: string
    ) => {
      const res = await api.updateQualification({ participantId, round, status, reason });
      setDb((prev) => {
        if (!prev) return prev;
        const updatedParticipants = prev.participants.map((p) =>
          p.id === participantId ? res.participant : p
        );
        const updatedR1 =
          round === 1
            ? prev.round1Results.map((r) =>
                r.participantId === participantId
                  ? { ...r, qualification: status, qualificationReason: reason }
                  : r
              )
            : prev.round1Results;
        const updatedR2 =
          round === 2
            ? prev.round2Results.map((r) =>
                r.participantId === participantId
                  ? { ...r, qualification: status, qualificationReason: reason }
                  : r
              )
            : prev.round2Results;
        const updatedR3 =
          round === 3
            ? prev.round3Results.map((r) =>
                r.participantId === participantId
                  ? { ...r, qualification: status, qualificationReason: reason }
                  : r
              )
            : prev.round3Results;
        const nextDb = {
          ...prev,
          participants: updatedParticipants,
          round1Results: updatedR1,
          round2Results: updatedR2,
          round3Results: updatedR3,
        };
        storageService.savePersistedDatabase(nextDb);
        return nextDb;
      });
      setActiveParticipant((curr) => (curr?.id === participantId ? res.participant : curr));
      return res.participant;
    },
    []
  );

  const batchSetQualification = useCallback(
    async (
      participantIds: string[],
      round: 1 | 2 | 3,
      status: 'qualified' | 'disqualified' | 'pending'
    ) => {
      const res = await api.batchUpdateQualification({ participantIds, round, status });
      await reloadState();
      return res.participants;
    },
    [reloadState]
  );

  // Live Sync
  const updateLiveSync = useCallback(async (updates: Partial<LiveSyncState>) => {
    try {
      await api.updateLiveSync(updates);
      setDb((prev) => (prev ? { ...prev, liveSync: { ...prev.liveSync, ...updates } } : prev));
    } catch (err) {
      console.error('Failed to update live sync:', err);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    await api.clearHistory();
    setDb((prev) => (prev ? { ...prev, history: [] } : prev));
  }, []);

  const resetAllData = useCallback(async () => {
    storageService.clearAll();
    await api.resetData();
    setActiveParticipant(null);
    setCurrentStationId(null);
    await reloadState();
  }, [reloadState]);

  return (
    <AppContext.Provider
      value={{
        db,
        loading,
        currentPage,
        setCurrentPage,
        activeParticipant,
        setActiveParticipant,
        selectNextParticipant,
        isConnected,
        soundUnlocked,
        unlockSound,
        isFullscreen,
        toggleFullscreen,

        // Station & Device Management
        deviceId,
        deviceRole,
        setDeviceRole,
        currentStationId,
        setCurrentStationId,
        currentStation,
        allStations,
        projectorStationId,
        setProjectorStationId,
        claimStation,
        releaseStation,
        takeoverModal,
        closeTakeoverModal,

        // Projector Devices Management
        projectorDeviceId,
        connectedProjectors,
        assignProjectorStation,
        pingProjectorDevice,
        refreshConnectedProjectors,
        projectorPingNotification,
        clearProjectorPingNotification,
        // Event Stage & Competition Round Management
        currentEventRound,
        round2PermissionGranted,
        round3PermissionGranted,
        grantStagePermission,
        advanceCompetitionRound,
        getStationRoundProgress,
        getGlobalRoundProgress,

        // Station Actions
        setStationRound,
        setStationParticipant,
        updateStationHandler,
        pingStation,
        assignStationImage,
        rotateStationImage,
        spinStationTopic,
        completeStationSpin,
        replaceStationWheelTopic,
        sendStationTimerAction,

        // Master / Admin
        resetStatusesModal,
        requestResetAllStatuses,
        closeResetStatusesModal,
        executeResetAllStatuses,

        addParticipant,
        updateParticipant,
        deleteParticipant,
        deleteAllParticipants,
        importParticipants,
        batchSetStation,
        addCustomField,
        updateCustomField,
        deleteCustomField,
        addTopic,
        updateTopic,
        deleteTopic,
        deleteAllTopics,
        importTopics,
        batchUpdateTopicStations,
        moveParticipantStation,
        checkInParticipant,
        batchCheckInParticipants,
        resetTopicsStatus,
        addImage,
        updateImage,
        uploadImages,
        batchUpdateImageStations,
        deleteImage,
        deleteAllImages,
        resetImagesStatus,
        updateSettings,
        saveRound1Result,
        saveRound2Result,
        saveRound3Result,
        setQualification,
        batchSetQualification,
        triggerBuzzer,
        playBuzzerLocal,
        triggerWarningBuzzer,
        playWarningBuzzerLocal,
        uploadCustomBuzzer,
        resetCustomBuzzer,
        uploadCustomPrepBuzzer,
        resetCustomPrepBuzzer,
        uploadCustomWarningBuzzer,
        resetCustomWarningBuzzer,
        uploadCustomLogo,
        resetCustomLogo,
        uploadInspireLogo,
        resetInspireLogo,
        updateLiveSync,
        sendTimerAction,
        assignRound1Image,
        spinRound2Topic,
        clearHistory,
        clearLogs: clearHistory,
        startNewEvent,
        resetAllData,
        reloadState,
        onTimerStartPause: timerStartPauseRef.current,
        setOnTimerStartPause,
        onTimerStop: timerStopRef.current,
        setOnTimerStop,
        onTimerReset: timerResetRef.current,
        setOnTimerReset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
