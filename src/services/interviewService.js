import db from '../config/db.js';

const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_ORGANIZER_EMAIL } = process.env;

const MS_CONFIGURED = !!(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET && MS_ORGANIZER_EMAIL);

// ── MS Graph auth ────────────────────────────────────────────────────────────
async function getMsToken() {
  if (!MS_CONFIGURED) throw new Error('Microsoft Graph credentials not configured');
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body: params },
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`MS token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function graphFetch(path, options = {}) {
  const token = await getMsToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API ${res.status}: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Conflict checking ─────────────────────────────────────────────────────────
export async function checkConflicts(attendeeEmails, startISO, endISO) {
  if (!MS_CONFIGURED) return { configured: false, conflicts: [] };

  const results = await Promise.allSettled(
    attendeeEmails.map(async (email) => {
      const data = await graphFetch(
        `/users/${encodeURIComponent(email)}/calendarView` +
          `?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}` +
          `&$select=subject,start,end`,
      );
      return { email, events: data.value ?? [] };
    }),
  );

  const conflicts = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.events.length > 0) {
      conflicts.push({
        email: r.value.email,
        events: r.value.events.map((e) => ({
          subject: e.subject,
          start: e.start.dateTime,
          end: e.end.dateTime,
        })),
      });
    } else if (r.status === 'rejected') {
      // Calendar not accessible — flag but don't block
      conflicts.push({ email: r.reason?.message ?? 'unknown', accessError: true });
    }
  }
  return { configured: true, conflicts };
}

// ── Schedule Teams meeting ────────────────────────────────────────────────────
export async function scheduleTeamsMeeting({ subject, attendeeEmails, startISO, endISO, notes = '' }) {
  if (!MS_CONFIGURED) {
    // Graceful mock when credentials aren't set
    const mockId = `mock-${Date.now()}`;
    console.log(`[interviewService] MS Graph not configured — mock meeting created: ${mockId}`);
    return {
      id: mockId,
      teamsLink: `https://teams.microsoft.com/l/meetup-join/mock/${mockId}`,
      webLink: null,
      subject,
      start: startISO,
      end: endISO,
      mock: true,
    };
  }

  const event = {
    subject,
    body: { contentType: 'HTML', content: notes || `Interview scheduled via Bourntec ATS` },
    start: { dateTime: startISO, timeZone: 'UTC' },
    end: { dateTime: endISO, timeZone: 'UTC' },
    attendees: attendeeEmails.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  const created = await graphFetch(
    `/users/${encodeURIComponent(MS_ORGANIZER_EMAIL)}/events`,
    { method: 'POST', body: JSON.stringify(event) },
  );

  return {
    id: created.id,
    teamsLink: created.onlineMeeting?.joinUrl ?? null,
    webLink: created.webLink ?? null,
    subject: created.subject,
    start: created.start.dateTime,
    end: created.end.dateTime,
    mock: false,
  };
}

// ── Panel members CRUD ────────────────────────────────────────────────────────
export function getPanelMembers({ department, region } = {}) {
  let members = db.data.panelMembers ?? [];
  if (department) {
    members = members.filter(
      (m) => !m.departments?.length || m.departments.includes(department),
    );
  }
  // 'global' region on a member means they cover all regions
  if (region && region !== 'global') {
    members = members.filter(
      (m) => !m.regions?.length || m.regions.includes('global') || m.regions.includes(region),
    );
  }
  return members;
}

export function upsertPanelMember({ id, name, email, role, departments = [], regions = [] }) {
  if (!db.data.panelMembers) db.data.panelMembers = [];
  const existing = db.data.panelMembers.find((m) => m.id === id);
  if (existing) {
    Object.assign(existing, { name, email, role, departments, regions });
  } else {
    db.data.panelMembers.push({ id: id ?? Date.now().toString(), name, email, role, departments, regions });
  }
  db.write();
  return db.data.panelMembers;
}

export function deletePanelMember(id) {
  if (!db.data.panelMembers) return [];
  db.data.panelMembers = db.data.panelMembers.filter((m) => m.id !== id);
  db.write();
  return db.data.panelMembers;
}

// ── Interview record ──────────────────────────────────────────────────────────
export function saveInterview(record) {
  if (!db.data.interviews) db.data.interviews = [];
  const interview = { id: Date.now().toString(), scheduledAt: new Date().toISOString(), ...record };
  db.data.interviews.push(interview);
  db.write();
  return interview;
}

export function getInterviewsByCandidate(candidateId) {
  return (db.data.interviews ?? []).filter((i) => String(i.candidateId) === String(candidateId));
}
