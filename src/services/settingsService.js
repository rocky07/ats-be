import db from '../config/db.js';

const DEFAULT_USER_SETTINGS = {
  emailNotifications: {
    examSubmitted: true,
    interviewScheduled: true,
    candidateMoved: false,
    dailyDigest: false,
  },
  timezone: 'America/New_York',
  theme: 'light',
  defaultView: 'board',
  compactMode: false,
  language: 'en',
  personalLinkedin: { enabled: false, accessToken: '', clientId: '', clientSecret: '' },
  jobBoardToggles: { linkedinCompany: false, linkedinJobs: false, monster: false, naukri: false, indeed: false },
};

// ── System Settings (admin-only) ──────────────────────────────────────────────

export function getSystemSettings() {
  return db.data.systemSettings ?? {};
}

export function updateSystemSettings(updates) {
  if (!db.data.systemSettings) db.data.systemSettings = {};
  // Deep-merge top-level keys (smtp, msGraph are objects)
  for (const [key, val] of Object.entries(updates)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      db.data.systemSettings[key] = { ...(db.data.systemSettings[key] ?? {}), ...val };
    } else {
      db.data.systemSettings[key] = val;
    }
  }
  db.write();
  return db.data.systemSettings;
}

// Masked version safe to return to non-admin users
export function getPublicSystemSettings() {
  const s = getSystemSettings();
  return {
    companyName: s.companyName,
    defaultTimezone: s.defaultTimezone,
  };
}

// ── User Settings ─────────────────────────────────────────────────────────────

export function getUserSettings(userId) {
  const row = (db.data.userSettings ?? []).find((s) => s.userId === userId);
  return { ...DEFAULT_USER_SETTINGS, ...(row ?? {}), userId };
}

export function updateUserSettings(userId, updates) {
  if (!db.data.userSettings) db.data.userSettings = [];
  const idx = db.data.userSettings.findIndex((s) => s.userId === userId);
  const current = idx >= 0 ? db.data.userSettings[idx] : { userId };

  const merged = { ...current };
  for (const [key, val] of Object.entries(updates)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      merged[key] = { ...(merged[key] ?? {}), ...val };
    } else {
      merged[key] = val;
    }
  }

  if (idx >= 0) {
    db.data.userSettings[idx] = merged;
  } else {
    db.data.userSettings.push(merged);
  }
  db.write();
  return { ...DEFAULT_USER_SETTINGS, ...merged };
}
