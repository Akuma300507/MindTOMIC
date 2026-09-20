import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Disc,
  Play,
  RotateCw,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Volume2,
  AlertCircle,
  Award,
  Users,
  Bell,
  Plus,
  Minus,
  Lock,
  Shuffle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Timer, TimerPhase } from '../components/common/Timer';
import { WheelCanvas } from '../components/common/WheelCanvas';
import { soundEngine } from '../lib/audio';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { MindToMicLogo } from '../components/common/MindToMicLogo';
import { SpinRevealCardModal } from '../components/common/SpinRevealCardModal';
import { ParticipantSearchInput } from '../components/common/ParticipantSearchInput';
import {
  isParticipantCheckedIn,
  isParticipantRoundCompleted,
  type Topic,
  type Round2Result,
  type Participant,
} from '../types';

export const Round2: React.FC = () => {
  const {
    db,
    activeParticipant,
    setActiveParticipant,
    selectNextParticipant,
    saveRound2Result,
    spinStationTopic,
    completeStationSpin,
    replaceStationWheelTopic,
    resetTopicsStatus,
    unlockSound,
    currentStationId,
    setCurrentStationId,
    currentStation,
    allStations,
    setCurrentPage,
    updateSettings,
    setStationParticipant,
    currentEventRound,
    round2PermissionGranted,
    getGlobalRoundProgress,
    getStationRoundProgress,
  } = useApp();

  // Wheel topic font size adjustment state (synced with settings and localStorage)
  const initialWheelFontSize = useMemo(() => {
    if (typeof db?.settings?.round2?.wheelFontSize === 'number') {
      return db?.settings?.round2?.wheelFontSize;
    }
    const saved = localStorage.getItem('m2m_wheel_font_size');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 7 && num <= 24) return num;
    }
    return undefined;
  }, [db?.settings?.round2?.wheelFontSize]);

  const [wheelFontSize, setWheelFontSize] = useState<number | undefined>(initialWheelFontSize);

  useEffect(() => {
    if (typeof db?.settings?.round2?.wheelFontSize === 'number') {
      setWheelFontSize(db?.settings?.round2?.wheelFontSize);
    }
  }, [db?.settings?.round2?.wheelFontSize]);

  const handleWheelFontChange = useCallback(async (delta: number) => {
    let nextSize: number | undefined;
    if (delta === 0) {
      nextSize = undefined;
      localStorage.removeItem('m2m_wheel_font_size');
    } else {
      const current = wheelFontSize || 11;
      nextSize = Math.max(8, Math.min(22, current + delta));
      localStorage.setItem('m2m_wheel_font_size', String(nextSize));
    }
    setWheelFontSize(nextSize);

    if (updateSettings && db?.settings?.round2) {
      try {
        await updateSettings({
          round2: {
            ...db.settings.round2,
            wheelFontSize: nextSize,
          },
        });
      } catch (err) {
        console.error('Failed to sync wheel font size to settings:', err);
      }
    }
  }, [wheelFontSize, updateSettings, db?.settings?.round2]);

  // Round 1 qualification workflow:
  // Contestants who are qualified in Round 1 AND checked in advance to Round 2.
  // If no one is marked qualified yet, allow checked-in station participants so round can still be operated.
  const round1Qualifiers = useMemo(() => {
    return (db?.participants || []).filter((p) => p.round1Qualified === 'qualified' && isParticipantCheckedIn(p));
  }, [db?.participants]);

  const stationParticipants = useMemo(() => {
    if (!db?.participants) return [];
    const pool = db.participants.filter((p) => isParticipantCheckedIn(p));
    if (!currentStationId || currentStationId === 'all') return pool;
    return pool.filter((p) => p.stationId === currentStationId);
  }, [db?.participants, currentStationId]);

  const eligibleRound2Participants = useMemo(() => {
    return round1Qualifiers.length > 0 ? round1Qualifiers : stationParticipants;
  }, [round1Qualifiers, stationParticipants]);

  // Station-filtered eligible participants for Round 2
  const stationEligibleRound2Participants = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') {
      return eligibleRound2Participants;
    }
    const filtered = eligibleRound2Participants.filter((p) => p.stationId === currentStationId);
    return filtered.length > 0 ? filtered : eligibleRound2Participants;
  }, [eligibleRound2Participants, currentStationId]);

  // Completed participants in Round 2
  const completedRound2Participants = useMemo(() => {
    return stationEligibleRound2Participants.filter((p) => isParticipantRoundCompleted(p, 2, db));
  }, [stationEligibleRound2Participants, db]);

  // Pending (not completed) participants in Round 2
  const pendingRound2Participants = useMemo(() => {
    return stationEligibleRound2Participants.filter((p) => !isParticipantRoundCompleted(p, 2, db));
  }, [stationEligibleRound2Participants, db]);

  const isCurrentParticipantCompleted = Boolean(
    activeParticipant && isParticipantRoundCompleted(activeParticipant, 2, db)
  );

  const [contestantSearch, setContestantSearch] = useState('');

  // Filtered lists based on search query (by ID, #number, name, or phone)
  const filteredPendingParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return pendingRound2Participants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return pendingRound2Participants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [pendingRound2Participants, contestantSearch]);

  const filteredCompletedParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return completedRound2Participants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return completedRound2Participants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [completedRound2Participants, contestantSearch]);

  const lastStationIdRef = useRef<string | null>(currentStationId);
  const lastStationActiveParticipantIdRef = useRef<string | null | undefined>(
    currentStation?.activeParticipantId
  );

  const handleSelectContestant = useCallback(
    (p: Participant) => {
      lastStationActiveParticipantIdRef.current = p.id;
      setActiveParticipant(p);
      if (currentStationId && currentStationId !== 'all') {
        setStationParticipant(currentStationId, p.id);
      }
    },
    [currentStationId, setActiveParticipant, setStationParticipant]
  );

  // Keep activeParticipant synced strictly to current station's staged contestant
  useEffect(() => {
    if (currentStation?.activeParticipantId) {
      const staged = db?.participants?.find((p) => p.id === currentStation.activeParticipantId);
      if (staged) {
        lastStationActiveParticipantIdRef.current = staged.id;
        setActiveParticipant(staged);
        return;
      }
    } else {
      lastStationActiveParticipantIdRef.current = null;
      setActiveParticipant(null);
    }
  }, [currentStation?.activeParticipantId, db?.participants, setActiveParticipant]);

  // Wheel state
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningTopic, setWinningTopic] = useState<Topic | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0); // in radians
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [lastSavedResult, setLastSavedResult] = useState<Round2Result | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [lockedWheelTopics, setLockedWheelTopics] = useState<Topic[] | null>(null);

  // Station-filtered topic pool: includes universal topics (stationId empty or 'all') and topics assigned to current station.
  // Topics assigned to any other station are strictly excluded.
  const allTopicsPool = useMemo(() => (db?.topics || []).filter(Boolean), [db?.topics]);
  const stationTopicsPool = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') {
      return allTopicsPool;
    }
    return allTopicsPool.filter((t) => {
      if (!t.stationId || t.stationId === 'all') return true;
      return t.stationId === currentStationId;
    });
  }, [allTopicsPool, currentStationId]);

  const topicsPool = stationTopicsPool;
  const wheelCount = db?.settings?.round2?.activeWheelTopicCount ?? 20;
  const speechSeconds = db?.settings?.round2?.speechTimeSeconds ?? 120;
  const buzzerEnabled = db?.settings?.round2?.buzzerEnabled ?? true;
  const warningBuzzerEnabled = db?.settings?.round2?.warningBuzzerEnabled ?? true;
  const warningTimeSeconds = db?.settings?.round2?.warningTimeSeconds ?? 30;
  const reuseAllowed = db?.settings?.round2?.topicReuseAllowed ?? false;

  // Heat slot index within this station for Round 2:
  // Dynamically determined by turn order (number of completed Round 2 contestants at this station),
  // or the contestant's locked round2SlotIndex if already assigned/completed.
  const slotIndex = useMemo(() => {
    if (!activeParticipant) return 0;
    if (typeof activeParticipant.round2SlotIndex === 'number' && activeParticipant.round2SlotIndex >= 0) {
      return activeParticipant.round2SlotIndex;
    }
    const r2Result = db?.round2Results?.find((r) => r.participantId === activeParticipant.id);
    if (typeof r2Result?.slotIndex === 'number' && r2Result.slotIndex >= 0) {
      return r2Result.slotIndex;
    }
    return completedRound2Participants.length;
  }, [activeParticipant, db?.round2Results, completedRound2Participants.length]);

  // Sync winningTopic if currentStation already has a selectedTopic
  useEffect(() => {
    if (currentStation?.selectedTopic) {
      setWinningTopic(currentStation.selectedTopic);
    } else if (!currentStation?.selectedTopicId) {
      setWinningTopic(null);
    }
  }, [currentStation?.selectedTopicId, currentStation?.selectedTopic]);

  // When active participant changes, reset locked topics and winning topic if not matching
  const prevParticipantId = useRef<string | null>(null);
  useEffect(() => {
    if (activeParticipant?.id && activeParticipant.id !== prevParticipantId.current) {
      prevParticipantId.current = activeParticipant.id;
      setWinningTopic(currentStation?.selectedTopic || null);
      setLockedWheelTopics(null);
    }
  }, [activeParticipant?.id, currentStation?.selectedTopic]);

  const unusedCount = useMemo(() => topicsPool.filter((t) => t.status === 'available').length, [topicsPool]);
  const usedCount = topicsPool.length - unusedCount;

  // Compute active wheel topics when not locked - strictly available topics from station pool
  const dynamicWheelTopics = useMemo(() => {
    if (!topicsPool || topicsPool.length === 0) return [];

    const available = reuseAllowed
      ? [...topicsPool]
      : topicsPool.filter((t) => t && t.status === 'available');

    const result: Topic[] = [...available];

    if (result.length < wheelCount) {
      for (const t of topicsPool) {
        if (result.length >= wheelCount) break;
        if (!result.some((a) => a.id === t.id)) {
          result.push(t);
        }
      }
    }

    if (result.length < wheelCount && allTopicsPool && allTopicsPool.length > 0) {
      for (const t of allTopicsPool) {
        if (result.length >= wheelCount) break;
        if (!result.some((a) => a.id === t.id)) {
          result.push(t);
        }
      }
    }

    return result.filter(Boolean).slice(0, wheelCount);
  }, [topicsPool, allTopicsPool, wheelCount, reuseAllowed]);

  // Actual topics rendered on the wheel: locked takes priority during/after spin, then station state
  const activeWheelTopics = useMemo(() => {
    if (lockedWheelTopics && lockedWheelTopics.length > 0) return lockedWheelTopics.filter(Boolean);
    if (currentStation?.activeWheelTopics && currentStation.activeWheelTopics.length > 0) {
      return currentStation.activeWheelTopics.filter(Boolean);
    }
    return (dynamicWheelTopics || []).filter(Boolean);
  }, [lockedWheelTopics, currentStation?.activeWheelTopics, dynamicWheelTopics]);

  // Color palette for slices
  const sliceColors = useMemo(
    () => [
      '#6366f1', // indigo
      '#8b5cf6', // purple
      '#a855f7', // purple-500
      '#3b82f6', // blue
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#10b981', // emerald
      '#f59e0b', // amber
      '#14b8a6', // teal
      '#84cc16', // lime
    ],
    []
  );

  // Handle Spin Logic
  const handleSpin = async () => {
    if (isSpinning || activeWheelTopics.length === 0) return;
    unlockSound();
    setPoolNotice(null);

    // Clean wheel topics before spinning: replace any topic that is already used with a fresh unused topic from the station pool
    const pool = topicsPool.filter(Boolean);
    const cleanedWheel = activeWheelTopics.map((sliceTopic) => {
      if (!sliceTopic) return null;
      const dbTopic = pool.find((t) => t?.id === sliceTopic.id);
      const isUsed = sliceTopic.status === 'used' || (!reuseAllowed && dbTopic?.status === 'used');
      if (isUsed) {
        const unused = pool.find((p) => p && p.status === 'available' && !activeWheelTopics.some((w) => w?.id === p.id));
        return unused || sliceTopic;
      }
      return sliceTopic;
    }).filter(Boolean) as Topic[];

    // Freeze current wheel topics before initiating spin
    let currentWheel = cleanedWheel.length > 0 ? [...cleanedWheel] : [...activeWheelTopics];
    if (currentWheel.length === 0 && pool.length > 0) {
      currentWheel = pool.slice(0, wheelCount);
    }
    setLockedWheelTopics(currentWheel);
    setIsSpinning(true);
    setWinningTopic(null);

    let chosenTopic: Topic;
    let targetIndex = 0;
    try {
      const wheelTopicIds = currentWheel.map((t) => t?.id).filter(Boolean) as string[];
      const res = await spinStationTopic(currentStationId, wheelTopicIds, slotIndex);
      chosenTopic = res.topic;
      if (res.wheelTopics && res.wheelTopics.length > 0) {
        currentWheel = res.wheelTopics.filter(Boolean);
        setLockedWheelTopics(currentWheel);
      }
      if (typeof res.targetIndex === 'number' && res.targetIndex >= 0) {
        targetIndex = res.targetIndex;
      } else {
        targetIndex = currentWheel.findIndex((t) => t?.id === chosenTopic?.id);
      }
    } catch (err: any) {
      setIsSpinning(false);
      setLockedWheelTopics(null);
      setPoolNotice(err.message || 'No unused topics remaining. Please reset topic pool or allow reuse.');
      return;
    }

    // Verify chosenTopic is positioned in currentWheel
    if (targetIndex === -1 && chosenTopic) {
      currentWheel[0] = chosenTopic;
      targetIndex = 0;
      setLockedWheelTopics([...currentWheel]);
    }

    const totalSlices = currentWheel.length;
    const sliceAngle = (2 * Math.PI) / totalSlices;
    const POINTER_ANGLE = 1.5 * Math.PI; // Top of the wheel (12 o'clock)
    const TWO_PI = 2 * Math.PI;

    // Angle of slice center relative to wheel rotation
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;

    // Target rotation angle so targetSliceCenter aligns with POINTER_ANGLE
    const targetNormalized = ((POINTER_ANGLE - targetSliceCenter) % TWO_PI + TWO_PI) % TWO_PI;
    const currentNormalized = ((rotationAngle % TWO_PI) + TWO_PI) % TWO_PI;

    let angleDiff = targetNormalized - currentNormalized;
    if (angleDiff <= 0.05) {
      angleDiff += TWO_PI;
    }

    const extraRotations = 6;
    const desiredFinalAngle = rotationAngle + extraRotations * TWO_PI + angleDiff;
    const startAngle = rotationAngle;
    const distance = desiredFinalAngle - startAngle;
    const duration = 4800; // ms
    const startTime = performance.now();

    let lastTickSlice = -1;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out cubic deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startAngle + distance * easeOut;

      setRotationAngle(current);

      // Synthesize tick sound when passing a slice boundary under the top pointer
      const angleUnderPointer = ((POINTER_ANGLE - current) % TWO_PI + TWO_PI) % TWO_PI;
      const currentSlice = Math.floor(angleUnderPointer / sliceAngle);
      if (currentSlice !== lastTickSlice) {
        lastTickSlice = currentSlice;
        soundEngine.playTick();
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        setRotationAngle(desiredFinalAngle);
        setIsSpinning(false);
        if (chosenTopic) {
          setWinningTopic(chosenTopic);
          setShowRevealModal(true);
        }
        soundEngine.playChime(); // celebration chime

        try {
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#a855f7', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
          });
        } catch {}

        // Keep currentWheel as locked topics during reveal so slice matches chosenTopic exactly
        setLockedWheelTopics(currentWheel);

        // Inform backend spin completed for this station
        if (currentStationId) {
          completeStationSpin(currentStationId).catch(() => {});
        }
      }
    };

    requestAnimationFrame(animateSpin);
  };

  // Replace used topic on wheel with next unused topic from station pool
  const handleReplaceUsedTopic = useCallback(() => {
    if (!winningTopic) return;
    const pool = topicsPool.filter(Boolean);
    const currentWheel = (lockedWheelTopics || activeWheelTopics || []).filter(Boolean);
    const winningId = winningTopic?.id;
    if (!winningId) return;

    const remainingUnused = pool.filter(
      (t) => t && t.status === 'available' && t.id !== winningId && !currentWheel.some((cw) => cw?.id === t.id)
    );
    if (remainingUnused.length > 0 && currentWheel.some((t) => t?.id === winningId)) {
      const nextTopic = remainingUnused[0];
      const updated = currentWheel.map((t) => (t?.id === winningId ? nextTopic : t));
      setLockedWheelTopics(updated);
      if (currentStationId && nextTopic?.id) {
        replaceStationWheelTopic(currentStationId, winningId, nextTopic.id).catch(() => {});
      }
    }
  }, [winningTopic, db?.topics, topicsPool, lockedWheelTopics, activeWheelTopics, currentStationId, replaceStationWheelTopic]);

  // Callback when timer completes
  const handleTimerFinish = useCallback(
    async (data: {
      status: 'completed' | 'completed_early' | 'time_up';
      prepDurationSeconds: number;
      speechDurationSeconds: number;
      startTime: string;
      endTime: string;
    }) => {
      if (!activeParticipant || !winningTopic) return;

      const currentTopicId = winningTopic.topicId || winningTopic.id || 'topic';

      const resultPayload = {
        participantId: activeParticipant.id,
        participantNumber: activeParticipant.participantNumber,
        participantName: activeParticipant.name,
        mobile: activeParticipant.mobile || activeParticipant.phone || activeParticipant.customData?.phone || '',
        topicId: currentTopicId,
        topic: winningTopic.topic || 'Selected Topic',
        topicText: winningTopic.topic || 'Selected Topic',
        prepDurationSeconds: 0,
        speechDurationSeconds: data.speechDurationSeconds,
        targetSpeechDurationSeconds: speechSeconds,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        slotIndex: slotIndex,
      };

      const saved = await saveRound2Result(resultPayload);
      setLastSavedResult(saved);
      // Retain the current participant and winning topic on screen after stopping the timer.
      // Do NOT auto-advance; the operator will explicitly pick the next contestant when ready.

      // Topic has now been used for speech; replace it on the wheel with the next unused topic
      const pool = (db?.topics || topicsPool || []).filter(Boolean);
      const currentWheel = (activeWheelTopics || []).filter(Boolean);
      const winningId = winningTopic?.id;
      if (winningId) {
        const remainingUnused = pool.filter(
          (t) => t && t.status === 'available' && t.id !== winningId && !currentWheel.some((cw) => cw?.id === t.id)
        );
        if (remainingUnused.length > 0 && currentWheel.some((t) => t?.id === winningId)) {
          const updated = currentWheel.map((t) => (t?.id === winningId ? remainingUnused[0] : t));
          setLockedWheelTopics(updated);
        }
      }
    },
    [
      activeParticipant,
      winningTopic,
      speechSeconds,
      saveRound2Result,
      db?.topics,
      topicsPool,
      activeWheelTopics,
      currentStationId,
      pendingRound2Participants,
      setStationParticipant,
      setActiveParticipant,
    ]
  );

  if (currentEventRound < 2 || !round2PermissionGranted) {
    const round1Global = getGlobalRoundProgress(1);
    const r1Pct = round1Global.arrivedCount > 0 ? Math.round((round1Global.completed / round1Global.arrivedCount) * 100) : 0;

    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="bg-slate-900/90 border border-purple-800/40 rounded-3xl p-8 md:p-12 text-center shadow-2xl backdrop-blur-md space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-950/40">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Stage Locked — Awaiting Master Permission
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white font-['Outfit']">
              Round 2 Pending Master Authorization
            </h1>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              Round 1 is concluding across stations. Master Supervisor must grant permission to authorize Round 2 before operators can start.
            </p>
          </div>

          {/* Round 1 Global Progress Bar */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Round 1 Present Contestants Progress</span>
              <span className="text-white font-mono font-bold">
                {round1Global.completed} / {round1Global.arrivedCount} ({r1Pct}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
                style={{ width: `${r1Pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>
                {round1Global.remaining === 0
                  ? 'All present contestants done! Awaiting Master permission.'
                  : `${round1Global.remaining} arrived contestants still speaking`}
                {round1Global.absentCount > 0 && ` (${round1Global.absentCount} absent / no-show)`}
              </span>
              <span className="text-purple-300 font-mono">Round 1</span>
            </div>
          </div>

          {/* Per Station Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
            {allStations.map((st) => {
              const prog = getStationRoundProgress(st.id, 1);
              return (
                <div key={st.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white truncate">{st.name || 'Station'}</span>
                  {prog.isComplete && prog.arrivedCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Finished ({prog.completed}/{prog.arrivedCount})
                    </span>
                  ) : prog.arrivedCount === 0 ? (
                    <span className="text-slate-500 text-[11px]">0 Arrived</span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">
                      {prog.completed}/{prog.arrivedCount} Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Navigation */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage('round1')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-purple-950/80 flex items-center gap-2 transition-all hover:scale-105"
            >
              <span>Return to Round 1 Stage</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage('master')}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Open Master Monitor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Event Round Concluded Notice */}
      {currentEventRound > 2 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white text-sm block">Round 2 (Arcade Wheel) has concluded</span>
              <span className="text-xs text-indigo-300">The entire competition has progressed to Round 3 (The Mystery Cartridge).</span>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('round3')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shrink-0 transition-colors"
          >
            <span>Go to Finals (Round 3)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Station Finished Round 2 Waiting State */}
      {(() => {
        const r2StationProg = currentStationId && currentStationId !== 'all' ? getStationRoundProgress(currentStationId, 2) : null;
        if (currentEventRound === 2 && r2StationProg && r2StationProg.isComplete && r2StationProg.total > 0) {
          return (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-white text-sm block">
                    Stage Round 2 Completed ({r2StationProg.completed}/{r2StationProg.total} Contestants)
                  </span>
                  <span className="text-xs text-emerald-300/90">
                    All qualified contestants for this station have finished Round 2. Please wait for other stations before Championship Finals start.
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-[11px] font-bold text-emerald-200 shrink-0 self-start sm:self-center">
                Waiting for All Stations
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-purple-900/30 p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-12 px-2 rounded-xl bg-slate-950 border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-950/60">
            <MindToMicLogo size={32} variant="emblem" showGlow={false} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800">
                ROUND 2
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">Arcade Wheel</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeWheelTopics.length} Wheel Topics • Immediate Speech: {speechSeconds}s (No Prep) • Buzzer: {buzzerEnabled ? 'ON' : 'OFF'}
            </p>
          </div>
        </div>

        {/* Station & Contestant Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">Station:</span>
            <select
              value={currentStationId || ''}
              onChange={(e) => setCurrentStationId(e.target.value)}
              className="bg-transparent text-purple-300 font-semibold focus:outline-none"
            >
              {allStations.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} (Round {s.currentRound})
                </option>
              ))}
              <option value="all" className="bg-slate-900 text-purple-300 font-bold">
                All Stations (View All)
              </option>
            </select>
          </div>

          {/* Active / Pending Contestants Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Contestant:
            </span>
            <select
              value={activeParticipant?.id || ''}
              onChange={(e) => {
                const targetId = e.target.value;
                if (!targetId) return;
                if (targetId === activeParticipant?.id) {
                  if (currentStationId && currentStationId !== 'all' && currentStation?.activeParticipantId !== targetId) {
                    setStationParticipant(currentStationId, targetId);
                  }
                  return;
                }
                const p =
                  filteredPendingParticipants.find((item) => item.id === targetId) ||
                  pendingRound2Participants.find((item) => item.id === targetId) ||
                  stationEligibleRound2Participants.find((item) => item.id === targetId) ||
                  db?.participants.find((item) => item.id === targetId);
                if (p) {
                  handleSelectContestant(p);
                }
              }}
              className="bg-transparent text-white font-bold font-['Outfit'] focus:outline-none max-w-[210px] truncate cursor-pointer"
            >
              {/* Ensure an option matching value={activeParticipant.id} always exists */}
              {activeParticipant && !filteredPendingParticipants.some((p) => p.id === activeParticipant.id) && (
                <option value={activeParticipant.id} className="bg-slate-900 text-purple-300 font-bold">
                  #{activeParticipant.participantNumber} — {activeParticipant.name} {isCurrentParticipantCompleted ? '(Completed) ✓' : ''}
                </option>
              )}
              {filteredPendingParticipants.length > 0 && (!activeParticipant || isCurrentParticipantCompleted) && (
                <option value="" disabled className="bg-slate-950 text-slate-500">
                  ── Select Next Contestant ({filteredPendingParticipants.length} remaining) ──
                </option>
              )}
              {filteredPendingParticipants.length === 0 && !activeParticipant && (
                <option value="" disabled className="bg-slate-900 text-amber-400">
                  {contestantSearch.trim()
                    ? `No checked-in contestants match "${contestantSearch}"`
                    : completedRound2Participants.length > 0
                    ? `All eligible contestants completed (${completedRound2Participants.length})`
                    : `No checked-in eligible contestants in ${currentStation?.name || 'this station'}`}
                </option>
              )}
              {filteredPendingParticipants.map((p) => {
                const isR1Qual = p.round1Qualified === 'qualified';
                return (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    #{p.participantNumber} — {p.name} {isR1Qual ? '★ [R1 QUALIFIED]' : ''}
                  </option>
                );
              })}
            </select>

            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                pendingRound2Participants.length > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {pendingRound2Participants.length} Available
            </span>

            {activeParticipant && (
              <span
                className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                  isCurrentParticipantCompleted
                    ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                    : 'border-purple-500/40 bg-purple-950/60 text-purple-300'
                }`}
                title={isCurrentParticipantCompleted ? `Heat #${slotIndex + 1} Completed` : 'Synchronized Heat Slot across all stations'}
              >
                {isCurrentParticipantCompleted ? `✓ Done (Heat #${slotIndex + 1})` : `Heat #${slotIndex + 1}`}
              </span>
            )}
          </div>

          {/* Completed Contestants Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Completed:
            </span>
            <select
              value={isCurrentParticipantCompleted ? activeParticipant?.id || '' : ''}
              onChange={(e) => {
                const targetId = e.target.value;
                if (!targetId || targetId === activeParticipant?.id) return;
                const p =
                  filteredCompletedParticipants.find((item) => item.id === targetId) ||
                  completedRound2Participants.find((item) => item.id === targetId) ||
                  db?.participants.find((item) => item.id === targetId);
                if (p) {
                  handleSelectContestant(p);
                }
              }}
              className="bg-transparent text-emerald-300 font-bold font-['Outfit'] focus:outline-none max-w-[200px] truncate cursor-pointer"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                {filteredCompletedParticipants.length === 0
                  ? contestantSearch.trim()
                    ? `No completed match "${contestantSearch}"`
                    : 'None completed (0)'
                  : `Completed (${completedRound2Participants.length})`}
              </option>
              {filteredCompletedParticipants.map((p) => {
                const compResult = db?.round2Results?.find((r) => r.participantId === p.id);
                const compHeat = typeof p.round2SlotIndex === 'number'
                  ? p.round2SlotIndex + 1
                  : typeof compResult?.slotIndex === 'number'
                  ? compResult.slotIndex + 1
                  : null;
                return (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-emerald-300">
                    #{p.participantNumber} — {p.name} {compHeat ? `(Heat #${compHeat})` : ''} ✓
                  </option>
                );
              })}
            </select>
            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${
                completedRound2Participants.length > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={`${completedRound2Participants.length} of ${stationEligibleRound2Participants.length} contestants completed Round 2`}
            >
              {completedRound2Participants.length} Done
            </span>
          </div>

          {/* Quick Search Contestant Pill */}
          <ParticipantSearchInput
            searchQuery={contestantSearch}
            onSearchChange={setContestantSearch}
            pendingParticipants={pendingRound2Participants}
            completedParticipants={completedRound2Participants}
            activeParticipantId={activeParticipant?.id}
            onSelectParticipant={handleSelectContestant}
            placeholder="Search #ID or name..."
          />

          {/* Pick Random Contestant Button */}
          <button
            onClick={() => {
              const pool = pendingRound2Participants.length > 0
                ? pendingRound2Participants
                : (stationEligibleRound2Participants.length > 0 ? stationEligibleRound2Participants : []);
              if (pool.length === 0) return;
              const unchosen = pool.filter((p) => p.id !== activeParticipant?.id);
              const candidates = unchosen.length > 0 ? unchosen : pool;
              const picked = candidates[Math.floor(Math.random() * candidates.length)];
              handleSelectContestant(picked);
            }}
            disabled={pendingRound2Participants.length === 0 && stationEligibleRound2Participants.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800/40 text-xs font-bold transition-all shadow-md disabled:opacity-40 cursor-pointer"
            title="Randomly choose a qualified contestant for this station"
          >
            <Shuffle className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Random</span>
          </button>

          <button
            onClick={() => {
              const list = pendingRound2Participants.length > 0
                ? pendingRound2Participants
                : (stationEligibleRound2Participants.length > 0 ? stationEligibleRound2Participants : undefined);
              selectNextParticipant(list);
            }}
            disabled={pendingRound2Participants.length === 0 && stationEligibleRound2Participants.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50 disabled:opacity-40 cursor-pointer"
            title="Next Participant (Shortcut: N)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Round 1 Qualification Workflow Notice Banner */}
      {round1Qualifiers.length === 0 ? (
        <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl text-xs text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">Round 1 Qualification Enforced:</span> Only contestants who qualify in Round 1 appear in Round 2. Currently, 0 participants are marked as qualified in Round 1.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentPage('participants')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              Qualify in Participants Roster
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Round 2 Qualification Roster:</strong> Showing only the {round1Qualifiers.length} participant(s) qualified from Round 1.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <button
              onClick={() => setCurrentPage('participants')}
              className="text-purple-400 hover:text-purple-300 font-semibold underline"
            >
              Manage Qualifications
            </button>
          </div>
        </div>
      )}

      {/* Topic Pool Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            Topic Pool <strong className="text-purple-300">({currentStation?.name || 'All Stations'})</strong>:
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
            {unusedCount} Available
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
            {usedCount} Used
          </span>
          {reuseAllowed && (
            <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              Reuse Allowed
            </span>
          )}
        </div>

        {usedCount > 0 && (
          <button
            onClick={async () => {
              if (confirm('Reset all used topics back to available?')) {
                await resetTopicsStatus();
              }
            }}
            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold"
          >
            <RotateCw className="w-3 h-3" />
            <span>Reset Used Topics</span>
          </button>
        )}
      </div>

      {poolNotice && (
        <div className="p-3 bg-amber-950/50 border border-amber-500/50 rounded-xl text-xs text-amber-200 flex items-center justify-between">
          <span>{poolNotice}</span>
          <button
            onClick={() => resetTopicsStatus()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[11px]"
          >
            Reset Pool Now
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Spinning Wheel */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-purple-900/30 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-between space-y-4">
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic Wheel Arena ({activeWheelTopics.length} Slices)
            </span>

            {/* Font Size Adjuster for Wheel Topics */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-purple-800/60 shadow-inner text-xs">
                <span className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-wider hidden sm:inline mr-1">
                  Font:
                </span>
                <button
                  onClick={() => handleWheelFontChange(-1)}
                  className="w-5 h-5 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-purple-900/60 text-slate-200 hover:text-white border border-slate-700 font-bold transition-all cursor-pointer active:scale-90"
                  title="Decrease wheel topic font size"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono font-bold text-xs text-amber-300 min-w-[32px] text-center">
                  {wheelFontSize ? `${wheelFontSize}px` : 'Auto'}
                </span>
                <button
                  onClick={() => handleWheelFontChange(+1)}
                  className="w-5 h-5 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-purple-900/60 text-slate-200 hover:text-white border border-slate-700 font-bold transition-all cursor-pointer active:scale-90"
                  title="Increase wheel topic font size"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {wheelFontSize !== undefined && (
                  <button
                    onClick={() => handleWheelFontChange(0)}
                    className="ml-1 text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5 rounded transition-colors cursor-pointer"
                    title="Reset to Auto font sizing"
                  >
                    Reset
                  </button>
                )}
              </div>

              <button
                onClick={handleSpin}
                disabled={isSpinning || timerPhase === 'speech'}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-purple-950/60 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'SPINNING...' : 'SPIN THE WHEEL'}</span>
              </button>
            </div>
          </div>

          {/* Wheel Canvas & Top Pointer */}
          <div className="relative flex items-center justify-center p-1">
            <WheelCanvas
              topics={activeWheelTopics}
              rotationAngle={rotationAngle}
              size={350}
              sliceColors={sliceColors}
              fontSize={wheelFontSize}
            />
          </div>

          {/* Selected Topic Reveal Display Card with Rotating Entrance */}
          <div className="w-full">
            {winningTopic ? (
              <motion.div
                key={winningTopic.id || 'winning-topic'}
                initial={{ scale: 0.1, rotate: -360, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-2 border-purple-500/60 shadow-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Selected Topic
                    </span>
                    <span className="font-mono font-bold text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      ID: {winningTopic.topicId || winningTopic.id || '—'}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white font-['Outfit'] leading-snug">
                  "{winningTopic.topic || 'Selected Topic'}"
                </h3>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-800/40 text-xs">
                  <span className="text-purple-300/80 font-mono text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Topic marked as used • Replaced on wheel after speech
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRevealModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                      title="View topic card reveal animation"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      View Card Reveal
                    </button>
                    {winningTopic && activeWheelTopics.some((t) => t?.id === winningTopic?.id) && (
                      <button
                        onClick={handleReplaceUsedTopic}
                        className="px-2.5 py-1 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 font-semibold text-[11px] transition-colors cursor-pointer"
                        title="Replace this used slice with the next available topic now"
                      >
                        Replace on Wheel Now
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                Click <strong>SPIN THE WHEEL</strong> above to randomly select a topic for {activeParticipant?.name || 'the contestant'}.
              </div>
            )}
          </div>

          {/* Active Contestant Qualification Banner */}
          {activeParticipant && (
            <div className="w-full p-4 rounded-2xl bg-slate-950/80 border border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800 text-purple-300 flex items-center justify-center font-bold text-xs">
                  {activeParticipant.participantNumber}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm font-['Outfit']">{activeParticipant.name}</h4>
                  {(activeParticipant.mobile || activeParticipant.phone) && (
                    <p className="text-[11px] text-slate-400 font-mono">
                      {activeParticipant.mobile || activeParticipant.phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                {activeParticipant.round1Qualified === 'qualified' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Round 1 Qualifier • Round 2 Contender
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/50 text-[11px] font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    R1 Qualification Pending (Override Mode)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Last Result Log */}
          {lastSavedResult && (
            <div className="w-full p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between">
              <span className="text-slate-300">
                Saved: <strong>{lastSavedResult.participantName}</strong> [Topic ID:{' '}
                <span className="text-purple-300 font-mono font-bold">{lastSavedResult.topicId || '—'}</span>] spoke for{' '}
                <strong className="text-emerald-300 font-mono">{lastSavedResult.speechDurationSeconds}s</strong>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(lastSavedResult.endTime).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Timer Engine (No prep for Round 2) */}
        <div className="lg:col-span-5">
          <Timer
            speechDurationSeconds={speechSeconds}
            hasPrepPhase={false}
            participantName={activeParticipant?.name}
            roundName="Round 2"
            buzzerEnabled={buzzerEnabled}
            warningBuzzerEnabled={warningBuzzerEnabled}
            warningTimeSeconds={warningTimeSeconds}
            stationId={currentStationId || undefined}
            onPhaseChange={setTimerPhase}
            onFinish={handleTimerFinish}
          />

          {/* Round 2 Warning Buzzer Status & Shortcut */}
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-white block">
                  Warning Buzzer: {warningBuzzerEnabled ? `${warningTimeSeconds}s remaining` : 'Disabled'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {warningBuzzerEnabled ? `Sounds alert at ${warningTimeSeconds}s left` : 'No mid-round alert'} • Tone: {db?.settings?.buzzer?.warningSound || 'double_beep'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setCurrentPage('warning-buzzer')}
              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white border border-purple-500/40 font-semibold text-[11px] transition-all cursor-pointer shrink-0"
            >
              Configure Timing
            </button>
          </div>
        </div>
      </div>

      {/* Spin Reveal Trading Card Modal */}
      <SpinRevealCardModal
        isOpen={showRevealModal}
        topic={winningTopic}
        onClose={() => setShowRevealModal(false)}
        onStartTimer={() => setShowRevealModal(false)}
        participantName={activeParticipant?.name}
        participantNumber={activeParticipant?.participantNumber}
        onReplaceOnWheel={
          winningTopic && (lockedWheelTopics || activeWheelTopics || []).some((t) => t?.id === winningTopic?.id)
            ? () => {
                handleReplaceUsedTopic();
                setShowRevealModal(false);
              }
            : undefined
        }
      />
    </div>
  );
};
