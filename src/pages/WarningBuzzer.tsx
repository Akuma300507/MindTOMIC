import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Volume2,
  Upload,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Trash2,
  Save,
  ChevronRight,
  Disc,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { soundEngine } from '../lib/audio';

export const WarningBuzzer: React.FC = () => {
  const {
    db,
    updateSettings,
    triggerWarningBuzzer,
    uploadCustomWarningBuzzer,
    resetCustomWarningBuzzer,
    soundUnlocked,
    unlockSound,
    setCurrentPage,
  } = useApp();

  // Local Form state
  const [warningSound, setWarningSound] = useState<'double_beep' | 'chime' | 'soft_bell' | 'klaxon' | 'custom'>('double_beep');
  const [warningVolume, setWarningVolume] = useState<number>(85);
  const [warningCustomAudioUrl, setWarningCustomAudioUrl] = useState<string | undefined>(undefined);
  const [warningCustomAudioName, setWarningCustomAudioName] = useState<string | undefined>(undefined);

  // Per Round Timings
  const [r1Time, setR1Time] = useState<number>(30);
  const [r1Enabled, setR1Enabled] = useState<boolean>(true);

  const [r2Time, setR2Time] = useState<number>(30);
  const [r2Enabled, setR2Enabled] = useState<boolean>(true);

  const [r3Time, setR3Time] = useState<number>(30);
  const [r3Enabled, setR3Enabled] = useState<boolean>(true);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [firingWarning, setFiringWarning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize state with db.settings
  useEffect(() => {
    if (db?.settings) {
      const buzzer = db.settings.buzzer;
      setWarningSound(buzzer?.warningSound || 'double_beep');
      setWarningVolume(buzzer?.warningVolume ?? 85);
      setWarningCustomAudioUrl(buzzer?.warningCustomAudioUrl);
      setWarningCustomAudioName(buzzer?.warningCustomAudioName);

      setR1Time(db.settings.round1?.warningTimeSeconds ?? 30);
      setR1Enabled(db.settings.round1?.warningBuzzerEnabled ?? true);

      setR2Time(db.settings.round2?.warningTimeSeconds ?? 30);
      setR2Enabled(db.settings.round2?.warningBuzzerEnabled ?? true);

      setR3Time(db.settings.round3?.warningTimeSeconds ?? 30);
      setR3Enabled(db.settings.round3?.warningBuzzerEnabled ?? true);
    }
  }, [db?.settings]);

  // Test local warning sound
  const handleTestSound = () => {
    unlockSound();
    soundEngine.playWarningBuzzer(warningSound, warningVolume, warningCustomAudioUrl);
  };

  // Broadcast network warning buzzer to all devices
  const handleBroadcastWarning = async () => {
    unlockSound();
    setFiringWarning(true);
    await triggerWarningBuzzer('Warning Buzzer System Center Broadcast');
    setTimeout(() => setFiringWarning(false), 600);
  };

  // Custom audio file upload handler
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Audio file must be under 5MB');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await uploadCustomWarningBuzzer(base64Data, file.name);
        setWarningSound('custom');
        setWarningCustomAudioUrl(base64Data);
        setWarningCustomAudioName(file.name);
        setUploading(false);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to upload warning audio');
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read audio file');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Reset custom audio
  const handleResetAudio = async () => {
    if (!confirm('Remove custom warning audio and revert to default synthesized alert?')) return;
    try {
      await resetCustomWarningBuzzer();
      setWarningSound('double_beep');
      setWarningCustomAudioUrl(undefined);
      setWarningCustomAudioName(undefined);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to reset warning audio');
    }
  };

  // Save all settings to server
  const handleSaveSettings = async () => {
    if (!db?.settings) return;

    const updated = {
      ...db.settings,
      buzzer: {
        ...db.settings.buzzer,
        warningSound,
        warningVolume,
        warningCustomAudioUrl,
        warningCustomAudioName,
      },
      round1: {
        ...db.settings.round1,
        warningTimeSeconds: r1Time,
        warningBuzzerEnabled: r1Enabled,
      },
      round2: {
        ...db.settings.round2,
        warningTimeSeconds: r2Time,
        warningBuzzerEnabled: r2Enabled,
      },
      round3: {
        ...db.settings.round3,
        warningTimeSeconds: r3Time,
        warningBuzzerEnabled: r3Enabled,
      },
    };

    await updateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-500/30">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            Mid-Round Timing Alert
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            Warning Buzzer System
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure round warning timings, upload custom buzzer sound files, adjust volume, and test warning alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/60 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Settings</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Warning buzzer configuration saved and synchronized to all active stages!</span>
        </div>
      )}

      {/* Broadcast & Test Bar */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/40 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Live Stage Cue Broadcasting
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white font-['Outfit']">
            Instant Warning Buzzer Broadcast
          </h3>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Trigger an immediate warning buzzer sound across the organizer laptop, speaker stations, projector displays, and connected mobile phone speakers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleTestSound}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700/80 flex items-center gap-2 transition-all cursor-pointer"
            title="Preview warning sound on this device only"
          >
            <Volume2 className="w-4 h-4 text-blue-400" />
            <span>Preview Sound</span>
          </button>

          <button
            onClick={handleBroadcastWarning}
            disabled={firingWarning}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 border border-blue-400 shadow-xl transition-all cursor-pointer ${
              firingWarning
                ? 'bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.8)] scale-95'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/80'
            }`}
            title="Broadcast to all stages and phones"
          >
            <Bell className="w-4 h-4 fill-current" />
            <span>{firingWarning ? 'BROADCASTING...' : 'TRIGGER WARNING BUZZER'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 Cols): Per-Round Warning Timing Settings */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/90 border border-purple-900/30 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 text-white font-bold font-['Outfit'] text-base">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>Round Warning Timing Configuration</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-300">
                SCHEDULED TIMINGS
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Define at what time (in seconds remaining before the speech expires) the warning buzzer should automatically sound for each round.
            </p>

            <div className="space-y-4">
              {/* Round 1 Card */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <h4 className="font-bold text-white text-sm font-['Outfit']">Round 1: Pixel Pictionary</h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={r1Enabled}
                      onChange={(e) => setR1Enabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                    <span className={r1Enabled ? 'text-blue-300 font-bold' : 'text-slate-500'}>
                      {r1Enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      Warning Time (Seconds Remaining)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={Math.max(5, (db?.settings?.round1?.speechTimeSeconds || 120) - 1)}
                        value={r1Time}
                        onChange={(e) => setR1Time(parseInt(e.target.value) || 30)}
                        className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <span className="text-xs text-slate-400 font-semibold">seconds left</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    With a {db?.settings?.round1?.speechTimeSeconds || 120}s speech limit, warning buzzer plays at{' '}
                    <strong className="text-blue-300 font-mono">{r1Time}s</strong> remaining ({Math.max(0, (db?.settings?.round1?.speechTimeSeconds || 120) - r1Time)}s into speech).
                  </div>
                </div>
              </div>

              {/* Round 2 Card */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Disc className="w-4 h-4 text-purple-400" />
                    <h4 className="font-bold text-white text-sm font-['Outfit']">Round 2: Arcade Wheel</h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={r2Enabled}
                      onChange={(e) => setR2Enabled(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700"
                    />
                    <span className={r2Enabled ? 'text-purple-300 font-bold' : 'text-slate-500'}>
                      {r2Enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      Warning Time (Seconds Remaining)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={Math.max(5, (db?.settings?.round2?.speechTimeSeconds || 120) - 1)}
                        value={r2Time}
                        onChange={(e) => setR2Time(parseInt(e.target.value) || 30)}
                        className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-purple-500 focus:outline-none text-sm"
                      />
                      <span className="text-xs text-slate-400 font-semibold">seconds left</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    With a {db?.settings?.round2?.speechTimeSeconds || 120}s speech limit, warning buzzer plays at{' '}
                    <strong className="text-purple-300 font-mono">{r2Time}s</strong> remaining ({Math.max(0, (db?.settings?.round2?.speechTimeSeconds || 120) - r2Time)}s into speech).
                  </div>
                </div>
              </div>

              {/* Round 3 Card */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-sm font-['Outfit']">Round 3: The Mystery Cartridge</h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={r3Enabled}
                      onChange={(e) => setR3Enabled(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700"
                    />
                    <span className={r3Enabled ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                      {r3Enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      Warning Time (Seconds Remaining)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={Math.max(5, (db?.settings?.round3?.speechTimeSeconds || 120) - 1)}
                        value={r3Time}
                        onChange={(e) => setR3Time(parseInt(e.target.value) || 30)}
                        className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-purple-500 focus:outline-none text-sm"
                      />
                      <span className="text-xs text-slate-400 font-semibold">seconds left</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    With a {db?.settings?.round3?.speechTimeSeconds || 120}s speech limit, warning buzzer plays at{' '}
                    <strong className="text-emerald-300 font-mono">{r3Time}s</strong> remaining ({Math.max(0, (db?.settings?.round3?.speechTimeSeconds || 120) - r3Time)}s into speech).
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-950/60 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Timings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Sound File Upload, Tone Presets & Volume */}
        <div className="lg:col-span-5 space-y-6">
          {/* Audio Tone & Upload Card */}
          <div className="bg-slate-900/90 border border-purple-900/30 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold font-['Outfit'] text-base">
                <Volume2 className="w-5 h-5 text-purple-400" />
                <span>Warning Buzzer Sound</span>
              </div>
              {warningCustomAudioUrl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Custom Sound Active
                </span>
              )}
            </div>

            {/* Sound Signature Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Preset Sound Signature
              </label>
              <select
                value={warningSound}
                onChange={(e) => setWarningSound(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="double_beep">Double Staccato Beep (Default crisp alert)</option>
                <option value="chime">Resonant Harmonic Chime (Clear bell ring)</option>
                <option value="soft_bell">Soft Resonant Bell (Gentle chime)</option>
                <option value="klaxon">Cautionary Klaxon (Caution pulse)</option>
                {warningCustomAudioUrl && (
                  <option value="custom">Custom Uploaded Sound File</option>
                )}
              </select>
            </div>

            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">Warning Buzzer Volume</label>
                <span className="font-mono text-blue-300 font-bold">{warningVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={warningVolume}
                onChange={(e) => setWarningVolume(parseInt(e.target.value) || 0)}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Audio Upload Box */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-400" />
                  Custom Audio Upload
                </span>
                <span className="text-[10px] text-slate-500 font-mono">MAX 5MB</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Upload your own custom MP3, WAV, OGG, or M4A audio file to use as the warning buzzer sound.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                className="hidden"
                onChange={handleAudioUpload}
              />

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading Audio...' : warningCustomAudioUrl ? 'Replace Audio File' : 'Upload Audio File'}</span>
                </button>

                {warningCustomAudioUrl && (
                  <button
                    type="button"
                    onClick={handleResetAudio}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                    title="Remove custom audio file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}

              {warningCustomAudioUrl && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-blue-300 font-mono text-[11px] truncate max-w-[200px]">
                    ✓ {warningCustomAudioName || 'custom_warning.mp3'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (warningCustomAudioUrl) {
                        soundEngine.playAudioFile(warningCustomAudioUrl, warningVolume);
                      }
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Preview File</span>
                  </button>
                </div>
              )}
            </div>

            {/* Test Button */}
            <button
              onClick={handleTestSound}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700/80 transition-all cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-blue-400" />
              <span>Test Warning Sound ({warningVolume}%)</span>
            </button>
          </div>

          {/* Quick Round Navigation */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Jump To Round Stages
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setCurrentPage('round1')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-blue-950/40 text-slate-300 hover:text-blue-200 border border-slate-800 text-xs font-semibold transition-all text-center cursor-pointer"
              >
                Round 1
              </button>
              <button
                onClick={() => setCurrentPage('round2')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-purple-950/40 text-slate-300 hover:text-purple-200 border border-slate-800 text-xs font-semibold transition-all text-center cursor-pointer"
              >
                Round 2
              </button>
              <button
                onClick={() => setCurrentPage('round3')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-200 border border-slate-800 text-xs font-semibold transition-all text-center cursor-pointer"
              >
                Round 3
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
