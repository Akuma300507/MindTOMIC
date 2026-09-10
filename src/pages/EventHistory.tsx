import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Trash2,
  Clock,
  Zap,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const EventHistory: React.FC = () => {
  const { db, clearLogs } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const logs = db?.history || [];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.participantName && log.participantName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesAction = actionFilter === 'all' || log.action.toLowerCase().includes(actionFilter);

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const getActionBadge = (action: string) => {
    if (action.includes('Buzzer')) {
      return (
        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold uppercase flex items-center gap-1">
          <Zap className="w-3 h-3" /> Buzzer
        </span>
      );
    }
    if (action.includes('Saved') || action.includes('Complete')) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold uppercase flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Recorded
        </span>
      );
    }
    if (action.includes('Participant')) {
      return (
        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold uppercase flex items-center gap-1">
          <Users className="w-3 h-3" /> Contestant
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold uppercase">
        {action}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <History className="w-7 h-7 text-purple-400" />
            Live Event Audit Trail & History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time chronological activity feed of timer events, participant selections, and buzzers.
          </p>
        </div>

        <button
          onClick={() => {
            if (confirm('Clear entire event audit history?')) clearLogs();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Logs</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, details, contestant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="buzzer">Buzzer Triggers</option>
            <option value="saved">Result Saves</option>
            <option value="participant">Participant Events</option>
          </select>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800/60">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No event log records found.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="mt-0.5 sm:mt-0">{getActionBadge(log.action)}</div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{log.action}</span>
                      {log.round && (
                        <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800">
                          R{log.round}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{log.details}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-400 text-[11px] font-mono justify-end">
                  {log.participantName && (
                    <span className="font-semibold text-purple-300">{log.participantName}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
