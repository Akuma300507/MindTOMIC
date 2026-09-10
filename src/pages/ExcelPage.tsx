import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { excelService } from '../lib/excel';

export const ExcelPage: React.FC = () => {
  const { db, importParticipants, importTopics } = useApp();

  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const customFields = db?.customFields || [];

  const handleImportParticipants = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await excelService.parseParticipantsFile(file, customFields);
      const count = await importParticipants(parsed);
      setImportStatus({
        type: 'success',
        message: `Successfully imported ${count} participants into database!`,
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `Error importing file: ${err.message || err}`,
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleImportTopics = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await excelService.parseTopicsFile(file);
      const count = await importTopics(parsed);
      setImportStatus({
        type: 'success',
        message: `Successfully imported ${count} topics into topic repository!`,
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `Error importing topics: ${err.message || err}`,
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleExportFullWorkbook = () => {
    if (db) {
      excelService.exportFullEventReport(db);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-3">
          <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
          Excel Management Hub
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Import bulk participants and topics from spreadsheets, download structured templates, and export comprehensive multi-sheet reports.
        </p>
      </div>

      {importStatus && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
            importStatus.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            onClick={() => setImportStatus(null)}
            className="text-xs underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Export Box */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Comprehensive Event Report
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
            Export Master Event Excel Workbook
          </h3>
          <p className="text-xs text-slate-300 max-w-xl">
            Generates a multi-tab Microsoft Excel (.xlsx) file containing: Contestant Roster & Dynamic Custom Fields, Topic Repository, Round 1 Results, Round 2 Results, Round 3 Finals, and Event Configuration.
          </p>
        </div>

        <button
          onClick={handleExportFullWorkbook}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-950/70 transition-transform active:scale-95 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Download Master Report (.xlsx)</span>
        </button>
      </div>

      {/* Two Column Import Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Participant Import / Template */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">Participant Roster</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Import participant lists with Contestant ID, Full Name, Mobile Number, and any active custom fields.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => excelService.downloadParticipantTemplate(customFields)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-purple-400" />
              <span>Download Participant Template</span>
            </button>

            <label className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-950/60 transition-all">
              <Upload className="w-4 h-4" />
              <span>Import Participant Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportParticipants}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Topics Import / Template */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">Speech Topics Pool</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Import speech topics and categories for the Round 2 Spinning Wheel. Existing topics are preserved.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => excelService.downloadTopicTemplate()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Download Topics Template</span>
            </button>

            <label className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-950/60 transition-all">
              <Upload className="w-4 h-4" />
              <span>Import Topics Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportTopics}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
