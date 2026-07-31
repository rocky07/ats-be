import { dbPut, dbScan, dbGet } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Notifications';

// Org-wide notification feed (this app is single-tenant — no per-user scoping,
// same pattern as settingsService's "any user" fallback).
export const listNotifications = async () => {
  const rows = await dbScan(TABLE);
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const createNotification = async ({ type, title, message, meta }) => {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    meta: meta ?? {},
    read: false,
    createdAt: new Date().toISOString(),
  };
  await dbPut(TABLE, notification);
  return notification;
};

export const markNotificationRead = async (id) => {
  const existing = await dbGet(TABLE, { id });
  if (!existing) return null;
  const updated = { ...existing, read: true };
  await dbPut(TABLE, updated);
  return updated;
};

export const markAllNotificationsRead = async () => {
  const rows = await dbScan(TABLE);
  const unread = rows.filter((r) => !r.read);
  await Promise.all(unread.map((r) => dbPut(TABLE, { ...r, read: true })));
  return unread.length;
};
