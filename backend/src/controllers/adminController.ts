import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listBookshops(req: Request, res: Response) {
  const result = await query(
    `SELECT bs.*, u.email as owner_email, u.name as owner_name,
            (SELECT COUNT(*) FROM book_access ba WHERE ba.bookshop_id = bs.id) as assigned_books,
            (SELECT COALESCE(SUM(ps.copies), 0) FROM print_sessions ps WHERE ps.bookshop_id = bs.id) as total_prints
     FROM bookshops bs
     LEFT JOIN users u ON u.id = bs.owner_id
     ORDER BY bs.name`,
  );
  res.json({ bookshops: result.rows });
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
  const { action, userId, resourceType, limit = '100' } = req.query;
  let sql = `SELECT al.*, u.email as user_email, u.name as user_name
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id WHERE 1=1`;
  const params: unknown[] = [];

  if (action) {
    params.push(action);
    sql += ` AND al.action = $${params.length}`;
  }
  if (userId) {
    params.push(userId);
    sql += ` AND al.user_id = $${params.length}`;
  }
  if (resourceType) {
    params.push(resourceType);
    sql += ` AND al.resource_type = $${params.length}`;
  }

  sql += ' ORDER BY al.created_at DESC LIMIT $' + (params.length + 1);
  params.push(parseInt(limit as string, 10));

  const result = await query(sql, params);
  res.json({ auditLogs: result.rows });
}
