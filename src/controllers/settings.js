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
