import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Clock,
  Laptop,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SyncStatusIndicator: React.FC = () => {
  const { syncState, syncNow, deviceId } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const { status, isOnline, pendingCount, lastSyncedAt, lastError } = syncState;

  // Determine appearance based on synchronization status
  let badgeClasses = 'bg-slate-800/80 text-slate-300 border-slate-700/60';
  let dotClass = 'bg-emerald-400';
  let labelText = 'Online';
  let IconComponent = Wifi;

  if (status === 'offline' || !isOnline) {
    badgeClasses = 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-950/50';
    dotClass = 'bg-amber-400';
    labelText = pendingCount > 0 ? `Offline — ${pendingCount} local` : 'Offline — Data saved locally';
    IconComponent = WifiOff;
  } else if (status === 'syncing') {
    badgeClasses = 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-950/50';
    dotClass = 'bg-cyan-400 animate-ping';
    labelText = pendingCount > 0 ? `Syncing (${pendingCount})...` : 'Syncing...';
    IconComponent = RefreshCw;
  } else if (status === 'failed') {
    badgeClasses = 'bg-rose-950/60 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-950/50';
    dotClass = 'bg-rose-400';
    labelText = 'Sync failed — retrying';
    IconComponent = AlertTriangle;
  } else if (status === 'synced') {
    badgeClasses = 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40';
    dotClass = 'bg-emerald-400';
    labelText = 'All data synced';
    IconComponent = CheckCircle2;
  }

  const shortDeviceId = deviceId ? deviceId.replace(/^dev-/, '').slice(0, 8).toUpperCase() : 'UNKNOWN';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Non-intrusive status pill */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${badgeClasses} hover:brightness-110`}
        title="View Offline Storage & Sync Details"
        aria-label="Offline and Sync Status Indicator"
      >
        <div className="relative flex items-center justify-center">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        </div>
        <IconComponent
          className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`}
        />
        <span className="hidden sm:inline font-medium tracking-tight">
          {labelText}
        </span>
        {pendingCount > 0 && status !== 'syncing' && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Floating Info Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-purple-900/60 shadow-2xl p-4 z-50 text-left space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-purple-900/30 pb-2.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-white font-['Outfit']">
                Offline Data & Sync
              </h4>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isOnline
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
            >
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-500" />
                Device ID:
              </span>
              <span className="font-mono font-bold text-purple-300" title={deviceId}>
                {shortDeviceId}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                Local Pending Queue:
              </span>
              <span
                className={`font-mono font-bold ${
                  pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {pendingCount} records
              </span>
            </div>

            {lastSyncedAt && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Last synced:
                </span>
                <span className="font-mono text-slate-300">
                  {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              </div>
            )}

            {lastError && (
              <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-900/60 text-rose-300 text-[11px]">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Sync Issue:
                </p>
                <p className="mt-0.5 text-rose-200 line-clamp-2">{lastError}</p>
              </div>
            )}
          </div>

          <div className="pt-1 border-t border-purple-900/20">
            <button
              onClick={async () => {
                await syncNow();
              }}
              disabled={status === 'syncing' || (!isOnline && pendingCount === 0)}
              className="w-full py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-950 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{status === 'syncing' ? 'Syncing Now...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
