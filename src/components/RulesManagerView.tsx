import React, { useState } from 'react';
import { HostedBot, ApprovalRuleSet } from '../types';
import { Sliders, Sparkles, Save, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface RulesManagerViewProps {
  bots: HostedBot[];
  selectedBotId: string;
  onSelectBot: (botId: string) => void;
  onUpdateBotRules: (botId: string, updatedRules: ApprovalRuleSet) => void;
  onNavigateBack?: () => void;
}

export const RulesManagerView: React.FC<RulesManagerViewProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onUpdateBotRules,
  onNavigateBack
}) => {
  const currentBot = bots.find(b => b.id === selectedBotId) || bots[0];
  const [rules, setRules] = useState<ApprovalRuleSet>(currentBot.rules);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [naturalLangInput, setNaturalLangInput] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Sync state when selected bot changes
  React.useEffect(() => {
    if (currentBot) {
      setRules(currentBot.rules);
    }
  }, [selectedBotId, currentBot]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBotRules(currentBot.id, rules);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAiOptimizeRules = async () => {
    if (!naturalLangInput.trim()) return;
    setIsOptimizing(true);

    try {
      const res = await fetch('/api/optimize-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rulesDescription: naturalLangInput }),
      });

      if (!res.ok) throw new Error('Failed to optimize rules');
      const data = await res.json();

      setRules(prev => ({
        ...prev,
        maxFileSizeMB: data.maxFileSizeMB || prev.maxFileSizeMB,
        allowedExtensions: data.allowedExtensions || prev.allowedExtensions,
        allowedMimeTypes: data.allowedMimeTypes || prev.allowedMimeTypes,
        requireChannelMembership: data.requireChannelMembership ?? prev.requireChannelMembership,
        channelUsername: data.channelUsername || prev.channelUsername,
        allowedKeywords: data.autoApproveKeywords || prev.allowedKeywords,
        customRejectionMessage: data.rejectionMessage || prev.customRejectionMessage
      }));

      setNaturalLangInput('');
    } catch (err) {
      console.error('Error optimizing rules:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Selector Header */}
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
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Approval Rules Manager</h2>
            <p className="text-xs text-slate-400">Define automated file download criteria & admin escalation policies</p>
          </div>
        </div>

        <select
          value={selectedBotId}
          onChange={e => onSelectBot(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-purple-500"
        >
          {bots.map(b => (
            <option key={b.id} value={b.id}>
              Configuring Rules: {b.name} (@{b.botUsername})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Rules Configurator */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 text-xs">
          {/* Section 1: File Size & Type Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              File Size & Extensions Policy
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Max Auto-Approval File Size (MB)</label>
                <input
                  type="number"
                  value={rules.maxFileSizeMB}
                  onChange={e => setRules({ ...rules, maxFileSizeMB: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Allowed File Extensions (Comma Separated)</label>
                <input
                  type="text"
                  value={rules.allowedExtensions.join(', ')}
                  onChange={e => setRules({ ...rules, allowedExtensions: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                  placeholder=".pdf, .zip, .mp4, .apk"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="autoRejectExecutables"
                checked={rules.autoRejectExecutables}
                onChange={e => setRules({ ...rules, autoRejectExecutables: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0"
              />
              <label htmlFor="autoRejectExecutables" className="text-slate-300 font-medium">
                Auto-Reject High-Risk Executable Files (.exe, .bat, .cmd, .msi, .sh)
              </label>
            </div>
          </div>

          {/* Section 2: Channel Membership & User Verification */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Telegram Channel Join & User Verification
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requireChannelMembership"
                  checked={rules.requireChannelMembership}
                  onChange={e => setRules({ ...rules, requireChannelMembership: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0"
                />
                <label htmlFor="requireChannelMembership" className="text-slate-300 font-medium">
                  Require Channel Subscription (Check Telethon GetParticipantRequest)
                </label>
              </div>

              {rules.requireChannelMembership && (
                <div>
                  <label className="block text-slate-400 mb-1">Required Telegram Channel Username</label>
                  <input
                    type="text"
                    value={rules.channelUsername}
                    onChange={e => setRules({ ...rules, channelUsername: e.target.value })}
                    placeholder="@MyChannel"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="pt-2">
              <label className="block text-slate-300 font-medium mb-1">Trusted Admin Usernames (Instant Bypass Whitelist)</label>
              <input
                type="text"
                value={rules.trustedUsernames.join(', ')}
                onChange={e => setRules({ ...rules, trustedUsernames: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                placeholder="@admin1, @supervisor"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
              />
            </div>
          </div>

          {/* Section 3: Caption Keywords & Admin Escalation */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Caption Tag Rules & Rejection Response
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requireCaptionKeyword"
                  checked={rules.requireCaptionKeyword}
                  onChange={e => setRules({ ...rules, requireCaptionKeyword: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0"
                />
                <label htmlFor="requireCaptionKeyword" className="text-slate-300 font-medium">
                  Require Specific Keyword Tags in File Caption
                </label>
              </div>

              {rules.requireCaptionKeyword && (
                <div>
                  <label className="block text-slate-400 mb-1">Allowed Keywords (Comma Separated)</label>
                  <input
                    type="text"
                    value={rules.allowedKeywords.join(', ')}
                    onChange={e => setRules({ ...rules, allowedKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                    placeholder="#download, #report, submit"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Custom User Rejection Message</label>
              <input
                type="text"
                value={rules.customRejectionMessage}
                onChange={e => setRules({ ...rules, customRejectionMessage: e.target.value })}
                placeholder="Sorry, your file does not meet auto-approval criteria."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {savedSuccess ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Rules saved successfully! Updated Telethon python generator config.
              </span>
            ) : (
              <span className="text-xs text-slate-400">Click save to update bot configuration</span>
            )}

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Save Approval Rules
            </button>
          </div>
        </form>

        {/* Right Column: AI Rules Assistant */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-100">AI Rule Assistant</h3>
            </div>
            <p className="text-xs text-slate-400">
              Describe your desired file download & approval policy in plain English. Gemini AI will auto-configure your rules!
            </p>

            <div className="space-y-3">
              <textarea
                value={naturalLangInput}
                onChange={e => setNaturalLangInput(e.target.value)}
                placeholder="e.g. 'Only accept PDF and ZIP files under 50MB from members of @MyTechChannel, and require hashtag #submit in caption.'"
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 resize-none font-sans"
              />

              <button
                type="button"
                onClick={handleAiOptimizeRules}
                disabled={isOptimizing || !naturalLangInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Optimizing Rules...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Auto-Configure Rules
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
