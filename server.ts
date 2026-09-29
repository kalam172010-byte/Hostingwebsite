import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  startRealBot, 
  stopRealBot, 
  getActiveBotInfos, 
  getLiveSubmissions, 
  getLiveLogs,
  getHostedProjects,
  getHostedPythonBots,
  deployPythonBotFromFile,
  deployPythonBotFromZip,
  startPythonBot,
  stopPythonBot,
  deletePythonBot,
  deployProjectFromZip,
  deploySingleHtml,
  deleteHostedProject,
  validateTelegramToken,
  diagnoseTelegramToken,
  clearTelegramWebhook,
  sendTestTelegramMessage,
  setServerBaseUrl,
  getSystemStats,
  updatePythonBotEnv 
} from './src/server/botManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));

// Middleware to detect base URL dynamically for live preview links
app.use((req, _res, next) => {
  const host = req.get('host');
  if (host) {
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    setServerBaseUrl(`${proto}://${host}`);
  }
  next();
});

// Serve Hosted Web Projects statically from /sites/<projectId>/
const hostedSitesDir = path.resolve(process.cwd(), 'hosted_sites');
if (!fs.existsSync(hostedSitesDir)) {
  fs.mkdirSync(hostedSitesDir, { recursive: true });
}
app.use('/sites', express.static(hostedSitesDir));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// REAL TELEGRAM BOT RUNTIME ENDPOINTS

// Verify / Test Telegram Bot Token
app.post('/api/bots/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }
    const result = await validateTelegramToken(token);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// Full Diagnostic Check for Telegram Token
app.post('/api/bots/diagnose-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required for diagnostics.' });
    }
    const result = await diagnoseTelegramToken(token);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// Force Clear Webhook and Drop Pending Updates
app.post('/api/bots/clear-webhook', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required.' });
    }
    const result = await clearTelegramWebhook(token);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Send Test Message to Verify Bot Sending
