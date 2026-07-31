import { getUserSettings, updateUserSettings } from './settingsService.js';
import { refreshAccessToken } from './msOauthService.js';
import { addCandidate } from './candidates.js';
import { uploadResume as uploadToS3 } from './s3Service.js';
import { parseResume } from './resumeParser.js';
import { createNotification } from './notificationsService.js';
import { dbScan } from '../config/dynamodb.js';

const CANDIDATES_TABLE = 'BourntecATS-Candidates';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const RESUME_EXT_RE = /\.(pdf|docx?|txt)$/i;
const RESUME_MIME_RE = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword|text\/plain)$/i;

const EXT_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
};

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const looksLikeResume = (attachment) => {
  const name = attachment.name ?? '';
  return RESUME_EXT_RE.test(name) || RESUME_MIME_RE.test(attachment.contentType ?? '');
};

async function graphFetchDelegated(accessToken, path) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API ${res.status}: ${err}`);
  }
  return res.json();
}

// Returns a valid access token for the user's connected Outlook account,
// refreshing it first if it's expired (or close to it).
async function getValidAccessToken(userId, personalOutlook) {
  const expiresSoon = !personalOutlook.tokenExpiry || Date.now() > personalOutlook.tokenExpiry - 60_000;
  if (!expiresSoon) return personalOutlook.accessToken;

  const refreshed = await refreshAccessToken(personalOutlook.refreshToken);
  const updated = {
    ...personalOutlook,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? personalOutlook.refreshToken,
    tokenExpiry: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  };
  await updateUserSettings(userId, { personalOutlook: updated });
  return updated.accessToken;
}

// Pull recent messages with attachments from the connected user's own mailbox
// (via their delegated Graph token), extract resume-looking attachments, parse
// them, and land each as a candidate in the "needs review" queue (source:
// 'Outlook', reviewStatus: 'pending_review') — nothing is auto-assigned to a
// pipeline. Returns a summary of the run.
export const syncOutlookInbox = async (userId) => {
  const settings = await getUserSettings(userId);
  const personalOutlook = settings.personalOutlook ?? {};
  if (!personalOutlook.enabled || !personalOutlook.refreshToken) {
    throw new Error('Outlook account not connected — connect it in Settings first');
  }

  const accessToken = await getValidAccessToken(userId, personalOutlook);

  const since = personalOutlook.lastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const syncStartedAt = new Date().toISOString();

  const params = new URLSearchParams({
    $filter: `hasAttachments eq true and receivedDateTime ge ${since}`,
    $select: 'id,subject,from,receivedDateTime,hasAttachments',
    $top: '50',
    $orderby: 'receivedDateTime asc',
  });

  const { value: messages = [] } = await graphFetchDelegated(
    accessToken,
    `/me/mailFolders/Inbox/messages?${params.toString()}`,
  );

  const existingCandidates = await dbScan(CANDIDATES_TABLE);
  const existingByEmail = new Map(
    existingCandidates.filter((c) => c.email).map((c) => [normalizeEmail(c.email), c]),
  );
  const seenMessageIds = new Set(
    existingCandidates.filter((c) => c.sourceMessageId).map((c) => c.sourceMessageId),
  );

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const msg of messages) {
    if (seenMessageIds.has(msg.id)) { skipped++; continue; }

    try {
      const { value: attachments = [] } = await graphFetchDelegated(
        accessToken,
        `/me/messages/${msg.id}/attachments`,
      );
      const resumeAttachments = attachments.filter(
        (a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && looksLikeResume(a),
      );

      if (resumeAttachments.length === 0) { skipped++; continue; }

      for (const attachment of resumeAttachments) {
        const buffer = Buffer.from(attachment.contentBytes, 'base64');
        const ext = attachment.name.split('.').pop().toLowerCase();
        const mimetype = attachment.contentType || EXT_MIME[ext] || 'application/octet-stream';

        const parsed = await parseResume(buffer, mimetype, attachment.name, false);
        const email = normalizeEmail(parsed.email);

        if (email && existingByEmail.has(email)) { skipped++; continue; }

        const candidateId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        let resumeS3Key;
        try {
          resumeS3Key = await uploadToS3(candidateId, buffer, mimetype, attachment.name);
        } catch (e) {
          console.error('S3 upload failed (non-fatal):', e.message);
        }

        const candidate = await addCandidate({
          id: candidateId,
          ...parsed,
          source: 'Outlook',
          resumeFile: attachment.name,
          ...(resumeS3Key ? { resumeS3Key } : {}),
          reviewStatus: 'pending_review',
          sourceMessageId: msg.id,
          sourceEmailFrom: msg.from?.emailAddress?.address ?? '',
          sourceEmailSubject: msg.subject ?? '',
          sourceEmailReceivedAt: msg.receivedDateTime ?? null,
          ingestedByUserId: userId,
          ingestedByEmail: personalOutlook.outlookEmail ?? '',
        });

        if (email) existingByEmail.set(email, candidate);
        imported++;
      }
    } catch (e) {
      console.error(`Outlook ingestion failed for message ${msg.id}:`, e.message);
      errors.push({ messageId: msg.id, error: e.message });
    }
  }

  await updateUserSettings(userId, { personalOutlook: { lastSyncAt: syncStartedAt } });

  if (imported > 0) {
    await createNotification({
      type: 'outlook_sync',
      title: 'Outlook sync complete',
      message: `Imported ${imported} candidate${imported === 1 ? '' : 's'} from ${personalOutlook.outlookEmail} — awaiting review.`,
      meta: { imported, skipped, mailbox: personalOutlook.outlookEmail },
    });
  }

  return { imported, skipped, errors, mailbox: personalOutlook.outlookEmail, syncedAt: syncStartedAt };
};
