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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Timer, TimerPhase } from '../components/common/Timer';
import { WheelCanvas } from '../components/common/WheelCanvas';
import { soundEngine } from '../lib/audio';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { MindToMicLogo } from '../components/common/MindToMicLogo';
import { SpinRevealCardModal } from '../components/common/SpinRevealCardModal';
import type { Topic, Round2Result } from '../types';

export const Round2: React.FC = () => {
  const {
    db,
    activeParticipant,
    setActiveParticipant,
    selectNextParticipant,
    saveRound2Result,
    updateLiveSync,
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
  } = useApp();

  // Round 1 qualification workflow:
  // ONLY contestants who are qualified in Round 1 advance to Round 2 (Strict - no override)
  const round1Qualifiers = useMemo(() => {
    return (db?.participants || []).filter((p) => p.round1Qualified === 'qualified');
  }, [db?.participants]);

  const eligibleRound2Participants = useMemo(() => {
    return round1Qualifiers;
  }, [round1Qualifiers]);

  // Station-filtered eligible participants for Round 2 (strictly qualified only)
  const stationEligibleRound2Participants = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') {
      return eligibleRound2Participants;
    }
    return eligibleRound2Participants.filter((p) => p.stationId === currentStationId);
  }, [eligibleRound2Participants, currentStationId]);

  // Auto-select first station-eligible Round 2 contestant
  useEffect(() => {
    if (stationEligibleRound2Participants.length > 0) {
      const isAlreadyEligible =
        activeParticipant &&
        stationEligibleRound2Participants.some((p) => p.id === activeParticipant.id);
      if (!isAlreadyEligible) {
        setActiveParticipant(stationEligibleRound2Participants[0]);
      }
    } else if (activeParticipant) {
      setActiveParticipant(null as any);
    }
  }, [stationEligibleRound2Participants, activeParticipant, setActiveParticipant]);

  // Wheel state
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningTopic, setWinningTopic] = useState<Topic | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0); // in radians
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [lastSavedResult, setLastSavedResult] = useState<Round2Result | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [lockedWheelTopics, setLockedWheelTopics] = useState<Topic[] | null>(null);

  const topicsPool = db?.topics || [];
  const wheelCount = db?.settings.round2.activeWheelTopicCount ?? 20;
  const speechSeconds = db?.settings.round2.speechTimeSeconds ?? 120;
  const buzzerEnabled = db?.settings.round2.buzzerEnabled ?? true;
  const reuseAllowed = db?.settings.round2.topicReuseAllowed ?? false;

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

  // Compute active wheel topics when not locked - strictly available topics so no topic repeats
  const dynamicWheelTopics = useMemo(() => {
    if (topicsPool.length === 0) return [];

    const available = reuseAllowed
      ? [...topicsPool]
      : topicsPool.filter((t) => t.status === 'available');

    if (available.length === 0) {
      return reuseAllowed ? [...topicsPool].slice(0, wheelCount) : [];
    }

    return available.slice(0, wheelCount);
  }, [topicsPool, wheelCount, reuseAllowed]);

  // Actual topics rendered on the wheel: locked takes priority during/after spin
  const activeWheelTopics = lockedWheelTopics || dynamicWheelTopics;

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

    // Clean wheel topics before spinning: replace any topic that is already used with a fresh unused topic from the pool
    const pool = db?.topics || topicsPool;
    const cleanedWheel = activeWheelTopics.map((sliceTopic) => {
      const dbTopic = pool.find((t) => t.id === sliceTopic.id);
      const isUsed = sliceTopic.status === 'used' || (!reuseAllowed && dbTopic?.status === 'used');
      if (isUsed) {
        const unused = pool.find((p) => p.status === 'available' && !activeWheelTopics.some((w) => w.id === p.id));
        return unused || sliceTopic;
      }
      return sliceTopic;
    });

    // Freeze current wheel topics before initiating spin
    let currentWheel = [...cleanedWheel];
    setLockedWheelTopics(currentWheel);
    setIsSpinning(true);
    setWinningTopic(null);

    let chosenTopic: Topic;
    let targetIndex = 0;
    try {
      const wheelTopicIds = currentWheel.map((t) => t.id);
      const res = await spinStationTopic(currentStationId, wheelTopicIds);
      chosenTopic = res.topic;
      if (res.wheelTopics && res.wheelTopics.length > 0) {
        currentWheel = [...res.wheelTopics];
        setLockedWheelTopics(currentWheel);
      }
      if (typeof res.targetIndex === 'number' && res.targetIndex >= 0) {
        targetIndex = res.targetIndex;
      } else {
        targetIndex = currentWheel.findIndex((t) => t.id === chosenTopic.id);
      }
    } catch (err: any) {
      setIsSpinning(false);
      setLockedWheelTopics(null);
      setPoolNotice(err.message || 'No unused topics remaining. Please reset topic pool or allow reuse.');
      return;
    }

    // Verify chosenTopic is positioned in currentWheel
    if (targetIndex === -1) {
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
        setWinningTopic(chosenTopic);
        setShowRevealModal(true);
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
        completeStationSpin(currentStationId).catch(() => {});

        // Sync with projector display with current wheel
        updateLiveSync({
          currentRound: 2,
          activeParticipantId: activeParticipant?.id || null,
          locationId: currentStationId,
          activeItem: {
            type: 'topic',
            title: chosenTopic.topic,
            id: chosenTopic.id,
            category: chosenTopic.category,
          },
          wheelSpin: {
            isSpinning: false,
            targetTopicId: chosenTopic.id,
            targetTopicTitle: chosenTopic.topic,
            targetIndex,
            wheelTopics: currentWheel,
            startedAt: 0,
            durationMs: 0,
          },
        }).catch(() => {});
      }
    };

    requestAnimationFrame(animateSpin);
  };

  // Replace used topic on wheel with next unused topic from pool
  const handleReplaceUsedTopic = useCallback(() => {
    if (!winningTopic) return;
    const pool = db?.topics || topicsPool;
    const currentWheel = lockedWheelTopics || activeWheelTopics;
    const remainingUnused = pool.filter(
      (t) => t.status === 'available' && t.id !== winningTopic.id && !currentWheel.some((cw) => cw.id === t.id)
    );
    if (remainingUnused.length > 0 && currentWheel.some((t) => t.id === winningTopic.id)) {
      const nextTopic = remainingUnused[0];
      const updated = currentWheel.map((t) => (t.id === winningTopic.id ? nextTopic : t));
      setLockedWheelTopics(updated);
      if (currentStationId) {
        replaceStationWheelTopic(currentStationId, winningTopic.id, nextTopic.id).catch(() => {});
      }
      updateLiveSync({
        currentRound: 2,
        activeParticipantId: activeParticipant?.id || null,
        locationId: currentStationId,
        activeItem: {
          type: 'topic',
          title: winningTopic.topic,
          id: winningTopic.id,
          category: winningTopic.category,
        },
        wheelSpin: {
          isSpinning: false,
          targetTopicId: winningTopic.id,
          targetTopicTitle: winningTopic.topic,
          wheelTopics: updated,
          startedAt: 0,
          durationMs: 0,
        },
      }).catch(() => {});
    }
  }, [winningTopic, db?.topics, topicsPool, lockedWheelTopics, activeWheelTopics, currentStationId, replaceStationWheelTopic, updateLiveSync, activeParticipant?.id]);

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

      const currentTopicId = winningTopic.topicId || winningTopic.id;

      const resultPayload = {
        participantId: activeParticipant.id,
        participantNumber: activeParticipant.participantNumber,
        participantName: activeParticipant.name,
        mobile: activeParticipant.mobile || activeParticipant.phone || activeParticipant.customData?.phone || '',
        topicId: currentTopicId,
        topicText: winningTopic.topic,
        prepDurationSeconds: 0,
        speechDurationSeconds: data.speechDurationSeconds,
        targetSpeechDurationSeconds: speechSeconds,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
      };

      const saved = await saveRound2Result(resultPayload);
      setLastSavedResult(saved);

      // Topic has now been used for speech; replace it on the wheel with the next unused topic
      const remainingUnused = (db?.topics || topicsPool).filter(
        (t) => t.status === 'available' && t.id !== winningTopic.id && !activeWheelTopics.some((cw) => cw.id === t.id)
      );
      if (remainingUnused.length > 0 && activeWheelTopics.some((t) => t.id === winningTopic.id)) {
        const updated = activeWheelTopics.map((t) => (t.id === winningTopic.id ? remainingUnused[0] : t));
        setLockedWheelTopics(updated);
        updateLiveSync({
          currentRound: 2,
          activeParticipantId: activeParticipant?.id || null,
          locationId: currentStationId,
          activeItem: {
            type: 'topic',
            title: winningTopic.topic,
            id: winningTopic.id,
            category: winningTopic.category,
          },
          wheelSpin: {
            isSpinning: false,
            targetTopicId: winningTopic.id,
            targetTopicTitle: winningTopic.topic,
            wheelTopics: updated,
            startedAt: 0,
            durationMs: 0,
          },
        }).catch(() => {});
      }
    },
    [activeParticipant, winningTopic, speechSeconds, saveRound2Result, db?.topics, topicsPool, activeWheelTopics, updateLiveSync, currentStationId]
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
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
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">Spin the Topic Wheel</h1>
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

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Contestant:
            </span>
            <select
              value={activeParticipant?.id || ''}
              onChange={(e) => {
                const p = db?.participants.find((item) => item.id === e.target.value);
                if (p) setActiveParticipant(p);
              }}
              className="bg-transparent text-white font-bold font-['Outfit'] focus:outline-none max-w-[210px] truncate"
            >
              {stationEligibleRound2Participants.length === 0 ? (
                <option value="" disabled className="bg-slate-900 text-amber-400">
                  No eligible contestants in {currentStation?.name || 'this station'}
                </option>
              ) : (
                stationEligibleRound2Participants.map((p) => {
                  const isR1Qual = p.round1Qualified === 'qualified';
                  return (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.participantNumber} — {p.name} {isR1Qual ? '★ [R1 QUALIFIED]' : ''}
                    </option>
                  );
                })
              )}
            </select>

            {stationEligibleRound2Participants.length > 0 && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                {stationEligibleRound2Participants.length} Available
              </span>
            )}
          </div>

          <button
            onClick={() => selectNextParticipant(stationEligibleRound2Participants.length > 0 ? stationEligibleRound2Participants : undefined)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50"
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
          <span className="text-slate-400">Topic Pool:</span>
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
        <div className="lg:col-span-7 bg-slate-900/90 border border-purple-900/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-between space-y-6">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic Wheel Arena ({activeWheelTopics.length} Slices)
            </span>

            <button
              onClick={handleSpin}
              disabled={isSpinning || timerPhase === 'speech'}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-purple-950/60 transition-all active:scale-95"
            >
              <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'SPINNING...' : 'SPIN THE WHEEL'}</span>
            </button>
          </div>

          {/* Wheel Canvas & Top Pointer */}
          <div className="relative flex items-center justify-center p-2">
            <WheelCanvas
              topics={activeWheelTopics}
              rotationAngle={rotationAngle}
              size={460}
              sliceColors={sliceColors}
            />
          </div>

          {/* Selected Topic Reveal Display Card with Rotating Entrance */}
          <div className="w-full">
            {winningTopic ? (
              <motion.div
                key={winningTopic.id}
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
                      ID: {winningTopic.topicId || winningTopic.id}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700">
                    {winningTopic.category || 'General'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white font-['Outfit'] leading-snug">
                  "{winningTopic.topic}"
                </h3>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-800/40 text-xs">
                  <span className="text-purple-300/80 font-mono text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Topic marked as used • Replaced on wheel after speech
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRevealModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-[11px] transition-colors flex items-center gap-1"
                      title="View topic card reveal animation"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      View Card Reveal
                    </button>
                    {activeWheelTopics.some((t) => t.id === winningTopic.id) && (
                      <button
                        onClick={handleReplaceUsedTopic}
                        className="px-2.5 py-1 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 font-semibold text-[11px] transition-colors"
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
            onPhaseChange={setTimerPhase}
            onFinish={handleTimerFinish}
          />
        </div>
      </div>

      {/* 3D Spin Reveal Trading Card Modal */}
      <SpinRevealCardModal
        isOpen={showRevealModal}
        topic={winningTopic}
        onClose={() => {
          handleReplaceUsedTopic();
          setShowRevealModal(false);
        }}
        participantName={activeParticipant?.name}
        participantNumber={activeParticipant?.participantNumber}
        onReplaceOnWheel={
          winningTopic && (lockedWheelTopics || activeWheelTopics).some((t) => t.id === winningTopic.id)
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
