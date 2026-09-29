import React, { useState, useEffect } from 'react';
import { HostedBot, FileSubmission, BotLog, ApprovalRuleSet, HostedProject, HostedPythonBot } from './types';
import { INITIAL_BOTS, INITIAL_SUBMISSIONS, INITIAL_LOGS } from './data/initialBots';
import { generateTelethonProjectFiles } from './utils/telethonGenerator';
import { DashboardView } from './components/DashboardView';
import { CodeStudioView } from './components/CodeStudioView';
import { SimulatorView } from './components/SimulatorView';
import { RulesManagerView } from './components/RulesManagerView';
import { HostingGuideView } from './components/HostingGuideView';
import { HostedProjectsView } from './components/HostedProjectsView';
import { HostedPythonBotsView } from './components/HostedPythonBotsView';
import { NewBotModal } from './components/NewBotModal';
import { TelegramConnectModal } from './components/TelegramConnectModal';
import { EditBotModal } from './components/EditBotModal';
import { 
  Bot, 
  Code2, 
  Terminal, 
  Sliders, 
  Server, 
  Plus, 
  Globe,
  TerminalSquare,
  KeyRound,
  Zap,
  Activity,
  Menu,
  X,
  ArrowLeft,
  ChevronLeft,
  Home
} from 'lucide-react';