app.post('/api/bots/send-test-message', async (req, res) => {
  try {
    const { token, chatId, message } = req.body;
    if (!token || !chatId) {
      return res.status(400).json({ success: false, error: 'Token and Chat ID are required.' });
    }
    const result = await sendTestTelegramMessage(token, chatId, message);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Live Real Telegram Bot
app.post('/api/bots/start', async (req, res) => {
  try {
    const { id, name, token, adminChatId, downloadPath, rules } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Bot token is required to start live Telegram polling.' });
    }

    const result = await startRealBot({
      id: id || `bot_${Date.now()}`,
      name: name || 'Telegram Project Host Bot',
      token,
      adminChatId,
      downloadPath,
      rules
    });

    if (result.success) {
      return res.json({
        success: true,
        message: `Bot @${result.username} is now live with Instant Web Hosting engine!`,
        username: result.username
      });
    } else {
      return res.status(400).json({ error: result.error || 'Failed to start Telegram Bot.' });
    }
  } catch (err: any) {
    console.error('Error in /api/bots/start:', err);
    return res.status(500).json({ error: err.message || 'Server error starting Telegram bot.' });
  }
});

// Stop Live Real Telegram Bot
app.post('/api/bots/stop', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Bot ID required' });
    await stopRealBot(id);
    return res.json({ success: true, message: `Bot ${id} stopped.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Sync Live Bot Status & Real Submissions/Logs/Hosted Python Bots
app.get('/api/bots/status', (_req, res) => {
  res.json({
    activeBots: getActiveBotInfos(),
    submissions: getLiveSubmissions(),
    logs: getLiveLogs(),
    hostedProjects: getHostedProjects(),
    hostedPythonBots: getHostedPythonBots()
  });
});

// HOSTED PYTHON BOTS API ENDPOINTS
app.get('/api/python-bots', (_req, res) => {
  res.json({ bots: getHostedPythonBots() });
});

// Deploy Python Bot from Web UI (Template, raw code, or uploaded file)
app.post('/api/python-bots/deploy', async (req, res) => {
  try {
    const { name, code, contentBase64, fileName, templateId } = req.body;
    let bot;

    if (templateId === 'echo_bot') {
      const sampleEchoCode = `# Telegram Echo Bot Worker (TeleHost Managed)
import sys
import time
import datetime

print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🤖 Telegram Echo Bot Worker Started...")
print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🐍 Python 3 Runtime Active: {sys.version.split()[0]}")
print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 📡 Connecting to Telegram Bot Gateway...")

step = 0
while True:
    step += 1
    time.sleep(10)
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ⚡ [Worker Loop #{step}] Bot is polling messages and healthy 24/7.")
`;
      bot = await deployPythonBotFromFile(sampleEchoCode, {
        name: name || 'Telegram Echo Bot Worker',
        originalFileName: 'echo_bot.py',
        sourceType: 'template',
        description: 'Starter Telegram Python bot worker running with live streaming logs'
      });
    } else if (contentBase64) {
      const buffer = Buffer.from(contentBase64, 'base64');
      if (fileName?.endsWith('.zip')) {
        bot = await deployPythonBotFromZip(buffer, {
          name: name || fileName.replace(/\.zip$/i, ''),
          originalFileName: fileName,
          sourceType: 'web_upload',
          description: 'Uploaded via TeleHost Web Console'
        });
      } else {
        const text = buffer.toString('utf-8');
        bot = await deployPythonBotFromFile(text, {
          name: name || fileName || 'bot.py',
          originalFileName: fileName || 'bot.py',
          sourceType: 'web_upload',
          description: 'Uploaded via TeleHost Web Console'
        });
      }
    } else if (code) {
      bot = await deployPythonBotFromFile(code, {
        name: name || fileName || 'custom_bot.py',
        originalFileName: fileName || 'custom_bot.py',
        sourceType: 'web_upload',
        description: 'Deployed via Web Code Editor'
      });
    } else {
      return res.status(400).json({ error: 'Please provide python code, zip file, or templateId' });
    }

    return res.json({ success: true, bot });
  } catch (err: any) {
    console.error('Error deploying python bot:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Start/Restart Python Bot
app.post('/api/python-bots/:id/start', (req, res) => {
  const success = startPythonBot(req.params.id);
  res.json({ success });
});

// Stop Python Bot
app.post('/api/python-bots/:id/stop', (req, res) => {
  const success = stopPythonBot(req.params.id);
  res.json({ success });
});

// Delete Python Bot
app.delete('/api/python-bots/:id', (req, res) => {
  const success = deletePythonBot(req.params.id);
  res.json({ success });
});

// Update Python Bot Environment Variable
app.post('/api/python-bots/:id/env', (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: 'Key is required' });
  }
  const success = updatePythonBotEnv(req.params.id, key, value || '');
  res.json({ success });
});

// System Hardware & Cloud Server Metrics
app.get('/api/system/stats', (_req, res) => {
  res.json(getSystemStats());
});


// Serve Local Downloaded File
app.get('/api/bots/download-file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server.' });
  }
  res.download(filePath);
});

// HOSTED PROJECTS MANAGEMENT ENDPOINTS

// List all hosted projects
app.get('/api/hosted-projects', (_req, res) => {
  res.json({ projects: getHostedProjects() });
});

// Deploy project directly from Web UI or Template
app.post('/api/hosted-projects/deploy', async (req, res) => {
  try {
    const { name, contentBase64, htmlContent, templateId, fileName } = req.body;
    let project;

    if (templateId === 'portfolio') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name || 'Creative Developer'} - TeleHost Site</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-8 font-sans">
  <div class="max-w-4xl mx-auto space-y-8">
    <header class="border-b border-slate-800 pb-6 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-extrabold text-blue-400">${name || 'Fullstack Portfolio'}</h1>
        <p class="text-slate-400 text-sm">Deployed automatically via TeleHost Cloud Engine</p>
      </div>
      <span class="px-3.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-semibold">● Online & Live</span>
    </header>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="p-6 bg-slate-900 rounded-2xl border border-slate-800">
        <h2 class="text-lg font-bold text-white mb-2">⚡ Instant Telegram Hosting</h2>
        <p class="text-slate-400 text-sm leading-relaxed">Users send a .zip archive or HTML file in Telegram, and TeleHost unpacks it into a public URL automatically!</p>
      </div>
      <div class="p-6 bg-slate-900 rounded-2xl border border-slate-800">
        <h2 class="text-lg font-bold text-white mb-2">📁 Zero Config Deployment</h2>
        <p class="text-slate-400 text-sm leading-relaxed">Assets, images, stylesheets, and scripts are automatically mapped with edge static serving.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
      project = await deploySingleHtml(html, {
        name: name || 'Modern Portfolio Template',
        originalFileName: 'portfolio.html',
        sourceType: 'template',
        description: 'Starter portfolio template deployed via TeleHost web console.'
      });
    } else if (templateId === 'game') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Space Blaster - Retro Canvas Game</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-black text-white flex flex-col items-center justify-center min-h-screen p-4 font-mono">
  <div class="text-center mb-4">
    <h1 class="text-3xl font-black text-yellow-400 mb-1">👾 SPACE TAP MINI GAME</h1>
    <p class="text-xs text-gray-400">Click the moving target to score points!</p>
  </div>
  <div class="border-2 border-yellow-500/50 rounded-2xl overflow-hidden shadow-2xl shadow-yellow-500/20">
    <canvas id="gameCanvas" width="450" height="300" class="bg-slate-950 cursor-crosshair"></canvas>
  </div>
  <div class="mt-4 flex items-center gap-6">
    <span class="text-emerald-400 font-bold text-lg">Score: <span id="score">0</span></span>
    <button onclick="resetGame()" class="px-4 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs">Reset</button>
  </div>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0;
    let target = { x: 220, y: 150, r: 24, dx: 3, dy: 3 };
    function loop() {
      ctx.clearRect(0,0,450,300);
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r, 0, Math.PI*2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      target.x += target.dx;
      target.y += target.dy;
      if (target.x < target.r || target.x > 450 - target.r) target.dx *= -1;
      if (target.y < target.r || target.y > 300 - target.r) target.dy *= -1;
      requestAnimationFrame(loop);
    }
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dist = Math.hypot(x - target.x, y - target.y);
      if (dist <= target.r) {
        score += 10;
        document.getElementById('score').innerText = score;
        target.x = Math.random() * 350 + 50;
        target.y = Math.random() * 200 + 50;
      }
    });
    function resetGame() {
      score = 0;
      document.getElementById('score').innerText = 0;
      target.x = 220; target.y = 150;
    }
    loop();
  </script>
</body>
</html>`;
      project = await deploySingleHtml(html, {
        name: name || 'Space Tap Mini Game',
        originalFileName: 'game.html',
        sourceType: 'template',
        description: 'Interactive HTML5 Canvas mini game hosted via TeleHost.'
      });
    } else if (contentBase64) {
      const buffer = Buffer.from(contentBase64, 'base64');
      project = await deployProjectFromZip(buffer, {
        name: name || 'Uploaded Web Project',
        originalFileName: fileName || 'project.zip',
        sourceType: 'web_upload',
        description: 'Uploaded via TeleHost web dashboard'
      });
    } else if (htmlContent) {
      project = await deploySingleHtml(htmlContent, {
        name: name || 'Uploaded HTML Page',
        originalFileName: fileName || 'index.html',
        sourceType: 'web_upload',
        description: 'Direct HTML deployment via web dashboard'
      });
    } else {
      return res.status(400).json({ error: 'Please provide a valid ZIP archive or HTML content.' });
    }

    return res.json({ success: true, project });
  } catch (err: any) {
    console.error('Error deploying project:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete hosted project
app.delete('/api/hosted-projects/:id', (req, res) => {
  const { id } = req.params;
  const success = deleteHostedProject(id);
  if (!success) {
    return res.status(404).json({ error: 'Project not found' });
  }
  return res.json({ success: true, message: `Project ${id} deleted.` });
});

// AI Endpoint: Generate or Refine Telethon Python Code
app.post('/api/generate-bot-code', async (req, res) => {
  try {
    const { prompt, botName, rules, targetStorage, adminChatId } = req.body;

    const systemInstruction = `
You are an expert Python engineer specializing in Telegram bots built using the Telethon library (async Telegram MTProto/Bot client).
Your job is to generate clean, robust, asynchronous Python Telethon code for automated Telegram file downloading and web project hosting.

Requirements for generated Telethon code:
1. Use Telethon's TelegramClient and events (@client.on(events.NewMessage)).
2. Implement file filtering & approval logic according to user rules (file sizes, file extensions, MIME types).
3. If user uploads .zip or .html, extract into hosted_sites/ and provide a live web link!
4. Handle auto-approval vs admin manual approval.
5. Auto-download approved media using \`await client.download_media(message.media, file=output_dir, progress_callback=...)\`.
6. Return output in valid JSON format matching this schema:
{
  "mainPy": "python code for main.py",
  "configPy": "python code for config.py",
  "requirementsTxt": "content for requirements.txt",
  "dockerfile": "content for Dockerfile",
  "readmeMd": "markdown user manual for setting up API ID, API Hash, Bot Token and running the bot",
  "summary": "Brief 2-3 sentence overview of generated features and approval logic"
}
`;

    const userMessage = `
Generate a complete Telethon Python Project Hosting & File Downloader Bot:
Bot Name: ${botName || 'TeleHost Bot'}
Admin Chat ID: ${adminChatId || '-100123456789'}
Storage Path: ${targetStorage || './hosted_sites'}
User Custom Prompt: ${prompt || 'Host websites when users send .zip files or .html files, and download other files'}
Approval Rules: ${JSON.stringify(rules || {}, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      return res.status(500).json({ error: 'Failed to generate code from AI' });
    }

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (err: any) {
    console.error('Error in /api/generate-bot-code:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred during Python Telethon code generation',
    });
  }
});

// AI Endpoint: Optimize / Audit Approval Rules
app.post('/api/optimize-rules', async (req, res) => {
  try {
    const { rulesDescription } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analyze these file approval requirements for a Telethon Telegram bot: "${rulesDescription}".
Suggest optimal structured approval rules including:
1. maxFileSizeMB (number)
2. allowedMimeTypes (array of strings like ["application/pdf", "video/mp4", "application/zip"])
3. requireChannelMembership (boolean and channelUsername string)
4. autoApproveKeywords (array of strings)
5. adminReviewThreshold (reason for triggering admin review)
6. customRejectionMessage (string to send to user if file rejected)

Return JSON in format:
{
  "maxFileSizeMB": 50,
  "allowedExtensions": [".pdf", ".zip", ".mp4", ".apk", ".html"],
  "allowedMimeTypes": ["application/pdf", "video/mp4", "application/zip", "text/html"],
  "requireChannelMembership": true,
  "channelUsername": "@MyChannel",
  "autoApproveKeywords": ["#approved", "#host", "submit"],
  "adminReviewOnLargeFile": true,
  "rejectionMessage": "Sorry, your submission does not meet the automated download criteria.",
  "aiSuggestions": ["Explanation of rule optimizations made..."]
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      return res.status(500).json({ error: 'Failed to optimize rules' });
    }

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (err: any) {
    console.error('Error in /api/optimize-rules:', err);
    return res.status(500).json({ error: err.message || 'Failed to optimize rules' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'TeleHost Telethon Studio', hostedSitesReady: true });
});

// Vite Middleware setup for dev vs static in prod
const PORT = process.env.PORT || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      // Skip if url starts with /sites or /api
      if (url.startsWith('/sites') || url.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
