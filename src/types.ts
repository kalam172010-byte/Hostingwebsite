export type BotStatus = 'RUNNING' | 'STOPPED' | 'PAUSED' | 'ERROR' | 'SYNCING';

export interface ApprovalRuleSet {
  maxFileSizeMB: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  requireChannelMembership: boolean;
  channelUsername: string;
  requireCaptionKeyword: boolean;
  allowedKeywords: string[];
  autoApproveTrustedUsers: boolean;
  trustedUsernames: string[];
  adminApprovalForUnknownUsers: boolean;
  autoRejectExecutables: boolean;
  customRejectionMessage: string;
  destinationDirectory: string;
  dispatchToWebhook: boolean;
  webhookUrl: string;
}

export interface HostedBot {
  id: string;
  name: string;
  botUsername: string;
  status: BotStatus;
  apiId: string;
  apiHash: string;
  botToken: string;
  sessionString: string;
  adminChatId: string;
  downloadPath: string;
  rules: ApprovalRuleSet;
  stats: {
    totalReceived: number;
    autoApproved: number;
    pendingAdmin: number;
    rejected: number;
    totalDownloadedMB: number;
  };
  createdAt: string;
  lastActive: string;
  generatedCode?: {
    mainPy: string;
    configPy: string;
    requirementsTxt: string;
    dockerfile: string;
    systemdService?: string;
    readmeMd: string;
    summary: string;
  };
}

export type MediaType = 'document' | 'video' | 'photo' | 'audio' | 'voice' | 'archive' | 'apk';

export type SubmissionStatus = 'APPROVED' | 'REJECTED' | 'PENDING_ADMIN' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED';

export interface FileSubmission {
  id: string;
  botId: string;
  botName: string;
  senderId: number;
  senderUsername: string;
  isChannelMember: boolean;
  fileName: string;
  mimeType: string;
  fileSizeMB: number;
  mediaType: MediaType;
  caption: string;
  timestamp: string;
  status: SubmissionStatus;
  approvalReason: string;
  downloadProgress: number; // 0 to 100
  downloadedPath?: string;
  thumbnailUrl?: string;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  category: 'EVENT' | 'APPROVAL' | 'DOWNLOAD' | 'SYSTEM' | 'TELETHON';
  message: string;
  details?: string;
}

export interface HostedPythonBot {
  id: string;
  name: string;
  entryFile: string;
  sourceType: 'telegram_bot' | 'web_upload' | 'template';
  senderUsername?: string;
  senderId?: number;
  originalFileName: string;
  fileSizeMB: number;
  pid?: number;
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  exitCode?: number | null;
  startedAt: string;
  uptimeSeconds: number;
  restartCount?: number;
  consecutiveCrashCount?: number;
  lastErrorNotifiedAt?: number;
  autoRestartEnabled?: boolean;
  logs: string[];
  description?: string;
  botId?: string; // which master bot received it
  envVars?: Record<string, string>;
}

export interface HostedProject {
  id: string;
  name: string;
  sourceType: 'telegram_bot' | 'web_upload' | 'template';
  senderUsername?: string;
  senderId?: number;
  originalFileName: string;
  fileSizeMB: number;
  filesCount: number;
  filesList: string[];
  liveUrl: string;
  previewPath: string;
  createdAt: string;
  status: 'ONLINE' | 'UPDATING' | 'OFFLINE';
  description?: string;
  botId?: string;
}

