import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock,
  ChevronRight,
  Sparkles,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Zap,
  Award,
  Bell,
  Lock,
  Shuffle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Timer, TimerPhase } from '../components/common/Timer';
import { ParticipantSearchInput } from '../components/common/ParticipantSearchInput';
import { isParticipantCheckedIn, isParticipantRoundCompleted } from '../lib/participantUtils';
import type { Round3Result, Participant } from '../types';

export const Round3: React.FC = () => {
  const {
    db,
    activeParticipant,
    setActiveParticipant,
    selectNextParticipant,
    saveRound3Result,
    currentStationId,
    setCurrentStationId,
    currentStation,
    allStations,
    setCurrentPage,
    setStationParticipant,
    currentEventRound,
    round3PermissionGranted,
    getGlobalRoundProgress,
    getStationRoundProgress,
  } = useApp();

  // Round 2 qualification workflow:
  // Contestants who are qualified in Round 2 AND checked in advance to Round 3 (Championship Finals).
  // If no one is marked qualified yet, allow checked-in station participants so round can still be operated.
  const round2Qualifiers = useMemo(() => {
    return (db?.participants || []).filter((p) => p.round2Qualified === 'qualified' && isParticipantCheckedIn(p));
  }, [db?.participants]);

  const stationParticipants = useMemo(() => {
    if (!db?.participants) return [];
    const pool = db.participants.filter((p) => isParticipantCheckedIn(p));
    if (!currentStationId || currentStationId === 'all') return pool;
    return pool.filter((p) => p.stationId === currentStationId);
  }, [db?.participants, currentStationId]);

  const eligibleRound3Participants = useMemo(() => {
    return round2Qualifiers.length > 0 ? round2Qualifiers : stationParticipants;
  }, [round2Qualifiers, stationParticipants]);

  // Station-filtered eligible finalists for Round 3
  const stationEligibleRound3Participants = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') {
      return eligibleRound3Participants;
    }
    const filtered = eligibleRound3Participants.filter((p) => p.stationId === currentStationId);
    return filtered.length > 0 ? filtered : eligibleRound3Participants;
  }, [eligibleRound3Participants, currentStationId]);

  // Completed finalists in Round 3
  const completedRound3Participants = useMemo(() => {
    return stationEligibleRound3Participants.filter((p) => isParticipantRoundCompleted(p, 3, db));
  }, [stationEligibleRound3Participants, db]);

  // Pending (not completed) finalists in Round 3
  const pendingRound3Participants = useMemo(() => {
    return stationEligibleRound3Participants.filter((p) => !isParticipantRoundCompleted(p, 3, db));
  }, [stationEligibleRound3Participants, db]);

  const isCurrentParticipantCompleted = Boolean(
    activeParticipant && isParticipantRoundCompleted(activeParticipant, 3, db)
  );

  const [contestantSearch, setContestantSearch] = useState('');

  // Filtered lists based on search query (by ID, #number, name, or phone)
  const filteredPendingParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return pendingRound3Participants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return pendingRound3Participants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [pendingRound3Participants, contestantSearch]);

  const filteredCompletedParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return completedRound3Participants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return completedRound3Participants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [completedRound3Participants, contestantSearch]);

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

  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [lastSavedResult, setLastSavedResult] = useState<Round3Result | null>(null);

  const speechSeconds = db?.settings?.round3?.speechTimeSeconds ?? 120;
  const buzzerEnabled = db?.settings?.round3?.buzzerEnabled ?? true;
  const warningBuzzerEnabled = db?.settings?.round3?.warningBuzzerEnabled ?? true;
  const warningTimeSeconds = db?.settings?.round3?.warningTimeSeconds ?? 30;



  const handleTimerFinish = useCallback(
    async (data: {
      status: 'completed' | 'completed_early' | 'time_up';
      prepDurationSeconds: number;
      speechDurationSeconds: number;
      startTime: string;
      endTime: string;
    }) => {
      if (!activeParticipant) return;

      const resultPayload = {
        participantId: activeParticipant.id,
        participantNumber: activeParticipant.participantNumber,
        participantName: activeParticipant.name,
        mobile: activeParticipant.mobile || activeParticipant.phone || activeParticipant.customData?.phone || '',
        speechDurationSeconds: data.speechDurationSeconds,
        targetSpeechDurationSeconds: speechSeconds,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
      };

      const saved = await saveRound3Result(resultPayload);
      setLastSavedResult(saved);
      // Retain the current finalist on screen after stopping the timer.
      // Do NOT auto-advance; the operator will explicitly pick the next finalist when ready.
    },
    [
      activeParticipant,
      speechSeconds,
      saveRound3Result,
      pendingRound3Participants,
      currentStationId,
      setStationParticipant,
      setActiveParticipant,
    ]
  );

  if (currentEventRound < 3 || !round3PermissionGranted) {
    const priorRound = (currentEventRound === 1 ? 1 : 2) as 1 | 2;
    const priorProg = getGlobalRoundProgress(priorRound);
    const priorPct = priorProg.arrivedCount > 0 ? Math.round((priorProg.completed / priorProg.arrivedCount) * 100) : (priorProg.total > 0 ? Math.round((priorProg.completed / priorProg.total) * 100) : 0);

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
              Round 3 (The Mystery Cartridge) Pending Authorization
            </h1>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              Per competition rules, all station stages must finish Round 1 and Round 2, and Master Supervisor must authorize Round 3 (The Mystery Cartridge) before operators can begin.
            </p>
          </div>

          {/* Current Round Global Progress Bar */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Round {priorRound} Progress</span>
              <span className="text-white font-mono font-bold">
                {priorProg.completed} / {priorProg.arrivedCount || priorProg.total} ({priorPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
                style={{ width: `${priorPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>
                {priorProg.remaining === 0
                  ? 'All contestants done! Awaiting Master authorization.'
                  : `${priorProg.remaining} contestants still remaining`}
                {priorProg.absentCount > 0 && ` (${priorProg.absentCount} absent / no-show)`}
              </span>
              <span className="text-purple-300 font-mono">Round {priorRound}</span>
            </div>
          </div>

          {/* Per Station Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
            {allStations.map((st) => {
              const prog = getStationRoundProgress(st.id, priorRound);
              return (
                <div key={st.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white truncate">{st.name || 'Station'}</span>
                  {prog.isComplete && (prog.arrivedCount > 0 || prog.total > 0) ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Finished ({prog.completed}/{prog.arrivedCount || prog.total})
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">
                      {prog.completed}/{prog.arrivedCount || prog.total} Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Navigation */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(currentEventRound === 1 ? 'round1' : 'round2')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-purple-950/80 flex items-center gap-2 transition-all hover:scale-105"
            >
              <span>Go to Active Stage (Round {currentEventRound})</span>
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
      {/* Station Finished Finals Notice */}
      {(() => {
        const r3StationProg = currentStationId && currentStationId !== 'all' ? getStationRoundProgress(currentStationId, 3) : null;
        if (currentEventRound === 3 && r3StationProg && r3StationProg.isComplete && r3StationProg.total > 0) {
          return (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="font-extrabold text-white text-sm block">
                    Championship Finals Finished for this Stage ({r3StationProg.completed}/{r3StationProg.total} Finalists)
                  </span>
                  <span className="text-xs text-amber-300/90">
                    All finalists for this station have concluded their speeches. View rankings in Results & Ranks!
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('results')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shrink-0 self-start sm:self-center transition-colors"
              >
                View Results & Ranks
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-purple-900/30 p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
                ROUND 3 (FINALS)
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                The Mystery Cartridge
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Duration: {speechSeconds}s • Precision Audio Warnings • Automatic Klaxon Buzzer
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
              className="bg-transparent text-emerald-300 font-semibold focus:outline-none"
            >
              {allStations.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} (Round {s.currentRound})
                </option>
              ))}
              <option value="all" className="bg-slate-900 text-emerald-300 font-bold">
                All Stations (View All)
              </option>
            </select>
          </div>

          {/* Active / Pending Finalists Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              Finalist:
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
                  pendingRound3Participants.find((item) => item.id === targetId) ||
                  stationEligibleRound3Participants.find((item) => item.id === targetId) ||
                  db?.participants.find((item) => item.id === targetId);
                if (p) {
                  handleSelectContestant(p);
                }
              }}
              className="bg-transparent text-white font-bold font-['Outfit'] focus:outline-none max-w-[210px] truncate cursor-pointer"
            >
              {/* Ensure an option matching value={activeParticipant.id} always exists */}
              {activeParticipant && !filteredPendingParticipants.some((p) => p.id === activeParticipant.id) && (
                <option value={activeParticipant.id} className="bg-slate-900 text-emerald-300 font-bold">
                  #{activeParticipant.participantNumber} — {activeParticipant.name} {isCurrentParticipantCompleted ? '(Completed) ✓' : ''}
                </option>
              )}
              {filteredPendingParticipants.length > 0 && (!activeParticipant || isCurrentParticipantCompleted) && (
                <option value="" disabled className="bg-slate-950 text-slate-500">
                  ── Select Next Finalist ({filteredPendingParticipants.length} remaining) ──
                </option>
              )}
              {filteredPendingParticipants.length === 0 && !activeParticipant && (
                <option value="" disabled className="bg-slate-900 text-amber-400">
                  {contestantSearch.trim()
                    ? `No checked-in finalists match "${contestantSearch}"`
                    : completedRound3Participants.length > 0
                    ? `All eligible finalists completed (${completedRound3Participants.length})`
                    : `No checked-in eligible finalists in ${currentStation?.name || 'this station'}`}
                </option>
              )}
              {filteredPendingParticipants.map((p) => {
                const isR2Qual = p.round2Qualified === 'qualified';
                return (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    #{p.participantNumber} — {p.name} {isR2Qual ? '★ [R2 QUALIFIED]' : ''}
                  </option>
                );
              })}
            </select>

            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                pendingRound3Participants.length > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {pendingRound3Participants.length} Remaining
            </span>
          </div>

          {/* Completed Finalists Dropdown */}
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
                  completedRound3Participants.find((item) => item.id === targetId) ||
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
                  : `Completed (${completedRound3Participants.length})`}
              </option>
              {filteredCompletedParticipants.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-emerald-300">
                  #{p.participantNumber} — {p.name} ✓
                </option>
              ))}
            </select>
            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${
                completedRound3Participants.length > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={`${completedRound3Participants.length} of ${stationEligibleRound3Participants.length} finalists completed Round 3`}
            >
              {completedRound3Participants.length} Done
            </span>
          </div>

          {/* Quick Search Finalist Pill */}
          <ParticipantSearchInput
            searchQuery={contestantSearch}
            onSearchChange={setContestantSearch}
            pendingParticipants={pendingRound3Participants}
            completedParticipants={completedRound3Participants}
            activeParticipantId={activeParticipant?.id}
            onSelectParticipant={handleSelectContestant}
            placeholder="Search #ID or name..."
          />

          {/* Pick Random Contestant Button */}
          <button
            onClick={() => {
              const pool = pendingRound3Participants.length > 0
                ? pendingRound3Participants
                : (stationEligibleRound3Participants.length > 0 ? stationEligibleRound3Participants : []);
              if (pool.length === 0) return;
              const unchosen = pool.filter((p) => p.id !== activeParticipant?.id);
              const candidates = unchosen.length > 0 ? unchosen : pool;
              const picked = candidates[Math.floor(Math.random() * candidates.length)];
              handleSelectContestant(picked);
            }}
            disabled={pendingRound3Participants.length === 0 && stationEligibleRound3Participants.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800/40 text-xs font-bold transition-all shadow-md disabled:opacity-40 cursor-pointer"
            title="Randomly choose a championship finalist for this station"
          >
            <Shuffle className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Random</span>
          </button>

          <button
            onClick={() => {
              const list = pendingRound3Participants.length > 0
                ? pendingRound3Participants
                : (stationEligibleRound3Participants.length > 0 ? stationEligibleRound3Participants : undefined);
              selectNextParticipant(list);
            }}
            disabled={pendingRound3Participants.length === 0 && stationEligibleRound3Participants.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50 disabled:opacity-40 cursor-pointer"
            title="Next Participant (Shortcut: N)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Round 2 Qualification Workflow Notice Banner */}
      {round2Qualifiers.length === 0 ? (
        <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl text-xs text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">Round 2 Qualification Enforced:</span> Only contestants who qualify in Round 2 appear in Round 3 (Championship Finals). Currently, 0 participants are marked as qualified in Round 2.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentPage('round2')}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow"
            >
              Go to Round 2
            </button>
            <button
              onClick={() => setCurrentPage('participants')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              Qualify in Participants Roster
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Championship Finals Roster:</strong> Showing only the {round2Qualifiers.length} finalist(s) qualified from Round 2.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <button
              onClick={() => setCurrentPage('participants')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
            >
              Manage Qualifications
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Contestant Spotlight Stage & Timer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Contestant Stage Info Card */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-purple-900/30 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Finalist Stage Spotlight
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              {activeParticipant?.participantNumber || 'NO SELECTION'}
            </span>
          </div>

          {activeParticipant ? (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-indigo-950/40 border border-emerald-800/40 space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Active Speaker on Podium
                </span>
                <h2 className="text-3xl font-black text-white font-['Outfit']">
                  {activeParticipant.name}
                </h2>
                {(activeParticipant.mobile || activeParticipant.phone) && (
                  <p className="text-sm font-semibold text-slate-300 font-mono">
                    {activeParticipant.mobile || activeParticipant.phone}
                  </p>
                )}
              </div>

              {/* Progress Summary in Previous Rounds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Round 1 Milestone</span>
                    {activeParticipant.round1Qualified === 'qualified' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> QUALIFIED
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-blue-300 font-['Outfit']">
                    Speech: {activeParticipant.round1Status === 'completed' ? 'Completed' : activeParticipant.round1Status || 'Pending'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeParticipant.round1Qualified === 'qualified'
                      ? '✓ Advanced to Round 2'
                      : 'Not qualified in Round 1'}
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Round 2 Milestone</span>
                    {activeParticipant.round2Qualified === 'qualified' ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> QUALIFIED
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-purple-300 font-['Outfit']">
                    Speech: {activeParticipant.round2Status === 'completed' ? 'Completed' : activeParticipant.round2Status || 'Pending'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeParticipant.round2Qualified === 'qualified'
                      ? '✓ Advanced to Championship Finals'
                      : 'Round 2 qualification required'}
                  </div>
                </div>
              </div>

              {/* Finalist Status Badge */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  {activeParticipant.round2Qualified === 'qualified'
                    ? 'Qualified in Round 2 • Official Grand Finalist'
                    : 'Contestant speaking in Override Mode'}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400/80">ROUND 3 PODIUM</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p>No participant selected. Please choose a contestant from the top bar.</p>
            </div>
          )}

          {/* Last Result Log */}
          {lastSavedResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">
                  Final speech saved for <strong>{lastSavedResult.participantName}</strong>:{' '}
                  <span className="text-emerald-300 font-mono font-bold">
                    {lastSavedResult.speechDurationSeconds}s
                  </span>{' '}
                  ({lastSavedResult.status})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(lastSavedResult.endTime).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Timer Engine */}
        <div className="lg:col-span-5 space-y-4">
          <Timer
            prepDurationSeconds={0}
            speechDurationSeconds={speechSeconds}
            hasPrepPhase={false}
            participantName={activeParticipant?.name}
            roundName="Round 3"
            buzzerEnabled={buzzerEnabled}
            warningBuzzerEnabled={warningBuzzerEnabled}
            warningTimeSeconds={warningTimeSeconds}
            stationId={currentStationId || undefined}
            onPhaseChange={setTimerPhase}
            onFinish={handleTimerFinish}
          />

          {/* Round 3 Warning Buzzer Status & Shortcut */}
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
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
              className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 hover:text-white border border-emerald-500/40 font-semibold text-[11px] transition-all cursor-pointer shrink-0"
            >
              Configure Timing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
