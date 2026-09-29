import React, { useState } from 'react';
import JSZip from 'jszip';
import { HostedBot } from '../types';
import { generateTelethonProjectFiles } from '../utils/telethonGenerator';
import { 
  Code2, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  FileCode, 
  FolderDown, 
  Bot, 
  Terminal,
  RefreshCw,
  Send,
  HelpCircle,
  FileText,
  ArrowLeft
} from 'lucide-react';

interface CodeStudioViewProps {
  bots: HostedBot[];
  selectedBotId: string;
  onSelectBot: (botId: string) => void;
  onUpdateBotCode: (botId: string, updatedCode: any) => void;
  onNavigateBack?: () => void;
}

export const CodeStudioView: React.FC<CodeStudioViewProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onUpdateBotCode,
  onNavigateBack
}) => {
  const currentBot = bots.find(b => b.id === selectedBotId) || bots[0];
  const [activeTab, setActiveTab] = useState<'mainPy' | 'configPy' | 'requirementsTxt' | 'dockerfile' | 'systemdService' | 'readmeMd'>('mainPy');
  const [copied, setCopied] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Fallback if bot code not pre-generated
  const files = currentBot?.generatedCode || generateTelethonProjectFiles(currentBot);

  const getActiveCode = () => {
    switch (activeTab) {
      case 'mainPy': return files.mainPy;
      case 'configPy': return files.configPy;
      case 'requirementsTxt': return files.requirementsTxt;
      case 'dockerfile': return files.dockerfile;
      case 'systemdService': return files.systemdService || '';
      case 'readmeMd': return files.readmeMd;
      default: return files.mainPy;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    zip.file('main.py', files.mainPy);
    zip.file('config.py', files.configPy);
    zip.file('requirements.txt', files.requirementsTxt);
    zip.file('Dockerfile', files.dockerfile);
    zip.file('systemd.service', files.systemdService || '');
    zip.file('README.md', files.readmeMd);
    zip.file('.env.example', `TELEGRAM_API_ID="${currentBot.apiId}"\nTELEGRAM_API_HASH="${currentBot.apiHash}"\nTELEGRAM_BOT_TOKEN="${currentBot.botToken}"\nADMIN_CHAT_ID="${currentBot.adminChatId}"\nDOWNLOAD_DIR="${currentBot.downloadPath}"\n`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBot.name.toLowerCase().replace(/\s+/g, '_')}_telethon_project.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefineWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setAiError('');

    try {
      const res = await fetch('/api/generate-bot-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          botName: currentBot.name,
          rules: currentBot.rules,
          targetStorage: currentBot.downloadPath,
          adminChatId: currentBot.adminChatId
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate code from server endpoint');
      }

      const data = await res.json();
      if (data.mainPy) {
        onUpdateBotCode(currentBot.id, data);
        setAiPrompt('');
      } else {
        throw new Error('Invalid response format received from AI server');
      }
    } catch (err: any) {
      console.error('AI code generation error:', err);
      setAiError(err.message || 'Error communicating with Gemini Telethon Code Generator.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Selector Bar */}
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
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Telethon Python Code Studio</h2>
            <p className="text-xs text-slate-400">Inspect, customize, and export full Telethon MTProto project code</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedBotId}
            onChange={e => onSelectBot(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {bots.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} (@{b.botUsername})
              </option>
            ))}
          </select>

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Complete Project ZIP
          </button>
        </div>
      </div>

      {/* Code Studio Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Code Editor & Viewer */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* File Tabs Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 pt-3 overflow-x-auto">
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setActiveTab('mainPy')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'mainPy'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                main.py
              </button>

              <button
                onClick={() => setActiveTab('configPy')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'configPy'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                config.py
              </button>

              <button
                onClick={() => setActiveTab('requirementsTxt')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'requirementsTxt'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                requirements.txt
              </button>

              <button
                onClick={() => setActiveTab('dockerfile')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'dockerfile'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Dockerfile
              </button>

              <button
                onClick={() => setActiveTab('systemdService')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'systemdService'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                systemd.service
              </button>

              <button
                onClick={() => setActiveTab('readmeMd')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'readmeMd'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                README.md
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors mb-2"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          {/* Code Viewer Display */}
          <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto min-h-[480px] max-h-[600px] text-slate-200 leading-relaxed">
            <pre className="whitespace-pre">
              {getActiveCode()}
            </pre>
          </div>
        </div>

        {/* Right Column: Gemini AI Code Customizer */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">AI Telethon Refiner</h3>
            </div>
            <p className="text-xs text-slate-400">
              Prompt Gemini 3.8 Flash to add custom Telethon event handlers, cloud upload hooks, or specialized approval rules.
            </p>

            <form onSubmit={handleRefineWithAI} className="space-y-3">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g., 'Add a Google Drive upload step after downloading', or 'Add a watermark step for incoming photos', or 'Send Discord webhook alert on rejection'."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-sans"
              />

              {aiError && (
                <p className="text-xs text-red-400 font-sans">{aiError}</p>
              )}

              <button
                type="submit"
                disabled={isGenerating || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Python Code...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Refine Code with Gemini AI
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
              <span className="font-semibold text-slate-300 block">Suggested Quick Prompts:</span>
              <button
                onClick={() => setAiPrompt("Add forced channel join check using Telethon GetParticipantRequest with custom error button.")}
                className="block text-left text-blue-400 hover:underline"
              >
                • Force Telegram channel membership check
              </button>
              <button
                onClick={() => setAiPrompt("Add speed throttling and custom download progress bar callback using Telethon download_media.")}
                className="block text-left text-blue-400 hover:underline"
              >
                • Detailed download progress & speed metrics
              </button>
              <button
                onClick={() => setAiPrompt("Add S3 bucket or webhook POST dispatch after file finishes downloading.")}
                className="block text-left text-blue-400 hover:underline"
              >
                • Webhook / Cloud Storage auto-dispatch
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Terminal className="w-4 h-4 text-purple-400" />
              Telethon Architecture
            </div>
            <p className="text-[11px] leading-relaxed">
              Uses asynchronous Telegram client routines (<code className="text-blue-300 font-mono">TelegramClient</code>) over MTProto for fast file transfers, progress callbacks, and inline keyboard controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