export default function App() {
  const [bots, setBots] = useState<HostedBot[]>(INITIAL_BOTS);
  const [submissions, setSubmissions] = useState<FileSubmission[]>(INITIAL_SUBMISSIONS);
  const [logs, setLogs] = useState<BotLog[]>(INITIAL_LOGS);
  const [hostedProjects, setHostedProjects] = useState<HostedProject[]>([]);
  const [hostedPythonBots, setHostedPythonBots] = useState<HostedPythonBot[]>([]);

  // Default active tab: 'python_bots' for Python Telegram Bot Hosting
  type NavOption = 'python_bots' | 'hosted_sites' | 'dashboard' | 'code' | 'simulator' | 'rules' | 'guide';
  const [activeNav, setActiveNavState] = useState<NavOption>('python_bots');
  const [navHistory, setNavHistory] = useState<NavOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>(INITIAL_BOTS[0].id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isEditBotModalOpen, setIsEditBotModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<HostedBot | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Seamless navigation with history stack
  const setActiveNav = (nextNav: NavOption, pushHistory = true) => {
    if (nextNav === activeNav) return;
    if (pushHistory) {
      setNavHistory(prev => [...prev, activeNav]);
      try {
        window.history.pushState({ nav: nextNav }, '', `#${nextNav}`);
      } catch (_) {}
    }
    setActiveNavState(nextNav);
  };

  const handleGoBack = () => {
    if (navHistory.length > 0) {
      const prevNav = navHistory[navHistory.length - 1];
      setNavHistory(h => h.slice(0, -1));
      setActiveNavState(prevNav);
      try {
        window.history.replaceState({ nav: prevNav }, '', `#${prevNav}`);
      } catch (_) {}
    } else if (activeNav !== 'python_bots') {
      setActiveNavState('python_bots');
    }
  };

  // Sync with browser native back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.nav) {
        setActiveNavState(e.state.nav);
      } else {
        const hash = window.location.hash.replace('#', '') as any;
        if (hash && ['python_bots', 'hosted_sites', 'dashboard', 'code', 'simulator', 'rules', 'guide'].includes(hash)) {
          setActiveNavState(hash);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto reconnect if token stored in localStorage and not already running
  useEffect(() => {
    const savedToken = localStorage.getItem('telehost_bot_token');
    if (savedToken && savedToken.includes(':')) {
      fetch('/api/bots/status')
        .then(res => res.json())
        .then(data => {
          const hasActiveBot = data.activeBots && data.activeBots.some((b: any) => b.status === 'RUNNING');
          if (!hasActiveBot) {
            handleConnectMasterBotToken(savedToken, 'TeleHost Primary Bot');
          }
        })
        .catch(() => {});
    }
  }, []);

  // Fetch hosted python bots
  const fetchHostedPythonBots = async () => {
    try {
      const res = await fetch('/api/python-bots');
      if (res.ok) {
        const data = await res.json();
        if (data.bots) {
          setHostedPythonBots(data.bots);
        }
      }
    } catch (e) {
      console.error('Error fetching hosted python bots:', e);
    }
  };

  // Fetch hosted web projects
  const fetchHostedProjects = async () => {
    try {
      const res = await fetch('/api/hosted-projects');
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          setHostedProjects(data.projects);
        }
      }
    } catch (e) {
      console.error('Error fetching hosted projects:', e);
    }
  };

  // Poll backend for real Telegram bot events, submissions and hosted python bots
  useEffect(() => {
    fetchHostedPythonBots();
    fetchHostedProjects();

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/bots/status');
        if (res.ok) {
          const data = await res.json();
          if (data.activeBots && Array.isArray(data.activeBots) && data.activeBots.length > 0) {
            setBots(prev => {
              return prev.map(b => {
                const live = data.activeBots.find((ab: any) => ab.id === b.id || (ab.token && ab.token === b.botToken));
                if (live) {
                  return {
                    ...b,
                    status: live.status,
                    botUsername: live.botUsername || b.botUsername,
                    name: live.name || b.name,
                    botToken: live.token || b.botToken
                  };
                }
                return b;
              });
            });
          }
          if (data.submissions && data.submissions.length > 0) {
            setSubmissions(prev => {
              const ids = new Set(prev.map(s => s.id));
              const newItems = data.submissions.filter((s: any) => !ids.has(s.id));
              return newItems.length > 0 ? [...newItems, ...prev] : prev;
            });
          }
          if (data.logs && data.logs.length > 0) {
            setLogs(prev => {
              const ids = new Set(prev.map(l => l.id));
              const newLogs = data.logs.filter((l: any) => !ids.has(l.id));
              return newLogs.length > 0 ? [...newLogs, ...prev] : prev;
            });
          }
          if (data.hostedProjects) {
            setHostedProjects(data.hostedProjects);
          }
          if (data.hostedPythonBots) {
            setHostedPythonBots(data.hostedPythonBots);
          }
        }
      } catch (e) {
        // Silently handle polling glitch
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Python Bot Controls: Start / Restart
  const handleStartPythonBot = async (id: string) => {
    try {
      const res = await fetch(`/api/python-bots/${id}/start`, { method: 'POST' });
      if (res.ok) {
        await fetchHostedPythonBots();
      }
    } catch (e) {
      console.error('Error starting python bot:', e);
    }
  };

  // Python Bot Controls: Stop
  const handleStopPythonBot = async (id: string) => {
    try {
      const res = await fetch(`/api/python-bots/${id}/stop`, { method: 'POST' });
      if (res.ok) {
        await fetchHostedPythonBots();
      }
    } catch (e) {
      console.error('Error stopping python bot:', e);
    }
  };

  // Python Bot Controls: Delete
  const handleDeletePythonBot = async (id: string) => {
    try {
      const res = await fetch(`/api/python-bots/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHostedPythonBots(prev => prev.filter(b => b.id !== id));
      }
    } catch (e) {
      console.error('Error deleting python bot:', e);
    }
  };

  // Deploy Sample Python Bot Worker
  const handleDeployPythonTemplate = async () => {
    try {
      const res = await fetch('/api/python-bots/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'echo_bot',
          name: 'Telegram Echo Bot Worker (Python)'
        })
      });
      const data = await res.json();
      if (data.success && data.bot) {
        setHostedPythonBots(prev => [data.bot, ...prev]);
      }
    } catch (e) {
      console.error('Error deploying template bot:', e);
    }
  };

  // Upload Custom .py or .zip Python Bot from Browser
  const handleUploadPythonFile = async (file: File) => {
    try {
      const isZip = file.name.endsWith('.zip');
      const reader = new FileReader();

      reader.onload = async () => {
        const result = reader.result as string;
        let payload: any = {
          name: file.name,
          fileName: file.name
        };

        if (isZip) {
          const base64 = result.split(',')[1];
          payload.contentBase64 = base64;
        } else {
          payload.code = result;
        }

        const res = await fetch('/api/python-bots/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success && data.bot) {
          setHostedPythonBots(prev => [data.bot, ...prev]);
        }
      };

      if (isZip) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    } catch (e) {
      console.error('Error uploading python file:', e);
    }
  };

  // Deploy Code from in-browser Python Code Editor
  const handleDeployPythonCode = async (name: string, code: string) => {
    try {
      const res = await fetch('/api/python-bots/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fileName: name,
          code
        })
      });
      const data = await res.json();
      if (data.success && data.bot) {
        setHostedPythonBots(prev => [data.bot, ...prev]);
      }
    } catch (e) {
      console.error('Error deploying code:', e);
    }
  };

  // Master Telegram Bot Control (Start / Stop)
  const handleToggleBotStatus = async (botId: string) => {
    const target = bots.find(b => b.id === botId);
    if (!target) return;

    // If starting and no token, open the connect modal directly
    const storedToken = localStorage.getItem('telehost_bot_token');
    const tokenToUse = (target.botToken || storedToken || '').trim();

    if (target.status !== 'RUNNING' && (!tokenToUse || !tokenToUse.includes(':'))) {
      setSelectedBotId(botId);
      setIsTelegramModalOpen(true);
      return;
    }

    const nextStatus = target.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';

    if (nextStatus === 'RUNNING') {
      try {
        const res = await fetch('/api/bots/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: target.id,
            name: target.name,
            token: tokenToUse,
            adminChatId: target.adminChatId,
            downloadPath: target.downloadPath,
            rules: target.rules
          })
        });

        const data = await res.json();
        if (data.success) {
          const newLog: BotLog = {
            id: `log_${Date.now()}`,
            botId: target.id,
            botName: target.name,
            timestamp: new Date().toLocaleTimeString(),
            level: 'SUCCESS',
            category: 'TELETHON',
            message: `Real Telegram Bot @${data.username || target.botUsername} is now active and receiving Python bot files!`
          };
          setLogs(prevLogs => [newLog, ...prevLogs]);
        } else {
          setIsTelegramModalOpen(true);
          return;
        }
      } catch (err) {
        console.error('Error starting live bot:', err);
      }
    } else {
      try {
        await fetch('/api/bots/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: target.id })
        });
      } catch (err) {
        console.error('Error stopping live bot:', err);
      }
    }

    setBots(prev => prev.map(b => b.id === botId ? { ...b, status: nextStatus, botToken: tokenToUse || b.botToken } : b));
  };

  // Connect & Authenticate Real Bot Token
  const handleConnectMasterBotToken = async (token: string, name?: string) => {
    try {
      const verifyRes = await fetch('/api/bots/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() })
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.valid) {
        return { success: false, error: verifyData.error || 'Invalid Telegram Bot API Token.' };
      }

      const primaryBotId = bots[0]?.id || 'bot_master_primary';
      const botDisplayName = name || verifyData.firstName || 'Telegram Master Bot';

      const startRes = await fetch('/api/bots/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: primaryBotId,
          name: botDisplayName,
          token: token.trim(),
          rules: bots[0]?.rules || {}
        })
      });
      const startData = await startRes.json();

      if (startData.success) {
        setBots(prev => prev.map(b => {
          if (b.id === primaryBotId || prev.length === 1) {
            return {
              ...b,
              status: 'RUNNING',
              botUsername: startData.username || verifyData.username || b.botUsername,
              name: botDisplayName,
              botToken: token.trim()
            };
          }
          return b;
        }));

        const newLog: BotLog = {
          id: `log_${Date.now()}`,
          botId: primaryBotId,
          botName: botDisplayName,
          timestamp: new Date().toLocaleTimeString(),
          level: 'SUCCESS',
          category: 'TELETHON',
          message: `Telegram Bot @${startData.username || verifyData.username} connected successfully and is now active 24/7!`
        };
        setLogs(prev => [newLog, ...prev]);

        return { success: true, username: startData.username || verifyData.username };
      } else {
        return { success: false, error: startData.error || 'Failed to start bot process' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  };

  // Save edited Telegram Bot configuration
  const handleSaveBot = async (updatedBot: HostedBot) => {
    setBots(prev => {
      const exists = prev.some(b => b.id === updatedBot.id);
      if (exists) {
        return prev.map(b => b.id === updatedBot.id ? updatedBot : b);
      }
      return [...prev, updatedBot];
    });

    if (updatedBot.botToken) {
      localStorage.setItem('telehost_bot_token', updatedBot.botToken);
    }

    try {
      await fetch('/api/bots/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updatedBot.id,
          name: updatedBot.name,
          token: updatedBot.botToken,
          adminChatId: updatedBot.adminChatId,
          downloadPath: updatedBot.downloadPath,
          rules: updatedBot.rules
        })
      });
    } catch (err) {
      console.error('Error updating bot config:', err);
    }
  };

  // Delete Master Bot
  const handleDeleteMasterBot = async (botId: string) => {
    try {
      await fetch('/api/bots/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: botId })
      });
    } catch (_) {}

    setBots(prev => prev.filter(b => b.id !== botId));
  };

  // Add New Bot
  const handleAddBot = async (newBot: HostedBot) => {
    setBots(prev => [newBot, ...prev]);
    setSelectedBotId(newBot.id);

    try {
      const res = await fetch('/api/bots/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newBot.id,
          name: newBot.name,
          token: newBot.botToken,
          adminChatId: newBot.adminChatId,
          downloadPath: newBot.downloadPath,
          rules: newBot.rules
        })
      });

      const data = await res.json();
      const newLog: BotLog = {
        id: `log_${Date.now()}`,
        botId: newBot.id,
        botName: newBot.name,
        timestamp: new Date().toLocaleTimeString(),
        level: data.success ? 'SUCCESS' : 'WARN',
        category: 'TELETHON',
        message: data.success 
          ? `Live Telegram Master Bot @${data.username || newBot.botUsername} started! Send .py or .zip to host your bot.`
          : `Registered bot config. Add valid Telegram Bot Token to receive live Telegram files.`
      };
      setLogs(prevLogs => [newLog, ...prevLogs]);
    } catch (err) {
      console.error('Error starting new bot live:', err);
    }
  };

  // Update Bot Rules
  const handleUpdateBotRules = (botId: string, updatedRules: ApprovalRuleSet) => {
    setBots(prev => prev.map(b => {
      if (b.id === botId) {
        const updatedBot = { ...b, rules: updatedRules };
        updatedBot.generatedCode = generateTelethonProjectFiles(updatedBot);
        return updatedBot;
      }
      return b;
    }));
  };

  // Update Code
  const handleUpdateBotCode = (botId: string, updatedCode: any) => {
    setBots(prev => prev.map(b => {
      if (b.id === botId) {
        return { ...b, generatedCode: updatedCode };
      }
      return b;
    }));
  };

  // Simulator Events
  const handleNewSubmission = (submission: FileSubmission) => {
    setSubmissions(prev => [submission, ...prev]);
  };

  const handleUpdateSubmissionStatus = (submissionId: string, status: 'COMPLETED' | 'REJECTED' | 'APPROVED', reason?: string) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id === submissionId) {
        return {
          ...sub,
          status,
          approvalReason: reason || sub.approvalReason,
          downloadProgress: status === 'COMPLETED' ? 100 : sub.downloadProgress
        };
      }
      return sub;
    }));
  };

  // Delete Hosted Web Site
  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/hosted-projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHostedProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) {
      console.error('Error deleting project:', e);
    }
  };

  // Deploy Web Project Template
  const handleDeployTemplate = async (templateId: 'portfolio' | 'game') => {
    try {
      const res = await fetch('/api/hosted-projects/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          name: templateId === 'portfolio' ? 'Modern Developer Portfolio' : 'Retro Space Tap Game'
        })
      });
      const data = await res.json();
      if (data.success && data.project) {
        setHostedProjects(prev => [data.project, ...prev]);
      }
    } catch (e) {
      console.error('Error deploying template:', e);
    }
  };

  // Upload Web Project Zip
  const handleUploadZip = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');
        
        let bodyPayload: any = {
          name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          fileName: file.name
        };

        if (isHtml) {
          bodyPayload.htmlContent = result;
        } else {
          const base64 = result.split(',')[1];
          bodyPayload.contentBase64 = base64;
        }

        const res = await fetch('/api/hosted-projects/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        const data = await res.json();
        if (data.success && data.project) {
          setHostedProjects(prev => [data.project, ...prev]);
        }
      };

      if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (e) {
      console.error('Error uploading file:', e);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      
      {/* Liquid Glass Ambient Mesh Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] animate-liquid-mesh" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-500/15 rounded-full blur-[130px] animate-liquid-mesh" style={{ animationDelay: '-5s' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-500/15 rounded-full blur-[120px] animate-liquid-mesh" style={{ animationDelay: '-9s' }} />
      </div>

      {/* Top Bar Header (Liquid Glassmorphism) */}
      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo / Wordmark */}
          <a href="#" onClick={() => setActiveNav('python_bots')} className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-cyan-500/20">
              <TerminalSquare className="w-4 h-4" />
            </span>
            <span className="bg-gradient-to-r from-white via-cyan-100 to-blue-300 bg-clip-text text-transparent">TeleHost</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-900/60 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl text-xs font-semibold shadow-inner">
            <button
              onClick={() => setActiveNav('python_bots')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'python_bots'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-300" />
              <span>Python Bots</span>
              {hostedPythonBots.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px]">
                  {hostedPythonBots.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('hosted_sites')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'hosted_sites'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-300" />
              <span>Web Sites</span>
              {hostedProjects.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 text-[10px]">
                  {hostedProjects.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'dashboard'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-amber-300" />
              <span>Master Bots</span>
            </button>

            <button
              onClick={() => setActiveNav('code')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'code'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-purple-300" />
              <span>Code Studio</span>
            </button>

            <button
              onClick={() => setActiveNav('simulator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'simulator'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-300" />
              <span>Simulator</span>
            </button>

            <button
              onClick={() => setActiveNav('rules')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'rules'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-300" />
              <span>Rules</span>
            </button>

            <button
              onClick={() => setActiveNav('guide')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeNav === 'guide'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-cyan-300" />
              <span>Guide</span>
            </button>
          </nav>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            {bots[0] && bots[0].status === 'RUNNING' && bots[0].botToken ? (
              <button
                onClick={() => setIsTelegramModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/50 transition-all shadow-md shadow-emerald-950/50"
                title="Telegram Bot is Live - Click for diagnostics or test ping"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono font-bold">@{bots[0].botUsername}</span>
                <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.2 rounded-full border border-emerald-500/30">LIVE</span>
              </button>
            ) : (
              <button
                onClick={() => setIsTelegramModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold transition-all shadow-lg shadow-amber-500/25 animate-pulse"
                title="Connect your Telegram Bot Token from @BotFather"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Connect Bot</span>
              </button>
            )}

            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-white/10 transition-colors"
              title="Telegram Connection Diagnostics"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl transition-all shadow-md shadow-cyan-500/20 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              New Bot
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-200 transition-colors"
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Drawer Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden pt-3 pb-2 border-t border-white/10 mt-3 space-y-1.5 animate-in slide-in-from-top duration-200">
            <button
              onClick={() => { setActiveNav('python_bots'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'python_bots' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Python Bots</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-mono text-cyan-300">{hostedPythonBots.length}</span>
            </button>

            <button
              onClick={() => { setActiveNav('hosted_sites'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'hosted_sites' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Web Sites</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-mono text-indigo-300">{hostedProjects.length}</span>
            </button>

            <button
              onClick={() => { setActiveNav('dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'dashboard' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-amber-400" />
                <span>Master Bots</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveNav('code'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'code' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span>Python Code Studio</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveNav('simulator'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'simulator' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Live Chat Simulator</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveNav('rules'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'rules' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Approval Rules Manager</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveNav('guide'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeNav === 'guide' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Hosting Guide</span>
              </div>
            </button>
          </div>
        )}
      </header>

      {/* Universal Sticky Page Header & Back Bar */}
      <div className="sticky top-[57px] z-30 bg-slate-950/80 backdrop-blur-lg border-b border-white/10 px-4 md:px-6 py-2.5 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Prominent Back Button */}
            <button
              onClick={handleGoBack}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                navHistory.length > 0 || activeNav !== 'python_bots'
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-cyan-950 hover:to-blue-900 text-cyan-300 border-cyan-500/40 shadow-cyan-950/40 cursor-pointer active:scale-95 hover:border-cyan-400'
                  : 'bg-slate-900/40 text-slate-500 border-white/5 cursor-not-allowed opacity-50'
              }`}
              title="Go Back to Previous Page"
              disabled={navHistory.length === 0 && activeNav === 'python_bots'}
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>← Back</span>
            </button>

            {/* Breadcrumb Navigation Trail */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <button 
                onClick={() => setActiveNav('python_bots')}
                className="hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium"
              >
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Home</span>
              </button>
              <ChevronLeft className="w-3.5 h-3.5 rotate-180 text-slate-600" />
              <span className="text-cyan-300 font-bold flex items-center gap-1.5 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                {activeNav === 'python_bots' && <><span>🐍</span> Python Telegram Bots</>}
                {activeNav === 'hosted_sites' && <><span>🌐</span> Web Site Hosting</>}
                {activeNav === 'dashboard' && <><span>🤖</span> Master Bots Dashboard</>}
                {activeNav === 'code' && <><span>💻</span> Python Code Studio</>}
                {activeNav === 'simulator' && <><span>⚡</span> Live Chat Simulator</>}
                {activeNav === 'rules' && <><span>⚙️</span> Approval Rules Manager</>}
                {activeNav === 'guide' && <><span>📖</span> VPS & Hosting Guide</>}
              </span>
            </div>
          </div>

          {/* Quick Home Return Button */}
          {activeNav !== 'python_bots' && (
            <button
              onClick={() => setActiveNav('python_bots')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-white/10 shadow-sm"
              title="Return to Home (Python Bots)"
            >
              <Home className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20 lg:pb-6">
        {activeNav === 'python_bots' && (
          <HostedPythonBotsView
            bots={hostedPythonBots}
            masterBots={bots}
            onRefresh={fetchHostedPythonBots}
            onStartBot={handleStartPythonBot}
            onStopBot={handleStopPythonBot}
            onDeleteBot={handleDeletePythonBot}
            onDeployTemplate={handleDeployPythonTemplate}
            onUploadFile={handleUploadPythonFile}
            onDeployCode={handleDeployPythonCode}
            onConnectToken={handleConnectMasterBotToken}
            onNavigateBack={handleGoBack}
          />
        )}

        {activeNav === 'hosted_sites' && (
          <HostedProjectsView
            projects={hostedProjects}
            bots={bots}
            onRefresh={fetchHostedProjects}
            onDeleteProject={handleDeleteProject}
            onDeployTemplate={handleDeployTemplate}
            onUploadZip={handleUploadZip}
            onNavigateBack={handleGoBack}
          />
        )}

        {activeNav === 'dashboard' && (
          <DashboardView
            bots={bots}
            submissions={submissions}
            logs={logs}
            onToggleBotStatus={handleToggleBotStatus}
            onSelectBotForCode={bot => {
              setSelectedBotId(bot.id);
              setActiveNav('code');
            }}
            onSelectBotForRules={bot => {
              setSelectedBotId(bot.id);
              setActiveNav('rules');
            }}
            onSelectBotForSimulator={bot => {
              setSelectedBotId(bot.id);
              setActiveNav('simulator');
            }}
            onOpenCreateModal={() => setIsModalOpen(true)}
            onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
            onEditBot={bot => {
              setEditingBot(bot);
              setIsEditBotModalOpen(true);
            }}
            onDeleteBot={handleDeleteMasterBot}
          />
        )}

        {activeNav === 'code' && (
          <CodeStudioView
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={setSelectedBotId}
            onUpdateBotCode={handleUpdateBotCode}
            onNavigateBack={handleGoBack}
          />
        )}

        {activeNav === 'simulator' && (
          <SimulatorView
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={setSelectedBotId}
            onNewSubmission={handleNewSubmission}
            onUpdateSubmissionStatus={handleUpdateSubmissionStatus}
            onNavigateBack={handleGoBack}
          />
        )}

        {activeNav === 'rules' && (
          <RulesManagerView
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={setSelectedBotId}
            onUpdateBotRules={handleUpdateBotRules}
            onNavigateBack={handleGoBack}
          />
        )}

        {activeNav === 'guide' && (
          <HostingGuideView onNavigateBack={handleGoBack} />
        )}
      </main>

      {/* Floating Glass Bottom Quick Nav Bar for Mobile Phone */}
      <nav className="fixed bottom-3 left-3 right-3 z-40 lg:hidden glass-card rounded-2xl p-1.5 flex items-center justify-around text-xs shadow-2xl border border-white/20">
        {(navHistory.length > 0 || activeNav !== 'python_bots') && (
          <button
            onClick={handleGoBack}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-cyan-300 font-bold bg-cyan-950/80 border border-cyan-500/40"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px]">Back</span>
          </button>
        )}

        <button
          onClick={() => setActiveNav('python_bots')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
            activeNav === 'python_bots' ? 'text-cyan-400 font-bold bg-white/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[10px]">Python</span>
        </button>

        <button
          onClick={() => setActiveNav('hosted_sites')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
            activeNav === 'hosted_sites' ? 'text-indigo-400 font-bold bg-white/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span className="text-[10px]">Sites</span>
        </button>

        <button
          onClick={() => setActiveNav('dashboard')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
            activeNav === 'dashboard' ? 'text-amber-400 font-bold bg-white/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => setIsTelegramModalOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-cyan-400 font-bold bg-cyan-500/20 border border-cyan-500/30"
        >
          <KeyRound className="w-4 h-4" />
          <span className="text-[10px]">Connect</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TeleHost &bull; Telegram Python Bot & Project Cloud Engine</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>24/7 Python 3.10 Background Runtime</span>
            <span>&bull;</span>
            <span>Live Terminal Log Streaming</span>
          </div>
        </div>
      </footer>

      {/* Create Bot Modal */}
      <NewBotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddBot={handleAddBot}
      />

      {/* Edit Bot Modal */}
      <EditBotModal
        isOpen={isEditBotModalOpen}
        onClose={() => setIsEditBotModalOpen(false)}
        bot={editingBot}
        onSaveBot={handleSaveBot}
        onDeleteBot={handleDeleteMasterBot}
      />

      {/* Global Telegram Connect & Diagnostics Modal */}
      <TelegramConnectModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        activeBot={bots[0]}
        onConnectToken={handleConnectMasterBotToken}
        onDisconnectBot={async (botId) => {
          await handleToggleBotStatus(botId);
          localStorage.removeItem('telehost_bot_token');
        }}
      />
    </div>
  );
}
