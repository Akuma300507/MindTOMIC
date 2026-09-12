import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  AppDatabase,
  Participant,
  Topic,
  EventImage,
  CustomFieldDefinition,
  EventSettings,
  EventLog,
  LiveSyncState,
  PageId,
  Round1Result,
  Round2Result,
  Round3Result,
  StationState,
  DeviceRole,
  ProjectorDevice,
} from '../types';
import { api } from '../lib/api';
import { soundEngine } from '../lib/audio';
import { getServerNow, recordServerTimestamp } from '../lib/timeSync';
import { generateUUID, getDeviceId } from '../lib/offline/device';
import { syncEngine, type SyncEngineState } from '../lib/offline/syncEngine';
import { saveCachedDb, getCachedDb } from '../lib/offline/offlineDb';

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

  // Offline & Synchronization State
  syncState: SyncEngineState;
  syncNow: () => Promise<void>;

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

  // Station Actions
  setStationRound: (stationId: string, round: 1 | 2 | 3) => Promise<void>;
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
  assignStationImage: (stationId: string) => Promise<EventImage>;
  setStationImage: (stationId: string, image: EventImage) => Promise<void>;
  rotateStationImage: (stationId: string, rotation?: number) => Promise<void>;
  spinStationTopic: (stationId: string, wheelTopicIds?: string[]) => Promise<{ topic: Topic; targetIndex?: number; wheelTopics?: Topic[]; startedAt: number; durationMs: number; station?: StationState }>;
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
  importParticipants: (list: Partial<Participant>[]) => Promise<number>;
  batchSetStation: (participantIds: string[], stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => Promise<any>;
  moveParticipantStation: (participantId: string, stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => Promise<Participant>;
  // Custom Fields
  addCustomField: (field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  updateCustomField: (id: string, field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  deleteCustomField: (id: string) => Promise<void>;
  // Topics
  addTopic: (topic: string, category?: string, topicId?: string, stationId?: string, stationName?: string) => Promise<Topic>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<Topic>;
  deleteTopic: (id: string) => Promise<void>;
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
  uploadCustomBuzzer: (audioData: string, fileName?: string) => Promise<void>;
  resetCustomBuzzer: () => Promise<void>;
  uploadCustomPrepBuzzer: (audioData: string, fileName?: string) => Promise<void>;
  resetCustomPrepBuzzer: () => Promise<void>;
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
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronous Database Reference for instant zero-latency offline operations
  const dbRef = useRef<AppDatabase | null>(null);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Stable Persistent Device Identification
  const [deviceId] = useState<string>(() => getDeviceId());

  // Offline Synchronization State
  const [syncState, setSyncState] = useState<SyncEngineState>(() => syncEngine.getState());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newSyncState) => {
      setSyncState(newSyncState);
    });

    const unsubscribeServerState = syncEngine.onServerState((freshDb) => {
      setDb(freshDb);
      saveCachedDb(freshDb).catch(() => {});
    });

    return () => {
      unsubscribe();
      unsubscribeServerState();
    };
  }, []);

  const syncNow = useCallback(async () => {
    await syncEngine.syncNow();
  }, []);

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
      const urlRole = new URLSearchParams(window.location.search).get('role') as DeviceRole | null;
      if (urlRole && ['station', 'master', 'projector'].includes(urlRole)) return urlRole;
      const saved = localStorage.getItem('m2m_device_role') as DeviceRole | null;
      if (saved && ['station', 'master', 'projector'].includes(saved)) return saved;
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

    // Auto-switch active participant to match new station if contestants exist
    if (id && id !== 'all') {
      setDb((currDb) => {
        if (currDb?.participants) {
          const stationParticipants = currDb.participants.filter((p) => p.stationId === id);
          if (stationParticipants.length > 0) {
            setActiveParticipant((currPart) => {
              if (currPart && currPart.stationId === id) return currPart;
              return stationParticipants[0];
            });
          }
        }
        return currDb;
      });
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
  const [activeParticipant, setActiveParticipantState] = useState<Participant | null>(null);
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
    setDb((currentDb) => {
      if (currentDb?.settings.buzzer.laptopBuzzer !== false) {
        soundEngine.playBuzzer(
          currentDb?.settings.buzzer.sound || 'horn',
          currentDb?.settings.buzzer.volume ?? 90,
          currentDb?.settings.buzzer.customAudioUrl
        );
      }
      return currentDb;
    });
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

  // Offline Cross-Tab & Cross-Window Synchronization via BroadcastChannel
  // Synchronizes Projector Displays, Station Controllers, and Master Monitors across windows without network
  const stationChannelRef = useRef<BroadcastChannel | null>(null);

  const broadcastStationLocal = useCallback((type: string, data: any) => {
    try {
      stationChannelRef.current?.postMessage({ type, ...data });
    } catch {
      // BroadcastChannel optional fallback
    }
  }, []);

  const setActiveParticipant = useCallback(
    (participantOrFn: Participant | null | ((prev: Participant | null) => Participant | null)) => {
      setActiveParticipantState((prev) => {
        const next = typeof participantOrFn === 'function' ? participantOrFn(prev) : participantOrFn;
        const stId = currentStationIdRef.current;
        if (stId && stId !== 'all') {
          setDb((currentDb) => {
            if (!currentDb) return currentDb;
            const targetStation = currentDb.stations?.[stId];
            if (!targetStation) return currentDb;
            if (
              targetStation.activeParticipantId === (next?.id || null) &&
              targetStation.activeParticipant?.id === (next?.id || null)
            ) {
              return currentDb;
            }
            const updatedStation: StationState = {
              ...targetStation,
              activeParticipantId: next?.id || null,
              activeParticipant: next,
            };
            const stations = { ...(currentDb.stations || {}), [stId]: updatedStation };
            const updatedDb = { ...currentDb, stations };
            dbRef.current = updatedDb;
            saveCachedDb(updatedDb).catch(() => {});
            broadcastStationLocal('station_updated', { station: updatedStation });
            return updatedDb;
          });
          api.setStationParticipant(stId, next?.id || null).catch(() => {});
        }
        return next;
      });
    },
    [broadcastStationLocal]
  );

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel('mindtomic_station_sync');
    stationChannelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'db_sync' && msg.db) {
        setDb((prev) => {
          if (!prev) return msg.db;
          if (JSON.stringify(prev) === JSON.stringify(msg.db)) return prev;
          return msg.db;
        });
        dbRef.current = msg.db;
        saveCachedDb(msg.db, { skipBroadcast: true, skipPulse: true }).catch(() => {});
      } else if (msg.type === 'station_updated' && msg.station) {
        setDb((prev) => {
          if (!prev) return prev;
          const stations = { ...(prev.stations || {}), [msg.station.id]: msg.station };
          const updated: AppDatabase = {
            ...prev,
            stations,
            liveSync: {
              ...prev.liveSync,
              stationStates: stations,
            },
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'stations_updated' && msg.stations) {
        setDb((prev) => {
          if (!prev) return prev;
          const stations = { ...(prev.stations || {}) };
          if (Array.isArray(msg.stations)) {
            msg.stations.forEach((s: StationState) => {
              stations[s.id] = s;
            });
          } else {
            Object.assign(stations, msg.stations);
          }
          const updated: AppDatabase = {
            ...prev,
            stations,
            liveSync: {
              ...prev.liveSync,
              stationStates: stations,
            },
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'wheel_spin_started' && msg.spinData) {
        const { spinData } = msg;
        setDb((prev) => {
          if (!prev) return prev;
          const targetStation = prev.stations?.[spinData.stationId];
          if (!targetStation) return prev;
          const updatedStation: StationState = {
            ...targetStation,
            status: 'SPINNING',
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
          };
          const stations = { ...prev.stations, [spinData.stationId]: updatedStation };
          const updated: AppDatabase = {
            ...prev,
            stations,
            liveSync: {
              ...prev.liveSync,
              stationStates: stations,
            },
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'participant_created' && msg.participant) {
        setDb((prev) => {
          if (!prev) return prev;
          if (prev.participants.some((p) => p.id === msg.participant.id)) return prev;
          const updated = { ...prev, participants: [...prev.participants, msg.participant] };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'participant_updated' && msg.participant) {
        setDb((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            participants: prev.participants.map((p) => (p.id === msg.participant.id ? { ...p, ...msg.participant } : p)),
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
        setActiveParticipantState((curr) => (curr?.id === msg.participant.id ? { ...curr, ...msg.participant } : curr));
      } else if (msg.type === 'participant_deleted' && msg.id) {
        setDb((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            participants: prev.participants.filter((p) => p.id !== msg.id),
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
        setActiveParticipantState((curr) => (curr?.id === msg.id ? null : curr));
      } else if (msg.type === 'topics_updated' && msg.topics) {
        setDb((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, topics: msg.topics };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'images_updated' && msg.images) {
        setDb((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, images: msg.images };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'settings_updated' && msg.settings) {
        setDb((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, settings: msg.settings };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'result_added' && msg.result) {
        setDb((prev) => {
          if (!prev) return prev;
          const key = msg.round === 1 ? 'round1Results' : msg.round === 2 ? 'round2Results' : 'round3Results';
          const list = (prev as any)[key] || [];
          const updated = {
            ...prev,
            [key]: [...list.filter((r: any) => r.id !== msg.result.id), msg.result],
          };
          dbRef.current = updated;
          saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          return updated;
        });
      } else if (msg.type === 'buzzer_trigger') {
        const { payload } = msg;
        const devStation = currentStationIdRef.current;
        if (payload?.stationId && devStation && devStation !== 'all' && payload.stationId !== devStation) {
          return;
        }
        playBuzzerWithDebounce(payload?.eventId);
      }
    };

    return () => {
      channel.close();
      stationChannelRef.current = null;
    };
  }, [playBuzzerWithDebounce]);

  // Cross-Tab & Cross-Window Instant Synchronization via Storage Events
  // When ANY tab or window writes to IndexedDB cache, this guarantees other windows (like Projector)
  // pick up the change immediately in 0ms without requiring F5.
  useEffect(() => {
    const handleStorageEvent = async (e: StorageEvent) => {
      if (e.key === 'm2m_offline_sync_pulse' || e.key === 'm2m_last_sync_time') {
        try {
          const cached = await getCachedDb();
          if (cached && cached.stations) {
            setDb((prev) => {
              if (!prev) return cached;
              if (JSON.stringify(prev) === JSON.stringify(cached)) return prev;
              return cached;
            });
            dbRef.current = cached;
          }
        } catch {}
      } else if (e.key === 'm2m_current_station_id' && e.newValue) {
        if (e.newValue !== currentStationIdRef.current) {
          setCurrentStationIdState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  const reloadState = useCallback(async () => {
    try {
      const state = await api.getState(800);
      if (state && state.stations) {
        setDb((prev) => {
          if (!prev) return state;
          if (JSON.stringify(prev) === JSON.stringify(state)) return prev;
          return state;
        });
        dbRef.current = state;
        saveCachedDb(state, { skipBroadcast: true, skipPulse: true }).catch(() => {});
      }
    } catch {
      // Offline fallback: restore and sync from IndexedDB
      const cached = await getCachedDb();
      if (cached && cached.stations) {
        setDb((prev) => {
          if (!prev) return cached;
          if (JSON.stringify(prev) === JSON.stringify(cached)) return prev;
          return cached;
        });
        dbRef.current = cached;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Immediate optimistic boot from IndexedDB cache so page loads instantly offline
    getCachedDb().then((cached) => {
      if (cached) {
        setDb((curr) => curr || cached);
        setLoading(false);
        if (deviceRoleRef.current === 'station' && currentStationIdRef.current && currentStationIdRef.current !== 'all') {
          setActiveParticipantState((current) => {
            if (current) return current;
            const stationMatches = cached.participants?.filter((p) => p.stationId === currentStationIdRef.current);
            return stationMatches?.[0] || null;
          });
        }
      }
    }).catch(() => {});

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

  // Synchronize active participant across station
  useEffect(() => {
    if (activeParticipant && currentStationId) {
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[currentStationId];
        if (!targetStation) return prev;
        if (targetStation.activeParticipantId === activeParticipant.id) return prev;
        const updatedStation: StationState = {
          ...targetStation,
          activeParticipantId: activeParticipant.id,
          activeParticipant,
        };
        const stations = { ...(prev.stations || {}), [currentStationId]: updatedStation };
        const updatedDb = { ...prev, stations };
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });
      api.setStationParticipant(currentStationId, activeParticipant.id).catch(() => {});
    }
  }, [activeParticipant, currentStationId, broadcastStationLocal]);

  // Synchronize round switch when operator navigates pages
  useEffect(() => {
    let roundNum: 1 | 2 | 3 | null = null;
    if (currentPage === 'round1') roundNum = 1;
    else if (currentPage === 'round2') roundNum = 2;
    else if (currentPage === 'round3') roundNum = 3;

    if (roundNum && currentStationId) {
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[currentStationId];
        if (!targetStation) return prev;
        if (targetStation.currentRound === roundNum) return prev;
        const updatedStation: StationState = {
          ...targetStation,
          currentRound: roundNum,
          status: 'WAITING',
          timerMode: 'idle',
          isTimerRunning: false,
          timerStatus: 'idle',
        };
        const stations = { ...(prev.stations || {}), [currentStationId]: updatedStation };
        const updatedDb = { ...prev, stations };
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });
      api.setStationRound(currentStationId, roundNum).catch(() => {});
    }
  }, [currentPage, currentStationId, broadcastStationLocal]);

  // Station claim & takeover
  const claimStation = useCallback(
    async (stationId: string, force: boolean = false): Promise<boolean> => {
      try {
        const station = (dbRef.current || db)?.stations?.[stationId];
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

        if (res.success && res.station) {
          setCurrentStationId(stationId);
          setDb((prev) => {
            if (!prev) return prev;
            const stations = { ...(prev.stations || {}), [stationId]: res.station! };
            const nextDb = { ...prev, stations };
            dbRef.current = nextDb;
            return nextDb;
          });
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[Offline] Network offline, claiming station locally:', err);
        setCurrentStationId(stationId);
        setDb((prev) => {
          if (!prev) return prev;
          const current = prev.stations?.[stationId] || {
            id: stationId,
            name: `Station ${stationId.replace('station-', '').toUpperCase()}`,
            currentRound: 1,
            activeParticipantId: null,
            activeParticipant: null,
            status: 'WAITING',
          };
          const updated: StationState = {
            ...current,
            currentDevice: deviceId,
            currentDeviceName: `${current.name || 'Station'} Operator`,
            claimedAt: Date.now(),
          };
          const stations = { ...(prev.stations || {}), [stationId]: updated };
          const nextDb = { ...prev, stations };
          dbRef.current = nextDb;
          saveCachedDb(nextDb).catch(() => {});
          broadcastStationLocal('station_updated', { station: updated });
          return nextDb;
        });
        return true;
      }
    },
    [db, deviceId, setCurrentStationId, broadcastStationLocal]
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
      if (targetId) {
        try {
          await api.releaseStation(targetId, deviceId);
        } catch (err) {
          console.warn('[Offline] releaseStation ignored offline error:', err);
        }
      }
    },
    [currentStationId, deviceId]
  );

  // Station Actions
  const setStationRound = useCallback(
    async (stationId: string, round: 1 | 2 | 3) => {
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stationId];
        if (!targetStation) return prev;
        const updatedStation: StationState = {
          ...targetStation,
          currentRound: round,
          status: 'WAITING',
          timerMode: 'idle',
          isTimerRunning: false,
          timerStatus: 'idle',
        };
        const stations = { ...(prev.stations || {}), [stationId]: updatedStation };
        const updatedDb = { ...prev, stations };
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        await api.setStationRound(stationId, round);
      } catch (err) {
        console.warn('[Offline] setStationRound saved locally:', err);
      }
    },
    [broadcastStationLocal]
  );

  const setStationParticipant = useCallback(
    async (stationId: string, participantId: string | null) => {
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stationId];
        if (!targetStation) return prev;
        const participant =
          participantId && prev.participants ? prev.participants.find((p) => p.id === participantId) || null : null;
        const updatedStation: StationState = {
          ...targetStation,
          activeParticipantId: participantId,
          activeParticipant: participant,
        };
        const stations = { ...(prev.stations || {}), [stationId]: updatedStation };
        const updatedDb = { ...prev, stations };
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        await api.setStationParticipant(stationId, participantId);
      } catch (err) {
        console.warn('[Offline] setStationParticipant saved locally:', err);
      }
    },
    [broadcastStationLocal]
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
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stationId];
        if (!targetStation) return prev;
        const updatedStation: StationState = {
          ...targetStation,
          ...(data.name ? { name: data.name } : {}),
          ...(data.location ? { location: data.location } : {}),
          handlerName: data.handlerName !== undefined ? data.handlerName : targetStation.handlerName,
          handlerPhone: data.handlerPhone !== undefined ? data.handlerPhone : targetStation.handlerPhone,
          handlerRole: data.handlerRole !== undefined ? data.handlerRole : targetStation.handlerRole,
          handlerStatus: data.handlerStatus !== undefined ? data.handlerStatus : targetStation.handlerStatus,
          handlerNotes: data.handlerNotes !== undefined ? data.handlerNotes : targetStation.handlerNotes,
        };
        const updatedStations = { ...(prev.stations || {}), [stationId]: updatedStation };
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
        const updatedDb = {
          ...prev,
          stations: updatedStations,
          settings: {
            ...prev.settings,
            stations: updatedSettingsStations,
          },
        };
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        await api.updateStationHandler(stationId, data);
      } catch (err) {
        console.warn('[Offline] updateStationHandler saved locally:', err);
      }
    },
    [broadcastStationLocal]
  );

  const pingStation = useCallback(
    async (stationId: string, senderName?: string, message?: string) => {
      try {
        await api.pingStation(stationId, senderName, message);
      } catch (err) {
        console.warn('[Offline] pingStation skipped offline:', err);
      }
    },
    []
  );

  const assignStationImage = useCallback(
    async (stationId: string) => {
      const currentDb = dbRef.current || db;
      if (!currentDb) {
        throw new Error('Database not loaded yet');
      }

      const stId = stationId && stationId !== 'all' ? stationId : (currentDb.settings?.stations?.[0]?.id || 'station-a');
      const targetStation = currentDb.stations?.[stId] || {
        id: stId,
        name: `Station ${stId.replace('station-', '').toUpperCase()}`,
        currentRound: 1,
        activeParticipantId: null,
        activeParticipant: null,
        status: 'WAITING',
      };

      // Filter available images strictly for THIS station to prevent repeating across stations
      const stationCandidates = currentDb.images.filter(
        (img) => img.stationId === stId || (targetStation.name && img.stationId === targetStation.name)
      );
      let candidates: EventImage[] = [];
      if (stationCandidates.length > 0) {
        const available = stationCandidates.filter((img) => img.status === 'available');
        candidates = available.length > 0 ? available : (currentDb.settings?.round1?.allowImageReuse ? stationCandidates : []);
      } else {
        const otherStationImages = currentDb.images.filter(
          (img) => img.stationId && img.stationId !== 'all' && img.stationId !== stId && img.stationId !== targetStation.name
        );
        const universalPool = currentDb.images.filter((img) => !otherStationImages.includes(img));
        const available = universalPool.filter((img) => img.status === 'available');
        candidates = available.length > 0 ? available : (currentDb.settings?.round1?.allowImageReuse ? universalPool : []);
      }

      if (candidates.length === 0) {
        throw new Error('No unused images remaining for this station. Reset pool or enable reuse in settings.');
      }

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const allowReuse = currentDb.settings?.round1?.allowImageReuse;
      const updatedImages = allowReuse
        ? currentDb.images
        : currentDb.images.map((img) =>
            img.id === chosen.id
              ? {
                  ...img,
                  status: 'used' as const,
                  usedByParticipantId: targetStation.activeParticipantId || undefined,
                  usedByParticipantName: targetStation.activeParticipant?.name || undefined,
                  usedAt: new Date().toISOString(),
                }
              : img
          );

      const updatedStation: StationState = {
        ...targetStation,
        selectedImage: chosen,
        selectedImageId: chosen.id,
        imageRotation: 0,
        currentRound: 1,
      };

      const stations = { ...(currentDb.stations || {}), [stId]: updatedStation };
      const updatedDb: AppDatabase = { ...currentDb, images: updatedImages, stations };
      dbRef.current = updatedDb;
      setDb(updatedDb);
      saveCachedDb(updatedDb).catch(() => {});
      broadcastStationLocal('station_updated', { station: updatedStation });
      broadcastStationLocal('images_updated', { images: updatedImages });

      // Synchronize with server if online; gracefully ignore network error if offline!
      try {
        await api.assignStationImage(
          stId,
          targetStation.activeParticipantId || undefined,
          targetStation.activeParticipant?.name || undefined
        );
      } catch (err) {
        console.warn('[Offline] assignStationImage processed offline locally:', err);
      }

      return chosen;
    },
    [db, broadcastStationLocal]
  );

  const setStationImage = useCallback(
    async (stationId: string, image: EventImage) => {
      const currentDb = dbRef.current || db;
      if (!currentDb) return;
      const stId = stationId && stationId !== 'all' ? stationId : (currentDb.settings?.stations?.[0]?.id || 'station-a');
      const targetStation = currentDb.stations?.[stId] || {
        id: stId,
        name: `Station ${stId.replace('station-', '').toUpperCase()}`,
        currentRound: 1,
        activeParticipantId: null,
        activeParticipant: null,
        status: 'WAITING',
      };

      const updatedStation: StationState = {
        ...targetStation,
        selectedImage: image,
        selectedImageId: image.id,
        imageRotation: 0,
        currentRound: 1,
      };

      const stations = { ...(currentDb.stations || {}), [stId]: updatedStation };
      const updatedDb: AppDatabase = { ...currentDb, stations };
      dbRef.current = updatedDb;
      setDb(updatedDb);
      saveCachedDb(updatedDb).catch(() => {});
      broadcastStationLocal('station_updated', { station: updatedStation });

      try {
        await api.assignStationImage(stId, undefined, undefined);
      } catch (err) {
        console.warn('[Offline] setStationImage processed locally:', err);
      }
    },
    [db, broadcastStationLocal]
  );

  const rotateStationImage = useCallback(
    async (stationId: string, rotation?: number) => {
      const currentDb = dbRef.current || db;
      const stId = stationId && stationId !== 'all' ? stationId : (currentDb?.settings?.stations?.[0]?.id || 'station-a');
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stId];
        if (!targetStation) return prev;
        const currentRot = targetStation.imageRotation || 0;
        const newRot = typeof rotation === 'number' ? rotation : (currentRot + 90) % 360;
        const updatedStation: StationState = {
          ...targetStation,
          imageRotation: newRot,
        };
        const stations = { ...(prev.stations || {}), [stId]: updatedStation };
        const updatedDb = { ...prev, stations };
        dbRef.current = updatedDb;
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        await api.rotateStationImage(stId, rotation);
      } catch (err) {
        console.warn('[Offline] rotateStationImage saved locally:', err);
      }
    },
    [db, broadcastStationLocal]
  );

  const spinStationTopic = useCallback(
    async (stationId: string, wheelTopicIds?: string[]) => {
      const currentDb = dbRef.current || db;
      if (!currentDb) {
        throw new Error('Database not loaded yet');
      }
      const stId = stationId && stationId !== 'all' ? stationId : (currentDb.settings?.stations?.[0]?.id || 'station-a');
      const targetStation = currentDb.stations?.[stId] || {
        id: stId,
        name: `Station ${stId.replace('station-', '').toUpperCase()}`,
        currentRound: 2,
        activeParticipantId: null,
        activeParticipant: null,
        status: 'WAITING',
      };

      const wheelCount = currentDb.settings?.round2?.activeWheelTopicCount || 20;
      let candidates: Topic[] = [];

      if (Array.isArray(wheelTopicIds) && wheelTopicIds.length > 0) {
        candidates = wheelTopicIds
          .map((id) => currentDb.topics.find((t) => t.id === id))
          .filter(Boolean) as Topic[];
      }

      if (candidates.length === 0) {
        const dedicated = currentDb.topics.filter(
          (t) => t.stationId === stId || (targetStation.name && t.stationId === targetStation.name)
        );
        if (dedicated.length > 0) {
          const available = dedicated.filter((t) => t.status === 'available');
          candidates = (available.length > 0 ? available : dedicated).slice(0, wheelCount);
        } else {
          const otherStationTopics = currentDb.topics.filter(
            (t) => t.stationId && t.stationId !== 'all' && t.stationId !== stId && t.stationId !== targetStation.name
          );
          const universal = currentDb.topics.filter((t) => !otherStationTopics.includes(t));
          const available = universal.filter((t) => t.status === 'available');
          candidates = (available.length > 0 ? available : universal).slice(0, wheelCount);
        }
      }

      if (candidates.length === 0) {
        throw new Error('No unused topics remaining. Please reset topic pool or allow reuse.');
      }

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const targetIndex = candidates.findIndex((t) => t.id === chosen.id);
      const spinDurationMs = 4800;
      const startedAt = Date.now();

      const allowReuse = currentDb.settings?.round2?.topicReuseAllowed;
      const updatedTopics = allowReuse
        ? currentDb.topics
        : currentDb.topics.map((t) =>
            t.id === chosen.id
              ? {
                  ...t,
                  status: 'used' as const,
                  usedByParticipantId: targetStation.activeParticipantId || undefined,
                  usedByParticipantName: targetStation.activeParticipant?.name || undefined,
                  usedAt: new Date().toISOString(),
                }
              : t
          );

      const updatedStation: StationState = {
        ...targetStation,
        currentRound: 2,
        selectedTopicId: null,
        selectedTopic: null,
        pendingTopic: chosen,
        status: 'SPINNING',
        activeWheelTopics: candidates,
        wheelSpin: {
          isSpinning: true,
          targetTopicId: chosen.id,
          targetTopicTitle: chosen.topic,
          targetTopicCategory: chosen.category,
          targetSliceIndex: targetIndex >= 0 ? targetIndex : 0,
          wheelTopics: candidates,
          startedAt,
          durationMs: spinDurationMs,
        },
      };

      const stations = { ...(currentDb.stations || {}), [stId]: updatedStation };
      const updatedDb: AppDatabase = { ...currentDb, topics: updatedTopics, stations };
      dbRef.current = updatedDb;
      setDb(updatedDb);
      saveCachedDb(updatedDb).catch(() => {});

      const spinData = {
        stationId: stId,
        topic: chosen,
        targetTopicId: chosen.id,
        targetIndex: targetIndex >= 0 ? targetIndex : 0,
        wheelTopics: candidates,
        startedAt,
        durationMs: spinDurationMs,
      };

      broadcastStationLocal('wheel_spin_started', { spinData });
      broadcastStationLocal('station_updated', { station: updatedStation });
      broadcastStationLocal('topics_updated', { topics: updatedTopics });

      const localSpinResult = {
        topic: chosen,
        targetIndex: targetIndex >= 0 ? targetIndex : 0,
        wheelTopics: candidates,
        startedAt,
        durationMs: spinDurationMs,
        station: updatedStation,
      };

      try {
        const res = await api.spinStationTopic(
          stId,
          targetStation.activeParticipantId || undefined,
          targetStation.activeParticipant?.name || undefined,
          wheelTopicIds
        );
        return res;
      } catch (err) {
        console.warn('[Offline] spinStationTopic processed offline locally:', err);
        return localSpinResult;
      }
    },
    [db, broadcastStationLocal]
  );

  const completeStationSpin = useCallback(
    async (stationId: string) => {
      const currentDb = dbRef.current || db;
      const stId = stationId && stationId !== 'all' ? stationId : (currentDb?.settings?.stations?.[0]?.id || 'station-a');
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stId];
        if (!targetStation) return prev;

        const winningTopic =
          targetStation.pendingTopic ||
          targetStation.selectedTopic ||
          prev.topics.find((t) => t.id === targetStation.wheelSpin?.targetTopicId);

        if (!winningTopic) return prev;

        let currentWheel = (targetStation.activeWheelTopics || targetStation.wheelSpin?.wheelTopics || []).filter(Boolean);
        const targetIdx = currentWheel.findIndex((t) => t && t.id === winningTopic.id);
        if (targetIdx !== -1) {
          const replacement = prev.topics.find(
            (t) => t && t.status === 'available' && t.id !== winningTopic.id && !currentWheel.some((w) => w && w.id === t.id)
          );
          if (replacement) {
            currentWheel[targetIdx] = replacement;
          }
        }

        const updatedStation: StationState = {
          ...targetStation,
          status: 'SPEAKING',
          selectedTopic: winningTopic,
          selectedTopicId: winningTopic.id,
          activeWheelTopics: currentWheel,
          wheelSpin: null,
        };

        const stations = { ...(prev.stations || {}), [stId]: updatedStation };
        const updatedDb = { ...prev, stations };
        dbRef.current = updatedDb;
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        await api.completeStationSpin(stId);
      } catch (err) {
        console.warn('[Offline] completeStationSpin processed locally:', err);
      }
    },
    [db, broadcastStationLocal]
  );

  const replaceStationWheelTopic = useCallback(
    async (stationId: string, usedTopicId: string, replacementTopicId?: string) => {
      const currentDb = dbRef.current || db;
      const stId = stationId && stationId !== 'all' ? stationId : (currentDb?.settings?.stations?.[0]?.id || 'station-a');
      let localStation: StationState | null = null;
      let activeWheelTopics: Topic[] = [];

      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stId];
        if (!targetStation) return prev;

        let wheel = [...(targetStation.activeWheelTopics || [])];
        const idx = wheel.findIndex((t) => t.id === usedTopicId);
        if (idx !== -1) {
          const replacement = replacementTopicId
            ? prev.topics.find((t) => t.id === replacementTopicId)
            : prev.topics.find((t) => t.status === 'available' && !wheel.some((w) => w.id === t.id));
          if (replacement) {
            wheel[idx] = replacement;
          }
        }

        const updatedStation: StationState = {
          ...targetStation,
          activeWheelTopics: wheel,
        };
        localStation = updatedStation;
        activeWheelTopics = wheel;

        const stations = { ...(prev.stations || {}), [stId]: updatedStation };
        const updatedDb = { ...prev, stations };
        dbRef.current = updatedDb;
        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updatedStation });
        return updatedDb;
      });

      try {
        const res = await api.replaceStationWheelTopic(stId, usedTopicId, replacementTopicId);
        return res;
      } catch (err) {
        console.warn('[Offline] replaceStationWheelTopic processed locally:', err);
        return { success: true, station: localStation!, activeWheelTopics };
      }
    },
    [db, broadcastStationLocal]
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
      const now = getServerNow();
      const finalPayload = {
        ...payload,
        startedAt: payload.action === 'start' ? (payload.startedAt || now) : payload.startedAt,
      };

      // Natural Time Up buzzer
      if (payload.action === 'time_up') {
        const roundNum = db?.stations?.[stationId]?.currentRound || 1;
        const roundSettings = (db?.settings as any)?.[`round${roundNum}`] || db?.settings?.round1;
        if (roundSettings?.buzzerEnabled !== false) {
          const localEventId = `buzzer-${Date.now()}-${stationId}`;
          playBuzzerWithDebounce(localEventId);
          broadcastStationLocal('buzzer_trigger', { payload: { stationId, eventId: localEventId } });
        }
      }

      // Optimistic & offline-first local state update
      setDb((prev) => {
        if (!prev) return prev;
        const targetStation = prev.stations?.[stationId];
        if (!targetStation) return prev;

        const roundNum = targetStation.currentRound || 1;
        const roundSettings = (prev.settings as any)?.[`round${roundNum}`] || prev.settings?.round1;
        let updated: StationState = { ...targetStation };

        if (payload.action === 'start') {
          const activePhase = payload.phase || targetStation.timerMode || (roundSettings?.prepEnabled ? 'prep' : 'speech');
          const defaultSec = activePhase === 'prep' ? (roundSettings?.prepTimeSeconds || 30) : (roundSettings?.speechTimeSeconds || 120);
          const duration = payload.totalSeconds || targetStation.timerDuration || defaultSec;
          const rem = typeof payload.remainingSeconds === 'number' ? payload.remainingSeconds : duration;

          updated = {
            ...targetStation,
            timerMode: activePhase,
            timerDuration: duration,
            timerTotalSeconds: duration,
            timerRemainingSeconds: rem,
            isTimerRunning: true,
            timerStatus: 'running',
            timerStartTime: finalPayload.startedAt,
            timerStartedAt: finalPayload.startedAt,
            timerAccumulatedMs: rem < duration ? Math.max(0, (duration - rem) * 1000) : 0,
            timerEndsAt: (finalPayload.startedAt || now) + rem * 1000,
            timerStopTime: null,
            status: activePhase === 'prep' ? 'PREPARING' : 'SPEAKING',
            buzzerPlayed: false,
            isOvertime: false,
            overtimeSeconds: 0,
          };
        } else if (payload.action === 'pause') {
          const runMs = targetStation.timerStartTime ? now - targetStation.timerStartTime : 0;
          const accum = (targetStation.timerAccumulatedMs || 0) + runMs;
          const totalElapsedSec = Math.floor(accum / 1000);
          const rem = Math.max(0, (targetStation.timerDuration || 120) - totalElapsedSec);

          updated = {
            ...targetStation,
            timerAccumulatedMs: accum,
            timerStartTime: null,
            timerStartedAt: null,
            timerEndsAt: null,
            timerStatus: 'paused',
            isTimerRunning: false,
            status: 'PAUSED',
            timerRemainingSeconds: rem,
          };
        } else if (payload.action === 'stop' || payload.action === 'stop_with_buzzer') {
          const runMs = targetStation.timerStartTime ? now - targetStation.timerStartTime : 0;
          const accum = (targetStation.timerAccumulatedMs || 0) + runMs;
          const totalElapsedSec = Math.floor(accum / 1000);
          const duration = targetStation.timerDuration || 120;
          const isOver = totalElapsedSec > duration;

          updated = {
            ...targetStation,
            timerAccumulatedMs: accum,
            timerStartTime: null,
            timerStartedAt: null,
            timerStopTime: now,
            timerEndsAt: null,
            isTimerRunning: false,
            timerStatus: 'stopped',
            status: 'TIME_UP',
            isOvertime: isOver,
            overtimeSeconds: isOver ? totalElapsedSec - duration : 0,
          };
        } else if (payload.action === 'reset') {
          const initSec = (roundSettings?.prepEnabled && (roundSettings?.prepTimeSeconds || 0) > 0)
            ? roundSettings.prepTimeSeconds
            : (roundSettings?.speechTimeSeconds || 120);

          updated = {
            ...targetStation,
            isTimerRunning: false,
            timerStatus: 'idle',
            status: 'WAITING',
            timerMode: 'idle',
            timerDuration: initSec,
            timerTotalSeconds: initSec,
            timerRemainingSeconds: initSec,
            timerAccumulatedMs: 0,
            timerStartTime: null,
            timerStartedAt: null,
            timerEndsAt: null,
            timerStopTime: null,
            buzzerPlayed: false,
            isOvertime: false,
            overtimeSeconds: 0,
          };
        } else if (payload.action === 'transition_to_speech') {
          const speechSec = roundSettings?.speechTimeSeconds || 120;
          updated = {
            ...targetStation,
            timerMode: 'speech',
            timerDuration: speechSec,
            timerTotalSeconds: speechSec,
            timerRemainingSeconds: speechSec,
            isTimerRunning: true,
            timerStatus: 'running',
            timerStartTime: now,
            timerStartedAt: now,
            timerAccumulatedMs: 0,
            timerEndsAt: now + speechSec * 1000,
            timerStopTime: null,
            status: 'SPEAKING',
            buzzerPlayed: false,
            isOvertime: false,
            overtimeSeconds: 0,
          };
        } else if (payload.action === 'time_up') {
          updated = {
            ...targetStation,
            buzzerPlayed: true,
            isOvertime: true,
          };
        }

        const stations = { ...(prev.stations || {}), [stationId]: updated };
        const updatedDb = {
          ...prev,
          stations,
          liveSync: {
            ...prev.liveSync,
            stationStates: stations,
          },
        };

        saveCachedDb(updatedDb).catch(() => {});
        broadcastStationLocal('station_updated', { station: updated });
        return updatedDb;
      });

      try {
        const res = await api.sendStationTimerAction(stationId, finalPayload);
        if (res.serverTime) recordServerTimestamp(res.serverTime);
      } catch (err) {
        console.warn('[Offline] sendStationTimerAction processed locally:', err);
      }
    },
    [db?.stations, db?.settings, playBuzzerWithDebounce, broadcastStationLocal]
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
    setDb((prev) => {
      if (!prev) return prev;
      const participants = prev.participants.map((p) => ({
        ...p,
        round1Qualified: 'pending' as const,
        round2Qualified: 'pending' as const,
        round3Qualified: 'pending' as const,
      }));
      const images = prev.images.map((img) => ({
        ...img,
        status: 'available' as const,
        usedByParticipantId: undefined,
        usedByParticipantName: undefined,
        usedAt: undefined,
      }));
      const topics = prev.topics.map((t) => ({
        ...t,
        status: 'available' as const,
        usedByParticipantId: undefined,
        usedByParticipantName: undefined,
        usedAt: undefined,
      }));
      const updatedStations = { ...prev.stations };
      Object.keys(updatedStations).forEach((key) => {
        const s = updatedStations[key];
        updatedStations[key] = {
          ...s,
          selectedImageId: null,
          selectedImage: null,
          selectedTopicId: null,
          selectedTopic: null,
          activeParticipantId: null,
          activeParticipant: null,
          status: 'WAITING',
          wheelSpin: null,
        };
      });
      const updatedDb = { ...prev, participants, images, topics, stations: updatedStations };
      dbRef.current = updatedDb;
      saveCachedDb(updatedDb).catch(() => {});
      broadcastStationLocal('db_sync', { db: updatedDb });
      return updatedDb;
    });
    setActiveParticipant(null);

    try {
      const res = await api.resetAllStatuses();
      if (res?.db) {
        setDb(res.db);
        dbRef.current = res.db;
        saveCachedDb(res.db).catch(() => {});
      }
    } catch (err) {
      console.warn('[Offline] resetAllStatuses processed locally:', err);
    }
  }, [broadcastStationLocal]);

  // Real-time SSE Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      const sseUrl = new URL('/api/events', window.location.origin);
      if (projectorDeviceId) {
        sseUrl.searchParams.set('projector_device_id', projectorDeviceId);
      }
      const effectiveRole = currentPage === 'master' ? 'master' : currentPage === 'projector' ? 'projector' : deviceRole;
      if (effectiveRole === 'master') {
        sseUrl.searchParams.set('type', 'master');
      } else if (effectiveRole === 'projector') {
        sseUrl.searchParams.set('type', 'projector');
        if (currentStationId && currentStationId !== 'all') {
          sseUrl.searchParams.set('station', currentStationId);
        }
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

          playBuzzerWithDebounce(payload?.eventId);
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
            const updated = {
              ...prev,
              stations,
              liveSync: {
                ...prev.liveSync,
                stationStates: stations,
              },
            };
            dbRef.current = updated;
            saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
            return updated;
          });
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('stations_updated', (e) => {
        try {
          const stationList: (StationState & { serverTime?: number })[] = JSON.parse(e.data);
          if (stationList[0]?.serverTime) recordServerTimestamp(stationList[0].serverTime);
          setDb((prev) => {
            if (!prev) return prev;
            const stations = { ...(prev.stations || {}) };
            stationList.forEach((s) => {
              stations[s.id] = s;
            });
            const updated = {
              ...prev,
              stations,
              liveSync: {
                ...prev.liveSync,
                stationStates: stations,
              },
            };
            dbRef.current = updated;
            saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
            return updated;
          });
        } catch (err) {
          console.error(err);
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
          setDb((prev) => (prev ? { ...prev, settings } : prev));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('images_updated', (e) => {
        try {
          const images = JSON.parse(e.data);
          setDb((prev) => (prev ? { ...prev, images } : prev));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('topics_updated', (e) => {
        try {
          const topics = JSON.parse(e.data);
          setDb((prev) => (prev ? { ...prev, topics } : prev));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('reset_all_statuses', (e) => {
        try {
          const data = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            return {
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
          });
          setActiveParticipant(null);
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('state_reset', (e) => {
        try {
          const resetDb = JSON.parse(e.data);
          setDb(resetDb);
          setActiveParticipant(resetDb.participants[0] || null);
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('qualification_updated', (e) => {
        try {
          const { participant } = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p) => (p.id === participant.id ? participant : p)),
            };
          });
          setActiveParticipant((curr) => (curr?.id === participant.id ? participant : curr));
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('participants_batch_updated', (e) => {
        try {
          const { updatedList } = JSON.parse(e.data);
          const map = new Map(updatedList.map((p: Participant) => [p.id, p]));
          setDb((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p) => (map.has(p.id) ? (map.get(p.id) as Participant) : p)),
            };
          });
        } catch (err) {
          console.error(err);
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

      eventSource.addEventListener('participant_created', (e) => {
        try {
          const participant: Participant = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            if (prev.participants.some((p) => p.id === participant.id)) return prev;
            const updated = { ...prev, participants: [...prev.participants, participant] };
            saveCachedDb(updated).catch(() => {});
            return updated;
          });
        } catch (err) {
          console.error('Failed to handle participant_created SSE:', err);
        }
      });

      eventSource.addEventListener('participant_updated', (e) => {
        try {
          const participant: Participant = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              participants: prev.participants.map((p) => (p.id === participant.id ? { ...p, ...participant } : p)),
            };
            saveCachedDb(updated).catch(() => {});
            return updated;
          });
          setActiveParticipant((curr) => (curr?.id === participant.id ? { ...curr, ...participant } : curr));
        } catch (err) {
          console.error('Failed to handle participant_updated SSE:', err);
        }
      });

      eventSource.addEventListener('participant_deleted', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              participants: prev.participants.filter((p) => p.id !== id),
            };
            saveCachedDb(updated).catch(() => {});
            return updated;
          });
          setActiveParticipant((curr) => (curr?.id === id ? null : curr));
        } catch (err) {
          console.error('Failed to handle participant_deleted SSE:', err);
        }
      });

      eventSource.addEventListener('participants_batch_imported', (e) => {
        try {
          const { participants } = JSON.parse(e.data);
          if (Array.isArray(participants)) {
            setDb((prev) => {
              if (!prev) return prev;
              const map = new Map(participants.map((p: Participant) => [p.id, p]));
              const existingUpdated = prev.participants.map((p) => map.has(p.id) ? (map.get(p.id) as Participant) : p);
              const newItems = participants.filter((p: Participant) => !prev.participants.some((ep) => ep.id === p.id));
              const updated = {
                ...prev,
                participants: [...existingUpdated, ...newItems],
              };
              dbRef.current = updated;
              saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
              return updated;
            });
          }
        } catch (err) {
          console.error('Failed to handle participants_batch_imported SSE:', err);
        }
      });

      eventSource.addEventListener('result_added', (e) => {
        try {
          const { round, result } = JSON.parse(e.data);
          setDb((prev) => {
            if (!prev) return prev;
            const key = round === 1 ? 'round1Results' : round === 2 ? 'round2Results' : 'round3Results';
            const list = (prev as any)[key] || [];
            const updated = {
              ...prev,
              [key]: [...list.filter((r: any) => r.id !== result.id), result],
            };
            dbRef.current = updated;
            saveCachedDb(updated, { skipBroadcast: true, skipPulse: true }).catch(() => {});
            return updated;
          });
        } catch (err) {
          console.error('Failed to handle result_added SSE:', err);
        }
      });

      eventSource.addEventListener('sync_update', (e) => {
        try {
          const { db: freshDb } = JSON.parse(e.data);
          if (freshDb) {
            setDb(freshDb);
            dbRef.current = freshDb;
            saveCachedDb(freshDb, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to handle sync_update SSE:', err);
        }
      });

      eventSource.addEventListener('db_sync', (e) => {
        try {
          const freshDb = JSON.parse(e.data);
          if (freshDb && freshDb.stations) {
            setDb(freshDb);
            dbRef.current = freshDb;
            saveCachedDb(freshDb, { skipBroadcast: true, skipPulse: true }).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to handle db_sync SSE:', err);
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

  // Continuous Background State Synchronization & Auto-Refresher:
  // Runs continuously every 1000ms so that ANY backend change (direct edit, script, offline device sync, or station update)
  // is guaranteed to appear on the Projector and all views automatically without requiring manual F5 reload.
  useEffect(() => {
    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const fresh = await api.getState(800);
        if (fresh && fresh.stations) {
          setDb((prev) => {
            if (!prev) {
              saveCachedDb(fresh, { skipBroadcast: true, skipPulse: true }).catch(() => {});
              return fresh;
            }
            if (JSON.stringify(prev) === JSON.stringify(fresh)) {
              return prev;
            }
            saveCachedDb(fresh, { skipBroadcast: true, skipPulse: true }).catch(() => {});
            return fresh;
          });
          dbRef.current = fresh;
        }
      } catch {
        // AUTOMATIC OFFLINE REFRESHER:
        // When server is offline, unreachable, or in local offline venue mode,
        // actively pull from IndexedDB so the Projector and all views stay 100% updated without F5!
        try {
          const cached = await getCachedDb();
          if (cached && cached.stations) {
            setDb((prev) => {
              if (!prev) return cached;
              if (JSON.stringify(prev) === JSON.stringify(cached)) {
                return prev;
              }
              return cached;
            });
            dbRef.current = cached;
          }
        } catch {}
      } finally {
        isPolling = false;
      }
    };

    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, []);

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
      setDb((currentDb) => {
        if (!currentDb || currentDb.participants.length === 0) return currentDb;

        let candidateList = customList;
        if (!candidateList) {
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
          if (currentStationId) {
            const stationSpecific = pool.filter((p) => p.stationId === currentStationId);
            candidateList = stationSpecific.length > 0 ? stationSpecific : pool;
          } else {
            candidateList = pool;
          }
        }

        if (!candidateList || candidateList.length === 0) return currentDb;

        setActiveParticipant((curr) => {
          const currentIdx = curr
            ? candidateList!.findIndex((p) => p.id === curr.id)
            : -1;
          const nextIdx = (currentIdx + 1) % candidateList!.length;
          return candidateList![nextIdx] ?? null;
        });
        return currentDb;
      });
    },
    [currentPage, currentStationId]
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
      const stId = stationId || currentStationId || 'station-a';
      return assignStationImage(stId);
    },
    [assignStationImage, currentStationId]
  );

  // Atomic Round 2 topic spin
  const spinRound2Topic = useCallback(
    async (stationId?: string) => {
      const stId = stationId || currentStationId || 'station-a';
      const res = await spinStationTopic(stId);
      return { topic: res.topic, startedAt: res.startedAt, durationMs: res.durationMs };
    },
    [spinStationTopic, currentStationId]
  );

  // Start fresh event
  const startNewEvent = useCallback(async () => {
    try {
      await api.startNewEvent();
    } catch (err) {
      console.warn('[Offline] startNewEvent ignored error:', err);
    }
    await reloadState();
  }, [reloadState]);

  // Buzzer
  const triggerBuzzer = useCallback(
    async (reason: string = 'Manual Buzzer', round: string = 'General') => {
      unlockSound();
      playBuzzerLocal();
      try {
        await api.triggerBuzzer({
          source: 'organizer',
          reason,
          round,
          participantName: activeParticipant?.name,
          stationId: currentStationId || undefined,
        });
      } catch (err) {
        console.warn('[Offline] triggerBuzzer handled locally:', err);
      }
    },
    [activeParticipant?.name, currentStationId, unlockSound, playBuzzerLocal]
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

  // Participants actions (Offline-First: Save locally to IndexedDB first, then sync)
  const addParticipant = useCallback(async (p: Partial<Participant>) => {
    const recordId = p.id || generateUUID();
    const nowIso = new Date().toISOString();
    const count = (db?.participants.length || 0) + 1;
    const participantNumber = p.participantNumber || `M2M-${String(count).padStart(3, '0')}`;

    const newParticipant: Participant = {
      id: recordId,
      participantNumber,
      name: p.name?.trim() || 'New Participant',
      mobile: p.mobile?.trim() || p.phone?.trim() || (p.customData as any)?.phone || (p.customData as any)?.mobile || '',
      phone: p.phone?.trim() || p.mobile?.trim() || (p.customData as any)?.phone || (p.customData as any)?.mobile || '',
      stationId: p.stationId || '',
      stationName: p.stationName || '',
      status: p.status || 'active',
      round1Status: p.round1Status || 'pending',
      round2Status: p.round2Status || 'pending',
      round3Status: p.round3Status || 'pending',
      customData: p.customData || {},
      createdAt: p.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 1. Save locally to IndexedDB queue first
    await syncEngine.enqueue({
      id: recordId,
      entityType: 'participant',
      action: 'create',
      deviceId,
      data: newParticipant,
      createdAt: nowIso,
      updatedAt: nowIso,
      syncStatus: 'pending',
      syncAttempts: 0,
    });

    // 2. Optimistically update local React state and IndexedDB cache
    setDb((prev) => {
      if (!prev) return prev;
      const nextDb: AppDatabase = {
        ...prev,
        participants: [...prev.participants.filter((item) => item.id !== recordId), newParticipant],
      };
      saveCachedDb(nextDb).catch(() => {});
      broadcastStationLocal('participant_created', { participant: newParticipant });
      broadcastStationLocal('db_sync', { db: nextDb });
      return nextDb;
    });

    setActiveParticipant((curr) => curr || newParticipant);
    return newParticipant;
  }, [db?.participants?.length, deviceId, broadcastStationLocal]);

  const updateParticipant = useCallback(async (id: string, p: Partial<Participant>) => {
    const nowIso = new Date().toISOString();
    const updatedData = { ...p, id, updatedAt: nowIso };

    // 1. Save locally to IndexedDB queue first
    await syncEngine.enqueue({
      id,
      entityType: 'participant',
      action: 'update',
      deviceId,
      data: updatedData,
      createdAt: nowIso,
      updatedAt: nowIso,
      syncStatus: 'pending',
      syncAttempts: 0,
    });

    // 2. Optimistically update local React state and IndexedDB cache
    setDb((prev) => {
      if (!prev) return prev;
      const nextDb: AppDatabase = {
        ...prev,
        participants: prev.participants.map((item) => (item.id === id ? { ...item, ...updatedData } : item)),
      };
      saveCachedDb(nextDb).catch(() => {});
      broadcastStationLocal('participant_updated', { participant: updatedData });
      broadcastStationLocal('db_sync', { db: nextDb });
      return nextDb;
    });

    setActiveParticipant((curr) => (curr?.id === id ? ({ ...curr, ...updatedData } as Participant) : curr));
    return updatedData as Participant;
  }, [deviceId, broadcastStationLocal]);

  const deleteParticipant = useCallback(async (id: string) => {
    const nowIso = new Date().toISOString();
    await syncEngine.enqueue({
      id,
      entityType: 'participant',
      action: 'delete',
      deviceId,
      data: { id },
      createdAt: nowIso,
      updatedAt: nowIso,
      syncStatus: 'pending',
      syncAttempts: 0,
    });

    setDb((prev) => {
      if (!prev) return prev;
      const nextDb: AppDatabase = {
        ...prev,
        participants: prev.participants.filter((item) => item.id !== id),
      };
      saveCachedDb(nextDb).catch(() => {});
      broadcastStationLocal('participant_deleted', { id });
      broadcastStationLocal('db_sync', { db: nextDb });
      return nextDb;
    });

    setActiveParticipant((curr) => (curr?.id === id ? null : curr));
  }, [deviceId, broadcastStationLocal]);

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
        return {
          ...prev,
          participants: prev.participants.map((p) => (map.has(p.id) ? (map.get(p.id) as Participant) : p)),
        };
      });
      return res;
    },
    []
  );

  const moveParticipantStation = useCallback(
    async (participantId: string, stationId: string, stationName?: string, forRound?: 1 | 2 | 3) => {
      const res = await api.moveParticipantStation(participantId, stationId, stationName, forRound);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) => (p.id === participantId ? res.participant : p)),
            }
          : prev
      );
      return res.participant;
    },
    []
  );

  // Custom fields
  const addCustomField = useCallback(async (field: Partial<CustomFieldDefinition>) => {
    const created = await api.addCustomField(field);
    setDb((prev) => (prev ? { ...prev, customFields: [...prev.customFields, created] } : prev));
    return created;
  }, []);

  const updateCustomField = useCallback(async (id: string, field: Partial<CustomFieldDefinition>) => {
    const updated = await api.updateCustomField(id, field);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            customFields: prev.customFields.map((f) => (f.id === id ? updated : f)),
          }
        : prev
    );
    return updated;
  }, []);

  const deleteCustomField = useCallback(async (id: string) => {
    await api.deleteCustomField(id);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            customFields: prev.customFields.filter((f) => f.id !== id),
          }
        : prev
    );
  }, []);

  // Topics (Offline-First)
  const addTopic = useCallback(
    async (topic: string, category?: string, topicId?: string, stationId?: string, stationName?: string) => {
      const recordId = generateUUID();
      const nowIso = new Date().toISOString();
      const count = (db?.topics.length || 0) + 1;
      const resolvedTopicId = topicId || `TOP-${String(count).padStart(3, '0')}`;

      const newTopic: Topic = {
        id: recordId,
        topicId: resolvedTopicId,
        topic,
        category,
        stationId,
        stationName,
        status: 'available',
      };

      await syncEngine.enqueue({
        id: recordId,
        entityType: 'topic',
        action: 'create',
        deviceId,
        data: newTopic,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = { ...prev, topics: [...prev.topics.filter((t) => t.id !== recordId), newTopic] };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('topics_updated', { topics: nextDb.topics });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return newTopic;
    },
    [db?.topics?.length, deviceId, broadcastStationLocal]
  );

  const updateTopic = useCallback(
    async (id: string, updates: Partial<Topic>) => {
      const nowIso = new Date().toISOString();
      const updatedData = { ...updates, id };

      await syncEngine.enqueue({
        id,
        entityType: 'topic',
        action: 'update',
        deviceId,
        data: updatedData,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = {
          ...prev,
          topics: prev.topics.map((t) => (t.id === id ? { ...t, ...updatedData } : t)),
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('topics_updated', { topics: nextDb.topics });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return updatedData as Topic;
    },
    [deviceId, broadcastStationLocal]
  );

  const deleteTopic = useCallback(async (id: string) => {
    await api.deleteTopic(id);
    setDb((prev) => (prev ? { ...prev, topics: prev.topics.filter((t) => t.id !== id) } : prev));
  }, []);

  const importTopics = useCallback(async (list: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }[], defaultStationId?: string) => {
    const res = await api.batchAddTopics(list, defaultStationId);
    await reloadState();
    return res.count;
  }, [reloadState]);

  const batchUpdateTopicStations = useCallback(
    async (topicIds: string[], stationId?: string, stationName?: string) => {
      const res = await api.batchUpdateTopicStations(topicIds, stationId, stationName);
      setDb((prev) => (prev ? { ...prev, topics: res.allTopics } : prev));
      return res;
    },
    []
  );

  const resetTopicsStatus = useCallback(async () => {
    setDb((prev) => {
      if (!prev) return prev;
      const topics = prev.topics.map((t) => ({
        ...t,
        status: 'available' as const,
        usedByParticipantId: undefined,
        usedByParticipantName: undefined,
        usedAt: undefined,
      }));
      const updatedDb = { ...prev, topics };
      dbRef.current = updatedDb;
      saveCachedDb(updatedDb).catch(() => {});
      broadcastStationLocal('topics_updated', { topics });
      return updatedDb;
    });

    try {
      await api.resetTopicsStatus();
    } catch (err) {
      console.warn('[Offline] resetTopicsStatus processed locally:', err);
    }
  }, [broadcastStationLocal]);

  // Images (Offline-First)
  const addImage = useCallback(
    async (imageIdOrName: string, url: string, stationId?: string, stationName?: string) => {
      const recordId = generateUUID();
      const nowIso = new Date().toISOString();
      const count = (db?.images.length || 0) + 1;
      const resolvedImageId = imageIdOrName || `IMG-${String(count).padStart(3, '0')}`;

      const newImage: EventImage = {
        id: recordId,
        imageId: resolvedImageId,
        name: resolvedImageId,
        url,
        stationId,
        stationName,
        status: 'available',
      };

      await syncEngine.enqueue({
        id: recordId,
        entityType: 'image',
        action: 'create',
        deviceId,
        data: newImage,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = { ...prev, images: [...prev.images.filter((i) => i.id !== recordId), newImage] };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('images_updated', { images: nextDb.images });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return newImage;
    },
    [db?.images?.length, deviceId, broadcastStationLocal]
  );

  const updateImage = useCallback(
    async (id: string, updates: Partial<EventImage>) => {
      const nowIso = new Date().toISOString();
      const updatedData = { ...updates, id };

      await syncEngine.enqueue({
        id,
        entityType: 'image',
        action: 'update',
        deviceId,
        data: updatedData,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const nextDb = {
          ...prev,
          images: prev.images.map((img) => (img.id === id ? { ...img, ...updatedData } : img)),
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('images_updated', { images: nextDb.images });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return updatedData as EventImage;
    },
    [deviceId, broadcastStationLocal]
  );

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
      setDb((prev) => (prev ? { ...prev, images: res.allImages } : prev));
      return res;
    },
    []
  );

  const batchUpdateImageStations = useCallback(
    async (imageIds: string[], stationId?: string, stationName?: string) => {
      const res = await api.batchUpdateImageStations(imageIds, stationId, stationName);
      setDb((prev) => (prev ? { ...prev, images: res.allImages } : prev));
      return res;
    },
    []
  );

  const deleteImage = useCallback(async (id: string) => {
    await api.deleteImage(id);
    setDb((prev) => {
      if (!prev) return prev;
      const nextDb = { ...prev, images: prev.images.filter((img) => img.id !== id) };
      saveCachedDb(nextDb).catch(() => {});
      broadcastStationLocal('images_updated', { images: nextDb.images });
      broadcastStationLocal('db_sync', { db: nextDb });
      return nextDb;
    });
  }, [broadcastStationLocal]);

  const resetImagesStatus = useCallback(async () => {
    setDb((prev) => {
      if (!prev) return prev;
      const images = prev.images.map((img) => ({
        ...img,
        status: 'available' as const,
        usedByParticipantId: undefined,
        usedByParticipantName: undefined,
        usedAt: undefined,
      }));
      const updatedDb = { ...prev, images };
      dbRef.current = updatedDb;
      saveCachedDb(updatedDb).catch(() => {});
      broadcastStationLocal('images_updated', { images });
      return updatedDb;
    });

    try {
      await api.resetImagesStatus();
    } catch (err) {
      console.warn('[Offline] resetImagesStatus processed locally:', err);
    }
  }, [broadcastStationLocal]);

  // Settings
  const updateSettings = useCallback(async (updates: Partial<EventSettings>) => {
    setDb((prev) => {
      if (!prev) return prev;
      const nextDb = { ...prev, settings: { ...prev.settings, ...updates } };
      saveCachedDb(nextDb).catch(() => {});
      broadcastStationLocal('settings_updated', { settings: nextDb.settings });
      broadcastStationLocal('db_sync', { db: nextDb });
      return nextDb;
    });

    try {
      const updated = await api.updateSettings(updates);
      setDb((prev) => (prev ? { ...prev, settings: updated } : prev));
      return updated;
    } catch (err) {
      console.warn('[Offline] updateSettings applied locally:', err);
      return updates as EventSettings;
    }
  }, [broadcastStationLocal]);

  // Results (Offline-First: Save locally to IndexedDB first, then sync)
  const saveRound1Result = useCallback(
    async (res: Omit<Round1Result, 'id'>) => {
      const recordId = (res as any).id || generateUUID();
      const nowIso = new Date().toISOString();
      const fullResult: Round1Result = {
        ...res,
        id: recordId,
        startTime: res.startTime || nowIso,
        endTime: res.endTime || nowIso,
        deviceId,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      };

      // 1. Save locally to IndexedDB queue first
      await syncEngine.enqueue({
        id: recordId,
        entityType: 'round1Result',
        action: 'create',
        deviceId,
        data: fullResult,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      // 2. Optimistically update local React state and IndexedDB cache
      setDb((prev) => {
        if (!prev) return prev;
        const updatedP = prev.participants.map((p) => {
          if (p.id === fullResult.participantId) {
            return {
              ...p,
              round1Status: fullResult.status,
              round1ImageId: fullResult.imageId || fullResult.imageName,
              round1Qualified: fullResult.qualification || p.round1Qualified,
              status:
                fullResult.qualification === 'disqualified'
                  ? 'eliminated'
                  : fullResult.qualification === 'qualified' && p.status === 'eliminated'
                  ? 'active'
                  : p.status,
              updatedAt: nowIso,
            };
          }
          return p;
        });

        const updatedImages = !prev.settings.round1.allowImageReuse
          ? prev.images.map((img) =>
              img.id === fullResult.imageId || img.imageId === fullResult.imageId
                ? {
                    ...img,
                    status: 'used' as const,
                    usedByParticipantId: fullResult.participantId,
                    usedByParticipantName: fullResult.participantName,
                    usedAt: nowIso,
                  }
                : img
            )
          : prev.images;

        const nextDb: AppDatabase = {
          ...prev,
          round1Results: [...prev.round1Results.filter((r) => r.id !== recordId), fullResult],
          participants: updatedP,
          images: updatedImages,
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('result_added', { round: 1, result: fullResult });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return fullResult;
    },
    [deviceId, broadcastStationLocal]
  );

  const saveRound2Result = useCallback(
    async (res: Omit<Round2Result, 'id'>) => {
      const recordId = (res as any).id || generateUUID();
      const nowIso = new Date().toISOString();
      const fullResult: Round2Result = {
        ...res,
        id: recordId,
        startTime: res.startTime || nowIso,
        endTime: res.endTime || nowIso,
        deviceId,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      };

      await syncEngine.enqueue({
        id: recordId,
        entityType: 'round2Result',
        action: 'create',
        deviceId,
        data: fullResult,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const updatedP = prev.participants.map((p) => {
          if (p.id === fullResult.participantId) {
            return {
              ...p,
              round2Status: fullResult.status,
              round2TopicId: fullResult.topicId,
              round2Qualified: fullResult.qualification || p.round2Qualified,
              status:
                fullResult.qualification === 'disqualified'
                  ? 'eliminated'
                  : fullResult.qualification === 'qualified' && p.status === 'eliminated'
                  ? 'active'
                  : p.status,
              updatedAt: nowIso,
            };
          }
          return p;
        });

        const updatedTopics = !prev.settings.round2.topicReuseAllowed
          ? prev.topics.map((top) =>
              top.id === fullResult.topicId || top.topicId === fullResult.topicId
                ? {
                    ...top,
                    status: 'used' as const,
                    usedByParticipantId: fullResult.participantId,
                    usedByParticipantName: fullResult.participantName,
                    usedAt: nowIso,
                  }
                : top
            )
          : prev.topics;

        const nextDb: AppDatabase = {
          ...prev,
          round2Results: [...prev.round2Results.filter((r) => r.id !== recordId), fullResult],
          participants: updatedP,
          topics: updatedTopics,
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('result_added', { round: 2, result: fullResult });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return fullResult;
    },
    [deviceId, broadcastStationLocal]
  );

  const saveRound3Result = useCallback(
    async (res: Omit<Round3Result, 'id'>) => {
      const recordId = (res as any).id || generateUUID();
      const nowIso = new Date().toISOString();
      const fullResult: Round3Result = {
        ...res,
        id: recordId,
        startTime: res.startTime || nowIso,
        endTime: res.endTime || nowIso,
        deviceId,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      };

      await syncEngine.enqueue({
        id: recordId,
        entityType: 'round3Result',
        action: 'create',
        deviceId,
        data: fullResult,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      setDb((prev) => {
        if (!prev) return prev;
        const updatedP = prev.participants.map((p) => {
          if (p.id === fullResult.participantId) {
            return {
              ...p,
              round3Status: fullResult.status,
              round3Qualified: fullResult.qualification || p.round3Qualified,
              status:
                fullResult.qualification === 'disqualified'
                  ? 'eliminated'
                  : fullResult.qualification === 'qualified' && p.status === 'eliminated'
                  ? 'active'
                  : p.status,
              updatedAt: nowIso,
            };
          }
          return p;
        });

        const nextDb: AppDatabase = {
          ...prev,
          round3Results: [...prev.round3Results.filter((r) => r.id !== recordId), fullResult],
          participants: updatedP,
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('result_added', { round: 3, result: fullResult });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      return fullResult;
    },
    [deviceId, broadcastStationLocal]
  );

  // Qualification methods (Offline-First)
  const setQualification = useCallback(
    async (
      participantId: string,
      round: 1 | 2 | 3,
      status: 'qualified' | 'disqualified' | 'pending',
      reason?: string
    ) => {
      const nowIso = new Date().toISOString();
      const queueId = generateUUID();

      // 1. Save to local IndexedDB queue first
      await syncEngine.enqueue({
        id: queueId,
        entityType: 'qualification',
        action: 'update',
        deviceId,
        data: { participantId, round, status, reason },
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
        syncAttempts: 0,
      });

      // 2. Optimistically update local React state and IndexedDB cache
      let updatedParticipantObj: Participant | null = null;
      setDb((prev) => {
        if (!prev) return prev;
        const updatedParticipants = prev.participants.map((p) => {
          if (p.id === participantId) {
            const up: Participant = {
              ...p,
              ...(round === 1 ? { round1Qualified: status } : {}),
              ...(round === 2 ? { round2Qualified: status } : {}),
              ...(round === 3 ? { round3Qualified: status } : {}),
              status:
                status === 'disqualified'
                  ? 'eliminated'
                  : status === 'qualified' && p.status === 'eliminated'
                  ? 'active'
                  : p.status,
              qualificationReason: reason,
              updatedAt: nowIso,
            };
            updatedParticipantObj = up;
            return up;
          }
          return p;
        });
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

        const nextDb: AppDatabase = {
          ...prev,
          participants: updatedParticipants,
          round1Results: updatedR1,
          round2Results: updatedR2,
          round3Results: updatedR3,
        };
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('qualification_updated', { participant: updatedParticipantObj });
        broadcastStationLocal('db_sync', { db: nextDb });
        return nextDb;
      });

      if (updatedParticipantObj) {
        setActiveParticipant((curr) => (curr?.id === participantId ? updatedParticipantObj : curr));
      }
      return updatedParticipantObj as any;
    },
    [deviceId, broadcastStationLocal]
  );

  const batchSetQualification = useCallback(
    async (
      participantIds: string[],
      round: 1 | 2 | 3,
      status: 'qualified' | 'disqualified' | 'pending'
    ) => {
      let updatedParticipants: Participant[] = [];
      const field = round === 1 ? 'round1Qualified' : round === 2 ? 'round2Qualified' : 'round3Qualified';

      setDb((prev) => {
        if (!prev) return prev;
        const nextParticipants = prev.participants.map((p) => {
          if (participantIds.includes(p.id)) {
            return {
              ...p,
              [field]: status,
              status:
                status === 'disqualified'
                  ? 'eliminated'
                  : status === 'qualified' && p.status === 'eliminated'
                  ? 'active'
                  : p.status,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });
        updatedParticipants = nextParticipants;
        const nextDb = { ...prev, participants: nextParticipants };
        dbRef.current = nextDb;
        saveCachedDb(nextDb).catch(() => {});
        broadcastStationLocal('participants_batch_updated', { participants: nextParticipants });
        return nextDb;
      });

      try {
        const res = await api.batchUpdateQualification({ participantIds, round, status });
        return res.participants;
      } catch (err) {
        console.warn('[Offline] batchSetQualification applied locally:', err);
        return updatedParticipants;
      }
    },
    [broadcastStationLocal]
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
    await api.resetData();
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

        // Offline & Synchronization State
        syncState,
        syncNow,

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

        // Station Actions
        setStationRound,
        setStationParticipant,
        updateStationHandler,
        pingStation,
        assignStationImage,
        setStationImage,
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
        importParticipants,
        batchSetStation,
        addCustomField,
        updateCustomField,
        deleteCustomField,
        addTopic,
        updateTopic,
        deleteTopic,
        importTopics,
        batchUpdateTopicStations,
        moveParticipantStation,
        resetTopicsStatus,
        addImage,
        updateImage,
        uploadImages,
        batchUpdateImageStations,
        deleteImage,
        resetImagesStatus,
        updateSettings,
        saveRound1Result,
        saveRound2Result,
        saveRound3Result,
        setQualification,
        batchSetQualification,
        triggerBuzzer,
        playBuzzerLocal,
        uploadCustomBuzzer,
        resetCustomBuzzer,
        uploadCustomPrepBuzzer,
        resetCustomPrepBuzzer,
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
