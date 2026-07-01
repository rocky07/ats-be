import {
  provisionUser,
  devLogin,
  createDevUser,
  signDevToken,
  listUsers,
  findUserById,
} from '../services/authService.js';
import { getUserSettings, updateUserSettings } from '../services/settingsService.js';
import { buildAuthUrl, exchangeCode, getMemberProfile, FRONTEND_URL } from '../services/linkedinService.js';
import crypto from 'crypto';

const COGNITO_CONFIGURED = !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);

// POST /api/auth/provision  — called by frontend after Cognito login succeeds
export const provision = async (req, res) => {
  try {
    const { cognitoSub, email, name, picture, groups } = req.body;
    if (!cognitoSub || !email) return res.status(400).json({ error: 'cognitoSub and email required' });
    const user = await provisionUser({ cognitoSub, email, name, picture, groups });
    const settings = await getUserSettings(user.id);
    res.json({ user, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/dev-login  — only when Cognito is NOT configured
export const devLoginHandler = async (req, res) => {
  if (COGNITO_CONFIGURED) {
    return res.status(403).json({ error: 'Use Cognito authentication' });
  }
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await devLogin(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signDevToken(user);
  const settings = await getUserSettings(user.id);
  res.json({ token, user, settings });
};

// POST /api/auth/dev-register  — only when Cognito is NOT configured
export const devRegister = async (req, res) => {
  if (COGNITO_CONFIGURED) {
    return res.status(403).json({ error: 'Use Cognito to create users' });
  }
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await createDevUser({ email, name, password, role });
    const token = signDevToken(user);
    const settings = await getUserSettings(user.id);
    res.json({ token, user, settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/auth/me  — return current user + settings (requires auth)
export const me = async (req, res) => {
  const [user, settings] = await Promise.all([
    findUserById(req.user.id),
    getUserSettings(req.user.id),
  ]);
  res.json({ user, settings, cognitoConfigured: COGNITO_CONFIGURED });
};

// GET /api/auth/users  — admin only
export const getUsers = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(await listUsers());
};

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────

const oauthStates = new Map();

export const linkedinConnect = (req, res) => {
  if (!process.env.LINKEDIN_CLIENT_ID) {
    return res.status(400).json({ error: 'LinkedIn client ID not configured' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { userId: req.user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.redirect(buildAuthUrl(state));
};

export const linkedinCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/settings?linkedin=denied`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || Date.now() > stateData.expiresAt) {
    return res.redirect(`${FRONTEND_URL}/settings?linkedin=error&reason=state`);
  }
  oauthStates.delete(state);

  try {
    const tokens = await exchangeCode(code);
    const profile = await getMemberProfile(tokens.access_token);

    await updateUserSettings(stateData.userId, {
      personalLinkedin: {
        enabled:       true,
        accessToken:   tokens.access_token,
        tokenExpiry:   Date.now() + (tokens.expires_in ?? 5183944) * 1000,
        linkedinUrn:   profile.sub,
        linkedinName:  profile.name ?? '',
        linkedinEmail: profile.email ?? '',
        connectedAt:   new Date().toISOString(),
      },
    });

    res.redirect(`${FRONTEND_URL}/settings?linkedin=connected`);
  } catch (err) {
    console.error('LinkedIn callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/settings?linkedin=error&reason=token`);
  }
};

export const linkedinDisconnect = async (req, res) => {
  await updateUserSettings(req.user.id, {
    personalLinkedin: {
      enabled:       false,
      accessToken:   '',
      tokenExpiry:   null,
      linkedinUrn:   '',
      linkedinName:  '',
      linkedinEmail: '',
      connectedAt:   null,
    },
  });
  res.json({ ok: true });
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
