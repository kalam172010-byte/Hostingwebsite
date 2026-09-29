import React, { useState } from 'react';
import { HostedBot, ApprovalRuleSet } from '../types';
import { generateTelethonProjectFiles } from '../utils/telethonGenerator';
import { Bot, Sparkles, X, Shield, ArrowRight } from 'lucide-react';

interface NewBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBot: (bot: HostedBot) => void;
}

export const NewBotModal: React.FC<NewBotModalProps> = ({ isOpen, onClose, onAddBot }) => {
  const [name, setName] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [botToken, setBotToken] = useState('');
  const [adminChatId, setAdminChatId] = useState('-100123456789');
  const [downloadPath, setDownloadPath] = useState('./downloads');
  const [usePreset, setUsePreset] = useState<'web_hosting' | 'media' | 'doc' | 'strict'>('web_hosting');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    let defaultRules: ApprovalRuleSet;
    if (usePreset === 'web_hosting') {
      defaultRules = {
        maxFileSizeMB: 100,
        allowedExtensions: ['.zip', '.html', '.htm', '.css', '.js', '.png', '.jpg', '.pdf'],
        allowedMimeTypes: ['application/zip', 'text/html', 'application/pdf'],
        requireChannelMembership: false,
        channelUsername: '',
        requireCaptionKeyword: false,
        allowedKeywords: ['#host', 'deploy', 'website'],
        autoApproveTrustedUsers: true,
        trustedUsernames: ['admin'],
        adminApprovalForUnknownUsers: false,
        autoRejectExecutables: true,
        customRejectionMessage: 'Only web project archives (.zip) and HTML files under 100MB are supported.',
        destinationDirectory: downloadPath || './hosted_sites',
        dispatchToWebhook: false,
        webhookUrl: ''
      };
    } else if (usePreset === 'doc') {

      defaultRules = {
        maxFileSizeMB: 25,
        allowedExtensions: ['.pdf', '.docx', '.xlsx'],
        allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        requireChannelMembership: false,
        channelUsername: '',
        requireCaptionKeyword: true,
        allowedKeywords: ['#report', '#doc', 'invoice'],
        autoApproveTrustedUsers: true,
        trustedUsernames: ['admin'],
        adminApprovalForUnknownUsers: false,
        autoRejectExecutables: true,
        customRejectionMessage: 'Only document files under 25MB with valid tags are accepted.',
        destinationDirectory: downloadPath || './downloads',
        dispatchToWebhook: false,
        webhookUrl: ''
      };
    } else if (usePreset === 'strict') {
      defaultRules = {
        maxFileSizeMB: 10,
        allowedExtensions: ['.pdf', '.png', '.jpg'],
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
        requireChannelMembership: true,
        channelUsername: '@MyPrivateChannel',
        requireCaptionKeyword: false,
        allowedKeywords: [],
        autoApproveTrustedUsers: true,
        trustedUsernames: ['admin', 'supervisor'],
        adminApprovalForUnknownUsers: true,
        autoRejectExecutables: true,
        customRejectionMessage: 'Strict mode: Channel membership required and files undergo manual admin approval.',
        destinationDirectory: downloadPath || './downloads',
        dispatchToWebhook: false,
        webhookUrl: ''
      };
    } else {
      defaultRules = {
        maxFileSizeMB: 100,
        allowedExtensions: ['.pdf', '.zip', '.mp4', '.mkv', '.apk', '.epub'],
        allowedMimeTypes: ['application/pdf', 'video/mp4', 'application/zip'],
        requireChannelMembership: true,
        channelUsername: '@MyChannel',
        requireCaptionKeyword: false,
        allowedKeywords: ['download', '#approve'],
        autoApproveTrustedUsers: true,
        trustedUsernames: ['admin_user'],
        adminApprovalForUnknownUsers: true,
        autoRejectExecutables: true,
        customRejectionMessage: 'Files over 100MB or forbidden extensions are rejected.',
        destinationDirectory: downloadPath || './downloads',
        dispatchToWebhook: true,
        webhookUrl: ''
      };
    }

    const newBot: HostedBot = {
      id: `bot_${Date.now()}`,
      name: name.trim() || 'New Telethon Downloader',
      botUsername: botUsername.replace('@', '').trim() || 'telethon_auto_bot',
      status: 'RUNNING',
      apiId: apiId.trim() || '2849104',
      apiHash: apiHash.trim() || 'e92f81a7b0394851239f01239a',
      botToken: botToken.trim() || '7192039481:AAFj283_x91209384109283-abc',
      sessionString: '',
      adminChatId: adminChatId.trim() || '-100123456789',
      downloadPath: downloadPath.trim() || './downloads',
      rules: defaultRules,
      stats: {
        totalReceived: 0,
        autoApproved: 0,
        pendingAdmin: 0,
        rejected: 0,
        totalDownloadedMB: 0
      },
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      lastActive: 'Just now'
    };

    // Pre-generate Python files
    newBot.generatedCode = generateTelethonProjectFiles(newBot);

    onAddBot(newBot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Create New Telethon Bot</h2>
              <p className="text-xs text-slate-400">Configure credentials & approval template for Python Telethon engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleCreate} className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Preset Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Select Approval Logic Preset
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setUsePreset('web_hosting')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  usePreset === 'web_hosting'
                    ? 'border-indigo-500 bg-indigo-500/10 text-slate-100 ring-1 ring-indigo-500/30'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs mb-1 text-indigo-400">🚀 Web Project Host</div>
                <p className="text-[11px] text-slate-400 leading-tight">Hosts websites from .zip & .html files. Live URL generated.</p>
              </button>

              <button
                type="button"
                onClick={() => setUsePreset('media')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  usePreset === 'media'
                    ? 'border-blue-500 bg-blue-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs mb-1">Media Vault (100MB)</div>
                <p className="text-[11px] text-slate-400 leading-tight">Auto-approves media & documents. Channel verification ON.</p>
              </button>

              <button
                type="button"
                onClick={() => setUsePreset('doc')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  usePreset === 'doc'
                    ? 'border-blue-500 bg-blue-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs mb-1">Document Filter (25MB)</div>
                <p className="text-[11px] text-slate-400 leading-tight">Strict PDF/Doc only. Requires caption keyword tags like #report.</p>
              </button>

              <button
                type="button"
                onClick={() => setUsePreset('strict')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  usePreset === 'strict'
                    ? 'border-blue-500 bg-blue-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs mb-1">Strict Admin Review</div>
                <p className="text-[11px] text-slate-400 leading-tight">Forces manual admin approval inline button review for unknown senders.</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bot Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. MediaVault Auto Downloader"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bot Username</label>
              <input
                type="text"
                required
                value={botUsername}
                onChange={e => setBotUsername(e.target.value)}
                placeholder="e.g. my_telethon_bot"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
          </div>

          {/* Telegram Credentials */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-200">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Telethon API Credentials
              </span>
              <span className="text-[11px] text-slate-400">Get from my.telegram.org & @BotFather</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">API ID</label>
                <input
                  type="text"
                  value={apiId}
                  onChange={e => setApiId(e.target.value)}
                  placeholder="2849104"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">API Hash</label>
                <input
                  type="text"
                  value={apiHash}
                  onChange={e => setApiHash(e.target.value)}
                  placeholder="e92f81a7b0394851239f01239a"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Bot Token</label>
              <input
                type="text"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                placeholder="7192039481:AAFj283_x91209384109283-abc"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Admin Chat ID</label>
                <input
                  type="text"
                  value={adminChatId}
                  onChange={e => setAdminChatId(e.target.value)}
                  placeholder="-100123456789"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target Download Directory</label>
                <input
                  type="text"
                  value={downloadPath}
                  onChange={e => setDownloadPath(e.target.value)}
                  placeholder="./downloads/vault"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              🔙 Cancel & Back
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Telethon Bot
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
