import React, { useState, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Upload,
  FileImage,
  X,
  Loader2,
  Check,
  Laptop,
  Globe,
  Edit2,
  Hash,
  MapPin,
  Layers,
  CheckSquare,
  Square,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { EventImage } from '../types';

interface FileUploadItem {
  id: string;
  file: File;
  imageId: string;
  preview: string;
  base64: string;
  size: string;
  stationId?: string;
}

export const ImagesManager: React.FC = () => {
  const {
    db,
    addImage,
    uploadImages,
    updateImage,
    deleteImage,
    resetImagesStatus,
    allStations,
    batchUpdateImageStations,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used'>('all');
  const [stationFilter, setStationFilter] = useState<string>('all'); // 'all', 'universal', or stationId

  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'laptop' | 'url'>('laptop');

  // URL mode state
  const [urlImageId, setUrlImageId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [urlStationId, setUrlStationId] = useState<string>('all');

  // Editing ID inline
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [newImageIdVal, setNewImageIdVal] = useState('');

  // Laptop upload state
  const [uploadDefaultStationId, setUploadDefaultStationId] = useState<string>('all');
  const [selectedFiles, setSelectedFiles] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select for batch actions
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [batchTargetStationId, setBatchTargetStationId] = useState<string>('all');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const images = db?.images || [];

  const resolveStationName = (stId?: string): string | undefined => {
    if (!stId || stId === 'all' || stId === 'universal') return undefined;
    const found = allStations.find((s) => s.id === stId);
    return found ? found.name : stId;
  };

  const getStationColor = (stationId?: string) => {
    if (!stationId || stationId === 'all') {
      return {
        badge: 'bg-slate-800/90 text-slate-300 border-slate-700',
        dot: 'bg-slate-400',
        name: 'Universal / All Stations',
      };
    }
    const lower = stationId.toLowerCase();
    if (lower.includes('a')) {
      return {
        badge: 'bg-blue-950/90 text-blue-300 border-blue-700',
        dot: 'bg-blue-400',
        name: resolveStationName(stationId) || stationId,
      };
    }
    if (lower.includes('b')) {
      return {
        badge: 'bg-purple-950/90 text-purple-300 border-purple-700',
        dot: 'bg-purple-400',
        name: resolveStationName(stationId) || stationId,
      };
    }
    if (lower.includes('c')) {
      return {
        badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-700',
        dot: 'bg-emerald-400',
        name: resolveStationName(stationId) || stationId,
      };
    }
    if (lower.includes('d')) {
      return {
        badge: 'bg-amber-950/90 text-amber-300 border-amber-700',
        dot: 'bg-amber-400',
        name: resolveStationName(stationId) || stationId,
      };
    }
    return {
      badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-700',
      dot: 'bg-indigo-400',
      name: resolveStationName(stationId) || stationId,
    };
  };

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const idToTest = (img.imageId || img.name || '').toLowerCase();
      const matchesSearch = idToTest.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || img.status === statusFilter;

      let matchesStation = true;
      if (stationFilter === 'universal') {
        matchesStation = !img.stationId || img.stationId === 'all';
      } else if (stationFilter !== 'all') {
        matchesStation = img.stationId === stationFilter;
      }

      return matchesSearch && matchesStatus && matchesStation;
    });
  }, [images, searchTerm, statusFilter, stationFilter]);

  // Station counts for pills
  const stationCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: images.length,
      universal: images.filter((i) => !i.stationId || i.stationId === 'all').length,
    };
    allStations.forEach((s) => {
      counts[s.id] = images.filter((i) => i.stationId === s.id).length;
    });
    return counts;
  }, [images, allStations]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setUploadError(null);

    const newItems: FileUploadItem[] = [];
    const currentTotal = images.length + selectedFiles.length;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }
      try {
        const base64 = await readFileAsBase64(file);
        const autoId = `IMG-${String(currentTotal + i + 1).padStart(3, '0')}`;
        newItems.push({
          id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`,
          file,
          imageId: autoId,
          preview: base64,
          base64,
          size: formatFileSize(file.size),
          stationId: uploadDefaultStationId,
        });
      } catch (e) {
        console.error('Error reading file:', e);
      }
    }

    if (newItems.length === 0) {
      setUploadError('Please select valid image files (JPG, PNG, WEBP, GIF).');
      return;
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveSelectedFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateSelectedImageId = (id: string, newId: string) => {
    setSelectedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, imageId: newId.toUpperCase() } : f))
    );
  };

  const handleUpdateSelectedStationId = (id: string, stId: string) => {
    setSelectedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, stationId: stId } : f))
    );
  };

  // Submit Laptop Uploaded Images
  const handleUploadFromLaptop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please choose at least one image file from your laptop.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const defaultStId = uploadDefaultStationId === 'all' ? undefined : uploadDefaultStationId;
      const defaultStName = resolveStationName(defaultStId);

      const payload = {
        images: selectedFiles.map((item, idx) => {
          const itemStId = item.stationId === 'all' ? undefined : (item.stationId || defaultStId);
          const itemStName = resolveStationName(itemStId);
          return {
            imageId: item.imageId.trim().toUpperCase() || `IMG-${String(images.length + idx + 1).padStart(3, '0')}`,
            name: item.imageId.trim().toUpperCase() || `IMG-${String(images.length + idx + 1).padStart(3, '0')}`,
            base64: item.base64,
            stationId: itemStId,
            stationName: itemStName,
          };
        }),
        stationId: defaultStId,
        stationName: defaultStName,
      };

      await uploadImages(payload);
      setSelectedFiles([]);
      setShowAddModal(false);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Web URL Image
  const handleSaveUrlImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    const finalId = (urlImageId.trim() || `IMG-${String(images.length + 1).padStart(3, '0')}`).toUpperCase();
    const finalStId = urlStationId === 'all' ? undefined : urlStationId;
    const finalStName = resolveStationName(finalStId);

    setIsUploading(true);
    try {
      await addImage(finalId, imageUrl.trim(), finalStId, finalStName);
      setUrlImageId('');
      setImageUrl('');
      setUrlStationId('all');
      setShowAddModal(false);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to add image URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEditId = async (id: string) => {
    if (!newImageIdVal.trim()) return;
    await updateImage(id, { imageId: newImageIdVal.trim().toUpperCase() });
    setEditingImageId(null);
  };

  const handleQuickStationChange = async (imgId: string, newStationId: string) => {
    const finalStId = newStationId === 'all' ? undefined : newStationId;
    const finalStName = resolveStationName(finalStId);
    await updateImage(imgId, {
      stationId: finalStId,
      stationName: finalStName,
    });
  };

  const handleToggleStatus = async (img: EventImage) => {
    const nextStatus = img.status === 'available' ? 'used' : 'available';
    await updateImage(img.id, { status: nextStatus });
  };

  // Selection handlers for batch reassignment
  const toggleSelectImage = (id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedImageIds(new Set(filteredImages.map((i) => i.id)));
  };

  const clearSelection = () => {
    setSelectedImageIds(new Set());
  };

  const handleBatchAssignStation = async () => {
    if (selectedImageIds.size === 0) return;
    setIsBatchUpdating(true);
    setBatchMessage(null);
    try {
      const targetStId = batchTargetStationId === 'all' ? undefined : batchTargetStationId;
      const targetStName = resolveStationName(targetStId);
      const res = await batchUpdateImageStations(Array.from(selectedImageIds), targetStId, targetStName);
      setBatchMessage(`Successfully assigned ${res.count} images to ${targetStName || 'Universal / All Stations'}`);
      setSelectedImageIds(new Set());
      setTimeout(() => setBatchMessage(null), 4000);
    } catch (err: any) {
      setBatchMessage(`Error: ${err.message || 'Failed to update images'}`);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const total = images.length;
  const available = images.filter((i) => i.status === 'available').length;
  const used = total - available;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-blue-400" />
            Image Repository & Station Partitioning
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign images to specific stations (Station A, B, C, D) so they never repeat across stations, or keep them Universal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (confirm('Reset all image statuses back to Available?')) {
                resetImagesStatus();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Statuses</span>
          </button>

          {/* Primary Upload from Laptop Button */}
          <button
            onClick={() => {
              setAddMode('laptop');
              setUploadError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-950/50"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Images with IDs</span>
          </button>

          {/* Secondary Add via URL button */}
          <button
            onClick={() => {
              setAddMode('url');
              setUrlImageId(`IMG-${String(images.length + 1).padStart(3, '0')}`);
              setUrlStationId('all');
              setUploadError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold shadow-md shadow-purple-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Add via URL</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Image IDs in Pool</div>
            <div className="text-2xl font-black text-white font-mono">{total}</div>
          </div>
          <span className="p-2 rounded-xl bg-blue-500/20 text-blue-300 font-bold text-xs">Pool</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Available Image IDs</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{available}</div>
          </div>
          <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs">Ready</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Assigned / Used IDs</div>
            <div className="text-2xl font-black text-rose-400 font-mono">{used}</div>
          </div>
          <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs">Assigned</span>
        </div>
      </div>

      {/* Station Filter Pills Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Filter by Station Pool:</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Images in each station will only appear for that station
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStationFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              stationFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>All Images</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
              {stationCounts.all}
            </span>
          </button>

          {allStations.map((st) => {
            const isSelected = stationFilter === st.id;
            const count = stationCounts[st.id] || 0;
            return (
              <button
                key={st.id}
                onClick={() => setStationFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-950 text-purple-300/80 hover:text-purple-200 border border-slate-800'
                }`}
              >
                <MapPin className="w-3 h-3 text-purple-400" />
                <span>{st.name}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-purple-900/50 border border-purple-700/50 text-[10px] font-mono text-purple-200">
                  {count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setStationFilter('universal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              stationFilter === 'universal'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>Universal / Shared</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300">
              {stationCounts.universal}
            </span>
          </button>
        </div>
      </div>

      {/* Batch Message Notification */}
      {batchMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{batchMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Image ID (e.g. IMG-001)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none"
            >
              <option value="all">All ({total})</option>
              <option value="available">Available ({available})</option>
              <option value="used">Used ({used})</option>
            </select>
          </div>

          {filteredImages.length > 0 && (
            <button
              onClick={selectedImageIds.size === filteredImages.length ? clearSelection : selectAllFiltered}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              {selectedImageIds.size === filteredImages.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select All Filtered ({filteredImages.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Sticky Bar when items selected */}
      {selectedImageIds.size > 0 && (
        <div className="sticky top-4 z-40 bg-slate-950 border-2 border-purple-500 p-3.5 rounded-2xl shadow-2xl shadow-purple-950/80 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold text-xs">
              {selectedImageIds.size} Selected
            </span>
            <span className="text-xs text-slate-300">
              Bulk assign station to selected images:
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={batchTargetStationId}
              onChange={(e) => setBatchTargetStationId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-purple-500/60 text-purple-200 text-xs font-bold focus:outline-none"
            >
              <option value="all">Universal / All Stations (Shared)</option>
              {allStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location || 'Station'})
                </option>
              ))}
            </select>

            <button
              onClick={handleBatchAssignStation}
              disabled={isBatchUpdating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/60 disabled:opacity-50"
            >
              {isBatchUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Apply to {selectedImageIds.size} Images</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Images Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Images Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' || stationFilter !== 'all'
                ? 'Try adjusting your search query, status filter, or station filter.'
                : 'Upload images from your laptop or provide image links and assign each an Image ID and Station.'}
            </p>
          </div>
          <button
            onClick={() => {
              setAddMode('laptop');
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Images with IDs</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredImages.map((img) => {
            const isLocalUpload = img.url.startsWith('/uploads/');
            const currentId = img.imageId || img.name || img.id;
            const isEditing = editingImageId === img.id;
            const isSelected = selectedImageIds.has(img.id);
            const stationColor = getStationColor(img.stationId);

            return (
              <div
                key={img.id}
                className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all group ${
                  isSelected
                    ? 'border-purple-500 ring-2 ring-purple-500/30'
                    : 'border-slate-800 hover:border-blue-500/50'
                }`}
              >
                <div className="relative aspect-video bg-slate-950 overflow-hidden">
                  <img
                    src={img.url}
                    alt={currentId}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as any).src = 'https://placehold.co/600x400?text=Image+Unavailable';
                    }}
                  />

                  {/* Multi-select checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelectImage(img.id)}
                    className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white backdrop-blur-sm border border-slate-700"
                    title={isSelected ? 'Deselect image' : 'Select image for batch action'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {/* Upload Source Badge */}
                  <div className="absolute top-2 left-10 flex items-center gap-1.5">
                    {isLocalUpload ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-950/90 text-blue-300 border border-blue-700 flex items-center gap-1 backdrop-blur-sm">
                        <Laptop className="w-2.5 h-2.5" />
                        Upload
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-950/90 text-purple-300 border border-purple-700 flex items-center gap-1 backdrop-blur-sm">
                        <Globe className="w-2.5 h-2.5" />
                        Web
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-sm ${
                      img.status === 'available'
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700'
                        : 'bg-rose-950/90 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {img.status}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Image ID Display and Inline Edit */}
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newImageIdVal}
                          onChange={(e) => setNewImageIdVal(e.target.value.toUpperCase())}
                          className="flex-1 px-2 py-1 text-xs font-mono font-bold bg-slate-950 border border-blue-500 rounded text-blue-300 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditId(img.id)}
                          className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                          title="Save ID"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingImageId(null)}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 font-mono font-black text-blue-300 text-xs tracking-wider">
                            <Hash className="w-3 h-3 text-blue-400" />
                            {currentId}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingImageId(img.id);
                            setNewImageIdVal(currentId);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit Image ID"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {img.usedByParticipantName && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Assigned to: <span className="text-amber-300 font-semibold">{img.usedByParticipantName}</span>
                      </p>
                    )}
                  </div>

                  {/* Assigned Station Badge & Quick Reassign Selector */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                        <MapPin className="w-3 h-3 text-purple-400" />
                        Assigned Station:
                      </span>
                    </div>

                    <select
                      value={img.stationId || 'all'}
                      onChange={(e) => handleQuickStationChange(img.id, e.target.value)}
                      className={`w-full px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors focus:outline-none ${stationColor.badge}`}
                    >
                      <option value="all" className="bg-slate-900 text-slate-200">
                        Universal / All Stations
                      </option>
                      {allStations.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white font-semibold">
                          {s.name} ({s.location || 'Station'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => handleToggleStatus(img)}
                      className="text-blue-400 hover:text-blue-300 font-semibold text-[11px]"
                    >
                      Mark as {img.status === 'available' ? 'Used' : 'Available'}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete image [${currentId}]?`)) deleteImage(img.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                      title="Delete image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Upload Image Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/30 rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                Add Images with Custom IDs & Stations
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedFiles([]);
                  setUploadError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switch Tabs: Laptop vs Web URL */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mt-4 mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAddMode('laptop');
                  setUploadError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  addMode === 'laptop'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Upload from Laptop</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode('url');
                  setUrlImageId(`IMG-${String(images.length + 1).padStart(3, '0')}`);
                  setUrlStationId('all');
                  setUploadError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  addMode === 'url'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Add via Web URL</span>
              </button>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-semibold">
                {uploadError}
              </div>
            )}

            {/* LAPTOP UPLOAD MODE */}
            {addMode === 'laptop' && (
              <form onSubmit={handleUploadFromLaptop} className="space-y-4">
                {/* Station Selection for Batch Upload */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>Assign Uploaded Images to Station:</span>
                  </label>
                  <select
                    value={uploadDefaultStationId}
                    onChange={(e) => {
                      const newStId = e.target.value;
                      setUploadDefaultStationId(newStId);
                      setSelectedFiles((prev) =>
                        prev.map((f) => ({ ...f, stationId: newStId }))
                      );
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-purple-300 text-xs font-semibold focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">Universal / All Stations (Shared across all)</option>
                    {allStations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.location || 'Station'}) — Images will NOT repeat on other stations
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Images assigned to a specific station are strictly reserved for that station in Round 1.
                  </p>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />

                {/* Drag & Drop Area */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFilesSelected(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                    isDragging
                      ? 'border-blue-400 bg-blue-950/30'
                      : 'border-slate-700 hover:border-blue-500/60 bg-slate-950/50 hover:bg-slate-950'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 shadow-md">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Click to browse your laptop or drag & drop images
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Supports JPG, PNG, WEBP, GIF (each image receives an editable Image ID & Station)
                    </p>
                  </div>
                </div>

                {/* Selected Files List & Previews with Image ID and Station */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                      <span>Ready to upload ({selectedFiles.length} images):</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-rose-400 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    {selectedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <img
                          src={item.preview}
                          alt="preview"
                          className="w-14 h-12 object-cover rounded-lg border border-slate-800 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-mono">ID:</span>
                            <input
                              type="text"
                              value={item.imageId}
                              onChange={(e) => handleUpdateSelectedImageId(item.id, e.target.value)}
                              placeholder="e.g. IMG-001"
                              className="w-full text-xs font-mono font-bold text-blue-300 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-semibold">Station:</span>
                            <select
                              value={item.stationId || uploadDefaultStationId}
                              onChange={(e) => handleUpdateSelectedStationId(item.id, e.target.value)}
                              className="w-full text-[11px] bg-slate-900 border border-slate-800 text-purple-300 rounded-lg px-2 py-0.5 focus:outline-none"
                            >
                              <option value="all">Universal / All</option>
                              {allStations.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            {item.size} • {item.file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedFile(item.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400"
                          title="Remove this image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedFiles([]);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedFiles.length === 0 || isUploading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-950/60 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Upload {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* WEB URL MODE */}
            {addMode === 'url' && (
              <form onSubmit={handleSaveUrlImage} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Image ID <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={urlImageId}
                      onChange={(e) => setUrlImageId(e.target.value.toUpperCase())}
                      placeholder="e.g. IMG-001 or PHOTO-A"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    This ID will be randomly assigned to participants and tracked in the Results table.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Assign to Station
                  </label>
                  <select
                    value={urlStationId}
                    onChange={(e) => setUrlStationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">Universal / All Stations (No Restriction)</option>
                    {allStations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.location || 'Station'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    If assigned to a specific station, this image will NEVER appear in other stations.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Image URL (Direct link to image) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {imageUrl && (
                  <div className="aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as any).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                      }}
                    />
                  </div>
                )}

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
                    disabled={isUploading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-40"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Image with ID</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
