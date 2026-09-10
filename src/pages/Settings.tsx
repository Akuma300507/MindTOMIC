import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Volume2,
  Clock,
  Disc,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Trash2,
  Play,
  Plus,
  MapPin,
  Flame,
  User,
  Phone,
  Shield,
  Edit3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { soundEngine } from '../lib/audio';
import { MindToMicLogo } from '../components/common/MindToMicLogo';
import { InspireLogo } from '../components/common/InspireLogo';
import type { EventSettings, EventStation } from '../types';

export const Settings: React.FC = () => {
  const {
    db,
    updateSettings,
    resetAllData,
    uploadCustomBuzzer,
    resetCustomBuzzer,
    uploadCustomPrepBuzzer,
    resetCustomPrepBuzzer,
    uploadCustomLogo,
    resetCustomLogo,
    uploadInspireLogo,
    resetInspireLogo,
    startNewEvent,
  } = useApp();

  const [form, setForm] = useState<EventSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [customAudioUploading, setCustomAudioUploading] = useState(false);
  const [customAudioError, setCustomAudioError] = useState<string | null>(null);

  // Preparation Buzzer Audio States
  const [customPrepAudioUploading, setCustomPrepAudioUploading] = useState(false);
  const [customPrepAudioError, setCustomPrepAudioError] = useState<string | null>(null);
  const prepAudioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Logo Customization States
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Inspire 2K26 Logo Customization States
  const [inspireLogoUploading, setInspireLogoUploading] = useState(false);
  const [inspireLogoError, setInspireLogoError] = useState<string | null>(null);
  const inspireLogoInputRef = useRef<HTMLInputElement | null>(null);

  // New Station Inputs
  const [newStationName, setNewStationName] = useState('');
  const [newStationLocation, setNewStationLocation] = useState('');
  const [newStationHandlerName, setNewStationHandlerName] = useState('');
  const [newStationHandlerRole, setNewStationHandlerRole] = useState('Stage Lead');
  const [newStationHandlerPhone, setNewStationHandlerPhone] = useState('');
  const [editingStationId, setEditingStationId] = useState<string | null>(null);

  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (db?.settings) {
      setForm(JSON.parse(JSON.stringify(db.settings)));
    }
  }, [db?.settings]);

  if (!form) return <div className="p-8 text-slate-400">Loading settings...</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestBuzzer = () => {
    soundEngine.unlock();
    soundEngine.playBuzzer(
      form.buzzer.sound,
      form.buzzer.volume,
      form.buzzer.customAudioUrl
    );
  };

  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCustomAudioError('Audio file must be under 5MB');
      return;
    }

    setCustomAudioUploading(true);
    setCustomAudioError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await uploadCustomBuzzer(base64Data, file.name);
        setCustomAudioUploading(false);
      } catch (err: any) {
        setCustomAudioError(err.message || 'Failed to upload custom audio');
        setCustomAudioUploading(false);
      }
    };
    reader.onerror = () => {
      setCustomAudioError('Error reading audio file');
      setCustomAudioUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleTestPrepBuzzer = () => {
    soundEngine.unlock();
    soundEngine.playPrepOverBuzzer(
      form.buzzer.prepSound || 'dual_alert',
      form.buzzer.prepVolume ?? 85,
      form.buzzer.prepCustomAudioUrl
    );
  };

  const handleCustomPrepAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCustomPrepAudioError('Audio file must be under 5MB');
      return;
    }

    setCustomPrepAudioUploading(true);
    setCustomPrepAudioError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await uploadCustomPrepBuzzer(base64Data, file.name);
        setForm((prev) =>
          prev
            ? {
                ...prev,
                buzzer: {
                  ...prev.buzzer,
                  prepSound: 'custom',
                  prepCustomAudioUrl: base64Data,
                  prepCustomAudioName: file.name,
                },
              }
            : prev
        );
        setCustomPrepAudioUploading(false);
      } catch (err: any) {
        setCustomPrepAudioError(err.message || 'Failed to upload custom prep audio');
        setCustomPrepAudioUploading(false);
      }
    };
    reader.onerror = () => {
      setCustomPrepAudioError('Error reading audio file');
      setCustomPrepAudioUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload a valid image file (PNG, SVG, JPG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Image file must be under 5MB');
      return;
    }

    setLogoUploading(true);
    setLogoError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await uploadCustomLogo(base64Data, file.name);
        setForm((prev) =>
          prev
            ? {
                ...prev,
                event: {
                  ...prev.event,
                  customLogoUrl: base64Data,
                  customLogoName: file.name,
                },
              }
            : prev
        );
        setLogoUploading(false);
      } catch (err: any) {
        setLogoError(err.message || 'Failed to upload logo');
        setLogoUploading(false);
      }
    };
    reader.onerror = () => {
      setLogoError('Error reading image file');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    try {
      await resetCustomLogo();
      setForm((prev) =>
        prev
          ? {
              ...prev,
              event: {
                ...prev.event,
                customLogoUrl: undefined,
                customLogoName: undefined,
              },
            }
          : prev
      );
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (err: any) {
      setLogoError(err.message || 'Failed to reset logo');
    }
  };

  const handleInspireLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setInspireLogoError('Please upload a valid image file (PNG, SVG, JPG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setInspireLogoError('Image file must be under 5MB');
      return;
    }

    setInspireLogoUploading(true);
    setInspireLogoError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await uploadInspireLogo(base64Data, file.name);
        setForm((prev) =>
          prev
            ? {
                ...prev,
                event: {
                  ...prev.event,
                  inspireLogoUrl: base64Data,
                  inspireLogoName: file.name,
                },
              }
            : prev
        );
        setInspireLogoUploading(false);
      } catch (err: any) {
        setInspireLogoError(err.message || 'Failed to upload Inspire logo');
        setInspireLogoUploading(false);
      }
    };
    reader.onerror = () => {
      setInspireLogoError('Error reading image file');
      setInspireLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleResetInspireLogo = async () => {
    try {
      await resetInspireLogo();
      setForm((prev) =>
        prev
          ? {
              ...prev,
              event: {
                ...prev.event,
                inspireLogoUrl: undefined,
                inspireLogoName: undefined,
              },
            }
          : prev
      );
      if (inspireLogoInputRef.current) inspireLogoInputRef.current.value = '';
    } catch (err: any) {
      setInspireLogoError(err.message || 'Failed to reset Inspire logo');
    }
  };

  const handleAddStation = () => {
    if (!newStationName.trim()) return;
    const newStation: EventStation = {
      id: `station-${Date.now()}`,
      name: newStationName.trim(),
      location: newStationLocation.trim() || 'Auditorium',
      handlerName: newStationHandlerName.trim() || undefined,
      handlerRole: newStationHandlerRole.trim() || undefined,
      handlerPhone: newStationHandlerPhone.trim() || undefined,
      handlerStatus: 'ready',
    };
    const currentStations = form.stations || [];
    setForm({
      ...form,
      stations: [...currentStations, newStation],
    });
    setNewStationName('');
    setNewStationLocation('');
    setNewStationHandlerName('');
    setNewStationHandlerPhone('');
  };

  const handleUpdateStationField = (id: string, updates: Partial<EventStation>) => {
    const currentStations = form.stations || [];
    setForm({
      ...form,
      stations: currentStations.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    });
  };

  const handleDeleteStation = (id: string) => {
    const currentStations = form.stations || [];
    if (currentStations.length <= 1) {
      alert('At least one station must be configured.');
      return;
    }
    setForm({
      ...form,
      stations: currentStations.filter((s) => s.id !== id),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-purple-400" />
            Event Configuration & Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Customize event branding, precision timers for all 3 rounds, buzzer sounds, and wheel dynamics.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section: Event Branding */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-purple-300 font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Event Identity & Branding</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Name</label>
              <input
                type="text"
                required
                value={form.event.name}
                onChange={(e) => setForm({ ...form, event: { ...form.event, name: e.target.value } })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tagline</label>
              <input
                type="text"
                required
                value={form.event.tagline}
                onChange={(e) => setForm({ ...form, event: { ...form.event, tagline: e.target.value } })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Logo preview and management */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0 shadow-inner">
                  <MindToMicLogo size={52} variant="emblem" showGlow={false} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex flex-wrap items-center gap-2">
                    <span>Official Mind to Mic Logo</span>
                    {form.event.customLogoUrl ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/60 font-medium">
                        Custom: {form.event.customLogoName || 'Uploaded File'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium">
                        Original Asset (/logo.svg)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Used exclusively across headers, navigation, Round 2 spinning wheel center medallion, and presentation screens.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{logoUploading ? 'Uploading...' : 'Change / Upload Logo'}</span>
                </button>

                {form.event.customLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-slate-700/60"
                    title="Reset to default official logo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Original</span>
                  </button>
                )}
              </div>
            </div>

            {logoError && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{logoError}</span>
              </p>
            )}
          </div>

          {/* Inspire 2K26 Logo preview and management */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-900/40 flex items-center justify-center shrink-0 shadow-inner">
                  <InspireLogo size={54} showGlow={false} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex flex-wrap items-center gap-2">
                    <span>Inspire 2K26: The Arcade Archives Logo</span>
                    {form.event.inspireLogoUrl ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800/60 font-medium">
                        Custom: {form.event.inspireLogoName || 'Uploaded File'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                        Default Inspire Vector Asset
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Featured prominently in the top center of the Projector & Stage View for the championship audience.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <input
                  ref={inspireLogoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInspireLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => inspireLogoInputRef.current?.click()}
                  disabled={inspireLogoUploading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{inspireLogoUploading ? 'Uploading...' : 'Upload Inspire Logo'}</span>
                </button>

                {form.event.inspireLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetInspireLogo}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-slate-700/60"
                    title="Reset to default Inspire logo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                )}
              </div>
            </div>

            {inspireLogoError && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{inspireLogoError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Section: Round 1 Settings */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-blue-300 font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <ImageIcon className="w-5 h-5 text-blue-400" />
            <span>Round 1: Image to Speech Configuration</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Preparation Time (seconds)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={form.round1.prepTimeSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round1: { ...form.round1, prepTimeSeconds: parseInt(e.target.value) || 30 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 30s. Countdown with chime.</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Speech Duration (seconds)</label>
              <input
                type="number"
                min={10}
                max={600}
                value={form.round1.speechTimeSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round1: { ...form.round1, speechTimeSeconds: parseInt(e.target.value) || 120 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 120s (2 minutes).</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round1.allowImageReuse}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round1: { ...form.round1, allowImageReuse: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Allow Reusing Same Image in Round 1</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round1.buzzerEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round1: { ...form.round1, buzzerEnabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Play Buzzer When Round 1 Timer Reaches Zero</span>
            </label>
          </div>
        </div>

        {/* Section: Round 2 Settings */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-purple-300 font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <Disc className="w-5 h-5 text-purple-400" />
            <span>Round 2: Spinning Wheel & Speech Configuration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Active Wheel Topics Count <span className="text-purple-400 font-bold">*</span>
              </label>
              <input
                type="number"
                min={4}
                max={50}
                value={form.round2.activeWheelTopicCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, activeWheelTopicCount: parseInt(e.target.value) || 20 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Number of topics displayed on the spinning wheel (Default: 20).
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Preparation Time (seconds)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={form.round2.prepTimeSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, prepTimeSeconds: parseInt(e.target.value) || 30 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 30s.</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Speech Duration (seconds)</label>
              <input
                type="number"
                min={10}
                max={600}
                value={form.round2.speechTimeSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, speechTimeSeconds: parseInt(e.target.value) || 120 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 120s (2 minutes).</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round2.prepEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, prepEnabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Enable Prep Countdown in Round 2</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round2.topicReuseAllowed}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, topicReuseAllowed: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Allow Re-spinning Already Used Topics</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round2.buzzerEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round2: { ...form.round2, buzzerEnabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Play Buzzer at Zero</span>
            </label>
          </div>
        </div>

        {/* Section: Round 3 Settings */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-300 font-bold font-['Outfit'] text-base border-b border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Round 3: Final Speaking Timer Configuration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Speech Duration (seconds)</label>
              <input
                type="number"
                min={10}
                max={600}
                value={form.round3.speechTimeSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    round3: { ...form.round3, speechTimeSeconds: parseInt(e.target.value) || 120 },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 120s.</span>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.round3.buzzerEnabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      round3: { ...form.round3, buzzerEnabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
                />
                <span className="text-slate-300 font-medium">Play Buzzer When Round 3 Timer Reaches Zero</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section: Buzzer & Sound Engine */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold font-['Outfit'] text-base">
              <Volume2 className="w-5 h-5 text-rose-400" />
              <span>Buzzer Engine & Audio Settings</span>
            </div>
            {form.buzzer.customAudioUrl && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Custom Sound Active ({form.buzzer.customAudioName || 'Uploaded'})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Buzzer Sound Signature</label>
              <select
                value={form.buzzer.sound}
                onChange={(e) =>
                  setForm({
                    ...form,
                    buzzer: { ...form.buzzer, sound: e.target.value as any },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="horn">Classic Stadium Air Horn (Sawtooth Roar)</option>
                <option value="digital">Digital Staccato Klaxon</option>
                <option value="alarm">Urgent Staccato Alarm (Beep Sequence)</option>
                <option value="siren">Deep Frequency Modulated Siren</option>
                {form.buzzer.customAudioUrl && (
                  <option value="custom">Custom Uploaded Sound File</option>
                )}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">Volume Level</label>
                <span className="font-mono text-purple-300 font-bold">{form.buzzer.volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={form.buzzer.volume}
                onChange={(e) =>
                  setForm({
                    ...form,
                    buzzer: { ...form.buzzer, volume: parseInt(e.target.value) || 0 },
                  })
                }
                className="w-full accent-purple-500"
              />
            </div>

            <div className="flex items-center pt-3">
              <button
                type="button"
                onClick={handleTestBuzzer}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold transition-all"
              >
                <Volume2 className="w-4 h-4" />
                <span>Test Buzzer Sound</span>
              </button>
            </div>
          </div>

          {/* Custom Audio Upload Bar */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  Custom Buzzer Sound File
                </span>
                <p className="text-[11px] text-slate-400">
                  Upload an audio file (MP3, WAV, OGG, M4A, AAC up to 5MB) to play as the event buzzer.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  className="hidden"
                  onChange={handleCustomAudioUpload}
                />

                <button
                  type="button"
                  disabled={customAudioUploading}
                  onClick={() => audioFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{customAudioUploading ? 'Uploading...' : form.buzzer.customAudioUrl ? 'Replace Audio' : 'Upload Audio'}</span>
                </button>

                {form.buzzer.customAudioUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Reset custom buzzer back to default synthesized sound?')) {
                        await resetCustomBuzzer();
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-semibold"
                    title="Remove custom buzzer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {customAudioError && (
              <p className="text-xs text-rose-400 font-semibold">{customAudioError}</p>
            )}

            {form.buzzer.customAudioUrl && (
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="text-emerald-400 font-mono text-[11px]">
                  ✓ Active file: {form.buzzer.customAudioName || 'custom_sound.mp3'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (form.buzzer.customAudioUrl) {
                      soundEngine.playAudioFile(form.buzzer.customAudioUrl, form.buzzer.volume);
                    }
                  }}
                  className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>Preview Audio</span>
                </button>
              </div>
            )}
          </div>

          {/* Section: 30-Second Preparation Timer Buzzer */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
              <div>
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-['Outfit']">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  30-Second Preparation Timer Buzzer
                </span>
                <p className="text-[11px] text-slate-400">
                  Sound played automatically when the 30s preparation countdown finishes and speech time begins.
                </p>
              </div>
              {form.buzzer.prepCustomAudioUrl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800">
                  Custom Prep Sound Active ({form.buzzer.prepCustomAudioName || 'Uploaded'})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Prep Buzzer Sound Signature</label>
                <select
                  value={form.buzzer.prepSound || 'dual_alert'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      buzzer: { ...form.buzzer, prepSound: e.target.value as any },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="dual_alert">Energetic Dual-Pulse Alert (Default punchy buzz)</option>
                  <option value="staccato">Triple Staccato Alert (Sharp rapid pulses)</option>
                  <option value="chime">Resonant Harmonic Chime (Stage gong bell)</option>
                  <option value="horn">Stadium Air Horn (Short blast)</option>
                  <option value="klaxon">Electronic Warning Klaxon</option>
                  {form.buzzer.prepCustomAudioUrl && (
                    <option value="custom">Custom Uploaded Audio File</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Prep Volume Level</label>
                  <span className="font-mono text-amber-300 font-bold">{form.buzzer.prepVolume ?? 85}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.buzzer.prepVolume ?? 85}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      buzzer: { ...form.buzzer, prepVolume: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="flex items-center pt-3">
                <button
                  type="button"
                  onClick={handleTestPrepBuzzer}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold transition-all"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Test Prep Buzzer</span>
                </button>
              </div>
            </div>

            {/* Custom Prep Buzzer Upload Area */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <Upload className="w-3 h-3 text-amber-400" />
                    Upload Custom Prep Buzzer Audio
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Upload an audio file (MP3, WAV, OGG, M4A up to 5MB) specifically for the 30s prep time buzzer.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={prepAudioFileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                    className="hidden"
                    onChange={handleCustomPrepAudioUpload}
                  />

                  <button
                    type="button"
                    disabled={customPrepAudioUploading}
                    onClick={() => prepAudioFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{customPrepAudioUploading ? 'Uploading...' : form.buzzer.prepCustomAudioUrl ? 'Replace Prep Audio' : 'Upload Audio'}</span>
                  </button>

                  {form.buzzer.prepCustomAudioUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('Reset custom preparation buzzer back to default alert?')) {
                          await resetCustomPrepBuzzer();
                          setForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  buzzer: {
                                    ...prev.buzzer,
                                    prepSound: 'dual_alert',
                                    prepCustomAudioUrl: undefined,
                                    prepCustomAudioName: undefined,
                                  },
                                }
                              : prev
                          );
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-semibold"
                      title="Remove custom prep buzzer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {customPrepAudioError && (
                <p className="text-xs text-rose-400 font-semibold">{customPrepAudioError}</p>
              )}

              {form.buzzer.prepCustomAudioUrl && (
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="text-amber-300 font-mono text-[11px]">
                    ✓ Active prep audio: {form.buzzer.prepCustomAudioName || 'custom_prep_sound.mp3'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (form.buzzer.prepCustomAudioUrl) {
                        soundEngine.playAudioFile(form.buzzer.prepCustomAudioUrl, form.buzzer.prepVolume ?? 85);
                      }
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Preview Prep Audio</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.buzzer.laptopBuzzer}
                onChange={(e) =>
                  setForm({
                    ...form,
                    buzzer: { ...form.buzzer, laptopBuzzer: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Play on Organizer Laptop</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.buzzer.mobileBuzzer}
                onChange={(e) =>
                  setForm({
                    ...form,
                    buzzer: { ...form.buzzer, mobileBuzzer: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Broadcast to Projectors</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.buzzer.autoBuzzerAtZero !== false}
                onChange={(e) =>
                  setForm({
                    ...form,
                    buzzer: { ...form.buzzer, autoBuzzerAtZero: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-medium">Auto-Trigger Buzzer at 00:00</span>
            </label>
          </div>
        </div>

        {/* Section: Multi-Station / Location Architecture */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-300 font-bold font-['Outfit'] text-base">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <span>Multi-Station & Multi-Device Locations</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {(form.stations || []).length} Configured Stations
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Stations allow independent rooms or podiums (e.g. Stage Alpha, Stage Beta) to run rounds simultaneously. Projectors can be assigned to follow a specific station.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(form.stations || []).map((st) => {
              const isEditing = editingStationId === st.id;
              return (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2 mb-2">
                          <input
                            type="text"
                            value={st.name}
                            onChange={(e) => handleUpdateStationField(st.id, { name: e.target.value })}
                            className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-purple-800/40 text-white font-bold text-sm focus:outline-none"
                            placeholder="Station Name"
                          />
                          <input
                            type="text"
                            value={st.location}
                            onChange={(e) => handleUpdateStationField(st.id, { location: e.target.value })}
                            className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none"
                            placeholder="Location / Room"
                          />
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-bold text-white font-['Outfit'] text-sm">{st.name}</h4>
                          <p className="text-slate-400 text-[11px]">Location / Room: {st.location}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingStationId(isEditing ? null : st.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isEditing
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                        title={isEditing ? 'Close Edit' : 'Edit Station & Handler'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {(form.stations || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStation(st.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900"
                          title="Delete station"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Handler Information Block */}
                  {isEditing ? (
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-purple-900/30 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                        Station Handler Details
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={st.handlerName || ''}
                          onChange={(e) => handleUpdateStationField(st.id, { handlerName: e.target.value || undefined })}
                          placeholder="Handler Name"
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                        <input
                          type="text"
                          value={st.handlerRole || ''}
                          onChange={(e) => handleUpdateStationField(st.id, { handlerRole: e.target.value || undefined })}
                          placeholder="Role (e.g. Stage Lead)"
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={st.handlerPhone || ''}
                          onChange={(e) => handleUpdateStationField(st.id, { handlerPhone: e.target.value || undefined })}
                          placeholder="Phone / Mobile"
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                        />
                        <select
                          value={st.handlerStatus || 'ready'}
                          onChange={(e) => handleUpdateStationField(st.id, { handlerStatus: e.target.value as any })}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs"
                        >
                          <option value="ready">Status: Ready</option>
                          <option value="active">Status: Active</option>
                          <option value="on_break">Status: On Break</option>
                          <option value="busy">Status: Busy</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={st.handlerNotes || ''}
                        onChange={(e) => handleUpdateStationField(st.id, { handlerNotes: e.target.value || undefined })}
                        placeholder="Desk / Station notes (optional)"
                        className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400">
                          <User className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">
                              {st.handlerName || 'No handler assigned'}
                            </span>
                            {st.handlerRole && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40 font-bold">
                                {st.handlerRole}
                              </span>
                            )}
                          </div>
                          {st.handlerPhone && (
                            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-slate-500" />
                              {st.handlerPhone}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingStationId(st.id)}
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline font-semibold"
                      >
                        {st.handlerName ? 'Edit Handler' : '+ Assign'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Station Sub-form */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3 pt-3">
            <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add New Event Station
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <input
                type="text"
                placeholder="Station Name (e.g. Stage Gamma)"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Location (e.g. Room 301)"
                value={newStationLocation}
                onChange={(e) => setNewStationLocation(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Handler Name (e.g. Jordan)"
                value={newStationHandlerName}
                onChange={(e) => setNewStationHandlerName(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Handler Phone (e.g. 555-0199)"
                value={newStationHandlerPhone}
                onChange={(e) => setNewStationHandlerPhone(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Default Handler Role:</span>
                <select
                  value={newStationHandlerRole}
                  onChange={(e) => setNewStationHandlerRole(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs"
                >
                  <option value="Stage Lead">Stage Lead</option>
                  <option value="Timekeeper">Timekeeper</option>
                  <option value="Volunteer / Anchor">Volunteer / Anchor</option>
                  <option value="Lead Judge">Lead Judge</option>
                  <option value="Evaluator">Evaluator</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddStation}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Station</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Save Bar & Event Reset */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNewEventModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Start New Event (Reset Rounds & Topics)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore Factory Defaults</span>
            </button>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-purple-950/60 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save All Settings</span>
          </button>
        </div>
      </form>

      {/* Start New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <Flame className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Start New Competition Event?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will reset all images and topics back to <strong>available</strong> (unassigned), reset the live sync timer, and clear round speech history so a fresh competition can begin.
              <br />
              <span className="text-slate-400 mt-1 block">Your contestants list and custom settings will NOT be deleted.</span>
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowNewEventModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await startNewEvent();
                  setShowNewEventModal(false);
                  setSavedSuccess(true);
                  setTimeout(() => setSavedSuccess(false), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/50"
              >
                Yes, Start New Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">Reset All Event Data?</h4>
            <p className="text-xs text-slate-300 mb-5">
              This will restore all default settings, seed topics, sample contestants, and clear all logged speech results.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await resetAllData();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
