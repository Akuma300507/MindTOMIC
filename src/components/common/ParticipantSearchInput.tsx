import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, CheckCircle2, User, Award } from 'lucide-react';
import type { Participant } from '../../types';

export interface ParticipantSearchInputProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pendingParticipants: Participant[];
  completedParticipants: Participant[];
  activeParticipantId?: string;
  onSelectParticipant: (participant: Participant) => void;
  placeholder?: string;
  className?: string;
}

export const ParticipantSearchInput: React.FC<ParticipantSearchInputProps> = ({
  searchQuery,
  onSearchChange,
  pendingParticipants,
  completedParticipants,
  activeParticipantId,
  onSelectParticipant,
  placeholder = 'Search #ID or name...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const cleanQuery = useMemo(() => {
    return searchQuery.toLowerCase().trim().replace(/^#/, '');
  }, [searchQuery]);

  const matches = (p: Participant) => {
    if (!cleanQuery) return true;
    const matchName = (p.name || '').toLowerCase().includes(cleanQuery);
    const matchNum = String(p.participantNumber || (p as any).chestNumber || '').toLowerCase().includes(cleanQuery);
    const matchId = (p.id || '').toLowerCase().includes(cleanQuery);
    const matchMobile = (p.mobile || p.phone || '')?.toLowerCase().includes(cleanQuery);
    return matchName || matchNum || matchId || matchMobile;
  };

  const matchedPending = useMemo(() => {
    if (!cleanQuery) return [];
    return pendingParticipants.filter(matches);
  }, [pendingParticipants, cleanQuery]);

  const matchedCompleted = useMemo(() => {
    if (!cleanQuery) return [];
    return completedParticipants.filter(matches);
  }, [completedParticipants, cleanQuery]);

  const totalMatches = matchedPending.length + matchedCompleted.length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchedPending.length > 0) {
        onSelectParticipant(matchedPending[0]);
        setIsOpen(false);
      } else if (matchedCompleted.length > 0) {
        onSelectParticipant(matchedCompleted[0]);
        setIsOpen(false);
      }
    }
  };

  const handleSelect = (p: Participant) => {
    onSelectParticipant(p);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs focus-within:border-purple-500/70 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all shadow-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (cleanQuery) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-28 sm:w-36 md:w-44 text-xs font-semibold"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            title="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Suggestion Dropdown Popover */}
      {isOpen && cleanQuery && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 max-h-80 overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-purple-900/50 rounded-2xl shadow-2xl p-2 z-50 divide-y divide-slate-800 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Matches for <strong className="text-purple-300">"{searchQuery}"</strong>
            </span>
            <span className="font-mono font-bold text-slate-300">{totalMatches} found</span>
          </div>

          {totalMatches === 0 ? (
            <div className="p-4 text-center text-slate-400">
              <p className="font-semibold">No participants found</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Check spelling or search by participant number</p>
            </div>
          ) : (
            <div className="py-1 space-y-1">
              {/* Pending contestants */}
              {matchedPending.map((p) => {
                const isCurrent = p.id === activeParticipantId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-purple-900/40 border border-purple-500/40 text-white'
                        : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-[11px] text-purple-300 shrink-0">
                        #{p.participantNumber}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold truncate block">{p.name}</span>
                        {p.organization && (
                          <span className="text-[10px] text-slate-400 truncate block">{p.organization}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Remaining
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wide">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Completed contestants */}
              {matchedCompleted.map((p) => {
                const isCurrent = p.id === activeParticipantId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-950/50 border border-emerald-500/40 text-white'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 font-mono font-bold text-[11px] text-emerald-300 shrink-0">
                        #{p.participantNumber}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold truncate block text-slate-200">{p.name}</span>
                        {p.organization && (
                          <span className="text-[10px] text-slate-400 truncate block">{p.organization}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        Done
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wide">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
