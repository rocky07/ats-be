import express from 'express';
import { generate, byRequirement, fetchPublic, submit, submission, sendInvite, verifyExamIdentity } from '../controllers/exams.js';

const router = express.Router();

router.post('/generate', generate);
router.post('/send-invite', sendInvite);
router.get('/by-requirement/:reqId', byRequirement);
router.get('/:examId', fetchPublic);
router.post('/:examId/verify-identity', verifyExamIdentity);
router.post('/:examId/submit', submit);
router.get('/:examId/submission/:candidateId', submission);

export default router;
