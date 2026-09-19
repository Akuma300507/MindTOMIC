import React from 'react';
import {
  Clock,
  Sparkles,
  ExternalLink,
  Tv,
  Image as ImageIcon,
  Disc,
  Trophy,
  Radio,
} from 'lucide-react';
import { computeStationTimer } from '../../lib/timerUtils';
import { MindToMicLogo } from './MindToMicLogo';
import { InspireLogo } from './InspireLogo';
import { type StationState } from '../../types';

interface MiniProjectorPreviewProps {
  station: StationState;
  nowMs: number;
  aspectRatio?: string;
  showPopout?: boolean;
  className?: string;
}

export const MiniProjectorPreview: React.FC<MiniProjectorPreviewProps> = ({
  station,
  nowMs,
  aspectRatio = 'aspect-video',
  showPopout = true,
  className = '',
}) => {
  const currentRound = station.currentRound || 1;
  const activeParticipant = station.activeParticipant;
  const computedTimer = computeStationTimer(station, nowMs);

  const isRunning = computedTimer.isRunning;
  const remainingSecs = computedTimer.remainingSeconds;
  const isOvertime = computedTimer.isOvertime;
  const timerPhase = computedTimer.phase;
  const isWarning = timerPhase === 'speech' && remainingSecs <= 30 && remainingSecs > 0;
  const isTimeUp = station.status === 'TIME_UP' || (timerPhase === 'speech' && remainingSecs <= 0 && !isOvertime);

  // Active media
  const round1Image = station.selectedImage || station.assignedImage;
  const round2Topic =
    station.wheelSpin?.targetTopicTitle ||
    station.selectedTopic?.topic ||
    station.assignedTopic?.topic;
  const round2Category =
    station.wheelSpin?.targetTopicCategory ||
    station.selectedTopic?.category ||
    station.assignedTopic?.category;
  const round3Topic =
    station.selectedTopic?.topic ||
    station.assignedTopic?.topic;

  const handleOpenProjector = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`${window.location.origin}/?page=projector&station=${station.id}`, '_blank');
  };

  return (
    <div
      className={`relative w-full ${aspectRatio} rounded-2xl bg-slate-950 border border-purple-900/40 overflow-hidden shadow-2xl flex flex-col justify-between p-2.5 select-none font-['Outfit'] group/preview transition-all ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/40 via-slate-950 to-indigo-950/40 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-36 h-36 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-36 h-36 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between gap-1.5 border-b border-purple-900/30 pb-1.5 shrink-0 text-[10px]">
        {/* Left: Brand & Stage */}
        <div className="flex items-center gap-1.5 min-w-0">
          <MindToMicLogo size={20} showGlow={false} className="shrink-0" />
          <span className="font-extrabold text-white tracking-tight truncate text-[11px]">
            {station.name || 'Stage'}
          </span>
        </div>

        {/* Center: Inspire & Round Badge */}
        <div className="flex items-center gap-1 shrink-0">
          <InspireLogo size={18} showGlow={false} />
          <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 text-amber-300 border border-amber-500/30">
            {currentRound === 1 && 'R1 • Pixel Pictionary'}
            {currentRound === 2 && 'R2 • Arcade Wheel'}
            {currentRound === 3 && 'R3 • Championship'}
          </span>
        </div>

        {/* Right: Stage Clock & Popout */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border font-mono font-bold text-[10px] ${
              isOvertime
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                : isTimeUp
                ? 'bg-rose-950/80 border-rose-500/80 text-rose-400'
                : isWarning
                ? 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                : isRunning
                ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
            <span>{isOvertime ? computedTimer.formattedOvertime : computedTimer.formattedCountdown}</span>
          </div>

          {showPopout && (
            <button
              onClick={handleOpenProjector}
              className="p-1 rounded-md bg-slate-900/80 hover:bg-purple-900/80 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Open full projector screen in new tab"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center Stage Display Area */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center p-1 overflow-hidden">
        {activeParticipant ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-1">
            {/* Contestant Spotlight Pill */}
            <div className="shrink-0 flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/60 shadow-md">
              <span className="font-mono text-[9px] font-extrabold text-purple-300">
                #{activeParticipant.participantNumber}
              </span>
              <span className="font-black text-white text-[11px] truncate max-w-[150px]">
                {activeParticipant.name}
              </span>
            </div>

            {/* Media Content Area */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              {/* Round 1: Image Showcase */}
              {currentRound === 1 && (
                <div className="relative max-h-full max-w-full flex items-center justify-center">
                  {round1Image?.url ? (
                    <img
                      src={round1Image.url}
                      alt={round1Image.name || 'Round 1 Media'}
                      style={{
                        transform: `rotate(${station.imageRotation || 0}deg)`,
                      }}
                      className="max-h-24 sm:max-h-28 object-contain rounded-lg border border-purple-800/40 shadow-lg transition-transform duration-300"
                    />
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 flex flex-col items-center gap-1 text-[10px]">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <span className="font-medium truncate max-w-[160px]">
                        {round1Image?.name || 'Awaiting image selection'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Round 2: Wheel / Topic Showcase */}
              {currentRound === 2 && (
                <div className="w-full max-w-[220px] px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-purple-950/70 border border-purple-700/50 shadow-md flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1 text-[8px] font-bold text-amber-300 uppercase tracking-wider">
                    <Disc className="w-2.5 h-2.5 animate-spin" />
                    <span>{round2Category || 'Arcade Wheel'}</span>
                  </div>
                  <p className="font-black text-white text-[11px] leading-tight line-clamp-2">
                    {round2Topic || 'Spin wheel to draw topic'}
                  </p>
                </div>
              )}

              {/* Round 3: Championship Finals Prompt */}
              {currentRound === 3 && (
                <div className="w-full max-w-[220px] px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/50 via-yellow-950/40 to-amber-950/50 border border-amber-500/50 shadow-md flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1 text-[8px] font-bold text-amber-400 uppercase tracking-wider">
                    <Trophy className="w-2.5 h-2.5 text-amber-400" />
                    <span>Finals Stage</span>
                  </div>
                  <p className="font-black text-amber-200 text-[11px] leading-tight line-clamp-2">
                    {round3Topic || 'Championship Speech Prompt'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-1">
            <Radio className="w-5 h-5 text-purple-400/60 animate-pulse" />
            <span className="text-[10px] font-semibold tracking-wide text-slate-400">
              Stage Standby • Awaiting Speaker
            </span>
          </div>
        )}
      </div>

      {/* Bottom Footer Overlay */}
      <div className="relative z-10 flex items-center justify-between border-t border-purple-900/30 pt-1 text-[9px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
            }`}
          />
          <span className="font-mono uppercase font-bold text-slate-400">
            {isRunning ? 'Stage Live' : 'Standby'}
          </span>
        </div>

        <span className="font-mono text-purple-300/80 font-bold">
          {station.location || 'Stage Feed'}
        </span>
      </div>
    </div>
  );
};
