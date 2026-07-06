/**
 * LinkedIn OAuth 2.0 + UGC Posts API helpers.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

const CLIENT_ID     = process.env.LINKEDIN_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? '';
const REDIRECT_URI  = process.env.LINKEDIN_REDIRECT_URI  ?? 'http://localhost:3000/api/auth/linkedin/callback';
const FRONTEND_URL  = process.env.FRONTEND_URL           ?? 'http://localhost:5173';

// Scopes needed: openid + profile + email for identity; w_member_social for posting
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

// ── OAuth URLs ─────────────────────────────────────────────────────────────────

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    state,
    scope:         SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

// ── Token exchange ─────────────────────────────────────────────────────────────

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  return res.json(); // { access_token, expires_in, id_token, ... }
}

// ── Get LinkedIn member identity (sub = member URN without prefix) ─────────────

export async function getMemberProfile(accessToken) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch LinkedIn userinfo');
  return res.json(); // { sub, name, email, picture, ... }
}

// ── Post a job opening to the member's feed ────────────────────────────────────

export async function postJobToLinkedIn({ accessToken, linkedinUrn, requirement, applyUrl }) {
  const text =
    `🚀 We're hiring: ${requirement.title}\n\n` +
    `${requirement.description ?? ''}\n\n` +
    `📍 Department: ${requirement.department ?? 'N/A'}\n\n` +
    `Apply here 👉 ${applyUrl}\n\n` +
    `#hiring #jobs #recruitment`;

  return postTextToLinkedIn({ accessToken, linkedinUrn, text });
}

// ── Post arbitrary (e.g. user-customized) text to the member's feed ───────────

export async function postTextToLinkedIn({ accessToken, linkedinUrn, text }) {
  const body = {
    author: `urn:li:person:${linkedinUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn post failed: ${err}`);
  }

  return res.json(); // { id: 'urn:li:ugcPost:...' }
}

export { FRONTEND_URL };
