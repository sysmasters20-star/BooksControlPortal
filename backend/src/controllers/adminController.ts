import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listBookshops(req: Request, res: Response) {
  const { page: pageStr, limit: limitStr } = req.query;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const countResult = await query('SELECT COUNT(*)::int FROM bookshops');
  const total = parseInt(countResult.rows[0]?.count || '0');

  const result = await query(
    `SELECT bs.*, u.email as owner_email, u.name as owner_name,
            (SELECT COUNT(*) FROM book_access ba WHERE ba.bookshop_id = bs.id) as assigned_books,
            (SELECT COALESCE(SUM(ps.copies), 0) FROM print_sessions ps WHERE ps.bookshop_id = bs.id) as total_prints
     FROM bookshops bs
     LEFT JOIN users u ON u.id = bs.owner_id
     ORDER BY bs.name LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  res.json({ bookshops: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getBookshop(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query(
    `SELECT bs.*, u.email as owner_email, u.name as owner_name
     FROM bookshops bs
     LEFT JOIN users u ON u.id = bs.owner_id
     WHERE bs.id = $1`,
    [id],
  );
  if (result.rows.length === 0) {
    throw new AppError(404, 'Bookshop not found');
  }
  res.json({ bookshop: result.rows[0] });
}

export async function createBookshop(req: Request, res: Response) {
  const { name, email, phone, address, owner_name, owner_email, owner_password } = req.body;

  let ownerId: string | null = null;
  if (owner_email && owner_password) {
    const existing = await query('SELECT id FROM users WHERE email = $1', [owner_email]);
    if (existing.rows.length > 0) {
      ownerId = existing.rows[0].id;
    } else {
      const passwordHash = await bcrypt.hash(owner_password, 12);
      const userRes = await query(
        `INSERT INTO users (email, password_hash, name, role, is_verified)
         VALUES ($1, $2, $3, 'bookshop_owner', true) RETURNING id`,
        [owner_email, passwordHash, owner_name || name],
      );
      ownerId = userRes.rows[0].id;
    }
  }

  const result = await query(
    `INSERT INTO bookshops (name, owner_id, address, phone, email, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [name, ownerId, address || null, phone || null, email || null],
  );

  res.status(201).json({ bookshop: result.rows[0] });
}

export async function updateBookshop(req: Request, res: Response) {
  const { id } = req.params;
  const { name, address, phone, email, is_active } = req.body;

  const result = await query(
    `UPDATE bookshops SET name = COALESCE($1, name), address = COALESCE($2, address),
     phone = COALESCE($3, phone), email = COALESCE($4, email),
     is_active = COALESCE($5, is_active), updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [name, address, phone, email, is_active, id],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Bookshop not found');
  }

  res.json({ bookshop: result.rows[0] });
}

export async function deleteBookshop(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query('DELETE FROM bookshops WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'Bookshop not found');
  }
  res.status(204).send();
}

export async function getBookshopAnalytics(req: Request, res: Response) {
  const { id } = req.params;

  const totalSessions = await query(
    'SELECT COUNT(*)::int, COALESCE(SUM(copies), 0)::int as total_copies FROM print_sessions WHERE bookshop_id = $1',
    [id],
  );

  const booksPrinted = await query(
    `SELECT b.id, b.title, COUNT(ps.id)::int as times_printed, COALESCE(SUM(ps.copies), 0)::int as total_copies
     FROM print_sessions ps
     INNER JOIN books b ON b.id = ps.book_id
     WHERE ps.bookshop_id = $1
     GROUP BY b.id, b.title
     ORDER BY total_copies DESC`,
    [id],
  );

  const recentSessions = await query(
    `SELECT ps.*, b.title as book_title, u.name as user_name
     FROM print_sessions ps
     LEFT JOIN books b ON b.id = ps.book_id
     LEFT JOIN users u ON u.id = ps.user_id
     WHERE ps.bookshop_id = $1
     ORDER BY ps.created_at DESC LIMIT 50`,
    [id],
  );

  res.json({
    analytics: {
      total_sessions: parseInt(totalSessions.rows[0]?.count || '0'),
      total_copies: parseInt(totalSessions.rows[0]?.total_copies || '0'),
      books_printed: booksPrinted.rows,
      recent_sessions: recentSessions.rows,
    },
  });
}

export async function getPlatformStats(req: Request, res: Response) {
  const totalUsers = await query('SELECT COUNT(*)::int FROM users');
  const totalBooks = await query('SELECT COUNT(*)::int FROM books');
  const totalShops = await query('SELECT COUNT(*)::int FROM bookshops');
  const totalSessions = await query('SELECT COUNT(*)::int, COALESCE(SUM(copies), 0)::int as total_copies FROM print_sessions');
  const approvedBooks = await query("SELECT COUNT(*)::int FROM books WHERE status = 'approved'");
  const pendingBooks = await query("SELECT COUNT(*)::int FROM books WHERE status = 'pending'");

  const printsByDay = await query(
    `SELECT DATE(created_at) as date, COUNT(*)::int as sessions, COALESCE(SUM(copies), 0)::int as copies
     FROM print_sessions
     WHERE created_at > NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date`,
  );

  const topBooks = await query(
    `SELECT b.id, b.title, COUNT(ps.id)::int as times_printed, COALESCE(SUM(ps.copies), 0)::int as total_copies
     FROM print_sessions ps
     INNER JOIN books b ON b.id = ps.book_id
     GROUP BY b.id, b.title
     ORDER BY total_copies DESC LIMIT 10`,
  );

  const topShops = await query(
    `SELECT bs.id, bs.name, COUNT(ps.id)::int as sessions, COALESCE(SUM(ps.copies), 0)::int as total_copies
     FROM print_sessions ps
     INNER JOIN bookshops bs ON bs.id = ps.bookshop_id
     GROUP BY bs.id, bs.name
     ORDER BY total_copies DESC LIMIT 10`,
  );

  res.json({
    stats: {
      total_users: parseInt(totalUsers.rows[0]?.count || '0'),
      total_books: parseInt(totalBooks.rows[0]?.count || '0'),
      total_bookshops: parseInt(totalShops.rows[0]?.count || '0'),
      total_print_sessions: parseInt(totalSessions.rows[0]?.count || '0'),
      total_printed_copies: parseInt(totalSessions.rows[0]?.total_copies || '0'),
      approved_books: parseInt(approvedBooks.rows[0]?.count || '0'),
      pending_books: parseInt(pendingBooks.rows[0]?.count || '0'),
      prints_by_day: printsByDay.rows,
      top_books: topBooks.rows,
      top_bookshops: topShops.rows,
    },
  });
}

export async function getAuditLogs(req: Request, res: Response) {
  const { action, userId, resourceType, page: pageStr, limit: limitStr } = req.query;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  const join = ' FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id';

  if (action) { paramIdx++; params.push(action); conditions.push(`al.action = $${paramIdx}`); }
  if (userId) { paramIdx++; params.push(userId); conditions.push(`al.user_id = $${paramIdx}`); }
  if (resourceType) { paramIdx++; params.push(resourceType); conditions.push(`al.resource_type = $${paramIdx}`); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countResult = await query(`SELECT COUNT(*)::int${join}${where}`, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  paramIdx++; params.push(limit);
  paramIdx++; params.push(offset);

  const result = await query(
    `SELECT al.*, u.email as user_email, u.name as user_name${join}${where}
     ORDER BY al.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
    params,
  );
  res.json({ auditLogs: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
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
  const { bookshop_id, from, to } = req.query;

  let sql = `SELECT ps.created_at, ps.copies, ps.session_token, b.title as book_title,
                    bs.name as bookshop_name, u.name as user_name, u.email as user_email
             FROM print_sessions ps
             LEFT JOIN books b ON b.id = ps.book_id
             LEFT JOIN bookshops bs ON bs.id = ps.bookshop_id
             LEFT JOIN users u ON u.id = ps.user_id
             WHERE 1=1`;
  const params: unknown[] = [];
  let paramIdx = 0;

  if (bookshop_id) { paramIdx++; params.push(bookshop_id); sql += ` AND ps.bookshop_id = $${paramIdx}`; }
  if (from) { paramIdx++; params.push(from); sql += ` AND ps.created_at >= $${paramIdx}`; }
  if (to) { paramIdx++; params.push(to); sql += ` AND ps.created_at <= $${paramIdx}`; }

  sql += ' ORDER BY ps.created_at DESC';

  const result = await query(sql, params);
  const rows = result.rows;

  const header = 'Date,Book,Bookshop,Copies,User,Email,Session Token\n';
  const csv = rows.map((r: Record<string, unknown>) =>
    `"${r.created_at}","${r.book_title}","${r.bookshop_name}","${r.copies}","${r.user_name}","${r.user_email}","${r.session_token}"`,
  ).join('\n');

  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="print-sessions-${new Date().toISOString().split('T')[0]}.csv"`,
  });
  res.send(header + csv);
}

export async function listNotifications(req: Request, res: Response) {
  const { page: pageStr, limit: limitStr } = req.query;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(limitStr as string, 10) || 20));
  const offset = (page - 1) * limit;

  const countResult = await query('SELECT COUNT(*)::int FROM notifications');
  const total = parseInt(countResult.rows[0]?.count || '0');

  const result = await query(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset],
  );

  res.json({ notifications: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function markNotificationRead(req: Request, res: Response) {
  const { id } = req.params;
  await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
  res.json({ message: 'Notification marked as read' });
}

export async function createNotification(data: { userId?: string; title: string; message: string; type?: string; link?: string }) {
  await query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.userId || null, data.title, data.message, data.type || 'info', data.link || null],
  );
}
