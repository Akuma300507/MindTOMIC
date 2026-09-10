import React, { useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  Tv,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  UserCheck,
  Zap,
  Radio,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MindToMicLogo } from '../common/MindToMicLogo';

export const Navbar: React.FC = () => {
  const {
    db,
    activeParticipant,
    selectNextParticipant,
    isConnected,
    soundUnlocked,
    unlockSound,
    isFullscreen,
    toggleFullscreen,
    triggerBuzzer,
    setCurrentPage,
    currentStationId,
    setCurrentStationId,
    allStations,
    claimStation,
    deviceId,
    requestResetAllStatuses,
  } = useApp();

  const [showMobileModal, setShowMobileModal] = useState(false);
  const [buzzerPressed, setBuzzerPressed] = useState(false);

  const handleManualBuzzer = async () => {
    setBuzzerPressed(true);
    await triggerBuzzer('Navbar Quick Buzzer');
    setTimeout(() => setBuzzerPressed(false), 400);
  };

  const handleStationChange = async (stationId: string) => {
    setCurrentStationId(stationId);
    await claimStation(stationId);
  };

  const appUrl = window.location.origin;
  const mobileBuzzerUrl = `${appUrl}/?page=buzzer&mode=mobile`;

  const activeStation = allStations.find((s) => s.id === currentStationId);
  const isControlling = activeStation?.claimedByDeviceId === deviceId;

  return (
    <>
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-purple-900/30 px-3 md:px-6 flex items-center justify-between z-40 sticky top-0">
        {/* Brand identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-98"
          >
            <div className="h-10 px-1.5 rounded-xl bg-slate-950 border border-purple-500/40 shadow-lg shadow-purple-950/50 flex items-center justify-center relative group-hover:border-purple-400 transition-colors">
              <MindToMicLogo size={28} variant="emblem" showGlow={false} />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 font-['Outfit']">
                  {db?.settings.event.name || 'MIND TO MIC'}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                  Live
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Station Selector & Claim Status */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-purple-900/40 px-2.5 py-1 rounded-xl text-xs">
          <Radio className={`w-3.5 h-3.5 ${isControlling ? 'text-emerald-400' : 'text-purple-400'}`} />
          <span className="text-slate-400 font-medium hidden md:inline">Station:</span>
          <select
            id="station-selector-dropdown"
            value={currentStationId || ''}
            onChange={(e) => handleStationChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs font-bold text-white rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500"
          >
            {allStations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (R{s.currentRound})
              </option>
            ))}
          </select>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hidden sm:inline ${
              isControlling
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isControlling ? 'Locked' : 'Available'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Master View Shortcut */}
          <button
            id="navbar-master-btn"
            onClick={() => setCurrentPage('master')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 text-xs font-bold transition-colors"
            title="Open Master Dashboard (All Stations Monitor)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline">Master</span>
          </button>

          {/* Quick Reset All Statuses Button */}
          <button
            id="navbar-reset-statuses-btn"
            onClick={requestResetAllStatuses}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 text-xs font-bold transition-colors"
            title="Reset All Event Statuses"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xl:inline">Reset Statuses</span>
          </button>

          {/* Sound unlock / test audio */}
          {!soundUnlocked && (
            <button
              onClick={unlockSound}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold animate-pulse transition-colors"
              title="Click to enable sound playback for this browser"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audio</span>
            </button>
          )}

          {/* Manual Buzzer Trigger Button */}
          <button
            id="navbar-buzzer-btn"
            onClick={handleManualBuzzer}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-150 ${
              buzzerPressed
                ? 'bg-rose-500 text-white scale-95 shadow-[0_0_20px_rgba(244,63,94,0.8)]'
                : 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 hover:shadow-rose-900/50'
            }`}
            title="Fire instant manual buzzer (Shortcut: B)"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Buzzer</span>
          </button>

          {/* Mobile phone buzzer connection modal trigger */}
          <button
            onClick={() => setShowMobileModal(true)}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-purple-300 border border-purple-900/30 transition-colors"
            title="Connect Mobile Buzzer"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Projector Window Launcher */}
          <button
            onClick={() =>
              window.open(
                `${window.location.origin}/?page=projector&station=${currentStationId || 'station-a'}`,
                '_blank'
              )
            }
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-blue-300 border border-blue-900/30 transition-colors"
            title="Open Projector Display for this Station"
          >
            <Tv className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50 transition-colors"
            title="Toggle Fullscreen (Shortcut: F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Buzzer Connection Modal */}
      {showMobileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2 font-['Outfit']">
              <Smartphone className="w-5 h-5 text-purple-400" />
              Mobile Buzzer Connection
            </h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Connect any smartphone on your local Wi-Fi to use its loudspeaker as an external buzzer!
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 space-y-2">
              <p className="text-xs text-purple-300 font-semibold uppercase tracking-wider">Mobile Buzzer URL:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={mobileBuzzerUrl}
                  className="bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-700 w-full select-all font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mobileBuzzerUrl);
                    alert('Mobile buzzer URL copied to clipboard!');
                  }}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-semibold rounded-lg text-white"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-purple-950/40 border border-purple-900/50 rounded-xl p-3 mb-5 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>How to use:</span>
              </div>
              <p>1. Open this URL on your mobile phone browser.</p>
              <p>2. Tap the <strong>"Enable Sound"</strong> button once on the phone.</p>
              <p>3. When timers end or the organizer presses Buzzer, the phone will sound!</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMobileModal(false);
                  setCurrentPage('buzzer');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Go to Buzzer Center
              </button>
              <button
                onClick={() => setShowMobileModal(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
