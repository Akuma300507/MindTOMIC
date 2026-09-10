import React from 'react';
import {
  LayoutDashboard,
  Users,
  Image as ImageIcon,
  Disc,
  Clock,
  MessageSquare,
  Images,
  Trophy,
  FileSpreadsheet,
  History,
  Settings,
  Volume2,
  Tv,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MindToMicLogo } from '../common/MindToMicLogo';
import type { PageId } from '../../types';

interface NavItem {
  id: PageId;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: 'main' | 'rounds' | 'management' | 'tools';
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'master', label: 'Master Monitor', icon: ShieldAlert, group: 'main' },
  { id: 'participants', label: 'Participants', icon: Users, group: 'main' },
  { id: 'round1', label: 'Round 1 — Image', icon: ImageIcon, group: 'rounds' },
  { id: 'round2', label: 'Round 2 — Wheel', icon: Disc, group: 'rounds' },
  { id: 'round3', label: 'Round 3 — Timer', icon: Clock, group: 'rounds' },
  { id: 'topics', label: 'Topics Manager', icon: MessageSquare, group: 'management' },
  { id: 'images', label: 'Images Manager', icon: Images, group: 'management' },
  { id: 'results', label: 'Results & Ranks', icon: Trophy, group: 'management' },
  { id: 'excel', label: 'Excel Import / Export', icon: FileSpreadsheet, group: 'management' },
  { id: 'history', label: 'Event History', icon: History, group: 'tools' },
  { id: 'buzzer', label: 'Buzzer Control', icon: Volume2, group: 'tools' },
  { id: 'projector', label: 'Projector Display', icon: Tv, group: 'tools' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'tools' },
];

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, db } = useApp();

  return (
    <aside className="w-64 bg-slate-900/95 border-r border-purple-900/30 flex flex-col flex-shrink-0 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
      {/* Event Branding Header */}
      <div className="p-4 pb-2 flex flex-col items-center justify-center text-center border-b border-purple-900/20">
        <MindToMicLogo size={52} variant="compact" showGlow={false} />
      </div>

      {/* Event Progress Summary Pill */}
      <div className="p-4 border-b border-purple-900/20">
        <div className="bg-gradient-to-r from-purple-950/80 to-slate-900 p-3 rounded-xl border border-purple-800/30">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-purple-300 font-semibold uppercase tracking-wider text-[10px]">Contest Progress</span>
            <span className="text-white font-bold text-[11px]">
              {db?.round1Results.length || 0} / {db?.participants.length || 0}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
              style={{
                width: `${
                  db?.participants.length
                    ? Math.min(100, Math.round(((db.round1Results.length + db.round2Results.length + db.round3Results.length) / (db.participants.length * 3)) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="p-3 space-y-6 flex-1">
        {/* Main Section */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60 px-3 mb-1.5">Overview</div>
          <div className="space-y-1">
            {navItems
              .filter((i) => i.group === 'main')
              .map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-purple-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Competition Rounds */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60 px-3 mb-1.5">Competition Rounds</div>
          <div className="space-y-1">
            {navItems
              .filter((i) => i.group === 'rounds')
              .map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-950/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-blue-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'round1' && db?.round1Results.length ? (
                      <span className="text-[10px] bg-purple-950/80 border border-purple-500/40 text-purple-200 px-1.5 py-0.5 rounded-md">
                        {db.round1Results.length}
                      </span>
                    ) : null}
                    {item.id === 'round2' && db?.round2Results.length ? (
                      <span className="text-[10px] bg-purple-950/80 border border-purple-500/40 text-purple-200 px-1.5 py-0.5 rounded-md">
                        {db.round2Results.length}
                      </span>
                    ) : null}
                    {item.id === 'round3' && db?.round3Results.length ? (
                      <span className="text-[10px] bg-purple-950/80 border border-purple-500/40 text-purple-200 px-1.5 py-0.5 rounded-md">
                        {db.round3Results.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Content & Management */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60 px-3 mb-1.5">Management & Data</div>
          <div className="space-y-1">
            {navItems
              .filter((i) => i.group === 'management')
              .map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Tools & Live */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60 px-3 mb-1.5">Live Hardware & Setup</div>
          <div className="space-y-1">
            {navItems
              .filter((i) => i.group === 'tools')
              .map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="p-3 border-t border-purple-900/20 bg-slate-950/60 text-[11px] text-slate-400">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
          <span>Shortcuts</span>
          <span className="text-purple-400">Active</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">Space</kbd> Start/Pause</div>
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">S</kbd> Stop</div>
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">B</kbd> Buzzer</div>
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">N</kbd> Next</div>
        </div>
      </div>
    </aside>
  );
};
