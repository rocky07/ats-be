import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { verifyDevToken, findUserById, provisionUser } from '../services/authService.js';

const COGNITO_CONFIGURED = !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);

let verifier = null;
if (COGNITO_CONFIGURED) {
  verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: process.env.COGNITO_CLIENT_ID,
  });
}

// Routes that don't require authentication
const PUBLIC_PATHS = [
  /^\/api\/auth\/config$/,
  /^\/api\/auth\/provision$/,
  /^\/api\/auth\/dev-login$/,
  /^\/api\/auth\/dev-register$/,
  /^\/api\/exams\/[^/]+$/,           // GET public exam
  /^\/api\/exams\/[^/]+\/submit$/,   // POST exam submit
];

export function authMiddleware(req, res, next) {
  // Always allow public paths
  if (PUBLIC_PATHS.some((re) => re.test(req.path))) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Dev mode token
  if (token.startsWith('dev.')) {
    if (COGNITO_CONFIGURED) {
      return res.status(401).json({ error: 'Dev tokens not accepted when Cognito is configured' });
    }
    const payload = verifyDevToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid dev token' });
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    return next();
  }

  // Cognito JWT
  if (!verifier) {
    return res.status(401).json({ error: 'Authentication not configured' });
  }

  verifier.verify(token)
    .then((payload) => {
      // JIT provision on every request (lightweight — just updates lastLoginAt if exists)
      const user = provisionUser({
        cognitoSub: payload.sub,
        email: payload.email ?? payload.username,
        name: payload.name ?? payload['cognito:username'],
        groups: payload['cognito:groups'] ?? [],
      });
      req.user = user;
      next();
    })
    .catch(() => res.status(401).json({ error: 'Invalid or expired token' }));
}
