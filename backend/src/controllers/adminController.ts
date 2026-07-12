import { Request, Response } from 'express';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import * as bookshopService from '../services/bookshopService.js';
import * as auditService from '../services/auditService.js';
import * as notificationService from '../services/notificationService.js';

export async function listBookshops(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const result = await bookshopService.listBookshops(page, limit);
  res.json(result);
}

export async function getBookshop(req: Request, res: Response) {
  const bookshop = await bookshopService.getBookshopById(req.params.id);
  res.json({ bookshop });
}

export async function createBookshop(req: Request, res: Response) {
  const bookshop = await bookshopService.createBookshop(req.body);
  res.status(201).json({ bookshop });
}

export async function updateBookshop(req: Request, res: Response) {
  const bookshop = await bookshopService.updateBookshop(req.params.id, req.body);
  res.json({ bookshop });
}

export async function deleteBookshop(req: Request, res: Response) {
  await bookshopService.deleteBookshop(req.params.id);
  res.status(204).send();
}

export async function getBookshopAnalytics(req: Request, res: Response) {
  const analytics = await bookshopService.getBookshopAnalytics(req.params.id);
  res.json({ analytics });
}

export async function getPlatformStats(req: Request, res: Response) {
  const stats = await bookshopService.getPlatformStats();
  res.json({ stats });
}

export async function getAuditLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const filters = {
    action: req.query.action as string | undefined,
    userId: req.query.userId as string | undefined,
    resourceType: req.query.resourceType as string | undefined,
  };
  const result = await auditService.listAuditLogs(filters, page, limit);
  res.json(result);
}

export async function listUsers(req: Request, res: Response) {
  const { page: pageStr, limit: limitStr } = req.query;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const countResult = await query('SELECT COUNT(*)::int FROM users');
  const total = parseInt(countResult.rows[0]?.count || '0');

  const result = await query(
    `SELECT id, email, name, role, is_verified, created_at, updated_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  res.json({ users: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function updateUserStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { is_verified } = req.body;

  if (typeof is_verified !== 'boolean') {
    throw new AppError(400, 'is_verified must be a boolean');
  }

  const result = await query(
    'UPDATE users SET is_verified = $1 WHERE id = $2 RETURNING id, email, name, role, is_verified',
    [is_verified, id],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'User not found');
  }

  res.json({ user: result.rows[0] });
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'User not found');
  }
  res.status(204).send();
}

export async function exportPrintSessions(req: Request, res: Response) {
  const filters = {
    bookshop_id: req.query.bookshop_id as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  };
  const { csv } = await bookshopService.exportPrintSessions(filters);

  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="print-sessions-${new Date().toISOString().split('T')[0]}.csv"`,
  });
  res.send(csv);
}

export async function listNotifications(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const result = await notificationService.listNotifications(page, limit);
  res.json(result);
}

export async function markNotificationRead(req: Request, res: Response) {
  await notificationService.markAsRead(req.params.id);
  res.json({ message: 'Notification marked as read' });
}

export async function createNotification(data: { userId?: string; title: string; message: string; type?: string; link?: string }) {
  await notificationService.createNotification(data);
}
