import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Zap,
  Smartphone,
  CheckCircle2,
  Radio,
  Sliders,
  Bell,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { soundEngine } from '../lib/audio';

export const BuzzerControl: React.FC = () => {
  const { db, triggerBuzzer, isConnected, soundUnlocked, unlockSound, updateSettings } = useApp();

  const [copied, setCopied] = useState(false);
  const [buzzerFiring, setBuzzerFiring] = useState(false);
  const [selectedSound, setSelectedSound] = useState<'horn' | 'digital' | 'alarm' | 'siren'>(
    db?.settings.buzzer.sound || 'horn'
  );
  const [volume, setVolume] = useState<number>(db?.settings.buzzer.volume ?? 90);

  useEffect(() => {
    if (db?.settings.buzzer) {
      setSelectedSound(db.settings.buzzer.sound);
      setVolume(db.settings.buzzer.volume);
    }
  }, [db?.settings.buzzer]);

  const mobileBuzzerUrl = `${window.location.origin}/?page=buzzer&mode=mobile`;

  const handleFireBuzzer = async () => {
    unlockSound();
    setBuzzerFiring(true);
    await triggerBuzzer('Buzzer Center Action');
    setTimeout(() => setBuzzerFiring(false), 500);
  };

  const handleTestSpecificSound = (snd: 'horn' | 'digital' | 'alarm' | 'siren') => {
    unlockSound();
    soundEngine.playBuzzer(snd, volume);
  };

  const handleSaveSoundChoice = async (snd: 'horn' | 'digital' | 'alarm' | 'siren') => {
    setSelectedSound(snd);
    if (db?.settings) {
      await updateSettings({
        buzzer: {
          ...db.settings.buzzer,
          sound: snd,
          volume,
        },
      });
    }
  };

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    if (db?.settings) {
      await updateSettings({
        buzzer: {
          ...db.settings.buzzer,
          volume: newVol,
        },
      });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(mobileBuzzerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Check if we are in mobile buzzer receiver mode (e.g., opened on phone via URL)
  const isMobileMode = new URLSearchParams(window.location.search).get('mode') === 'mobile';

  if (isMobileMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Connected External Buzzer
            </div>
            <h1 className="text-2xl font-black text-white font-['Outfit'] mt-2">MIND TO MIC BUZZER</h1>
            <p className="text-xs text-slate-400">This phone is connected as a remote loudspeaker.</p>
          </div>

          {!soundUnlocked ? (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-amber-200 leading-relaxed font-medium">
                Mobile browsers require 1 tap to allow incoming audio playback:
              </p>
              <button
                onClick={unlockSound}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-950/60 transition-transform active:scale-95"
              >
                🔊 Enable Audio On This Phone
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Audio Unlocked & Standing By!</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleFireBuzzer}
              className={`w-full py-6 rounded-2xl font-black text-xl tracking-wider uppercase shadow-2xl transition-all active:scale-95 ${
                buzzerFiring
                  ? 'bg-rose-500 text-white scale-95 shadow-[0_0_30px_rgba(244,63,94,1)]'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/80'
              }`}
            >
              ⚡ MANUAL BUZZER
            </button>

            <button
              onClick={() => handleTestSpecificSound(selectedSound)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
            >
              Test Sound Tone
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
          <Volume2 className="w-7 h-7 text-rose-400" />
          Buzzer Control & Mobile Station
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manual buzzer controls, sound synthesis preview, and wireless mobile loudspeaker architecture.
        </p>
      </div>

      {/* Main Large Manual Buzzer Trigger Button */}
      <div className="bg-slate-900/90 border border-purple-900/40 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/20 via-transparent to-purple-950/20 pointer-events-none" />

        <div className="mb-6 space-y-2 z-10">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            Live Hardware Broadcast
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white font-['Outfit']">Instant Manual Buzzer</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Pressing this button sounds the synthesized audio tone immediately on this laptop and triggers all connected mobile phone speakers.
          </p>
        </div>

        {/* GIANT BUZZER BUTTON */}
        <button
          onClick={handleFireBuzzer}
          className={`z-10 w-52 h-52 sm:w-60 sm:h-60 rounded-full font-black text-2xl sm:text-3xl tracking-widest uppercase transition-all duration-150 flex flex-col items-center justify-center gap-2 border-8 border-rose-950 shadow-2xl active:scale-95 ${
            buzzerFiring
              ? 'bg-rose-500 text-white scale-95 shadow-[0_0_80px_rgba(244,63,94,0.9)]'
              : 'bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 text-white hover:from-rose-600 hover:to-red-400 shadow-rose-950/80 hover:shadow-[0_0_50px_rgba(244,63,94,0.6)]'
          }`}
          title="Fire Buzzer (Shortcut: B)"
        >
          <Zap className="w-10 h-10 sm:w-12 sm:h-12 fill-current animate-pulse" />
          <span>BUZZER</span>
          <span className="text-[10px] font-mono tracking-widest text-rose-200/80">HOTKEY: [B]</span>
        </button>
      </div>

      {/* Tone Selection & Volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sound Signatures */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <Sliders className="w-5 h-5 text-purple-400" />
            <span>Select Buzzer Tone</span>
          </div>

          <div className="space-y-2">
            {[
              { id: 'horn', name: 'Classic Air Horn', desc: 'Powerful low brass sawtooth cluster' },
              { id: 'digital', name: 'Digital Klaxon', desc: 'Square wave dual-pitch staccato' },
              { id: 'alarm', name: 'Urgent Alarm', desc: 'Rapid 4-pulse high-frequency sine alert' },
              { id: 'siren', name: 'Deep Siren', desc: 'Pitch-swept frequency modulated alarm' },
            ].map((snd) => {
              const isSelected = selectedSound === snd.id;
              return (
                <div
                  key={snd.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-purple-950/50 border-purple-500/50 shadow-md shadow-purple-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-2">
                      <span>{snd.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 text-[9px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{snd.desc}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestSpecificSound(snd.id as any)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                      title="Preview sound"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Test</span>
                    </button>

                    {!isSelected && (
                      <button
                        onClick={() => handleSaveSoundChoice(snd.id as any)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume & Remote Device Sync */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center gap-2 text-white font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <span>Mobile Device Link</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Master Output Volume</span>
              <span className="font-mono text-purple-300 font-bold">{volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value) || 0)}
              className="w-full accent-purple-500"
            />
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Mobile Web URL:</span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Auto-Broadcast Ready
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={mobileBuzzerUrl}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-lg w-full font-mono select-all"
              />
              <button
                onClick={copyUrl}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 pt-1">
              <p>• Connect any phone or tablet on the local network.</p>
              <p>• The phone will automatically ring when the timer hits zero or on manual buzz!</p>
            </div>

            <div className="pt-2">
              <a
                href={mobileBuzzerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
              >
                <span>Test mobile buzzer page in new tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Audio Cues & Buzzer Sequence Preview */}
      <div className="bg-slate-900/90 border border-purple-900/40 p-6 sm:p-8 rounded-3xl shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-['Outfit'] flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-400" />
              <span>Stage Audio Cues & Timer Buzzer Sequence</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Preview the 3 distinct stage sound cues and verify the silent manual stop behavior.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold self-start sm:self-auto">
            LIVE AUDIO ENGINE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cue 1: Prep Over Buzzer */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-mono font-black">
                  1
                </span>
                <span>Prep Time Over Buzzer</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Distinct energetic dual-tone buzzer sound when the preparation countdown reaches zero.
              </p>
            </div>
            <button
              onClick={() => soundEngine.playPrepOverBuzzer(volume)}
              className="w-full py-2 px-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Prep Buzzer</span>
            </button>
          </div>

          {/* Cue 2: Warning Hint Tick */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-mono font-black">
                  2
                </span>
                <span>Warning Countdown Tick</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Small audible clock tick giving the speaker a clear hint that time is about to finish (last 10 seconds).
              </p>
            </div>
            <button
              onClick={() => soundEngine.playWarningTick(volume)}
              className="w-full py-2 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Test Warning Tick</span>
            </button>
          </div>

          {/* Cue 3: Time Up Finish Buzzer */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-mono font-black">
                  3
                </span>
                <span>Time Up Finish Buzzer</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Authoritative full-volume buzzer blast triggered when the speech time limit expires.
              </p>
            </div>
            <button
              onClick={() => handleTestSpecificSound(selectedSound)}
              className="w-full py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Test Finish Buzzer</span>
            </button>
          </div>
        </div>

        {/* Note on Manual Stop */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Manual Stop Action:</strong> Completely silent. No buzzer sound is played when clicking the STOP button on any stage or station.
          </span>
        </div>
      </div>
    </div>
  );
};
