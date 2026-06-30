import { Router } from 'express';
import { provision, devLoginHandler, devRegister, me, getUsers, authConfig, linkedinConnect, linkedinCallback, linkedinDisconnect } from '../controllers/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/config', authConfig);          // public
router.post('/provision', provision);        // called after Cognito login, no server-side auth check needed
router.post('/dev-login', devLoginHandler);  // dev only
router.post('/dev-register', devRegister);   // dev only
router.get('/me', me);                       // requires auth (via app-level middleware)
router.get('/users', getUsers);              // admin only

// LinkedIn OAuth — /linkedin and /linkedin/callback are auth-required but registered here
// because the callback redirect must match exactly what LinkedIn allows
router.get('/linkedin', authMiddleware, linkedinConnect);
router.get('/linkedin/callback', linkedinCallback);    // LinkedIn redirects here — no app token yet
router.delete('/linkedin', authMiddleware, linkedinDisconnect);

export default router;
