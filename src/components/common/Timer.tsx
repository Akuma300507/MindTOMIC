import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  AlertTriangle,
  Volume2,
  CheckCircle2,
  Zap,
  Bell,
  Lock,
} from 'lucide-react';
import { soundEngine } from '../../lib/audio';
import { useApp } from '../../context/AppContext';
import { getServerNow } from '../../lib/timeSync';
import { computeStationTimer } from '../../lib/timerUtils';

export type TimerPhase = 'idle' | 'prep' | 'speech' | 'stopped' | 'time_up';

interface TimerProps {
  prepDurationSeconds?: number;
  speechDurationSeconds: number;
  hasPrepPhase?: boolean;
  participantName?: string;
  roundName: 'Round 1' | 'Round 2' | 'Round 3';
  buzzerEnabled?: boolean;
  warningBuzzerEnabled?: boolean;
  warningTimeSeconds?: number;
  stationId?: string;
  canStart?: boolean;
  cannotStartReason?: string;
  size?: 'normal' | 'large';
  className?: string;
  onFinish?: (data: {
    status: 'completed' | 'completed_early' | 'time_up';
    prepDurationSeconds: number;
    speechDurationSeconds: number;
    startTime: string;
    endTime: string;
  }) => void;
  onPhaseChange?: (phase: TimerPhase) => void;
}

