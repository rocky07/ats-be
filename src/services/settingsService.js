import { dbGet, dbPut } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Settings';

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

// ── System Settings ───────────────────────────────────────────────────────────

export async function getSystemSettings() {
  const row = await dbGet(TABLE, { pk: 'SYSTEM' });
  return row ?? {};
}

export async function updateSystemSettings(updates) {
  const current = (await dbGet(TABLE, { pk: 'SYSTEM' })) ?? { pk: 'SYSTEM' };
  for (const [key, val] of Object.entries(updates)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      current[key] = { ...(current[key] ?? {}), ...val };
    } else {
      current[key] = val;
    }
  }
  await dbPut(TABLE, current);
  return current;
}

export async function getPublicSystemSettings() {
  const s = await getSystemSettings();
  return { companyName: s.companyName, defaultTimezone: s.defaultTimezone };
}

// ── User Settings ─────────────────────────────────────────────────────────────

export async function getUserSettings(userId) {
  const row = await dbGet(TABLE, { pk: `USER#${userId}` });
  return { ...DEFAULT_USER_SETTINGS, ...(row ?? {}), userId };
}

export async function updateUserSettings(userId, updates) {
  const pk = `USER#${userId}`;
  const current = (await dbGet(TABLE, { pk })) ?? { pk, userId };

  const merged = { ...current };
  for (const [key, val] of Object.entries(updates)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      merged[key] = { ...(merged[key] ?? {}), ...val };
    } else {
      merged[key] = val;
    }
  }

  await dbPut(TABLE, merged);
  return { ...DEFAULT_USER_SETTINGS, ...merged };
}
