import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationsService.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await listNotifications();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
};

export const patchRead = async (req, res) => {
  try {
    const notification = await markNotificationRead(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

export const patchReadAll = async (req, res) => {
  try {
    const count = await markAllNotificationsRead();
    res.json({ marked: count });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};
