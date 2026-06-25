import express from 'express';
import { marketIntelligence, jobSummary } from '../controllers/intelligence.js';

const router = express.Router();

router.post('/market', marketIntelligence);
router.post('/job-summary', jobSummary);

export default router;
