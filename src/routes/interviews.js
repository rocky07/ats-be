import { Router } from 'express';
import {
  listPanel,
  addPanelMember,
  updatePanelMember,
  removePanelMember,
  conflictCheck,
  scheduleInterview,
  listCandidateInterviews,
} from '../controllers/interviews.js';

const router = Router();

router.get('/panel', listPanel);
router.post('/panel', addPanelMember);
router.put('/panel/:id', updatePanelMember);
router.delete('/panel/:id', removePanelMember);
router.post('/check-conflicts', conflictCheck);
router.post('/schedule', scheduleInterview);
router.get('/candidate/:candidateId', listCandidateInterviews);

export default router;
