import { HostedBot, FileSubmission, BotLog } from '../types';

export const INITIAL_BOTS: HostedBot[] = [
  {
    id: 'bot_primary',
    name: 'AKASHFFPANEL1BOT',
    botUsername: 'AKASHFFPANEL11BOT',
    status: 'RUNNING',
    apiId: '',
    apiHash: '',
    botToken: '8632912098:AAENMDr-tkYBDsgl5MkA8SAt_3qOgnpL8j8',
    sessionString: '',
    adminChatId: '6933519842',
    downloadPath: './downloads/bot_master_primary',
    rules: {
      maxFileSizeMB: 100,
      allowedExtensions: ['.py', '.zip', '.html', '.txt'],
      allowedMimeTypes: [],
      requireChannelMembership: false,
      channelUsername: '',
      requireCaptionKeyword: false,
      allowedKeywords: [],
      autoApproveTrustedUsers: true,
      trustedUsernames: ['Akash_12121'],
      adminApprovalForUnknownUsers: false,
      autoRejectExecutables: false,
      customRejectionMessage: 'Invalid file format.',
      destinationDirectory: './downloads/bot_master_primary',
      dispatchToWebhook: false,
      webhookUrl: ''
    },
    stats: {
      totalReceived: 1,
      autoApproved: 1,
      pendingAdmin: 0,
      rejected: 0,
      totalDownloadedMB: 0.165
    },
    createdAt: new Date().toISOString(),
    lastActive: 'Just now'
  }
];

export const INITIAL_SUBMISSIONS: FileSubmission[] = [
  {
    id: 'sub_main_qr',
    botId: 'bot_primary',
    botName: 'AKASHFFPANEL1BOT',
    senderId: 6933519842,
    senderUsername: 'Akash_12121',
    isChannelMember: true,
    fileName: 'Main_QR_PAYMENT_ALL_FIXED.py',
    mimeType: 'text/x-python',
    fileSizeMB: 0.165,
    mediaType: 'document',
    caption: 'Payment QR automation bot',
    timestamp: 'Just now',
    status: 'COMPLETED',
    approvalReason: 'Verified and deployed to Python Bot Engine',
    downloadProgress: 100
  }
];

export const INITIAL_LOGS: BotLog[] = [
  {
    id: 'log_live_start',
    botId: 'bot_primary',
    botName: 'AKASHFFPANEL1BOT',
    timestamp: new Date().toLocaleTimeString(),
    level: 'SUCCESS',
    category: 'SYSTEM',
    message: '🤖 @AKASHFFPANEL11BOT is ONLINE and polling Telegram updates 24/7!'
  }
];
