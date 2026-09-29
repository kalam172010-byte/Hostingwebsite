import { HostedBot, FileSubmission, BotLog } from '../types';

export const INITIAL_BOTS: HostedBot[] = [
  {
    id: 'bot_primary',
    name: 'AKASHFFPANEL1BOT',
    botUsername: 'AKASHFFPANEL11BOT',
    botToken: '8632912098:AAENMDr-tkYBDsgl5MkA8SAt_3qOgnpL8j8',
    status: 'RUNNING',
    filesReceived: 1,
    filesApproved: 1,
    filesRejected: 0,
    downloadPath: './downloads/bot_master_primary',
    rules: {
      maxFileSizeMB: 100,
      allowedExtensions: ['.py', '.zip', '.html', '.txt'],
      requireCaptionKeyword: false,
      allowedKeywords: [],
      autoRejectExecutables: false,
      customRejectionMessage: 'Invalid file format.'
    }
  }
];

export const INITIAL_SUBMISSIONS: FileSubmission[] = [
  {
    id: 'sub_main_qr',
    botId: 'bot_primary',
    senderUsername: 'Akash_12121',
    fileName: 'Main_QR_PAYMENT_ALL_FIXED.py',
    fileSizeMB: 0.165,
    timestamp: 'Just now',
    status: 'HOSTED',
    reason: 'Verified and deployed to Python Bot Engine'
  }
];

export const INITIAL_LOGS: BotLog[] = [
  {
    id: 'log_live_start',
    botId: 'bot_primary',
    timestamp: new Date().toLocaleTimeString(),
    level: 'SUCCESS',
    message: '🤖 @AKASHFFPANEL11BOT is ONLINE and polling Telegram updates 24/7!'
  }
];
