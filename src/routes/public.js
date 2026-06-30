import { Router } from 'express';
import multer from 'multer';
import db from '../config/db.js';
import { addCandidateFromResume, addCandidate, DuplicateCandidateError } from '../services/candidates.js';
import { getPipeline, savePipeline } from '../services/pipelines.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? '';

async function verifyCaptcha(token) {
  if (!RECAPTCHA_SECRET) return true; // skip verification if not configured
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  });
  const data = await res.json();
  return data.success === true;
}

// GET /api/public/jobs/:reqId  — public job detail for the apply page
router.get('/jobs/:reqId', (req, res) => {
  const req_ = (db.data.requirements ?? []).find(
    (r) => String(r.id) === String(req.params.reqId),
  );
  if (!req_) return res.status(404).json({ error: 'Job not found' });
  if (req_.status && req_.status !== 'open') {
    return res.status(410).json({ error: 'This position is no longer accepting applications' });
  }
  // Return only public-safe fields
  const { id, title, department, description, openDate } = req_;
  res.json({ id, title, department, description, openDate });
});

// POST /api/public/jobs/:reqId/apply  — public resume submission
// Accepts multipart/form-data: name, email (optional), resume (file)
router.post('/jobs/:reqId/apply', upload.single('resume'), async (req, res) => {
  // Verify CAPTCHA before doing anything else
  const captchaToken = req.body['g-recaptcha-response'];
  if (RECAPTCHA_SECRET && !captchaToken) {
    return res.status(400).json({ error: 'CAPTCHA verification required' });
  }
  if (captchaToken) {
    const valid = await verifyCaptcha(captchaToken);
    if (!valid) return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
  }

  const reqId = req.params.reqId;
  const requirement = (db.data.requirements ?? []).find(
    (r) => String(r.id) === String(reqId),
  );
  if (!requirement) return res.status(404).json({ error: 'Job not found' });
  if (requirement.status && requirement.status !== 'open') {
    return res.status(410).json({ error: 'This position is no longer accepting applications' });
  }

  try {
    let candidate;

    if (req.file) {
      // Parse resume with AI
      candidate = await addCandidateFromResume(req.file);
      // Override with explicit name/email if provided
      if (req.body.name)  candidate.name  = req.body.name;
      if (req.body.email) candidate.email = req.body.email;
    } else if (req.body.name && req.body.email) {
      // No file — create a minimal candidate record
      candidate = await addCandidate({
        name:   req.body.name,
        email:  req.body.email,
        source: 'Resume Upload',
      });
    } else {
      return res.status(400).json({ error: 'Resume file or name+email required' });
    }

    // Add full candidate object to ingested stage — matches the default pipeline behavior
    const stages = getPipeline(reqId);
    const alreadyIn = stages.ingested.some((c) => String(c?.id ?? c) === String(candidate.id));
    if (!alreadyIn) {
      stages.ingested.push(candidate);
      await savePipeline(reqId, stages);
    }

    res.status(201).json({
      ok: true,
      message: 'Application received. We will be in touch!',
      candidateId: candidate.id,
    });
  } catch (err) {
    if (err instanceof DuplicateCandidateError) {
      // Duplicate — still add to pipeline if not already there
      const existing = err.candidate ?? err;
      const stages = getPipeline(reqId);
      const alreadyIn = stages.ingested.some((c) => String(c?.id ?? c) === String(existing?.id));
      if (existing?.id && !alreadyIn) {
        stages.ingested.push(existing);
        await savePipeline(reqId, stages);
      }
      return res.status(200).json({
        ok: true,
        message: 'Your profile is already on file. Application updated!',
        candidateId: existing?.id,
      });
    }
    console.error('Public apply error:', err.message);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

export default router;
