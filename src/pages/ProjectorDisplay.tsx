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
import { SpinRevealCardModal } from '../components/common/SpinRevealCardModal';
import type { Topic } from '../types';

export const ProjectorDisplay: React.FC = () => {
  const {
    db,
    allStations,
    isConnected,
    isFullscreen,
    toggleFullscreen,
    setCurrentPage,
    soundUnlocked,
    unlockSound,
    uploadInspireLogo,
  } = useApp();

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

  // Multi-station / location selection with URL param and localStorage persistence
  const initialStation = useMemo(() => {
    const urlVal = new URLSearchParams(window.location.search).get('station');
    if (urlVal) return urlVal;
    return localStorage.getItem('projector_assigned_station') || (allStations[0]?.id || 'station-a');
  }, [allStations]);

  const [selectedStationId, setSelectedStationId] = useState<string>(initialStation);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  const handleStationSelect = (stationId: string) => {
    setSelectedStationId(stationId);
    localStorage.setItem('projector_assigned_station', stationId);
  };

  // Read current live state and station-specific state
  const live = db?.liveSync;
  const currentStationState = selectedStationId !== 'all' && db?.stations ? db.stations[selectedStationId] : null;

  // Find active participant for this station or fallback to global live event
  const activeParticipant = useMemo(() => {
    if (currentStationState?.activeParticipant) {
      return currentStationState.activeParticipant;
    }
    if (currentStationState?.activeParticipantId && db?.participants) {
      const match = db.participants.find((p) => p.id === currentStationState.activeParticipantId);
      if (match) return match;
    }
    if (!live?.activeParticipantId || !db?.participants) return null;
    return db.participants.find((p) => p.id === live.activeParticipantId) || null;
  }, [currentStationState, live?.activeParticipantId, db?.participants]);

  const eventName = db?.settings.event.name || 'MIND TO MIC';
  const tagline = db?.settings.event.tagline || 'THINK. SPEAK. EXPRESS.';
  const currentRound = currentStationState?.currentRound || live?.currentRound || 1;

  // Determine active displayed item (image or topic) from station or liveSync
  const activeItem = useMemo(() => {
    if (currentStationState) {
      if (currentRound === 1 && currentStationState.selectedImage) {
        const imageId = currentStationState.selectedImage.imageId || currentStationState.selectedImage.name;
        return {
          type: 'image' as const,
          title: `IMAGE ID: ${imageId}`,
          mediaUrl: currentStationState.selectedImage.url,
          id: currentStationState.selectedImage.id,
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
    }
    return live?.activeItem;
  }, [currentStationState, currentRound, live?.activeItem]);

  // Real-time Timer Interpolation using shared backend timestamps (zero-drift, clock-synced)
  const [nowMs, setNowMs] = useState<number>(() => getServerNow());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(getServerNow());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const stationOrLive = currentStationState || live;
  const computedTimer = useMemo(() => {
    return computeStationTimer(stationOrLive, nowMs);
  }, [stationOrLive, nowMs]);

  const timerMode = computedTimer.phase;
  const isTimerRunning = computedTimer.isRunning;
  const remainingSeconds = computedTimer.remainingSeconds;
  const isOvertime = computedTimer.isOvertime;
  const overtimeSeconds = computedTimer.overtimeSeconds;
  const progressPercent = computedTimer.progressPercent;
  const isWarning = remainingSeconds <= 10 && remainingSeconds > 0 && isTimerRunning && !isOvertime;
  const isTimeUp = isOvertime || timerMode === 'time_up' || computedTimer.status === 'time_up';

  // Round 2 Wheel Animation in Projector View
  const [wheelAngle, setWheelAngle] = useState(0);
  const [isProjectorWheelSpinning, setIsProjectorWheelSpinning] = useState(false);
  const [projectorWinningTopic, setProjectorWinningTopic] = useState<Topic | null>(null);
  const [projectorWheelTopics, setProjectorWheelTopics] = useState<Topic[]>([]);
  const lastSpinStartedAtRef = useRef<number>(0);
  const spinAnimFrameRef = useRef<number | null>(null);

  // Image rotation state (0, 90, 180, 270 degrees)
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Reset rotation when image changes
  useEffect(() => {
    setImageRotation(0);
  }, [activeItem?.id]);

  // Combined rotation between local state and stage live sync rotation
  const totalRotation = ((imageRotation + (activeItem?.rotation || 0)) % 360 + 360) % 360;

  const handleRotateImage = useCallback(() => {
    setImageRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleResetImageRotation = useCallback(() => {
    setImageRotation(0);
  }, []);

  // Reset winning topic when station resets or active participant changes
  useEffect(() => {
    if (!currentStationState?.selectedTopicId) {
      setProjectorWinningTopic(null);
      setProjectorWheelTopics([]);
    }
  }, [activeParticipant?.id, currentRound, currentStationState?.selectedTopicId]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (spinAnimFrameRef.current) {
        cancelAnimationFrame(spinAnimFrameRef.current);
      }
    };
  }, []);

  // Large responsive wheel size for projector display (centered and big)
  const [wheelSize, setWheelSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight < 800 ? 520 : 640;
    }
    return 600;
  });

  useEffect(() => {
    const updateSize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      const availableH = h - 200;
      const availableW = w - 60;
      const calculated = Math.min(availableW, availableH);
      setWheelSize(Math.max(440, Math.min(700, calculated)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Default active topics if no wheelTopics supplied
  const defaultWheelTopics = useMemo(() => {
    if (!db?.topics) return [];
    const count = db.settings.round2.activeWheelTopicCount || 20;
    const available = db.topics.filter((t) => t.status === 'available');
    return (available.length > 0 ? available : db.topics).slice(0, count);
  }, [db?.topics, db?.settings.round2.activeWheelTopicCount]);

  // The topics currently rendered on the projector wheel
  const activeTopics = useMemo(() => {
    if (projectorWheelTopics.length > 0) return projectorWheelTopics;
    return defaultWheelTopics;
  }, [projectorWheelTopics, defaultWheelTopics]);

  // Watch for wheel spin events (from station or global)
  useEffect(() => {
    const wheelSpin = currentStationState?.wheelSpin || live?.wheelSpin;
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
        topicsForSpin = [...defaultWheelTopics];
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
    live?.wheelSpin,
    activeTopics,
    defaultWheelTopics,
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

  // Track whether any spin is currently active (locally or on station/liveSync)
  const isSpinActive = Boolean(
    isProjectorWheelSpinning ||
    currentStationState?.status === 'SPINNING' ||
    currentStationState?.wheelSpin?.isSpinning ||
    live?.wheelSpin?.isSpinning
  );

  // Current Round 2 topic to display on projector:
  // Strictly hidden until wheel spin is fully finished!
  const currentRoundTopic = useMemo(() => {
    if (isSpinActive) return null;
    if (projectorWinningTopic) {
      return {
        title: projectorWinningTopic.topic,
        category: projectorWinningTopic.category,
      };
    }
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
      activeItem?.type === 'topic' &&
      activeItem.title &&
      currentStationState?.status !== 'WAITING' &&
      currentStationState?.status !== 'SPINNING'
    ) {
      return { title: activeItem.title, category: activeItem.category };
    }
    return null;
  }, [
    isSpinActive,
    projectorWinningTopic,
    currentStationState?.selectedTopic,
    currentStationState?.status,
    activeItem,
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden select-none font-['Outfit']">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Bar: Event Branding, Top-Center Inspire 2K26 Logo, Station Selector, Connection & Exit */}
      <header className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        {/* Left: Event Logo & Name */}
        <div className="flex items-center gap-3.5 flex-1 min-w-[260px] w-full lg:w-auto justify-start">
          <MindToMicLogo size={56} className="drop-shadow-[0_0_20px_rgba(168,85,247,0.4)] shrink-0 transition-transform hover:scale-105" />
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-['Outfit'] drop-shadow-md leading-tight">
              {eventName}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-blue-300 font-mono">
              {tagline}
            </p>
            {/* Station / Room Selector */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  id="projector-station-select"
                  value={selectedStationId}
                  onChange={(e) => handleStationSelect(e.target.value)}
                  className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-900 text-white">All Stations (Global)</option>
                  {allStations.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name} (Round {s.currentRound})
                    </option>
                  ))}
                </select>
              </div>

              {/* Station Handler Indicator */}
              {currentStationState?.handlerName && (
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-800/50 text-xs text-purple-200 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStationState.handlerStatus === 'on_break' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-slate-400 text-[10px] uppercase font-bold">{currentStationState.handlerRole || 'Handler'}:</span>
                  <span className="font-semibold text-white">{currentStationState.handlerName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TOP CENTER: Inspire 2K26 Logo & Active Round Indicator */}
        <div className="flex flex-col items-center justify-center text-center shrink-0 px-2 py-0.5 group/center">
          <div className="relative group/logo transition-transform duration-300 hover:scale-105">
            <InspireLogo size={92} showGlow={true} />
            <input
              type="file"
              ref={inspireFileInputRef}
              onChange={handleInspireQuickUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => inspireFileInputRef.current?.click()}
              className="absolute -top-1.5 -right-2 p-1.5 rounded-full bg-slate-900/90 hover:bg-amber-600 text-slate-300 hover:text-white border border-amber-500/40 opacity-0 group-hover/logo:opacity-100 transition-all shadow-lg backdrop-blur-md cursor-pointer"
              title="Replace / Upload Exact Logo File"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Arcade Illuminated Round Marquee Banner */}
          <div className="mt-2 flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-950/70 via-purple-950/90 to-amber-950/70 border border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.25)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-300 font-['Outfit']">
              {currentRound === 1 && 'ROUND 1 • IMAGE TO SPEECH'}
              {currentRound === 2 && 'ROUND 2 • SPIN THE TOPIC WHEEL'}
              {currentRound === 3 && 'ROUND 3 • CHAMPIONSHIP FINALS'}
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0 hidden sm:inline" />
          </div>
        </div>

        {/* Right: Station Selector, Audio, Fullscreen & Exit */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1 min-w-[260px] w-full lg:w-auto">
          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
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
            <span className="hidden md:inline">{isConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
          </div>

          {/* Top-Right Corner Small Clock for Round 1 & Round 2 */}
          {currentRound !== 3 && (
            <div
              id="projector-corner-clock"
              className={`flex items-center gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${
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
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${isOvertime ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-purple-400'}`} />
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">
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
                <div className="w-16 sm:w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden p-0.5 border border-slate-800 mt-1">
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
                className={`font-mono text-2xl sm:text-3xl font-black tracking-tight leading-none pl-1 ${
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
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
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
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Dedicated Secure Exit Button */}
          <button
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold transition-all shadow-md shadow-rose-950/50"
            title="Exit Projector Display Mode (Esc)"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Center Stage Area */}
      <main className="relative z-10 my-auto py-2 max-w-7xl mx-auto w-full flex flex-col items-center justify-center text-center space-y-4">
        {/* Active Contestant Spotlight Banner */}
        {activeParticipant ? (
          <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-500">
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-purple-400 font-mono bg-purple-950/60 px-3 py-1 rounded-full border border-purple-800/60">
              CONTESTANT {activeParticipant.participantNumber} • ON STAGE
            </span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white font-['Outfit'] tracking-tight drop-shadow-2xl">
              {activeParticipant.name}
            </h2>
          </div>
        ) : (
          <div className="text-slate-400 font-semibold text-base sm:text-lg flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
            <span>Awaiting Next Contestant...</span>
          </div>
        )}

        {/* Big Live Synchronized Timer Display (PRESERVED UNTOUCHED FOR ROUND 3 ONLY) */}
        {currentRound === 3 && (
          <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-md border border-purple-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            {/* Phase Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-400">
                  {isOvertime
                    ? 'OVERTIME (LIMIT REACHED)'
                    : timerMode === 'prep'
                    ? 'PREPARATION TIME'
                    : timerMode === 'speech'
                    ? 'SPEAKING TIME'
                    : timerMode === 'stopped'
                    ? 'TIMER PAUSED / STOPPED'
                    : timerMode === 'time_up'
                    ? "TIME'S UP"
                    : 'STAGE TIMER'}
                </span>
              </div>

              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
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
              className={`font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tight transition-colors duration-200 ${
                isOvertime
                  ? 'text-rose-400 animate-pulse drop-shadow-[0_0_45px_rgba(244,63,94,0.7)]'
                  : isTimeUp
                  ? 'text-rose-500 animate-pulse drop-shadow-[0_0_40px_rgba(244,63,94,0.6)]'
                  : isWarning
                  ? 'text-amber-400 animate-pulse drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]'
                  : timerMode === 'speech'
                  ? 'text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                  : timerMode === 'prep'
                  ? 'text-blue-400 drop-shadow-[0_0_30px_rgba(96,165,250,0.3)]'
                  : 'text-white'
              }`}
            >
              {isOvertime ? computedTimer.formattedOvertime : formatTime(remainingSeconds)}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
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
              <div className="py-2.5 px-6 rounded-2xl bg-rose-600/30 border border-rose-500/60 text-rose-200 font-bold text-sm sm:text-base animate-pulse flex items-center justify-center gap-2">
                <span>⚠️</span>
                <span>SPEAKING LIMIT REACHED • OVERTIME ({computedTimer.formattedOvertime})</span>
              </div>
            ) : isTimeUp ? (
              <div className="py-2.5 px-6 rounded-2xl bg-rose-600/30 border border-rose-500/60 text-rose-300 font-bold text-sm sm:text-base animate-bounce">
                ⚠️ TIME EXPIRED • BUZZER ACTIVE
              </div>
            ) : null}
          </div>
        )}

        {/* Dynamic Round Prompt Content Display */}
        {/* Round 1: Assigned Image or Awaiting Card (Center & Big) */}
        {currentRound === 1 && (
          activeItem?.type === 'image' && activeItem.mediaUrl ? (
            <div className="w-full max-w-6xl xl:max-w-7xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 my-auto">
              <div className="w-full rounded-3xl overflow-hidden border-2 border-purple-500/50 shadow-[0_0_90px_rgba(168,85,247,0.4)] bg-slate-950 relative group flex flex-col items-center justify-center">
                {/* Floating quick rotation control button in top-right */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                  <button
                    id="projector-quick-rotate-top-btn"
                    onClick={handleRotateImage}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950/85 hover:bg-purple-950/95 text-purple-200 border border-purple-500/50 hover:border-purple-400 text-xs font-bold transition-all shadow-xl backdrop-blur-md active:scale-95 cursor-pointer"
                    title="Rotate image 90° clockwise (Shortcut: R)"
                  >
                    <RotateCw className="w-4 h-4 text-purple-400" />
                    <span>Rotate {totalRotation !== 0 ? `(${totalRotation}°)` : ''}</span>
                  </button>
                  {totalRotation !== 0 && (
                    <button
                      id="projector-quick-reset-top-btn"
                      onClick={handleResetImageRotation}
                      className="px-2.5 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500 text-xs font-semibold transition-all backdrop-blur-md cursor-pointer"
                      title="Reset rotation to 0°"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Main Big Image Viewport */}
                <div className="w-full max-h-[66vh] sm:max-h-[72vh] xl:max-h-[75vh] min-h-[40vh] flex items-center justify-center bg-black/60 overflow-hidden p-2 sm:p-3 relative">
                  <img
                    src={activeItem.mediaUrl}
                    alt={activeItem.title}
                    style={{
                      transform: `rotate(${totalRotation}deg)`,
                      transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      maxHeight: totalRotation % 180 !== 0 ? '58vw' : '70vh',
                      maxWidth: totalRotation % 180 !== 0 ? '60vh' : '100%',
                    }}
                    className="w-auto h-auto object-contain transition-transform duration-500 rounded-2xl drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Prominent Image ID Bottom Bar */}
                <div className="w-full p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-950/60 border-t border-purple-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-widest hidden sm:inline">
                      PROMPT:
                    </span>
                    <span className="px-3.5 py-1.5 rounded-xl bg-blue-950/90 border border-blue-500/60 font-mono font-black text-blue-300 text-base sm:text-xl tracking-wider shadow-lg">
                      {activeItem.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="projector-rotate-image-bottom-btn"
                      onClick={handleRotateImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                      title="Rotate image 90° clockwise (Shortcut: R)"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                      <span>Rotate {totalRotation !== 0 ? `${totalRotation}°` : '90°'}</span>
                    </button>
                    {totalRotation !== 0 && (
                      <button
                        id="projector-reset-image-bottom-btn"
                        onClick={handleResetImageRotation}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                        title="Reset rotation to 0°"
                      >
                        Reset
                      </button>
                    )}
                    <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 hidden sm:inline-block">
                      VISUAL PROMPT
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl p-10 sm:p-14 rounded-3xl bg-slate-900/60 border border-purple-900/30 text-slate-300 flex flex-col items-center space-y-4 animate-in fade-in my-auto">
              <Sparkles className="w-14 h-14 text-purple-400 animate-pulse" />
              <div className="space-y-2 text-center">
                <h4 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">ROUND 1 • IMAGE TO SPEECH</h4>
                <p className="text-sm sm:text-base text-slate-400">
                  Awaiting random image prompt assignment from operator station
                </p>
              </div>
            </div>
          )
        )}

        {/* Round 2: Wheel Spinning Animation, Selected Topic with Rotating Pop-Out, or Wheel Standby */}
        {currentRound === 2 && (
          <div className="w-full max-w-6xl flex flex-col items-center justify-center my-auto relative">
            {isProjectorWheelSpinning ? (
              <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-300">
                <span className="text-sm sm:text-base font-bold uppercase tracking-widest text-amber-400 animate-pulse flex items-center gap-2">
                  <Disc className="w-5 h-5 animate-spin" />
                  WHEEL IS SPINNING...
                </span>
                <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} />
              </div>
            ) : currentRoundTopic ? (
              <div className="relative w-full flex flex-col items-center justify-center min-h-[480px]">
                {/* Background Wheel: Centered and slightly scaled/blurred to provide depth */}
                <div className="transition-all duration-700 scale-90 opacity-25 blur-[1px]">
                  <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} />
                </div>

                {/* Animated Topic: Bursts OUT from the wheel in a high-energy rotating motion */}
                <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
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
                    className="w-full max-w-3xl p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-purple-950/95 via-slate-900/98 to-indigo-950/95 border-2 border-purple-400 shadow-[0_0_100px_rgba(168,85,247,0.5)] backdrop-blur-xl space-y-6 text-center relative overflow-hidden"
                  >
                    {/* Pulsing neon radial aura */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 rounded-3xl blur-2xl opacity-40 -z-10 animate-pulse" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-mono font-black uppercase tracking-widest text-amber-400 bg-amber-950/70 border border-amber-500/50 px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        SELECTED SPEECH THEME
                      </span>
                      {currentRoundTopic.category && (
                        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-purple-900/80 text-purple-200 border border-purple-500/50 shadow">
                          {currentRoundTopic.category}
                        </span>
                      )}
                    </div>

                    <h3 className="text-3xl sm:text-5xl md:text-6xl font-black text-white font-['Outfit'] leading-tight drop-shadow-2xl">
                      "{currentRoundTopic.title}"
                    </h3>

                    <div className="pt-2 flex items-center justify-center gap-2 text-xs font-mono text-emerald-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Ready for Speech • Topic Replaced on Wheel</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 animate-in fade-in">
                <span className="text-xs sm:text-sm font-mono font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  TOPIC WHEEL • READY TO SPIN
                </span>
                <WheelCanvas topics={activeTopics} rotationAngle={wheelAngle} size={wheelSize} />
              </div>
            )}
          </div>
        )}

        {/* Round 3: Championship Finals Grand Stage */}
        {currentRound === 3 && (
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border-2 border-emerald-500/40 shadow-2xl space-y-4 max-w-3xl animate-in zoom-in-95 duration-500">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              FINALS ARENA
            </span>
            <h3 className="text-3xl sm:text-5xl font-black text-white font-['Outfit']">
              {activeItem?.title && activeItem.title !== 'Championship Finals Speech'
                ? activeItem.title
                : 'Championship Grand Finals'}
            </h3>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
              Unrehearsed speaking championship. Think clearly, speak boldly, and express with conviction.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Footer Status Bar */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-purple-900/40 pt-5 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>LIVE AUDIENCE BROADCAST • {isConnected ? 'SYNCHRONIZED' : 'CONNECTING'}</span>
        </div>
        <div className="flex items-center gap-4">
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
