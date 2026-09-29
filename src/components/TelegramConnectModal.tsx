import React, { useState } from 'react';
import { 
  X, 
  Bot, 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Send, 
  Terminal, 
  ShieldCheck, 
  HelpCircle, 
  Zap, 
  Trash2, 
  Activity,
  Copy,
  Check
} from 'lucide-react';
import { HostedBot } from '../types';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBot?: HostedBot;
  onConnectToken: (token: string, name?: string) => Promise<{ success: boolean; username?: string; error?: string }>;
  onDisconnectBot?: (botId: string) => Promise<void>;
}

export const TelegramConnectModal: React.FC<TelegramConnectModalProps> = ({
  isOpen,
  onClose,
  activeBot,
  onConnectToken,
  onDisconnectBot
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'diagnostics' | 'guide'>('connect');
  const [tokenInput, setTokenInput] = useState('');
  const [botNameInput, setBotNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string; username?: string } | null>(null);

  // Diagnostics state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [isClearingWebhook, setIsClearingWebhook] = useState(false);
  const [webhookClearMsg, setWebhookClearMsg] = useState<string | null>(null);

  // Test message state
  const [testChatId, setTestChatId] = useState('');
  const [testMsgText, setTestMsgText] = useState('👋 Hello from TeleHost! Bot connection is online and working properly.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentToken = tokenInput.trim() || (activeBot?.botToken && !activeBot.botToken.includes('aafj283') ? activeBot.botToken : '');
  const isCurrentlyConnected = activeBot && activeBot.status === 'RUNNING' && !activeBot.botToken.includes('aafj283') && !activeBot.botToken.includes('123456');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToUse = tokenInput.trim();
    if (!tokenToUse) {
      setConnectionResult({ success: false, message: 'Please paste your Telegram Bot API token.' });
      return;
    }

    setIsSubmitting(true);
    setConnectionResult(null);

    try {
      const res = await onConnectToken(tokenToUse, botNameInput.trim() || undefined);
      if (res.success) {
        setConnectionResult({
          success: true,
          message: `🎉 Connected successfully to @${res.username}! Bot is now active and ready.`,
          username: res.username
        });
        localStorage.setItem('telehost_bot_token', tokenToUse);
        if (res.username) {
          localStorage.setItem('telehost_bot_username', res.username);
        }
      } else {
        setConnectionResult({
          success: false,
          message: res.error || 'Connection failed. Please check token format or diagnostics tab.'
        });
      }
    } catch (err: any) {
      setConnectionResult({
        success: false,
        message: err.message || 'Error occurred while contacting Telegram API.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const runDiagnostics = async () => {
    const tokenToTest = currentToken;
    if (!tokenToTest) {
      setDiagResult({ valid: false, error: 'Enter a bot token above first to run diagnostics.' });
      return;
    }

    setIsDiagnosing(true);
    setDiagResult(null);
    setWebhookClearMsg(null);

    try {
      const res = await fetch('/api/bots/diagnose-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest })
      });
      const data = await res.json();
      setDiagResult(data);
    } catch (err: any) {
      setDiagResult({ valid: false, error: err.message || 'Failed to communicate with diagnostic endpoint.' });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleClearWebhook = async () => {
    const tokenToTest = currentToken;
    if (!tokenToTest) return;

    setIsClearingWebhook(true);
    setWebhookClearMsg(null);

    try {
      const res = await fetch('/api/bots/clear-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest })
      });
      const data = await res.json();
      if (data.success) {
        setWebhookClearMsg('✅ Webhook purged and old conflicting updates dropped! You can now start live polling.');
        // Re-run diagnostics
        runDiagnostics();
      } else {
        setWebhookClearMsg(`❌ Failed to clear webhook: ${data.message}`);
      }
    } catch (err: any) {
      setWebhookClearMsg(`❌ Webhook clear error: ${err.message}`);
    } finally {
      setIsClearingWebhook(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToUse = currentToken;
    if (!tokenToUse) {
      setTestSendResult({ success: false, message: 'Bot token is missing.' });
      return;
    }
    if (!testChatId.trim()) {
      setTestSendResult({ success: false, message: 'Please enter your Telegram Chat ID or User ID (e.g. from @userinfobot).' });
      return;
    }

    setIsSendingTest(true);
    setTestSendResult(null);

    try {
      const res = await fetch('/api/bots/send-test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenToUse,
          chatId: testChatId.trim(),
          message: testMsgText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestSendResult({
          success: true,
          message: `✅ Message sent successfully (Message ID: ${data.messageId})! Check your Telegram app.`
        });
      } else {
        setTestSendResult({
          success: false,
          message: data.error || 'Failed to send message. Make sure you have clicked /start on your bot first so it has permission to message you.'
        });
      }
    } catch (err: any) {
      setTestSendResult({ success: false, message: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Telegram Bot Connection & Diagnostics</h2>
                {isCurrentlyConnected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE CONNECTED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    ACTION REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Connect your real Telegram Bot token from @BotFather to receive & host Python bots 24/7.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-5 gap-4">
          <button
            onClick={() => setActiveTab('connect')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'connect'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            1. Connect Bot Token
          </button>
          <button
            onClick={() => {
              setActiveTab('diagnostics');
              if (currentToken && !diagResult) runDiagnostics();
            }}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'diagnostics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            2. Diagnostics & Test Ping
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            3. BotFather Guide
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-sm">
          
          {/* TAB 1: CONNECT */}
          {activeTab === 'connect' && (
            <div className="space-y-5">
              {isCurrentlyConnected && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-emerald-300 text-sm">
                      Bot is currently LIVE & Connected!
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Username: <code className="text-emerald-400 font-mono font-bold">@{activeBot?.botUsername}</code>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <a
                        href={`https://t.me/${activeBot?.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Open @{activeBot?.botUsername} in Telegram
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('diagnostics');
                          runDiagnostics();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        Run Diagnostics
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Telegram Bot API Token (from @BotFather)</span>
                    <span className="text-[11px] text-slate-400 font-normal">Format: <code>123456789:ABCdef...</code></span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      placeholder={isCurrentlyConnected ? `Current: ${activeBot?.botToken.slice(0, 10)}...` : "e.g. 7192039481:AAFj283_x91209384109283-abc"}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    {tokenInput && (
                      <button
                        type="button"
                        onClick={() => setTokenInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Bot Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={botNameInput}
                    onChange={e => setBotNameInput(e.target.value)}
                    placeholder="My Telegram Python Host Bot"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {connectionResult && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    connectionResult.success 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                    {connectionResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div>{connectionResult.message}</div>
                      {connectionResult.success && connectionResult.username && (
                        <div className="mt-2">
                          <a
                            href={`https://t.me/${connectionResult.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 underline font-semibold hover:text-emerald-300"
                          >
                            👉 Click here to test your bot on Telegram: @{connectionResult.username}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || !tokenInput.trim()}
                    className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying with Telegram API...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        Connect & Start Telegram Bot
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('guide')}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors border border-slate-700 flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    How to get token?
                  </button>
                </div>
              </form>

              {/* Quick Info Checklist */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  What happens once connected:
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-slate-400 pl-1">
                  <li>Your bot starts listening for Telegram commands (<code>/start</code>, <code>/mybots</code>, <code>/logs</code>).</li>
                  <li>Any <code>.py</code> file or <code>.zip</code> archive you send to the bot will be automatically hosted and executed 24/7.</li>
                  <li>You will receive instant status, PID numbers, and live output logs directly inside your Telegram chat.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: DIAGNOSTICS & TEST PING */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200 text-xs">Live Telegram API Health Check</div>
                  <div className="text-[11px] text-slate-400">Tests Token validity, Telegram Gateway latency & Webhook conflicts</div>
                </div>
                <button
                  type="button"
                  onClick={runDiagnostics}
                  disabled={isDiagnosing}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  {isDiagnosing ? 'Checking...' : 'Run Diagnostics'}
                </button>
              </div>

              {diagResult && (
                <div className="space-y-3">
                  {diagResult.valid ? (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Telegram API: 200 OK (Latency: {diagResult.latencyMs}ms)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                          ID: {diagResult.botDetails?.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Bot Username</div>
                          <div className="font-mono font-bold text-slate-100">@{diagResult.botDetails?.username}</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <div className="text-[10px] text-slate-400">First Name</div>
                          <div className="font-semibold text-slate-100">{diagResult.botDetails?.firstName}</div>
                        </div>
                      </div>

                      {/* Webhook Status */}
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Webhook Status:</span>
                          {diagResult.webhook?.url ? (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Custom Webhook Active ({diagResult.webhook.url})
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Clean (Ready for Long Polling)
                            </span>
                          )}
                        </div>

                        {diagResult.webhook?.pendingUpdateCount > 0 && (
                          <div className="text-[11px] text-slate-400">
                            Pending updates in queue: <span className="text-amber-400 font-bold">{diagResult.webhook.pendingUpdateCount}</span>
                          </div>
                        )}

                        {diagResult.webhook?.url && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={handleClearWebhook}
                              disabled={isClearingWebhook}
                              className="w-full py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isClearingWebhook ? 'Purging Webhook...' : '1-Click Purge Webhook & Enable Polling'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-rose-400 font-semibold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Telegram Connection Diagnostic Failed</span>
                      </div>
                      <div className="text-rose-200 pl-6">{diagResult.error}</div>
                      
                      <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="font-semibold text-slate-200">Suggested Fixes:</div>
                        <div>1. Verify token format: it should look like <code>123456789:ABCdef...</code></div>
                        <div>2. Open Telegram, message <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-400 underline">@BotFather</a> and send <code>/token</code> to get a fresh token.</div>
                        <div>3. Ensure no other bot scripts or local computers are polling with this same token simultaneously (causes 409 Conflict).</div>
                      </div>
                    </div>
                  )}

                  {webhookClearMsg && (
                    <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/40 text-xs text-blue-300">
                      {webhookClearMsg}
                    </div>
                  )}
                </div>
              )}

              {/* Send Test Message Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-400" />
                    Send Instant Test Message to your Telegram
                  </div>
                  <span className="text-[10px] text-slate-400">Verifies Bot Sending Capability</span>
                </div>

                <form onSubmit={handleSendTestMessage} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Your Telegram Chat ID / User ID
                      </label>
                      <input
                        type="text"
                        value={testChatId}
                        onChange={e => setTestChatId(e.target.value)}
                        placeholder="e.g. 192837465 or -100123456"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Test Message Content
                      </label>
                      <input
                        type="text"
                        value={testMsgText}
                        onChange={e => setTestMsgText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-slate-400">
                      💡 Don't know your ID? Open <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@userinfobot</a> in Telegram.
                    </div>
                    <button
                      type="submit"
                      disabled={isSendingTest || !testChatId.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSendingTest ? 'Sending...' : 'Send Test Ping'}
                    </button>
                  </div>
                </form>

                {testSendResult && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    testSendResult.success 
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}>
                    {testSendResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BOTFATHER GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs space-y-2">
                <div className="font-bold text-blue-300 text-sm">
                  📖 How to get a Telegram Bot Token in 30 Seconds:
                </div>
                <p className="text-slate-300">
                  Follow these 4 simple steps to generate a 100% free Telegram Bot token:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px] font-bold">1</span>
                      Open @BotFather in Telegram
                    </div>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] underline"
                    >
                      Open @BotFather
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-400">
                    Search for <code>@BotFather</code> in your Telegram app (look for the verified blue checkmark) and click <b>START</b>.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px] font-bold">2</span>
                      Send /newbot command
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('/newbot', 'newbot')}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] bg-slate-800 px-2 py-0.5 rounded"
                    >
                      {copiedText === 'newbot' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedText === 'newbot' ? 'Copied' : 'Copy /newbot'}
                    </button>
                  </div>
                  <p className="text-slate-400">
                    Type <code>/newbot</code> and follow BotFather's prompts:
                  </p>
                  <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1 text-[11px]">
                    <li>Enter a display name (e.g. <code>My Python Host Bot</code>)</li>
                    <li>Enter a username ending in <code>bot</code> (e.g. <code>my_cloud_host_bot</code>)</li>
                  </ul>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px] font-bold">3</span>
                    Copy the HTTP API Token
                  </div>
                  <p className="text-slate-400">
                    BotFather will send you a message with your token:
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 select-all">
                    7192039481:AAFj283_x91209384109283-abc
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px] font-bold">4</span>
                    Paste in Tab 1 & Click "Connect"
                  </div>
                  <p className="text-slate-400">
                    Switch back to <b>"1. Connect Bot Token"</b> tab, paste your token, and click Connect!
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  Go to Connect Tab & Paste Token
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted cloud runtime · 24/7 background worker</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors border border-slate-700 flex items-center gap-1.5"
          >
            🔙 Cancel & Back
          </button>
        </div>

      </div>
    </div>
  );
};
