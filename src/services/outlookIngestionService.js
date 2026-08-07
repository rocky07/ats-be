import { getUserSettings, updateUserSettings } from './settingsService.js';
import { refreshAccessToken } from './msOauthService.js';
import { addCandidate } from './candidates.js';
import { uploadResume as uploadToS3 } from './s3Service.js';
import { parseResume } from './resumeParser.js';
import { createNotification } from './notificationsService.js';
import { getPipeline, savePipeline } from './pipelines.js';
import { dbScan } from '../config/dynamodb.js';

const CANDIDATES_TABLE = 'BourntecATS-Candidates';
const REQUIREMENTS_TABLE = 'BourntecATS-Requirements';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// An inbound resume email is auto-injected into a requirement's pipeline when
// its subject/body match the requirement's title by at least this much;
// otherwise it's left in the Needs Review queue for a human to triage.
const MATCH_THRESHOLD = 0.7;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'role', 'job', 'position',
  'opening', 'req', 'requirement', 'hiring', 'urgent', 'immediate', 'needed',
  'apply', 'application', 'resume', 'cv', 'candidate', 'opportunity', 'new',
]);

const tokenize = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

// Fraction of the requirement title's significant words that show up in the
// email text — simple and cheap, no AI call needed for this triage step.
const titleMatchScore = (title, emailText) => {
  const titleTokens = tokenize(title);
  if (!titleTokens.length) return 0;
  const emailTokens = new Set(tokenize(emailText));
  const matched = titleTokens.filter((t) => emailTokens.has(t)).length;
  return matched / titleTokens.length;
};

