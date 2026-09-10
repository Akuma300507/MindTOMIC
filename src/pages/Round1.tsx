import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Timer, TimerPhase } from '../components/common/Timer';
import type { EventImage, Participant, Round1Result } from '../types';

export const Round1: React.FC = () => {
  const {
    db,
    activeParticipant,
    setActiveParticipant,
    selectNextParticipant,
    saveRound1Result,
    updateLiveSync,
    assignStationImage,
    resetImagesStatus,
    currentStationId,
    setCurrentStationId,
    currentStation,
    allStations,
  } = useApp();

  const [selectedImage, setSelectedImage] = useState<EventImage | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [lastSavedResult, setLastSavedResult] = useState<Round1Result | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);

  const images = db?.images || [];
  const prepSeconds = db?.settings.round1.prepTimeSeconds ?? 30;
  const speechSeconds = db?.settings.round1.speechTimeSeconds ?? 120;
  const buzzerEnabled = db?.settings.round1.buzzerEnabled ?? true;

  const unusedCount = useMemo(() => images.filter((i) => i.status === 'available').length, [images]);
  const usedCount = images.length - unusedCount;

  // Filter participants for active station
  const stationParticipants = useMemo(() => {
    if (!db?.participants) return [];
    if (!currentStationId || currentStationId === 'all') return db.participants;
    return db.participants.filter((p) => p.stationId === currentStationId);
  }, [db?.participants, currentStationId]);

  // Keep activeParticipant synced to current station's participant pool
  useEffect(() => {
    if (stationParticipants.length > 0) {
      const isAlreadyInStation =
        activeParticipant && stationParticipants.some((p) => p.id === activeParticipant.id);
      if (!isAlreadyInStation) {
        setActiveParticipant(stationParticipants[0]);
      }
    }
  }, [currentStationId, stationParticipants, activeParticipant, setActiveParticipant]);

  // Sync with currentStation assignedImage if already set
  useEffect(() => {
    if (currentStation?.selectedImage) {
      setSelectedImage(currentStation.selectedImage);
    }
  }, [currentStation?.selectedImage]);

  // Available images based on reuse policy
  const availableImages = useMemo(() => {
    if (db?.settings.round1.allowImageReuse) {
      return images;
    }
    const filtered = images.filter((img) => img.status === 'available');
    return filtered.length > 0 ? filtered : images;
  }, [images, db?.settings.round1.allowImageReuse]);

  // Atomic Random image selector
  const handleRandomImage = useCallback(async () => {
    try {
      setPoolNotice(null);
      const chosen = await assignStationImage(currentStationId);
      setSelectedImage(chosen);
    } catch (err: any) {
      setPoolNotice(err.message || 'No unused images remaining. Reset pool or enable reuse in settings.');
    }
  }, [assignStationImage, currentStationId]);

  // Select initial image if none selected
  useEffect(() => {
    if (!selectedImage && availableImages.length > 0) {
      setSelectedImage(availableImages[0]);
    }
  }, [availableImages, selectedImage]);

  // Image rotation state for projector and operator
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Reset rotation when image changes
  useEffect(() => {
    setImageRotation(0);
  }, [selectedImage?.id]);

  const handleRotateImage = () => {
    const nextRot = (imageRotation + 90) % 360;
    setImageRotation(nextRot);
    if (selectedImage) {
      const imgId = selectedImage.imageId || selectedImage.name;
      updateLiveSync({
        currentRound: 1,
        activeParticipantId: activeParticipant?.id || null,
        locationId: currentStationId,
        activeItem: {
          type: 'image',
          title: `IMAGE ID: ${imgId}`,
          mediaUrl: selectedImage.url,
          id: selectedImage.id,
          rotation: nextRot,
        },
      }).catch(() => {});
    }
  };

  // Sync with projector screen
  useEffect(() => {
    if (selectedImage) {
      const imgId = selectedImage.imageId || selectedImage.name;
      updateLiveSync({
        currentRound: 1,
        activeParticipantId: activeParticipant?.id || null,
        locationId: currentStationId,
        activeItem: {
          type: 'image',
          title: `IMAGE ID: ${imgId}`,
          mediaUrl: selectedImage.url,
          id: selectedImage.id,
          rotation: imageRotation,
        },
      }).catch(() => {});
    }
  }, [selectedImage?.id, selectedImage?.imageId, selectedImage?.name, activeParticipant?.id, currentStationId, updateLiveSync, imageRotation]);

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
      };

      const saved = await saveRound1Result(resultPayload);
      setLastSavedResult(saved);
    },
    [activeParticipant, selectedImage, speechSeconds, saveRound1Result]
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
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
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">Image to Speech</h1>
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

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">Contestant:</span>
            <select
              value={activeParticipant?.id || ''}
              onChange={(e) => {
                const p = db?.participants.find((item) => item.id === e.target.value);
                if (p) setActiveParticipant(p);
              }}
              className="bg-transparent text-white font-bold font-['Outfit'] focus:outline-none max-w-[220px] truncate"
            >
              {stationParticipants.length === 0 ? (
                <option value="" disabled className="bg-slate-900 text-amber-400">
                  No contestants in {currentStation?.name || 'this station'}
                </option>
              ) : (
                stationParticipants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.participantNumber} — {p.name}
                  </option>
                ))
              )}
            </select>
            {stationParticipants.length > 0 && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold font-mono">
                {stationParticipants.length}
              </span>
            )}
          </div>

          <button
            onClick={() => selectNextParticipant(stationParticipants.length > 0 ? stationParticipants : undefined)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50"
            title="Next Participant (Shortcut: N)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pool Status & Alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Image Pool:</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
            {unusedCount} Available
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
            {usedCount} Used
          </span>
          {db?.settings.round1.allowImageReuse && (
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
            onPhaseChange={setTimerPhase}
            onFinish={handleTimerFinish}
          />
        </div>
      </div>

      {/* Manual Gallery Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-3 font-['Outfit'] flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-400" />
              Select Round 1 Image Prompt
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
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
                  <div className="p-2 flex items-center justify-between">
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
    </div>
  );
};
