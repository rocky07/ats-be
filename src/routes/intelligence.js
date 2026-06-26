import express from 'express';
import { marketIntelligence, jobSummary, atsChat, rankCandidatesHandler } from '../controllers/intelligence.js';

const router = express.Router();

router.post('/market', marketIntelligence);
router.post('/job-summary', jobSummary);
router.post('/chat', atsChat);
router.post('/rank', rankCandidatesHandler);

export default router;
