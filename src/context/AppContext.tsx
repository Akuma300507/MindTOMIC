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
} from '../types';
import { api } from '../lib/api';
import { soundEngine } from '../lib/audio';
import { getServerNow, recordServerTimestamp } from '../lib/timeSync';

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
  spinStationTopic: (stationId: string, wheelTopicIds?: string[]) => Promise<{ topic: Topic; targetIndex?: number; wheelTopics?: Topic[]; startedAt: number; durationMs: number; station?: StationState }>;
  completeStationSpin: (stationId: string) => Promise<void>;
  replaceStationWheelTopic: (stationId: string, usedTopicId: string, replacementTopicId?: string) => Promise<{ success: boolean; station: StationState; activeWheelTopics: Topic[] }>;
  sendStationTimerAction: (stationId: string, payload: {
    action: 'start' | 'pause' | 'stop' | 'stop_with_buzzer' | 'reset' | 'time_up';
    phase?: 'prep' | 'speech';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
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
  batchSetStation: (participantIds: string[], stationId: string, stationName?: string) => Promise<any>;
  // Custom Fields
  addCustomField: (field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  updateCustomField: (id: string, field: Partial<CustomFieldDefinition>) => Promise<CustomFieldDefinition>;
  deleteCustomField: (id: string) => Promise<void>;
  // Topics
  addTopic: (topic: string, category?: string, topicId?: string) => Promise<Topic>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<Topic>;
  deleteTopic: (id: string) => Promise<void>;
  importTopics: (list: { topic: string; category?: string; topicId?: string }[]) => Promise<number>;
  resetTopicsStatus: () => Promise<void>;
  // Images
  addImage: (imageIdOrName: string, url: string) => Promise<EventImage>;
  updateImage: (id: string, updates: Partial<EventImage>) => Promise<EventImage>;
  uploadImages: (payload: {
    images?: Array<{ imageId?: string; name?: string; base64: string }>;
    name?: string;
    base64?: string;
    imageId?: string;
  }) => Promise<{ success: boolean; count: number; images: EventImage[]; allImages: EventImage[] }>;
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
    action: 'start' | 'pause' | 'stop' | 'reset' | 'time_up' | 'transition_to_speech';
    phase?: 'prep' | 'speech';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
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

  const reloadState = useCallback(async () => {
    try {
      const state = await api.getState();
      setDb(state);
      // If no active participant yet and participants exist, set first active safely (respecting current station)
      setActiveParticipant((current) => {
        if (current) return current;
        if (!state.participants || state.participants.length === 0) return null;
        if (currentStationId && currentStationId !== 'all') {
          const stationMatch = state.participants.find((p) => p.stationId === currentStationId);
          if (stationMatch) return stationMatch;
        }
        return state.participants[0] ?? null;
      });
    } catch (err) {
      console.error('Failed to load initial state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadState();
  }, [reloadState]);

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

  // Synchronize active participant across station and global live sync
  useEffect(() => {
    if (activeParticipant) {
      if (currentStationId) {
        api.setStationParticipant(currentStationId, activeParticipant.id).catch(() => {});
      }
      api.updateLiveSync({ activeParticipantId: activeParticipant.id }).catch(() => {});
    }
  }, [activeParticipant?.id, currentStationId]);

  // Synchronize round switch when operator navigates pages
  useEffect(() => {
    let roundNum: 1 | 2 | 3 | null = null;
    if (currentPage === 'round1') roundNum = 1;
    else if (currentPage === 'round2') roundNum = 2;
    else if (currentPage === 'round3') roundNum = 3;

    if (roundNum) {
      if (currentStationId) {
        api.setStationRound(currentStationId, roundNum).catch(() => {});
      }
      api.updateLiveSync({ currentRound: roundNum }).catch(() => {});
    }
  }, [currentPage, currentStationId]);

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

        if (res.success && res.station) {
          setCurrentStationId(stationId);
          setDb((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stations: { ...(prev.stations || {}), [stationId]: res.station! },
            };
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to claim station:', err);
        return false;
      }
    },
    [db?.stations, deviceId, setCurrentStationId]
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
        await api.releaseStation(targetId, deviceId);
      }
    },
    [currentStationId, deviceId]
  );

  // Station Actions
  const setStationRound = useCallback(
    async (stationId: string, round: 1 | 2 | 3) => {
      const res = await api.setStationRound(stationId, round);
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

  const setStationParticipant = useCallback(
    async (stationId: string, participantId: string | null) => {
      const res = await api.setStationParticipant(stationId, participantId);
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
    async (stationId: string) => {
      const station = db?.stations?.[stationId];
      const res = await api.assignStationImage(
        stationId,
        station?.activeParticipantId || undefined,
        station?.activeParticipant?.name || undefined
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

  const spinStationTopic = useCallback(
    async (stationId: string, wheelTopicIds?: string[]) => {
      const station = db?.stations?.[stationId];
      const res = await api.spinStationTopic(
        stationId,
        station?.activeParticipantId || undefined,
        station?.activeParticipant?.name || undefined,
        wheelTopicIds
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
        action: 'start' | 'pause' | 'stop' | 'stop_with_buzzer' | 'reset' | 'time_up';
        phase?: 'prep' | 'speech';
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
        const localEventId = `buzzer-${Date.now()}-${stationId}`;
        playBuzzerWithDebounce(localEventId);
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
            timerAccumulatedMs: 0,
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
              timerMode: updated.timerMode,
              timerStatus: 'running',
              timerDuration: updated.timerDuration,
              timerTotalSeconds: updated.timerTotalSeconds,
              timerRemainingSeconds: updated.timerRemainingSeconds,
              isTimerRunning: true,
              timerStartTime: updated.timerStartTime,
              timerStartedAt: updated.timerStartedAt,
              timerEndsAt: updated.timerEndsAt,
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
      eventSource = new EventSource('/api/events');

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
          playBuzzerWithDebounce(payload.eventId);
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
          const stationList: (StationState & { serverTime?: number })[] = JSON.parse(e.data);
          if (stationList[0]?.serverTime) recordServerTimestamp(stationList[0].serverTime);
          setDb((prev) => {
            if (!prev) return prev;
            const stations = { ...(prev.stations || {}) };
            stationList.forEach((s) => {
              stations[s.id] = s;
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
              liveSync: {
                ...prev.liveSync,
                wheelSpin: {
                  isSpinning: true,
                  targetTopicId: spinData.topic.id,
                  targetTopicTitle: spinData.topic.topic,
                  targetIndex: spinData.targetIndex ?? 0,
                  wheelTopics: spinData.wheelTopics,
                  startedAt: spinData.startedAt,
                  durationMs: spinData.durationMs,
                },
              },
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
  }, [playBuzzerWithDebounce]);

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
      action: 'start' | 'pause' | 'stop' | 'reset' | 'time_up';
      phase?: 'prep' | 'speech';
      totalSeconds?: number;
      remainingSeconds?: number;
      round?: string;
      endsAt?: number;
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
      });
    },
    [activeParticipant?.name, unlockSound, playBuzzerLocal]
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
    setDb((prev) => (prev ? { ...prev, participants: [...prev.participants, created] } : prev));
    setActiveParticipant((curr) => curr || created);
    return created;
  }, []);

  const updateParticipant = useCallback(async (id: string, p: Partial<Participant>) => {
    const updated = await api.updateParticipant(id, p);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((item) => (item.id === id ? updated : item)),
          }
        : prev
    );
    setActiveParticipant((curr) => (curr?.id === id ? updated : curr));
    return updated;
  }, []);

  const deleteParticipant = useCallback(async (id: string) => {
    await api.deleteParticipant(id);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.filter((item) => item.id !== id),
          }
        : prev
    );
    setActiveParticipant((curr) => (curr?.id === id ? null : curr));
  }, []);

  const importParticipants = useCallback(async (list: Partial<Participant>[]) => {
    const res = await api.batchAddParticipants(list);
    await reloadState();
    return res.count;
  }, [reloadState]);

  const batchSetStation = useCallback(
    async (participantIds: string[], stationId: string, stationName?: string) => {
      const res = await api.batchSetStation(participantIds, stationId, stationName);
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

  // Topics
  const addTopic = useCallback(async (topic: string, category?: string, topicId?: string) => {
    const created = await api.addTopic({ topic, category, topicId });
    setDb((prev) => (prev ? { ...prev, topics: [...prev.topics, created] } : prev));
    return created;
  }, []);

  const updateTopic = useCallback(async (id: string, updates: Partial<Topic>) => {
    const updated = await api.updateTopic(id, updates);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            topics: prev.topics.map((t) => (t.id === id ? updated : t)),
          }
        : prev
    );
    return updated;
  }, []);

  const deleteTopic = useCallback(async (id: string) => {
    await api.deleteTopic(id);
    setDb((prev) => (prev ? { ...prev, topics: prev.topics.filter((t) => t.id !== id) } : prev));
  }, []);

  const importTopics = useCallback(async (list: { topic: string; category?: string; topicId?: string }[]) => {
    const res = await api.batchAddTopics(list);
    await reloadState();
    return res.count;
  }, [reloadState]);

  const resetTopicsStatus = useCallback(async () => {
    await api.resetTopicsStatus();
    await reloadState();
  }, [reloadState]);

  // Images
  const addImage = useCallback(async (imageIdOrName: string, url: string) => {
    const created = await api.addImage({ imageId: imageIdOrName, name: imageIdOrName, url });
    setDb((prev) => (prev ? { ...prev, images: [...prev.images, created] } : prev));
    return created;
  }, []);

  const updateImage = useCallback(async (id: string, updates: Partial<EventImage>) => {
    const updated = await api.updateImage(id, updates);
    setDb((prev) =>
      prev
        ? {
            ...prev,
            images: prev.images.map((img) => (img.id === id ? updated : img)),
          }
        : prev
    );
    return updated;
  }, []);

  const uploadImages = useCallback(
    async (payload: { images?: Array<{ imageId?: string; name?: string; base64: string }>; name?: string; base64?: string; imageId?: string }) => {
      const res = await api.uploadImages(payload);
      setDb((prev) => (prev ? { ...prev, images: res.allImages } : prev));
      return res;
    },
    []
  );

  const deleteImage = useCallback(async (id: string) => {
    await api.deleteImage(id);
    setDb((prev) => (prev ? { ...prev, images: prev.images.filter((img) => img.id !== id) } : prev));
  }, []);

  const resetImagesStatus = useCallback(async () => {
    await api.resetImagesStatus();
    await reloadState();
  }, [reloadState]);

  // Settings
  const updateSettings = useCallback(async (updates: Partial<EventSettings>) => {
    const updated = await api.updateSettings(updates);
    setDb((prev) => (prev ? { ...prev, settings: updated } : prev));
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
        return {
          ...prev,
          participants: updatedParticipants,
          round1Results: updatedR1,
          round2Results: updatedR2,
          round3Results: updatedR3,
        };
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

        // Station Actions
        setStationRound,
        setStationParticipant,
        updateStationHandler,
        pingStation,
        assignStationImage,
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
        resetTopicsStatus,
        addImage,
        updateImage,
        uploadImages,
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
