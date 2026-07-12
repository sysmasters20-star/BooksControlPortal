import { query } from '../database/connection.js';

export async function createNotification(data: { userId?: string; title: string; message: string; type?: string; link?: string }) {
  await query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.userId || null, data.title, data.message, data.type || 'info', data.link || null],
  );
}

export async function listNotifications(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const countResult = await query('SELECT COUNT(*)::int FROM notifications');
  const total = parseInt(countResult.rows[0]?.count || '0');

  const result = await query(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset],
  );

  return { notifications: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function markAsRead(notificationId: string) {
  await query('UPDATE notifications SET is_read = true WHERE id = $1', [notificationId]);
}
