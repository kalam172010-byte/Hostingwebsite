import React, { useState } from 'react';
import { FileSubmission } from '../types';
import { 
  FolderDown, 
  Trash2, 
  Search, 
  RefreshCw, 
  FileText, 
  HardDrive, 
  ArrowLeft,
  CheckCircle2,
  Clock,
  Zap,
  Filter,
  ExternalLink
} from 'lucide-react';

interface ReceivedFilesViewProps {
  submissions: FileSubmission[];
  onDeleteSubmission: (id: string) => Promise<void> | void;
  onRefresh?: () => void;
  onNavigateBack?: () => void;
}

export const ReceivedFilesView: React.FC<ReceivedFilesViewProps> = ({
  submissions,
  onDeleteSubmission,
  onRefresh,
  onNavigateBack
}) => {
  const [searchTerm, setSearchType] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalSizeMB = submissions.reduce((acc, curr) => acc + (curr.fileSizeMB || 0), 0);

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      (sub.fileName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.senderUsername || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || sub.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (sub: FileSubmission) => {
    if (window.confirm(`Are you sure you want to delete "${sub.fileName}" from the website and server storage?`)) {
      setDeletingId(sub.id);
      try {
        await onDeleteSubmission(sub.id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/60 to-slate-900 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shrink-0 shadow-inner">
            <HardDrive className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Received User Files & Storage</h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              All files sent by users via Telegram or uploaded on the website in real-time. Manage and delete files anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-white/10"
              title="Refresh Files List"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Refresh</span>
            </button>
          )}
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold transition-colors border border-cyan-500/30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Received Files</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {submissions.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Captured in real-time</p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Storage Size</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">
            {totalSizeMB > 1024 ? `${(totalSizeMB / 1024).toFixed(2)} GB` : `${totalSizeMB.toFixed(2)} MB`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stored on cloud server</p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Completed / Hosted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {submissions.filter(s => s.status === 'COMPLETED' || s.status === 'APPROVED' || s.status === 'HOSTED').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ready for download</p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Real-Time Polling</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 flex items-center gap-2">
            <span>2.5s</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Auto-sync with Telegram</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchType(e.target.value)}
              placeholder="Search file name or sender username..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses ({submissions.length})</option>
              <option value="COMPLETED">Completed</option>
              <option value="APPROVED">Approved</option>
              <option value="HOSTED">Hosted</option>
              <option value="PENDING_ADMIN">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Files Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                <th className="pb-2.5">File Name</th>
                <th className="pb-2.5">Sender</th>
                <th className="pb-2.5">Size</th>
                <th className="pb-2.5">Received Time</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5">Details</th>
                <th className="pb-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No received files found</p>
                    <p className="text-xs text-slate-500 mt-0.5">Send any file, script, zip, photo, or document to your Telegram bot to see it appear here live!</p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map(sub => {
                  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (sub.status === 'COMPLETED' || sub.status === 'APPROVED' || sub.status === 'HOSTED') {
                    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  } else if (sub.status === 'PENDING_ADMIN') {
                    badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  } else if (sub.status === 'REJECTED') {
                    badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                  }

                  const downloadPath = sub.downloadedPath || sub.localFilePath || '';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-950/60 transition-colors">
                      <td className="py-3 font-semibold text-slate-100 max-w-[220px] truncate" title={sub.fileName}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="truncate">{sub.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-300 font-sans">
                        @{sub.senderUsername || 'anonymous'}
                      </td>
                      <td className="py-3 text-slate-300 tabular-nums">
                        {(sub.fileSizeMB || 0.01).toFixed(2)} MB
                      </td>
                      <td className="py-3 text-slate-400 text-[11px]">
                        {sub.timestamp || 'Just now'}
                      </td>
                      <td className="py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 font-sans text-[11px] max-w-[200px] truncate" title={sub.approvalReason || sub.reason || ''}>
                        {sub.approvalReason || sub.reason || 'Stored in cloud'}
                      </td>
                      <td className="py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {downloadPath ? (
                            <a
                              href={`/api/bots/download-file?path=${encodeURIComponent(downloadPath)}`}
                              download
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors font-semibold"
                              title="Download File to Computer"
                            >
                              <FolderDown className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          ) : null}

                          <button
                            onClick={() => handleDelete(sub)}
                            disabled={deletingId === sub.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors font-semibold disabled:opacity-50"
                            title="Delete File Permanently from Website & Server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
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
    </div>
  );
};
