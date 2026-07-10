import { dbScan, dbGet, dbPut, dbDelete, dbQuery } from '../config/dynamodb.js';

const INTERVIEWS_TABLE = 'BourntecATS-Interviews';
const PANEL_TABLE = 'BourntecATS-PanelMembers';

const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_ORGANIZER_EMAIL } = process.env;

export const MS_CONFIGURED = !!(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET && MS_ORGANIZER_EMAIL);

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
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Mail ───────────────────────────────────────────────────────────────────────
export async function sendGraphMail({ to, cc, bcc, subject, html }) {
  if (!MS_CONFIGURED) throw new Error('Microsoft Graph credentials not configured');

  const toList = Array.isArray(to) ? to : [to];
  const toRecipients = toList.map((address) => ({ emailAddress: { address } }));
  const ccRecipients = (cc ?? []).map((address) => ({ emailAddress: { address } }));
  const bccRecipients = (bcc ?? []).map((address) => ({ emailAddress: { address } }));

  await graphFetch(`/users/${encodeURIComponent(MS_ORGANIZER_EMAIL)}/sendMail`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients,
        ...(ccRecipients.length ? { ccRecipients } : {}),
        ...(bccRecipients.length ? { bccRecipients } : {}),
      },
    }),
  });
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
  results.forEach((r, i) => {
    const email = attendeeEmails[i];
    if (r.status === 'fulfilled' && r.value.events.length > 0) {
      conflicts.push({
        email,
        events: r.value.events.map((e) => ({
          subject: e.subject,
          start: e.start.dateTime,
          end: e.end.dateTime,
        })),
      });
    } else if (r.status === 'rejected') {
      conflicts.push({ email, accessError: true });
    }
  });
  return { configured: true, conflicts };
}

// ── Schedule Teams meeting ────────────────────────────────────────────────────
// Pass `meetingId` (from a previous booking) to update that event in place — same
// Teams link, calendar entry, and attendee thread — instead of creating a new one.
export async function scheduleTeamsMeeting({ subject, attendeeEmails, startISO, endISO, notes = '', meetingId, existingTeamsLink }) {
  if (!MS_CONFIGURED) {
    const mockId = meetingId ?? `mock-${Date.now()}`;
    console.log(`[interviewService] MS Graph not configured — mock meeting ${meetingId ? 'updated' : 'created'}: ${mockId}`);
    return {
      id: mockId,
      teamsLink: existingTeamsLink ?? `https://teams.microsoft.com/l/meetup-join/mock/${mockId}`,
      webLink: null,
      subject,
      start: startISO,
      end: endISO,
      mock: true,
    };
  }

  const attendees = attendeeEmails.map((email) => ({
    emailAddress: { address: email },
    type: 'required',
  }));

  if (meetingId) {
    // Online-meeting fields are immutable after creation — only resend the fields that can change.
    const updated = await graphFetch(
      `/users/${encodeURIComponent(MS_ORGANIZER_EMAIL)}/events/${encodeURIComponent(meetingId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          subject,
          body: { contentType: 'HTML', content: notes || `Interview scheduled via Bourntec ATS` },
          start: { dateTime: startISO, timeZone: 'UTC' },
          end: { dateTime: endISO, timeZone: 'UTC' },
          attendees,
        }),
      },
    );

    return {
      id: updated.id,
      teamsLink: updated.onlineMeeting?.joinUrl ?? existingTeamsLink ?? null,
      webLink: updated.webLink ?? null,
      subject: updated.subject,
      start: updated.start.dateTime,
      end: updated.end.dateTime,
      mock: false,
    };
  }

  const event = {
    subject,
    body: { contentType: 'HTML', content: notes || `Interview scheduled via Bourntec ATS` },
    start: { dateTime: startISO, timeZone: 'UTC' },
    end: { dateTime: endISO, timeZone: 'UTC' },
    attendees,
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
export async function getPanelMembers({ department, region } = {}) {
  let members = await dbScan(PANEL_TABLE);
  if (department) {
    members = members.filter(
      (m) => !m.departments?.length || m.departments.includes(department),
    );
  }
  if (region && region !== 'global') {
    members = members.filter(
      (m) => !m.regions?.length || m.regions.includes('global') || m.regions.includes(region),
    );
  }
  return members;
}

export async function upsertPanelMember({ id, name, email, role, departments = [], regions = [] }) {
  const member = { id: id ?? Date.now().toString(), name, email, role, departments, regions };
  await dbPut(PANEL_TABLE, member);
  return dbScan(PANEL_TABLE);
}

export async function deletePanelMember(id) {
  await dbDelete(PANEL_TABLE, { id });
  return dbScan(PANEL_TABLE);
}

// ── Interview record ──────────────────────────────────────────────────────────
export async function saveInterview(record) {
  const interview = { id: Date.now().toString(), scheduledAt: new Date().toISOString(), ...record };
  await dbPut(INTERVIEWS_TABLE, interview);
  return interview;
}

export async function updateInterview(id, updates) {
  const existing = await dbGet(INTERVIEWS_TABLE, { id });
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: existing.id };
  await dbPut(INTERVIEWS_TABLE, updated);
  return updated;
}

export async function getInterviewsByCandidate(candidateId) {
  return dbQuery(
    INTERVIEWS_TABLE,
    'candidateId-index',
    'candidateId = :cid',
    { ':cid': String(candidateId) },
  );
}
