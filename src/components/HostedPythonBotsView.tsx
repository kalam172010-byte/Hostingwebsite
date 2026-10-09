import React, { useState } from 'react';
import { HostedPythonBot, HostedBot, FileSubmission } from '../types';
import { TelegramConnectModal } from './TelegramConnectModal';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Upload, 
  Terminal, 
  Check, 
  Copy, 
  Sparkles, 
  X, 
  ExternalLink,
  Code,
  Zap,
  Server,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Send,
  ArrowLeft,
  Download,
  FolderDown
} from 'lucide-react';

interface HostedPythonBotsViewProps {
  bots: HostedPythonBot[];
  masterBots: HostedBot[];
  submissions?: FileSubmission[];
  onDeleteSubmission?: (id: string) => Promise<void> | void;
  onRefresh: () => void;
  onStartBot: (id: string) => Promise<void>;
  onStopBot: (id: string) => Promise<void>;
  onDeleteBot: (id: string) => Promise<void>;
  onDeployTemplate: () => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onDeployCode: (name: string, code: string) => Promise<void>;
  onConnectToken?: (token: string, name?: string) => Promise<{ success: boolean; username?: string; error?: string }>;
  onNavigateBack?: () => void;
}

export const HostedPythonBotsView: React.FC<HostedPythonBotsViewProps> = ({
  bots,
  masterBots,
  submissions,
  onDeleteSubmission,
  onRefresh,
  onStartBot,
  onStopBot,
  onDeleteBot,
  onDeployTemplate,
  onUploadFile,
  onDeployCode,
  onConnectToken,
  onNavigateBack
}) => {
  const [selectedBotForLogs, setSelectedBotForLogs] = useState<HostedPythonBot | null>(null);
  const [selectedBotForEnv, setSelectedBotForEnv] = useState<HostedPythonBot | null>(null);
  const [envKeyInput, setEnvKeyInput] = useState('');
  const [envValueInput, setEnvValueInput] = useState('');
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [inputToken, setInputToken] = useState('');
  const [tokenTesting, setTokenTesting] = useState(false);
  const [tokenTestResult, setTokenTestResult] = useState<{ success: boolean; message: string; username?: string } | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadBotFile = async (bot: HostedPythonBot) => {
    try {
      setDownloadingId(bot.id);
      const res = await fetch(`/api/python-bots/${bot.id}/download`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bot.entryFile || `${bot.name.replace(/\s+/g, '_')}.py`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      window.location.href = `/api/python-bots/${bot.id}/download`;
    } finally {
      setDownloadingId(null);
    }
  };

  // Close modals on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedBotForLogs) setSelectedBotForLogs(null);
        if (selectedBotForEnv) setSelectedBotForEnv(null);
        if (showCodeEditor) setShowCodeEditor(false);
        if (showTokenModal) setShowTokenModal(false);
        if (showTroubleshooter) setShowTroubleshooter(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBotForLogs, selectedBotForEnv, showCodeEditor, showTokenModal, showTroubleshooter]);

  const [customBotName, setCustomBotName] = useState('telegram_worker.py');
  const [customBotCode, setCustomBotCode] = useState(`# Telegram Bot Worker (Python 3)
import sys
import time
import datetime

print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🚀 Custom Telegram Python Bot Initialized.")
print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🐍 Python: {sys.version.split()[0]}")

count = 0
while True:
    count += 1
    time.sleep(10)
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ⚡ [Worker Task #{count}] Polling updates, 0 errors. Bot active 24/7.")
`);

  const activeMasterBot = masterBots.find(b => b.status === 'RUNNING') || masterBots[0];
  const isMasterBotLive = activeMasterBot && activeMasterBot.status === 'RUNNING' && !activeMasterBot.botToken.includes('aafj283') && !activeMasterBot.botToken.includes('123456');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsDeploying(true);
      try {
        await onUploadFile(e.target.files[0]);
      } finally {
        setIsDeploying(false);
        e.target.value = '';
      }
    }
  };

  const handleEditorDeploy = async () => {
    if (!customBotCode.trim()) return;
    setIsDeploying(true);
    try {
      await onDeployCode(customBotName || 'bot.py', customBotCode);
      setShowCodeEditor(false);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSaveEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBotForEnv || !envKeyInput.trim()) return;
    setIsSavingEnv(true);
    try {
      const res = await fetch(`/api/python-bots/${selectedBotForEnv.id}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: envKeyInput.trim(), value: envValueInput.trim() })
      });
      if (res.ok) {
        if (!selectedBotForEnv.envVars) selectedBotForEnv.envVars = {};
        selectedBotForEnv.envVars[envKeyInput.trim()] = envValueInput.trim();
        setEnvKeyInput('');
        setEnvValueInput('');
        onRefresh();
      }
    } catch (e) {
      console.error('Error saving env variable:', e);
    } finally {
      setIsSavingEnv(false);
    }
  };

  const handleConnectTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;

    setTokenTesting(true);
    setTokenTestResult(null);

    try {
      if (onConnectToken) {
        const res = await onConnectToken(inputToken.trim(), 'TeleHost Master Bot');
        if (res.success) {
          setTokenTestResult({
            success: true,
            message: `🎉 Connected successfully to @${res.username}! The bot is now online and listening for your .py files.`,
            username: res.username
          });
          setTimeout(() => {
            setShowTokenModal(false);
          }, 1800);
        } else {
          setTokenTestResult({
            success: false,
            message: res.error || 'Failed to authenticate token with Telegram API. Please check your token from @BotFather.'
          });
        }
      } else {
        // Direct API call
        const verifyRes = await fetch('/api/bots/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inputToken.trim() })
        });
        const verifyData = await verifyRes.json();

        if (verifyData.valid) {
          await fetch('/api/bots/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: 'bot_primary',
              name: verifyData.firstName || 'TeleHost Master Bot',
              token: inputToken.trim()
            })
          });
          setTokenTestResult({
            success: true,
            message: `🎉 Connected successfully to @${verifyData.username}!`,
            username: verifyData.username
          });
          onRefresh();
          setTimeout(() => {
            setShowTokenModal(false);
          }, 1800);
        } else {
          setTokenTestResult({
            success: false,
            message: verifyData.error || 'Invalid token. Please obtain a fresh token from @BotFather in Telegram.'
          });
        }
      }
    } catch (err: any) {
      setTokenTestResult({
        success: false,
        message: err.message || 'Connection test failed.'
      });
    } finally {
      setTokenTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/20 p-6 md:p-8">
        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-cyan-500/30 shadow-md shadow-cyan-950/40 cursor-pointer active:scale-95"
                title="Go Back"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>← Back</span>
              </button>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Python Telegram Bot Hosting Engine</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Host Your Python Telegram Bots 24/7 in the Cloud!
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Send your Python bot file (<code className="text-blue-400 font-mono font-semibold">.py</code> or <code className="text-blue-400 font-mono font-semibold">.zip</code>) directly to your Telegram receiver bot. Our cloud runtime instantly launches it as a <b>24/7 background worker process</b>.
          </p>

          {/* Master Bot status pill & Token Connect Button */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {activeMasterBot && activeMasterBot.botUsername && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${isMasterBotLive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
                <span>Telegram Receiver Bot: <strong>@{activeMasterBot.botUsername}</strong></span>
                <a
                  href={`https://t.me/${activeMasterBot.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold underline"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Render 24/7 Anti-Sleep Heartbeat Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Render 24/7 Anti-Sleep: <strong>Active (Every 7m)</strong></span>
            </div>

            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isMasterBotLive ? 'Change Bot Token' : 'Connect Bot Token'}</span>
            </button>

            <button
              onClick={() => setShowTroubleshooter(!showTroubleshooter)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Bot Troubleshooter</span>
            </button>

            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <RotateCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Troubleshooter Drawer (If user encounters "bot not working") */}
      {showTroubleshooter && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="font-bold text-white text-sm">
                3 Steps to Fix Telegram Bot Connection:
              </h3>
            </div>
            <button
              onClick={() => setShowTroubleshooter(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-400">1. Connect Your Bot Token</span>
              <p className="text-slate-300 leading-relaxed">
                Get a token from <strong>@BotFather</strong> in Telegram using <code>/newbot</code> and paste it in the <strong>"Connect Bot Token"</strong> modal.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-blue-400">2. Send /start in Telegram</span>
              <p className="text-slate-300 leading-relaxed">
                Open your bot link (<code>t.me/...</code>) and click the <strong>START</strong> button or send <code>/start</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-emerald-400">3. Send .py or .zip File</span>
              <p className="text-slate-300 leading-relaxed">
                Send your Python bot script in the chat. The cloud runtime will automatically download and execute it!
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-800/60 space-y-1.5">
              <span className="font-bold text-cyan-400">4. Render 24/7 Anti-Sleep</span>
              <p className="text-slate-300 leading-relaxed">
                On Render free tier, our built-in 7m heartbeat keeps your web service awake. Deploy using <code>render.yaml</code> Blueprint!
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-end">
            <button
              onClick={() => {
                setShowTroubleshooter(false);
                setShowTokenModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Connect Your Bot Token Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 3 Step Interactive Workflow Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h3 className="text-sm font-semibold text-white">1. Send your .py Bot file</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Send your <code>bot.py</code> or <code>.zip</code> file to your receiver bot in Telegram.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h3 className="text-sm font-semibold text-white">2. Automatic Cloud Execution</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The server automatically executes <code>python3 bot.py</code> with a dedicated process ID (PID).
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h3 className="text-sm font-semibold text-white">3. Live Logs & Controls</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Monitor live terminal logs, stop, or restart your Python worker processes anytime.
          </p>
        </div>
      </div>

      {/* Deploy Actions Bar */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <span>Host a New Python Bot</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Host files sent via Telegram or deploy scripts directly from this browser screen.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Quick Launch Demo Bot */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Method 1: Demo Script</span>
              <p className="text-xs text-slate-400 mt-1">
                Launch a sample Telegram Echo Bot Worker script in 1 click.
              </p>
            </div>
            <button
              onClick={onDeployTemplate}
              disabled={isDeploying}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isDeploying ? 'Deploying...' : '1-Click Launch Demo Bot'}</span>
            </button>
          </div>

          {/* Upload .py / .zip */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Method 2: File Upload</span>
              <p className="text-xs text-slate-400 mt-1">
                Select a <code>.py</code> or <code>.zip</code> file from your computer.
              </p>
            </div>
            <label className="w-full cursor-pointer py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition flex items-center justify-center gap-2 text-center">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Choose .PY or .ZIP to Host</span>
              <input
                type="file"
                accept=".py,.zip"
                className="hidden"
                onChange={handleFileInput}
                disabled={isDeploying}
              />
            </label>
          </div>

          {/* Direct Code Editor */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Method 3: Code Editor</span>
              <p className="text-xs text-slate-400 mt-1">
                Type or paste Python code directly in browser editor to execute.
              </p>
            </div>
            <button
              onClick={() => setShowCodeEditor(true)}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium text-xs transition flex items-center justify-center gap-2"
            >
              <Code className="w-4 h-4" />
              <span>Open Python Code Editor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Hosted Python Bots List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              <span>Hosted Python Bots</span>
            </h2>
            <p className="text-xs text-slate-400">
              Total {bots.length} Python bots registered in cloud runtime.
            </p>
          </div>
        </div>

        {bots.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <Terminal className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Python Bots Hosted Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Send your <code>.py</code> file to your Telegram Bot or click "1-Click Launch" above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bots.map((bot) => {
              const isRunning = bot.status === 'RUNNING';
              const isError = bot.status === 'ERROR';

              return (
                <div
                  key={bot.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Status & Name */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isRunning
                                ? 'bg-emerald-500 animate-pulse'
                                : isError
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          <h3 className="font-bold text-white text-base leading-tight">
                            {bot.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <p className="text-xs text-slate-400 font-mono">
                            Entry: <span className="text-blue-400 font-semibold">{bot.entryFile}</span>
                          </p>
                          <button
                            onClick={() => handleDownloadBotFile(bot)}
                            disabled={downloadingId === bot.id}
                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-white border border-blue-500/30 transition font-medium shadow-sm cursor-pointer disabled:opacity-50"
                            title={`Download ${bot.entryFile}`}
                          >
                            <Download className="w-3 h-3 text-blue-400" />
                            <span>{downloadingId === bot.id ? 'Downloading...' : 'Download .py'}</span>
                          </button>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase shrink-0 border ${
                          isRunning
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : isError
                            ? 'bg-rose-950 text-rose-400 border-rose-800'
                            : 'bg-amber-950 text-amber-400 border-amber-800'
                        }`}
                      >
                        {bot.status}
                      </span>
                    </div>

                    {/* ID & PID Box */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 truncate font-mono">
                        <span className="text-slate-400">ID:</span>
                        <span className="text-slate-200">{bot.id}</span>
                        {bot.pid && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px]">
                            PID: {bot.pid}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDownloadBotFile(bot)}
                          disabled={downloadingId === bot.id}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 text-xs cursor-pointer"
                          title="Download Script File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(bot.id, bot.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Copy Bot ID"
                        >
                          {copiedId === bot.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                      <span>
                        👤 <strong>@{bot.senderUsername || 'anonymous'}</strong>
                      </span>
                      <span>
                        ⏱️ Started: <strong>{bot.startedAt}</strong>
                      </span>
                      <span>
                        📊 Size: <strong>{bot.fileSizeMB}</strong> MB
                      </span>
                    </div>

                    {/* Last log preview line */}
                    {bot.logs && bot.logs.length > 0 && (
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
                        <span className="text-emerald-400">$ </span>
                        {bot.logs[bot.logs.length - 1]}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedBotForLogs(bot)}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <span>Live Terminal Logs ({bot.logs?.length || 0})</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownloadBotFile(bot)}
                        disabled={downloadingId === bot.id}
                        className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition cursor-pointer"
                        title="Download Bot Script (.py)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {isRunning ? (
                        <>
                          <button
                            onClick={() => onStartBot(bot.id)}
                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition"
                            title="Restart Bot"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onStopBot(bot.id)}
                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition"
                            title="Stop Bot"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onStartBot(bot.id)}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Bot</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedBotForEnv(bot)}
                        className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition"
                        title="Configure Environment Variables (.env)"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteBot(bot.id)}
                        className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                        title="Delete Bot"
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
      </div>

      {/* Real-Time Received User Files Section */}
      {submissions && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <FolderDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">📥 Real-Time Received User Files ({submissions.length})</h3>
                <p className="text-xs text-slate-400">All files sent by Telegram users or uploaded in real-time. Download or delete anytime.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5">File Name</th>
                  <th className="pb-2.5">Sender</th>
                  <th className="pb-2.5">Size</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Details</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-sans text-xs">
                      No files received yet. Send any file, document, photo, video, or script to your Telegram bot to see it appear here live!
                    </td>
                  </tr>
                ) : (
                  submissions.slice(0, 15).map(sub => {
                    const downloadPath = sub.downloadedPath || sub.localFilePath || '';
                    return (
                      <tr key={sub.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-2.5 font-semibold text-slate-100 max-w-[200px] truncate" title={sub.fileName}>
                          {sub.fileName}
                        </td>
                        <td className="py-2.5 text-slate-300 font-sans">
                          @{sub.senderUsername || 'user'}
                        </td>
                        <td className="py-2.5 text-slate-300 tabular-nums">
                          {(sub.fileSizeMB || 0.01).toFixed(2)} MB
                        </td>
                        <td className="py-2.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400 font-sans text-[11px] max-w-[200px] truncate" title={sub.approvalReason || sub.reason || ''}>
                          {sub.approvalReason || sub.reason || 'Received in cloud'}
                        </td>
                        <td className="py-2.5 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            {downloadPath ? (
                              <a
                                href={`/api/bots/download-file?path=${encodeURIComponent(downloadPath)}`}
                                download
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded font-semibold"
                                title="Download File"
                              >
                                <FolderDown className="w-3.5 h-3.5" />
                                <span>Get</span>
                              </a>
                            ) : null}
                            {onDeleteSubmission && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete "${sub.fileName}" permanently from website and server?`)) {
                                    onDeleteSubmission(sub.id);
                                  }
                                }}
                                className="p-1 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded"
                                title="Delete File Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* Connect Telegram Bot Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">
                  Connect Real Telegram Bot Token
                </h3>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectTokenSubmit} className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 space-y-2">
                <span className="font-bold text-blue-300">💡 How to get a Token in 3 Easy Steps:</span>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                  <li>Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold">@BotFather</a> in Telegram and send <code>/newbot</code>.</li>
                  <li>Enter a display name and username for your bot.</li>
                  <li>Copy the <code>123456789:AAF...</code> <strong>HTTP API Token</strong> provided by BotFather and paste it below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Telegram Bot API Token:
                </label>
                <input
                  type="text"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="7192039481:AAFj283_x91209384..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {tokenTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    tokenTestResult.success
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/50 border-rose-800 text-rose-300'
                  }`}
                >
                  {tokenTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>{tokenTestResult.message}</div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={tokenTesting || !inputToken.trim()}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {tokenTesting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying with Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Verify & Go Live</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Terminal Modal */}
      {selectedBotForLogs && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedBotForLogs(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 md:p-6"
        >
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-3.5 md:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 gap-3">
              <div className="flex items-center gap-2.5">
                {/* Prominent Back Button on top left */}
                <button
                  onClick={() => setSelectedBotForLogs(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-cyan-500/30 shadow-md shadow-cyan-950/40 cursor-pointer active:scale-95"
                  title="Back to Bots List (Esc)"
                >
                  <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  <span>← Back to Bots</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  <Terminal className="w-4 h-4 text-blue-400 hidden sm:block" />
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span className="truncate max-w-[200px] sm:max-w-xs">{selectedBotForLogs.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono hidden md:inline">({selectedBotForLogs.id})</span>
                      {selectedBotForLogs.pid && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px]">
                          PID: {selectedBotForLogs.pid}
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadBotFile(selectedBotForLogs)}
                  disabled={downloadingId === selectedBotForLogs.id}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                  title="Download file to computer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{downloadingId === selectedBotForLogs.id ? 'Downloading...' : 'Download File'}</span>
                </button>
                <button
                  onClick={() => onStartBot(selectedBotForLogs.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                  title="Restart bot process"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restart</span>
                </button>
                <button
                  onClick={() => setSelectedBotForLogs(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-4 bg-black/95 font-mono text-xs overflow-y-auto space-y-1 text-slate-200 selection:bg-blue-600">
              {selectedBotForLogs.logs && selectedBotForLogs.logs.length > 0 ? (
                selectedBotForLogs.logs.map((line, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      line.includes('[stderr]') || line.includes('ERROR') || line.includes('EXCEPTION')
                        ? 'text-rose-400'
                        : line.includes('🚀') || line.includes('ONLINE') || line.includes('SUCCESS')
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-600">Terminal output buffer empty. Waiting for process logs...</div>
              )}
            </div>

            {/* Footer with Back Button */}
            <div className="p-3 border-t border-slate-900 bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Streaming live logs &bull; Python 3.10 Runtime</span>
              </div>
              <button
                onClick={() => setSelectedBotForLogs(null)}
                className="px-3.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/10"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Editor Modal */}
      {showCodeEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Deploy Python Script Directly</h3>
              </div>
              <button
                onClick={() => setShowCodeEditor(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Script File Name</label>
                <input
                  type="text"
                  value={customBotName}
                  onChange={(e) => setCustomBotName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-blue-500 outline-none"
                  placeholder="my_bot.py"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Python Code</label>
                <textarea
                  rows={12}
                  value={customBotCode}
                  onChange={(e) => setCustomBotCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-black border border-slate-800 text-xs text-emerald-400 font-mono focus:border-blue-500 outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCodeEditor(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditorDeploy}
                  disabled={isDeploying}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isDeploying ? 'Deploying...' : 'Deploy & Run Bot'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bot Environment Variables Modal */}
      {selectedBotForEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  Environment Variables (.env) &bull; {selectedBotForEnv.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBotForEnv(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-slate-300 space-y-1">
                <span className="font-bold text-indigo-300">💡 Secret Tokens & Config:</span>
                <p className="text-slate-400 leading-relaxed">
                  Pass environment variables like <code>BOT_TOKEN</code>, <code>API_ID</code>, <code>API_HASH</code> to this bot.
                  The process will auto-reload with the new values.
                </p>
              </div>

              {/* Active env list */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">Active Variables:</label>
                {selectedBotForEnv.envVars && Object.keys(selectedBotForEnv.envVars).length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono">
                    {Object.entries(selectedBotForEnv.envVars).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-indigo-400 font-bold">{k}</span>
                        <span className="text-slate-400 truncate max-w-xs">{v ? '••••••••' + v.slice(-4) : '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 text-center">
                    No custom environment variables configured yet.
                  </div>
                )}
              </div>

              {/* Add / Update form */}
              <form onSubmit={handleSaveEnv} className="space-y-3 pt-2 border-t border-slate-800">
                <span className="block font-semibold text-slate-200">Add or Update Variable:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="KEY (e.g. BOT_TOKEN)"
                    value={envKeyInput}
                    onChange={(e) => setEnvKeyInput(e.target.value.toUpperCase())}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-indigo-500 outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={envValueInput}
                    onChange={(e) => setEnvValueInput(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBotForEnv(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEnv || !envKeyInput.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingEnv ? 'Saving...' : 'Save & Reload'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Real Bot Connection & Diagnostics Modal */}
      <TelegramConnectModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        activeBot={activeMasterBot}
        onConnectToken={async (token, name) => {
          if (onConnectToken) {
            const res = await onConnectToken(token, name);
            if (res.success) {
              onRefresh();
            }
            return res;
          }
          return { success: false, error: 'Connection handler not attached' };
        }}
      />
    </div>
  );
};