export const Timer: React.FC<TimerProps> = ({
  prepDurationSeconds = 30,
  speechDurationSeconds = 120,
  hasPrepPhase = false,
  participantName,
  roundName,
  buzzerEnabled = true,
  warningBuzzerEnabled = true,
  warningTimeSeconds = 30,
  stationId,
  canStart = true,
  cannotStartReason,
  size = 'normal',
  className = '',
  onFinish,
  onPhaseChange,
}) => {
  const {
    db,
    triggerBuzzer,
    triggerWarningBuzzer,
    updateLiveSync,
    sendTimerAction,
    sendStationTimerAction,
    currentStationId,
    setOnTimerStartPause,
    setOnTimerStop,
    setOnTimerReset,
    unlockSound,
    playBuzzerLocal,
    playWarningBuzzerLocal,
  } = useApp();

  const activeStationId = stationId || currentStationId;
  const activeStation =
    (activeStationId && activeStationId !== 'all' ? db?.stations?.[activeStationId] : null) || db?.liveSync;
  const roundNum = roundName === 'Round 1' ? 1 : roundName === 'Round 2' ? 2 : 3;
  const isStationMatchingRound = !activeStation?.currentRound || activeStation.currentRound === roundNum;

  const playCurrentPrepBuzzer = useCallback(() => {
    const prepSound = db?.settings?.buzzer?.prepSound || 'dual_alert';
    const prepVol = db?.settings?.buzzer?.prepVolume ?? 85;
    const customUrl = db?.settings?.buzzer?.prepCustomAudioUrl;
    soundEngine.playPrepOverBuzzer(prepSound, prepVol, customUrl);
  }, [db?.settings?.buzzer?.prepSound, db?.settings?.buzzer?.prepVolume, db?.settings?.buzzer?.prepCustomAudioUrl]);

  const playCurrentWarningBuzzer = useCallback(() => {
    const warnSound = db?.settings?.buzzer?.warningSound || 'double_beep';
    const warnVol = db?.settings?.buzzer?.warningVolume ?? 85;
    const customUrl = db?.settings?.buzzer?.warningCustomAudioUrl;
    soundEngine.playWarningBuzzer(warnSound, warnVol, customUrl);
  }, [db?.settings?.buzzer?.warningSound, db?.settings?.buzzer?.warningVolume, db?.settings?.buzzer?.warningCustomAudioUrl]);

  // Initial state calculation directly from active station state if running/paused
  const getInitialTimerState = () => {
    if (activeStation && isStationMatchingRound) {
      const isRunning = Boolean(activeStation.isTimerRunning || activeStation.timerStatus === 'running');
      const isPaused = activeStation.timerStatus === 'paused';
      const isTimeUpOrOvertime = Boolean(activeStation.isOvertime || activeStation.timerMode === 'time_up');

      if (isRunning || isPaused || isTimeUpOrOvertime) {
        const computed = computeStationTimer(activeStation, getServerNow());
        const effectivePhase: TimerPhase =
          computed.phase === 'time_up' ? 'speech' : (computed.phase as TimerPhase);

        return {
          phase: effectivePhase,
          isRunning: computed.isRunning,
          remainingSeconds: computed.remainingSeconds,
          totalSecondsForPhase: computed.durationSeconds,
          isOvertime: computed.isOvertime,
          overtimeSeconds: computed.overtimeSeconds,
          pausedRemaining: computed.remainingSeconds,
        };
      }
    }

    const defaultSecs = hasPrepPhase ? prepDurationSeconds : speechDurationSeconds;
    return {
      phase: 'idle' as TimerPhase,
      isRunning: false,
      remainingSeconds: defaultSecs,
      totalSecondsForPhase: defaultSecs,
      isOvertime: false,
      overtimeSeconds: 0,
      pausedRemaining: defaultSecs,
    };
  };

  const initialTimerState = useMemo(() => getInitialTimerState(), []);

  const [phase, setPhase] = useState<TimerPhase>(initialTimerState.phase);
  const [isRunning, setIsRunning] = useState<boolean>(initialTimerState.isRunning);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimerState.remainingSeconds);
  const [totalSecondsForPhase, setTotalSecondsForPhase] = useState<number>(initialTimerState.totalSecondsForPhase);
  const [actualSpeechElapsed, setActualSpeechElapsed] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [isOvertime, setIsOvertime] = useState<boolean>(initialTimerState.isOvertime);
  const [overtimeSeconds, setOvertimeSeconds] = useState<number>(initialTimerState.overtimeSeconds);

  // Time tracking refs to avoid drift
  const startTimeRef = useRef<string>(
    activeStation?.timerStartTime ? new Date(activeStation.timerStartTime).toISOString() : ''
  );
  const speechStartTimeRef = useRef<number | null>(
    activeStation?.timerStartTime || null
  );
  const phaseEndTimestampRef = useRef<number | null>(
    activeStation?.timerEndsAt || null
  );
  const overtimeStartTimestampRef = useRef<number | null>(
    initialTimerState.isOvertime
      ? (activeStation?.timerEndsAt || getServerNow() - initialTimerState.overtimeSeconds * 1000)
      : null
  );
  const pausedTimeRemainingRef = useRef<number>(initialTimerState.pausedRemaining);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickedSecondRef = useRef<number | null>(null);
  const warningBuzzerPlayedRef = useRef<boolean>(
    Boolean(
      activeStation?.buzzerPlayed ||
      (initialTimerState.phase === 'speech' && initialTimerState.remainingSeconds <= warningTimeSeconds)
    )
  );

  // Track last handled station state so local actions don't get re-triggered by their own SSE echo
  const lastHandledStationStateRef = useRef<{
    startTime?: number | null;
    status?: string;
    mode?: string;
    endsAt?: number | null;
    isTimerRunning?: boolean;
    activeStationId?: string;
  }>({});

  // Synchronize phase with parent
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Clear timer interval safely
  const clearIntervalSafe = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearIntervalSafe();
      setOnTimerStartPause(undefined);
      setOnTimerStop(undefined);
      setOnTimerReset(undefined);
    };
  }, [clearIntervalSafe, setOnTimerStartPause, setOnTimerStop, setOnTimerReset]);

  // Helper for overtime ticker (counts UP after limit is reached)
  const startOvertimeTicker = useCallback(
    (customOverStartMs?: number) => {
      clearIntervalSafe();
      const overStart = customOverStartMs ?? overtimeStartTimestampRef.current ?? getServerNow();
      overtimeStartTimestampRef.current = overStart;

      timerIntervalRef.current = setInterval(() => {
        if (!overtimeStartTimestampRef.current) return;
        const elapsed = Math.floor((getServerNow() - overtimeStartTimestampRef.current) / 1000);
        setOvertimeSeconds(elapsed);
      }, 250);
    },
    [clearIntervalSafe]
  );

  // Ref to hold handleTransitionToSpeech to break circular dependency
  const transitionToSpeechRef = useRef<() => void>(() => {});

  // Helper for starting countdown ticker
  const startTicker = useCallback(
    (targetDurationSeconds: number, tickerPhase: 'prep' | 'speech', customEndMs?: number) => {
      clearIntervalSafe();
      const now = getServerNow();
      phaseEndTimestampRef.current = customEndMs ?? (now + targetDurationSeconds * 1000);
      lastTickedSecondRef.current = null;

      timerIntervalRef.current = setInterval(() => {
        if (!phaseEndTimestampRef.current) return;
        const diff = Math.max(0, Math.ceil((phaseEndTimestampRef.current - getServerNow()) / 1000));
        setRemainingSeconds(diff);

        // Sound: Mid-Round Timing Warning Buzzer
        // Plays when remaining speech countdown reaches configured warning time (e.g. 30s)
        if (
          tickerPhase === 'speech' &&
          warningBuzzerEnabled &&
          diff <= warningTimeSeconds &&
          diff > 0 &&
          !warningBuzzerPlayedRef.current
        ) {
          warningBuzzerPlayedRef.current = true;
          playCurrentWarningBuzzer();
          if (activeStationId && activeStationId !== 'all') {
            sendStationTimerAction(activeStationId, {
              action: 'warning_buzzer' as any,
              phase: 'speech',
              remainingSeconds: diff,
              round: roundName,
            }).catch(() => {});
          } else {
            triggerWarningBuzzer(`Mid-Round Timing Warning (${diff}s remaining)`, roundName);
          }
        }

        // Sound 2: Small audible tick sound to give hint that time is going to finish
        // Plays once per second in speech phase during the final 10 seconds (10..1)
        if (tickerPhase === 'speech' && diff <= 10 && diff > 0) {
          if (lastTickedSecondRef.current !== diff) {
            lastTickedSecondRef.current = diff;
            soundEngine.playWarningTick(75);
          }
        }

        if (diff <= 0) {
          clearIntervalSafe();
          if (tickerPhase === 'prep') {
            // Sound 1: Buzzer sound when the prep time is over
            playCurrentPrepBuzzer();
            transitionToSpeechRef.current();
          } else {
            // Sound 3: Finish buzzer sound after speech time limit is reached
            setIsOvertime(true);
            setIsRunning(true);
            setRemainingSeconds(0);
            const timeUpEndsAt = phaseEndTimestampRef.current || getServerNow();
            if (activeStationId && activeStationId !== 'all') {
              // sendStationTimerAction handles local zero-delay station-scoped buzzer and scoped server broadcast
              sendStationTimerAction(activeStationId, { action: 'time_up', phase: 'speech', remainingSeconds: 0 }).catch(() => {});
            } else {
              if (buzzerEnabled) {
                triggerBuzzer('Time Limit Reached', roundName);
              }
              sendTimerAction({ action: 'time_up', round: roundName, phase: 'speech' });
            }
            startOvertimeTicker(timeUpEndsAt);
          }
        }
      }, 100);
    },
    [
      clearIntervalSafe,
      buzzerEnabled,
      triggerBuzzer,
      triggerWarningBuzzer,
      playCurrentPrepBuzzer,
      playCurrentWarningBuzzer,
      warningBuzzerEnabled,
      warningTimeSeconds,
      roundName,
      sendTimerAction,
      sendStationTimerAction,
      activeStationId,
      startOvertimeTicker,
    ]
  );

  // Transition to speech phase
  const handleTransitionToSpeech = useCallback(() => {
    unlockSound();
    clearIntervalSafe();
    // Sound 1: Buzzer sound when prep time is over
    playCurrentPrepBuzzer();
    warningBuzzerPlayedRef.current = false;

    const now = getServerNow();
    speechStartTimeRef.current = now;
    const endsAt = now + speechDurationSeconds * 1000;

    lastHandledStationStateRef.current = {
      startTime: now,
      status: 'running',
      mode: 'speech',
      endsAt,
      isTimerRunning: true,
      activeStationId,
    };

    setPhase('speech');
    setTotalSecondsForPhase(speechDurationSeconds);
    setRemainingSeconds(speechDurationSeconds);
    setIsRunning(true);
    setIsOvertime(false);
    setOvertimeSeconds(0);

    if (!startTimeRef.current) {
      startTimeRef.current = new Date(now).toISOString();
    }

    if (activeStationId && activeStationId !== 'all') {
      sendStationTimerAction(activeStationId, {
        action: 'transition_to_speech',
        phase: 'speech',
        totalSeconds: speechDurationSeconds,
        remainingSeconds: speechDurationSeconds,
      }).catch(() => {});
    } else {
      sendTimerAction({
        action: 'transition_to_speech',
        phase: 'speech',
        totalSeconds: speechDurationSeconds,
        remainingSeconds: speechDurationSeconds,
        round: roundName,
      });
    }

    startTicker(speechDurationSeconds, 'speech', endsAt);
  }, [
    clearIntervalSafe,
    speechDurationSeconds,
    activeStationId,
    sendStationTimerAction,
    sendTimerAction,
    roundName,
    startTicker,
    playCurrentPrepBuzzer,
    unlockSound,
  ]);

  useEffect(() => {
    transitionToSpeechRef.current = handleTransitionToSpeech;
  }, [handleTransitionToSpeech]);

  // START action
  const handleStart = useCallback(() => {
    if (!canStart && phase === 'idle') {
      alert(cannotStartReason || 'Contestant must check in to location before starting Round 1.');
      return;
    }
    unlockSound();
    if (isRunning) return;

    if (phase === 'idle') {
      warningBuzzerPlayedRef.current = false;
      const startedAt = getServerNow();
      startTimeRef.current = new Date(startedAt).toISOString();
      if (hasPrepPhase) {
        const endsAt = startedAt + prepDurationSeconds * 1000;
        lastHandledStationStateRef.current = {
          startTime: startedAt,
          status: 'running',
          mode: 'prep',
          endsAt,
          isTimerRunning: true,
          activeStationId,
        };
        setPhase('prep');
        setTotalSecondsForPhase(prepDurationSeconds);
        setRemainingSeconds(prepDurationSeconds);
        setIsRunning(true);
        if (activeStationId && activeStationId !== 'all') {
          sendStationTimerAction(activeStationId, {
            action: 'start',
            phase: 'prep',
            totalSeconds: prepDurationSeconds,
            remainingSeconds: prepDurationSeconds,
            startedAt,
            endsAt,
          }).catch(() => {});
        } else {
          sendTimerAction({
            action: 'start',
            phase: 'prep',
            totalSeconds: prepDurationSeconds,
            remainingSeconds: prepDurationSeconds,
            round: roundName,
            startedAt,
            endsAt,
          });
        }
        startTicker(prepDurationSeconds, 'prep', endsAt);
      } else {
        const endsAt = startedAt + speechDurationSeconds * 1000;
        lastHandledStationStateRef.current = {
          startTime: startedAt,
          status: 'running',
          mode: 'speech',
          endsAt,
          isTimerRunning: true,
          activeStationId,
        };
        setPhase('speech');
        speechStartTimeRef.current = startedAt;
        setTotalSecondsForPhase(speechDurationSeconds);
        setRemainingSeconds(speechDurationSeconds);
        setIsRunning(true);
        if (activeStationId && activeStationId !== 'all') {
          sendStationTimerAction(activeStationId, {
            action: 'start',
            phase: 'speech',
            totalSeconds: speechDurationSeconds,
            remainingSeconds: speechDurationSeconds,
            startedAt,
            endsAt,
          }).catch(() => {});
        } else {
          sendTimerAction({
            action: 'start',
            phase: 'speech',
            totalSeconds: speechDurationSeconds,
            remainingSeconds: speechDurationSeconds,
            round: roundName,
            startedAt,
            endsAt,
          });
        }
        startTicker(speechDurationSeconds, 'speech', endsAt);
      }
    } else if (phase === 'prep' || phase === 'speech') {
      // Resume from pause
      const startedAt = getServerNow();
      const rem = pausedTimeRemainingRef.current;
      const endsAt = startedAt + rem * 1000;
      lastHandledStationStateRef.current = {
        startTime: startedAt,
        status: 'running',
        mode: phase,
        endsAt,
        isTimerRunning: true,
        activeStationId,
      };
      setIsRunning(true);
      if (activeStationId && activeStationId !== 'all') {
        sendStationTimerAction(activeStationId, {
          action: 'start',
          phase,
          totalSeconds: totalSecondsForPhase,
          remainingSeconds: rem,
          startedAt,
          endsAt,
        }).catch(() => {});
      } else {
        sendTimerAction({
          action: 'start',
          phase,
          totalSeconds: totalSecondsForPhase,
          remainingSeconds: rem,
          round: roundName,
          startedAt,
          endsAt,
        });
      }
      startTicker(rem, phase as 'prep' | 'speech', endsAt);
    }
  }, [
    canStart,
    cannotStartReason,
    hasPrepPhase,
    isRunning,
    phase,
    prepDurationSeconds,
    speechDurationSeconds,
    startTicker,
    unlockSound,
    sendTimerAction,
    sendStationTimerAction,
    activeStationId,
    roundName,
    totalSecondsForPhase,
  ]);

  // PAUSE action
  const handlePause = useCallback(() => {
    if (!isRunning) return;
    clearIntervalSafe();
    setIsRunning(false);
    pausedTimeRemainingRef.current = remainingSeconds;
    lastHandledStationStateRef.current = {
      status: 'paused',
      mode: phase,
      isTimerRunning: false,
      activeStationId,
    };
    if (activeStationId && activeStationId !== 'all') {
      sendStationTimerAction(activeStationId, {
        action: 'pause',
        phase,
        remainingSeconds,
      }).catch(() => {});
    } else {
      sendTimerAction({
        action: 'pause',
        phase,
        remainingSeconds,
        round: roundName,
      });
    }
  }, [clearIntervalSafe, isRunning, remainingSeconds, sendTimerAction, sendStationTimerAction, activeStationId, phase, roundName]);

  // Toggle start/pause
  const handleToggleStartPause = useCallback(() => {
    if (isRunning) {
      handlePause();
    } else {
      if (!canStart && phase === 'idle') {
        alert(cannotStartReason || 'Contestant must check in to location before starting Round 1.');
        return;
      }
      handleStart();
    }
  }, [isRunning, handlePause, handleStart, canStart, cannotStartReason, phase]);

  // STOP action (organizer manual stop before time runs out)
  // Note: Per requirements, NO buzzer sound plays when clicking STOP
  const handleStop = useCallback(() => {
    if (phase === 'idle' || phase === 'stopped') return;

    clearIntervalSafe();
    setIsRunning(false);
    setPhase('stopped');
    lastHandledStationStateRef.current = {
      status: 'stopped',
      mode: 'stopped',
      isTimerRunning: false,
      activeStationId,
    };

    if (activeStationId && activeStationId !== 'all') {
      sendStationTimerAction(activeStationId, {
        action: 'stop',
        phase: 'stopped',
        remainingSeconds,
      }).catch(() => {});
    } else {
      sendTimerAction({
        action: 'stop',
        phase: 'stopped',
        remainingSeconds,
        round: roundName,
      });
    }

    let speechDuration = 0;
    if (phase === 'speech') {
      speechDuration = isOvertime
        ? speechDurationSeconds + overtimeSeconds
        : Math.max(0, speechDurationSeconds - remainingSeconds);
    } else if (phase === 'prep') {
      speechDuration = 0;
    }
    setActualSpeechElapsed(speechDuration);

    const endTime = new Date().toISOString();
    onFinish?.({
      status: isOvertime ? 'time_up' : 'completed_early',
      prepDurationSeconds: hasPrepPhase ? prepDurationSeconds : 0,
      speechDurationSeconds: speechDuration,
      startTime: startTimeRef.current || new Date().toISOString(),
      endTime,
    });
  }, [
    phase,
    clearIntervalSafe,
    speechDurationSeconds,
    remainingSeconds,
    isOvertime,
    overtimeSeconds,
    onFinish,
    hasPrepPhase,
    prepDurationSeconds,
    sendTimerAction,
    sendStationTimerAction,
    activeStationId,
    roundName,
  ]);

  // RESET action
  const executeReset = useCallback(() => {
    clearIntervalSafe();
    setIsRunning(false);
    setPhase('idle');
    setIsOvertime(false);
    setOvertimeSeconds(0);
    overtimeStartTimestampRef.current = null;
    warningBuzzerPlayedRef.current = false;
    const initialSeconds = hasPrepPhase ? prepDurationSeconds : speechDurationSeconds;
    setRemainingSeconds(initialSeconds);
    setTotalSecondsForPhase(initialSeconds);
    setActualSpeechElapsed(0);
    speechStartTimeRef.current = null;
    setShowResetConfirm(false);
    lastHandledStationStateRef.current = {
      status: 'idle',
      mode: 'idle',
      isTimerRunning: false,
      startTime: null,
      activeStationId,
    };
    if (activeStationId && activeStationId !== 'all') {
      sendStationTimerAction(activeStationId, {
        action: 'reset',
        totalSeconds: initialSeconds,
        remainingSeconds: initialSeconds,
      }).catch(() => {});
    } else {
      sendTimerAction({
        action: 'reset',
        totalSeconds: initialSeconds,
        remainingSeconds: initialSeconds,
        round: roundName,
      });
    }
  }, [
    clearIntervalSafe,
    hasPrepPhase,
    prepDurationSeconds,
    speechDurationSeconds,
    sendTimerAction,
    sendStationTimerAction,
    activeStationId,
    roundName,
  ]);

  // When active participant changes and timer is not currently running, cleanly reset timer to fresh idle state
  const prevParticipantNameRef = useRef<string | undefined>(participantName);
  useEffect(() => {
    if (participantName && prevParticipantNameRef.current && participantName !== prevParticipantNameRef.current) {
      if (!isRunning) {
        executeReset();
      }
    }
    prevParticipantNameRef.current = participantName;
  }, [participantName, isRunning, executeReset]);

  // Rehydrate & synchronize with station state whenever station updates or component mounts
  useEffect(() => {
    if (!activeStation || !isStationMatchingRound) return;

    const stationStatus = activeStation.timerStatus || (activeStation.isTimerRunning ? 'running' : 'idle');
    const stationMode = activeStation.timerMode || 'idle';
    const stationIsRunning = Boolean(activeStation.isTimerRunning || stationStatus === 'running');
    const stationStartTime = activeStation.timerStartTime || activeStation.timerStartedAt;
    const stationEndsAt = activeStation.timerEndsAt;

    const last = lastHandledStationStateRef.current;
    const isStationChanged = last.activeStationId !== activeStationId;
    const hasExternalChange =
      isStationChanged ||
      last.status === undefined ||
      stationStatus !== last.status ||
      stationMode !== last.mode ||
      Boolean(stationIsRunning) !== Boolean(last.isTimerRunning) ||
      (stationStartTime && stationStartTime !== last.startTime);

    if (!hasExternalChange) return;

    lastHandledStationStateRef.current = {
      startTime: stationStartTime,
      status: stationStatus,
      mode: stationMode,
      endsAt: stationEndsAt,
      isTimerRunning: stationIsRunning,
      activeStationId,
    };

    if (stationIsRunning) {
      const computed = computeStationTimer(activeStation, getServerNow());
      const effectivePhase: TimerPhase =
        computed.phase === 'time_up' ? 'speech' : (computed.phase as TimerPhase);

      setPhase(effectivePhase);
      setIsRunning(true);
      setRemainingSeconds(computed.remainingSeconds);
      setTotalSecondsForPhase(computed.durationSeconds);
      setIsOvertime(computed.isOvertime);
      setOvertimeSeconds(computed.overtimeSeconds);

      if (computed.phase === 'speech' && computed.remainingSeconds <= warningTimeSeconds) {
        warningBuzzerPlayedRef.current = true;
      }

      if (stationStartTime) {
        startTimeRef.current = new Date(stationStartTime).toISOString();
        if (effectivePhase === 'speech') {
          speechStartTimeRef.current = stationStartTime;
        }
      }

      if (computed.isOvertime) {
        startOvertimeTicker(stationEndsAt || (getServerNow() - computed.overtimeSeconds * 1000));
      } else if (effectivePhase === 'prep' || effectivePhase === 'speech') {
        startTicker(
          computed.remainingSeconds,
          effectivePhase,
          stationEndsAt || (getServerNow() + computed.remainingSeconds * 1000)
        );
      }
    } else if (stationStatus === 'paused') {
      const computed = computeStationTimer(activeStation, getServerNow());
      clearIntervalSafe();
      setIsRunning(false);
      setPhase(computed.phase as TimerPhase);
      setRemainingSeconds(computed.remainingSeconds);
      setTotalSecondsForPhase(computed.durationSeconds);
      pausedTimeRemainingRef.current = computed.remainingSeconds;
    } else if (stationStatus === 'stopped') {
      clearIntervalSafe();
      setIsRunning(false);
      setPhase('stopped');
    } else if (stationStatus === 'idle') {
      clearIntervalSafe();
      setIsRunning(false);
      setPhase('idle');
      setIsOvertime(false);
      setOvertimeSeconds(0);
      const defSecs = hasPrepPhase ? prepDurationSeconds : speechDurationSeconds;
      setRemainingSeconds(defSecs);
      setTotalSecondsForPhase(defSecs);
    }
  }, [
    activeStation,
    activeStationId,
    isStationMatchingRound,
    hasPrepPhase,
    prepDurationSeconds,
    speechDurationSeconds,
    warningTimeSeconds,
    startTicker,
    startOvertimeTicker,
    clearIntervalSafe,
  ]);

  // Keyboard shortcut binding
  useEffect(() => {
    setOnTimerStartPause(() => handleToggleStartPause);
    setOnTimerStop(() => handleStop);
    setOnTimerReset(() => () => setShowResetConfirm(true));
  }, [handleToggleStartPause, handleStop, setOnTimerStartPause, setOnTimerStop, setOnTimerReset]);

  // Format time as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Progress circle math
  const isLarge = size === 'large';
  const progressPercent =
    totalSecondsForPhase > 0 ? (remainingSeconds / totalSecondsForPhase) * 100 : 0;
  const radius = isLarge ? 175 : 120;
  const viewBoxSize = isLarge ? 390 : 280;
  const centerCoord = isLarge ? 195 : 140;
  const strokeWidth = isLarge ? 16 : 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Determine stage colors
  let ringColor = 'stroke-purple-500';
  let badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  let phaseLabel = 'READY TO START';

  if (isOvertime) {
    ringColor = 'stroke-rose-500';
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
    phaseLabel = 'OVERTIME';
  } else if (phase === 'prep') {
    ringColor = 'stroke-amber-400';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
    phaseLabel = 'PREPARE';
  } else if (phase === 'speech') {
    if (remainingSeconds <= 10) {
      ringColor = 'stroke-rose-500';
      badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-ping';
      phaseLabel = 'FINAL SECONDS';
    } else if (warningBuzzerEnabled && remainingSeconds <= warningTimeSeconds) {
      ringColor = 'stroke-amber-400';
      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      phaseLabel = `TIME WARNING (${remainingSeconds}s)`;
    } else {
      ringColor = 'stroke-emerald-400';
      badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      phaseLabel = 'SPEAK NOW';
    }
  } else if (phase === 'time_up') {
    ringColor = 'stroke-rose-600';
    badgeColor = 'bg-rose-600 text-white border-rose-500';
    phaseLabel = 'TIME UP';
  } else if (phase === 'stopped') {
    ringColor = 'stroke-blue-400';
    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    phaseLabel = 'STOPPED';
  }

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        isLarge ? 'p-8 sm:p-12 min-h-[580px] lg:min-h-[640px]' : 'p-6'
      } bg-slate-900/90 border border-purple-900/40 rounded-3xl shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${
          isLarge
            ? 'from-purple-950/40 via-transparent to-slate-950/70'
            : 'from-purple-950/20 via-transparent to-slate-950/50'
        } pointer-events-none`}
      />

      {/* Contestant identifier */}
      {participantName && (
        <div className={`mb-4 text-center z-10 ${isLarge ? 'scale-105' : ''}`}>
          <span className={`${isLarge ? 'text-xs sm:text-sm tracking-[0.2em]' : 'text-xs tracking-widest'} uppercase text-purple-400 font-bold`}>
            Speaking Now
          </span>
          <h2 className={`${isLarge ? 'text-3xl sm:text-4xl md:text-5xl mt-1' : 'text-2xl sm:text-3xl'} font-black text-white font-['Outfit'] tracking-tight`}>
            {participantName}
          </h2>
        </div>
      )}

      {/* Phase Badge & Warning Badge */}
      <div className={`mb-4 z-10 flex flex-wrap items-center justify-center gap-2 ${isLarge ? 'scale-105' : ''}`}>
        <span
          className={`${
            isLarge ? 'px-6 py-2 text-sm font-black' : 'px-4 py-1.5 text-xs font-black'
          } rounded-full uppercase tracking-widest border transition-all duration-300 shadow-lg ${badgeColor}`}
        >
          {phaseLabel}
        </span>
        {warningBuzzerEnabled && (warningTimeSeconds ?? 0) > 0 && phase === 'speech' && (
          <span
            className={`${
              isLarge ? 'px-4 py-1.5 text-xs' : 'px-3 py-1 text-[10px]'
            } rounded-full font-mono font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-1.5 ${
              remainingSeconds <= (warningTimeSeconds ?? 30) && remainingSeconds > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 animate-pulse'
                : 'bg-slate-800/80 text-blue-300 border-blue-500/30'
            }`}
          >
            <Bell className={`${isLarge ? 'w-4 h-4' : 'w-3 h-3'} text-blue-400`} />
            <span>
              {remainingSeconds <= (warningTimeSeconds ?? 30) && remainingSeconds > 0
                ? 'Warning Alert Active'
                : `Warning at ${warningTimeSeconds}s`}
            </span>
          </span>
        )}
      </div>

      {/* Circular Animated Countdown Dial */}
      <div
        className={`relative ${
          isLarge
            ? 'w-80 h-80 sm:w-96 sm:h-96 md:w-[420px] md:h-[420px] lg:w-[460px] lg:h-[460px] xl:w-[520px] xl:h-[520px] 2xl:w-[580px] 2xl:h-[580px]'
            : 'w-64 h-64 sm:w-72 sm:h-72'
        } flex items-center justify-center z-10`}
      >
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
          {/* Background track */}
          <circle
            cx={centerCoord}
            cy={centerCoord}
            r={radius}
            className="stroke-slate-800/80"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated active track */}
          <circle
            cx={centerCoord}
            cy={centerCoord}
            r={radius}
            className={`${ringColor} transition-all duration-300 ease-linear`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center Timer Typography */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
          {isOvertime ? (
            <div className="flex flex-col items-center animate-pulse">
              <span
                className={`${
                  isLarge ? 'text-7xl sm:text-8xl md:text-9xl xl:text-[9.5rem]' : 'text-5xl sm:text-6xl'
                } font-extrabold text-rose-400 font-mono tracking-tight drop-shadow-[0_4px_24px_rgba(244,63,94,0.8)]`}
              >
                +{formatTime(overtimeSeconds)}
              </span>
              <span
                className={`${
                  isLarge ? 'text-sm sm:text-base font-bold tracking-[0.2em] mt-2' : 'text-xs font-bold tracking-widest mt-1'
                } text-rose-300 uppercase`}
              >
                Overtime Active
              </span>
            </div>
          ) : phase === 'time_up' ? (
            <div className="animate-bounce">
              <span
                className={`${
                  isLarge ? 'text-6xl sm:text-7xl md:text-8xl xl:text-9xl' : 'text-4xl sm:text-5xl'
                } font-black text-rose-500 font-['Outfit'] tracking-tighter`}
              >
                TIME UP!
              </span>
              <p
                className={`${
                  isLarge ? 'text-sm sm:text-base font-bold tracking-wider mt-2' : 'text-xs font-bold tracking-wider mt-1'
                } text-rose-300 uppercase`}
              >
                Buzzer Triggered
              </p>
            </div>
          ) : (
            <>
              <span
                className={`${
                  isLarge ? 'text-7xl sm:text-8xl md:text-9xl xl:text-[9.5rem]' : 'text-5xl sm:text-6xl'
                } font-extrabold text-white font-mono tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]`}
              >
                {formatTime(remainingSeconds)}
              </span>
              <span
                className={`${
                  isLarge ? 'text-xs sm:text-sm font-semibold tracking-[0.2em] mt-2' : 'text-xs font-semibold tracking-widest mt-1'
                } text-slate-400 uppercase`}
              >
                {phase === 'prep' ? 'Prep Countdown' : phase === 'speech' ? 'Speech Remaining' : 'Ready'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actual Speech Duration summary if stopped or completed */}
      {(phase === 'stopped' || phase === 'time_up') && (
        <div
          className={`mt-4 ${
            isLarge ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-xs'
          } rounded-xl bg-slate-950/80 border border-slate-800 text-center z-10`}
        >
          <span className="text-slate-400">Actual Speech Duration: </span>
          <span className={`${isLarge ? 'text-base font-extrabold' : 'text-sm font-bold'} text-purple-300 font-mono`}>
            {formatTime(actualSpeechElapsed)} ({actualSpeechElapsed} seconds)
          </span>
        </div>
      )}

      {/* Large Event Controller Action Buttons */}
      <div className={`mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 z-10 w-full ${isLarge ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* START / PAUSE / RESUME */}
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={phase === 'time_up' || phase === 'stopped' || (phase === 'idle' && !canStart)}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2.5 ${
              isLarge ? 'py-4 px-8 text-base font-black rounded-2xl' : 'py-3.5 px-6 font-extrabold text-sm rounded-2xl'
            } uppercase tracking-wider shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
              phase === 'idle' && !canStart
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-amber-950/60'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 hover:shadow-emerald-900/60'
            }`}
            title={phase === 'idle' && !canStart ? cannotStartReason || 'Check-in required before starting' : undefined}
          >
            {phase === 'idle' && !canStart ? (
              <>
                <Lock className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'} text-amber-400`} />
                <span>CHECK-IN REQUIRED</span>
              </>
            ) : (
              <>
                <Play className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'} fill-current`} />
                <span>{phase === 'idle' ? 'START' : 'RESUME'}</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2.5 ${
              isLarge ? 'py-4 px-8 text-base font-black rounded-2xl' : 'py-3.5 px-6 font-extrabold text-sm rounded-2xl'
            } bg-amber-600 hover:bg-amber-500 text-white uppercase tracking-wider shadow-lg shadow-amber-950/60 active:scale-95 transition-all`}
          >
            <Pause className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'} fill-current`} />
            <span>PAUSE</span>
          </button>
        )}

        {/* STOP (Saves speech duration immediately) */}
        <button
          onClick={handleStop}
          disabled={phase === 'idle' || phase === 'stopped' || phase === 'time_up'}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2.5 ${
            isLarge ? 'py-4 px-8 text-base font-black rounded-2xl' : 'py-3.5 px-6 font-extrabold text-sm rounded-2xl'
          } bg-rose-600 hover:bg-rose-500 text-white uppercase tracking-wider shadow-lg shadow-rose-950/60 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
          title="Manual stop records actual elapsed speech time"
        >
          <Square className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'} fill-current`} />
          <span>STOP</span>
        </button>

        {/* RESET (Requires confirmation) */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className={`${
            isLarge ? 'py-4 px-6 rounded-2xl' : 'py-3.5 px-5 rounded-2xl'
          } bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-sm tracking-wider border border-slate-700/80 active:scale-95 transition-all`}
          title="Reset timer (Shortcut: R)"
        >
          <RotateCcw className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'}`} />
        </button>

        {/* SKIP PREP / START SPEECH DIRECTLY */}
        {hasPrepPhase && (phase === 'prep' || (phase === 'idle' && !isRunning)) && (
          <button
            onClick={() => {
              if (phase === 'idle' && !canStart) {
                alert(cannotStartReason || 'Contestant must check in to location before starting Round 1.');
                return;
              }
              handleTransitionToSpeech();
            }}
            disabled={phase === 'idle' && !canStart}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-purple-600/90 hover:bg-purple-600 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-purple-950/60 active:scale-95 border border-purple-400/30 transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={phase === 'idle' && !canStart ? cannotStartReason : 'Start speech timer immediately (skipping prep)'}
          >
            <Zap className="w-5 h-5" />
            <span>{phase === 'prep' ? 'Skip Prep ➔ Start Speech Now' : 'Start Speech Directly (Skip Prep)'}</span>
          </button>
        )}
      </div>

      {/* Notice if check-in is required */}
      {phase === 'idle' && !canStart && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-center gap-2 text-center max-w-lg z-10 animate-in fade-in shadow-lg">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{cannotStartReason || 'Contestant must check in to location before starting Round 1.'}</span>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 text-center animate-in fade-in zoom-in-95 duration-150">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
          <h3 className="text-xl font-bold text-white font-['Outfit'] mb-1">Reset Current Timer?</h3>
          <p className="text-xs text-slate-300 max-w-sm mb-6">
            Resetting will stop the current countdown and return to the initial starting duration.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={executeReset}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50"
            >
              Yes, Reset Timer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
