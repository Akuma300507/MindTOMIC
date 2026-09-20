import type { Participant } from '../types';

/**
 * Checks if a participant is marked as arrived/checked in at the venue or station.
 */
export function isParticipantCheckedIn(p?: Participant | null): boolean {
  if (!p) return false;
  if (p.checkedIn === false) return false;
  if (p.status === 'absent') return false;
  return Boolean(p.checkedIn === true || p.status === 'checked_in' || p.checkedInAt);
}

/**
 * Checks if a participant has completed their turn/speech in the specified round.
 */
export function isParticipantRoundCompleted(
  p?: Participant | null,
  round: 1 | 2 | 3 = 1,
  db?: { round1Results?: any[]; round2Results?: any[]; round3Results?: any[] } | null
): boolean {
  if (!p) return false;
  if (round === 1) {
    const hasResult = Boolean(db?.round1Results?.some((r) => r.participantId === p.id));
    const statusDone =
      p.round1Status === 'completed' ||
      p.round1Status === 'completed_early' ||
      p.round1Status === 'time_up';
    return hasResult || statusDone;
  }
  if (round === 2) {
    const hasResult = Boolean(db?.round2Results?.some((r) => r.participantId === p.id));
    const statusDone =
      p.round2Status === 'completed' ||
      p.round2Status === 'completed_early' ||
      p.round2Status === 'time_up';
    return hasResult || statusDone;
  }
  if (round === 3) {
    const hasResult = Boolean(db?.round3Results?.some((r) => r.participantId === p.id));
    const statusDone =
      p.round3Status === 'completed' ||
      p.round3Status === 'completed_early' ||
      p.round3Status === 'time_up';
    return hasResult || statusDone;
  }
  return false;
}
