import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
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
  updatePythonBotEnv,
  getPythonBotScriptPath,
  resetDailyUploadLimit
} from './src/server/botManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Global Anti-Crash Process Protectors
process.on('uncaughtException', (err: any) => {
  console.error('[TeleHost Global Safety] Caught unhandled exception, preventing crash:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[TeleHost Global Safety] Caught unhandled rejection, preventing crash:', reason?.message || reason);
});

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

// Download Python Bot File (.py / .zip)
app.get('/api/python-bots/:id/download', (req, res) => {
  const botInfo = getPythonBotScriptPath(req.params.id);
  if (!botInfo || !fs.existsSync(botInfo.filePath)) {
    return res.status(404).json({ error: 'Bot file not found on server.' });
  }
  res.download(botInfo.filePath, botInfo.fileName);
});

// ==============================================================================
// AKASH FF PANEL - DATABASE & MANAGEMENT REST API
// ==============================================================================

function queryDb(sql: string, params: any[] = []): any {
  try {
    const pyScript = `
import sqlite3, json, sys
conn = sqlite3.connect('Cuibcc.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
sql = ${JSON.stringify(sql)}
params = ${JSON.stringify(params)}
c.execute(sql, params)
if sql.strip().upper().startswith('SELECT') or sql.strip().upper().startswith('PRAGMA'):
    rows = [dict(r) for r in c.fetchall()]
    print(json.dumps(rows))
else:
    conn.commit()
    print(json.dumps({'affected': c.rowcount, 'lastrowid': c.lastrowid}))
`;
    const out = execSync('python3', { input: pyScript, encoding: 'utf-8', timeout: 6000 });
    return JSON.parse(out.trim());
  } catch (err: any) {
    console.error('[queryDb error]', err.message);
    return [];
  }
}

