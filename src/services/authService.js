import crypto from 'crypto';
import db from '../config/db.js';

// ── User CRUD ─────────────────────────────────────────────────────────────────

export function findUserBySub(sub) {
  return (db.data.users ?? []).find((u) => u.cognitoSub === sub);
}

export function findUserByEmail(email) {
  return (db.data.users ?? []).find(
    (u) => u.email?.toLowerCase() === email?.toLowerCase(),
  );
}

export function findUserById(id) {
  return (db.data.users ?? []).find((u) => u.id === id);
}

// JIT provision — called after first successful Cognito login.
// If user already exists, update lastLoginAt and return; otherwise create.
export function provisionUser({ cognitoSub, email, name, picture, groups = [] }) {
  if (!db.data.users) db.data.users = [];

  const existing = findUserBySub(cognitoSub);
  if (existing) {
    existing.lastLoginAt = new Date().toISOString();
    if (name && !existing.name) existing.name = name;
    db.write();
    return existing;
  }

  // First login — determine role from Cognito groups (admins group → admin)
  const role = groups.includes('admins') ? 'admin' : 'recruiter';

  const user = {
    id: Date.now().toString(),
    cognitoSub,
    email,
    name: name ?? email,
    picture: picture ?? null,
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.write();
  return user;
}

// ── Dev-mode local auth (used when Cognito is not configured) ─────────────────

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

// Simple password hash for dev accounts
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + DEV_SECRET).digest('hex');
}

export function createDevUser({ email, name, password, role = 'recruiter' }) {
  if (!db.data.users) db.data.users = [];
  if (findUserByEmail(email)) throw new Error('User already exists');
  const user = {
    id: Date.now().toString(),
    cognitoSub: null,
    email,
    name: name ?? email,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.write();
  return user;
}

export function devLogin(email, password) {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  user.lastLoginAt = new Date().toISOString();
  db.write();
  return user;
}

export function listUsers() {
  return (db.data.users ?? []).map(({ passwordHash, ...u }) => u);
}
