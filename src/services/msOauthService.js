/**
 * Delegated Microsoft Graph OAuth (per-user "Connect Outlook") — separate from
 * the app-only client-credentials flow in interviewService.js, which acts as
 * a single org-wide sender/organizer. This lets each recruiter authorize the
 * app to read their own mailbox.
 *
 * Docs: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */

const TENANT_ID     = process.env.MS_TENANT_ID     ?? '';
const CLIENT_ID     = process.env.MS_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET ?? '';
const REDIRECT_URI  = process.env.MS_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/auth/outlook/callback';
const FRONTEND_URL  = process.env.FRONTEND_URL          ?? 'http://localhost:5173';

// offline_access → refresh token; Mail.Read → read the signed-in user's mailbox
const SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Mail.Read',
].join(' ');

export const MS_OAUTH_CONFIGURED = !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET);

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    state,
  });
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

async function tokenRequest(body) {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MS OAuth token error: ${JSON.stringify(data)}`);
  return data; // { access_token, refresh_token, expires_in, id_token, ... }
}

export function exchangeCode(code) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPES,
  }));
}

export function refreshAccessToken(refreshToken) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPES,
  }));
}

export async function getMe(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Microsoft profile');
  return res.json(); // { displayName, mail, userPrincipalName, ... }
}

export { FRONTEND_URL };
