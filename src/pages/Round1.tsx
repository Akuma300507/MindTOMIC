import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Shuffle,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  FolderOpen,
  RotateCw,
  Bell,
  MapPin,
  Search,
  X,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Timer, TimerPhase } from '../components/common/Timer';
import { ParticipantSearchInput } from '../components/common/ParticipantSearchInput';
import { isParticipantCheckedIn, isParticipantRoundCompleted, type EventImage, type Participant, type Round1Result } from '../types';

export const Round1: React.FC = () => {
  const {
    db,
    activeParticipant,
    setActiveParticipant,
    selectNextParticipant,
    saveRound1Result,
    assignStationImage,
    rotateStationImage,
    resetImagesStatus,
    currentStationId,
    setCurrentStationId,
    currentStation,
    allStations,
    setCurrentPage,
    checkInParticipant,
    setStationParticipant,
    currentEventRound,
    getStationRoundProgress,
  } = useApp();

  const [selectedImage, setSelectedImage] = useState<EventImage | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInTab, setCheckInTab] = useState<'all' | 'arrived' | 'awaiting'>('all');
  const [includeAllStations, setIncludeAllStations] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [lastSavedResult, setLastSavedResult] = useState<Round1Result | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);

  const images = db?.images || [];
  const prepSeconds = db?.settings?.round1?.prepTimeSeconds ?? 30;
  const speechSeconds = db?.settings?.round1?.speechTimeSeconds ?? 120;
  const buzzerEnabled = db?.settings?.round1?.buzzerEnabled ?? true;
  const warningBuzzerEnabled = db?.settings?.round1?.warningBuzzerEnabled ?? true;
  const warningTimeSeconds = db?.settings?.round1?.warningTimeSeconds ?? 30;

  // Filter images eligible for the active station (never include images assigned to other stations)
  const stationImages = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') {
      return images;
    }
    // Strict isolation: candidate must either belong to this station OR be universal (no station assigned)
    const eligible = images.filter((img) => {
      if (img.stationId && img.stationId !== 'all' && img.stationId !== currentStationId) {
        return false; // Assigned to a different station!
      }
      return true;
    });

    // If there are images specifically assigned to this station, isolate strictly to them
    const dedicated = eligible.filter((img) => img.stationId === currentStationId);
    return dedicated.length > 0 ? dedicated : eligible;
  }, [images, currentStationId]);

  const unusedCount = useMemo(() => stationImages.filter((i) => i.status === 'available').length, [stationImages]);
  const usedCount = stationImages.length - unusedCount;

  // Filter participants for active station
  const stationParticipants = useMemo(() => {
    if (!db?.participants) return [];
    if (!currentStationId || currentStationId === 'all') return db.participants;
    return db.participants.filter((p) => p.stationId === currentStationId);
  }, [db?.participants, currentStationId]);

  // Completed participants for active station in Round 1
  const completedStationParticipants = useMemo(() => {
    return stationParticipants.filter((p) => isParticipantRoundCompleted(p, 1, db));
  }, [stationParticipants, db]);

  // Pending (not completed) participants for active station in Round 1
  const pendingStationParticipants = useMemo(() => {
    return stationParticipants.filter((p) => !isParticipantRoundCompleted(p, 1, db));
  }, [stationParticipants, db]);

  // Strictly only participants who have checked in to the location appear in the Round 1 drop-down!
  const checkedInStationParticipants = useMemo(() => {
    return stationParticipants.filter((p) => isParticipantCheckedIn(p));
  }, [stationParticipants]);

  // Checked-in and pending participants
  const checkedInPendingStationParticipants = useMemo(() => {
    return pendingStationParticipants.filter((p) => isParticipantCheckedIn(p));
  }, [pendingStationParticipants]);

  const arrivedCount = checkedInStationParticipants.length;
  const awaitingCount = stationParticipants.length - arrivedCount;

  const isCurrentParticipantCheckedIn = Boolean(
    activeParticipant && isParticipantCheckedIn(activeParticipant)
  );

  const isCurrentParticipantCompleted = Boolean(
    activeParticipant && isParticipantRoundCompleted(activeParticipant, 1, db)
  );

  const [contestantSearch, setContestantSearch] = useState('');

  // Filtered lists based on search query (by ID, #number, name, or phone) - STRICTLY CHECKED IN ONLY
  const filteredPendingParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return checkedInPendingStationParticipants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return checkedInPendingStationParticipants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [checkedInPendingStationParticipants, contestantSearch]);

  const filteredCompletedParticipants = useMemo(() => {
    if (!contestantSearch.trim()) return completedStationParticipants;
    const q = contestantSearch.toLowerCase().trim().replace(/^#/, '');
    return completedStationParticipants.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
      return matchName || matchNum || matchId || matchMobile;
    });
  }, [completedStationParticipants, contestantSearch]);

  const round1Progress = useMemo(() => {
    if (!currentStationId || currentStationId === 'all') return null;
    return getStationRoundProgress(currentStationId, 1);
  }, [currentStationId, getStationRoundProgress]);

  const handleCheckIn = useCallback(
    async (participantId: string, checkedIn: boolean) => {
      try {
        setActionLoadingId(participantId);
        const stn = allStations.find((s) => s.id === currentStationId);
        await checkInParticipant(participantId, {
          checkedIn,
          stationId: currentStationId || undefined,
          stationName: stn?.name || undefined,
          checkedInBy: `${stn?.name || 'Station'} Master`,
        });
      } catch (err: any) {
        alert(err.message || 'Failed to update check-in status');
      } finally {
        setActionLoadingId(null);
      }
    },
    [allStations, currentStationId, checkInParticipant]
  );

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

  // Sync with currentStation assignedImage if already set
  useEffect(() => {
    if (currentStation?.selectedImage) {
      setSelectedImage(currentStation.selectedImage);
    }
  }, [currentStation?.selectedImage]);

  // Heat slot index within this station:
  // Dynamically determined by turn order (number of completed Round 1 contestants at this station),
  // or the contestant's locked round1SlotIndex if already assigned/completed.
  const slotIndex = useMemo(() => {
    if (!activeParticipant) return 0;
    if (typeof activeParticipant.round1SlotIndex === 'number' && activeParticipant.round1SlotIndex >= 0) {
      return activeParticipant.round1SlotIndex;
    }
    const r1Result = db?.round1Results?.find((r) => r.participantId === activeParticipant.id);
    if (typeof r1Result?.slotIndex === 'number' && r1Result.slotIndex >= 0) {
      return r1Result.slotIndex;
    }
    return completedStationParticipants.length;
  }, [activeParticipant, db?.round1Results, completedStationParticipants.length]);

  // Available images based on reuse policy or synchronized slots
  const availableImages = useMemo(() => {
    if (db?.settings?.round1?.allowImageReuse || db?.settings?.round1?.synchronizedSlots !== false) {
      return stationImages;
    }
    const filtered = stationImages.filter((img) => img.status === 'available');
    return filtered.length > 0 ? filtered : stationImages;
  }, [stationImages, db?.settings?.round1?.allowImageReuse, db?.settings?.round1?.synchronizedSlots]);

  // Synchronized slot image auto-loader:
  // If synchronized slots are enabled and an image has already been chosen/pre-generated for this heat slot,
  // load and assign that exact image automatically so all stations at this heat stay aligned.
  useEffect(() => {
    const isSync = db?.settings?.round1?.synchronizedSlots !== false;
    if (isSync && db?.synchronizedSlots?.round1 && typeof db.synchronizedSlots.round1[slotIndex] === 'string') {
      const slotImageId = db.synchronizedSlots.round1[slotIndex];
      const matched = stationImages.find((img) => img.id === slotImageId || img.imageId === slotImageId);
      if (matched && (!selectedImage || selectedImage.id !== matched.id)) {
        setSelectedImage(matched);
      }
    }
  }, [db?.settings?.round1?.synchronizedSlots, db?.synchronizedSlots?.round1, slotIndex, stationImages, selectedImage]);

  // Atomic Random image selector
  const handleRandomImage = useCallback(async () => {
    try {
      setPoolNotice(null);
      const chosen = await assignStationImage(currentStationId, slotIndex);
      setSelectedImage(chosen);
    } catch (err: any) {
      setPoolNotice(err.message || 'No unused images remaining. Reset pool or enable reuse in settings.');
    }
  }, [assignStationImage, currentStationId, slotIndex]);

  // Select initial image if none selected
  useEffect(() => {
    if (!selectedImage && availableImages.length > 0) {
      setSelectedImage(availableImages[0]);
    }
  }, [availableImages, selectedImage]);

  // Image rotation state for projector and operator
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Reset rotation when image changes, or sync from currentStation
  useEffect(() => {
    if (typeof currentStation?.imageRotation === 'number') {
      setImageRotation(currentStation.imageRotation);
    } else {
      setImageRotation(0);
    }
  }, [selectedImage?.id, currentStation?.imageRotation]);

  const handleRotateImage = () => {
    const nextRot = (imageRotation + 90) % 360;
    setImageRotation(nextRot);
    if (currentStationId && rotateStationImage) {
      rotateStationImage(currentStationId, nextRot).catch(() => {});
    }
  };

  // Callback when timer finishes or stops
  const handleTimerFinish = useCallback(
    async (data: {
      status: 'completed' | 'completed_early' | 'time_up';
      prepDurationSeconds: number;
      speechDurationSeconds: number;
      startTime: string;
      endTime: string;
    }) => {
      if (!activeParticipant || !selectedImage) return;

      const currentImgId = selectedImage.imageId || selectedImage.name;

      const resultPayload = {
        participantId: activeParticipant.id,
        participantNumber: activeParticipant.participantNumber,
        participantName: activeParticipant.name,
        mobile: activeParticipant.mobile || activeParticipant.phone || activeParticipant.customData?.phone || '',
        imageId: currentImgId,
        imageName: currentImgId,
        imageUrl: selectedImage.url,
        prepDurationSeconds: data.prepDurationSeconds,
        speechDurationSeconds: data.speechDurationSeconds,
        targetSpeechDurationSeconds: speechSeconds,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        slotIndex: slotIndex,
      };

      const saved = await saveRound1Result(resultPayload);
      setLastSavedResult(saved);
      // Retain the current participant and image on screen after stopping the timer.
      // Do NOT auto-advance; the operator will explicitly pick the next contestant when ready.
    },
    [
      activeParticipant,
      selectedImage,
      speechSeconds,
      slotIndex,
      saveRound1Result,
    ]
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Event Round Concluded Notice */}
      {currentEventRound > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white text-sm block">Round 1 has concluded</span>
              <span className="text-xs text-indigo-300">The entire competition has progressed to Round {currentEventRound}.</span>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage(currentEventRound === 2 ? 'round2' : 'round3')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shrink-0 transition-colors"
          >
            <span>Go to Round {currentEventRound}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Station Finished Round 1 Waiting State */}
      {currentEventRound === 1 && round1Progress && round1Progress.isComplete && round1Progress.total > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-sm block">
                Stage Round 1 Completed ({round1Progress.completed}/{round1Progress.total} Contestants)
              </span>
              <span className="text-xs text-emerald-300/90">
                All assigned contestants for this station have finished Round 1. Please wait for other stations to finish before Round 2 begins.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-[11px] font-bold text-emerald-200 shrink-0 self-start sm:self-center">
            Waiting for All Stations
          </span>
        </div>
      )}

      {/* Top Bar: Participant Selector & Round Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-purple-900/30 p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800">
                ROUND 1
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">Pixel Pictionary</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Prep: {prepSeconds}s • Speech: {speechSeconds}s • Buzzer: {buzzerEnabled ? 'ON' : 'OFF'}
            </p>
          </div>
        </div>

        {/* Station & Contestant Selector Bar */}
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
            <span className="text-slate-400">Contestant:</span>
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
                  pendingStationParticipants.find((item) => item.id === targetId) ||
                  stationParticipants.find((item) => item.id === targetId) ||
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
                    : completedStationParticipants.length > 0
                    ? `All checked-in contestants completed (${completedStationParticipants.length})`
                    : checkedInStationParticipants.length === 0
                    ? `No checked-in contestants in ${currentStation?.name || 'this station'}`
                    : `No pending contestants in ${currentStation?.name || 'this station'}`}
                </option>
              )}
              {filteredPendingParticipants.map((p) => {
                const isChecked = isParticipantCheckedIn(p);
                return (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    #{p.participantNumber} — {p.name} {isChecked ? '✓' : ''}
                  </option>
                );
              })}
            </select>
            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${
                checkedInPendingStationParticipants.length > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
              }`}
              title={`${checkedInPendingStationParticipants.length} remaining checked-in contestants`}
            >
              {checkedInPendingStationParticipants.length} Remaining
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
                  completedStationParticipants.find((item) => item.id === targetId) ||
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
                  : `Completed (${completedStationParticipants.length})`}
              </option>
              {filteredCompletedParticipants.map((p) => {
                const compResult = db?.round1Results?.find((r) => r.participantId === p.id);
                const compHeat = typeof p.round1SlotIndex === 'number'
                  ? p.round1SlotIndex + 1
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
                completedStationParticipants.length > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={`${completedStationParticipants.length} of ${stationParticipants.length} contestants completed Round 1`}
            >
              {completedStationParticipants.length} Done
            </span>
          </div>

          {/* Quick Search Contestant Pill */}
          <ParticipantSearchInput
            searchQuery={contestantSearch}
            onSearchChange={setContestantSearch}
            pendingParticipants={pendingStationParticipants}
            completedParticipants={completedStationParticipants}
            activeParticipantId={activeParticipant?.id}
            onSelectParticipant={handleSelectContestant}
            placeholder="Search #ID or name..."
          />

          {/* Quick Participant Check-In Pill */}
          {activeParticipant && (
            <button
              onClick={() => handleCheckIn(activeParticipant.id, !isCurrentParticipantCheckedIn)}
              disabled={actionLoadingId === activeParticipant.id}
              title={isCurrentParticipantCheckedIn ? 'Contestant is checked in. Click to revoke.' : 'Click to mark contestant arrived'}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                isCurrentParticipantCheckedIn
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 hover:border-rose-500/50 hover:text-rose-300'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 animate-pulse'
              }`}
            >
              {isCurrentParticipantCheckedIn ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Arrived</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Check In</span>
                </>
              )}
            </button>
          )}

          {/* Station Arrival Desk Button */}
          <button
            onClick={() => setShowCheckInModal(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              arrivedCount === 0 && stationParticipants.length > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 animate-pulse'
                : 'bg-slate-950 hover:bg-slate-800 text-purple-300 border border-purple-800/50'
            }`}
            title="Open Station Arrival & Check-In Desk"
          >
            <MapPin className={`w-3.5 h-3.5 ${arrivedCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden md:inline">Arrival Desk</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
              {arrivedCount}/{stationParticipants.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (checkedInPendingStationParticipants.length > 0) {
                selectNextParticipant(checkedInPendingStationParticipants);
              } else if (pendingStationParticipants.length > 0) {
                selectNextParticipant(pendingStationParticipants);
              } else if (stationParticipants.length > 0) {
                selectNextParticipant(stationParticipants);
              } else {
                selectNextParticipant();
              }
            }}
            disabled={stationParticipants.length === 0 && (!db?.participants || db.participants.length === 0)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50 disabled:opacity-40 cursor-pointer"
            title="Next Participant (Shortcut: N)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Check-In Warning Banner if contestant has not arrived to location */}
      {activeParticipant && !isCurrentParticipantCheckedIn && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-amber-200 text-sm">
                  Contestant Not Checked In to Location
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/50 text-[10px] font-bold uppercase font-mono">
                  Round 1 Locked
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                <strong>{activeParticipant.name} (#{activeParticipant.participantNumber})</strong> has not checked in to {currentStation?.name || 'this location'}. They cannot give Round 1 until marked as arrived.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCheckIn(activeParticipant.id, true)}
            disabled={actionLoadingId === activeParticipant.id}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            <span>{actionLoadingId === activeParticipant.id ? 'Checking In...' : 'Mark Arrived & Check In'}</span>
          </button>
        </div>
      )}

      {/* Informative notice when no contestants are checked in yet for this station */}
      {checkedInStationParticipants.length === 0 && stationParticipants.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm">
                  Awaiting Contestant Check-In
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                  0/{stationParticipants.length} Checked In
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Only checked-in contestants appear in the Round 1 drop-down. Check in arriving contestants at the Station Arrival Desk.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCheckInModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition-all cursor-pointer shrink-0"
          >
            <UserCheck className="w-4 h-4" />
            <span>Open Arrival Desk</span>
          </button>
        </div>
      )}

      {/* Station Round 1 Complete (Arrived Contestants Evaluated) */}
      {round1Progress && round1Progress.isComplete && round1Progress.arrivedCount > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-sm block">
                Stage Round 1 Completed ({round1Progress.completed}/{round1Progress.arrivedCount} Present Contestants)
              </span>
              <span className="text-xs text-emerald-300/90">
                All present contestants at this station have concluded their speeches.{' '}
                {round1Progress.absentCount > 0 && (
                  <span className="text-amber-300/90">
                    ({round1Progress.absentCount} did not check in / absent).{' '}
                  </span>
                )}
                Awaiting Master permission to begin Round 2.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-[11px] font-bold text-emerald-200 shrink-0 self-start sm:self-center">
            Waiting for Master Authorization
          </span>
        </div>
      )}

      {/* Pool Status & Alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">
            {currentStation ? `${currentStation.name} Image Pool:` : 'Image Pool:'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
            {unusedCount} Available
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
            {usedCount} Used
          </span>
          <span className="text-[11px] text-purple-300 bg-purple-950/50 border border-purple-800/40 px-2 py-0.5 rounded-full font-semibold">
            {stationImages.length} In Pool
          </span>
          {db?.settings?.round1?.allowImageReuse && (
            <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              Reuse Allowed
            </span>
          )}
        </div>

        {usedCount > 0 && (
          <button
            onClick={async () => {
              if (confirm('Reset all used images back to available?')) {
                await resetImagesStatus();
              }
            }}
            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Used Images</span>
          </button>
        )}
      </div>

      {poolNotice && (
        <div className="p-3 bg-amber-950/50 border border-amber-500/50 rounded-xl text-xs text-amber-200 flex items-center justify-between">
          <span>{poolNotice}</span>
          <button
            onClick={() => resetImagesStatus()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[11px]"
          >
            Reset Pool Now
          </button>
        </div>
      )}

      {/* Main Grid: Left Stage (Image & Prompt), Right Stage (Timer & Controls) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Big Image Display */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-purple-900/30 rounded-3xl p-5 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Visual Prompt</span>
              {selectedImage && (
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono font-bold">
                  ID: {selectedImage.imageId || selectedImage.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRandomImage}
                disabled={timerPhase === 'prep' || timerPhase === 'speech'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-40"
                title="Randomly choose an unused image"
              >
                <Shuffle className="w-3.5 h-3.5 text-blue-400" />
                <span>Random Image</span>
              </button>

              <button
                onClick={handleRotateImage}
                disabled={!selectedImage || timerPhase === 'prep' || timerPhase === 'speech'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-purple-200 text-xs font-semibold border border-purple-700/50 disabled:opacity-40"
                title="Rotate image 90° for stage display"
              >
                <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                <span>Rotate {imageRotation !== 0 ? `(${imageRotation}°)` : ''}</span>
              </button>

              <button
                onClick={() => setShowImagePicker(true)}
                disabled={timerPhase === 'prep' || timerPhase === 'speech'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-40"
                title="Pick manually from gallery"
              >
                <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
                <span>Gallery</span>
              </button>
            </div>
          </div>

          {/* Large Image Frame */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800 shadow-inner group">
            {selectedImage ? (
              <>
                <img
                  src={selectedImage.url}
                  alt={selectedImage.imageId || selectedImage.name}
                  style={{
                    transform: `rotate(${imageRotation}deg)`,
                    transition: 'transform 0.4s ease',
                    maxHeight: imageRotation % 180 !== 0 ? '70%' : '100%',
                    maxWidth: imageRotation % 180 !== 0 ? '70%' : '100%',
                  }}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-300 px-2.5 py-1 rounded-lg bg-blue-950/90 border border-blue-700 shadow-md">
                      IMAGE ID: {selectedImage.imageId || selectedImage.name}
                    </span>
                    {selectedImage.stationName ? (
                      <span className="text-xs font-semibold text-purple-300 px-2.5 py-1 rounded-lg bg-purple-950/90 border border-purple-700 shadow-md">
                        📍 {selectedImage.stationName}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 shadow-md">
                        Universal Pool
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-8 text-slate-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>No image selected. Click Random or Gallery.</p>
              </div>
            )}
          </div>

          {/* Last Result Summary Card */}
          {lastSavedResult && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">
                  Last recorded: <strong>{lastSavedResult.participantName}</strong> [Image ID: <span className="text-blue-300 font-mono font-bold">{lastSavedResult.imageId || '—'}</span>] spoke for{' '}
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

        {/* Right Column: Reusable Timer Engine with Large Display & Controls */}
        <div className="lg:col-span-5">
          <Timer
            prepDurationSeconds={prepSeconds}
            speechDurationSeconds={speechSeconds}
            hasPrepPhase={true}
            participantName={activeParticipant?.name}
            roundName="Round 1"
            buzzerEnabled={buzzerEnabled}
            warningBuzzerEnabled={warningBuzzerEnabled}
            warningTimeSeconds={warningTimeSeconds}
            stationId={currentStationId || undefined}
            canStart={isCurrentParticipantCheckedIn}
            cannotStartReason={
              activeParticipant
                ? `Contestant ${activeParticipant.name} must check in to ${currentStation?.name || 'this location'} before Round 1 can start.`
                : 'Please select and check in a contestant first.'
            }
            onPhaseChange={setTimerPhase}
            onFinish={handleTimerFinish}
          />

          {/* Round 1 Warning Buzzer Status & Shortcut */}
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/80 border border-blue-500/30 flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
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
              className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 hover:text-white border border-blue-500/40 font-semibold text-[11px] transition-all cursor-pointer shrink-0"
            >
              Configure Timing
            </button>
          </div>
        </div>
      </div>

      {/* Manual Gallery Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-1 font-['Outfit'] flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-400" />
              Select Round 1 Image Prompt ({currentStation ? currentStation.name : 'Station'} Pool)
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Showing images eligible for this station. Images assigned to other stations are strictly excluded.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stationImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => {
                    setSelectedImage(img);
                    setShowImagePicker(false);
                  }}
                  className="cursor-pointer rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-all hover:scale-102 bg-slate-950 relative group"
                >
                  <img
                    src={img.url}
                    alt={img.imageId || img.name}
                    className="w-full h-28 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-mono font-bold text-blue-300 truncate">
                        ID: {img.imageId || img.name}
                      </p>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          img.status === 'available'
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {img.status}
                      </span>
                    </div>
                    {img.stationName && (
                      <span className="inline-block text-[9px] font-semibold text-purple-300 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-800/60 truncate max-w-full">
                        {img.stationName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowImagePicker(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station Arrival & Check-In Desk Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-900/60 rounded-3xl max-w-3xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
                    <span>{currentStation ? `${currentStation.name} Arrival Desk` : 'Station Arrival Desk'}</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
                      {arrivedCount} of {stationParticipants.length} Checked In
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mark participants as arrived at this location so they can give Round 1.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={checkInSearch}
                  onChange={(e) => setCheckInSearch(e.target.value)}
                  placeholder="Search contestant by name, #ID, or mobile..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  onClick={() => setCheckInTab('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all text-xs ${
                    checkInTab === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({stationParticipants.length})
                </button>
                <button
                  onClick={() => setCheckInTab('arrived')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all text-xs ${
                    checkInTab === 'arrived'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Arrived ({arrivedCount})
                </button>
                <button
                  onClick={() => setCheckInTab('awaiting')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all text-xs ${
                    checkInTab === 'awaiting'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Awaiting ({awaitingCount})
                </button>
              </div>
            </div>

            {/* Contestant list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {(() => {
                const pool = includeAllStations ? (db?.participants || []) : stationParticipants;
                const filtered = pool.filter((p) => {
                  const isChecked = isParticipantCheckedIn(p);
                  if (checkInTab === 'arrived' && !isChecked) return false;
                  if (checkInTab === 'awaiting' && isChecked) return false;
                  if (checkInSearch.trim()) {
                    const q = checkInSearch.toLowerCase().trim();
                    const matchName = (p.name || '').toLowerCase().includes(q);
                    const matchNum = (p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(q);
                    const matchOrg = p.organization?.toLowerCase().includes(q);
                    const matchMob = (p.mobile || p.phone || '')?.toLowerCase().includes(q);
                    return matchName || matchNum || matchOrg || matchMob;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <p className="font-semibold">No contestants found matching criteria.</p>
                      <p className="text-[11px] text-slate-500">
                        {includeAllStations ? 'Try clearing the search query.' : 'Try toggling contestants from all stations.'}
                      </p>
                    </div>
                  );
                }

                return filtered.map((p) => {
                  const isChecked = isParticipantCheckedIn(p);
                  const isCurrent = activeParticipant?.id === p.id;
                  const loading = actionLoadingId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-purple-950/40 border-purple-500/60'
                          : isChecked
                          ? 'bg-emerald-950/10 border-emerald-500/30'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          #{p.participantNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">{p.name}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                                ON STAGE
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
                            {p.organization && <span>{p.organization}</span>}
                            {(p.mobile || p.phone) && <span>• {p.mobile || p.phone}</span>}
                            {p.checkedInAt && (
                              <span className="text-emerald-400/90 font-mono">
                                • Checked in at {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {p.stationName && (
                              <span className="text-purple-300 font-mono">
                                • {p.stationName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {/* Check In / Undo Toggle */}
                        {isChecked ? (
                          <button
                            onClick={() => handleCheckIn(p.id, false)}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                            title="Revoke check-in"
                          >
                            {loading ? 'Updating...' : 'Revoke Check-In'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(p.id, true)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{loading ? 'Checking In...' : 'Mark Arrived'}</span>
                          </button>
                        )}

                        {/* Stage Contestant */}
                        <button
                          onClick={async () => {
                            if (!isChecked) {
                              await handleCheckIn(p.id, true);
                            }
                            setActiveParticipant(p);
                            setShowCheckInModal(false);
                          }}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-700'
                              : isChecked
                              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-md'
                          }`}
                        >
                          {isCurrent ? 'Current' : isChecked ? 'Stage on Round 1' : 'Check In & Stage'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-purple-900/30 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAllStations}
                  onChange={(e) => setIncludeAllStations(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-0"
                />
                <span>Include contestants from all stations / unassigned</span>
              </label>

              <button
                onClick={() => setShowCheckInModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
