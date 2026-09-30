import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  HostedPythonBot,
  getHostedPythonBots,
  startPythonBot,
  stopPythonBot,
  deletePythonBot,
  addLog,
  recordFileSubmission
} from './botManager';

/**
 * Pure Telegram Bot Hosting Engine for the Master Telegram Bot.
 * Allows users to send .py or .zip files directly in Telegram to host and run them 24/7.
 */
export function setupTeleHostTelegramBot(
  bot: any,
  botId: string,
  me: any,
  actions: {
    deployPythonBotFromFile: (code: string, meta: any) => Promise<HostedPythonBot>;
    deployPythonBotFromZip: (buffer: Buffer, meta: any) => Promise<HostedPythonBot>;
  }
) {
  const processedMessageKeys = new Set<string>();

  // Helper to format bot control keyboard
  const getBotControlKeyboard = (pyBotId: string, isRunning: boolean) => ({
    inline_keyboard: [
      [
        { text: '📋 View Logs', callback_data: `logs_${pyBotId}` },
        isRunning
          ? { text: '🔄 Restart', callback_data: `restart_${pyBotId}` }
          : { text: '▶️ Start', callback_data: `start_${pyBotId}` }
      ],
      [
        isRunning
          ? { text: '⏹ Stop Bot', callback_data: `stop_${pyBotId}` }
          : { text: '🗑 Delete Bot', callback_data: `delete_${pyBotId}` },
        { text: '📋 All My Bots', callback_data: 'my_bots' }
      ]
    ]
  });

  // 1. MESSAGE LISTENER
  bot.on('message', async (msg: any) => {
    if (bot._isStopped) return;
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const msgKey = `${chatId}_${messageId}`;
    if (processedMessageKeys.has(msgKey)) return;
    processedMessageKeys.add(msgKey);
    if (processedMessageKeys.size > 2000) {
      const oldest = processedMessageKeys.values().next().value;
      if (oldest) processedMessageKeys.delete(oldest);
    }

    const sender = msg.from;
    const senderUsername = sender?.username || sender?.first_name || 'user';
    const senderId = sender?.id || chatId;
    const text = (msg.text || '').trim();

    // 📤 HANDLE DOCUMENT UPLOAD (.py or .zip)
    if (msg.document) {
      const doc = msg.document;
      const fileName = doc.file_name || 'bot.py';
      const fileId = doc.file_id;
      const fileSizeMB = doc.file_size ? Number((doc.file_size / (1024 * 1024)).toFixed(3)) : 0.01;

      const waitMsg = await bot.sendMessage(
        chatId,
        `📥 <b>File Received:</b> <code>${fileName}</code> (${fileSizeMB} MB)\n⏳ <i>Analyzing code & launching 24/7 Python cloud worker...</i>`,
        { parse_mode: 'HTML' }
      );

      try {
        const fileLink = await bot.getFileLink(fileId);
        const resp = await fetch(fileLink);
        if (!resp.ok) {
          throw new Error(`Failed to download file from Telegram: HTTP ${resp.status}`);
        }
        const fileBuffer = Buffer.from(await resp.arrayBuffer());

        // Also save copy into downloads folder
        try {
          const downloadDir = path.resolve(process.cwd(), 'downloads', 'bot_master_primary');
          if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
          fs.writeFileSync(path.join(downloadDir, fileName), fileBuffer);
        } catch (_) {}

        if (fileName.endsWith('.py')) {
          const code = fileBuffer.toString('utf-8');
          const deployedBot = await actions.deployPythonBotFromFile(code, {
            name: fileName,
            originalFileName: fileName,
            senderUsername,
            senderId,
            sourceType: 'telegram_bot',
            botId
          });

          await bot.editMessageText(
            `🚀 <b>PYTHON BOT HOSTED & RUNNING!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 <b>Bot Name:</b> <code>${deployedBot.name}</code>\n` +
            `🆔 <b>Worker ID:</b> <code>${deployedBot.id}</code>\n` +
            `📊 <b>Status:</b> 🟢 <b>RUNNING (PID: ${deployedBot.pid || 'Active'})</b>\n` +
            `🐍 <b>Runtime:</b> Python 3.10 (aiogram, telethon, qrcode)\n` +
            `⚡ <b>Supervision:</b> 24/7 Cloud Watchdog Active\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Your script is now running in the background 24/7!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML',
              reply_markup: getBotControlKeyboard(deployedBot.id, true)
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} hosted Python Bot "${fileName}" (${deployedBot.id}) via Telegram.`);
          return;
        } else if (fileName.endsWith('.zip')) {
          const deployedBot = await actions.deployPythonBotFromZip(fileBuffer, {
            name: fileName.replace(/\.zip$/i, ''),
            originalFileName: fileName,
            senderUsername,
            senderId,
            sourceType: 'telegram_bot',
            botId
          });

          await bot.editMessageText(
            `📦 <b>ZIP PACKAGE HOSTED & RUNNING!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 <b>Project Name:</b> <code>${deployedBot.name}</code>\n` +
            `🆔 <b>Worker ID:</b> <code>${deployedBot.id}</code>\n` +
            `📊 <b>Status:</b> 🟢 <b>RUNNING (PID: ${deployedBot.pid || 'Active'})</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Extracted requirements and started 24/7 background execution!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML',
              reply_markup: getBotControlKeyboard(deployedBot.id, true)
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} hosted ZIP Bot "${fileName}" (${deployedBot.id}) via Telegram.`);
          return;
        } else {
          recordFileSubmission({
            botId,
            senderId,
            senderUsername,
            fileName,
            fileSizeMB,
            mimeType: 'application/octet-stream',
            caption: msg.caption || '',
            status: 'COMPLETED',
            reason: 'User file uploaded via Telegram',
            localFilePath: path.join(process.cwd(), 'downloads', 'bot_master_primary', fileName)
          });

          await bot.editMessageText(
            `📥 <b>File Saved Successfully!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📄 <b>File Name:</b> <code>${fileName}</code>\n` +
            `📊 <b>Size:</b> ${fileSizeMB} MB\n` +
            `👤 <b>Sender:</b> @${senderUsername}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>File is saved on server and visible in your TeleHost Web Console!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          addLog(botId, 'INFO', `User @${senderUsername} uploaded file "${fileName}" (${fileSizeMB} MB).`);
          return;
        }
      } catch (err: any) {
        console.error('[Document hosting error]', err);
        await bot.editMessageText(
          `❌ <b>Hosting Failed:</b> ${err.message}`,
          {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'HTML'
          }
        );
        return;
      }
    }

    // COMMAND: /start
    if (text === '/start' || text.startsWith('/start ')) {
      const welcomeText =
        `🤖 <b><u>WELCOME TO TELEHOST CLOUD</u></b> ☁️\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Your 24/7 Dedicated <b>Python Telegram Bot Hosting Platform</b>.\n\n` +
        `🚀 <b>How to Host Your Bot:</b>\n` +
        `Simply <b>send or forward your Python bot file (<code>.py</code>)</b> or a <b><code>.zip</code> package</b> to this chat.\n\n` +
        `⚙️ <b>Cloud Runtime Features:</b>\n` +
        `• 🐍 <b>Python 3.10 Runtime</b> (aiogram, telethon, python-telegram-bot, requests, qrcode)\n` +
        `• ⚡ <b>24/7 Uptime Supervisor</b> with automatic crash revival\n` +
        `• 📋 <b>Live Console Logs</b> directly in Telegram\n` +
        `• 🔄 <b>Instant Restart & Stop Controls</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Send a .py file now to start hosting!</i>`;

      const reply_markup = {
        inline_keyboard: [
          [
            { text: '📤 How to Host', callback_data: 'how_to_host' },
            { text: '📋 My Hosted Bots', callback_data: 'my_bots' }
          ],
          [
            { text: '📊 Server Status', callback_data: 'server_status' },
            { text: '💻 Starter Template', callback_data: 'starter_template' }
          ]
        ]
      };

      await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup
      });
      addLog(botId, 'INFO', `User @${senderUsername} (${senderId}) started TeleHost Telegram Bot.`);
      return;
    }

    // COMMAND: /mybots or /bots
    if (text === '/mybots' || text === '/bots') {
      await showUserBotsList(bot, chatId, senderId, senderUsername);
      return;
    }

    // COMMAND: /status
    if (text === '/status') {
      await showServerStatus(bot, chatId);
      return;
    }

    // COMMAND: /help
    if (text === '/help') {
      await bot.sendMessage(
        chatId,
        `📖 <b><u>TELEHOST HOSTING GUIDE</u></b>\n\n` +
        `1️⃣ Send your Python bot script (e.g. <code>my_bot.py</code>) or multi-file project (<code>bot.zip</code>).\n` +
        `2️⃣ TeleHost automatically installs missing imports (e.g. <code>aiogram</code>, <code>qrcode</code>, etc.).\n` +
        `3️⃣ Your bot runs continuously 24/7 with auto-crash recovery.\n` +
        `4️⃣ Use /mybots anytime to see live terminal logs or restart your bot!`,
        { parse_mode: 'HTML' }
      );
      return;
    }
  });

  // 2. CALLBACK QUERY LISTENER
  bot.on('callback_query', async (query: any) => {
    if (bot._isStopped) return;
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const sender = query.from;
    const senderId = sender?.id || chatId;
    const senderUsername = sender?.username || sender?.first_name || 'user';

    try {
      await bot.answerCallbackQuery(query.id);
    } catch (_) {}

    // Back to main
    if (data === 'back_main') {
      const welcomeText =
        `🤖 <b><u>TELEHOST BOT HOSTING CLOUD</u></b> ☁️\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send any <b>.py</b> or <b>.zip</b> bot file to deploy it 24/7 in the cloud!`;

      const reply_markup = {
        inline_keyboard: [
          [
            { text: '📤 How to Host', callback_data: 'how_to_host' },
            { text: '📋 My Hosted Bots', callback_data: 'my_bots' }
          ],
          [
            { text: '📊 Server Status', callback_data: 'server_status' },
            { text: '💻 Starter Template', callback_data: 'starter_template' }
          ]
        ]
      };

      await bot.editMessageText(welcomeText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup
      });
      return;
    }

    // How to Host
    if (data === 'how_to_host') {
      const text =
        `📤 <b><u>HOW TO HOST YOUR BOT</u></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `1️⃣ Open this chat in Telegram.\n` +
        `2️⃣ Tap the paperclip 📎 button and select your <b>.py</b> Python script or <b>.zip</b> project archive.\n` +
        `3️⃣ TeleHost analyzes the code, resolves libraries (aiogram, telethon, etc.), and launches it in a background cloud container.\n` +
        `4️⃣ You will receive an instant confirmation with interactive buttons to view live logs, restart, or stop your bot anytime!\n\n` +
        `⚡ <i>Try sending a file right now!</i>`;

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 My Running Bots', callback_data: 'my_bots' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]
          ]
        }
      });
      return;
    }

    // My Bots List
    if (data === 'my_bots') {
      await showUserBotsList(bot, chatId, senderId, senderUsername, messageId);
      return;
    }

    // Server Status
    if (data === 'server_status') {
      await showServerStatus(bot, chatId, messageId);
      return;
    }

    // Starter Template
    if (data === 'starter_template') {
      const text =
        `💻 <b><u>SAMPLE PYTHON BOT TEMPLATE</u></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Here is a minimal starter template using <code>aiogram</code>:\n\n` +
        `<pre>import asyncio\nfrom aiogram import Bot, Dispatcher, types\n\nTOKEN = "YOUR_BOT_TOKEN"\nbot = Bot(token=TOKEN)\ndp = Dispatcher()\n\n@dp.message()\nasync def echo(m: types.Message):\n    await m.answer(f"Echo: {m.text}")\n\nasync def main():\n    print("Bot is running 24/7!")\n    await dp.start_polling(bot)\n\nif __name__ == "__main__":\n    asyncio.run(main())</pre>\n\n` +
        `Save this as <code>my_bot.py</code> and send it here to host!`;

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]
          ]
        }
      });
      return;
    }

    // View Logs for Bot
    if (data.startsWith('logs_')) {
      const pyBotId = data.replace('logs_', '');
      const allBots = getHostedPythonBots();
      const targetBot = allBots.find(b => b.id === pyBotId);

      if (!targetBot) {
        await bot.sendMessage(chatId, `⚠️ Bot <code>${pyBotId}</code> not found or expired.`);
        return;
      }

      const recentLogs = (targetBot.logs || []).slice(-12).join('\n') || '[No logs recorded yet]';
      const text =
        `📋 <b><u>LIVE LOGS: ${targetBot.name}</u></b>\n` +
        `🆔 <code>${targetBot.id}</code> | Status: <b>${targetBot.status}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<pre>${recentLogs.substring(0, 3500)}</pre>`;

      await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: getBotControlKeyboard(pyBotId, targetBot.status === 'RUNNING')
      });
      return;
    }

    // Restart Bot
    if (data.startsWith('restart_')) {
      const pyBotId = data.replace('restart_', '');
      const success = startPythonBot(pyBotId);
      if (success) {
        await bot.sendMessage(
          chatId,
          `🔄 <b>Bot Restarted!</b>\nWorker <code>${pyBotId}</code> is rebooting 24/7.`,
          {
            parse_mode: 'HTML',
            reply_markup: getBotControlKeyboard(pyBotId, true)
          }
        );
      } else {
        await bot.sendMessage(chatId, `❌ Failed to restart bot <code>${pyBotId}</code>.`);
      }
      return;
    }

    // Start Bot
    if (data.startsWith('start_')) {
      const pyBotId = data.replace('start_', '');
      const success = startPythonBot(pyBotId);
      if (success) {
        await bot.sendMessage(
          chatId,
          `▶️ <b>Bot Started!</b>\nWorker <code>${pyBotId}</code> is now 🟢 RUNNING.`,
          {
            parse_mode: 'HTML',
            reply_markup: getBotControlKeyboard(pyBotId, true)
          }
        );
      } else {
        await bot.sendMessage(chatId, `❌ Failed to start bot <code>${pyBotId}</code>.`);
      }
      return;
    }

    // Stop Bot
    if (data.startsWith('stop_')) {
      const pyBotId = data.replace('stop_', '');
      const success = stopPythonBot(pyBotId);
      if (success) {
        await bot.sendMessage(
          chatId,
          `⏹ <b>Bot Stopped!</b>\nWorker <code>${pyBotId}</code> has been stopped.`,
          {
            parse_mode: 'HTML',
            reply_markup: getBotControlKeyboard(pyBotId, false)
          }
        );
      } else {
        await bot.sendMessage(chatId, `❌ Failed to stop bot <code>${pyBotId}</code>.`);
      }
      return;
    }

    // Delete Bot
    if (data.startsWith('delete_')) {
      const pyBotId = data.replace('delete_', '');
      const success = deletePythonBot(pyBotId);
      if (success) {
        await bot.sendMessage(chatId, `🗑 <b>Bot Deleted!</b>\nWorker <code>${pyBotId}</code> was removed.`);
      } else {
        await bot.sendMessage(chatId, `❌ Failed to delete bot <code>${pyBotId}</code>.`);
      }
      return;
    }
  });
}

