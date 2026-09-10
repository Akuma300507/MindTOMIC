/**
 * Shared mathematical timer calculator based on backend timestamps.
 * Guarantees zero-drift synchronization across Master, Station, and Projector.
 */

import type { StationState, LiveSyncState } from '../types';
import { getServerNow } from './timeSync';

export interface ComputedTimerState {
  phase: 'idle' | 'prep' | 'speech' | 'stopped' | 'time_up';
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'time_up';
  isRunning: boolean;
  durationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isOvertime: boolean;
  overtimeSeconds: number;
  buzzerTriggered: boolean;
  formattedCountdown: string;
  formattedElapsed: string;
  formattedOvertime: string;
  progressPercent: number;
}

export function formatTimeMMSS(totalSeconds: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeStationTimer(
  station: StationState | LiveSyncState | null | undefined,
  nowMs: number = getServerNow()
): ComputedTimerState {
  if (!station) {
    return {
      phase: 'idle',
      status: 'idle',
      isRunning: false,
      durationSeconds: 120,
      elapsedSeconds: 0,
      remainingSeconds: 120,
      isOvertime: false,
      overtimeSeconds: 0,
      buzzerTriggered: false,
      formattedCountdown: '02:00',
      formattedElapsed: '00:00',
      formattedOvertime: '+00:00',
      progressPercent: 0,
    };
  }

  const phase = station.timerMode || 'idle';
  const duration = station.timerDuration || station.timerTotalSeconds || 120;
  const isRunning = Boolean(station.isTimerRunning);
  const status = station.timerStatus || (isRunning ? 'running' : 'idle');

  // Calculate elapsed milliseconds from backend timestamps
  const accumulatedMs = station.timerAccumulatedMs || 0;
  let runningElapsedMs = 0;

  const startTime = station.timerStartTime || station.timerStartedAt;
  if (isRunning && startTime) {
    runningElapsedMs = Math.max(0, nowMs - startTime);
  } else if (!isRunning && station.timerStopTime && startTime) {
    runningElapsedMs = Math.max(0, station.timerStopTime - startTime);
  } else if (isRunning && !startTime && station.timerEndsAt) {
    // Fallback if only timerEndsAt was provided
    const endsIn = Math.max(0, Math.ceil((station.timerEndsAt - nowMs) / 1000));
    runningElapsedMs = Math.max(0, (duration - endsIn) * 1000);
  }

  const totalElapsedMs = accumulatedMs + runningElapsedMs;
  const totalElapsedSecs = Math.floor(totalElapsedMs / 1000);

  // In speech phase: countdown down to 0, then overtime
  // In prep phase: clamped at duration
  let remainingSeconds = Math.max(0, duration - totalElapsedSecs);

  // If stopped before starting or idle
  if (phase === 'idle') {
    remainingSeconds = duration;
  }

  const isOvertime = phase === 'speech' && totalElapsedSecs >= duration && duration > 0;
  const overtimeSeconds = isOvertime ? totalElapsedSecs - duration : 0;
  const buzzerTriggered = Boolean(station.buzzerPlayed || (phase === 'speech' && totalElapsedSecs >= duration));

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (totalElapsedSecs / duration) * 100)) : 0;

  return {
    phase,
    status,
    isRunning,
    durationSeconds: duration,
    elapsedSeconds: totalElapsedSecs,
    remainingSeconds,
    isOvertime,
    overtimeSeconds,
    buzzerTriggered,
    formattedCountdown: formatTimeMMSS(remainingSeconds),
    formattedElapsed: formatTimeMMSS(totalElapsedSecs),
    formattedOvertime: `+${formatTimeMMSS(overtimeSeconds)}`,
    progressPercent,
  };
}
