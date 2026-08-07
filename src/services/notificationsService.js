import { dbPut, dbScan, dbGet } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Notifications';

// A notification is visible to a user if it's org-wide (no userId set) or if
// it was created for that specific user (e.g. personal Outlook sync results).
const isVisibleTo = (notification, userId) => !notification.userId || notification.userId === userId;

export const listNotifications = async (userId) => {
  const rows = await dbScan(TABLE);
  return rows
    .filter((r) => isVisibleTo(r, userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const createNotification = async ({ type, title, message, meta, userId }) => {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    meta: meta ?? {},
    ...(userId ? { userId } : {}),
    read: false,
    createdAt: new Date().toISOString(),
  };
  await dbPut(TABLE, notification);
  return notification;
};

export const markNotificationRead = async (id, userId) => {
  const existing = await dbGet(TABLE, { id });
  if (!existing || !isVisibleTo(existing, userId)) return null;
  const updated = { ...existing, read: true };
  await dbPut(TABLE, updated);
  return updated;
};

export const markAllNotificationsRead = async (userId) => {
  const rows = await dbScan(TABLE);
  const unread = rows.filter((r) => !r.read && isVisibleTo(r, userId));
  await Promise.all(unread.map((r) => dbPut(TABLE, { ...r, read: true })));
  return unread.length;
};
