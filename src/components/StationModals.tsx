import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Check, X, RefreshCw, Radio } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const StationModals: React.FC = () => {
  const {
    takeoverModal,
    closeTakeoverModal,
    resetStatusesModal,
    closeResetStatusesModal,
    executeResetAllStatuses,
  } = useApp();

  const [isResetting, setIsResetting] = useState(false);

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await executeResetAllStatuses();
      closeResetStatusesModal(true);
    } catch (err) {
      console.error('Failed to reset all statuses:', err);
      closeResetStatusesModal(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      {/* Station Takeover Conflict Modal */}
      {takeoverModal && (
        <div
          id="station-takeover-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">Station Takeover Conflict</h3>
                <p className="text-xs text-amber-300 font-semibold">{takeoverModal.stationName}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-5 space-y-2 text-sm text-slate-300">
              <p>
                <strong className="text-white">{takeoverModal.stationName}</strong> is currently being controlled by:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-200 font-mono text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>{takeoverModal.currentDeviceName}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Only one operator device can control a station at a time to prevent conflicting commands. Do you want to take over control of this station on this device?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                id="cancel-takeover-btn"
                onClick={() => closeTakeoverModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-takeover-btn"
                onClick={() => closeTakeoverModal(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950 transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Take Over Station</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Statuses Confirmation Modal */}
      {resetStatusesModal && (
        <div
          id="reset-statuses-modal"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white font-['Outfit']">Reset All Statuses</h3>
                <p className="text-xs text-rose-300/90 font-medium mt-0.5">Master Event Administration</p>
              </div>
            </div>

            {/* Exact required confirmation text */}
            <div className="bg-rose-950/40 border border-rose-800/40 rounded-xl p-4 mb-4 text-sm text-slate-200 leading-relaxed space-y-2">
              <p className="font-semibold text-rose-200">
                Are you sure you want to reset all event statuses? This will reset temporary event progress, timers, used images, used topics and active station states.
              </p>
              <div className="border-t border-rose-900/40 pt-2 text-xs text-slate-300 space-y-1">
                <p className="text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <strong>Preserved:</strong> Permanent participant records, topic repository, image repository, event settings.
                </p>
                <p className="text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <strong>Reset:</strong> All station states, active participants, prep/speech timers, spinning wheel state, used image tags, used topic tags, and scoring scratchpad.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="cancel-reset-statuses-btn"
                disabled={isResetting}
                onClick={() => closeResetStatusesModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-reset-statuses-btn"
                disabled={isResetting}
                onClick={handleConfirmReset}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-950/60 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Resetting All Statuses...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>RESET ALL STATUSES</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
