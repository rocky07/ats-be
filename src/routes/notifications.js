import { Router } from 'express';
import { getNotifications, patchRead, patchReadAll } from '../controllers/notifications.js';

const router = Router();

router.get('/', getNotifications);
router.patch('/read-all', patchReadAll);
router.patch('/:id/read', patchRead);

export default router;
