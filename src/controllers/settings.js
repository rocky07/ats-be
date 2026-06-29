import {
  getSystemSettings,
  updateSystemSettings,
  getUserSettings,
  updateUserSettings,
} from '../services/settingsService.js';

// GET /api/settings/system  — admin only
export const getSystem = (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(getSystemSettings());
};

// PATCH /api/settings/system  — admin only
export const patchSystem = (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(updateSystemSettings(req.body));
};

// GET /api/settings/user  — returns own settings
export const getUser = (req, res) => {
  res.json(getUserSettings(req.user.id));
};

// PATCH /api/settings/user  — updates own settings
export const patchUser = (req, res) => {
  res.json(updateUserSettings(req.user.id, req.body));
};
