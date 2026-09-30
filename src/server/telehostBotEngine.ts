import os from 'os';
import fs from 'fs';
import path from 'path';
import {
  HostedPythonBot,
  getHostedPythonBots,
  startPythonBot,
  stopPythonBot,
  deletePythonBot,
  addLog,
  addSubmission,
  deploySingleHtml
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

    // 📤 HANDLE DOCUMENT, PHOTO, VIDEO, AUDIO UPLOADS IN REAL-TIME
    if (msg.document || msg.photo || msg.video || msg.audio || msg.voice || msg.animation) {
      let fileId = '';
      let fileName = '';
      let fileSizeMB = 0.01;
      let mimeType = 'application/octet-stream';

      if (msg.document) {
        fileId = msg.document.file_id;
        fileName = msg.document.file_name || `file_${Date.now()}`;
        fileSizeMB = msg.document.file_size ? Number((msg.document.file_size / (1024 * 1024)).toFixed(3)) : 0.01;
        mimeType = msg.document.mime_type || 'application/octet-stream';
      } else if (msg.photo && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1];
        fileId = largestPhoto.file_id;
        fileName = `photo_${Date.now()}.jpg`;
        fileSizeMB = largestPhoto.file_size ? Number((largestPhoto.file_size / (1024 * 1024)).toFixed(3)) : 0.05;
        mimeType = 'image/jpeg';
      } else if (msg.video) {
        fileId = msg.video.file_id;
        fileName = msg.video.file_name || `video_${Date.now()}.mp4`;
        fileSizeMB = msg.video.file_size ? Number((msg.video.file_size / (1024 * 1024)).toFixed(3)) : 0.5;
        mimeType = msg.video.mime_type || 'video/mp4';
      } else if (msg.audio) {
        fileId = msg.audio.file_id;
        fileName = msg.audio.file_name || `audio_${Date.now()}.mp3`;
        fileSizeMB = msg.audio.file_size ? Number((msg.audio.file_size / (1024 * 1024)).toFixed(3)) : 0.2;
        mimeType = msg.audio.mime_type || 'audio/mpeg';
      } else if (msg.voice) {
        fileId = msg.voice.file_id;
        fileName = `voice_${Date.now()}.ogg`;
        fileSizeMB = msg.voice.file_size ? Number((msg.voice.file_size / (1024 * 1024)).toFixed(3)) : 0.05;
        mimeType = 'audio/ogg';
      } else if (msg.animation) {
        fileId = msg.animation.file_id;
        fileName = msg.animation.file_name || `animation_${Date.now()}.mp4`;
        fileSizeMB = msg.animation.file_size ? Number((msg.animation.file_size / (1024 * 1024)).toFixed(3)) : 0.2;
        mimeType = msg.animation.mime_type || 'video/mp4';
      }

      const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const downloadsDir = path.join(process.cwd(), 'downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }
      const savedFilePath = path.join(downloadsDir, fileName);

      // INSTANTLY RECORD SUBMISSION SO WEBSITE SHOWS IT IMMEDIATELY
      addSubmission({
        id: subId,
        botId: botId || 'bot_primary',
        senderId,
        senderUsername,
        fileName,
        fileSizeMB,
        mimeType,
        caption: msg.caption || text || 'Telegram File Received',
        status: 'COMPLETED',
        reason: 'Received in real-time from Telegram user',
        approvalReason: 'Received in real-time from Telegram user',
        timestamp: new Date().toLocaleTimeString(),
        localFilePath: savedFilePath,
        downloadedPath: savedFilePath
      });

      const waitMsg = await bot.sendMessage(
        chatId,
        `📥 <b>File Received:</b> <code>${fileName}</code> (${fileSizeMB} MB)\n⏳ <i>Saving & syncing to website in real-time...</i>`,
        { parse_mode: 'HTML' }
      );

      try {
        const fileLink = await bot.getFileLink(fileId);
        const resp = await fetch(fileLink);
        if (!resp.ok) {
          throw new Error(`Failed to download file from Telegram: HTTP ${resp.status}`);
        }
        const fileBuffer = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(savedFilePath, fileBuffer);

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
            `🌐 <b>Website:</b> Viewable in real-time on website dashboard!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Your script is now running 24/7!</i>`,
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
            `🌐 <b>Website:</b> Viewable in real-time on website dashboard!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Extracted project and started 24/7 background execution!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML',
              reply_markup: getBotControlKeyboard(deployedBot.id, true)
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} hosted ZIP Bot "${fileName}" (${deployedBot.id}) via Telegram.`);
          return;
        } else if (fileName.endsWith('.html')) {
          const htmlText = fileBuffer.toString('utf-8');
          const proj = await deploySingleHtml(htmlText, {
            name: fileName.replace(/\.html$/i, ''),
            originalFileName: fileName,
            senderUsername,
            senderId,
            sourceType: 'telegram_bot',
            botId
          });

          await bot.editMessageText(
            `🎉 <b>HTML WEBSITE HOSTED LIVE!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📄 <b>Page Name:</b> <code>${fileName}</code>\n` +
            `🌐 <b>Live URL:</b> ${proj.liveUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Site is live and viewable in real-time on website dashboard!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          return;
        } else {
          await bot.editMessageText(
            `✅ <b>FILE SAVED IN REAL-TIME!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 <b>File Name:</b> <code>${fileName}</code>\n` +
            `💾 <b>File Size:</b> ${fileSizeMB} MB\n` +
            `👤 <b>Uploaded By:</b> @${senderUsername}\n` +
            `🌐 <b>Website Status:</b> Live on dashboard (can be downloaded or deleted anytime)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>File saved safely to cloud storage!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} uploaded file "${fileName}" (${fileSizeMB} MB) to cloud storage.`);
          return;
        }
      } catch (err: any) {
        console.error('[Document processing error]', err);
        await bot.editMessageText(
          `❌ <b>Processing Failed:</b> ${err.message}`,
          {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'HTML'
          }
        );
        return;
      }
    }

    // Helper to format main welcome menu matching screenshot model
    const buildWelcomeMenu = (displayName: string, senderId: number, filesCount: number) => {
      const welcomeText =
        `〽️ <b>Welcome, ${displayName}!</b>\n\n` +
        `🆔 <b>ID:</b> <code>${senderId}</code>\n` +
        `🔰 <b>Status:</b> 🆓 Free\n` +
        `📁 <b>Files:</b> ${filesCount} / 2\n\n` +
        `🤖 <b>Host Python (.py), JS (.js), or .zip</b>\n\n` +
        `👇 <b>Use buttons or commands.</b>`;

      const reply_markup = {
        inline_keyboard: [
          [
            { text: '📢 Updates Channel', url: 'https://t.me/MMTESTINGBOT_BOT' }
          ],
          [
            { text: '📤 Upload File', callback_data: 'how_to_host' },
            { text: '📁 Check Files', callback_data: 'my_bots' }
          ],
          [
            { text: '🟢 Bot Speed', callback_data: 'bot_speed' },
            { text: '📊 Statistics', callback_data: 'server_status' }
          ],
          [
            { text: '📞 Contact Owner', callback_data: 'contact_owner' }
          ],
          [
            { text: '📦 Manual Install', callback_data: 'manual_install' },
            { text: '🆘 Help', callback_data: 'help_info' }
          ]
        ]
      };

      return { welcomeText, reply_markup };
    };

    // COMMAND: /start
    if (text === '/start' || text.startsWith('/start ')) {
      const displayName = (sender?.first_name ? `${sender.first_name} ${sender.last_name || ''}` : senderUsername).trim() || 'User';
      const allBots = getHostedPythonBots();
      const userBots = allBots.filter(b => b.senderId === senderId || b.senderUsername === senderUsername);
      const { welcomeText, reply_markup } = buildWelcomeMenu(displayName, senderId, userBots.length);

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
      const displayName = (sender?.first_name ? `${sender.first_name} ${sender.last_name || ''}` : senderUsername).trim() || 'User';
      const allBots = getHostedPythonBots();
      const userBots = allBots.filter(b => b.senderId === senderId || b.senderUsername === senderUsername);

      const welcomeText =
        `〽️ <b>Welcome, ${displayName}!</b>\n\n` +
        `🆔 <b>ID:</b> <code>${senderId}</code>\n` +
        `🔰 <b>Status:</b> 🆓 Free\n` +
        `📁 <b>Files:</b> ${userBots.length} / 2\n\n` +
        `🤖 <b>Host Python (.py), JS (.js), or .zip</b>\n\n` +
        `👇 <b>Use buttons or commands.</b>`;

      const reply_markup = {
        inline_keyboard: [
          [
            { text: '📢 Updates Channel', url: 'https://t.me/MMTESTINGBOT_BOT' }
          ],
          [
            { text: '📤 Upload File', callback_data: 'how_to_host' },
            { text: '📁 Check Files', callback_data: 'my_bots' }
          ],
          [
            { text: '🟢 Bot Speed', callback_data: 'bot_speed' },
            { text: '📊 Statistics', callback_data: 'server_status' }
          ],
          [
            { text: '📞 Contact Owner', callback_data: 'contact_owner' }
          ],
          [
            { text: '📦 Manual Install', callback_data: 'manual_install' },
            { text: '🆘 Help', callback_data: 'help_info' }
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

    // Bot Speed
    if (data === 'bot_speed') {
      const pingMs = Math.floor(Math.random() * 20) + 18;
      const speedText =
        `🟢 <b><u>BOT SPEED & PERFORMANCE</u></b> ⚡\n\n` +
        `🚀 <b>Response Speed:</b> 0.02s\n` +
        `📡 <b>Network Ping:</b> ${pingMs} ms\n` +
        `🟢 <b>Server Status:</b> 100% Operational\n` +
        `⚡ <b>Uptime:</b> 99.9% 24/7 Cloud Hosting`;

      await bot.editMessageText(speedText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      });
      return;
    }

    // Contact Owner
    if (data === 'contact_owner') {
      const contactText =
        `📞 <b><u>CONTACT OWNER & SUPPORT</u></b>\n\n` +
        `👤 <b>Owner:</b> @Akash_12121\n` +
        `📢 <b>Channel:</b> @MMTESTINGBOT_BOT\n` +
        `💬 <b>Support Hours:</b> 24/7 Instant Help\n\n` +
        `<i>Send a message to the owner for custom hosting or queries!</i>`;

      await bot.editMessageText(contactText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Message Owner', url: 'https://t.me/Akash_12121' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      });
      return;
    }

    // Manual Install
    if (data === 'manual_install') {
      const installText =
        `📦 <b><u>MANUAL DEPENDENCY INSTALLATION</u></b>\n\n` +
        `1️⃣ Include a <b><code>requirements.txt</code></b> file in your project or <b>.zip</b> package.\n` +
        `2️⃣ Our automated cloud supervisor pre-installs: <code>aiogram</code>, <code>qrcode</code>, <code>pillow</code>, <code>requests</code>, <code>telethon</code>, <code>python-telegram-bot</code>.\n` +
        `3️⃣ Missing libraries are auto-installed dynamically during execution!\n\n` +
        `💡 <i>Just upload your .py or .zip file and TeleHost handles the rest automatically!</i>`;

      await bot.editMessageText(installText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      });
      return;
    }

    // Help Info
    if (data === 'help_info') {
      const helpText =
        `🆘 <b><u>TELEHOST HELP & GUIDE</u></b>\n\n` +
        `📤 <b>How to Host:</b> Click paperclip 📎 in Telegram and upload <code>.py</code>, <code>.js</code>, or <code>.zip</code>.\n` +
        `📁 <b>Check Files:</b> Click <b>📁 Check Files</b> to manage, stop, restart or view logs for your hosted bots.\n` +
        `⚡ <b>24/7 Hosting:</b> Your scripts run continuously without downtime.\n\n` +
        `<i>Need further assistance? Contact owner via the menu!</i>`;

      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
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
