import {
  provisionUser,
  devLogin,
  createDevUser,
  signDevToken,
  listUsers,
  findUserById,
} from '../services/authService.js';
import { getUserSettings } from '../services/settingsService.js';

const COGNITO_CONFIGURED = !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);

// POST /api/auth/provision  — called by frontend after Cognito login succeeds
// Body: { cognitoSub, email, name, picture, groups }
export const provision = (req, res) => {
  try {
    const { cognitoSub, email, name, picture, groups } = req.body;
    if (!cognitoSub || !email) return res.status(400).json({ error: 'cognitoSub and email required' });
    const user = provisionUser({ cognitoSub, email, name, picture, groups });
    const settings = getUserSettings(user.id);
    res.json({ user, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/dev-login  — only when Cognito is NOT configured
export const devLoginHandler = (req, res) => {
  if (COGNITO_CONFIGURED) {
    return res.status(403).json({ error: 'Use Cognito authentication' });
  }
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = devLogin(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signDevToken(user);
  const settings = getUserSettings(user.id);
  res.json({ token, user, settings });
};

// POST /api/auth/dev-register  — only when Cognito is NOT configured
export const devRegister = (req, res) => {
  if (COGNITO_CONFIGURED) {
    return res.status(403).json({ error: 'Use Cognito to create users' });
  }
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = createDevUser({ email, name, password, role });
    const token = signDevToken(user);
    const settings = getUserSettings(user.id);
    res.json({ token, user, settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/auth/me  — return current user + settings (requires auth)
export const me = (req, res) => {
  const user = findUserById(req.user.id);
  const settings = getUserSettings(req.user.id);
  res.json({ user, settings, cognitoConfigured: COGNITO_CONFIGURED });
};

// GET /api/auth/users  — admin only
export const getUsers = (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(listUsers());
};

// GET /api/auth/config  — public: tells frontend whether Cognito is configured
export const authConfig = (_req, res) => {
  res.json({
    cognitoConfigured: COGNITO_CONFIGURED,
    region: process.env.AWS_REGION ?? process.env.COGNITO_REGION ?? 'us-east-1',
    userPoolId: COGNITO_CONFIGURED ? process.env.COGNITO_USER_POOL_ID : null,
    clientId: COGNITO_CONFIGURED ? process.env.COGNITO_CLIENT_ID : null,
  });
};
