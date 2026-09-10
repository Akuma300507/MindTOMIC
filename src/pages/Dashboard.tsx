import React from 'react';
import {
  Brain,
  Users,
  Image as ImageIcon,
  Disc,
  Clock,
  Trophy,
  Settings,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Volume2,
  FileSpreadsheet,
  Tv,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MindToMicLogo } from '../components/common/MindToMicLogo';

export const Dashboard: React.FC = () => {
  const { db, setCurrentPage, activeParticipant, selectNextParticipant, triggerBuzzer } = useApp();

  const totalParticipants = db?.participants.length || 0;
  const r1Completed = db?.round1Results.length || 0;
  const r2Completed = db?.round2Results.length || 0;
  const r3Completed = db?.round3Results.length || 0;

  const totalTopics = db?.topics.length || 0;
  const usedTopics = db?.topics.filter((t) => t.status === 'used').length || 0;
  const availableTopics = totalTopics - usedTopics;

  const progressTotalPossible = totalParticipants * 3;
  const progressCurrent = r1Completed + r2Completed + r3Completed;
  const overallPercentage =
    progressTotalPossible > 0 ? Math.min(100, Math.round((progressCurrent / progressTotalPossible) * 100)) : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner with Modern Purple / Indigo / Blue Gradient */}
      <div className="relative rounded-3xl p-6 sm:p-8 md:p-10 overflow-hidden bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border border-purple-800/40 shadow-2xl">
        {/* Glow orb decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Annual Oratory Championship
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 px-2.5 min-w-[56px] rounded-2xl bg-slate-950 border border-purple-500/50 flex items-center justify-center shadow-lg shadow-purple-950/60">
                <MindToMicLogo size={42} variant="emblem" showGlow={false} />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 font-['Outfit'] tracking-tight">
                {db?.settings.event.name || 'MIND TO MIC'}
              </h1>
            </div>
            <p className="text-base sm:text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-blue-300 font-mono">
              {db?.settings.event.tagline || 'THINK. SPEAK. EXPRESS.'}
            </p>
          </div>

          {/* Quick Active Contestant Spotlight Card */}
          <div className="bg-slate-950/80 border border-purple-800/40 rounded-2xl p-4 sm:p-5 min-w-[280px] shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Current Participant</span>
              <button
                onClick={selectNextParticipant}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold transition-colors"
                title="Select next participant (N)"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {activeParticipant ? (
              <div>
                <h3 className="text-lg font-extrabold text-white font-['Outfit'] truncate">
                  {activeParticipant.name}
                </h3>
                {(activeParticipant.mobile || activeParticipant.phone) && (
                  <p className="text-xs text-slate-400 truncate font-mono">
                    {activeParticipant.mobile || activeParticipant.phone}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-900/60 text-purple-200 border border-purple-700/50">
                    {activeParticipant.participantNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                    {activeParticipant.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No contestant selected. Click below to add.</p>
            )}
          </div>
        </div>

        {/* Overall Event Progress Bar */}
        <div className="mt-8 pt-6 border-t border-purple-900/30">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-300">Overall Competition Progress</span>
            <span className="text-purple-300 font-mono font-bold">{overallPercentage}% Completed</span>
          </div>
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-purple-900/40">
            <div
              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Contestants</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalParticipants}</div>
          <div className="text-[10px] text-slate-400 mt-1">Total registered</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Round 1</span>
            <ImageIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{r1Completed}</div>
          <div className="text-[10px] text-slate-400 mt-1">Image speeches done</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Round 2</span>
            <Disc className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{r2Completed}</div>
          <div className="text-[10px] text-slate-400 mt-1">Wheel speeches done</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Round 3</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{r3Completed}</div>
          <div className="text-[10px] text-slate-400 mt-1">Final timers done</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Available Topics</span>
            <Brain className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{availableTopics}</div>
          <div className="text-[10px] text-slate-400 mt-1">Unused for wheel</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Used Topics</span>
            <CheckCircle2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{usedTopics}</div>
          <div className="text-[10px] text-slate-400 mt-1">Completed spins</div>
        </div>
      </div>

      {/* Large Navigation Action Cards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 font-['Outfit'] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Competition Arenas & Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Round 1 Card */}
          <button
            onClick={() => setCurrentPage('round1')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-purple-900/30 hover:border-purple-600/60 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-purple-950/40 flex flex-col justify-between overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  ROUND 1
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-purple-300 transition-colors">
                Image to Speech
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Random high-resolution image prompt, 30s preparation countdown with chime, automatic 2m speech timer and buzzer.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-purple-400 group-hover:text-purple-300">
              <span>Launch Arena</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Round 2 Card */}
          <button
            onClick={() => setCurrentPage('round2')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-purple-900/30 hover:border-purple-600/60 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-purple-950/40 flex flex-col justify-between overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Disc className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  ROUND 2
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-purple-300 transition-colors">
                Spin the Topic Wheel
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Physics-based animated 20-topic spinning wheel, true random landing, topic auto-retirement, and speech timer.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-purple-400 group-hover:text-purple-300">
              <span>Spin & Speech</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Round 3 Card */}
          <button
            onClick={() => setCurrentPage('round3')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-purple-900/30 hover:border-purple-600/60 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl hover:shadow-purple-950/40 flex flex-col justify-between overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  ROUND 3
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-purple-300 transition-colors">
                Final Speaking Timer
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clean, high-visibility precision timer for finals, manual stop duration tracking, and automatic buzzer.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-purple-400 group-hover:text-purple-300">
              <span>Start Finals</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Participants Card */}
          <button
            onClick={() => setCurrentPage('participants')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-600/50 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  {totalParticipants} contestants
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-indigo-300 transition-colors">
                Participant Management
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Register contestants, edit profiles, search, filter, and customize dynamic fields for contestant data.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
              <span>Manage Contestants</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Results Card */}
          <button
            onClick={() => setCurrentPage('results')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-600/50 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Trophy className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  {progressCurrent} records
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-amber-300 transition-colors">
                Scores & Event Results
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                View all round completion times, topics, images, timestamps, and status logs with sorting and search.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-amber-400 group-hover:text-amber-300">
              <span>View Leaderboard</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Settings Card */}
          <button
            onClick={() => setCurrentPage('settings')}
            className="group relative p-6 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-600/50 text-left transition-all duration-200 hover:-translate-y-1 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
                  <Settings className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                  Config
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit'] group-hover:text-slate-200 transition-colors">
                Event Settings
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure preparation and speech durations, buzzer sound synthesis, wheel size, and image/topic reuse policies.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-slate-300 group-hover:text-white">
              <span>Open Settings</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>

      {/* Quick Utilities Footer Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <button
          onClick={() => setCurrentPage('excel')}
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-600/40 text-slate-300 hover:text-white transition-all text-xs font-semibold"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div className="text-left">
            <div className="font-bold text-white">Excel Import / Export</div>
            <div className="text-[11px] text-slate-400">Download templates & export full reports</div>
          </div>
        </button>

        <button
          onClick={() => setCurrentPage('buzzer')}
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-rose-600/40 text-slate-300 hover:text-white transition-all text-xs font-semibold"
        >
          <Volume2 className="w-5 h-5 text-rose-400" />
          <div className="text-left">
            <div className="font-bold text-white">Buzzer & Mobile Hub</div>
            <div className="text-[11px] text-slate-400">Test horns and connect mobile loudspeakers</div>
          </div>
        </button>

        <button
          onClick={() => setCurrentPage('projector')}
          className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-blue-600/40 text-slate-300 hover:text-white transition-all text-xs font-semibold"
        >
          <Tv className="w-5 h-5 text-blue-400" />
          <div className="text-left">
            <div className="font-bold text-white">Projector Display Mode</div>
            <div className="text-[11px] text-slate-400">Audience screen synchronized via LiveSync</div>
          </div>
        </button>
      </div>
    </div>
  );
};
