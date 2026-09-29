import { ApprovalRuleSet, FileSubmission } from '../types';

export interface EvaluationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING_ADMIN';
  reason: string;
  logs: Array<{ stage: string; status: 'PASS' | 'FAIL' | 'WARN' | 'INFO'; detail: string }>;
}

export function evaluateSubmission(
  submission: Partial<FileSubmission>,
  rules: ApprovalRuleSet
): EvaluationResult {
  const logs: Array<{ stage: string; status: 'PASS' | 'FAIL' | 'WARN' | 'INFO'; detail: string }> = [];

  const fileName = submission.fileName || 'unknown_file';
  const fileSizeMB = submission.fileSizeMB || 0;
  const username = (submission.senderUsername || '').replace('@', '').toLowerCase();
  const caption = (submission.caption || '').toLowerCase();
  const ext = (fileName.includes('.') ? '.' + fileName.split('.').pop() : '').toLowerCase();

  logs.push({
    stage: '1. Event Intercept',
    status: 'INFO',
    detail: `Telethon captured @client.on(events.NewMessage) from @${submission.senderUsername || 'anonymous'} (${fileName}, ${fileSizeMB.toFixed(2)} MB)`
  });

  // Rule 1: Auto-Reject Executables
  if (rules.autoRejectExecutables && ['.exe', '.bat', '.cmd', '.scr', '.msi', '.vbs', '.sh'].includes(ext)) {
    logs.push({
      stage: '2. Security Guard',
      status: 'FAIL',
      detail: `File extension '${ext}' flagged as high-risk executable. Auto-rejection enforced.`
    });
    return {
      status: 'REJECTED',
      reason: `Security rule violation: Executable files (${ext}) are strictly prohibited.`,
      logs
    };
  }

  // Rule 2: Trusted User Bypass
  if (rules.autoApproveTrustedUsers && rules.trustedUsernames.map(u => u.replace('@', '').toLowerCase()).includes(username)) {
    logs.push({
      stage: '3. Trusted Whitelist',
      status: 'PASS',
      detail: `Sender @${username} is present in trusted admin whitelist. Bypassing size and filter checks.`
    });
    return {
      status: 'APPROVED',
      reason: `Auto-approved: User @${username} is a verified trusted user.`,
      logs
    };
  }

  // Rule 3: Channel Membership Verification
  if (rules.requireChannelMembership) {
    if (submission.isChannelMember) {
      logs.push({
        stage: '4. Channel Membership',
        status: 'PASS',
        detail: `Telethon verified membership in ${rules.channelUsername || '@Channel'} via GetParticipantRequest.`
      });
    } else {
      logs.push({
        stage: '4. Channel Membership',
        status: 'FAIL',
        detail: `User is NOT a subscribed member of ${rules.channelUsername || '@Channel'}.`
      });
      return {
        status: 'REJECTED',
        reason: `Channel join required: You must be a member of ${rules.channelUsername || 'our channel'} to process downloads.`,
        logs
      };
    }
  }

  // Rule 4: File Size Limit Check
  if (fileSizeMB > rules.maxFileSizeMB) {
    logs.push({
      stage: '5. File Size Check',
      status: 'WARN',
      detail: `File size (${fileSizeMB.toFixed(1)} MB) exceeds automatic threshold (${rules.maxFileSizeMB} MB).`
    });
    if (rules.adminApprovalForUnknownUsers) {
      logs.push({
        stage: '6. Admin Escalation',
        status: 'WARN',
        detail: `Forwarded to Admin Chat ID via Telethon inline buttons for manual review.`
      });
      return {
        status: 'PENDING_ADMIN',
        reason: `File size (${fileSizeMB.toFixed(1)} MB) exceeds auto-approval limit (${rules.maxFileSizeMB} MB). Pending admin review.`,
        logs
      };
    } else {
      return {
        status: 'REJECTED',
        reason: `File size (${fileSizeMB.toFixed(1)} MB) exceeds maximum permitted limit of ${rules.maxFileSizeMB} MB.`,
        logs
      };
    }
  } else {
    logs.push({
      stage: '5. File Size Check',
      status: 'PASS',
      detail: `File size (${fileSizeMB.toFixed(1)} MB) within allowed limit (${rules.maxFileSizeMB} MB).`
    });
  }

  // Rule 5: Extension / MIME Type Filter
  const allowedExts = rules.allowedExtensions.map(e => e.toLowerCase());
  if (allowedExts.length > 0 && ext && !allowedExts.includes(ext)) {
    logs.push({
      stage: '6. Extension Filter',
      status: 'WARN',
      detail: `Extension '${ext}' is not in allowed list (${allowedExts.join(', ')}).`
    });
    if (rules.adminApprovalForUnknownUsers) {
      return {
        status: 'PENDING_ADMIN',
        reason: `Extension '${ext}' requires manual admin review.`,
        logs
      };
    } else {
      return {
        status: 'REJECTED',
        reason: `File extension '${ext}' is not permitted. Allowed: ${allowedExts.join(', ')}`,
        logs
      };
    }
  } else {
    logs.push({
      stage: '6. Extension Filter',
      status: 'PASS',
      detail: `Extension '${ext}' matches whitelist rules.`
    });
  }

  // Rule 6: Caption Keyword Check
  if (rules.requireCaptionKeyword) {
    const keywords = rules.allowedKeywords.map(k => k.toLowerCase());
    const matched = keywords.some(kw => caption.includes(kw));
    if (!matched) {
      logs.push({
        stage: '7. Caption Keyword',
        status: 'FAIL',
        detail: `Caption does not contain required keywords (${keywords.join(', ')}).`
      });
      return {
        status: 'REJECTED',
        reason: `Caption must include one of these keywords: ${keywords.join(', ')}`,
        logs
      };
    } else {
      logs.push({
        stage: '7. Caption Keyword',
        status: 'PASS',
        detail: `Caption matched required keyword.`
      });
    }
  }

  logs.push({
    stage: '8. Final Verdict',
    status: 'PASS',
    detail: `Passed all automated criteria. Invoking await client.download_media().`
  });

  return {
    status: 'APPROVED',
    reason: 'Passed all automated Telethon approval criteria.',
    logs
  };
}