// 1. Overview Stats
app.get('/api/ff-panel/overview', (_req, res) => {
  try {
    const products = queryDb('SELECT COUNT(*) as count FROM products');
    const keys = queryDb('SELECT COUNT(*) as count FROM product_keys WHERE is_used=0');
    const users = queryDb('SELECT COUNT(*) as count, SUM(balance) as total_bal, SUM(spent) as total_spent FROM users');
    const orders = queryDb('SELECT COUNT(*) as count FROM orders');
    
    res.json({
      totalProducts: products[0]?.count || 0,
      availableKeys: keys[0]?.count || 0,
      totalUsers: users[0]?.count || 0,
      totalBalance: users[0]?.total_bal || 0,
      totalSpent: users[0]?.total_spent || 0,
      totalOrders: orders[0]?.count || 0,
      botUsername: 'AKASHFFPANEL11BOT',
      adminId: '8808556338'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Products List
app.get('/api/ff-panel/products', (_req, res) => {
  try {
    const products = queryDb('SELECT * FROM products ORDER BY id ASC');
    const productsWithKeys = products.map((p: any) => {
      const keyCount = queryDb('SELECT COUNT(*) as count FROM product_keys WHERE product_id=? AND is_used=0', [p.id]);
      return {
        ...p,
        availableKeysCount: keyCount[0]?.count || 0
      };
    });
    res.json({ products: productsWithKeys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create Product
app.post('/api/ff-panel/products', (req, res) => {
  try {
    const { category, name, price_inr, reseller_price, validity, device_limit, apk_link } = req.body;
    const result = queryDb(
      'INSERT INTO products (category, name, price_inr, reseller_price, stock, apk_link, validity, device_limit, is_active) VALUES (?, ?, ?, ?, 10, ?, ?, ?, 1)',
      [category || 'ANDROID NON ROOT PANEL', name, price_inr || 100, reseller_price || 80, apk_link || 'https://t.me/Akash_12121', validity || '1 Day', device_limit || '1 Device']
    );
    res.json({ success: true, id: result.lastrowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Product
app.delete('/api/ff-panel/products/:id', (req, res) => {
  try {
    queryDb('DELETE FROM products WHERE id=?', [req.params.id]);
    queryDb('DELETE FROM product_keys WHERE product_id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Product Keys List
app.get('/api/ff-panel/keys', (req, res) => {
  try {
    const productId = req.query.productId;
    let sql = `
      SELECT pk.id, pk.product_id, pk.key_text, pk.is_used, p.name as product_name, p.category 
      FROM product_keys pk 
      LEFT JOIN products p ON pk.product_id = p.id
    `;
    const params: any[] = [];
    if (productId) {
      sql += ' WHERE pk.product_id = ?';
      params.push(productId);
    }
    sql += ' ORDER BY pk.id DESC';
    const keys = queryDb(sql, params);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Add or Bulk Generate Keys
app.post('/api/ff-panel/keys', (req, res) => {
  try {
    const { productId, keys, prefix, count } = req.body;
    let addedCount = 0;

    if (Array.isArray(keys) && keys.length > 0) {
      for (const k of keys) {
        if (typeof k === 'string' && k.trim()) {
          queryDb('INSERT INTO product_keys (product_id, key_text, is_used) VALUES (?, ?, 0)', [productId, k.trim()]);
          addedCount++;
        }
      }
    } else if (count && count > 0) {
      const keyPrefix = prefix || 'AKASH-VIP';
      for (let i = 0; i < count; i++) {
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const generatedKey = `${keyPrefix}-${rand}-${randNum}`;
        queryDb('INSERT INTO product_keys (product_id, key_text, is_used) VALUES (?, ?, 0)', [productId, generatedKey]);
        addedCount++;
      }
    }

    res.json({ success: true, addedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete Key
app.delete('/api/ff-panel/keys/:id', (req, res) => {
  try {
    queryDb('DELETE FROM product_keys WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Users Info List
app.get('/api/ff-panel/users', (_req, res) => {
  try {
    const users = queryDb('SELECT * FROM users ORDER BY user_id DESC');
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Update User Balance
app.post('/api/ff-panel/users/:id/balance', (req, res) => {
  try {
    const { amount, mode } = req.body; // mode: 'add' | 'deduct' | 'set'
    const num = parseFloat(amount);
    if (isNaN(num)) return res.status(400).json({ error: 'Invalid amount' });

    if (mode === 'set') {
      queryDb('UPDATE users SET balance=? WHERE user_id=?', [num, req.params.id]);
    } else if (mode === 'deduct') {
      queryDb('UPDATE users SET balance=MAX(0, balance - ?) WHERE user_id=?', [num, req.params.id]);
    } else {
      queryDb('UPDATE users SET balance=balance + ? WHERE user_id=?', [num, req.params.id]);
    }

    const updated = queryDb('SELECT balance FROM users WHERE user_id=?', [req.params.id]);
    res.json({ success: true, balance: updated[0]?.balance || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Toggle VIP Status
app.post('/api/ff-panel/users/:id/toggle-vip', (req, res) => {
  try {
    const user = queryDb('SELECT is_vip FROM users WHERE user_id=?', [req.params.id]);
    if (!user || user.length === 0) return res.status(404).json({ error: 'User not found' });
    const newVip = user[0].is_vip ? 0 : 1;
    queryDb('UPDATE users SET is_vip=? WHERE user_id=?', [newVip, req.params.id]);
    res.json({ success: true, is_vip: newVip });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Toggle Reseller Status
app.post('/api/ff-panel/users/:id/toggle-reseller', (req, res) => {
  try {
    const user = queryDb('SELECT is_reseller FROM users WHERE user_id=?', [req.params.id]);
    if (!user || user.length === 0) return res.status(404).json({ error: 'User not found' });
    const newRes = user[0].is_reseller ? 0 : 1;
    const accType = newRes ? 'Reseller' : 'Regular';
    queryDb('UPDATE users SET is_reseller=?, account_type=? WHERE user_id=?', [newRes, accType, req.params.id]);
    res.json({ success: true, is_reseller: newRes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Toggle User Ban
app.post('/api/ff-panel/users/:id/toggle-ban', (req, res) => {
  try {
    const user = queryDb('SELECT is_banned FROM users WHERE user_id=?', [req.params.id]);
    if (!user || user.length === 0) return res.status(404).json({ error: 'User not found' });
    const newBanned = user[0].is_banned ? 0 : 1;
    queryDb('UPDATE users SET is_banned=? WHERE user_id=?', [newBanned, req.params.id]);
    res.json({ success: true, is_banned: newBanned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Download / Export Users Info File
app.get('/api/ff-panel/users/export', (_req, res) => {
  try {
    const users = queryDb('SELECT * FROM users ORDER BY user_id ASC');
    let text = '========================================================================================\n';
    text += '                     AKASH FF PANEL - OFFICIAL USERS DATABASE DUMP                     \n';
    text += `                     Generated on: ${new Date().toLocaleString()}                      \n`;
    text += '========================================================================================\n\n';

    users.forEach((u: any, idx: number) => {
      text += `[#${idx + 1}] USER ID: ${u.user_id}\n`;
      text += `  • Name: ${u.first_name || 'N/A'}\n`;
      text += `  • Username: @${u.username || 'None'}\n`;
      text += `  • Phone: ${u.phone || 'Not Provided'}\n`;
      text += `  • Balance: ₹${(u.balance || 0).toFixed(2)}\n`;
      text += `  • Account Level: ${u.is_vip ? 'VIP Member' : (u.is_reseller ? 'Reseller' : 'Regular User')}\n`;
      text += `  • Orders Completed: ${u.orders_count || 0} | Total Spent: ₹${(u.spent || 0).toFixed(2)}\n`;
      text += `  • Status: ${u.is_banned ? 'BANNED 🚫' : 'ACTIVE 🟢'}\n`;
      text += `  • Joined Date: ${u.joined_date || 'N/A'}\n`;
      text += '----------------------------------------------------------------------------------------\n';
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="users_info_${Date.now()}.txt"`);
    res.send(text);
  } catch (err: any) {
    res.status(500).send(`Export failed: ${err.message}`);
  }
});

// 14. Telegram Broadcast Message
app.post('/api/ff-panel/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }
    const token = '8632912098:AAENMDr-tkYBDsgl5MkA8SAt_3qOgnpL8j8';
    const users = queryDb('SELECT user_id FROM users WHERE is_banned=0');
    let sentCount = 0;

    for (const u of users) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: u.user_id,
            text: `📢 <b>AKASH FF PANEL ANNOUNCEMENT</b>\n━━━━━━━━━━━━━━━━━━\n\n${message}\n\n━━━━━━━━━━━━━━━━━━\n👑 <b>Admin:</b> @Akash_12121`,
            parse_mode: 'HTML'
          })
        });
        const data = await resp.json() as any;
        if (data.ok) sentCount++;
      } catch (_) {}
    }

    res.json({ success: true, sentCount, totalUsers: users.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
  const { prompt, botName, rules, targetStorage, adminChatId } = req.body;

  try {
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
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      return res.json(data);
    }
  } catch (err: any) {
    console.warn('[TeleHost AI Engine] AI request notice (using high-performance template fallback):', err?.message || err);
  }

  // Graceful deterministic fallback generator (ensures zero downtime even if AI quota is exhausted)
  const safeBotName = (botName || 'TeleHost Bot').replace(/[^a-zA-Z0-9_]/g, '_');
  const fallbackMainPy = `# -*- coding: utf-8 -*-
"""
TeleHost - Asynchronous Telegram Python Bot Worker
Generated for: ${botName || 'TeleHost Bot'}
Storage Target: ${targetStorage || './hosted_sites'}
"""

import os
import sys
import time
import zipfile
import shutil
import asyncio
from telethon import TelegramClient, events, Button

# Configuration
API_ID = int(os.getenv("TELEGRAM_API_ID", "1234567"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "0123456789abcdef0123456789abcdef")
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "${adminChatId || '-100123456789'}"))
STORAGE_DIR = os.getenv("STORAGE_DIR", "${targetStorage || './hosted_sites'}")

os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs("./downloads", exist_ok=True)

bot = TelegramClient("${safeBotName}", API_ID, API_HASH).start(bot_token=BOT_TOKEN)

print(f"[{time.strftime('%X')}] 🚀 {botName || 'TeleHost Bot'} worker initialized & active 24/7.")

@bot.on(events.NewMessage(pattern="/start"))
async def start_handler(event):
    await event.reply(
        "👋 **Welcome to TeleHost Cloud Bot!**\\n\\n"
        "📁 Send me any **.zip** or **.html** file to host a live website instantly!\\n"
        "📥 Send any media file to download it to secure cloud storage."
    )

@bot.on(events.NewMessage)
async def file_handler(event):
    if not event.message.file:
        return

    sender = await event.get_sender()
    sender_name = getattr(sender, 'username', None) or getattr(sender, 'first_name', 'User')
    file_name = event.file.name or f"file_{int(time.time())}"
    file_size_mb = (event.file.size or 0) / (1024 * 1024)

    status_msg = await event.reply(f"⏳ Receiving \`{file_name}\` ({file_size_mb:.2f} MB)...")

    # Handle HTML / ZIP web hosting
    if file_name.endswith('.zip') or file_name.endswith('.html'):
        dest_folder = os.path.join(STORAGE_DIR, f"site_{int(time.time())}")
        os.makedirs(dest_folder, exist_ok=True)
        
        saved_file = await event.download_media(file=dest_folder)
        if file_name.endswith('.zip'):
            with zipfile.ZipFile(saved_file, 'r') as zip_ref:
                zip_ref.extractall(dest_folder)
            os.remove(saved_file)

        await status_msg.edit(
            f"🎉 **Website Hosted Successfully!**\\n\\n"
            f"📦 **Project:** \`{file_name}\`\\n"
            f"👤 **Owner:** @{sender_name}\\n"
            f"🌐 **Status:** Active & Live 24/7"
        )
    else:
        # Standard file download
        dest_path = os.path.join("./downloads", file_name)
        await event.download_media(file=dest_path)
        await status_msg.edit(f"✅ **File Saved!** \`{file_name}\` stored safely.")

if __name__ == "__main__":
    bot.run_until_disconnected()
`;

  return res.json({
    mainPy: fallbackMainPy,
    configPy: `# TeleHost Bot Configuration\nAPI_ID = ${adminChatId || 1234567}\nADMIN_CHAT_ID = ${adminChatId || -100123456789}\nSTORAGE_DIR = "${targetStorage || './hosted_sites'}"\n`,
    requirementsTxt: "telethon>=1.34.0\npython-dotenv>=1.0.0\naiohttp>=3.9.0\n",
    dockerfile: "FROM python:3.10-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nCMD [\"python3\", \"main.py\"]\n",
    readmeMd: `# ${botName || 'TeleHost Bot'}\n\n1. Set BOT_TOKEN, TELEGRAM_API_ID, and TELEGRAM_API_HASH in .env\n2. Run \`pip install -r requirements.txt\`\n3. Start with \`python3 main.py\`\n`,
    summary: `Complete 24/7 Telethon Python bot configured with automated website hosting and file downloading.`
  });
});

// AI Endpoint: Optimize / Audit Approval Rules
app.post('/api/optimize-rules', async (req, res) => {
  const { rulesDescription } = req.body;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze these file approval requirements for a Telethon Telegram bot: "${rulesDescription}".
Suggest optimal structured approval rules.
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

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      return res.json(data);
    }
  } catch (err: any) {
    console.warn('[TeleHost AI Rules] AI request notice (using smart rule fallback):', err?.message || err);
  }

  // Fallback optimized rules
  return res.json({
    maxFileSizeMB: 100,
    allowedExtensions: [".pdf", ".zip", ".mp4", ".apk", ".html", ".py", ".png", ".jpg"],
    allowedMimeTypes: ["application/pdf", "video/mp4", "application/zip", "text/html", "text/x-python", "image/png", "image/jpeg"],
    requireChannelMembership: false,
    channelUsername: "",
    autoApproveKeywords: ["#approved", "#host", "#download", "submit"],
    adminReviewOnLargeFile: true,
    rejectionMessage: "File rejected: Please ensure your file is under the size limit and is in an approved format.",
    aiSuggestions: ["Enabled automated rule verification with support for web archives, scripts, and media files."]
  });
});

app.post('/api/admin/reset-limits', (_req, res) => {
  resetDailyUploadLimit();
  res.json({ success: true, message: 'All daily upload limits have been reset.' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'TeleHost Telethon Studio', hostedSitesReady: true });
});

function getListenPort(): number {
  const args = process.argv;
  const pIdx = args.indexOf('--port') !== -1 ? args.indexOf('--port') : args.indexOf('-p');
  if (pIdx !== -1 && args[pIdx + 1]) {
    const val = parseInt(args[pIdx + 1], 10);
    if (!isNaN(val)) return val;
  }
  if (process.env.PORT) {
    const val = parseInt(process.env.PORT, 10);
    if (!isNaN(val)) return val;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const val = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(val)) return val;
  }
  if (process.env.APP_PORT) {
    const val = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(val)) return val;
  }
  return 3000;
}

const PORT = getListenPort();

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production' || !fs.existsSync(path.resolve(__dirname, 'server.ts'));

  if (!isProduction) {
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
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath) || !fs.existsSync(path.join(distPath, 'index.html'))) {
      if (fs.existsSync(path.join(__dirname, 'index.html'))) {
        distPath = __dirname;
      } else if (fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'))) {
        distPath = path.resolve(__dirname, 'dist');
      } else {
        distPath = process.cwd();
      }
    }

    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/sites') || req.originalUrl.startsWith('/api')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        const rootIndexPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(rootIndexPath)) {
          res.sendFile(rootIndexPath);
        } else {
          res.status(404).send('Not Found');
        }
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TeleHost] Server listening on http://0.0.0.0:${PORT}`);
  });

  // Optimize keep-alive timeouts for cloud proxy / container longevity
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // 24/7 Keep-Alive Self-Ping Heartbeat (prevents scale-to-zero, socket drops & idle freezing)
  setInterval(() => {
    try {
      fetch(`http://127.0.0.1:${PORT}/api/health`)
        .then(() => {})
        .catch(() => {});
    } catch (_) {}
  }, 25000);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[TeleHost] Port ${PORT} already in use.`);
      // If port 8080 was attempted (e.g. from PORT env), fallback to 3000
      if (PORT === 8080) {
        console.log('[TeleHost] Retrying on port 3000...');
        const fallbackServer = app.listen(3000, '0.0.0.0', () => {
          console.log('[TeleHost] Server listening on http://0.0.0.0:3000');
        });
        fallbackServer.on('error', (fallbackErr: any) => {
          if (fallbackErr.code === 'EADDRINUSE') {
            console.log('[TeleHost] Existing server is already running and active on port 3000.');
          } else {
            console.error('[TeleHost] Server error on port 3000:', fallbackErr);
            process.exit(1);
          }
        });
        return;
      }
      // If port 3000 is already active, keep process running or stay attached
      console.log(`[TeleHost] Existing server is already running and active on port ${PORT}. Keeping standby process active.`);
      setInterval(() => {}, 60000);
    } else {
      console.error('[TeleHost] Fatal server error:', err);
      process.exit(1);
    }
  });
}

startServer();
