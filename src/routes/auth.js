import { Router } from 'express';
import { provision, devLoginHandler, devRegister, me, getUsers, authConfig } from '../controllers/auth.js';

const router = Router();

router.get('/config', authConfig);          // public
router.post('/provision', provision);        // called after Cognito login, no server-side auth check needed
router.post('/dev-login', devLoginHandler);  // dev only
router.post('/dev-register', devRegister);   // dev only
router.get('/me', me);                       // requires auth (via middleware)
router.get('/users', getUsers);              // admin only

export default router;
