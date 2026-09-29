import { execSync } from 'child_process';
import { addLog } from './botManager';

export const ADMIN_CHAT_ID = 8808556338;

/**
 * SQLite Query Helper for Akash FF Panel Database (Cuibcc.db)
 */
export function queryBotDb(sql: string, params: any[] = []): any {
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
    const out = execSync('python3', { input: pyScript, encoding: 'utf-8', timeout: 5000 });
    return JSON.parse(out.trim());
  } catch (err: any) {
    console.error('[queryBotDb error]', err.message);
    return [];
  }
}

/**
 * Fetch or auto-register user in Cuibcc.db
 */
export function getOrRegisterUser(sender: any): any {
  const userId = sender?.id;
  const firstName = sender?.first_name || 'Gamer';
  const username = sender?.username || '';

  const rows = queryBotDb('SELECT * FROM users WHERE user_id=?', [userId]);
  if (!rows || rows.length === 0) {
    queryBotDb(
      'INSERT INTO users (user_id, first_name, username, balance, account_type, orders_count, spent, joined_date, is_reseller, is_vip, is_banned) VALUES (?, ?, ?, 0.0, "Regular", 0, 0.0, datetime("now"), 0, 0, 0)',
      [userId, firstName, username]
    );
    const newRows = queryBotDb('SELECT * FROM users WHERE user_id=?', [userId]);
    return newRows[0] || {
      user_id: userId,
      first_name: firstName,
      username,
      balance: 0,
      account_type: 'Regular',
      is_vip: 0,
      is_reseller: 0,
      orders_count: 0,
      spent: 0,
      is_banned: 0
    };
  }
  return rows[0];
}

/**
 * Generate Main Menu Screen
 */
export function getAkashFFStartMenu(sender: any) {
  const u = getOrRegisterUser(sender);
  const isVip = u.is_vip === 1;
  const isReseller = u.is_reseller === 1;
  const isAdmin = sender?.id === ADMIN_CHAT_ID;

  const levelStr = isVip ? '🌟 VIP Member' : (isReseller ? '👑 Reseller' : '👤 Regular User');

  const text = 
    `🔥 <b>WELCOME TO AKASH FF PANEL!</b> 🔥\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 <b>Official Free Fire VIP Panels & Keys Store</b>\n` +
    `👑 <b>Admin:</b> <a href="https://t.me/Akash_12121">@Akash_12121</a> (8808556338)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Name:</b> ${u.first_name || 'Gamer'}\n` +
    `🆔 <b>User ID:</b> <code>${u.user_id}</code>\n` +
    `💰 <b>Your Balance:</b> <b>₹${(u.balance || 0).toFixed(2)}</b>\n` +
    `🔰 <b>Account Level:</b> <code>${levelStr}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👇 <i>Select an option below to purchase panels, view keys, or add balance:</i>`;

  const keyboard: any[] = [
    [
      { text: '🛒 Product Store', callback_data: 'menu_shop' }
    ],
    [
      { text: '👤 My Profile (Users Info)', callback_data: 'menu_profile' },
      { text: '💳 Add Balance', callback_data: 'menu_add_balance' }
    ],
    [
      { text: '📖 Tutorials', callback_data: 'menu_how_to' },
      { text: '📞 Support', callback_data: 'menu_support' }
    ],
    [
      { text: '🌟 VIP Membership', callback_data: 'menu_vip' }
    ]
  ];

  if (isAdmin) {
    keyboard.push([
      { text: '⚙️ Admin Terminal', callback_data: 'menu_admin' }
    ]);
  }

  return { text, reply_markup: { inline_keyboard: keyboard } };
}

/**
 * Generate Category Selection Screen
 */
