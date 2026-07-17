/**
 * Google Indexing API — notifies Google to (re)crawl or remove a JobPosting URL.
 *
 * Requires a Google Cloud service account with the "Web Search Indexing API"
 * enabled, added as an Owner in Search Console for the verified domain that
 * serves the public apply page. Docs:
 * https://developers.google.com/search/apis/indexing-api/v3/quickstart
 */

import crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const INDEXING_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';

// Cache access tokens per service account so we don't re-sign a JWT on every call.
const tokenCache = new Map(); // client_email -> { accessToken, expiresAt }

const base64url = (input) =>
    Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function getAccessToken(serviceAccount) {
    const cached = tokenCache.get(serviceAccount.client_email);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
        iss: serviceAccount.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    };
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key, 'base64');
    const jwt = `${unsigned}.${signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });
    if (!res.ok) throw new Error(`Google auth failed: ${await res.text()}`);
    const data = await res.json();
    tokenCache.set(serviceAccount.client_email, {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    });
    return data.access_token;
}

// type: 'URL_UPDATED' (new/open job — ask Google to (re)crawl) or 'URL_DELETED' (closed job — ask Google to drop it)
export async function notifyGoogleIndexing({ serviceAccountKeyJson, url, type }) {
    if (!serviceAccountKeyJson || !url) throw new Error('Service account key and URL are required');
    if (!['URL_UPDATED', 'URL_DELETED'].includes(type)) throw new Error(`Invalid notification type: ${type}`);

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountKeyJson);
    } catch {
        throw new Error('Invalid Google service account key JSON');
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Service account JSON is missing client_email or private_key');
    }

    const accessToken = await getAccessToken(serviceAccount);
    const res = await fetch(INDEXING_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type }),
    });
    if (!res.ok) throw new Error(`Google Indexing API failed: ${await res.text()}`);
    return res.json();
}
