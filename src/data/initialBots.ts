import { HostedBot, FileSubmission, BotLog } from '../types';

export const INITIAL_BOTS: HostedBot[] = [
  {
    id: 'bot_vault_alpha',
    name: 'MMTESTINGBOT_BOT',
    botUsername: 'MMTESTINGBOT_BOT',
    status: 'STOPPED',
    apiId: '2849104',
    apiHash: 'e92f81a7b0394851239f01239a',
    botToken: '8723574391:AAHDUGTY071ubT7F8ynEsNz9xV1gQTVss4U',
    sessionString: '',
    adminChatId: '',
    downloadPath: './downloads/vault_alpha',
    createdAt: '2026-09-20 14:30:00',
    lastActive: 'Awaiting BotFather Token',
    stats: {
      totalReceived: 0,
      autoApproved: 0,
      pendingAdmin: 0,
      rejected: 0,
      totalDownloadedMB: 0
    },
    rules: {
      maxFileSizeMB: 100,
      allowedExtensions: ['.pdf', '.zip', '.mp4', '.mkv', '.apk', '.epub'],
      allowedMimeTypes: ['application/pdf', 'video/mp4', 'application/zip', 'application/vnd.android.package-archive'],
      requireChannelMembership: true,
      channelUsername: '@MediaVaultCommunity',
      requireCaptionKeyword: false,
      allowedKeywords: ['download', '#approve', 'submit'],
      autoApproveTrustedUsers: true,
      trustedUsernames: ['@admin_alex', '@lead_reviewer', '@cloud_dev'],
      adminApprovalForUnknownUsers: true,
      autoRejectExecutables: true,
      customRejectionMessage: 'Your file was not approved. Join @MediaVaultCommunity and send files under 100MB.',
      destinationDirectory: './downloads/vault_alpha',
      dispatchToWebhook: true,
      webhookUrl: 'https://api.mycloudstorage.com/v1/telethon-hook'
    }
  },
  {
    id: 'bot_doc_approver',
    name: 'PDF & Report Auto-Approver',
    botUsername: 'pdf_auto_downloader_bot',
    status: 'RUNNING',
    apiId: '9182039',
    apiHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
    botToken: '6829104812:AAH9283_klas92039182390-xyz',
    sessionString: '1BKX029384019283409123809...',
    adminChatId: '-1002019283471',
    downloadPath: './downloads/documents',
    createdAt: '2026-09-24 09:15:00',
    lastActive: '2 mins ago',
    stats: {
      totalReceived: 89,
      autoApproved: 78,
      pendingAdmin: 3,
      rejected: 8,
      totalDownloadedMB: 1240
    },
    rules: {
      maxFileSizeMB: 35,
      allowedExtensions: ['.pdf', '.docx', '.xlsx', '.csv'],
      allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      requireChannelMembership: false,
      channelUsername: '',
      requireCaptionKeyword: true,
      allowedKeywords: ['#report', '#doc', 'invoice'],
      autoApproveTrustedUsers: true,
      trustedUsernames: ['@finance_lead', '@document_bot_admin'],
      adminApprovalForUnknownUsers: false,
      autoRejectExecutables: true,
      customRejectionMessage: 'Only PDF/Word documents with caption tag #report or #doc are processed.',
      destinationDirectory: './downloads/documents',
      dispatchToWebhook: false,
      webhookUrl: ''
    }
  }
];

export const INITIAL_SUBMISSIONS: FileSubmission[] = [
  {
    id: 'sub_101',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    senderId: 9812039,
    senderUsername: 'cloud_dev',
    isChannelMember: true,
    fileName: 'Annual_Tech_Overview_2026.pdf',
    mimeType: 'application/pdf',
    fileSizeMB: 18.4,
    mediaType: 'document',
    caption: 'Official 2026 tech report for automatic backup',
    timestamp: '2026-09-28 12:40:15',
    status: 'COMPLETED',
    approvalReason: 'Auto-approved: User @cloud_dev is in trusted whitelist.',
    downloadProgress: 100,
    downloadedPath: './downloads/vault_alpha/20260928_124015_Annual_Tech_Overview_2026.pdf'
  },
  {
    id: 'sub_102',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    senderId: 4829102,
    senderUsername: 'telegram_user99',
    isChannelMember: true,
    fileName: 'System_Installer_v4.2.exe',
    mimeType: 'application/x-msdownload',
    fileSizeMB: 45.0,
    mediaType: 'document',
    caption: 'Please download this installer file',
    timestamp: '2026-09-28 12:35:10',
    status: 'REJECTED',
    approvalReason: 'Security rule violation: Executable files (.exe) are strictly prohibited.',
    downloadProgress: 0
  },
  {
    id: 'sub_103',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    senderId: 7728192,
    senderUsername: 'media_creator_pro',
    isChannelMember: true,
    fileName: '4K_Drone_Footage_Render.mp4',
    mimeType: 'video/mp4',
    fileSizeMB: 145.0,
    mediaType: 'video',
    caption: 'New 4K drone footage download request',
    timestamp: '2026-09-28 12:30:00',
    status: 'PENDING_ADMIN',
    approvalReason: 'File size (145.0 MB) exceeds auto-approval limit (100 MB). Pending admin review.',
    downloadProgress: 0
  }
];

export const INITIAL_LOGS: BotLog[] = [
  {
    id: 'log_1',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    timestamp: '12:40:16',
    level: 'SUCCESS',
    category: 'DOWNLOAD',
    message: 'Telethon download_media finished for Annual_Tech_Overview_2026.pdf (18.4 MB) in 1.4s'
  },
  {
    id: 'log_2',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    timestamp: '12:40:15',
    level: 'INFO',
    category: 'APPROVAL',
    message: 'Auto-approved Annual_Tech_Overview_2026.pdf - Trusted user match @cloud_dev'
  },
  {
    id: 'log_3',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    timestamp: '12:35:10',
    level: 'WARN',
    category: 'APPROVAL',
    message: 'Auto-rejected System_Installer_v4.2.exe - Executable file blocked for security'
  },
  {
    id: 'log_4',
    botId: 'bot_vault_alpha',
    botName: 'MediaVault Telethon Downloader',
    timestamp: '12:30:00',
    level: 'INFO',
    category: 'EVENT',
    message: 'Sent Telethon Inline Buttons to Admin Chat (-1001982301923) for 4K_Drone_Footage_Render.mp4'
  }
];
