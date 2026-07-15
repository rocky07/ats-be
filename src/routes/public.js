import { Router } from 'express';
import multer from 'multer';
import { dbGet, dbPut } from '../config/dynamodb.js';
import { addCandidateFromResume, addCandidate, DuplicateCandidateError } from '../services/candidates.js';
import { getPipeline, savePipeline } from '../services/pipelines.js';
import { getAnyUserSettings } from '../services/settingsService.js';
import { rankCandidates } from '../services/rankCandidates.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const CANDIDATES_TABLE = 'BourntecATS-Candidates';

// Every must-have skill needs > 0 years of claimed experience to be auto-injected into the pipeline.
function meetsMustHaves(mustHaves = [], skillExperience = {}) {
  if (!mustHaves.length) return true;
  return mustHaves.every((skill) => Number(skillExperience[skill]) > 0);
}

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? '';

// Drop a newly-applied candidate into a requirement's pipeline. If auto-rank is
// enabled, score them with Claude immediately and place them in Ranked instead
// of Ingested; falls back to Ingested (unscored) on any ranking failure.
async function addToPipeline(reqId, candidate, requirement, aiSettings) {
  const stages = await getPipeline(reqId);
  const alreadyIn = Object.values(stages).some((stage) =>
    stage.some((c) => String(c?.id ?? c) === String(candidate.id)),
  );
  if (alreadyIn) return;

  if (aiSettings?.enableAutoRankIngested) {
    try {
      const [result] = await rankCandidates([candidate], requirement);
      stages.ranked.push({ ...candidate, score: result?.score, rankSummary: result?.summary });
      await savePipeline(reqId, stages);
      return;
    } catch (err) {
      console.error('Auto-rank on apply failed, falling back to Ingested:', err.message);
    }
  }

  stages.ingested.push(candidate);
  await savePipeline(reqId, stages);
}

async function verifyCaptcha(token) {
  if (!RECAPTCHA_SECRET) return true;
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  });
  const data = await res.json();
  return data.success === true;
}

// GET /api/public/jobs/:reqId  — public job detail for the apply page
router.get('/jobs/:reqId', async (req, res) => {
  const req_ = await dbGet('BourntecATS-Requirements', { id: String(req.params.reqId) });
  if (!req_) return res.status(404).json({ error: 'Job not found' });
  if (req_.status && req_.status !== 'open') {
    return res.status(410).json({ error: 'This position is no longer accepting applications' });
  }
  const { id, title, department, description, openDate, mustHaves } = req_;
  res.json({ id, title, department, description, openDate, mustHaves: mustHaves ?? [] });
});

// POST /api/public/jobs/:reqId/apply  — public resume submission
router.post('/jobs/:reqId/apply', upload.single('resume'), async (req, res) => {
  const captchaToken = req.body['g-recaptcha-response'];
  if (RECAPTCHA_SECRET && !captchaToken) {
    return res.status(400).json({ error: 'CAPTCHA verification required' });
  }
  if (captchaToken) {
    const valid = await verifyCaptcha(captchaToken);
    if (!valid) return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
  }

  const reqId = req.params.reqId;
  const requirement = await dbGet('BourntecATS-Requirements', { id: String(reqId) });
  if (!requirement) return res.status(404).json({ error: 'Job not found' });
  if (requirement.status && requirement.status !== 'open') {
    return res.status(410).json({ error: 'This position is no longer accepting applications' });
  }

  let skillExperience = {};
  try {
    if (req.body.skillExperience) skillExperience = JSON.parse(req.body.skillExperience);
  } catch {
    // ignore malformed payload, treated as no experience declared
  }
  const qualifies = meetsMustHaves(requirement.mustHaves, skillExperience);
  const userSettings = await getAnyUserSettings();
  const aiSettings = userSettings?.aiSettings;

  try {
    let candidate;

    if (req.file) {
      const useAI = aiSettings?.enableAIResumeParsing === true;
      candidate = await addCandidateFromResume(req.file, useAI);
      if (req.body.name)  candidate.name  = req.body.name;
      if (req.body.email) candidate.email = req.body.email;
    } else if (req.body.name && req.body.email) {
      candidate = await addCandidate({
        name:   req.body.name,
        email:  req.body.email,
        source: 'Resume Upload',
      });
    } else {
      return res.status(400).json({ error: 'Resume file or name+email required' });
    }

    candidate.skillExperience = skillExperience;
    candidate.qualifiesMustHaves = qualifies;
    await dbPut(CANDIDATES_TABLE, candidate);

    if (qualifies) {
      await addToPipeline(reqId, candidate, requirement, aiSettings);
    }

    res.status(201).json({
      ok: true,
      message: qualifies
        ? 'Application received. We will be in touch!'
        : 'Thanks for applying. Your resume has been recorded for future openings that may be a better fit.',
      candidateId: candidate.id,
    });
  } catch (err) {
    if (err instanceof DuplicateCandidateError) {
      const existing = err.candidate ?? err;
      existing.skillExperience = skillExperience;
      existing.qualifiesMustHaves = qualifies;
      await dbPut(CANDIDATES_TABLE, existing);

      if (qualifies && existing?.id) {
        await addToPipeline(reqId, existing, requirement, aiSettings);
      }
      return res.status(200).json({
        ok: true,
        message: qualifies
          ? 'Your profile is already on file. Application updated!'
          : 'Your profile is already on file. It has been recorded for future openings that may be a better fit.',
        candidateId: existing?.id,
      });
    }
    console.error('Public apply error:', err.message);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

export default router;
