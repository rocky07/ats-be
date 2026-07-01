import crypto from 'crypto';
import { dbGet, dbPut, dbQuery, dbScan } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Users';

// ── User CRUD ─────────────────────────────────────────────────────────────────

export async function findUserBySub(sub) {
  if (!sub) return null;
  const items = await dbQuery(TABLE, 'cognitoSub-index', 'cognitoSub = :s', { ':s': sub });
  return items[0] ?? null;
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const items = await dbQuery(TABLE, 'email-index', 'email = :e', { ':e': email.toLowerCase() });
  return items[0] ?? null;
}

export async function findUserById(id) {
  return dbGet(TABLE, { id });
}

export async function provisionUser({ cognitoSub, email, name, picture, groups = [] }) {
  const existing = await findUserBySub(cognitoSub);
  if (existing) {
    existing.lastLoginAt = new Date().toISOString();
    if (name && !existing.name) existing.name = name;
    await dbPut(TABLE, existing);
    return existing;
  }

  const role = groups.includes('admins') ? 'admin' : 'recruiter';
  const user = {
    id: Date.now().toString(),
    cognitoSub,
    email: email.toLowerCase(),
    name: name ?? email,
    picture: picture ?? null,
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await dbPut(TABLE, user);
  return user;
}

// ── Dev-mode local auth ───────────────────────────────────────────────────────

const DEV_SECRET = process.env.DEV_JWT_SECRET ?? 'bourntec-dev-secret-change-in-prod';

export function signDevToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: Date.now() }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', DEV_SECRET).update(payload).digest('base64url');
  return `dev.${payload}.${sig}`;
}

export function verifyDevToken(token) {
  try {
    const parts = token.split('.');
    if (parts[0] !== 'dev' || parts.length !== 3) return null;
    const [, payload, sig] = parts;
    const expected = crypto.createHmac('sha256', DEV_SECRET).update(payload).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + DEV_SECRET).digest('hex');
}

export async function createDevUser({ email, name, password, role = 'recruiter' }) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('User already exists');
  const user = {
    id: Date.now().toString(),
    // cognitoSub intentionally omitted — null is not a valid DynamoDB GSI key
    email: email.toLowerCase(),
    name: name ?? email,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await dbPut(TABLE, user);
  return user;
}

export async function devLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  user.lastLoginAt = new Date().toISOString();
  await dbPut(TABLE, user);
  return user;
}

export async function listUsers() {
  const all = await dbScan(TABLE);
  return all.map(({ passwordHash, ...u }) => u);
}
