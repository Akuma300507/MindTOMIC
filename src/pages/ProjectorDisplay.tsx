import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Trophy,
  Image as ImageIcon,
  Disc,
  LogOut,
  Volume2,
  VolumeX,
  Radio,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  RotateCw,
  Upload,
  Bell,
  X,
  Monitor,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { WheelCanvas } from '../components/common/WheelCanvas';
import { soundEngine } from '../lib/audio';
import { computeStationTimer, formatTimeMMSS } from '../lib/timerUtils';
import { getServerNow } from '../lib/timeSync';
import { MindToMicLogo } from '../components/common/MindToMicLogo';
import { InspireLogo } from '../components/common/InspireLogo';
import { type Topic, type Participant, isParticipantCheckedIn } from '../types';

export const ProjectorDisplay: React.FC = () => {
  const {
    db,
    allStations,
    currentStationId,
    setCurrentStationId,
    rotateStationImage,
    isConnected,
    isFullscreen,
    toggleFullscreen,
    setCurrentPage,
    soundUnlocked,
    unlockSound,
    uploadInspireLogo,
    projectorDeviceId,
    projectorPingNotification,
    clearProjectorPingNotification,
    updateSettings,
  } = useApp();

  // Wheel topic font size adjustment state (synced with settings and localStorage)
  const wheelFontSize = useMemo(() => {
    if (typeof db?.settings.round2.wheelFontSize === 'number') {
      return db.settings.round2.wheelFontSize;
    }
    const saved = localStorage.getItem('m2m_wheel_font_size');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 7 && num <= 24) return num;
    }
    return undefined;
  }, [db?.settings?.round2?.wheelFontSize]);

  useEffect(() => {
    if (projectorPingNotification) {
      const timer = setTimeout(() => {
        clearProjectorPingNotification();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [projectorPingNotification, clearProjectorPingNotification]);

  const inspireFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInspireQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      if (base64Data && uploadInspireLogo) {
        try {
          await uploadInspireLogo(base64Data, file.name);
        } catch (err) {
          console.error('Failed to quick-upload Inspire logo:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Multi-station / location selection with URL param, device station, and localStorage persistence
  const initialStation = useMemo(() => {
    const urlVal = new URLSearchParams(window.location.search).get('station');
    if (urlVal && urlVal !== 'all') return urlVal;
    if (currentStationId && currentStationId !== 'all') return currentStationId;
    const stored = localStorage.getItem('projector_assigned_station');
    if (stored && stored !== 'all') return stored;
    const storedCurrent = localStorage.getItem('m2m_current_station_id');
    if (storedCurrent && storedCurrent !== 'all') return storedCurrent;
    return allStations[0]?.id || 'station-a';
  }, [allStations, currentStationId]);

  const [selectedStationId, setSelectedStationId] = useState<string>(initialStation);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Synchronize selectedStationId with currentStationId if device's station selection changes
  useEffect(() => {
    if (currentStationId && currentStationId !== 'all' && currentStationId !== selectedStationId) {
      setSelectedStationId(currentStationId);
    }
  }, [currentStationId, selectedStationId]);

  // Ensure selectedStationId always points to a valid station once allStations are loaded
  useEffect(() => {
    if (allStations.length > 0) {
      if (!selectedStationId || selectedStationId === 'all' || !allStations.some((s) => s.id === selectedStationId)) {
        const fallback = currentStationId && currentStationId !== 'all' && allStations.some((s) => s.id === currentStationId)
          ? currentStationId
          : allStations[0].id;
        setSelectedStationId(fallback);
      }
    }
  }, [allStations, selectedStationId, currentStationId]);

  const handleStationSelect = (stationId: string) => {
    if (!stationId || stationId === 'all') return;
    setSelectedStationId(stationId);
    setCurrentStationId(stationId);
    try {
      localStorage.setItem('projector_assigned_station', stationId);
      localStorage.setItem('m2m_current_station_id', stationId);
      const url = new URL(window.location.href);
      url.searchParams.set('station', stationId);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  // Read current station-specific state strictly isolated to this projector's station
  const currentStationState = db?.stations ? db.stations[selectedStationId] : null;

  // STRICT STATION ISOLATION: Find active participant for this station
  // NEVER fall back to other stations or global liveSync
  // ONLY display contestant IF they are currently checked in!
  const activeParticipant = useMemo(() => {
    let candidate: Participant | null = null;
    if (currentStationState?.activeParticipantId && db?.participants) {
      candidate = db.participants.find((p) => p.id === currentStationState.activeParticipantId) || null;
    } else if (currentStationState?.activeParticipant) {
      candidate =
        db?.participants?.find((p) => p.id === currentStationState.activeParticipant?.id) ||
        currentStationState.activeParticipant;
    }

    // Direct Station Checked-In Fallback:
    // If the station has no explicitly staged participant in station state yet,
    // find the active checked-in participant allocated to this station so the projector view shows them!
    if (!candidate && db?.participants && selectedStationId) {
      candidate =
        db.participants.find(
          (p) =>
            (p.stationId === selectedStationId ||
              p.checkedInStationId === selectedStationId ||
              (!p.stationId && (selectedStationId === 'station-a' || selectedStationId === allStations[0]?.id))) &&
            isParticipantCheckedIn(p)
        ) || null;
    }

    if (candidate && isParticipantCheckedIn(candidate)) {
      return candidate;
    }
    return null;
  }, [
    currentStationState?.activeParticipantId,
    currentStationState?.activeParticipant?.id,
    currentStationState?.activeParticipant?.checkedIn,
    currentStationState?.activeParticipant?.status,
    db?.participants,
    selectedStationId,
    allStations,
  ]);

  const eventName = db?.settings.event.name || 'MIND TO MIC';
  const tagline = db?.settings.event.tagline || 'THINK. SPEAK. EXPRESS.';

  // STRICT STATION ISOLATION: Round number for this station
  const currentRound = useMemo(() => {
    return currentStationState?.currentRound || 1;
  }, [currentStationState?.currentRound]);

  // STRICT STATION ISOLATION: Active displayed item (image or topic)
  const activeItem = useMemo(() => {
    if (!currentStationState) return null;
    if (currentRound === 1 && currentStationState.selectedImage) {
      const imageId = currentStationState.selectedImage.imageId || currentStationState.selectedImage.name;
      return {
        type: 'image' as const,
        title: `IMAGE ID: ${imageId}`,
        mediaUrl: currentStationState.selectedImage.url,
        id: currentStationState.selectedImage.id,
        rotation: currentStationState.imageRotation ?? currentStationState.selectedImage.rotation ?? 0,
      };
    }
    if (currentRound === 2 && currentStationState.selectedTopic) {
      return {
        type: 'topic' as const,
        title: currentStationState.selectedTopic.topic,
        id: currentStationState.selectedTopic.id,
        category: currentStationState.selectedTopic.category,
      };
    }
    if (currentRound === 3) {
      return {
        type: 'final' as const,
        title: 'Championship Grand Finals',
      };
    }
    return null;
  }, [currentStationState, currentRound]);

  // Real-time Timer Interpolation using shared backend timestamps (zero-drift, clock-synced)
  const [nowMs, setNowMs] = useState<number>(() => getServerNow());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(getServerNow());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // STRICT STATION ISOLATION: Timer source strictly for this station
  const computedTimer = useMemo(() => {
    return computeStationTimer(currentStationState, nowMs);
  }, [currentStationState, nowMs]);

  const timerMode = computedTimer.phase;
  const isTimerRunning = computedTimer.isRunning;
  const remainingSeconds = computedTimer.remainingSeconds;
  const isOvertime = computedTimer.isOvertime;
  const overtimeSeconds = computedTimer.overtimeSeconds;
  const progressPercent = computedTimer.progressPercent;
  const warningTimeSeconds = useMemo(() => {
    if (currentRound === 1) return db?.settings.round1.warningTimeSeconds ?? 30;
    if (currentRound === 2) return db?.settings.round2.warningTimeSeconds ?? 30;
    if (currentRound === 3) return db?.settings.round3.warningTimeSeconds ?? 30;
    return 30;
  }, [currentRound, db?.settings]);

  const isWarning = remainingSeconds <= warningTimeSeconds && remainingSeconds > 0 && isTimerRunning && !isOvertime;
  const isTimeUp = isOvertime || timerMode === 'time_up' || computedTimer.status === 'time_up';

  // Round 2 Wheel Animation in Projector View
  const [wheelAngle, setWheelAngle] = useState(0);
  const [isProjectorWheelSpinning, setIsProjectorWheelSpinning] = useState(false);
  const [projectorWinningTopic, setProjectorWinningTopic] = useState<Topic | null>(null);
  const [projectorWheelTopics, setProjectorWheelTopics] = useState<Topic[]>([]);
  const lastSpinStartedAtRef = useRef<number>(0);
  const spinAnimFrameRef = useRef<number | null>(null);

  // Image rotation state (0, 90, 180, 270 degrees)
  const [localImageRotation, setLocalImageRotation] = useState<number>(0);

  // Reset local rotation when active image changes
  useEffect(() => {
    setLocalImageRotation(0);
  }, [activeItem?.id]);

  // Combined rotation between local display and station saved rotation
  const serverImageRot = currentStationState?.imageRotation ?? (activeItem?.rotation || 0);
  const totalRotation = ((localImageRotation + serverImageRot) % 360 + 360) % 360;

  const handleRotateImage = useCallback(async () => {
    const nextRot = (totalRotation + 90) % 360;
    setLocalImageRotation((prev) => (prev + 90) % 360);
    if (selectedStationId && rotateStationImage) {
      try {
        await rotateStationImage(selectedStationId, nextRot);
      } catch (err) {
        console.error('Failed to sync rotation to station:', err);
      }
    }
  }, [totalRotation, selectedStationId, rotateStationImage]);

  const handleResetImageRotation = useCallback(async () => {
    setLocalImageRotation(0);
    if (selectedStationId && rotateStationImage) {
      try {
        await rotateStationImage(selectedStationId, 0);
      } catch (err) {
        console.error('Failed to reset rotation on station:', err);
      }
    }
  }, [selectedStationId, rotateStationImage]);

  // Reset winning topic when station changes, or when active participant changes
  useEffect(() => {
    setProjectorWinningTopic(null);
    setProjectorWheelTopics([]);
  }, [selectedStationId, activeParticipant?.id, currentRound, currentStationState?.selectedTopicId]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (spinAnimFrameRef.current) {
        cancelAnimationFrame(spinAnimFrameRef.current);
      }
    };
  }, []);

  // Document-level overflow lock: eliminate any window scrollbar while projector view is active
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  // Stage container reference and real-time bounding dimensions for zero-scroll scaling
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageDim, setStageDim] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        width: Math.max(300, window.innerWidth - 32),
        height: Math.max(200, window.innerHeight - 130),
      };
    }
    return { width: 800, height: 500 };
  });

  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageDim({ width, height });
        }
      }
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // Dynamic responsive wheel size strictly computed from actual available stage dimensions
  const wheelSize = useMemo(() => {
    // Leave safe overhead for contestant banner (40px), badge (28px), pointer (26px), and bottom breathing margin (20px)
    const availH = stageDim.height - 114;
    const availW = stageDim.width - 40;
    const avail = Math.min(availW, availH);
    return Math.max(220, Math.min(560, Math.floor(avail)));
  }, [stageDim.width, stageDim.height]);

  // STRICT STATION ISOLATION: Default active topics for this station
  const stationDefaultWheelTopics = useMemo(() => {
    if (!db?.topics) return [];
    const count = db.settings.round2.activeWheelTopicCount || 20;

    if (selectedStationId) {
      const station = db.stations?.[selectedStationId];
      const stationName = station?.name;
      // Dedicated topics assigned to this station
      const dedicated = db.topics.filter(
        (t) => t.stationId === selectedStationId || (stationName && t.stationId === stationName)
      );
      if (dedicated.length > 0) {
        const available = dedicated.filter((t) => t.status === 'available');
        return (available.length > 0 ? available : dedicated).slice(0, count);
      }
      // Universal topics (excluding other stations' topics)
      const otherStationTopics = db.topics.filter(
        (t) => t.stationId && t.stationId !== 'all' && t.stationId !== selectedStationId && t.stationId !== stationName
      );
      const universal = db.topics.filter((t) => !otherStationTopics.includes(t));
      const available = universal.filter((t) => t.status === 'available');
      return (available.length > 0 ? available : universal).slice(0, count);
    }

    const available = db.topics.filter((t) => t.status === 'available');
    return (available.length > 0 ? available : db.topics).slice(0, count);
  }, [db?.topics, db?.settings.round2.activeWheelTopicCount, selectedStationId, db?.stations]);

  // The topics currently rendered on the projector wheel
  const activeTopics = useMemo(() => {
    if (projectorWheelTopics.length > 0) return projectorWheelTopics;
    if (currentStationState?.activeWheelTopics && currentStationState.activeWheelTopics.length > 0) {
      return currentStationState.activeWheelTopics;
    }
    return stationDefaultWheelTopics;
  }, [projectorWheelTopics, currentStationState?.activeWheelTopics, stationDefaultWheelTopics]);

  // STRICT STATION ISOLATION: Watch for wheel spin events ONLY for this station
  useEffect(() => {
    const wheelSpin = currentStationState?.wheelSpin;
    if (wheelSpin?.isSpinning) {
      if (wheelSpin.startedAt && wheelSpin.startedAt === lastSpinStartedAtRef.current) {
        return;
      }
      if (wheelSpin.startedAt) {
        lastSpinStartedAtRef.current = wheelSpin.startedAt;
      }

      setIsProjectorWheelSpinning(true);
      setProjectorWinningTopic(null);

      if (spinAnimFrameRef.current) {
        cancelAnimationFrame(spinAnimFrameRef.current);
        spinAnimFrameRef.current = null;
      }

      // Slices to use: prioritize wheelTopics transmitted directly from the spin event
      let topicsForSpin =
        wheelSpin.wheelTopics && wheelSpin.wheelTopics.length > 0
          ? [...wheelSpin.wheelTopics]
          : [...activeTopics];

      if (topicsForSpin.length === 0) {
        topicsForSpin = [...stationDefaultWheelTopics];
      }

      // Locate slice index - match exact ID or Title in topicsForSpin
      let targetIndex = topicsForSpin.findIndex((t) => t.id === wheelSpin.targetTopicId);
      if (targetIndex === -1 && wheelSpin.targetTopicTitle) {
        targetIndex = topicsForSpin.findIndex((t) => t.topic === wheelSpin.targetTopicTitle);
      }

      if (targetIndex === -1 || targetIndex >= topicsForSpin.length) {
        const insertIdx =
          typeof wheelSpin.targetSliceIndex === 'number' &&
          wheelSpin.targetSliceIndex >= 0 &&
          wheelSpin.targetSliceIndex < topicsForSpin.length
            ? wheelSpin.targetSliceIndex
            : 0;

        if (wheelSpin.targetTopicId && wheelSpin.targetTopicTitle) {
          const placeholder: Topic = {
            id: wheelSpin.targetTopicId,
            topic: wheelSpin.targetTopicTitle,
            category: wheelSpin.targetTopicCategory || 'General',
            status: 'used',
          };
          topicsForSpin[insertIdx] = placeholder;
          targetIndex = insertIdx;
        } else {
          targetIndex = 0;
        }
      }

      setProjectorWheelTopics(topicsForSpin);

      const totalSlices = topicsForSpin.length;
      const sliceAngle = (2 * Math.PI) / totalSlices;
      const POINTER_ANGLE = 1.5 * Math.PI; // Top 12 o'clock pointer
      const TWO_PI = 2 * Math.PI;

      const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
      const targetNormalized = ((POINTER_ANGLE - targetSliceCenter) % TWO_PI + TWO_PI) % TWO_PI;
      const currentNormalized = ((wheelAngle % TWO_PI) + TWO_PI) % TWO_PI;

      let angleDiff = targetNormalized - currentNormalized;
      if (angleDiff <= 0.05) {
        angleDiff += TWO_PI;
      }

      const extraRotations = 6;
      const desiredFinalAngle = wheelAngle + extraRotations * TWO_PI + angleDiff;

      const startAngle = wheelAngle;
      const distance = desiredFinalAngle - startAngle;
      const duration = wheelSpin.durationMs || 4800;
      const startTime = performance.now();

      let lastTick = -1;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startAngle + distance * easeOut;

        setWheelAngle(current);

        const angleUnderPointer = ((POINTER_ANGLE - current) % TWO_PI + TWO_PI) % TWO_PI;
        const curSlice = Math.floor(angleUnderPointer / sliceAngle);
        if (curSlice !== lastTick) {
          lastTick = curSlice;
          if (!soundMuted) soundEngine.playTick();
        }

        if (progress < 1) {
          spinAnimFrameRef.current = requestAnimationFrame(animate);
        } else {
          setWheelAngle(desiredFinalAngle);
          setIsProjectorWheelSpinning(false);
          const won = topicsForSpin[targetIndex] || {
            id: wheelSpin.targetTopicId || 'winner',
            topic: wheelSpin.targetTopicTitle || 'Selected Topic',
            status: 'used',
          };
          setProjectorWinningTopic(won);
          if (!soundMuted) soundEngine.playChime();

          // Confetti celebration when topic emerges
          try {
            confetti({
              particleCount: 90,
              spread: 80,
              origin: { y: 0.55 },
              colors: ['#a855f7', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
            });
          } catch {}

          // Keep topicsForSpin intact so the slice under the pointer matches the winning card!
          setProjectorWheelTopics(topicsForSpin);
        }
      };

      spinAnimFrameRef.current = requestAnimationFrame(animate);
    }
  }, [
    currentStationState?.wheelSpin,
    activeTopics,
    stationDefaultWheelTopics,
    wheelAngle,
    soundMuted,
    db?.topics,
  ]);

  // Handle keyboard shortcuts (F: fullscreen, Esc: exit confirmation, R: rotate image)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExitModal(true);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R') {
        if (currentRound === 1 && activeItem?.type === 'image') {
          handleRotateImage();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, currentRound, activeItem?.type, handleRotateImage]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    return formatTimeMMSS(secs);
  };

  // STRICT STATION ISOLATION: Track whether spin is active for THIS station
  const isSpinActive = Boolean(
    isProjectorWheelSpinning ||
    (currentStationState && (currentStationState.status === 'SPINNING' || currentStationState.wheelSpin?.isSpinning))
  );

  // STRICT STATION ISOLATION: Current Round 2 topic to display on projector
  // Strictly hidden until wheel spin is fully finished!
  const currentRoundTopic = useMemo(() => {
    if (isSpinActive) return null;
    if (
      currentStationState?.selectedTopic &&
      currentStationState.status !== 'WAITING' &&
      currentStationState.status !== 'SPINNING'
    ) {
      return {
        title: currentStationState.selectedTopic.topic,
        category: currentStationState.selectedTopic.category,
      };
    }
    if (
      projectorWinningTopic &&
      currentStationState &&
      currentStationState.status !== 'WAITING' &&
      currentStationState.status !== 'SPINNING' &&
      currentStationState.selectedTopicId === projectorWinningTopic.id
    ) {
      return {
        title: projectorWinningTopic.topic,
        category: projectorWinningTopic.category,
      };
    }
    return null;
  }, [
    isSpinActive,
    projectorWinningTopic,
    currentStationState?.selectedTopic,
    currentStationState?.status,
    currentStationState?.selectedTopicId,
  ]);

  return (
    <div className="fixed inset-0 h-screen max-h-screen w-screen max-w-[100vw] bg-slate-950 text-white flex flex-col justify-between p-2.5 sm:p-3 md:p-4 relative overflow-hidden select-none font-['Outfit']">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Visual Test Ping Alert Banner from Master Monitor */}
      <AnimatePresence>
        {projectorPingNotification && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-3xl bg-cyan-400 text-slate-950 font-black shadow-[0_0_50px_rgba(34,211,238,0.6)] border-2 border-white flex items-center gap-4 backdrop-blur-xl"
          >
            <div className="p-2 rounded-2xl bg-black/10">
              <Bell className="w-7 h-7 text-slate-950 animate-bounce" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-800 font-extrabold">Master Admin Ping Received</div>
              <div className="text-lg font-black tracking-tight">{projectorPingNotification.message}</div>
            </div>
            <button
              onClick={clearProjectorPingNotification}
              className="ml-4 p-1.5 rounded-full hover:bg-black/15 text-slate-950 transition-colors"
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: Event Branding, Top-Center Inspire 2K26 Logo, Station Selector, Connection & Exit */}
      <header className="relative z-10 flex items-center justify-between gap-2 sm:gap-4 border-b border-purple-900/40 pb-2 shrink-0">
        {/* Left: Event Logo & Name */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 justify-start">
          <MindToMicLogo size={44} className="drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] shrink-0 transition-transform hover:scale-105" />
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-['Outfit'] drop-shadow-md leading-tight truncate">
                {eventName}
              </h1>
              {/* Station / Room Selector */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
                <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                <select
                  id="projector-station-select"
                  value={selectedStationId}
                  onChange={(e) => handleStationSelect(e.target.value)}
                  className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  {allStations.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name} {s.location ? `• ${s.location}` : ''} (Round {s.currentRound})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="hidden md:block text-[10px] font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-blue-300 font-mono">
              {tagline}
            </p>
          </div>
        </div>

        {/* TOP CENTER: Inspire 2K26 Logo & Active Round Indicator */}
        <div className="flex flex-col items-center justify-center text-center shrink-0 px-2 group/center">
          <div className="relative group/logo transition-transform duration-300 hover:scale-105">
            <InspireLogo size={52} showGlow={true} />
            <input
              type="file"
              ref={inspireFileInputRef}
              onChange={handleInspireQuickUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => inspireFileInputRef.current?.click()}
              className="absolute -top-1.5 -right-2 p-1 rounded-full bg-slate-900/90 hover:bg-amber-600 text-slate-300 hover:text-white border border-amber-500/40 opacity-0 group-hover/logo:opacity-100 transition-all shadow-lg backdrop-blur-md cursor-pointer"
              title="Replace / Upload Exact Logo File"
            >
              <Upload className="w-3 h-3" />
            </button>
          </div>

          {/* Arcade Illuminated Round Marquee Banner */}
          <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-950/70 via-purple-950/90 to-amber-950/70 border border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.25)] backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-300 font-['Outfit']">
              {currentRound === 1 && 'ROUND 1 • IMAGE TO SPEECH'}
              {currentRound === 2 && 'ROUND 2 • SPIN THE TOPIC WHEEL'}
              {currentRound === 3 && 'ROUND 3 • CHAMPIONSHIP FINALS'}
            </span>
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse shrink-0 hidden sm:inline" />
          </div>
        </div>

        {/* Right: Stage Clock, Audio, Fullscreen & Exit */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 min-w-0">
          {/* Connection Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-colors ${
              isConnected
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                : 'bg-amber-950/70 border-amber-800/80 text-amber-300 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'bg-amber-400'
              }`}
            />
            <span className="hidden xl:inline">{isConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
          </div>

          {/* Top-Right Corner Small Clock for Round 1 & Round 2 */}
          {currentRound !== 3 && (
            <div
              id="projector-corner-clock"
              className={`flex items-center gap-2.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl border backdrop-blur-md transition-all shadow-xl ${
                isOvertime
                  ? 'bg-rose-950/90 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.45)] ring-1 ring-rose-500/50'
                  : isTimeUp
                  ? 'bg-rose-950/80 border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                  : isWarning
                  ? 'bg-amber-950/80 border-amber-500/70 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : timerMode === 'speech'
                  ? 'bg-emerald-950/80 border-emerald-500/60 shadow-[0_0_20px_rgba(52,211,153,0.25)]'
                  : timerMode === 'prep'
                  ? 'bg-blue-950/80 border-blue-500/60 shadow-[0_0_15px_rgba(96,165,250,0.2)]'
                  : 'bg-slate-900/90 border-purple-800/60'
              }`}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1">
                  <Clock className={`w-3 h-3 ${isOvertime ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-purple-400'}`} />
                  <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-slate-300">
                    {isOvertime
                      ? 'OVERTIME'
                      : timerMode === 'prep'
                      ? 'PREP'
                      : timerMode === 'speech'
                      ? 'SPEAKING'
                      : timerMode === 'stopped'
                      ? 'PAUSED'
                      : timerMode === 'time_up'
                      ? "TIME'S UP"
                      : 'STAGE CLOCK'}
                  </span>
                </div>
                <div className="w-14 sm:w-16 bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800 mt-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOvertime
                        ? 'bg-rose-500'
                        : isTimeUp
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-400'
                        : timerMode === 'prep'
                        ? 'bg-blue-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div
                className={`font-mono text-xl sm:text-2xl font-black tracking-tight leading-none pl-0.5 ${
                  isOvertime
                    ? 'text-rose-400 animate-pulse'
                    : isTimeUp
                    ? 'text-rose-500 animate-pulse'
                    : isWarning
                    ? 'text-amber-400 animate-pulse'
                    : timerMode === 'speech'
                    ? 'text-emerald-400'
                    : timerMode === 'prep'
                    ? 'text-blue-400'
                    : 'text-white'
                }`}
              >
                {isOvertime ? computedTimer.formattedOvertime : formatTime(remainingSeconds)}
              </div>
            </div>
          )}

          {/* Audio Enable / Mute */}
          <button
            onClick={() => {
              if (!soundUnlocked) unlockSound();
              setSoundMuted(!soundMuted);
            }}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              soundMuted
                ? 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                : 'bg-purple-950/80 text-purple-300 border-purple-800/80 hover:bg-purple-900/80'
            }`}
            title={soundMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Dedicated Secure Exit Button */}
          <button
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold transition-all shadow-md shadow-rose-950/50 cursor-pointer"
            title="Exit Projector Display Mode (Esc)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Center Stage Area - Dynamic Zero-Scroll Viewport Fill */}
      <main ref={stageRef} className="relative z-10 flex-1 min-h-0 w-full max-w-full mx-auto flex flex-col items-center justify-center text-center px-1 py-0.5 overflow-hidden">
        {/* Active Contestant Spotlight Banner */}
        {activeParticipant ? (
          <div key={activeParticipant.id} className="shrink-0 flex items-center justify-center gap-2 py-0.5 animate-in fade-in zoom-in-95 duration-300">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-purple-300 font-mono bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-800/60 shadow">
              CONTESTANT {activeParticipant.participantNumber} • {currentStationState?.name ? `${currentStationState.name.toUpperCase()}` : 'ON STAGE'}
            </span>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white font-['Outfit'] tracking-tight drop-shadow-lg truncate max-w-xl">
              {activeParticipant.name}
            </h2>
          </div>
        ) : (
          <div key="awaiting-contestant" className="shrink-0 text-slate-400 font-semibold text-xs flex items-center gap-2 py-0.5">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Awaiting Next Contestant{currentStationState ? ` for ${currentStationState.name}` : ''}...</span>
          </div>
        )}

        {/* Round 3: Championship Finals Arena & Stage Timer (Single Unified Card, Fits All Screens) */}
        {currentRound === 3 && (
          <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-2.5 my-auto animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
                <span className="text-xs font-mono font-black tracking-widest text-emerald-400 uppercase truncate max-w-md">
                  FINALS ARENA • {activeItem?.title && activeItem.title !== 'Championship Finals Speech' ? activeItem.title : 'GRAND FINALS'}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  isOvertime
                    ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                    : timerMode === 'speech'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : timerMode === 'prep'
                    ? 'bg-blue-950 text-blue-400 border-blue-800'
                    : timerMode === 'time_up'
                    ? 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {isOvertime ? 'OVERTIME' : timerMode === 'speech' ? 'LIVE' : timerMode.toUpperCase()}
              </span>
            </div>

            {/* Large Digits */}
            <div
              className={`font-mono text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none transition-colors duration-200 ${
                isOvertime
                  ? 'text-rose-400 animate-pulse drop-shadow-[0_0_35px_rgba(244,63,94,0.7)]'
                  : isTimeUp
                  ? 'text-rose-500 animate-pulse drop-shadow-[0_0_30px_rgba(244,63,94,0.6)]'
                  : isWarning
                  ? 'text-amber-400 animate-pulse drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]'
                  : timerMode === 'speech'
                  ? 'text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.3)]'
                  : timerMode === 'prep'
                  ? 'text-blue-400 drop-shadow-[0_0_25px_rgba(96,165,250,0.3)]'
                  : 'text-white'
              }`}
            >
              {isOvertime ? computedTimer.formattedOvertime : formatTime(remainingSeconds)}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOvertime
                    ? 'bg-rose-500'
                    : isTimeUp
                    ? 'bg-rose-500'
                    : isWarning
                    ? 'bg-amber-400'
                    : timerMode === 'prep'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                    : 'bg-gradient-to-r from-purple-500 to-emerald-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Time's Up / Overtime Banner */}
            {isOvertime ? (
              <div className="py-1.5 px-3 rounded-xl bg-rose-600/30 border border-rose-500/60 text-rose-200 font-bold text-xs animate-pulse flex items-center justify-center gap-1.5">
                <span>⚠️</span>
                <span>SPEAKING LIMIT REACHED • OVERTIME ({computedTimer.formattedOvertime})</span>
              </div>
            ) : isTimeUp ? (
              <div className="py-1.5 px-3 rounded-xl bg-rose-600/30 border border-rose-500/60 text-rose-300 font-bold text-xs animate-bounce">
                ⚠️ TIME EXPIRED • BUZZER ACTIVE
              </div>
            ) : null}
          </div>
        )}

        {/* Dynamic Round Prompt Content Display */}
        {/* Round 1: Assigned Image (Maximized Full Screen Viewport, Zero Black Space, Zero Scroll) */}
        {currentRound === 1 && (
          activeItem?.type === 'image' && activeItem.mediaUrl ? (
            <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center relative p-1 animate-in zoom-in-95 duration-500">
              <div className="relative w-full h-full flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-2xl border border-purple-900/40 bg-slate-950/60 shadow-[0_0_60px_rgba(168,85,247,0.25)] p-1 group">
                {/* Floating Top-Left Prompt ID Badge */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-purple-500/50 shadow-xl pointer-events-none">
                  <span className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-widest hidden sm:inline">
                    VISUAL PROMPT:
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-950/90 border border-blue-500/60 font-mono font-black text-blue-300 text-xs tracking-wider">
                    {activeItem.title}
                  </span>
                </div>

                {/* Floating Top-Right Rotation Controls */}
                <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                  <button
                    id="projector-quick-rotate-top-btn"
                    onClick={handleRotateImage}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/85 hover:bg-purple-950/95 text-purple-200 border border-purple-500/50 hover:border-purple-400 text-xs font-bold transition-all shadow-xl backdrop-blur-md active:scale-95 cursor-pointer"
                    title="Rotate image 90° clockwise (Shortcut: R)"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                    <span>Rotate {totalRotation !== 0 ? `(${totalRotation}°)` : ''}</span>
                  </button>
                  {totalRotation !== 0 && (
                    <button
                      id="projector-quick-reset-top-btn"
                      onClick={handleResetImageRotation}
                      className="px-2 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500 text-xs font-semibold transition-all backdrop-blur-md cursor-pointer"
                      title="Reset rotation to 0°"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Maximized Image dynamically bounded by stageDim so it NEVER exceeds the screen */}
                {(() => {
                  const isRotated = totalRotation % 180 !== 0;
                  const maxImgWidth = isRotated
                    ? Math.max(100, Math.floor(stageDim.height - 16))
                    : Math.max(100, Math.floor(stageDim.width - 16));
                  const maxImgHeight = isRotated
                    ? Math.max(100, Math.floor(stageDim.width - 16))
                    : Math.max(100, Math.floor(stageDim.height - 16));

                  return (
                    <img
                      src={activeItem.mediaUrl}
                      alt={activeItem.title}
                      style={{
                        transform: `rotate(${totalRotation}deg)`,
                        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        maxWidth: `${maxImgWidth}px`,
                        maxHeight: `${maxImgHeight}px`,
                        width: 'auto',
                        height: 'auto',
                      }}
                      className="object-contain rounded-xl drop-shadow-[0_0_50px_rgba(0,0,0,0.85)] select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xl p-6 rounded-3xl bg-slate-900/60 border border-purple-900/30 text-slate-300 flex flex-col items-center space-y-2.5 animate-in fade-in my-auto">
              <Sparkles className="w-10 h-10 text-purple-400 animate-pulse" />
              <div className="space-y-1 text-center">
                <h4 className="text-lg sm:text-xl font-bold text-white font-['Outfit']">ROUND 1 • IMAGE TO SPEECH</h4>
                <p className="text-xs text-slate-400">
                  Awaiting random image prompt assignment from {currentStationState?.name || 'operator station'}
                </p>
              </div>
            </div>
          )
        )}

        {/* Round 2: Wheel Spinning Animation, Selected Topic with Rotating Pop-Out, or Wheel Standby */}
        {currentRound === 2 && (
          <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center relative">
            {isProjectorWheelSpinning ? (
              <div className="flex flex-col items-center space-y-1.5 animate-in zoom-in-95 duration-300">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-amber-400 animate-pulse flex items-center gap-1.5">
                  <Disc className="w-4 h-4 animate-spin" />
                  WHEEL IS SPINNING...
                </span>
                <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} fontSize={wheelFontSize} />
              </div>
            ) : currentRoundTopic ? (
              <div className="relative w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center">
                {/* Background Wheel: Centered and slightly scaled/blurred to provide depth */}
                <div className="transition-all duration-700 scale-90 opacity-25 blur-[1px]">
                  <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} fontSize={wheelFontSize} />
                </div>

                {/* Animated Topic: Bursts OUT from the wheel in a high-energy rotating motion */}
                <div className="absolute inset-0 flex items-center justify-center p-2 z-20">
                  <motion.div
                    key={currentRoundTopic.title}
                    initial={{
                      scale: 0.05,
                      rotate: -720,
                      opacity: 0,
                    }}
                    animate={{
                      scale: 1,
                      rotate: 0,
                      opacity: 1,
                    }}
                    transition={{
                      duration: 1.15,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="w-full max-w-xl p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/95 via-slate-900/98 to-indigo-950/95 border-2 border-purple-400 shadow-[0_0_100px_rgba(168,85,247,0.5)] backdrop-blur-xl space-y-3 text-center relative overflow-hidden max-h-[88%] overflow-y-auto"
                  >
                    {/* Pulsing neon radial aura */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 rounded-3xl blur-2xl opacity-40 -z-10 animate-pulse" />

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-widest text-amber-400 bg-amber-950/70 border border-amber-500/50 px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        SELECTED SPEECH THEME
                      </span>
                      {currentRoundTopic.category && (
                        <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-xl bg-purple-900/80 text-purple-200 border border-purple-500/50 shadow">
                          {currentRoundTopic.category}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white font-['Outfit'] leading-tight drop-shadow-2xl">
                      "{currentRoundTopic.title}"
                    </h3>

                    <div className="pt-0.5 flex items-center justify-center gap-2 text-xs font-mono text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Ready for Speech • Topic Replaced on Wheel</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-1.5 animate-in fade-in">
                <span className="text-[10px] sm:text-xs font-mono font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  TOPIC WHEEL • READY TO SPIN
                </span>
                <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} fontSize={wheelFontSize} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Footer Status Bar */}
      <footer className="relative z-10 flex items-center justify-between gap-2 border-t border-purple-900/40 pt-2 shrink-0 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>LIVE AUDIENCE BROADCAST • {isConnected ? 'SYNCHRONIZED' : 'CONNECTING'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>PRESS [F] FULLSCREEN</span>
          <span>•</span>
          <span>PRESS [ESC] EXIT DISPLAY</span>
        </div>
      </footer>

      {/* Secure Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto">
              <LogOut className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white font-['Outfit']">
                Exit Projector Display Mode?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                This will close the full-screen projector view and return to the Organizer Management Dashboard.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Cancel (Stay in Projector)
              </button>
              <button
                onClick={() => {
                  setShowExitModal(false);
                  setCurrentPage('dashboard');
                }}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/60 transition-all"
              >
                Yes, Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
