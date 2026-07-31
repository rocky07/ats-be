import { Router } from 'express';
import {
  getSystem,
  patchSystem,
  getUser,
  patchUser,
  getExam,
  patchExam,
  postOutlookSync,
} from '../controllers/settings.js';

const router = Router();

router.get('/system', getSystem);
router.patch('/system', patchSystem);
router.get('/user', getUser);
router.patch('/user', patchUser);
router.get('/exam', getExam);
router.patch('/exam', patchExam);
router.post('/outlook/sync', postOutlookSync);

export default router;
