import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  Settings2,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
  RotateCcw,
  CheckSquare,
  Square,
  Radio,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { excelService } from '../lib/excel';
import type { Participant, CustomFieldDefinition, CustomFieldType, RoundStatus, QualificationStatus } from '../types';
import { isParticipantCheckedIn } from '../lib/participantUtils';

export const Participants: React.FC = () => {
  const {
    db,
    addParticipant,
    updateParticipant,
    deleteParticipant,
    deleteAllParticipants,
    importParticipants,
    batchSetStation,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    activeParticipant,
    setActiveParticipant,
    setQualification,
    batchSetQualification,
    checkInParticipant,
    batchCheckInParticipants,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'status' | 'station'>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Delete all modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRound, setBatchRound] = useState<1 | 2 | 3>(1);
  const [batchStationId, setBatchStationId] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form State for Participant Add/Edit
  const [formData, setFormData] = useState<{
    name: string;
    participantNumber: string;
    mobile?: string;
    stationId?: string;
    stationName?: string;
    round1StationId?: string;
    round1StationName?: string;
    round2StationId?: string;
    round2StationName?: string;
    round3StationId?: string;
    round3StationName?: string;
    status: Participant['status'];
    checkedIn: boolean;
    round1Qualified: QualificationStatus;
    round2Qualified: QualificationStatus;
    round3Qualified: QualificationStatus;
    customData: Record<string, any>;
  }>({
    name: '',
    participantNumber: '',
    mobile: '',
    stationId: '',
    stationName: '',
    round1StationId: '',
    round1StationName: '',
    round2StationId: '',
    round2StationName: '',
    round3StationId: '',
    round3StationName: '',
    status: 'active',
    checkedIn: false,
    round1Qualified: 'pending',
    round2Qualified: 'pending',
    round3Qualified: 'pending',
    customData: {},
  });

  // Available Stations list (derived from settings or stations)
  const availableStations = useMemo(() => {
    if (db?.settings?.stations && db.settings.stations.length > 0) {
      return db.settings.stations;
    }
    if (db?.stations && Object.keys(db.stations).length > 0) {
      return Object.values(db.stations).map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.location || '',
      }));
    }
    return [
      { id: 'station-a', name: 'Station A', location: 'Hall A' },
      { id: 'station-b', name: 'Station B', location: 'Hall B' },
      { id: 'station-c', name: 'Station C', location: 'Hall C' },
      { id: 'station-d', name: 'Station D', location: 'Hall D' },
    ];
  }, [db?.settings?.stations, db?.stations]);

  // Station counts for quick filter pill counters
  const stationCounts = useMemo(() => {
    if (!db?.participants) return { total: 0, unassigned: 0 };
    const counts: Record<string, number> = { total: db.participants.length, unassigned: 0 };
    db.participants.forEach((p) => {
      if (p.stationId) {
        counts[p.stationId] = (counts[p.stationId] || 0) + 1;
      } else {
        counts.unassigned = (counts.unassigned || 0) + 1;
      }
    });
    return counts;
  }, [db?.participants]);

  // Arrival counts for quick arrival pills & filter counters
  const arrivalCounts = useMemo(() => {
    if (!db?.participants) return { arrived: 0, awaiting: 0, total: 0 };
    const total = db.participants.length;
    let arrived = 0;
    db.participants.forEach((p) => {
      if (isParticipantCheckedIn(p)) arrived++;
    });
    return { arrived, awaiting: total - arrived, total };
  }, [db?.participants]);

  // Custom Field Creator Form
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const rawCustomFields = db?.customFields || [];
  // Exclude redundant phone number custom field, keeping only official Mobile Number column
  const customFields = useMemo(() => {
    return rawCustomFields.filter(
      (cf) => cf.id !== 'f_phone' && cf.key !== 'phone' && cf.name?.toLowerCase().trim() !== 'phone number'
    );
  }, [rawCustomFields]);

  // Filtered & Sorted participants
  const filteredParticipants = useMemo(() => {
    if (!db?.participants) return [];
    return db.participants
      .filter((p) => {
        if (!p) return false;
        const name = p.name || '';
        const pNum = p.participantNumber || (p as any).chestNumber || (p as any).number || p.id || '';
        const mob = p.mobile || p.phone || p.customData?.mobile || p.customData?.phone || '';
        const matchesSearch =
          name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
          mob.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.stationName && p.stationName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (p.stationId && p.stationId.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === 'arrived' || statusFilter === 'checked_in') return isParticipantCheckedIn(p);
        if (statusFilter === 'awaiting_checkin') return !isParticipantCheckedIn(p);
        if (statusFilter === 'r1_qualified') return p.round1Qualified === 'qualified';
        if (statusFilter === 'r2_qualified') return p.round2Qualified === 'qualified';
        if (statusFilter === 'r3_qualified') return p.round3Qualified === 'qualified';
        if (statusFilter === 'disqualified')
          return (
            p.round1Qualified === 'disqualified' ||
            p.round2Qualified === 'disqualified' ||
            p.round3Qualified === 'disqualified'
          );
        if (statusFilter !== 'all') return p.status === statusFilter;

        return true;
      })
      .filter((p) => {
        if (stationFilter === 'all') return true;
        if (stationFilter === 'unassigned') return !p.stationId;
        return p.stationId === stationFilter;
      })
      .sort((a, b) => {
        let comp = 0;
        const numA = a.participantNumber || (a as any).chestNumber || (a as any).number || a.id || '';
        const numB = b.participantNumber || (b as any).chestNumber || (b as any).number || b.id || '';
        const nameA = a.name || '';
        const nameB = b.name || '';
        const statusA = a.status || '';
        const statusB = b.status || '';

        if (sortBy === 'number') comp = numA.localeCompare(numB);
        if (sortBy === 'name') comp = nameA.localeCompare(nameB);
        if (sortBy === 'status') comp = statusA.localeCompare(statusB);
        if (sortBy === 'station') {
          const stA = a.stationName || a.stationId || 'zzz';
          const stB = b.stationName || b.stationId || 'zzz';
          comp = stA.localeCompare(stB);
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [db?.participants, searchTerm, statusFilter, stationFilter, sortBy, sortOrder]);

  const openAddModal = () => {
    setEditingParticipant(null);
    const nextNum = `M2M-${String((db?.participants?.length || 0) + 1).padStart(3, '0')}`;
    setFormData({
      name: '',
      participantNumber: nextNum,
      mobile: '',
      stationId: '',
      stationName: '',
      round1StationId: '',
      round1StationName: '',
      round2StationId: '',
      round2StationName: '',
      round3StationId: '',
      round3StationName: '',
      status: 'active',
      checkedIn: false,
      round1Qualified: 'pending',
      round2Qualified: 'pending',
      round3Qualified: 'pending',
      customData: {},
    });
    setShowAddEditModal(true);
  };

  const openEditModal = (p: Participant) => {
    setEditingParticipant(p);
    setFormData({
      name: p.name || '',
      participantNumber: p.participantNumber || (p as any).chestNumber || p.id || '',
      mobile: p.mobile || p.phone || p.customData?.mobile || p.customData?.phone || '',
      stationId: p.stationId || '',
      stationName: p.stationName || '',
      round1StationId: p.round1StationId || '',
      round1StationName: p.round1StationName || '',
      round2StationId: p.round2StationId || '',
      round2StationName: p.round2StationName || '',
      round3StationId: p.round3StationId || '',
      round3StationName: p.round3StationName || '',
      status: p.status || 'active',
      checkedIn: isParticipantCheckedIn(p),
      round1Qualified: p.round1Qualified || 'pending',
      round2Qualified: p.round2Qualified || 'pending',
      round3Qualified: p.round3Qualified || 'pending',
      customData: { ...(p.customData || {}) },
    });
    setShowAddEditModal(true);
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const mobileClean = (formData.mobile || '').trim();
    if (editingParticipant) {
      await updateParticipant(editingParticipant.id, {
        name: formData.name.trim(),
        participantNumber: formData.participantNumber.trim(),
        mobile: mobileClean,
        phone: mobileClean,
        stationId: formData.stationId ? formData.stationId : undefined,
        stationName: formData.stationName ? formData.stationName : undefined,
        round1StationId: formData.round1StationId ? formData.round1StationId : undefined,
        round1StationName: formData.round1StationName ? formData.round1StationName : undefined,
        round2StationId: formData.round2StationId ? formData.round2StationId : undefined,
        round2StationName: formData.round2StationName ? formData.round2StationName : undefined,
        round3StationId: formData.round3StationId ? formData.round3StationId : undefined,
        round3StationName: formData.round3StationName ? formData.round3StationName : undefined,
        status: formData.status,
        checkedIn: formData.checkedIn,
        checkedInAt: formData.checkedIn ? (editingParticipant.checkedInAt || new Date().toISOString()) : undefined,
        checkedInStationId: formData.checkedIn ? (formData.stationId || editingParticipant.checkedInStationId) : undefined,
        checkedInStationName: formData.checkedIn ? (formData.stationName || editingParticipant.checkedInStationName) : undefined,
        round1Qualified: formData.round1Qualified,
        round2Qualified: formData.round2Qualified,
        round3Qualified: formData.round3Qualified,
        customData: {
          ...formData.customData,
          phone: mobileClean,
          mobile: mobileClean,
        },
      });
    } else {
      await addParticipant({
        name: formData.name.trim(),
        participantNumber: formData.participantNumber.trim(),
        mobile: mobileClean,
        phone: mobileClean,
        stationId: formData.stationId ? formData.stationId : undefined,
        stationName: formData.stationName ? formData.stationName : undefined,
        round1StationId: formData.round1StationId ? formData.round1StationId : undefined,
        round1StationName: formData.round1StationName ? formData.round1StationName : undefined,
        round2StationId: formData.round2StationId ? formData.round2StationId : undefined,
        round2StationName: formData.round2StationName ? formData.round2StationName : undefined,
        round3StationId: formData.round3StationId ? formData.round3StationId : undefined,
        round3StationName: formData.round3StationName ? formData.round3StationName : undefined,
        status: formData.status,
        checkedIn: formData.checkedIn,
        checkedInAt: formData.checkedIn ? new Date().toISOString() : undefined,
        checkedInStationId: formData.checkedIn ? formData.stationId : undefined,
        checkedInStationName: formData.checkedIn ? formData.stationName : undefined,
        round1Qualified: formData.round1Qualified,
        round2Qualified: formData.round2Qualified,
        round3Qualified: formData.round3Qualified,
        customData: {
          ...formData.customData,
          phone: mobileClean,
          mobile: mobileClean,
        },
      });
    }
    setShowAddEditModal(false);
  };

  // Inline single participant quick station change
  const handleQuickStationChange = async (p: Participant, newStationId: string) => {
    if (!newStationId) {
      await updateParticipant(p.id, { stationId: undefined, stationName: undefined });
    } else {
      const found = availableStations.find((s) => s.id === newStationId);
      await updateParticipant(p.id, {
        stationId: newStationId,
        stationName: found ? found.name : newStationId,
      });
    }
  };

  // Batch station assignment
  const handleBatchStationAssign = async () => {
    if (selectedIds.length === 0 || !batchStationId) return;
    setBatchLoading(true);
    try {
      if (batchStationId === 'unassign') {
        await batchSetStation(selectedIds, '', '', batchRound);
      } else {
        const found = availableStations.find((s) => s.id === batchStationId);
        await batchSetStation(selectedIds, batchStationId, found ? found.name : batchStationId, batchRound);
      }
      setSelectedIds([]);
      setBatchStationId('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Batch station update failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
    await deleteParticipant(id);
    setShowDeleteConfirm(null);
  };

  // Custom field handler
  const handleSaveCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;

    const options =
      newFieldType === 'dropdown'
        ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    if (editingField) {
      await updateCustomField(editingField.id, {
        name: newFieldName.trim(),
        type: newFieldType,
        options,
      });
      setEditingField(null);
    } else {
      await addCustomField({
        name: newFieldName.trim(),
        type: newFieldType,
        options,
      });
    }

    setNewFieldName('');
    setNewFieldOptions('');
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await excelService.parseParticipantsFile(file, customFields);
      const count = await importParticipants(parsed);
      alert(`Successfully imported ${count} participants from Excel!`);
    } catch (err: any) {
      alert(`Import error: ${err.message || err}`);
    } finally {
      e.target.value = '';
    }
  };

  const renderStatusBadge = (status: RoundStatus) => {
    if (status === 'completed' || status === 'completed_early') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Done
        </span>
      );
    }
    if (status === 'time_up') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
          <Clock className="w-3 h-3" /> Time Up
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
        Pending
      </span>
    );
  };

  const renderRoundCell = (p: Participant, round: 1 | 2 | 3) => {
    const roundStatus = round === 1 ? p.round1Status : round === 2 ? p.round2Status : p.round3Status;
    const qualStatus: QualificationStatus =
      (round === 1 ? p.round1Qualified : round === 2 ? p.round2Qualified : p.round3Qualified) || 'pending';

    return (
      <div className="flex flex-col items-center gap-1.5 py-1">
        {/* Timing Status Badge */}
        <div>{renderStatusBadge(roundStatus)}</div>

        {/* Qualification Status Badge & Quick Toggles */}
        <div className="flex items-center gap-1 mt-0.5">
          {qualStatus === 'qualified' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-sm">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>QUAL</span>
            </span>
          )}
          {qualStatus === 'disqualified' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/50 shadow-sm">
              <XCircle className="w-2.5 h-2.5 text-rose-400" />
              <span>DISQUAL</span>
            </span>
          )}
          {qualStatus === 'pending' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              <span>PENDING</span>
            </span>
          )}

          {/* Inline Qualify / Disqualify Quick Action Buttons */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setQualification(p.id, round, 'qualified')}
              disabled={qualStatus === 'qualified'}
              className={`p-1 rounded hover:bg-emerald-950/80 transition-all ${
                qualStatus === 'qualified'
                  ? 'text-emerald-500 opacity-30 cursor-default'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title={`Mark ${p.name} as Qualified for Round ${round === 3 ? 'Winner' : round + 1}`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </button>
            <button
              onClick={() => setQualification(p.id, round, 'disqualified')}
              disabled={qualStatus === 'disqualified'}
              className={`p-1 rounded hover:bg-rose-950/80 transition-all ${
                qualStatus === 'disqualified'
                  ? 'text-rose-500 opacity-30 cursor-default'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title={`Disqualify ${p.name} in Round ${round}`}
            >
              <XCircle className="w-3 h-3 text-rose-400" />
            </button>
            {qualStatus !== 'pending' && (
              <button
                onClick={() => setQualification(p.id, round, 'pending')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                title="Reset qualification status to Pending"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleBatchAction = async (status: QualificationStatus) => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      await batchSetQualification(selectedIds, batchRound, status);
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Batch update failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParticipants.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-400" />
            Participant Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage contestant registry, dynamic custom fields, status updates, and Excel synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Custom Fields Manager Button */}
          <button
            onClick={() => setShowFieldsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-900/40 text-xs font-semibold transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            <span>Custom Fields ({customFields.length})</span>
          </button>

          {/* Import / Export */}
          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import Excel</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={() => excelService.downloadParticipantTemplate(customFields)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            title="Download Excel template for participants"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Template</span>
          </button>

          {/* Remove All Contestants */}
          <button
            onClick={() => setShowDeleteAllModal(true)}
            disabled={(db?.participants?.length || 0) === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Remove all contestants from roster"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Remove All</span>
          </button>

          {/* Add Participant */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Participant</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID, mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Filters and sorting */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="arrived">📍 Arrived / Checked In ({arrivalCounts.arrived})</option>
              <option value="awaiting_checkin">⏳ Awaiting Arrival ({arrivalCounts.awaiting})</option>
              <option value="active">Active</option>
              <option value="registered">Registered</option>
              <option value="eliminated">Eliminated</option>
              <option value="completed">Completed</option>
              <option value="r1_qualified">Round 1 (Pixel Pictionary) Qualifiers</option>
              <option value="r2_qualified">Round 2 (Arcade Wheel) Qualifiers</option>
              <option value="r3_qualified">Round 3 (The Mystery Cartridge) Qualifiers / Champions</option>
              <option value="disqualified">Disqualified Contestants</option>
            </select>
          </div>

          {/* Station Filter */}
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Station:</span>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Stations ({stationCounts.total || 0})</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({stationCounts[s.id] || 0})
                </option>
              ))}
              <option value="unassigned">Unassigned ({stationCounts.unassigned || 0})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="number">Contestant Number</option>
              <option value="name">Name</option>
              <option value="station">Station</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Station Filter Pills Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5 text-[11px] mr-1">
          <Radio className="w-3.5 h-3.5 text-purple-400" /> Filter by Station:
        </span>
        <button
          onClick={() => setStationFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
            stationFilter === 'all'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>All</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
            {stationCounts.total || 0}
          </span>
        </button>
        {availableStations.map((stn) => {
          const count = stationCounts[stn.id] || 0;
          const isSelected = stationFilter === stn.id;
          return (
            <button
              key={stn.id}
              onClick={() => setStationFilter(isSelected ? 'all' : stn.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50 ring-2 ring-purple-400'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span>{stn.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-purple-800 text-purple-100' : 'bg-slate-800 text-purple-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setStationFilter(stationFilter === 'unassigned' ? 'all' : 'unassigned')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
            stationFilter === 'unassigned'
              ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
              : 'bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800'
          }`}
        >
          <span>Unassigned</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-amber-400 font-mono">
            {stationCounts.unassigned || 0}
          </span>
        </button>

        {/* Quick Arrival Filters */}
        <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />
        <button
          onClick={() => setStatusFilter(statusFilter === 'arrived' ? 'all' : 'arrived')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
            statusFilter === 'arrived'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-2 ring-emerald-400'
              : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
          }`}
          title="Filter arrived / checked-in contestants"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Arrived</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
            {arrivalCounts.arrived}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'awaiting_checkin' ? 'all' : 'awaiting_checkin')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
            statusFilter === 'awaiting_checkin'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50 ring-2 ring-amber-400'
              : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
          }`}
          title="Filter awaiting arrival contestants"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Awaiting</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
            {arrivalCounts.awaiting}
          </span>
        </button>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs text-purple-200 font-semibold">
            <CheckSquare className="w-4 h-4 text-purple-400" />
            <span>
              {selectedIds.length} contestant{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Station Assignment */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Radio className="w-3 h-3 text-purple-400" />
              <span className="text-slate-400">Station:</span>
              <select
                value={batchStationId}
                onChange={(e) => setBatchStationId(e.target.value)}
                className="bg-transparent text-purple-300 font-bold focus:outline-none"
              >
                <option value="" className="bg-slate-900 text-white">Select Station...</option>
                <option value="unassign" className="bg-slate-900 text-slate-400">None (Unassign)</option>
                {availableStations.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleBatchStationAssign}
              disabled={!batchStationId || batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950/50 transition-all disabled:opacity-50"
              title="Assign selected contestants to chosen station"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Assign Station</span>
            </button>

            {/* Batch Arrival Location Check-In */}
            <div className="h-4 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

            <button
              onClick={async () => {
                if (selectedIds.length === 0) return;
                setBatchLoading(true);
                try {
                  await batchCheckInParticipants(selectedIds, { checkedIn: true });
                  setSelectedIds([]);
                } catch (err: any) {
                  alert(err.message || 'Failed to check in selected participants');
                } finally {
                  setBatchLoading(false);
                }
              }}
              disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50"
              title="Mark all selected contestants as arrived at location"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Mark Arrived</span>
            </button>

            <button
              onClick={async () => {
                if (selectedIds.length === 0) return;
                setBatchLoading(true);
                try {
                  await batchCheckInParticipants(selectedIds, { checkedIn: false });
                  setSelectedIds([]);
                } catch (err: any) {
                  alert(err.message || 'Failed to revoke arrival check-in');
                } finally {
                  setBatchLoading(false);
                }
              }}
              disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold transition-all disabled:opacity-50"
              title="Revoke arrival check-in for selected contestants"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revoke Check-In</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Stage:</span>
              <select
                value={batchRound}
                onChange={(e) => setBatchRound(Number(e.target.value) as 1 | 2 | 3)}
                className="bg-transparent text-purple-300 font-bold focus:outline-none"
              >
                <option value={1} className="bg-slate-900 text-white">Round 1</option>
                <option value={2} className="bg-slate-900 text-white">Round 2</option>
                <option value={3} className="bg-slate-900 text-white">Round 3</option>
              </select>
            </div>

            <button
              onClick={() => handleBatchAction('qualified')}
              disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Qualify</span>
            </button>

            <button
              onClick={() => handleBatchAction('disqualified')}
              disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 transition-all disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Disqualify</span>
            </button>

            <button
              onClick={() => handleBatchAction('pending')}
              disabled={batchLoading}
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

      {/* Participants Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-purple-400 transition-colors"
                    title="Select all"
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredParticipants.length ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Contestant</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Station</th>
                <th className="py-3.5 px-4 text-center">Arrival</th>
                <th className="py-3.5 px-4 text-center">Round 1 (Pixel Pictionary)</th>
                <th className="py-3.5 px-4 text-center">Round 2 (Arcade Wheel)</th>
                <th className="py-3.5 px-4 text-center">Round 3 (Mystery Cartridge)</th>
                {customFields.map((cf) => (
                  <th key={cf.id} className="py-3.5 px-4">
                    {cf.name}
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={9 + customFields.length} className="py-12 text-center text-slate-400">
                    <p className="font-semibold">No participants found matching your filter.</p>
                    <p className="text-[11px] mt-1 text-slate-500">Add a new contestant or clear the search query.</p>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p) => {
                  const isActive = activeParticipant?.id === p.id;
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-purple-950/40'
                          : isActive
                          ? 'bg-purple-950/20 hover:bg-purple-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleSelectOne(p.id)}
                          className="text-slate-400 hover:text-purple-400 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveParticipant(p)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                : 'bg-slate-800 text-slate-400 hover:text-purple-300 hover:bg-slate-700'
                            }`}
                            title={isActive ? 'Currently Active Contestant' : 'Click to set as Active Contestant'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <div className="font-extrabold text-white text-sm flex items-center gap-2 font-['Outfit']">
                              {p.name}
                              {isActive && (
                                <span className="text-[9px] uppercase px-1.5 py-0.2 bg-purple-500/30 text-purple-300 border border-purple-400/40 rounded font-bold">
                                  Active
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-purple-400">
                              {p.participantNumber || (p as any).chestNumber || p.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-slate-300">
                          {p.mobile || p.phone || p.customData?.mobile || p.customData?.phone || '—'}
                        </span>
                      </td>

                      {/* Station Badge & Quick Changer */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            {p.stationId ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-950/70 text-purple-300 border border-purple-800/60 shadow-sm whitespace-nowrap">
                                <Radio className="w-3 h-3 text-purple-400" />
                                <span>{p.stationName || p.stationId.toUpperCase()}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-950 border border-slate-800 whitespace-nowrap">
                                Unassigned
                              </span>
                            )}

                            {/* Quick station reassignment dropdown */}
                            <select
                              value={p.stationId || ''}
                              onChange={(e) => handleQuickStationChange(p, e.target.value)}
                              className="bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded focus:outline-none focus:border-purple-500 cursor-pointer"
                              title="Quick change station"
                            >
                              <option value="">No Station</option>
                              {availableStations.map((stn) => (
                                <option key={stn.id} value={stn.id}>
                                  {stn.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {(p.round1StationName || p.round2StationName || p.round3StationName) && (
                            <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono">
                              {p.round1StationName && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300" title="Round 1 Station">
                                  R1: {p.round1StationName}
                                </span>
                              )}
                              {p.round2StationName && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300" title="Round 2 Station">
                                  R2: {p.round2StationName}
                                </span>
                              )}
                              {p.round3StationName && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300" title="Round 3 Station">
                                  R3: {p.round3StationName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Arrival / Location Check-in Status & Action */}
                      <td className="py-3.5 px-4 text-center">
                        {isParticipantCheckedIn(p) ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-600/60 shadow-sm">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              <span>ARRIVED</span>
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {p.checkedInAt
                                ? (() => {
                                    try {
                                      const d = new Date(p.checkedInAt);
                                      return isNaN(d.getTime())
                                        ? 'Checked In'
                                        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    } catch {
                                      return 'Checked In';
                                    }
                                  })()
                                : 'Checked In'}
                            </span>
                            <button
                              onClick={() => checkInParticipant(p.id, { checkedIn: false })}
                              className="text-[9px] text-slate-500 hover:text-rose-400 transition-colors underline"
                              title="Revoke check-in"
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() =>
                                checkInParticipant(p.id, {
                                  checkedIn: true,
                                  stationId: p.stationId,
                                  stationName: p.stationName,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-950 hover:bg-emerald-950 text-purple-300 hover:text-emerald-300 border border-purple-800 hover:border-emerald-600 transition-all shadow-sm"
                              title="Mark contestant as arrived at location"
                            >
                              <MapPin className="w-3 h-3 text-purple-400" />
                              <span>Check In</span>
                            </button>
                            <span className="text-[9px] text-amber-400/80 font-mono">Awaiting</span>
                          </div>
                        )}
                      </td>

                      {/* Round Statuses & Qualification Controls */}
                      <td className="py-3.5 px-4 text-center">{renderRoundCell(p, 1)}</td>
                      <td className="py-3.5 px-4 text-center">{renderRoundCell(p, 2)}</td>
                      <td className="py-3.5 px-4 text-center">{renderRoundCell(p, 3)}</td>

                      {/* Custom Fields */}
                      {customFields.map((cf) => {
                        const val = p.customData?.[cf.key];
                        return (
                          <td key={cf.id} className="py-3.5 px-4 text-slate-300">
                            {cf.type === 'checkbox' ? (
                              val ? (
                                <span className="text-emerald-400 font-bold">✓</span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )
                            ) : val !== undefined && val !== '' ? (
                              String(val)
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Edit participant"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(p.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 transition-colors"
                            title="Delete participant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Participant Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 font-['Outfit'] flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              {editingParticipant ? 'Edit Contestant Profile' : 'Register New Contestant'}
            </h3>

            <form onSubmit={handleSaveParticipant} className="space-y-4 text-xs">
              {/* Core fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Contestant ID / Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.participantNumber}
                    onChange={(e) => setFormData({ ...formData, participantNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g. Maya Chen"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={formData.mobile || ''}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-purple-500 focus:outline-none"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="active">Active (Ready for Rounds)</option>
                    <option value="registered">Registered</option>
                    <option value="checked_in">Checked In</option>
                    <option value="eliminated">Eliminated</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <span>Station Location / Desk</span>
                  </label>
                  <select
                    value={formData.stationId || ''}
                    onChange={(e) => {
                      const stnId = e.target.value;
                      const selectedStn = availableStations.find((s) => s.id === stnId);
                      setFormData({
                        ...formData,
                        stationId: stnId,
                        stationName: selectedStn ? selectedStn.name : (stnId ? `Station ${stnId.toUpperCase()}` : ''),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Unassigned (General Pool)</option>
                    {availableStations.map((stn) => (
                      <option key={stn.id} value={stn.id}>
                        {stn.name} {stn.location ? `— ${stn.location}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Arrival / Location Check-in Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.checkedIn}
                  onChange={(e) => setFormData({ ...formData, checkedIn: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <div>
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Mark Arrived / Checked In to Location
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Required for Round 1 timer start. Can also be marked directly by station masters at the Arrival Desk.
                  </span>
                </div>
              </label>

              {/* Stage Qualifications */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                    Stage Qualification Status
                  </span>
                  <span className="text-[10px] text-slate-500">Rounds 1, 2, 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Round 1 */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <label className="block text-slate-300 text-xs font-bold">Round 1: Pixel Pictionary</label>
                    <select
                      value={formData.round1Qualified}
                      onChange={(e) =>
                        setFormData({ ...formData, round1Qualified: e.target.value as QualificationStatus })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="qualified">Qualified</option>
                      <option value="disqualified">Disqualified</option>
                    </select>

                    <div>
                      <span className="text-[10px] text-slate-400">R1 Station:</span>
                      <select
                        value={formData.round1StationId || ''}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const stn = availableStations.find((s) => s.id === sid);
                          setFormData({
                            ...formData,
                            round1StationId: sid,
                            round1StationName: stn ? stn.name : sid,
                          });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-blue-300 focus:outline-none mt-0.5"
                      >
                        <option value="">Default Station</option>
                        {availableStations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Round 2 */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <label className="block text-slate-300 text-xs font-bold">Round 2: Arcade Wheel</label>
                    <select
                      value={formData.round2Qualified}
                      onChange={(e) =>
                        setFormData({ ...formData, round2Qualified: e.target.value as QualificationStatus })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="qualified">Qualified</option>
                      <option value="disqualified">Disqualified</option>
                    </select>

                    <div>
                      <span className="text-[10px] text-slate-400">R2 Station:</span>
                      <select
                        value={formData.round2StationId || ''}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const stn = availableStations.find((s) => s.id === sid);
                          setFormData({
                            ...formData,
                            round2StationId: sid,
                            round2StationName: stn ? stn.name : sid,
                            // If user is currently setting Round 2 station, also set current stationId
                            stationId: sid || formData.stationId,
                            stationName: stn ? stn.name : formData.stationName,
                          });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-purple-300 focus:outline-none mt-0.5"
                      >
                        <option value="">Choose R2 Station...</option>
                        {availableStations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Round 3 */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <label className="block text-slate-300 text-xs font-bold">Round 3: The Mystery Cartridge</label>
                    <select
                      value={formData.round3Qualified}
                      onChange={(e) =>
                        setFormData({ ...formData, round3Qualified: e.target.value as QualificationStatus })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="qualified">Qualified / Champion</option>
                      <option value="disqualified">Disqualified</option>
                    </select>

                    <div>
                      <span className="text-[10px] text-slate-400">R3 Finals Station:</span>
                      <select
                        value={formData.round3StationId || ''}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const stn = availableStations.find((s) => s.id === sid);
                          setFormData({
                            ...formData,
                            round3StationId: sid,
                            round3StationName: stn ? stn.name : sid,
                            // If setting Round 3 station, also set current stationId
                            stationId: sid || formData.stationId,
                            stationName: stn ? stn.name : formData.stationName,
                          });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-emerald-300 focus:outline-none mt-0.5"
                      >
                        <option value="">Choose Finals Station...</option>
                        {availableStations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Custom Fields Rendering */}
              {customFields.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                    Custom Fields ({customFields.length})
                  </span>
                  {customFields.map((cf) => (
                    <div key={cf.id}>
                      <label className="block text-slate-300 font-semibold mb-1">
                        {cf.name} {cf.required && <span className="text-rose-400">*</span>}
                      </label>
                      {cf.type === 'dropdown' ? (
                        <select
                          value={formData.customData[cf.key] || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customData: { ...formData.customData, [cf.key]: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Select option</option>
                          {cf.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : cf.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={!!formData.customData[cf.key]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                customData: { ...formData.customData, [cf.key]: e.target.checked },
                              })
                            }
                            className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800"
                          />
                          <span className="text-slate-300 font-medium">Yes / Completed</span>
                        </label>
                      ) : (
                        <input
                          type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                          value={formData.customData[cf.key] || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customData: { ...formData.customData, [cf.key]: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-950/50"
                >
                  {editingParticipant ? 'Save Changes' : 'Register Contestant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Custom Fields Configuration Modal */}
      {showFieldsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-2 font-['Outfit'] flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-400" />
              Dynamic Custom Fields
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add or modify custom participant columns. Forms and tables will automatically adapt.
            </p>

            {/* List of existing fields */}
            <div className="space-y-2 mb-6">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Fields</span>
              <div className="divide-y divide-slate-800 bg-slate-950 rounded-xl border border-slate-800 p-2">
                {/* Protected system fields */}
                <div className="p-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">Participant ID</span>
                    <span className="text-[10px] text-purple-400 ml-2">(System Field)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Protected</span>
                </div>
                <div className="p-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">Full Name</span>
                    <span className="text-[10px] text-purple-400 ml-2">(System Field)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Protected</span>
                </div>

                {/* Configurable custom fields */}
                {customFields.map((cf) => (
                  <div key={cf.id} className="p-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{cf.name}</span>
                      <span className="text-[10px] text-purple-300 ml-2 font-mono">[{cf.type}]</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingField(cf);
                          setNewFieldName(cf.name);
                          setNewFieldType(cf.type);
                          setNewFieldOptions(cf.options ? cf.options.join(', ') : '');
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Edit Field"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete custom field "${cf.name}"?`)) {
                            deleteCustomField(cf.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Delete Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Field Creator / Editor */}
            <form onSubmit={handleSaveCustomField} className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
              <span className="font-bold text-purple-300 block">
                {editingField ? `Edit Field: ${editingField.name}` : 'Add New Custom Field'}
              </span>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Field Display Name</label>
                <input
                  type="text"
                  required
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g. Registration Fee Paid, Slot Time, Phone"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Field Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="text">Text (Single line string)</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown Select</option>
                  <option value="checkbox">Checkbox (True / False)</option>
                </select>
              </div>

              {newFieldType === 'dropdown' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Dropdown Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Option A, Option B, Option C"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {editingField && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingField(null);
                      setNewFieldName('');
                      setNewFieldOptions('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {editingField ? 'Save Field' : 'Create Field'}
                </button>
              </div>
            </form>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowFieldsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">Delete Participant?</h4>
            <p className="text-xs text-slate-300 mb-5">
              This action cannot be undone. Any recorded results for this contestant will remain in history logs.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteParticipant(showDeleteConfirm)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Contestants Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Remove All Contestants?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-white">{db?.participants?.length || 0}</strong> contestants from the roster? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={async () => {
                  try {
                    setIsDeletingAll(true);
                    await deleteAllParticipants();
                    setShowDeleteAllModal(false);
                  } catch (err: any) {
                    alert(err.message || 'Failed to remove all participants');
                  } finally {
                    setIsDeletingAll(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeletingAll ? 'Removing...' : 'Yes, Remove All Contestants'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
