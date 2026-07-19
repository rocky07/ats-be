import {
  getSystemSettings,
  updateSystemSettings,
  getUserSettings,
  updateUserSettings,
} from '../services/settingsService.js';

// Secrets/infra config must only ever come from process.env, never be stored
// in or served from the DB — strip them defensively on both read and write so
// this endpoint can't be used to exfiltrate or overwrite them.
const SECRET_FIELDS = ['anthropicApiKey', 'msGraph', 'cognito'];
const omitSecretFields = (obj = {}) => {
  const clean = { ...obj };
  for (const key of SECRET_FIELDS) delete clean[key];
  return clean;
};

// GET /api/settings/system  — admin only
export const getSystem = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(omitSecretFields(await getSystemSettings()));
};

// PATCH /api/settings/system  — admin only
export const patchSystem = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(omitSecretFields(await updateSystemSettings(omitSecretFields(req.body))));
};

// GET /api/settings/user  — returns own settings
export const getUser = async (req, res) => {
  res.json(await getUserSettings(req.user.id));
};

// PATCH /api/settings/user  — updates own settings
export const patchUser = async (req, res) => {
  res.json(await updateUserSettings(req.user.id, req.body));
};

// GET /api/settings/exam  — any authenticated user can read the default (used as the
// fallback shown in each job's own exam-config modal)
export const getExam = async (req, res) => {
  const { examSettings } = await getSystemSettings();
  res.json(examSettings);
};

// PATCH /api/settings/exam  — admin only; this is the org-wide default, overridable
// per job requirement via requirement.examConfig
export const patchExam = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { examSettings } = await updateSystemSettings({ examSettings: req.body });
  res.json(examSettings);
};
