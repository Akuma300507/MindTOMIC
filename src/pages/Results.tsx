import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Search,
  Filter,
  Download,
  Image as ImageIcon,
  Disc,
  Clock,
  CheckCircle2,
  XCircle,
  Radio,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { excelService } from '../lib/excel';
import type { QualificationStatus } from '../types';

export const Results: React.FC = () => {
  const { db, setCurrentPage, setQualification, batchSetQualification } = useApp();

  const [activeTab, setActiveTab] = useState<'round1' | 'round2' | 'round3'>('round1');
  const [searchTerm, setSearchTerm] = useState('');
  const [qualificationFilter, setQualificationFilter] = useState<'all' | 'qualified' | 'disqualified' | 'pending'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const r1Results = db?.round1Results || [];
  const r2Results = db?.round2Results || [];
  const r3Results = db?.round3Results || [];

  // Helper to get synchronized qualification status from result or participant
  const getQualification = (participantId: string, round: 1 | 2 | 3, resultQual?: QualificationStatus): QualificationStatus => {
    if (resultQual && resultQual !== 'pending') return resultQual;
    const p = db?.participants.find((item) => item.id === participantId);
    if (round === 1) return p?.round1Qualified || resultQual || 'pending';
    if (round === 2) return p?.round2Qualified || resultQual || 'pending';
    return p?.round3Qualified || resultQual || 'pending';
  };

  const currentRoundNum: 1 | 2 | 3 = activeTab === 'round1' ? 1 : activeTab === 'round2' ? 2 : 3;

  const filteredR1 = useMemo(() => {
    return r1Results.filter((r) => {
      const p = db?.participants.find((item) => item.id === r.participantId);
      const imgId = r.imageId || '';
      const imgName = r.imageName || '';
      const num = r.participantNumber || p?.participantNumber || '';
      const mob = r.mobile || p?.mobile || p?.phone || '';
      const matchesSearch =
        r.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        num.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mob.toLowerCase().includes(searchTerm.toLowerCase()) ||
        imgId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        imgName.toLowerCase().includes(searchTerm.toLowerCase());
      const qual = getQualification(r.participantId, 1, r.qualification);
      const matchesQual = qualificationFilter === 'all' || qual === qualificationFilter;
      return matchesSearch && matchesQual;
    });
  }, [r1Results, searchTerm, qualificationFilter, db?.participants]);

  const filteredR2 = useMemo(() => {
    return r2Results.filter((r) => {
      const p = db?.participants.find((item) => item.id === r.participantId);
      const topicString = r.topicText || r.topic || '';
      const topicId = r.topicId || '';
      const num = r.participantNumber || p?.participantNumber || '';
      const mob = r.mobile || p?.mobile || p?.phone || '';
      const matchesSearch =
        r.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        num.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mob.toLowerCase().includes(searchTerm.toLowerCase()) ||
        topicId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        topicString.toLowerCase().includes(searchTerm.toLowerCase());
      const qual = getQualification(r.participantId, 2, r.qualification);
      const matchesQual = qualificationFilter === 'all' || qual === qualificationFilter;
      return matchesSearch && matchesQual;
    });
  }, [r2Results, searchTerm, qualificationFilter, db?.participants]);

  const filteredR3 = useMemo(() => {
    return r3Results.filter((r) => {
      const p = db?.participants.find((item) => item.id === r.participantId);
      const num = r.participantNumber || p?.participantNumber || '';
      const mob = r.mobile || p?.mobile || p?.phone || '';
      const matchesSearch =
        r.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        num.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mob.toLowerCase().includes(searchTerm.toLowerCase());
      const qual = getQualification(r.participantId, 3, r.qualification);
      const matchesQual = qualificationFilter === 'all' || qual === qualificationFilter;
      return matchesSearch && matchesQual;
    });
  }, [r3Results, searchTerm, qualificationFilter, db?.participants]);

  const currentActiveList = activeTab === 'round1' ? filteredR1 : activeTab === 'round2' ? filteredR2 : filteredR3;
  const currentAllResults = activeTab === 'round1' ? r1Results : activeTab === 'round2' ? r2Results : r3Results;

  // Counters for the current round
  const stats = useMemo(() => {
    let qualified = 0;
    let disqualified = 0;
    let pending = 0;

    currentAllResults.forEach((r) => {
      const status = getQualification(r.participantId, currentRoundNum, r.qualification);
      if (status === 'qualified') qualified++;
      else if (status === 'disqualified') disqualified++;
      else pending++;
    });

    return { total: currentAllResults.length, qualified, disqualified, pending };
  }, [currentAllResults, currentRoundNum, db?.participants]);

  const handleExportAll = () => {
    if (db) {
      excelService.exportFullEventReport(db);
    }
  };

  const handleSingleQualify = async (participantId: string, round: 1 | 2 | 3, status: QualificationStatus) => {
    setActionLoading(true);
    try {
      await setQualification(participantId, round, status);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update qualification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchQualify = async (status: QualificationStatus) => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await batchSetQualification(selectedIds, currentRoundNum, status);
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to batch update qualification');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === currentActiveList.length && currentActiveList.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentActiveList.map((r) => r.participantId));
    }
  };

  const toggleSelectOne = (participantId: string) => {
    setSelectedIds((prev) =>
      prev.includes(participantId) ? prev.filter((id) => id !== participantId) : [...prev, participantId]
    );
  };

  // Render qualification badge
  const renderQualificationBadge = (status: QualificationStatus) => {
    if (status === 'qualified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950/50">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>QUALIFIED</span>
        </span>
      );
    }
    if (status === 'disqualified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-950/50">
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>DISQUALIFIED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>PENDING</span>
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            Competition Results & Qualifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Qualify or disqualify participants across Round 1, Round 2, and Round 3 qualification stages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('master')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-800/80 text-purple-200 text-xs font-bold transition-all shadow-md"
          >
            <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>Master Monitor</span>
          </button>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel Report</span>
          </button>
        </div>
      </div>

      {/* Qualification Statistics Dashboard Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Evaluated
          </div>
          <div className="text-2xl font-black text-white font-['Outfit'] mt-1">
            {stats.total}
          </div>
        </div>

        <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/30">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Qualified
          </div>
          <div className="text-2xl font-black text-emerald-300 font-['Outfit'] mt-1">
            {stats.qualified}
          </div>
        </div>

        <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-500/30">
          <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Disqualified
          </div>
          <div className="text-2xl font-black text-rose-300 font-['Outfit'] mt-1">
            {stats.disqualified}
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pending Decision
          </div>
          <div className="text-2xl font-black text-slate-300 font-['Outfit'] mt-1">
            {stats.pending}
          </div>
        </div>
      </div>

      {/* Tabs, Search & Qualification Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Round Switcher Tabs */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setActiveTab('round1');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'round1'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Round 1 ({r1Results.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('round2');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'round2'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Round 2 ({r2Results.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('round3');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'round3'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Round 3 ({r3Results.length})</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Qualification Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Filter:</span>
            <select
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none"
            >
              <option value="all" className="bg-slate-900 text-white">All Results</option>
              <option value="qualified" className="bg-slate-900 text-emerald-300">Qualified Only</option>
              <option value="disqualified" className="bg-slate-900 text-rose-300">Disqualified Only</option>
              <option value="pending" className="bg-slate-900 text-slate-400">Pending Decision</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contestant or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs text-purple-200 font-semibold">
            <CheckSquare className="w-4 h-4 text-purple-400" />
            <span>
              {selectedIds.length} contestant{selectedIds.length > 1 ? 's' : ''} selected in{' '}
              <strong className="text-white uppercase">{activeTab}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchQualify('qualified')}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Qualified</span>
            </button>

            <button
              onClick={() => handleBatchQualify('disqualified')}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 transition-all disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Mark as Disqualified</span>
            </button>

            <button
              onClick={() => handleBatchQualify('pending')}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Results Tables */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {activeTab === 'round1' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-purple-400 transition-colors"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredR1.length ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Contestant</th>
                  <th className="py-3.5 px-4">Contestant ID</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4">Image ID</th>
                  <th className="py-3.5 px-4 text-center">Speech Duration</th>
                  <th className="py-3.5 px-4 text-center">Qualification Status</th>
                  <th className="py-3.5 px-4 text-center">Qualification Actions</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredR1.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No Round 1 speeches match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredR1.map((r) => {
                    const isSelected = selectedIds.includes(r.participantId);
                    const qualStatus = getQualification(r.participantId, 1, r.qualification);
                    const p = db?.participants.find((item) => item.id === r.participantId);

                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-purple-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleSelectOne(r.participantId)}
                            className="text-slate-400 hover:text-purple-400 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white font-['Outfit']">
                          {r.participantName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded font-bold">
                            {r.participantNumber || p?.participantNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-slate-300">
                            {r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-xs text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-md">
                            {r.imageId || r.imageName || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                          {r.speechDurationSeconds}s / {r.targetSpeechDurationSeconds}s
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderQualificationBadge(qualStatus)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleSingleQualify(r.participantId, 1, 'qualified')}
                              disabled={actionLoading || qualStatus === 'qualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'qualified'
                                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                                  : 'bg-emerald-950/70 hover:bg-emerald-800/90 text-emerald-300 border border-emerald-800/80 hover:border-emerald-500'
                              }`}
                              title="Mark as Qualified for Round 2"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Qualify</span>
                            </button>

                            <button
                              onClick={() => handleSingleQualify(r.participantId, 1, 'disqualified')}
                              disabled={actionLoading || qualStatus === 'disqualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'disqualified'
                                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 cursor-default'
                                  : 'bg-rose-950/70 hover:bg-rose-800/90 text-rose-300 border border-rose-800/80 hover:border-rose-500'
                              }`}
                              title="Disqualify Contestant"
                            >
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Disqualify</span>
                            </button>

                            {qualStatus !== 'pending' && (
                              <button
                                onClick={() => handleSingleQualify(r.participantId, 1, 'pending')}
                                disabled={actionLoading}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                title="Reset to Pending"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                          {new Date(r.endTime).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'round2' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-purple-400 transition-colors"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredR2.length ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Contestant</th>
                  <th className="py-3.5 px-4">Contestant ID</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4">Topic ID</th>
                  <th className="py-3.5 px-4">Spun Topic</th>
                  <th className="py-3.5 px-4 text-center">Speech Duration</th>
                  <th className="py-3.5 px-4 text-center">Qualification Status</th>
                  <th className="py-3.5 px-4 text-center">Qualification Actions</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredR2.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No Round 2 speeches match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredR2.map((r) => {
                    const isSelected = selectedIds.includes(r.participantId);
                    const qualStatus = getQualification(r.participantId, 2, r.qualification);
                    const p = db?.participants.find((item) => item.id === r.participantId);

                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-purple-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleSelectOne(r.participantId)}
                            className="text-slate-400 hover:text-purple-400 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white font-['Outfit']">
                          {r.participantName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded font-bold">
                            {r.participantNumber || p?.participantNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-slate-300">
                            {r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-md">
                            {r.topicId || '—'}
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-slate-200 font-medium max-w-xs truncate"
                          title={r.topicText || r.topic}
                        >
                          {r.topicText || r.topic}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                          {r.speechDurationSeconds}s / {r.targetSpeechDurationSeconds}s
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderQualificationBadge(qualStatus)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleSingleQualify(r.participantId, 2, 'qualified')}
                              disabled={actionLoading || qualStatus === 'qualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'qualified'
                                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                                  : 'bg-emerald-950/70 hover:bg-emerald-800/90 text-emerald-300 border border-emerald-800/80 hover:border-emerald-500'
                              }`}
                              title="Mark as Qualified for Finals (Round 3)"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Qualify</span>
                            </button>

                            <button
                              onClick={() => handleSingleQualify(r.participantId, 2, 'disqualified')}
                              disabled={actionLoading || qualStatus === 'disqualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'disqualified'
                                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 cursor-default'
                                  : 'bg-rose-950/70 hover:bg-rose-800/90 text-rose-300 border border-rose-800/80 hover:border-rose-500'
                              }`}
                              title="Disqualify Contestant"
                            >
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Disqualify</span>
                            </button>

                            {qualStatus !== 'pending' && (
                              <button
                                onClick={() => handleSingleQualify(r.participantId, 2, 'pending')}
                                disabled={actionLoading}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                title="Reset to Pending"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                          {new Date(r.endTime).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'round3' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-purple-400 transition-colors"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredR3.length ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Finalist</th>
                  <th className="py-3.5 px-4">Contestant ID</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4 text-center">Speech Duration</th>
                  <th className="py-3.5 px-4 text-center">Championship Status</th>
                  <th className="py-3.5 px-4 text-center">Decision Actions</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredR3.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No Championship Finals speeches match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredR3.map((r) => {
                    const isSelected = selectedIds.includes(r.participantId);
                    const qualStatus = getQualification(r.participantId, 3, r.qualification);
                    const p = db?.participants.find((item) => item.id === r.participantId);

                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-purple-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleSelectOne(r.participantId)}
                            className="text-slate-400 hover:text-purple-400 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white font-['Outfit']">
                          {r.participantName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded font-bold">
                            {r.participantNumber || p?.participantNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-slate-300">
                            {r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400 text-sm">
                          {r.speechDurationSeconds}s / {r.targetSpeechDurationSeconds}s
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderQualificationBadge(qualStatus)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleSingleQualify(r.participantId, 3, 'qualified')}
                              disabled={actionLoading || qualStatus === 'qualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'qualified'
                                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                                  : 'bg-emerald-950/70 hover:bg-emerald-800/90 text-emerald-300 border border-emerald-800/80 hover:border-emerald-500'
                              }`}
                              title="Mark as Champion / Award Winner"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Qualify / Winner</span>
                            </button>

                            <button
                              onClick={() => handleSingleQualify(r.participantId, 3, 'disqualified')}
                              disabled={actionLoading || qualStatus === 'disqualified'}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                qualStatus === 'disqualified'
                                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 cursor-default'
                                  : 'bg-rose-950/70 hover:bg-rose-800/90 text-rose-300 border border-rose-800/80 hover:border-rose-500'
                              }`}
                              title="Disqualify Finalist"
                            >
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Disqualify</span>
                            </button>

                            {qualStatus !== 'pending' && (
                              <button
                                onClick={() => handleSingleQualify(r.participantId, 3, 'pending')}
                                disabled={actionLoading}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                title="Reset to Pending"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                          {new Date(r.endTime).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