// Find the open requirement whose title best matches the email's subject/preview.
const findBestRequirementMatch = (requirements, emailText) => {
  let best = null;
  for (const req of requirements) {
    const score = titleMatchScore(req.title ?? '', emailText);
    if (!best || score > best.score) best = { requirement: req, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
};

// AI-powered alternative to findBestRequirementMatch: ask Claude which open
// requirement (if any) this email is for, given its subject/body and the
// parsed candidate's title/skills. Falls back to the keyword matcher on any
// error so a flaky/unconfigured AI call never blocks ingestion.
const findBestRequirementMatchWithAI = async (requirements, emailText, parsedCandidate, model) => {
  if (!requirements.length) return null;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const reqList = requirements
      .map((r, i) => `${i + 1}. [id:${r.id}] ${r.title}${r.department ? ` (${r.department})` : ''}`)
      .join('\n');

    const candSummary = [
      parsedCandidate.title ? `Candidate current/most recent title: ${parsedCandidate.title}` : '',
      (parsedCandidate.skills ?? []).length ? `Candidate skills: ${parsedCandidate.skills.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const message = await client.messages.create({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `An email with a resume attached came in. Decide which (if any) of these open job requirements it is most likely for.

Email subject + body preview:
---
${emailText.slice(0, 1500)}
---

${candSummary}

Open requirements:
${reqList}

Return ONLY a valid JSON object, no markdown fences: {"requirementId": "<id or null>", "confidence": <0-100 integer>}
If none of the requirements are a plausible match, return {"requirementId": null, "confidence": 0}.`,
      }],
    });

    const raw = message.content[0].text.trim();
    const json = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const { requirementId, confidence } = JSON.parse(json);
    if (!requirementId || !(confidence >= MATCH_THRESHOLD * 100)) return null;

    const requirement = requirements.find((r) => String(r.id) === String(requirementId));
    if (!requirement) return null;
    return { requirement, score: confidence / 100 };
  } catch (e) {
    console.warn('[outlookIngestion] AI requirement matching failed, falling back to keyword match:', e.message);
    return findBestRequirementMatch(requirements, emailText);
  }
};

// Push a candidate into a requirement's pipeline "ingested" stage (no-op if
// they're already in some stage of that pipeline).
const injectIntoPipeline = async (requirementId, candidate) => {
  const stages = await getPipeline(requirementId);
  const alreadyIn = Object.values(stages).some((stage) =>
    stage.some((c) => String(c?.id ?? c) === String(candidate.id)),
  );
  if (alreadyIn) return;
  stages.ingested.push(candidate);
  await savePipeline(requirementId, stages);
};

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

// Second-pass gate on the parsed content: reject attachments that matched the
// extension/MIME filter but clearly aren't resumes (invoices, offer letters,
// contracts, ...) because no identity info or skills could be extracted.
const looksLikeParsedResume = (parsed) =>
  Boolean(parsed.email || parsed.phone) && Array.isArray(parsed.skills) && parsed.skills.length > 0;

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
// (via their delegated Graph token), extract resume-looking attachments, and
// parse them. If the email's subject/body matches an open requirement's title
// by at least MATCH_THRESHOLD, the candidate is auto-injected into that
// requirement's pipeline ("ingested" stage, reviewStatus: 'auto_matched');
// otherwise they land in the "needs review" queue (reviewStatus:
// 'pending_review') for a human to triage. Returns a summary of the run.
export const syncOutlookInbox = async (userId) => {
  const settings = await getUserSettings(userId);
  const personalOutlook = settings.personalOutlook ?? {};
  if (!personalOutlook.enabled || !personalOutlook.refreshToken) {
    throw new Error('Outlook account not connected — connect it in Settings first');
  }

  const accessToken = await getValidAccessToken(userId, personalOutlook);

  const since = personalOutlook.lastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const syncStartedAt = new Date().toISOString();

  // Note: combining `hasAttachments eq true` with `receivedDateTime ge ...` in one
  // $filter (plus $orderby) trips Graph's "InefficientFilter" error on mail search —
  // filter by date server-side only, then check hasAttachments client-side below.
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since}`,
    $select: 'id,subject,from,receivedDateTime,hasAttachments,bodyPreview',
    $top: '50',
    $orderby: 'receivedDateTime asc',
  });

  const { value: allMessages = [] } = await graphFetchDelegated(
    accessToken,
    `/me/mailFolders/Inbox/messages?${params.toString()}`,
  );
  const messages = allMessages.filter((m) => m.hasAttachments);

  const existingCandidates = await dbScan(CANDIDATES_TABLE);
  const existingByEmail = new Map(
    existingCandidates.filter((c) => c.email).map((c) => [normalizeEmail(c.email), c]),
  );
  const seenMessageIds = new Set(
    existingCandidates.filter((c) => c.sourceMessageId).map((c) => c.sourceMessageId),
  );

  const allRequirements = await dbScan(REQUIREMENTS_TABLE);
  const openRequirements = allRequirements.filter((r) => !r.status || r.status === 'open');
  const aiSettings = settings.aiSettings ?? {};
  const useAIMatching = aiSettings.enableAIOutlookMatching === true;

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

      const emailText = `${msg.subject ?? ''} ${msg.bodyPreview ?? ''}`;

      for (const attachment of resumeAttachments) {
        const buffer = Buffer.from(attachment.contentBytes, 'base64');
        const ext = attachment.name.split('.').pop().toLowerCase();
        const mimetype = attachment.contentType || EXT_MIME[ext] || 'application/octet-stream';

        const parsed = await parseResume(buffer, mimetype, attachment.name, false);
        if (!looksLikeParsedResume(parsed)) { skipped++; continue; }
        const email = normalizeEmail(parsed.email);

        if (email && existingByEmail.has(email)) { skipped++; continue; }

        const bestMatch = useAIMatching
          ? await findBestRequirementMatchWithAI(openRequirements, emailText, parsed, aiSettings.model)
          : findBestRequirementMatch(openRequirements, emailText);

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
          reviewStatus: bestMatch ? 'auto_matched' : 'pending_review',
          sourceMessageId: msg.id,
          sourceEmailFrom: msg.from?.emailAddress?.address ?? '',
          sourceEmailSubject: msg.subject ?? '',
          sourceEmailReceivedAt: msg.receivedDateTime ?? null,
          ingestedByUserId: userId,
          ingestedByEmail: personalOutlook.outlookEmail ?? '',
          ...(bestMatch ? {
            matchedRequirementId: bestMatch.requirement.id,
            matchedRequirementTitle: bestMatch.requirement.title,
            matchedByAI: useAIMatching,
            matchScore: Math.round(bestMatch.score * 100),
          } : {}),
        });

        if (bestMatch) {
          try {
            await injectIntoPipeline(bestMatch.requirement.id, candidate);
          } catch (e) {
            console.error(`Failed to inject candidate ${candidateId} into pipeline ${bestMatch.requirement.id}:`, e.message);
          }
        }

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
      userId,
    });
  }

  return { imported, skipped, errors, mailbox: personalOutlook.outlookEmail, syncedAt: syncStartedAt };
};
