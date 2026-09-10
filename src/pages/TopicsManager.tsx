import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { excelService } from '../lib/excel';
import type { Topic } from '../types';

export const TopicsManager: React.FC = () => {
  const { db, addTopic, updateTopic, deleteTopic, importTopics, resetTopicsStatus } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicIdInput, setTopicIdInput] = useState('');
  const [topicText, setTopicText] = useState('');
  const [topicCategory, setTopicCategory] = useState('General');

  // Categories list
  const categories = useMemo(() => {
    if (!db?.topics) return [];
    const set = new Set<string>();
    db.topics.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [db?.topics]);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    if (!db?.topics) return [];
    return db.topics.filter((t) => {
      const matchesSearch =
        (t.topicId && t.topicId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.usedByParticipantName && t.usedByParticipantName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [db?.topics, searchTerm, statusFilter, categoryFilter]);

  const openAddModal = () => {
    setEditingTopic(null);
    setTopicIdInput(`TOP-${String((db?.topics.length || 0) + 1).padStart(3, '0')}`);
    setTopicText('');
    setTopicCategory('General');
    setShowAddModal(true);
  };

  const openEditModal = (t: Topic) => {
    setEditingTopic(t);
    setTopicIdInput(t.topicId || t.id);
    setTopicText(t.topic);
    setTopicCategory(t.category || 'General');
    setShowAddModal(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicText.trim()) return;

    const finalTopicId = (topicIdInput.trim() || `TOP-${String((db?.topics.length || 0) + 1).padStart(3, '0')}`).toUpperCase();

    if (editingTopic) {
      await updateTopic(editingTopic.id, {
        topicId: finalTopicId,
        topic: topicText.trim(),
        category: topicCategory.trim(),
      });
    } else {
      await addTopic(topicText.trim(), topicCategory.trim(), finalTopicId);
    }
    setShowAddModal(false);
  };

  const handleToggleStatus = async (t: Topic) => {
    const nextStatus = t.status === 'available' ? 'used' : 'available';
    await updateTopic(t.id, {
      status: nextStatus,
      usedByParticipantId: nextStatus === 'available' ? undefined : t.usedByParticipantId,
      usedByParticipantName: nextStatus === 'available' ? undefined : t.usedByParticipantName,
    });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await excelService.parseTopicsFile(file);
      const count = await importTopics(parsed);
      alert(`Imported ${count} topics successfully!`);
    } catch (err: any) {
      alert(`Failed to import topics: ${err.message || err}`);
    } finally {
      e.target.value = '';
    }
  };

  const total = db?.topics.length || 0;
  const available = db?.topics.filter((t) => t.status === 'available').length || 0;
  const used = total - available;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-purple-400" />
            Topic Repository & Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage thought-provoking speech themes used for the Round 2 Spinning Wheel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (confirm('Reset all topics back to Available status?')) {
                resetTopicsStatus();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold transition-colors"
            title="Reset status of all used topics"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Statuses</span>
          </button>

          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import Excel</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={() => excelService.downloadTopicTemplate()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Template</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Topic</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Topics</div>
            <div className="text-2xl font-black text-white font-mono">{total}</div>
          </div>
          <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 font-bold text-xs">Pool</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Available for Wheel</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{available}</div>
          </div>
          <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs">Ready</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Used in Spins</div>
            <div className="text-2xl font-black text-rose-400 font-mono">{used}</div>
          </div>
          <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs">Retired</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topic text, participant, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available Only</option>
              <option value="used">Used Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Topics List Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 w-12">#</th>
                <th className="py-3.5 px-4 w-28">Topic ID</th>
                <th className="py-3.5 px-4">Topic Statement</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Used By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No topics found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTopics.map((t, index) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{index + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-md">
                        {t.topicId || t.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white max-w-md">{t.topic}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                        {t.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(t)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                          t.status === 'available'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-800 hover:bg-rose-900'
                        }`}
                        title="Click to toggle status"
                      >
                        {t.status}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {t.usedByParticipantName ? (
                        <div>
                          <div className="font-bold text-purple-300">{t.usedByParticipantName}</div>
                          <div className="text-[10px] text-slate-500">
                            {t.usedAt ? new Date(t.usedAt).toLocaleTimeString() : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Edit topic"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this topic?')) deleteTopic(t.id);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300"
                          title="Delete topic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 font-['Outfit']">
              {editingTopic ? 'Edit Topic' : 'Add New Speech Topic'}
            </h3>
            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Topic ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topicIdInput}
                  onChange={(e) => setTopicIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g. TOP-001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-purple-300 font-mono font-bold focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This ID is tracked for the participant when spun on the wheel and logged in Results.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Topic Prompt / Question <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={topicText}
                  onChange={(e) => setTopicText(e.target.value)}
                  placeholder="e.g. Is Artificial Intelligence eroding or amplifying human empathy?"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category / Genre</label>
                <input
                  type="text"
                  value={topicCategory}
                  onChange={(e) => setTopicCategory(e.target.value)}
                  placeholder="e.g. Technology, Ethics, Society, Leadership"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {editingTopic ? 'Save Topic' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
