import { Router } from 'express';
import { getSystem, patchSystem, getUser, patchUser } from '../controllers/settings.js';

const router = Router();

router.get('/system', getSystem);
router.patch('/system', patchSystem);
router.get('/user', getUser);
router.patch('/user', patchUser);

export default router;
