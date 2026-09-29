import React, { useState } from 'react';
import { HostedProject, HostedBot } from '../types';
import { 
  Globe, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Upload, 
  FolderArchive, 
  Sparkles, 
  FileCode, 
  Monitor, 
  Smartphone, 
  Tablet, 
  X, 
  RefreshCw,
  Send,
  Zap,
  Info,
  ArrowLeft
} from 'lucide-react';

interface HostedProjectsViewProps {
  projects: HostedProject[];
  bots: HostedBot[];
  onRefresh: () => void;
  onDeleteProject: (id: string) => Promise<void>;
  onDeployTemplate: (templateId: 'portfolio' | 'game') => Promise<void>;
  onUploadZip: (file: File) => Promise<void>;
  onNavigateBack?: () => void;
}

export const HostedProjectsView: React.FC<HostedProjectsViewProps> = ({
  projects,
  bots,
  onRefresh,
  onDeleteProject,
  onDeployTemplate,
  onUploadZip,
  onNavigateBack
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<HostedProject | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'portfolio' | 'game'>('portfolio');

  const activeBot = bots.find(b => b.status === 'RUNNING') || bots[0];

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeployTemplateClick = async () => {
    setIsDeploying(true);
    try {
      await onDeployTemplate(selectedTemplate);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsDeploying(true);
      try {
        await onUploadZip(e.target.files[0]);
      } finally {
        setIsDeploying(false);
        e.target.value = '';
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-sm"
                title="Return to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>🔙 Back to Dashboard</span>
              </button>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Telegram Web Project Hosting Engine</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Telegram Website Hosting
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Users send their <span className="text-indigo-400 font-semibold">.zip</span> or <span className="text-indigo-400 font-semibold">.html</span> file to your Telegram bot. The bot instantly unzips and hosts it, returning a live web link in seconds!
          </p>

          {/* Quick Telegram Bot Info Pill */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {activeBot && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 shadow-sm">
                <span className={`w-2 h-2 rounded-full ${activeBot.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>Active Bot: <strong>@{activeBot.botUsername || 'MyBot'}</strong></span>
                {activeBot.botUsername && (
                  <a
                    href={`https://t.me/${activeBot.botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold underline"
                  >
                    <span>Open in Telegram</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Projects</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Step Telegram Hosting Workflow Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h3 className="text-sm font-semibold text-white">Send /start to Bot</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Open your bot in Telegram and click or send <code>/start</code>.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h3 className="text-sm font-semibold text-white">Upload .ZIP or .HTML File</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Share your website archive or HTML file in the bot chat.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h3 className="text-sm font-semibold text-white">Get Live Web Link Instantly!</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The bot extracts your site and replies with a live <code>https://.../sites/..</code> URL.
          </p>
        </div>
      </div>

      {/* Deploy Tester Card (Browser Direct Deploy) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Web Direct Deploy</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Host templates or your custom site files directly from this browser dashboard in 1 click.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Quick Template Deploy */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Method 1: Starter Templates</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedTemplate('portfolio')}
                className={`flex-1 p-3 rounded-lg border text-left text-xs transition ${
                  selectedTemplate === 'portfolio'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-slate-200">Portfolio Template</div>
                <div className="text-[11px] text-slate-400">Tailwind Modern Portfolio</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('game')}
                className={`flex-1 p-3 rounded-lg border text-left text-xs transition ${
                  selectedTemplate === 'game'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-slate-200">Space Tap Game</div>
                <div className="text-[11px] text-slate-400">Retro Canvas Web Game</div>
              </button>
            </div>

            <button
              onClick={handleDeployTemplateClick}
              disabled={isDeploying}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isDeploying ? 'Deploying...' : '1-Click Deploy Template'}</span>
            </button>
          </div>

          {/* Upload Custom ZIP / HTML */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Method 2: Upload Custom Files</span>
              <p className="text-xs text-slate-400 mt-1">
                Select a <code>.zip</code> archive or <code>.html</code> file from your computer.
              </p>
            </div>

            <label className="w-full cursor-pointer py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition flex items-center justify-center gap-2 text-center">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Choose .ZIP or .HTML to Upload</span>
              <input
                type="file"
                accept=".zip,.html,.htm"
                className="hidden"
                onChange={handleFileInput}
                disabled={isDeploying}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Hosted Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              <span>Live Hosted Websites</span>
            </h2>
            <p className="text-xs text-slate-400">
              Total {projects.length} website instances active in cloud.
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <FolderArchive className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Web Projects Hosted Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Send a .zip file to your Telegram Bot or click "1-Click Deploy" above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar with Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="font-bold text-white text-base leading-tight">
                          {project.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {project.description || project.originalFileName}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-semibold tracking-wide uppercase shrink-0">
                      ONLINE
                    </span>
                  </div>

                  {/* Public Link Box */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:underline truncate font-mono"
                    >
                      {project.liveUrl}
                    </a>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(project.liveUrl, project.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Copy Link"
                      >
                        {copiedId === project.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition"
                        title="Open in New Tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Meta Details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                    <span>
                      👤 <strong>@{project.senderUsername || 'anonymous'}</strong>
                    </span>
                    <span>
                      📁 <strong>{project.filesCount}</strong> files
                    </span>
                    <span>
                      📊 <strong>{project.fileSizeMB}</strong> MB
                    </span>
                    <span>
                      ⏱️ {project.createdAt}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewProject(project)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center gap-1.5"
                  >
                    <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                    <span>In-App Preview</span>
                  </button>

                  <button
                    onClick={() => onDeleteProject(project.id)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      {previewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">{previewProject.name}</h3>
                  <a
                    href={previewProject.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>{previewProject.liveUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Desktop View"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    previewDevice === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tablet View"
                >
                  <Tablet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobile View"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setPreviewProject(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Iframe Viewport */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-white ${
                  previewDevice === 'mobile'
                    ? 'w-[375px]'
                    : previewDevice === 'tablet'
                    ? 'w-[768px]'
                    : 'w-full'
                }`}
              >
                <iframe
                  src={previewProject.liveUrl}
                  title={previewProject.name}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