/**
 * Show list of user's hosted bots
 */
async function showUserBotsList(bot: any, chatId: number, senderId: number, senderUsername: string, messageId?: number) {
  const allBots = getHostedPythonBots();
  // Filter for bots uploaded by this user, or show all if admin/only user
  const userBots = allBots.filter(b => b.senderId === senderId || b.senderUsername === senderUsername);
  const displayBots = userBots.length > 0 ? userBots : allBots;

  if (displayBots.length === 0) {
    const text =
      `📋 <b><u>MY HOSTED BOTS</u></b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `You don't have any hosted bots yet!\n\n` +
      `📎 <b>To host a bot:</b> Simply send your <b>.py</b> or <b>.zip</b> file right here in this chat!`;

    const reply_markup = {
      inline_keyboard: [
        [{ text: '📤 How to Host', callback_data: 'how_to_host' }],
        [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
      ]
    };

    if (messageId) {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup });
    } else {
      await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup });
    }
    return;
  }

  let text =
    `📋 <b><u>YOUR HOSTED PYTHON BOTS (${displayBots.length})</u></b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const keyboard: any[][] = [];

  displayBots.slice(0, 8).forEach((b, idx) => {
    const statusIcon = b.status === 'RUNNING' ? '🟢 RUNNING' : '🔴 STOPPED';
    text += `${idx + 1}. 🤖 <b>${b.name}</b>\n`;
    text += `   • Status: <b>${statusIcon}</b> (PID: ${b.pid || 'N/A'})\n`;
    text += `   • ID: <code>${b.id}</code> | Uptime: ${Math.floor((b.uptimeSeconds || 0) / 60)}m\n\n`;

    keyboard.push([
      { text: `📋 Logs: ${b.name.substring(0, 15)}`, callback_data: `logs_${b.id}` },
      b.status === 'RUNNING'
        ? { text: '🔄 Restart', callback_data: `restart_${b.id}` }
        : { text: '▶️ Start', callback_data: `start_${b.id}` }
    ]);
  });

  keyboard.push([{ text: '🔙 Back to Menu', callback_data: 'back_main' }]);

  if (messageId) {
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  }
}

/**
 * Show server system status
 */
async function showServerStatus(bot: any, chatId: number, messageId?: number) {
  const bots = getHostedPythonBots();
  const runningCount = bots.filter(b => b.status === 'RUNNING').length;
  const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
  const usedMemMB = totalMemMB - freeMemMB;

  const text =
    `📊 <b><u>TELEHOST SERVER STATUS</u></b> ☁️\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🖥 <b>Platform:</b> Linux (Python 3.10 Cloud Sandbox)\n` +
    `🟢 <b>Active Python Workers:</b> <b>${runningCount} RUNNING</b> / ${bots.length} Total\n` +
    `💾 <b>RAM Usage:</b> ${usedMemMB} MB / ${totalMemMB} MB\n` +
    `⚡ <b>Process Watchdog:</b> 24/7 Active\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Ready to host your next Telegram bot!</i>`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '📋 My Hosted Bots', callback_data: 'my_bots' }],
      [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
    ]
  };

  if (messageId) {
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup });
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup });
  }
}
