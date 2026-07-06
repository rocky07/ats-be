import {
  getSystemSettings,
  updateSystemSettings,
  getUserSettings,
  updateUserSettings,
} from '../services/settingsService.js';

// GET /api/settings/system  — admin only
export const getSystem = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(await getSystemSettings());
};

// PATCH /api/settings/system  — admin only
export const patchSystem = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(await updateSystemSettings(req.body));
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