export function getCategoryMenu() {
  const text = 
    `🛒 <b><u>AKASH FF PANEL — SELECT CATEGORY</u></b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Choose your desired Free Fire Panel category below:`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '📱 ANDROID NON ROOT PANEL', callback_data: 'cat_ANDROID_NON_ROOT' }],
      [{ text: '🛡️ ANDROID ROOT PANEL', callback_data: 'cat_ANDROID_ROOT' }],
      [{ text: '💻 PC PANEL', callback_data: 'cat_PC_PANEL' }],
      [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]
    ]
  };

  return { text, reply_markup };
}

/**
 * Generate Product List for a Category
 */
export function getProductsForCategory(catKeyword: string, catDisplayName: string) {
  const products = queryBotDb(
    'SELECT * FROM products WHERE category LIKE ? AND is_active=1 ORDER BY price_inr ASC',
    [`%${catKeyword}%`]
  );

  let text = 
    `📂 <b><u>${catDisplayName}</u></b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👇 <i>Tap any package below to inspect price & purchase:</i>\n\n`;

  const buttons: any[] = [];

  if (!products || products.length === 0) {
    text += `<i>No active products found in this category currently.</i>`;
  } else {
    products.forEach((p: any) => {
      const keyCount = queryBotDb('SELECT COUNT(*) as count FROM product_keys WHERE product_id=? AND is_used=0', [p.id]);
      const stock = keyCount[0]?.count || 0;
      text += `• <b>${p.name}</b> — ₹${p.price_inr} (${stock > 0 ? `🟢 ${stock} in stock` : '🔴 Out of stock'})\n`;
      buttons.push([
        { text: `📦 ${p.name} (₹${p.price_inr})`, callback_data: `view_prod_${p.id}` }
      ]);
    });
  }

  buttons.push([{ text: '🔙 Back to Categories', callback_data: 'menu_shop' }]);
  return { text, reply_markup: { inline_keyboard: buttons } };
}

/**
 * Generate Product Detail View
 */
export function getProductDetail(productId: number, user: any) {
  const prods = queryBotDb('SELECT * FROM products WHERE id=?', [productId]);
  if (!prods || prods.length === 0) return null;
  const p = prods[0];

  const keyCount = queryBotDb('SELECT COUNT(*) as count FROM product_keys WHERE product_id=? AND is_used=0', [p.id]);
  const available = keyCount[0]?.count || 0;

  const isVip = user?.is_vip === 1;
  const isReseller = user?.is_reseller === 1;

  let effectivePrice = p.price_inr;
  if (isReseller && p.reseller_price > 0) {
    effectivePrice = p.reseller_price;
  } else if (isVip) {
    effectivePrice = Math.round(p.price_inr * 0.9);
  }

  const text = 
    `🎮 <b><u>${p.name}</u></b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📂 <b>Category:</b> <code>${p.category}</code>\n` +
    `⏳ <b>Validity:</b> <b>${p.validity}</b>\n` +
    `📱 <b>Device Limit:</b> <b>${p.device_limit}</b>\n` +
    `💰 <b>Price:</b> <b>₹${effectivePrice}</b> ${isVip ? '(🌟 VIP Discount)' : (isReseller ? '(👑 Reseller Price)' : '')}\n` +
    `🔑 <b>Instant Stock:</b> <b>${available > 0 ? `🟢 ${available} Keys Available` : '🔴 Out of Stock'}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <i>Your Wallet:</i> <b>₹${(user?.balance || 0).toFixed(2)}</b>\n\n` +
    `👇 <i>Tap below to instantly buy this panel key:</i>`;

  const buttons = [
    [{ text: `🛒 Buy Now — ₹${effectivePrice}`, callback_data: `buy_prod_${p.id}` }],
    [
      { text: '💳 Add Balance', callback_data: 'menu_add_balance' },
      { text: '🔙 Back to Products', callback_data: 'menu_shop' }
    ]
  ];

  return { text, reply_markup: { inline_keyboard: buttons } };
}

/**
 * Generate User Profile & Users Info Screen
 */
