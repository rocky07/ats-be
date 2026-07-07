import express from 'express';
import { marketIntelligence, jobSummary, parseRequirement, atsChat, rankCandidatesHandler } from '../controllers/intelligence.js';

const router = express.Router();

router.post('/market', marketIntelligence);
router.post('/job-summary', jobSummary);
router.post('/parse-requirement', parseRequirement);
router.post('/chat', atsChat);
router.post('/rank', rankCandidatesHandler);

export default router;
