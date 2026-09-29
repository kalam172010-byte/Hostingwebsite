import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bot, 
  Save, 
  Trash2, 
  KeyRound, 
  FolderDown, 
  ShieldCheck, 
  AlertTriangle,
  ArrowLeft,
  Check,
  RefreshCw,
  Zap
} from 'lucide-react';
import { HostedBot } from '../types';

interface EditBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  bot: HostedBot | null;
  onSaveBot: (updatedBot: HostedBot) => Promise<void>;
  onDeleteBot: (botId: string) => Promise<void>;
}

export const EditBotModal: React.FC<EditBotModalProps> = ({
  isOpen,
  onClose,
  bot,
  onSaveBot,
  onDeleteBot
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [adminChatId, setAdminChatId] = useState('');
  const [downloadPath, setDownloadPath] = useState('');
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(100);
  const [allowedExtensions, setAllowedExtensions] = useState('');
  const [customRejectionMessage, setCustomRejectionMessage] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (bot) {
      setName(bot.name || '');
      setUsername(bot.botUsername || '');
      setToken(bot.botToken || '');
      setAdminChatId(bot.adminChatId || '');
      setDownloadPath(bot.downloadPath || './downloads/vault');
      setMaxFileSizeMB(bot.rules?.maxFileSizeMB || 100);
      setAllowedExtensions(bot.rules?.allowedExtensions?.join(', ') || '.py, .zip, .pdf, .mp4');
      setCustomRejectionMessage(bot.rules?.customRejectionMessage || 'Only Python files (.py) or .zip archives are supported.');
      setErrorMsg('');
      setSuccessMsg('');
      setShowDeleteConfirm(false);
    }
  }, [bot, isOpen]);

  if (!isOpen || !bot) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Bot Name cannot be empty.');
      return;
    }
    if (!token.trim()) {
      setErrorMsg('Telegram Bot Token is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedBot: HostedBot = {
        ...bot,
        name: name.trim(),
        botUsername: username.trim().replace(/^@/, '') || bot.botUsername,
        botToken: token.trim(),
        adminChatId: adminChatId.trim(),
        downloadPath: downloadPath.trim() || './downloads/vault',
        rules: {
          ...bot.rules,
          maxFileSizeMB: Number(maxFileSizeMB) || 100,
          allowedExtensions: allowedExtensions
            .split(',')
            .map(ext => ext.trim())
            .filter(ext => ext.length > 0)
            .map(ext => ext.startsWith('.') ? ext : `.${ext}`),
          customRejectionMessage: customRejectionMessage.trim()
        }
      };

      await onSaveBot(updatedBot);
      setSuccessMsg('✅ Telegram Bot configuration updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save bot changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteBot(bot.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete bot.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with clear Back / Close buttons */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Go back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>🔙 Back</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-slate-100">
                Edit Telegram Bot Settings
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
          >
            <X className="w-5 h-5" />
            <span className="sr-only">Cancel</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Bot Basic Info */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="text-xs font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>1. Basic Bot Identity & Name</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. My Telegram Host Bot"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Bot Username (@username)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. MMTESTINGBOT_BOT"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Token & Telegram API Key */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>2. Telegram Bot API Token (@BotFather)</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Bot Token
              </label>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="7192039481:AAFj283_x91209384109283..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                💡 You can change your Telegram bot token anytime here. The new token will connect automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Admin Chat ID (Optional)
                </label>
                <input
                  type="text"
                  value={adminChatId}
                  onChange={e => setAdminChatId(e.target.value)}
                  placeholder="e.g. 192837465 or -100123456"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Download Directory Path
                </label>
                <input
                  type="text"
                  value={downloadPath}
                  onChange={e => setDownloadPath(e.target.value)}
                  placeholder="./downloads/vault"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Rules & Limits */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>3. File Upload Rules & Allowed Formats</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  value={maxFileSizeMB}
                  onChange={e => setMaxFileSizeMB(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Allowed Extensions
                </label>
                <input
                  type="text"
                  value={allowedExtensions}
                  onChange={e => setAllowedExtensions(e.target.value)}
                  placeholder=".py, .zip, .pdf, .mp4"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Custom Rejection Message
              </label>
              <input
                type="text"
                value={customRejectionMessage}
                onChange={e => setCustomRejectionMessage(e.target.value)}
                placeholder="Only Python files (.py) or .zip archives are supported."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Danger Zone: Delete Bot */}
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Telegram Bot</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Permanently stop polling and delete this Telegram bot configuration.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
                >
                  Delete Bot
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Buttons: Clear Back / Cancel & Save */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>🔙 Cancel & Back</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>💾 Save Bot Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
