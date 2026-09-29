import React, { useState } from 'react';
import { HostedBot, FileSubmission } from '../types';
import { evaluateSubmission, EvaluationResult } from '../utils/ruleEvaluator';
import { 
  Terminal, 
  Send, 
  Paperclip, 
  FileText, 
  Video, 
  FileArchive, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  User, 
  Bot as BotIcon, 
  Sliders, 
  RefreshCw,
  FolderDown,
  Check,
  X,
  ArrowLeft
} from 'lucide-react';

interface SimulatorViewProps {
  bots: HostedBot[];
  selectedBotId: string;
  onSelectBot: (botId: string) => void;
  onNewSubmission: (submission: FileSubmission) => void;
  onUpdateSubmissionStatus: (submissionId: string, status: 'COMPLETED' | 'REJECTED' | 'APPROVED', reason?: string) => void;
  onNavigateBack?: () => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onNewSubmission,
  onUpdateSubmissionStatus,
  onNavigateBack
}) => {
  const currentBot = bots.find(b => b.id === selectedBotId) || bots[0];

  // Simulation form state
  const [senderUsername, setSenderUsername] = useState('john_developer');
  const [isChannelMember, setIsChannelMember] = useState(true);
  const [presetFile, setPresetFile] = useState<'pdf' | 'mp4' | 'zip' | 'exe' | 'apk'>('pdf');
  const [fileName, setFileName] = useState('Quarterly_Financial_Report.pdf');
  const [fileSizeMB, setFileSizeMB] = useState(14.5);
  const [caption, setCaption] = useState('Please review and process this document #download');

  // Simulation run state
  const [activeSimulation, setActiveSimulation] = useState<{
    submission: FileSubmission;
    result: EvaluationResult;
    currentProgress: number;
    isDownloading: boolean;
  } | null>(null);

  // Switch between User Chat and Admin Chat view
  const [viewTab, setViewTab] = useState<'userChat' | 'adminChat' | 'inspector'>('userChat');

  const handlePresetSelect = (preset: 'pdf' | 'mp4' | 'zip' | 'exe' | 'apk') => {
    setPresetFile(preset);
    if (preset === 'pdf') {
      setFileName('Quarterly_Financial_Report.pdf');
      setFileSizeMB(14.5);
    } else if (preset === 'mp4') {
      setFileName('Product_Demo_Video_1080p.mp4');
      setFileSizeMB(120.0);
    } else if (preset === 'zip') {
      setFileName('Source_Code_Backup_2026.zip');
      setFileSizeMB(42.0);
    } else if (preset === 'exe') {
      setFileName('Software_Setup_v2.exe');
      setFileSizeMB(35.0);
    } else if (preset === 'apk') {
      setFileName('Mobile_App_Build_v1.0.apk');
      setFileSizeMB(28.0);
    }
  };

  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      zip: 'application/zip',
      exe: 'application/x-msdownload',
      apk: 'application/vnd.android.package-archive'
    };

    const mediaTypeMap: Record<string, any> = {
      pdf: 'document',
      mp4: 'video',
      zip: 'archive',
      exe: 'document',
      apk: 'apk'
    };

    const submissionData: FileSubmission = {
      id: `sub_${Date.now()}`,
      botId: currentBot.id,
      botName: currentBot.name,
      senderId: Math.floor(Math.random() * 800000) + 100000,
      senderUsername: senderUsername.replace('@', '').trim() || 'anonymous_user',
      isChannelMember,
      fileName: fileName.trim() || 'file',
      mimeType: mimeMap[presetFile] || 'application/octet-stream',
      fileSizeMB,
      mediaType: mediaTypeMap[presetFile] || 'document',
      caption,
      timestamp: new Date().toLocaleTimeString(),
      status: 'APPROVED', // temp placeholder
      approvalReason: '',
      downloadProgress: 0
    };

    // Run rule evaluation engine
    const evalResult = evaluateSubmission(submissionData, currentBot.rules);
    submissionData.status = evalResult.status === 'APPROVED' ? 'APPROVED' : evalResult.status;
    submissionData.approvalReason = evalResult.reason;

    onNewSubmission(submissionData);

    const simulationObj = {
      submission: submissionData,
      result: evalResult,
      currentProgress: 0,
      isDownloading: evalResult.status === 'APPROVED'
    };

    setActiveSimulation(simulationObj);

    // If auto-approved, trigger simulated download progress ticks
    if (evalResult.status === 'APPROVED') {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setActiveSimulation(prev => prev ? { ...prev, currentProgress: 100, isDownloading: false } : null);
          onUpdateSubmissionStatus(
            submissionData.id, 
            'COMPLETED', 
            `Saved to ${currentBot.downloadPath}/${fileName}`
          );
        } else {
          setActiveSimulation(prev => prev ? { ...prev, currentProgress: progress } : null);
        }
      }, 600);
    }
  };

  const handleAdminApprove = () => {
    if (!activeSimulation) return;
    const sub = activeSimulation.submission;
    sub.status = 'APPROVED';
    sub.approvalReason = 'Approved by Admin inline button click.';

    setActiveSimulation({
      ...activeSimulation,
      submission: sub,
      isDownloading: true,
      currentProgress: 0
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setActiveSimulation(prev => prev ? { ...prev, currentProgress: 100, isDownloading: false } : null);
        onUpdateSubmissionStatus(sub.id, 'COMPLETED', `Saved to ${currentBot.downloadPath}/${sub.fileName}`);
      } else {
        setActiveSimulation(prev => prev ? { ...prev, currentProgress: progress } : null);
      }
    }, 600);
  };

  const handleAdminReject = () => {
    if (!activeSimulation) return;
    const sub = activeSimulation.submission;
    sub.status = 'REJECTED';
    sub.approvalReason = 'Declined manually by Admin.';

    setActiveSimulation({
      ...activeSimulation,
      submission: sub,
      isDownloading: false,
      currentProgress: 0
    });

    onUpdateSubmissionStatus(sub.id, 'REJECTED', 'Declined manually by Admin.');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-cyan-500/30 shadow-md shadow-cyan-950/40 cursor-pointer active:scale-95 shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>← Back</span>
            </button>
          )}
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Telethon Live Chat Simulator</h2>
            <p className="text-xs text-slate-400">Test incoming Telegram files against your Telethon bot's auto-approval rules</p>
          </div>
        </div>

        <select
          value={selectedBotId}
          onChange={e => onSelectBot(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500"
        >
          {bots.map(b => (
            <option key={b.id} value={b.id}>
              Target Bot: {b.name} (@{b.botUsername})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Telegram User Action Setup */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Simulate Telegram Sender
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Telethon Event Trigger</span>
          </div>

          <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Preset File Samples</label>
              <div className="grid grid-cols-5 gap-1.5 font-mono">
                {(['pdf', 'mp4', 'zip', 'exe', 'apk'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`py-1.5 px-2 rounded border uppercase font-semibold text-[10px] transition-colors ${
                      presetFile === p
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    .{p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Sender Username</label>
                <input
                  type="text"
                  value={senderUsername}
                  onChange={e => setSenderUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Channel Subscribed?</label>
                <select
                  value={isChannelMember ? 'yes' : 'no'}
                  onChange={e => setIsChannelMember(e.target.value === 'yes')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="yes">Yes ({currentBot.rules.channelUsername || 'Member'})</option>
                  <option value="no">No (Not Joined)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-300 mb-1">File Name</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Size (MB)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fileSizeMB}
                  onChange={e => setFileSizeMB(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Message Caption / Tag</label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="e.g. #download #report"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Send File to Telethon Bot (@{currentBot.botUsername})
            </button>
          </form>

          {/* Bot Rule Check Indicator */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-medium text-slate-300 block">Active Target Bot Rules:</span>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-300">
                Max: {currentBot.rules.maxFileSizeMB}MB
              </span>
              <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-300">
                Channel: {currentBot.rules.requireChannelMembership ? currentBot.rules.channelUsername : 'Off'}
              </span>
              <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-300">
                Keywords: {currentBot.rules.requireCaptionKeyword ? currentBot.rules.allowedKeywords.join(', ') : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Output: Simulated Telegram Chat & Inspector */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* View Tab Selector */}
          <div className="flex items-center justify-between px-4 pt-3 bg-slate-950 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() => setViewTab('userChat')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
                  viewTab === 'userChat'
                    ? 'border-blue-500 text-blue-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BotIcon className="w-3.5 h-3.5" />
                User Chat View
              </button>

              <button
                onClick={() => setViewTab('adminChat')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
                  viewTab === 'adminChat'
                    ? 'border-blue-500 text-blue-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Admin Chat View
                {activeSimulation?.submission.status === 'PENDING_ADMIN' && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setViewTab('inspector')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
                  viewTab === 'inspector'
                    ? 'border-blue-500 text-blue-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Telethon Inspector
              </button>
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Live Simulation Sandbox
            </span>
          </div>

          {/* Tab Content Display */}
          <div className="p-5 min-h-[420px] flex flex-col justify-between bg-slate-950/80">
            {!activeSimulation ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 text-slate-500 space-y-2">
                <Paperclip className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-medium text-slate-400">No active file simulation running</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Fill in the sender parameters on the left and click "Send File to Telethon Bot" to simulate Telegram MTProto execution.
                </p>
              </div>
            ) : viewTab === 'userChat' ? (
              /* User Chat View */
              <div className="space-y-4">
                {/* User Message Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-sm bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 space-y-2 shadow-md">
                    <div className="flex items-center gap-2 border-b border-blue-500/60 pb-2">
                      <Paperclip className="w-4 h-4" />
                      <div className="truncate text-xs font-mono font-semibold">{activeSimulation.submission.fileName}</div>
                    </div>
                    <div className="text-[11px] font-mono opacity-90 flex justify-between">
                      <span>{activeSimulation.submission.fileSizeMB.toFixed(1)} MB</span>
                      <span>@{activeSimulation.submission.senderUsername}</span>
                    </div>
                    {activeSimulation.submission.caption && (
                      <p className="text-xs italic pt-1 text-blue-100">{activeSimulation.submission.caption}</p>
                    )}
                  </div>
                </div>

                {/* Bot Response Bubble */}
                <div className="flex justify-start">
                  <div className="max-w-md bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none p-4 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold text-slate-100">
                      <BotIcon className="w-4 h-4 text-blue-400" />
                      @{currentBot.botUsername}
                    </div>

                    {activeSimulation.submission.status === 'APPROVED' || activeSimulation.submission.status === 'COMPLETED' ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          File Approved! Initiating Telethon download...
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 font-mono text-[11px]">
                          <div className="flex justify-between text-slate-300">
                            <span>Telethon download_media()</span>
                            <span className="font-semibold text-emerald-400">{activeSimulation.currentProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-500 ease-out"
                              style={{ width: `${activeSimulation.currentProgress}%` }}
                            />
                          </div>
                          {activeSimulation.currentProgress === 100 && (
                            <p className="text-[11px] text-slate-400 pt-1">
                              ✅ Saved to: <code className="text-slate-200">{currentBot.downloadPath}/{activeSimulation.submission.fileName}</code>
                            </p>
                          )}
                        </div>
                      </div>
                    ) : activeSimulation.submission.status === 'REJECTED' ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-red-400 font-semibold">
                          <XCircle className="w-4 h-4" />
                          Submission Rejected
                        </div>
                        <p className="text-slate-300 italic bg-red-500/5 border border-red-500/10 p-2 rounded">
                          Reason: {activeSimulation.submission.approvalReason}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {currentBot.rules.customRejectionMessage}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold">
                          <Clock className="w-4 h-4" />
                          Pending Admin Approval
                        </div>
                        <p className="text-slate-300 text-[11px]">
                          {activeSimulation.submission.approvalReason}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Your request has been routed to the Admin Telegram Chat. Switch to "Admin Chat View" tab above to perform manual approval!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : viewTab === 'adminChat' ? (
              /* Admin Chat View */
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-400 border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Admin Control Panel - Incoming Inline Approval Request
                    </span>
                    <span className="font-mono text-[11px]">Chat ID: {currentBot.adminChatId}</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-200 font-mono">
                    <div>👤 Sender: @{activeSimulation.submission.senderUsername} [{activeSimulation.submission.senderId}]</div>
                    <div>📁 File: {activeSimulation.submission.fileName}</div>
                    <div>📦 Size: {activeSimulation.submission.fileSizeMB.toFixed(1)} MB ({activeSimulation.submission.mimeType})</div>
                    <div>💬 Caption: {activeSimulation.submission.caption || 'None'}</div>
                    <div className="text-amber-300 pt-1">⚠️ Reason: {activeSimulation.submission.approvalReason}</div>
                  </div>

                  {activeSimulation.submission.status === 'PENDING_ADMIN' ? (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleAdminApprove}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Approve & Download ✅
                      </button>
                      <button
                        onClick={handleAdminReject}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4" />
                        Reject ❌
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-950 rounded text-xs font-mono text-slate-400">
                      Status resolved by Admin: <span className="font-bold text-slate-200">{activeSimulation.submission.status}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Telethon Step-by-Step Inspector */
              <div className="space-y-3 font-mono text-xs">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Telethon Rule Evaluation Trace Log
                </h4>

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {activeSimulation.result.logs.map((log, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-start gap-3">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                        log.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        log.status === 'FAIL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        log.status === 'WARN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {log.status}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-200">{log.stage}</div>
                        <div className="text-[11px] text-slate-400">{log.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