export function getUserProfileScreen(sender: any) {
  const u = getOrRegisterUser(sender);
  const orders = queryBotDb(
    'SELECT product_name, delivered_key, purchase_date, price_paid FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 5',
    [sender.id]
  );

  let historyText = '';
  if (!orders || orders.length === 0) {
    historyText = '<i>No purchases yet. Your vault is empty.</i>';
  } else {
    orders.forEach((o: any) => {
      historyText += `📦 <b>${o.product_name}</b> (₹${o.price_paid})\n🔑 <code>${o.delivered_key}</code>\n📅 ${o.purchase_date}\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    });
  }

  const text = 
    `🛡️ <b><u>— YOUR SECURE PROFILE & USERS INFO —</u></b> 🛡️\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>Grid ID:</b> <code>${u.user_id}</code>\n` +
    `👤 <b>Name:</b> <b>${u.first_name}</b> ${u.username ? `(@${u.username})` : ''}\n` +
    `🔰 <b>Account Level:</b> <code>${u.is_vip ? '🌟 VIP Member' : (u.is_reseller ? '👑 Reseller' : '👤 Regular User')}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Wallet Balance:</b> <b>₹${(u.balance || 0).toFixed(2)}</b>\n` +
    `📦 <b>Total Orders:</b> <b>${u.orders_count || 0}</b>\n` +
    `💸 <b>Total Spent:</b> <b>₹${(u.spent || 0).toFixed(2)}</b>\n` +
    `📅 <b>Joined Date:</b> <i>${u.joined_date || 'N/A'}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🧾 <b><u>— RECENT DELIVERED KEYS (LAST 5) —</u></b>\n\n` +
    `${historyText}`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '💳 Add Balance', callback_data: 'menu_add_balance' },
        { text: '🛒 Shop Panels', callback_data: 'menu_shop' }
      ],
      [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
    ]
  };

  return { text, reply_markup };
}

/**
 * Generate Add Balance Screen
 */
export function getAddBalanceScreen(sender: any) {
  const u = getOrRegisterUser(sender);
  const text = 
    `💳 <b><u>ADD BALANCE — FAST UPI & QR DEPOSIT</u></b> 💳\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Top up your wallet balance instantly to purchase Free Fire Panel keys.\n\n` +
    `🏦 <b>UPI Payment Details:</b>\n` +
    `🆔 <b>UPI ID:</b> <code>akashpanel@fam</code>\n` +
    `📛 <b>Payee Name:</b> <b>AKASH FF PANEL</b>\n` +
    `📱 <b>Supported Apps:</b> Google Pay / PhonePe / Paytm / FamPay / BHIM\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <b>How to Deposit:</b>\n` +
    `1️⃣ Send desired payment to <code>akashpanel@fam</code>.\n` +
    `2️⃣ Copy the <b>12-digit UPI UTR / Transaction Ref ID</b>.\n` +
    `3️⃣ Send the screenshot or UTR to Admin <a href="https://t.me/Akash_12121">@Akash_12121</a>.\n` +
    `✅ <i>Your balance will be credited into your account within 2 minutes!</i>\n\n` +
    `💰 <i>Current Balance:</i> <b>₹${(u.balance || 0).toFixed(2)}</b>`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '👨‍💻 Contact Admin (@Akash_12121)', url: 'https://t.me/Akash_12121' }],
      [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]
    ]
  };

  return { text, reply_markup };
}

/**
 * Mount Akash FF Panel Telegram Handlers onto the live TelegramBot instance
 */
export function setupAkashFFPanelBot(
  bot: any,
  botId: string,
  me: any,
  actions?: {
    deployPythonBotFromFile?: (code: string, meta: any) => Promise<any>;
    deployPythonBotFromZip?: (buffer: Buffer, meta: any) => Promise<any>;
  }
) {
  const processedMessageKeys = new Set<string>();

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

    // Check if user is banned
    const userCheck = queryBotDb('SELECT is_banned FROM users WHERE user_id=?', [senderId]);
    if (userCheck && userCheck[0]?.is_banned === 1 && senderId !== ADMIN_CHAT_ID) {
      await bot.sendMessage(chatId, '🚫 <b>ACCESS DENIED:</b> You are banned from Akash FF Panel. Contact support if this is a mistake.', { parse_mode: 'HTML' });
      return;
    }

    // Handle Document / File upload (.py or .zip)
    if (msg.document) {
      const doc = msg.document;
      const fileName = doc.file_name || 'bot.py';
      const fileId = doc.file_id;
      const fileSizeMB = doc.file_size ? Number((doc.file_size / (1024 * 1024)).toFixed(3)) : 0.01;

      const waitMsg = await bot.sendMessage(
        chatId,
        `📥 <b>File Received:</b> <code>${fileName}</code> (${fileSizeMB} MB)\n⏳ <i>Analyzing code & deploying 24/7 Python cloud worker...</i>`,
        { parse_mode: 'HTML' }
      );

      try {
        const fileLink = await bot.getFileLink(fileId);
        const resp = await fetch(fileLink);
        if (!resp.ok) {
          throw new Error(`Failed to download file from Telegram: HTTP ${resp.status}`);
        }
        const fileBuffer = Buffer.from(await resp.arrayBuffer());

        if (fileName.endsWith('.py') && actions?.deployPythonBotFromFile) {
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
            `🚀 <b>PYTHON BOT DEPLOYED & ONLINE!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 <b>Bot Name:</b> <code>${deployedBot.name}</code>\n` +
            `🆔 <b>Worker ID:</b> <code>${deployedBot.id}</code>\n` +
            `📊 <b>Status:</b> 🟢 <b>RUNNING (PID: ${deployedBot.pid || 'Active'})</b>\n` +
            `🐍 <b>Runtime:</b> Python 3.10 (aiogram + qrcode + aiohttp)\n` +
            `⚡ <b>Supervision:</b> 24/7 Cloud Watchdog Active\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Your script is now executing live in the cloud 24/7!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} deployed ${fileName} (${deployedBot.id}) via Telegram.`);
          return;
        } else if (fileName.endsWith('.zip') && actions?.deployPythonBotFromZip) {
          const deployedBot = await actions.deployPythonBotFromZip(fileBuffer, {
            name: fileName.replace(/\.zip$/i, ''),
            originalFileName: fileName,
            senderUsername,
            senderId,
            sourceType: 'telegram_bot',
            botId
          });

          await bot.editMessageText(
            `📦 <b>ZIP PACKAGE DEPLOYED & ONLINE!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 <b>Project:</b> <code>${deployedBot.name}</code>\n` +
            `🆔 <b>Worker ID:</b> <code>${deployedBot.id}</code>\n` +
            `📊 <b>Status:</b> 🟢 <b>RUNNING (PID: ${deployedBot.pid || 'Active'})</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Extracted dependencies and started 24/7 execution!</i>`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          addLog(botId, 'SUCCESS', `User @${senderUsername} deployed zip ${fileName} via Telegram.`);
          return;
        } else {
          await bot.editMessageText(
            `⚠️ <b>Unsupported file format:</b> <code>${fileName}</code>\nPlease send a <b>.py</b> Python script or a <b>.zip</b> project archive.`,
            {
              chat_id: chatId,
              message_id: waitMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          return;
        }
      } catch (err: any) {
        console.error('[Document deploy error]', err);
        await bot.editMessageText(
          `❌ <b>Deployment Error:</b> ${err.message}`,
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
      const menu = getAkashFFStartMenu(sender);
      await bot.sendMessage(chatId, menu.text, {
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup
      });
      addLog(botId, 'INFO', `User @${senderUsername} (${senderId}) opened Akash FF Panel.`);
      return;
    }

    // COMMAND: /profile or /userinfo
    if (text === '/profile' || text === '/userinfo') {
      const profile = getUserProfileScreen(sender);
      await bot.sendMessage(chatId, profile.text, {
        parse_mode: 'HTML',
        reply_markup: profile.reply_markup
      });
      return;
    }

    // COMMAND: /shop or /store
    if (text === '/shop' || text === '/store' || text === '/panels') {
      const catMenu = getCategoryMenu();
      await bot.sendMessage(chatId, catMenu.text, {
        parse_mode: 'HTML',
        reply_markup: catMenu.reply_markup
      });
      return;
    }

    // COMMAND: /balance or /addbalance
    if (text === '/balance' || text === '/addbalance') {
      const balMenu = getAddBalanceScreen(sender);
      await bot.sendMessage(chatId, balMenu.text, {
        parse_mode: 'HTML',
        reply_markup: balMenu.reply_markup
      });
      return;
    }

    // COMMAND: /admin (Only for Admin ID 8808556338)
    if (text === '/admin' && senderId === ADMIN_CHAT_ID) {
      const uCount = queryBotDb('SELECT COUNT(*) as count FROM users')[0]?.count || 0;
      const pCount = queryBotDb('SELECT COUNT(*) as count FROM products')[0]?.count || 0;
      const kCount = queryBotDb('SELECT COUNT(*) as count FROM product_keys WHERE is_used=0')[0]?.count || 0;
      const totalBal = queryBotDb('SELECT SUM(balance) as total FROM users')[0]?.total || 0;

      await bot.sendMessage(
        chatId,
        `⚙️ <b><u>AKASH FF PANEL ADMIN TERMINAL</u></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👑 <b>Admin ID:</b> <code>${ADMIN_CHAT_ID}</code>\n` +
        `👥 <b>Registered Users:</b> <code>${uCount}</code>\n` +
        `📦 <b>Panel Products:</b> <code>${pCount}</code>\n` +
        `🔑 <b>Available Keys in Stock:</b> <code>${kCount}</code>\n` +
        `💰 <b>Total User Balance:</b> <code>₹${totalBal.toFixed(2)}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Use the Web Console to manage products, bulk generate keys, and modify user balances.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Download Users Info Dump', callback_data: 'admin_dump_users' }],
              [{ text: '🔙 Main Menu', callback_data: 'back_main' }]
            ]
          }
        }
      );
      return;
    }
  });

  // 2. CALLBACK QUERY HANDLER
  bot.on('callback_query', async (query: any) => {
    if (bot._isStopped) return;
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const sender = query.from;
    const senderId = sender?.id;

    const updateScreen = async (text: string, reply_markup?: any) => {
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup
        });
      } catch (_) {
        await bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup
        });
      }
    };

    // 1. Back to Main Menu
    if (data === 'back_main') {
      const menu = getAkashFFStartMenu(sender);
      await updateScreen(menu.text, menu.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 2. Product Store
    if (data === 'menu_shop') {
      const catMenu = getCategoryMenu();
      await updateScreen(catMenu.text, catMenu.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 3. Category: Android Non Root
    if (data === 'cat_ANDROID_NON_ROOT') {
      const screen = getProductsForCategory('NON ROOT', '📱 ANDROID NON ROOT PANEL');
      await updateScreen(screen.text, screen.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 4. Category: Android Root
    if (data === 'cat_ANDROID_ROOT') {
      const screen = getProductsForCategory('ANDROID ROOT', '🛡️ ANDROID ROOT PANEL');
      await updateScreen(screen.text, screen.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 5. Category: PC Panel
    if (data === 'cat_PC_PANEL') {
      const screen = getProductsForCategory('PC', '💻 PC PANEL');
      await updateScreen(screen.text, screen.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 6. View Single Product
    if (data.startsWith('view_prod_')) {
      const pid = parseInt(data.replace('view_prod_', ''), 10);
      const user = getOrRegisterUser(sender);
      const screen = getProductDetail(pid, user);
      if (screen) {
        await updateScreen(screen.text, screen.reply_markup);
      } else {
        await bot.answerCallbackQuery(query.id, { text: 'Product not found!', show_alert: true });
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 7. Instant Buy Product Key
    if (data.startsWith('buy_prod_')) {
      const pid = parseInt(data.replace('buy_prod_', ''), 10);
      const user = getOrRegisterUser(sender);
      const prods = queryBotDb('SELECT * FROM products WHERE id=?', [pid]);

      if (!prods || prods.length === 0) {
        return await bot.answerCallbackQuery(query.id, { text: 'Product not found!', show_alert: true });
      }
      const p = prods[0];

      let effectivePrice = p.price_inr;
      if (user.is_reseller === 1 && p.reseller_price > 0) {
        effectivePrice = p.reseller_price;
      } else if (user.is_vip === 1) {
        effectivePrice = Math.round(p.price_inr * 0.9);
      }

      // Check user balance
      if ((user.balance || 0) < effectivePrice) {
        await bot.answerCallbackQuery(query.id, {
          text: `❌ Insufficient Balance!\nRequired: ₹${effectivePrice}\nYour Balance: ₹${(user.balance || 0).toFixed(2)}\nPlease tap "Add Balance" to top up.`,
          show_alert: true
        });
        const balMenu = getAddBalanceScreen(sender);
        await updateScreen(balMenu.text, balMenu.reply_markup);
        return;
      }

      // Fetch key
      const keys = queryBotDb('SELECT * FROM product_keys WHERE product_id=? AND is_used=0 LIMIT 1', [p.id]);
      if (!keys || keys.length === 0) {
        return await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Sorry, this package is currently Out of Stock! Admin will add new keys shortly.',
          show_alert: true
        });
      }
      const keyItem = keys[0];

      // Deduct balance, mark key as used, record order
      queryBotDb(
        'UPDATE users SET balance=balance - ?, orders_count=orders_count + 1, spent=spent + ? WHERE user_id=?',
        [effectivePrice, effectivePrice, user.user_id]
      );
      queryBotDb('UPDATE product_keys SET is_used=1 WHERE id=?', [keyItem.id]);
      queryBotDb(
        'INSERT INTO orders (user_id, product_name, delivered_key, purchase_date, price_paid) VALUES (?, ?, ?, datetime("now"), ?)',
        [user.user_id, p.name, keyItem.key_text, effectivePrice]
      );

      addLog(botId, 'SUCCESS', `User @${sender.username || user.user_id} purchased ${p.name} for ₹${effectivePrice}`);

      // Notify user
      await updateScreen(
        `🎉 <b><u>PURCHASE SUCCESSFUL! KEY DELIVERED!</u></b> 🎉\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Product:</b> <b>${p.name}</b>\n` +
        `⏳ <b>Validity:</b> ${p.validity}\n` +
        `💰 <b>Amount Deducted:</b> ₹${effectivePrice}\n\n` +
        `🔑 <b>YOUR FF PANEL VIP KEY:</b>\n` +
        `<code>${keyItem.key_text}</code>\n\n` +
        `📱 <b>Download APK / Loader:</b>\n` +
        `<a href="${p.apk_link}">${p.apk_link}</a>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>Copy your key above and paste it inside the FF Panel login screen. Do not share your key!</i>`,
        {
          inline_keyboard: [
            [{ text: '👤 My Profile & Keys Vault', callback_data: 'menu_profile' }],
            [{ text: '🔙 Back to Store', callback_data: 'menu_shop' }]
          ]
        }
      );

      // Notify admin
      try {
        await bot.sendMessage(
          ADMIN_CHAT_ID,
          `🛒 <b><u>NEW FF PANEL ORDER PROCESSED!</u></b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>User:</b> ${user.first_name} (@${user.username || 'None'})\n` +
          `🆔 <b>User ID:</b> <code>${user.user_id}</code>\n` +
          `📦 <b>Product:</b> <b>${p.name}</b>\n` +
          `🔑 <b>Delivered Key:</b> <code>${keyItem.key_text}</code>\n` +
          `💰 <b>Paid:</b> ₹${effectivePrice}\n` +
          `📅 <b>Time:</b> ${new Date().toLocaleString()}`,
          { parse_mode: 'HTML' }
        );
      } catch (_) {}

      await bot.answerCallbackQuery(query.id, { text: '🎉 Key Delivered Successfully!' });
      return;
    }

    // 8. My Profile / Users Info
    if (data === 'menu_profile') {
      const profile = getUserProfileScreen(sender);
      await updateScreen(profile.text, profile.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 9. Add Balance
    if (data === 'menu_add_balance') {
      const balScreen = getAddBalanceScreen(sender);
      await updateScreen(balScreen.text, balScreen.reply_markup);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 10. Tutorials
    if (data === 'menu_how_to') {
      await updateScreen(
        `📖 <b><u>AKASH FF PANEL SETUP TUTORIAL</u></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `1️⃣ <b>Download APK:</b> Download the FF Panel APK from your delivered link.\n` +
        `2️⃣ <b>Grant Permissions:</b> Allow Floating Window and Storage access.\n` +
        `3️⃣ <b>Login with Key:</b> Copy your VIP Key from "My Profile" and paste it in.\n` +
        `4️⃣ <b>Inject & Play:</b> Open Free Fire and toggle ESP, Aimbot, and Bypass!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 Need help? Contact Admin <a href="https://t.me/Akash_12121">@Akash_12121</a>.`,
        {
          inline_keyboard: [
            [{ text: '🛒 Browse Panels', callback_data: 'menu_shop' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 11. Support
    if (data === 'menu_support') {
      await updateScreen(
        `📞 <b><u>AKASH FF PANEL 24/7 SUPPORT</u></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `For any issues with Key Login, Wallet Recharge, or APK setup:\n\n` +
        `👑 <b>Admin:</b> <a href="https://t.me/Akash_12121">@Akash_12121</a>\n` +
        `🆔 <b>Admin ID:</b> <code>8808556338</code>\n` +
        `📢 <b>Updates Channel:</b> @AKASHFFPANEL11BOT`,
        {
          inline_keyboard: [
            [{ text: '💬 Chat with Admin (@Akash_12121)', url: 'https://t.me/Akash_12121' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 12. VIP Membership
    if (data === 'menu_vip') {
      await updateScreen(
        `🌟 <b><u>AKASH FF PANEL VIP CLUB</u></b> 🌟\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 <b>VIP Benefits:</b>\n` +
        `• <b>Flat 10% Discount</b> on ALL Panel Packages!\n` +
        `• Priority 24/7 Admin Support\n` +
        `• Early access to new FF updates & bypasses\n\n` +
        `💳 <b>Lifetime VIP Upgrade:</b> ₹1000.00\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Contact Admin <a href="https://t.me/Akash_12121">@Akash_12121</a> to upgrade your account to VIP!`,
        {
          inline_keyboard: [
            [{ text: '💬 Contact Admin', url: 'https://t.me/Akash_12121' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_main' }]
          ]
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // 13. Admin Dump Users
    if (data === 'admin_dump_users' && senderId === ADMIN_CHAT_ID) {
      const users = queryBotDb('SELECT * FROM users ORDER BY user_id ASC');
      let dumpText = 'AKASH FF PANEL - USERS DATABASE DUMP\n========================================\n';
      users.forEach((u: any) => {
        dumpText += `ID: ${u.user_id} | Name: ${u.first_name} | @${u.username} | Bal: ₹${u.balance} | Level: ${u.account_type} | Orders: ${u.orders_count}\n`;
      });
      await bot.sendMessage(chatId, `<code>${dumpText}</code>`, { parse_mode: 'HTML' });
      await bot.answerCallbackQuery(query.id, { text: 'Dump sent!' });
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });
}
