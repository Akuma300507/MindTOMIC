import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Radio,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Zap,
  Image as ImageIcon,
  Disc,
  User,
  Users,
  AlertTriangle,
  Tv,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  UserPlus,
  UserCheck,
  Phone,
  Bell,
  Edit3,
  Shuffle,
  Filter,
  Check,
  X,
  Plus,
  Monitor,
  MapPin,
  Lock,
  Unlock,
  ArrowRight,
  Trophy,
  UserX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeStationTimer } from '../lib/timerUtils';
import { getServerNow } from '../lib/timeSync';
import { MindToMicLogo } from '../components/common/MindToMicLogo';
import { isParticipantCheckedIn, type StationState, type StationStatus, type Participant, type ProjectorDevice } from '../types';

export const Master: React.FC = () => {
  const {
    allStations,
    db,
    setStationRound,
    setStationParticipant,
    updateStationHandler,
    pingStation,
    batchSetStation,
    sendStationTimerAction,
    requestResetAllStatuses,
    claimStation,
    setCurrentPage,
    setCurrentStationId,
    setDeviceRole,
    connectedProjectors,
    assignProjectorStation,
    pingProjectorDevice,
    refreshConnectedProjectors,
    reloadState,
    checkInParticipant,
    currentEventRound,
    round2PermissionGranted,
    round3PermissionGranted,
    grantStagePermission,
    advanceCompetitionRound,
    getStationRoundProgress,
    getGlobalRoundProgress,
  } = useApp();

  const safeProjectors: ProjectorDevice[] = Array.isArray(connectedProjectors)
    ? connectedProjectors
    : ((connectedProjectors as any)?.projectors || []);

  const [selectedRoundFilter, setSelectedRoundFilter] = useState<'all' | '1' | '2' | '3'>('all');

  // Modals and tool states
  const [editingHandlerStation, setEditingHandlerStation] = useState<StationState | null>(null);
  const [rosterStation, setRosterStation] = useState<StationState | null>(null);
  const [showDistributeModal, setShowDistributeModal] = useState<boolean>(false);
  const [targetStationForAllocation, setTargetStationForAllocation] = useState<string>('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [overrideFilter, setOverrideFilter] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pingingProjectId, setPingingProjectId] = useState<string | null>(null);
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null);

  // Synchronized Round Stage Permission Modal State
  const [stagePermissionModal, setStagePermissionModal] = useState<{
    targetRound: 2 | 3;
    isForce: boolean;
    arrivedCount: number;
    completedCount: number;
    absentCount: number;
    totalRegistered: number;
    markAbsent: boolean;
    pendingArrivedContestants: Array<{ id: string; name: string; stationName: string; participantNumber: string }>;
    absentContestants: Array<{ id: string; name: string; stationName: string; participantNumber: string }>;
  } | null>(null);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);

  const handleInitiateAdvance = (targetRound: 1 | 2 | 3) => {
    if (targetRound === 1) {
      if (confirm('Return all stations to Round 1? Current station active media will be reset.')) {
        advanceCompetitionRound(1, true).then((res) => {
          setToastMessage(res.message || 'All stations switched to Round 1.');
          setTimeout(() => setToastMessage(null), 3500);
        });
      }
      return;
    }

    const priorRound = (targetRound === 2 ? 1 : 2) as 1 | 2;
    const progress = getGlobalRoundProgress(priorRound);

    const pendingArrived = progress.pendingParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      stationName: p.stationName || 'Station',
      participantNumber: p.participantNumber || '',
    }));

    const absentees = progress.absentParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      stationName: p.stationName || 'Station',
      participantNumber: p.participantNumber || '',
    }));

    setStagePermissionModal({
      targetRound: targetRound as 2 | 3,
      isForce: !progress.isComplete,
      arrivedCount: progress.arrivedCount,
      completedCount: progress.completed,
      absentCount: progress.absentCount,
      totalRegistered: progress.total,
      markAbsent: true,
      pendingArrivedContestants: pendingArrived,
      absentContestants: absentees,
    });
  };

  const handleConfirmStagePermission = async () => {
    if (!stagePermissionModal) return;
    setIsAdvancing(true);
    const res = await grantStagePermission(
      stagePermissionModal.targetRound,
      stagePermissionModal.markAbsent,
      stagePermissionModal.isForce
    );
    setIsAdvancing(false);
    if (res.success) {
      setToastMessage(
        res.message ||
        `Permission granted! All stations advanced to Round ${stagePermissionModal.targetRound}.`
      );
      setStagePermissionModal(null);
    } else {
      setToastMessage(`Action blocked: ${res.message}`);
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Station Handler Edit Form
  const [handlerForm, setHandlerForm] = useState({
    name: '',
    location: '',
    handlerName: '',
    handlerPhone: '',
    handlerRole: 'Stage Lead',
    handlerStatus: 'ready' as 'ready' | 'active' | 'on_break' | 'busy' | 'away',
    handlerNotes: '',
  });

  // Ensure fresh state and projector list on mount
  useEffect(() => {
    reloadState?.();
    refreshConnectedProjectors?.();
  }, [reloadState, refreshConnectedProjectors]);

  // Live millisecond reference synchronized with projector & backend (clock-synced)
  const [nowMs, setNowMs] = useState<number>(() => getServerNow());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(getServerNow());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const openEditHandler = (station: StationState) => {
    setEditingHandlerStation(station);
    setHandlerForm({
      name: station.name || '',
      location: station.location || '',
      handlerName: station.handlerName || '',
      handlerPhone: station.handlerPhone || '',
      handlerRole: station.handlerRole || 'Stage Lead',
      handlerStatus: (station.handlerStatus as any) || 'ready',
      handlerNotes: station.handlerNotes || '',
    });
  };

  const handleSaveHandler = async () => {
    if (!editingHandlerStation) return;
    await updateStationHandler(editingHandlerStation.id, handlerForm);
    setToastMessage(`Updated handler for ${editingHandlerStation.name}!`);
    setTimeout(() => setToastMessage(null), 3500);
    setEditingHandlerStation(null);
  };

  const handlePingStation = async (stationId: string, stationName: string, handlerName?: string | null) => {
    await pingStation(stationId, 'Master Supervisor', `Master Supervisor pinged ${stationName}!`);
    setToastMessage(`Ping alert sent to ${stationName}${handlerName ? ` (${handlerName})` : ''}!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getStatusBadge = (status: StationStatus) => {
    switch (status) {
      case 'SPEAKING':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse';
      case 'PREPARING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'SPINNING':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      case 'TIME_UP':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-bounce';
      case 'PAUSED':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'WAITING':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  // Filter stations
  const filteredStations = useMemo(() => {
    if (selectedRoundFilter === 'all') return allStations;
    const r = parseInt(selectedRoundFilter, 10);
    return allStations.filter((s) => s.currentRound === r);
  }, [allStations, selectedRoundFilter]);

  // Overall event metrics
  const activeSpeakingCount = allStations.filter(
    (s) => s.status === 'SPEAKING' || s.status === 'PREPARING'
  ).length;
  const onlineStationsCount = allStations.filter((s) => {
    const isClaimed = s.claimedByDeviceId || s.controllerDeviceId;
    if (!isClaimed) return false;
    return Date.now() - (s.lastHeartbeat || 0) < 25000;
  }).length;

  const handleTakeOverStation = async (stationId: string) => {
    setDeviceRole('station');
    setCurrentStationId(stationId);
    await claimStation(stationId, true);
    const station = allStations.find((s) => s.id === stationId);
    const round = station?.currentRound || 1;
    if (round === 1) setCurrentPage('round1');
    else if (round === 2) setCurrentPage('round2');
    else setCurrentPage('round3');
  };

  // Unassigned participants calculation
  const unassignedParticipants = useMemo(() => {
    if (!db?.participants) return [];
    return db.participants.filter((p) => !p.stationId || p.stationId.trim() === '');
  }, [db?.participants]);

  // Auto-distribute unassigned contestants evenly across all stations
  const handleAutoDistribute = async () => {
    if (unassignedParticipants.length === 0 || allStations.length === 0) return;
    const distribution: Record<string, string[]> = {};
    allStations.forEach((s) => {
      distribution[s.id] = [];
    });

    unassignedParticipants.forEach((p, index) => {
      const targetStation = allStations[index % allStations.length];
      distribution[targetStation.id].push(p.id);
    });

    for (const station of allStations) {
      const ids = distribution[station.id];
      if (ids && ids.length > 0) {
        await batchSetStation(ids, station.id, station.name);
      }
    }

    setToastMessage(`Auto-distributed ${unassignedParticipants.length} contestants across ${allStations.length} stations!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Bulk assign selected contestants to chosen station
  const handleBulkAssign = async () => {
    if (!targetStationForAllocation || selectedParticipantIds.length === 0) return;
    const target = allStations.find((s) => s.id === targetStationForAllocation);
    await batchSetStation(selectedParticipantIds, targetStationForAllocation, target?.name);
    setToastMessage(`Assigned ${selectedParticipantIds.length} contestants to ${target?.name || 'Station'}!`);
    setTimeout(() => setToastMessage(null), 3500);
    setSelectedParticipantIds([]);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold text-xs shadow-2xl border border-purple-400/40 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-purple-900/40 p-5 md:p-6 rounded-3xl shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-14 px-1 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-600 p-0.5 shadow-xl shadow-purple-950/60 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center px-2 py-1">
              <MindToMicLogo size={36} variant="emblem" showGlow={false} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight font-['Outfit']">
                Master Operations Dashboard
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full">
                ADMIN / MASTER
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-0.5">
              Multi-station supervision, dedicated station handlers, contestant queue isolation, and stage sync.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="master-station-allocation-btn"
            onClick={() => {
              setTargetStationForAllocation(allStations[0]?.id || '');
              setShowDistributeModal(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-bold text-xs uppercase tracking-wider shadow-lg border border-purple-500/40 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Manage contestant station allocation and auto-distribute contestants"
          >
            <Shuffle className="w-4 h-4 text-purple-300" />
            <span>Contestant Allocation</span>
            {unassignedParticipants.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {unassignedParticipants.length} Unassigned
              </span>
            )}
          </button>

          <button
            id="master-reset-all-statuses-btn"
            onClick={requestResetAllStatuses}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-rose-950/70 border border-rose-400/40 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Reset temporary event progress, timers, active stations, and used tags while preserving permanent participant data."
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset All Statuses</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Stations</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white">{allStations.length}</p>
          <span className="text-[10px] text-purple-300">Parallel event stages</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Active Handlers</span>
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-300">
            {allStations.filter((s) => s.handlerName && s.handlerName.trim() !== '').length}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {allStations.length}</span>
          </p>
          <span className="text-[10px] text-slate-400">Assigned stage leads</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Connected Devices</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{onlineStationsCount}</p>
          <span className="text-[10px] text-slate-400">Heartbeat active (&lt;25s)</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Participants</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-400">{db?.participants?.length || 0}</p>
          <span className="text-[10px] text-slate-400">
            {unassignedParticipants.length === 0 ? 'All allocated to stations' : `${unassignedParticipants.length} unallocated`}
          </span>
        </div>
      </div>

      {/* Synchronized Competition Stage Progression Controller */}
      {(() => {
        const round1Prog = getGlobalRoundProgress(1);
        const round2Prog = getGlobalRoundProgress(2);
        const round3Prog = getGlobalRoundProgress(3);

        const r1Pct = round1Prog.arrivedCount > 0 ? Math.round((round1Prog.completed / round1Prog.arrivedCount) * 100) : 0;
        const r2Pct = round2Prog.arrivedCount > 0 ? Math.round((round2Prog.completed / round2Prog.arrivedCount) * 100) : (round2Prog.total > 0 ? Math.round((round2Prog.completed / round2Prog.total) * 100) : 0);
        const r3Pct = round3Prog.arrivedCount > 0 ? Math.round((round3Prog.completed / round3Prog.arrivedCount) * 100) : (round3Prog.total > 0 ? Math.round((round3Prog.completed / round3Prog.total) * 100) : 0);

        return (
          <div className="bg-slate-900/95 border border-purple-800/40 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md space-y-5">
            {/* Header & Status Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-950/60">
                  <Trophy className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg md:text-xl font-black text-white font-['Outfit']">
                      Synchronized Competition Progression
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Active: Round {currentEventRound}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stations progress in sync: Master grants permission to conclude each round and launch the next.
                  </p>
                </div>
              </div>

              {/* Advancement Action Button */}
              <div className="flex items-center gap-2">
                {currentEventRound === 1 && (
                  <button
                    id="master-advance-round2-btn"
                    onClick={() => handleInitiateAdvance(2)}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] ${
                      round1Prog.isComplete
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/70 border border-emerald-400/40 animate-pulse'
                        : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-purple-100 shadow-purple-950/70 border border-purple-500/40'
                    }`}
                  >
                    {round1Prog.isComplete ? <Unlock className="w-4 h-4 text-emerald-300" /> : <Lock className="w-4 h-4 text-amber-400" />}
                    <span>
                      {round1Prog.isComplete
                        ? 'Ready ➔ Grant Permission & Start Round 2'
                        : `Review Attendance & Authorize Round 2 (${round1Prog.remaining} in progress)`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {currentEventRound === 2 && (
                  <button
                    id="master-advance-round3-btn"
                    onClick={() => handleInitiateAdvance(3)}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] ${
                      round2Prog.isComplete
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-950/70 border border-amber-300 animate-pulse'
                        : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-purple-100 shadow-purple-950/70 border border-purple-500/40'
                    }`}
                  >
                    {round2Prog.isComplete ? <Trophy className="w-4 h-4 text-slate-950" /> : <Lock className="w-4 h-4 text-amber-400" />}
                    <span>
                      {round2Prog.isComplete
                        ? 'Ready ➔ Grant Permission & Start Finals'
                        : `Review Attendance & Authorize Finals (${round2Prog.remaining} in progress)`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {currentEventRound === 3 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold">
                    <Trophy className="w-4 h-4" />
                    <span>Championship Finals Active</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Stage Progression Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {/* Stage 1 Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentEventRound === 1
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30'
                    : currentEventRound > 1
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-900/60 flex items-center justify-center font-bold text-xs text-purple-300 font-mono">
                      1
                    </span>
                    <span className="font-extrabold text-sm text-white">Round 1</span>
                  </div>
                  {currentEventRound > 1 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  ) : currentEventRound === 1 ? (
                    round1Prog.isComplete ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready for Round 2
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                        In Progress
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-800 text-slate-400">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-3">Pixel Pictionary</p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Present Evaluated</span>
                    <span className="font-bold text-white font-mono text-xs">
                      {round1Prog.completed} / {round1Prog.arrivedCount} ({r1Pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        round1Prog.isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                      }`}
                      style={{ width: `${r1Pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 pt-0.5 flex items-center justify-between">
                    <span>
                      {round1Prog.remaining === 0
                        ? 'All arrived contestants completed'
                        : `${round1Prog.remaining} arrived waiting`}
                      {round1Prog.absentCount > 0 && ` • ${round1Prog.absentCount} absent`}
                    </span>
                    {currentEventRound === 1 && (
                      <span className="text-purple-300 font-semibold font-mono">Live</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 2 Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentEventRound === 2
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30'
                    : currentEventRound > 2
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-900/60 flex items-center justify-center font-bold text-xs text-purple-300 font-mono">
                      2
                    </span>
                    <span className="font-extrabold text-sm text-white">Round 2</span>
                  </div>
                  {currentEventRound > 2 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  ) : currentEventRound === 2 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                      In Progress
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-800/80 text-slate-400 flex items-center gap-1 border border-slate-700">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-3">Arcade Wheel</p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Qualified Evaluated</span>
                    <span className="font-bold text-white font-mono text-xs">
                      {round2Prog.completed} / {round2Prog.arrivedCount || round2Prog.total} ({r2Pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        round2Prog.isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                      }`}
                      style={{ width: `${r2Pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 pt-0.5">
                    {currentEventRound < 2 ? (
                      <span className="text-amber-400/90 font-medium">Locked until Master authorizes Round 2</span>
                    ) : (
                      <span>
                        {round2Prog.remaining === 0
                          ? 'All qualified finished'
                          : `${round2Prog.remaining} qualified waiting`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 3 Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentEventRound === 3
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center font-bold text-xs text-amber-300 font-mono">
                      3
                    </span>
                    <span className="font-extrabold text-sm text-white">Round 3</span>
                  </div>
                  {currentEventRound === 3 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" /> Finals Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-800/80 text-slate-400 flex items-center gap-1 border border-slate-700">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-3">The Mystery Cartridge</p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Finalists Done</span>
                    <span className="font-bold text-white font-mono text-xs">
                      {round3Prog.completed} / {round3Prog.arrivedCount || round3Prog.total} ({r3Pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        round3Prog.isComplete ? 'bg-amber-400' : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                      }`}
                      style={{ width: `${r3Pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 pt-0.5">
                    {currentEventRound < 3 ? (
                      <span className="text-amber-400/90 font-medium">Locked until Round 2 ends on all stations</span>
                    ) : (
                      <span className="text-amber-300 font-medium">Top finalists competing</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Override Controls Footer */}
            <div className="pt-2 border-t border-purple-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                <span>Station operators are synchronized and locked to Round {currentEventRound}.</span>
              </div>

              {/* Master Manual Stage Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Master Stage Switch:</span>
                {([1, 2, 3] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      if (r === currentEventRound) return;
                      handleInitiateAdvance(r);
                    }}
                    disabled={r === currentEventRound}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      r === currentEventRound
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-default'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    Round {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-purple-900/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Filter:</span>
          {(['all', '1', '2', '3'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRoundFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedRoundFilter === r
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
              }`}
            >
              {r === 'all' ? 'All Stations' : `Round ${r}`}
            </button>
          ))}
        </div>
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStations.map((station) => {
          const isOnline = Boolean(
            (station.claimedByDeviceId || station.controllerDeviceId) &&
            Date.now() - (station.lastHeartbeat || 0) < 25000
          );
          const computedTimer = computeStationTimer(station, nowMs);
          const isRunning = computedTimer.isRunning;
          const remainingSecs = computedTimer.remainingSeconds;
          const totalSecs = computedTimer.durationSeconds;
          const progressPct = computedTimer.progressPercent;
          const isOvertime = computedTimer.isOvertime;
          const timerPhase = computedTimer.phase;

          // STRICT FILTERING (USER REQUIREMENT):
          // Only contestants provided to this station appear in the dropdown unless user overrides
          const isOverridden = !!overrideFilter[station.id];
          const stationParticipants = (db?.participants || []).filter((p) => {
            if (isOverridden) return true;
            if (p.stationId && station.id && p.stationId.toLowerCase().trim() === station.id.toLowerCase().trim()) return true;
            if (p.stationName && station.name && p.stationName.toLowerCase().trim() === station.name.toLowerCase().trim()) return true;
            return false;
          });

          // Next pending contestant for this station (strictly only checked-in contestants!)
          const nextPendingContestant = stationParticipants.find((p) => {
            if (!isParticipantCheckedIn(p)) return false;
            if (station.currentRound === 1) return p.round1Status === 'waiting' || p.round1Status === 'not_started' || p.round1Status === 'pending';
            if (station.currentRound === 2) return p.round2Status === 'waiting' || p.round2Status === 'not_started' || p.round2Status === 'pending';
            return p.round3Status === 'waiting' || p.round3Status === 'not_started' || p.round3Status === 'pending';
          });

          const stationInitial = (station.name || 'Station').substring((station.name || 'Station').length - 1) || 'S';
          const activeDeviceName = station.claimedByDeviceName || station.controllerDeviceName;

          return (
            <div
              key={station.id}
              id={`station-card-${station.id}`}
              className="bg-slate-900/90 border border-purple-900/30 rounded-3xl p-5 shadow-xl hover:border-purple-600/40 transition-all flex flex-col justify-between space-y-4"
            >
              {/* Top Station Header */}
              <div className="flex items-start justify-between gap-3 border-b border-purple-900/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                    {stationInitial}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-white font-['Outfit']">{station.name || 'Station'}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{station.location || 'Stage'}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-purple-300 font-semibold font-mono">
                        Round {station.currentRound || 1}
                      </span>
                      {(() => {
                        const stProg = getStationRoundProgress(station.id, (station.currentRound || 1) as 1 | 2 | 3);
                        return (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              stProg.isComplete
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                            }`}
                            title={`${stProg.completed} of ${stProg.total} contestants finished in this round`}
                          >
                            {stProg.completed}/{stProg.total} {stProg.isComplete ? '✓ Done' : 'Done'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Status and Device Indicator */}
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getStatusBadge(
                      station.status
                    )}`}
                  >
                    {station.status}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-slate-400 font-mono">
                      {activeDeviceName ? activeDeviceName : 'Unclaimed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Station Handler Bar */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-800/40 flex items-center justify-center text-purple-300 text-xs shrink-0">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  {station.handlerName ? (
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{station.handlerName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40 font-semibold shrink-0">
                          {station.handlerRole || 'Handler'}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            station.handlerStatus === 'on_break'
                              ? 'bg-amber-400'
                              : station.handlerStatus === 'busy'
                              ? 'bg-rose-400'
                              : 'bg-emerald-400'
                          }`}
                          title={`Status: ${station.handlerStatus || 'Ready'}`}
                        />
                      </div>
                      {station.handlerPhone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Phone className="w-2.5 h-2.5 text-slate-500" />
                          <span>{station.handlerPhone}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">No handler assigned yet</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {station.handlerName ? (
                    <>
                      <button
                        onClick={() => handlePingStation(station.id, station.name, station.handlerName)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-purple-950/60 text-slate-400 hover:text-purple-300 border border-slate-800 transition-colors"
                        title={`Ping ${station.name} Handler (${station.handlerName})`}
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditHandler(station)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold transition-colors"
                        title="Edit Station Handler"
                      >
                        <Edit3 className="w-3 h-3 text-purple-400" />
                        <span>Edit</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openEditHandler(station)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Add Handler</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Synchronized Station Round Status & Completion */}
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Stage Status:
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-300 border border-purple-700/40 text-xs font-mono font-bold">
                    Round {station.currentRound || 1}
                  </span>
                </div>
                {(() => {
                  const stProg = getStationRoundProgress(station.id, (station.currentRound || 1) as 1 | 2 | 3);
                  if (stProg.isComplete && stProg.total > 0) {
                    return (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>All {stProg.completed} Contestants Done</span>
                      </span>
                    );
                  }
                  return (
                    <span className="text-xs text-slate-400 font-medium">
                      {stProg.completed} / {stProg.total} Finished ({stProg.remaining} remaining)
                    </span>
                  );
                })()}
              </div>

              {/* Active Contestant Information & Station-Specific Assignment */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      Active Contestant
                    </span>
                    <button
                      onClick={() => setRosterStation(station)}
                      className="px-2.5 py-0.5 rounded-lg bg-purple-950/60 border border-purple-800/50 text-purple-300 text-[10px] font-bold hover:bg-purple-900/60 transition-colors flex items-center gap-1.5"
                      title="View all contestants allocated to this station"
                    >
                      <span>📋 {stationParticipants.length} in Roster</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono">
                        {stationParticipants.filter((p) => isParticipantCheckedIn(p)).length} Arrived
                      </span>
                    </button>
                  </div>
                  {station.activeParticipant ? (
                    <button
                      onClick={() => setStationParticipant(station.id, null)}
                      className="text-[10px] text-rose-400 hover:underline font-bold"
                    >
                      Clear
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setOverrideFilter((prev) => ({
                          ...prev,
                          [station.id]: !isOverridden,
                        }))
                      }
                      className="text-[10px] text-slate-400 hover:text-purple-300 flex items-center gap-1"
                      title={isOverridden ? 'Showing ALL participants. Click to restrict to this station only' : 'Showing ONLY contestants provided to this station. Click to view all'}
                    >
                      <Filter className="w-2.5 h-2.5" />
                      <span>{isOverridden ? 'All Contestants' : 'Station Only'}</span>
                    </button>
                  )}
                </div>

                {station.activeParticipant ? (
                  <div className="flex items-center justify-between gap-3 bg-purple-950/20 p-2.5 rounded-xl border border-purple-900/30">
                    <div>
                      <h4 className="font-extrabold text-white text-base leading-tight">
                        {station.activeParticipant.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        #{station.activeParticipant.participantNumber} • {station.activeParticipant.organization || 'General'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-700/50 text-purple-300 text-[10px] font-bold rounded-lg uppercase">
                      Current
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <select
                        id={`assign-contestant-select-${station.id}`}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!val) {
                            await setStationParticipant(station.id, null);
                            return;
                          }
                          const targetP = (db?.participants || []).find((p) => p.id === val);
                          if (targetP && !isParticipantCheckedIn(targetP)) {
                            alert(`Contestant ${targetP.name} cannot be staged because they have not checked in.`);
                            e.target.value = '';
                            return;
                          }
                          await setStationParticipant(station.id, val);
                        }}
                        className="bg-slate-900 border border-purple-800/40 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:border-purple-500 focus:outline-none flex-1 truncate"
                        defaultValue=""
                      >
                        <option value="">
                          {stationParticipants.length > 0
                            ? `Assign Contestant (${stationParticipants.filter((p) => isParticipantCheckedIn(p)).length}/${stationParticipants.length} checked in)...`
                            : `No contestants allocated to ${station.name}`}
                        </option>
                        {stationParticipants.map((p) => {
                          const checked = isParticipantCheckedIn(p);
                          return (
                            <option key={p.id} value={p.id} disabled={!checked}>
                              #{p.participantNumber} - {p.name} {checked ? '✓ (Checked In)' : '(Not Checked In)'}
                            </option>
                          );
                        })}
                      </select>

                      {nextPendingContestant && stationParticipants.length > 0 && (
                        <button
                          onClick={() => setStationParticipant(station.id, nextPendingContestant.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-sm shrink-0 transition-colors"
                          title={`Stage next: ${nextPendingContestant.name}`}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Stage Next (#{nextPendingContestant.participantNumber})</span>
                        </button>
                      )}
                    </div>

                    {stationParticipants.length === 0 && !isOverridden && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/30 border border-amber-800/30 text-[11px] text-amber-300">
                        <span>No contestants allocated to {station.name}.</span>
                        <button
                          onClick={() => {
                            setTargetStationForAllocation(station.id);
                            setShowDistributeModal(true);
                          }}
                          className="text-amber-200 underline font-bold hover:text-white"
                        >
                          + Allocate Contestants
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assigned Media / Topic Preview */}
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-xs">
                {station.currentRound === 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      Assigned Image:
                    </span>
                    <span className="font-bold text-white">
                      {station.selectedImage?.name || station.selectedImage?.imageId || station.assignedImage?.name || 'None assigned yet'}
                    </span>
                  </div>
                )}
                {station.currentRound === 2 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Disc className="w-3.5 h-3.5 text-purple-400" />
                      Wheel Topic:
                    </span>
                    <span className="font-bold text-purple-300 truncate max-w-[200px]">
                      {station.wheelSpin?.targetTopicTitle || station.selectedTopic?.topic || station.assignedTopic?.topic || 'Not spun yet'}
                    </span>
                  </div>
                )}
                {station.currentRound === 3 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Topic / Prompt:
                    </span>
                    <span className="font-bold text-amber-300 truncate max-w-[200px]">
                      {station.selectedTopic?.topic || station.assignedTopic?.topic || 'Direct speech topic'}
                    </span>
                  </div>
                )}
              </div>

              {/* Live Station Digital Timer Display */}
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 p-4 rounded-2xl border border-purple-900/30 text-center space-y-3">
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="text-purple-300 font-bold uppercase tracking-wider text-[10px]">
                    {isOvertime
                      ? 'Speech Overtime'
                      : timerPhase === 'prep'
                      ? 'Preparation Timer'
                      : 'Speech Timer'}
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      isOvertime
                        ? 'text-rose-400 animate-pulse'
                        : isRunning
                        ? 'text-emerald-400 animate-pulse'
                        : 'text-slate-500'
                    }`}
                  >
                    {isOvertime ? 'OVERTIME' : isRunning ? 'RUNNING' : 'PAUSED/STOPPED'}
                  </span>
                </div>

                <div
                  className={`text-4xl md:text-5xl font-black font-mono tracking-tight select-none ${
                    isOvertime
                      ? 'text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                      : remainingSecs <= 10 && remainingSecs > 0 && isRunning
                      ? 'text-amber-400 animate-pulse'
                      : 'text-white'
                  }`}
                >
                  {isOvertime ? computedTimer.formattedOvertime : computedTimer.formattedCountdown}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOvertime
                        ? 'bg-rose-500'
                        : remainingSecs <= 10 && remainingSecs > 0
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-gradient-to-r from-purple-500 to-emerald-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Quick Skip Prep to Speech Button if station is in prep */}
                {timerPhase === 'prep' && (
                  <button
                    onClick={() => {
                      const roundSettings = (db?.settings as any)?.[`round${station.currentRound}`] || db?.settings?.round1;
                      const speechSec = roundSettings?.speechTimeSeconds || 120;
                      sendStationTimerAction(station.id, {
                        action: 'transition_to_speech',
                        phase: 'speech',
                        totalSeconds: speechSec,
                        remainingSeconds: speechSec,
                      });
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-purple-950 border border-purple-400/40"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Skip Prep ➔ Start Speaking Timer</span>
                  </button>
                )}

                {/* Master Quick Timer Controls for Station */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button
                    onClick={() => {
                      const roundSettings = (db?.settings as any)?.[`round${station.currentRound}`] || db?.settings?.round1;
                      const isIdle = timerPhase === 'idle';
                      const targetPhase = isIdle ? (station.currentRound === 1 && roundSettings?.prepEnabled ? 'prep' : 'speech') : timerPhase;
                      const defaultDuration = targetPhase === 'prep'
                        ? (roundSettings?.prepTimeSeconds || 30)
                        : (roundSettings?.speechTimeSeconds || 120);
                      const duration = isIdle ? defaultDuration : totalSecs;
                      const rem = isIdle ? defaultDuration : remainingSecs;

                      sendStationTimerAction(station.id, {
                        action: isRunning ? 'pause' : 'start',
                        phase: targetPhase,
                        remainingSeconds: rem,
                        totalSeconds: duration,
                      });
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isRunning
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isRunning ? 'Pause' : 'Start'}</span>
                  </button>

                  <button
                    onClick={() =>
                      sendStationTimerAction(station.id, {
                        action: 'stop',
                        phase: 'stopped',
                        remainingSeconds: remainingSecs,
                        totalSeconds: totalSecs,
                      })
                    }
                    className="py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>

                  <button
                    onClick={() => {
                      const roundSettings = (db?.settings as any)?.[`round${station.currentRound}`] || db?.settings?.round1;
                      const defaultDuration = station.currentRound === 1 && roundSettings?.prepEnabled
                        ? (roundSettings?.prepTimeSeconds || 30)
                        : (roundSettings?.speechTimeSeconds || 120);
                      sendStationTimerAction(station.id, {
                        action: 'reset',
                        phase: 'idle',
                        totalSeconds: defaultDuration,
                        remainingSeconds: defaultDuration,
                      });
                    }}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    onClick={() => handleTakeOverStation(station.id)}
                    className="py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    title="Switch this device to operate this station directly"
                  >
                    <span>Operate</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Station Footer Links */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-900/20 text-slate-400">
                <button
                  onClick={() =>
                    window.open(`${window.location.origin}/?page=projector&station=${station.id}`, '_blank')
                  }
                  className="hover:text-blue-300 flex items-center gap-1 text-[11px] transition-colors"
                  title="Open dedicated projector display for this station"
                >
                  <Tv className="w-3.5 h-3.5 text-blue-400" />
                  <span>Station Projector</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  onClick={() => handleTakeOverStation(station.id)}
                  className="hover:text-purple-300 text-[11px] font-semibold transition-colors"
                >
                  Control Stage →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connected Projector Displays Hub */}
      <div className="bg-slate-900/80 border border-purple-900/40 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white font-['Outfit']">
                      Connected Projector Screens
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {safeProjectors.length} Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Hardware-isolated display devices. Each screen is strictly scoped to its assigned stage channel.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => refreshConnectedProjectors()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh connected screens list"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => window.open(`${window.location.origin}/?page=projector`, '_blank')}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-950 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Launch Screen</span>
                </button>
              </div>
            </div>

            {safeProjectors.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">No Projector Screens Connected</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Open the Projector view on your presentation screen or TV. It will automatically register with a unique hardware ID and appear here for remote control.
                  </p>
                </div>
                <button
                  onClick={() => window.open(`${window.location.origin}/?page=projector`, '_blank')}
                  className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Projector Display</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {safeProjectors.map((proj) => {
                  const assignedStation = allStations.find((s) => s.id === proj.stationId);
              return (
                <div
                  key={proj.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 space-y-3 transition-colors shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <span className="text-xs font-mono font-bold text-cyan-300" title={`Full ID: ${proj.id}`}>
                        Screen #{proj.id.slice(-7)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {proj.ip ? proj.ip.replace('::ffff:', '') : 'Local'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Assigned Stage:</span>
                      <span className="font-bold text-white">
                        {assignedStation?.name || (proj.stationId ? `Station ${proj.stationId.replace('station-', '').toUpperCase()}` : 'Unassigned')}
                      </span>
                    </div>

                    <div className="pt-1">
                      <label className="text-[11px] text-slate-400 font-medium block mb-1">
                        Remote Re-assign Station:
                      </label>
                      <select
                        value={proj.stationId || ''}
                        disabled={assigningProjectId === proj.id}
                        onChange={async (e) => {
                          const newSt = e.target.value;
                          setAssigningProjectId(proj.id);
                          try {
                            await assignProjectorStation(proj.id, newSt);
                            setToastMessage(`Projector #${proj.id.slice(-7)} reassigned to ${allStations.find((s) => s.id === newSt)?.name || newSt}`);
                            setTimeout(() => setToastMessage(null), 3500);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setAssigningProjectId(null);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
                      >
                        {allStations.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} {st.location ? `(${st.location})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={async () => {
                        setPingingProjectId(proj.id);
                        try {
                          await pingProjectorDevice(proj.id, 'Test signal from Master Monitor');
                          setToastMessage(`Ping signal sent to Screen #${proj.id.slice(-7)}`);
                          setTimeout(() => setToastMessage(null), 3000);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setPingingProjectId(null);
                        }
                      }}
                      disabled={pingingProjectId === proj.id}
                      className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{pingingProjectId === proj.id ? 'Pinging...' : 'Test Ping'}</span>
                    </button>

                    <button
                      onClick={() =>
                        window.open(
                          `${window.location.origin}/?page=projector&station=${proj.stationId || 'station-a'}`,
                          '_blank'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Open Screen in New Tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Edit Station Handler */}
      {editingHandlerStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-900/60 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-800/40 flex items-center justify-center text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-['Outfit']">
                    Station Handler & Lead Settings
                  </h3>
                  <p className="text-xs text-purple-300">{editingHandlerStation.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingHandlerStation(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Station Name</label>
                  <input
                    type="text"
                    value={handlerForm.name}
                    onChange={(e) => setHandlerForm({ ...handlerForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Location / Room</label>
                  <input
                    type="text"
                    value={handlerForm.location}
                    onChange={(e) => setHandlerForm({ ...handlerForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Handler Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={handlerForm.handlerName}
                  onChange={(e) => setHandlerForm({ ...handlerForm, handlerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Role / Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Stage Lead"
                    value={handlerForm.handlerRole}
                    onChange={(e) => setHandlerForm({ ...handlerForm, handlerRole: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Mobile / Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 0123"
                    value={handlerForm.handlerPhone}
                    onChange={(e) => setHandlerForm({ ...handlerForm, handlerPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Quick Role Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400">Quick Roles:</span>
                {['Stage Lead', 'Timekeeper', 'Volunteer / Anchor', 'Lead Judge', 'Evaluator'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setHandlerForm({ ...handlerForm, handlerRole: role })}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                      handlerForm.handlerRole === role
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-purple-500'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Handler Status</label>
                <select
                  value={handlerForm.handlerStatus}
                  onChange={(e) => setHandlerForm({ ...handlerForm, handlerStatus: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="ready">Ready / On Stage</option>
                  <option value="active">Active Session</option>
                  <option value="on_break">On Break</option>
                  <option value="busy">Busy / Briefing</option>
                  <option value="away">Away</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Desk / Station Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, mic numbers, hardware configuration..."
                  value={handlerForm.handlerNotes}
                  onChange={(e) => setHandlerForm({ ...handlerForm, handlerNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-900/30">
              <button
                type="button"
                onClick={() => setEditingHandlerStation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHandler}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950"
              >
                Save Handler & Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Station Roster Viewer */}
      {rosterStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-900/60 p-6 rounded-3xl max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-lg font-['Outfit'] flex items-center gap-2">
                  <span>{rosterStation.name} Contestant Roster</span>
                </h3>
                <p className="text-xs text-purple-300">
                  Contestants specifically assigned to this stage. Check in arrivals before Round 1.
                </p>
              </div>
              <button
                onClick={() => setRosterStation(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {(() => {
                const assigned = (db?.participants || []).filter(
                  (p) =>
                    (p.stationId && p.stationId.toLowerCase().trim() === rosterStation.id.toLowerCase().trim()) ||
                    (p.stationName && p.stationName.toLowerCase().trim() === rosterStation.name.toLowerCase().trim())
                );
                const arrivedInRoster = assigned.filter((p) => isParticipantCheckedIn(p)).length;

                if (assigned.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 space-y-3">
                      <p>No contestants have been allocated to {rosterStation.name} yet.</p>
                      <button
                        onClick={() => {
                          setTargetStationForAllocation(rosterStation.id);
                          setRosterStation(null);
                          setShowDistributeModal(true);
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold"
                      >
                        + Allocate Contestants Now
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="flex items-center justify-between px-1 py-1 text-[11px] text-slate-400">
                      <span>Total: <strong>{assigned.length}</strong> contestants</span>
                      <span className="text-emerald-400 font-semibold">
                        Arrived: <strong>{arrivedInRoster}</strong> of {assigned.length}
                      </span>
                    </div>

                    {assigned.map((p) => {
                      const isCurrent = rosterStation.activeParticipantId === p.id;
                      const isChecked = isParticipantCheckedIn(p);

                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isCurrent
                              ? 'bg-purple-950/40 border-purple-600'
                              : isChecked
                              ? 'bg-emerald-950/10 border-emerald-500/30'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold font-mono text-xs ${
                                isChecked
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800/40'
                                  : 'bg-purple-950 text-purple-300 border-purple-800/40'
                              }`}
                            >
                              #{p.participantNumber}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-sm">{p.name}</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                                    ACTIVE ON STAGE
                                  </span>
                                )}
                                {isChecked ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                    Arrived
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                    Awaiting Check-In
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span>{p.organization || 'General'}</span>
                                {p.mobile && <span>• {p.mobile}</span>}
                                {p.checkedInAt && (
                                  <span className="text-emerald-400 font-mono">
                                    • {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            {/* Check In / Undo Toggle */}
                            {isChecked ? (
                              <button
                                onClick={async () => {
                                  await checkInParticipant(p.id, { checkedIn: false });
                                  setToastMessage(`Revoked check-in for ${p.name}`);
                                  setTimeout(() => setToastMessage(null), 3000);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                                title="Revoke check-in"
                              >
                                Revoke Check-In
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  await checkInParticipant(p.id, {
                                    checkedIn: true,
                                    stationId: rosterStation.id,
                                    stationName: rosterStation.name,
                                    checkedInBy: 'Master Supervisor',
                                  });
                                  setToastMessage(`Checked in ${p.name} at ${rosterStation.name}!`);
                                  setTimeout(() => setToastMessage(null), 3000);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Check In</span>
                              </button>
                            )}

                            {isCurrent ? (
                              <button
                                onClick={() => setStationParticipant(rosterStation.id, null)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 font-bold text-xs cursor-pointer"
                              >
                                Unstage
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!isParticipantCheckedIn(p)) {
                                    alert(`Contestant ${p.name} must be checked in to the venue before they can be staged.`);
                                    return;
                                  }
                                  await setStationParticipant(rosterStation.id, p.id);
                                  setRosterStation(null);
                                  setToastMessage(`Staged ${p.name} on ${rosterStation.name}!`);
                                  setTimeout(() => setToastMessage(null), 3000);
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer ${
                                  isParticipantCheckedIn(p)
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                }`}
                                title={!isParticipantCheckedIn(p) ? 'Must check in contestant before staging' : undefined}
                              >
                                Stage Now
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-purple-900/30 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Only these contestants will be shown in {rosterStation.name}'s dropdown.
              </span>
              <button
                onClick={() => setRosterStation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Contestant Station Allocation Manager */}
      {showDistributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-900/60 p-6 rounded-3xl max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-lg font-['Outfit'] flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-purple-400" />
                  <span>Contestant Station Allocation Manager</span>
                </h3>
                <p className="text-xs text-purple-300">
                  Assign contestants to specific stations so each station monitor only displays its provided contestants.
                </p>
              </div>
              <button
                onClick={() => setShowDistributeModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Station Distribution Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {allStations.map((s) => {
                const count = (db?.participants || []).filter(
                  (p) =>
                    (p.stationId && p.stationId.toLowerCase().trim() === s.id.toLowerCase().trim()) ||
                    (p.stationName && p.stationName.toLowerCase().trim() === s.name.toLowerCase().trim())
                ).length;
                return (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {s.name}
                    </span>
                    <span className="text-xl font-black text-white">{count}</span>
                    <span className="text-[10px] text-purple-400 block truncate">
                      {s.handlerName ? s.handlerName : 'No handler'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick 1-Click Auto Distribute */}
            <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-extrabold text-white text-sm block">⚡ Auto-Distribute Evenly</span>
                <span className="text-slate-300 text-[11px]">
                  {unassignedParticipants.length} contestants are currently unassigned to any station.
                </span>
              </div>
              <button
                onClick={handleAutoDistribute}
                disabled={unassignedParticipants.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shrink-0"
              >
                Distribute {unassignedParticipants.length} Evenly
              </button>
            </div>

            {/* Manual Assignment Form */}
            <div className="space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className="font-bold text-slate-300">
                  Unassigned Contestants ({unassignedParticipants.length})
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={targetStationForAllocation}
                    onChange={(e) => setTargetStationForAllocation(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none"
                  >
                    {allStations.map((s) => (
                      <option key={s.id} value={s.id}>
                        Assign to {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={selectedParticipantIds.length === 0 || !targetStationForAllocation}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs"
                  >
                    Assign Selected ({selectedParticipantIds.length})
                  </button>
                </div>
              </div>

              {/* Contestant Select List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                {unassignedParticipants.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 italic">
                    All contestants have been assigned to stations!
                  </div>
                ) : (
                  unassignedParticipants.map((p) => {
                    const isSelected = selectedParticipantIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedParticipantIds((prev) =>
                            isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-purple-900/40 border border-purple-500'
                            : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 bg-slate-900 text-purple-600"
                          />
                          <span className="font-mono text-purple-300 font-bold">#{p.participantNumber}</span>
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-slate-400 text-[11px]">({p.organization || 'General'})</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Unallocated</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-purple-900/30 flex items-center justify-end">
              <button
                onClick={() => setShowDistributeModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Stage Permission & Attendance Review Modal */}
      {stagePermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-purple-800/60 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    stagePermissionModal.isForce
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {stagePermissionModal.isForce ? <AlertTriangle className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white font-['Outfit']">
                    Authorize & Launch Round {stagePermissionModal.targetRound}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Master stage clearance and attendance review
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStagePermissionModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Attendance & Completion KPI Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Present Done</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {stagePermissionModal.completedCount} / {stagePermissionModal.arrivedCount}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {stagePermissionModal.arrivedCount > 0
                    ? `${Math.round((stagePermissionModal.completedCount / stagePermissionModal.arrivedCount) * 100)}% Done`
                    : '0 Present'}
                </span>
              </div>
              <div className="p-2 border-x border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Absent / No-Show</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {stagePermissionModal.absentCount}
                </span>
                <span className="text-[9px] text-slate-500 block">Unchecked</span>
              </div>
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Roster</span>
                <span className="text-base font-black text-purple-300 font-mono">
                  {stagePermissionModal.totalRegistered}
                </span>
                <span className="text-[9px] text-slate-500 block">Registered</span>
              </div>
            </div>

            {/* Unfinished Arrived Contestants Warning (if any arrived contestants are pending) */}
            {stagePermissionModal.isForce && (
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Warning: {stagePermissionModal.pendingArrivedContestants.length} arrived contestant(s) haven't completed Round{' '}
                    {stagePermissionModal.targetRound - 1}!
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  These contestants checked in but have not finished speaking. Advancing now will skip them.
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                  {stagePermissionModal.pendingArrivedContestants.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px]"
                    >
                      <span className="font-mono text-purple-300 font-bold">#{c.participantNumber} {c.name}</span>
                      <span className="text-slate-400">{c.stationName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Absent / No-Show Contestants Management */}
            {stagePermissionModal.absentCount > 0 && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-amber-400" />
                    <span>No-Show Contestants ({stagePermissionModal.absentCount})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Did not check in to Round 1</span>
                </div>

                <div className="max-h-28 overflow-y-auto space-y-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  {stagePermissionModal.absentContestants.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400/90 font-bold">#{c.participantNumber}</span>
                        <span>{c.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{c.stationName}</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={stagePermissionModal.markAbsent}
                    onChange={(e) =>
                      setStagePermissionModal((prev) =>
                        prev ? { ...prev, markAbsent: e.target.checked } : null
                      )
                    }
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    Mark these <strong>{stagePermissionModal.absentCount}</strong> contestants as <strong>Absent</strong> (excludes them from Round {stagePermissionModal.targetRound} qualification).
                  </span>
                </label>
              </div>
            )}

            {!stagePermissionModal.isForce && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All present contestants have completed Round {stagePermissionModal.targetRound - 1}!</span>
                </div>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  Granting permission will simultaneously switch all stations to <strong>Round {stagePermissionModal.targetRound}</strong>, reset station timers, and unlock Round {stagePermissionModal.targetRound} for all operators.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-purple-900/30">
              <button
                onClick={() => setStagePermissionModal(null)}
                disabled={isAdvancing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStagePermission}
                disabled={isAdvancing}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition-all ${
                  stagePermissionModal.isForce
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/60'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
                }`}
              >
                {isAdvancing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>
                      {stagePermissionModal.isForce
                        ? `Force Authorize Round ${stagePermissionModal.targetRound}`
                        : `Grant Permission & Launch Round ${stagePermissionModal.targetRound}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
