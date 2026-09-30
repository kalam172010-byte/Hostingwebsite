import React from 'react';
import { HostedBot, FileSubmission, BotLog } from '../types';
import { 
  Bot, 
  Play, 
  Square, 
  Code2, 
  Sliders, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FolderDown, 
  Cpu, 
  ShieldAlert,
  ArrowUpRight,
  Plus,
  RefreshCw,
  HardDrive,
  KeyRound,
  Zap,
  Activity,
  Edit3,
  Trash2
} from 'lucide-react';

interface DashboardViewProps {
  bots: HostedBot[];
  submissions: FileSubmission[];
  logs: BotLog[];
  onToggleBotStatus: (botId: string) => void;
  onSelectBotForCode: (bot: HostedBot) => void;
  onSelectBotForRules: (bot: HostedBot) => void;
  onSelectBotForSimulator: (bot: HostedBot) => void;
  onOpenCreateModal: () => void;
  onOpenTelegramModal?: () => void;
  onEditBot?: (bot: HostedBot) => void;
  onDeleteBot?: (botId: string) => void;
  onDeleteSubmission?: (submissionId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  bots,
  submissions,
  logs,
  onToggleBotStatus,
  onSelectBotForCode,
  onSelectBotForRules,
  onSelectBotForSimulator,
  onOpenCreateModal,
  onOpenTelegramModal,
  onEditBot,
  onDeleteBot,
  onDeleteSubmission,
}) => {
  const totalApproved = submissions.filter(s => s.status === 'COMPLETED' || s.status === 'APPROVED').length;
  const totalPending = submissions.filter(s => s.status === 'PENDING_ADMIN').length;
  const totalRejected = submissions.filter(s => s.status === 'REJECTED').length;
  const totalDownloadedMB = submissions
    .filter(s => s.status === 'COMPLETED' || s.status === 'APPROVED')
    .reduce((acc, curr) => acc + curr.fileSizeMB, 0);

  const approvalRate = submissions.length > 0 
    ? Math.round((totalApproved / submissions.length) * 100) 
    : 100;

  const isAnyBotRunning = bots.some(b => b.status === 'RUNNING' && b.botToken && !b.botToken.includes('aafj283'));

  return (
    <div className="space-y-6">
      {/* Bot Connection Alert if not connected */}
      {!isAnyBotRunning && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-200">
                Telegram Bot is not connected yet
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Paste your @BotFather token to start receiving live files and hosting Python bots in the cloud 24/7.
              </div>
            </div>
          </div>
          {onOpenTelegramModal && (
            <button
              onClick={onOpenTelegramModal}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Connect Token Now</span>
            </button>
          )}
        </div>
      )}
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Telethon Bots</span>
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {bots.filter(b => b.status === 'RUNNING').length} <span className="text-xs text-slate-400 font-sans font-normal">/ {bots.length} total</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telethon MTProto Engine Online</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Auto-Approval Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {approvalRate}%
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>{totalApproved} passed</span>
            <span className="mx-1">·</span>
            <span>{totalRejected} rejected</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Pending Admin Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {totalPending}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Inline button queue active</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Downloaded Storage</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {(totalDownloadedMB / 1024).toFixed(2)} <span className="text-xs text-slate-400 font-sans font-normal">GB</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>{submissions.length} media files processed</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Telethon Runtime</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            v1.34.0
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Async client ready</span>
          </div>
        </div>
      </div>

      {/* Hosted Bots List Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Hosted Telethon Bots</h2>
            <p className="text-xs text-slate-400">Manage running instances, approval rule profiles, and Python script generation</p>
          </div>
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Telethon Bot
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bots.map(bot => {
            const isRunning = bot.status === 'RUNNING';

            return (
              <div 
                key={bot.id}
                className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Bot Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg border ${
                      isRunning ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{bot.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                          isRunning ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          {bot.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        @{bot.botUsername}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleBotStatus(bot.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                      isRunning 
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <Square className="w-3 h-3 fill-current" /> Stop Bot
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" /> Start Bot
                      </>
                    )}
                  </button>
                </div>

                {/* Telethon Rules Badge Summary */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Max File Size</span>
                    <span className="font-mono font-medium text-slate-200">{bot.rules.maxFileSizeMB} MB</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Channel Verification</span>
                    <span className="font-medium text-slate-200 truncate block">
                      {bot.rules.requireChannelMembership ? bot.rules.channelUsername || 'Required' : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Admin Chat ID</span>
                    <span className="font-mono text-slate-300 truncate block">{bot.adminChatId}</span>
                  </div>
                </div>

                {/* Quick Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onEditBot?.(bot)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors font-medium"
                      title="Edit Bot Name, Token, & Settings"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Bot
                    </button>
                    <button
                      onClick={() => onSelectBotForCode(bot)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                      title="View & Generate Telethon Python Code"
                    >
                      <Code2 className="w-3.5 h-3.5 text-blue-400" />
                      Python Code
                    </button>
                    <button
                      onClick={() => onSelectBotForRules(bot)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                      title="Edit File Approval Rules"
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      Approval Rules
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectBotForSimulator(bot)}
                      className="flex items-center gap-1 px-3 py-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors font-medium"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Test Simulator
                    </button>
                    {onDeleteBot && (
                      <button
                        onClick={() => onDeleteBot(bot.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                        title="Delete Bot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submissions & Telethon Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Submissions Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Automated Downloads Log</h3>
              <p className="text-xs text-slate-400">Incoming user files evaluated by Telethon engine</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {submissions.length} Total Received
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                  <th className="pb-2">File Name</th>
                  <th className="pb-2">Sender</th>
                  <th className="pb-2">Size</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {submissions.map(sub => {
                  let badgeStyle = 'bg-slate-800 text-slate-300';
                  if (sub.status === 'COMPLETED' || sub.status === 'APPROVED') {
                    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                  } else if (sub.status === 'PENDING_ADMIN') {
                    badgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  } else if (sub.status === 'REJECTED') {
                    badgeStyle = 'bg-red-500/10 text-red-400 border border-red-500/20';
                  }

                  return (
                    <tr key={sub.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-2.5 font-medium text-slate-200 max-w-[180px] truncate">
                        {sub.fileName}
                      </td>
                      <td className="py-2.5 text-slate-400 font-sans">
                        @{sub.senderUsername}
                      </td>
                      <td className="py-2.5 text-slate-300 tabular-nums">
                        {sub.fileSizeMB.toFixed(1)} MB
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${badgeStyle}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400 font-sans text-[11px] max-w-[180px] truncate" title={sub.approvalReason}>
                        {sub.approvalReason}
                      </td>
                      <td className="py-2.5 text-right font-sans flex items-center justify-end gap-2">
                        {sub.downloadedPath ? (
                          <a
                            href={`/api/bots/download-file?path=${encodeURIComponent(sub.downloadedPath)}`}
                            download
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors font-medium"
                            title="Download File to Computer"
                          >
                            <FolderDown className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        ) : null}
                        {onDeleteSubmission && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${sub.fileName}" from the website and server disk?`)) {
                                onDeleteSubmission(sub.id);
                              }
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition-colors"
                            title="Delete File Permanently from Website & Server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Telethon Real-Time Log Console */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">Telethon Event Stream</h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mb-3">Live background execution logs</p>

            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 font-mono text-[11px] space-y-2 max-h-[320px] overflow-y-auto">
              {logs.map(log => {
                let color = 'text-slate-300';
                if (log.level === 'SUCCESS') color = 'text-emerald-400';
                if (log.level === 'WARN') color = 'text-amber-400';
                if (log.level === 'ERROR') color = 'text-red-400';

                return (
                  <div key={log.id} className="leading-tight">
                    <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                    <span className={`font-semibold ${color}`}>[{log.level}]</span>{' '}
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-between font-medium text-slate-200">
              <span>Telethon Engine Status</span>
              <span className="text-emerald-400 font-mono text-[11px]">MTProto Connected</span>
            </div>
            <p className="text-[11px]">Async event listener listening on @client.on(events.NewMessage)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
