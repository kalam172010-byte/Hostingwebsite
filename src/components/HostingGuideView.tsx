import React, { useState } from 'react';
import { Server, Terminal, Shield, BookOpen, ExternalLink, Copy, Check, Cpu, CheckCircle2, ArrowLeft } from 'lucide-react';

interface HostingGuideViewProps {
  onNavigateBack?: () => void;
}

export const HostingGuideView: React.FC<HostingGuideViewProps> = ({ onNavigateBack }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const ubuntuSetupCmds = `# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Python 3.11, pip, and virtual environment
sudo apt install python3-pip python3-venv git -y

# 3. Create bot workspace directory
mkdir -p /opt/telethon_bot && cd /opt/telethon_bot

# 4. Extract generated ZIP files here (main.py, config.py, requirements.txt)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Test run the Telethon bot
python3 main.py`;

  const systemdServiceCmd = `sudo nano /etc/systemd/system/telethon_bot.service

# Paste the following into systemd service:
[Unit]
Description=TeleHost Telethon Auto-Downloader Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/telethon_bot
ExecStart=/opt/telethon_bot/venv/bin/python3 main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Reload and start service:
sudo systemctl daemon-reload
sudo systemctl enable telethon_bot
sudo systemctl start telethon_bot
sudo systemctl status telethon_bot`;

  const dockerCmds = `# Build Docker image
docker build -t telethon-downloader-bot .

# Run Docker container with mounted downloads directory
docker run -d \\
  --name my-telethon-bot \\
  --restart=always \\
  -v /var/telethon_downloads:/app/downloads \\
  --env-file .env \\
  telethon-downloader-bot`;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-sm shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>🔙 Back to Dashboard</span>
            </button>
          )}
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Telegram Telethon Bot Hosting Guide</h2>
            <p className="text-xs text-slate-400">Step-by-step instructions for running your Telethon bot on Linux VPS, Docker, or Cloud services</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Step 1: Telegram Credentials Guide */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2">
            <Shield className="w-4 h-4 text-blue-400" />
            1. Telegram Credentials Setup
          </div>

          <div className="space-y-3 text-slate-300">
            <div>
              <h4 className="font-semibold text-slate-200 mb-1">A. Get API ID & API Hash</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                Telethon uses Telegram's native MTProto protocol which requires official API keys.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                <li>Log in to <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">my.telegram.org <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Click <strong>API Development Tools</strong></li>
                <li>Enter app title & short name</li>
                <li>Copy <strong>api_id</strong> and <strong>api_hash</strong></li>
              </ol>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-1">B. Get Bot Token from BotFather</h4>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                <li>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">@BotFather <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Send command <code className="text-blue-300 font-mono">/newbot</code></li>
                <li>Choose bot name and username ending in <code className="text-blue-300 font-mono">_bot</code></li>
                <li>Copy the HTTP API Token</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 2: Linux VPS / Systemd Deployment */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Terminal className="w-4 h-4 text-emerald-400" />
              2. Deploy on Linux VPS (Ubuntu / Debian / DigitalOcean)
            </div>
            <button
              onClick={() => copyToClipboard(ubuntuSetupCmds, 'ubuntu')}
              className="flex items-center gap-1 px-2.5 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              {copiedCmd === 'ubuntu' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCmd === 'ubuntu' ? 'Copied' : 'Copy Bash Script'}
            </button>
          </div>

          <div className="bg-slate-950 font-mono text-[11px] p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300 leading-relaxed">
            <pre className="whitespace-pre">{ubuntuSetupCmds}</pre>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 text-xs">Run background process with Systemd Service</h4>
              <button
                onClick={() => copyToClipboard(systemdServiceCmd, 'systemd')}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                {copiedCmd === 'systemd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy Systemd Conf
              </button>
            </div>
            <div className="bg-slate-950 font-mono text-[11px] p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300 leading-relaxed max-h-[160px]">
              <pre className="whitespace-pre">{systemdServiceCmd}</pre>
            </div>
          </div>
        </div>

        {/* Step 3: Docker Deployment */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Cpu className="w-4 h-4 text-purple-400" />
              3. Docker Container Deployment
            </div>
            <button
              onClick={() => copyToClipboard(dockerCmds, 'docker')}
              className="flex items-center gap-1 px-2.5 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              {copiedCmd === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCmd === 'docker' ? 'Copied' : 'Copy Docker Commands'}
            </button>
          </div>

          <div className="bg-slate-950 font-mono text-[11px] p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300 leading-relaxed">
            <pre className="whitespace-pre">{dockerCmds}</pre>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong>Production Storage Tip:</strong> Always mount a host directory (e.g. <code className="text-white font-mono">-v /var/telethon_downloads:/app/downloads</code>) so downloaded files persist on your server even if the Docker container is restarted or updated!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
