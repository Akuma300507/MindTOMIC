import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Sparkles,
  Mic,
  Brain,
  CheckCircle2,
  X,
  Play,
  RotateCw,
  Flame,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MindToMicLogo } from './MindToMicLogo';
import type { Topic } from '../../types';

interface SpinRevealCardModalProps {
  topic: Topic | null;
  isOpen: boolean;
  onClose?: () => void;
  onStartTimer?: () => void;
  onReplaceOnWheel?: () => void;
  participantName?: string;
  participantNumber?: string;
  isProjector?: boolean;
}

export const SpinRevealCardModal: React.FC<SpinRevealCardModalProps> = ({
  topic,
  isOpen,
  onClose,
  onStartTimer,
  onReplaceOnWheel,
  participantName,
  participantNumber,
  isProjector = false,
}) => {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (isOpen && topic) {
      setFlipped(false);
      // Flip after a brief zoom-in delay (similar to the video animation)
      const flipTimer = setTimeout(() => {
        setFlipped(true);
        try {
          confetti({
            particleCount: 110,
            spread: 85,
            origin: { y: 0.55 },
            colors: ['#f59e0b', '#a855f7', '#00f5ff', '#ec4899', '#3b82f6'],
          });
        } catch {}
      }, 700);

      return () => clearTimeout(flipTimer);
    } else {
      setFlipped(false);
    }
  }, [isOpen, topic]);

  if (!isOpen || !topic) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Dimmed Backdrop Overlay with cinematic blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
        />

        {/* Ambient Pulsing Glow behind card */}
        <motion.div
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.35 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-amber-500/20 via-purple-600/30 to-cyan-500/20 blur-3xl pointer-events-none"
        />

        {/* 3D Perspective Card Container */}
        <div
          className="relative z-10 w-full max-w-lg sm:max-w-xl md:max-w-2xl"
          style={{ perspective: 1400 }}
        >
          {/* Emergence and 3D Flip Card */}
          <motion.div
            initial={{ scale: 0.1, y: 40, opacity: 0 }}
            animate={{
              scale: 1,
              y: 0,
              opacity: 1,
            }}
            transition={{
              duration: 0.75,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-full relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.85, ease: [0.34, 1.3, 0.64, 1] }}
              className="w-full relative"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* ============================================================ */}
              {/* CARD BACK (Shows Mind-to-Mic Logo during emergence) */}
              {/* ============================================================ */}
              <div
                className="w-full min-h-[360px] sm:min-h-[400px] md:min-h-[440px] rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 border-[3px] border-amber-400/90 shadow-[0_0_60px_rgba(245,158,11,0.45)] flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                {/* Metallic Corner Ornaments */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-amber-400/80 rounded-tl-lg" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-amber-400/80 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-amber-400/80 rounded-bl-lg" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-amber-400/80 rounded-br-lg" />

                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-pulse pointer-events-none" />

                {/* Mind to Mic Logo in Center */}
                <div className="my-auto flex flex-col items-center">
                  <MindToMicLogo size={130} variant="full" showGlow={true} />
                  <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-[11px] font-bold tracking-widest uppercase">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    REVEALING CHALLENGE
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* CARD FRONT (The Winning Topic Revealed Card) */}
              {/* ============================================================ */}
              <div
                className="absolute inset-0 w-full rounded-3xl p-6 sm:p-8 md:p-10 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 border-[3px] border-amber-400/95 shadow-[0_0_70px_rgba(245,158,11,0.5)] flex flex-col justify-between overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                {/* Metallic Corner Ornaments */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-amber-400/80 rounded-tl-lg" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-amber-400/80 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-amber-400/80 rounded-bl-lg" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-amber-400/80 rounded-br-lg" />

                {/* Watermark Logo in Card Front Background */}
                <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
                  <MindToMicLogo size={220} variant="emblem" showGlow={false} />
                </div>

                {/* Top Eyebrow / Tournament Header */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 font-['Outfit'] font-black text-xs sm:text-sm tracking-widest uppercase flex items-center gap-1.5 shadow-sm">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      YOUR TOURNAMENT EVENT
                    </span>
                    <span className="font-mono text-xs text-purple-300 bg-purple-950/70 border border-purple-800 px-2.5 py-0.5 rounded-lg font-bold">
                      ID: {topic.topicId || topic.id}
                    </span>
                  </div>

                  {onClose && (
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                      title="Close preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Main Selected Topic Section */}
                <div className="my-auto py-6 flex items-center gap-5 sm:gap-7 z-10">
                  {/* Themed Icon Badge in Golden Frame */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-600/30 to-blue-600/20 border-2 border-amber-400/70 p-1 flex-shrink-0 shadow-lg shadow-purple-950/80 flex items-center justify-center">
                    <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 to-amber-500/20" />
                      <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300 relative z-10 drop-shadow-[0_2px_10px_rgba(245,158,11,0.6)]" />
                      <Brain className="w-5 h-5 text-cyan-400 absolute top-2 right-2 z-10" />
                    </div>
                  </div>

                  {/* Topic Title & Category */}
                  <div className="space-y-2 flex-1">
                    <div className="inline-block px-2.5 py-0.5 rounded-md bg-purple-900/50 border border-purple-700/60 text-purple-200 text-xs font-semibold">
                      {topic.category || 'General Speech'}
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-['Outfit'] tracking-tight leading-tight drop-shadow-md">
                      "{topic.topic}"
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm font-medium">
                      Speak with clarity. Compete with confidence.
                    </p>
                  </div>
                </div>

                {/* Contestant Highlight if Available */}
                {participantName && (
                  <div className="px-4 py-2 rounded-xl bg-slate-950/70 border border-purple-900/40 flex items-center justify-between mb-4 z-10">
                    <span className="text-xs text-purple-300 font-medium">
                      Contestant on Stage:
                    </span>
                    <span className="text-sm font-black text-white font-['Outfit'] flex items-center gap-1.5">
                      {participantNumber && (
                        <span className="text-amber-400 font-mono">#{participantNumber}</span>
                      )}
                      {participantName}
                    </span>
                  </div>
                )}

                {/* Footer Controls / Button Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-purple-900/40 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-300/90 tracking-wider uppercase font-['Outfit'] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      GOOD LUCK, CHAMPIONS
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {onReplaceOnWheel && (
                      <button
                        onClick={onReplaceOnWheel}
                        className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-700/60 text-xs font-bold transition-all"
                        title="Replace this topic with next unused slice on wheel"
                      >
                        <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                        Replace on Wheel
                      </button>
                    )}

                    {onStartTimer ? (
                      <button
                        onClick={onStartTimer}
                        className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Speech Timer
                      </button>
                    ) : (
                      <button
                        onClick={onClose}
                        className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                      >
                        Ready for Stage
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
