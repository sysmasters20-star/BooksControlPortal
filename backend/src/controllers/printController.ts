import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { decrypt } from '../utils/encryption.js';

export async function listJobs(req: Request, res: Response) {
  const { bookshop_id, status, page: pageStr, limit: limitStr } = req.query;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  if (role !== 'admin') { paramIdx++; params.push(userId); conditions.push(`pj.requested_by = $${paramIdx}`); }
  if (bookshop_id) { paramIdx++; params.push(bookshop_id); conditions.push(`pj.bookshop_id = $${paramIdx}`); }
  if (status) { paramIdx++; params.push(status); conditions.push(`pj.status = $${paramIdx}`); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const join = ' FROM print_jobs pj LEFT JOIN books b ON b.id = pj.book_id';

  const countResult = await query(`SELECT COUNT(*)::int${join}${where}`, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  paramIdx++; params.push(limit);
  paramIdx++; params.push(offset);

  const result = await query(
    `SELECT pj.*, b.title as book_title${join}${where} ORDER BY pj.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
    params,
  );
  res.json({ printJobs: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function createJob(req: Request, res: Response) {
  const { book_id, bookshop_id, copies, notes } = req.body;

  const book = await query('SELECT id, status FROM books WHERE id = $1', [book_id]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }
  if (book.rows[0].status !== 'approved') {
    throw new AppError(400, 'Book must be approved before printing');
  }

  const accessCheck = await query(
    `SELECT 1 FROM book_access WHERE book_id = $1 AND bookshop_id = $2`,
    [book_id, bookshop_id],
  );
  if (accessCheck.rows.length === 0) {
    throw new AppError(403, 'Bookshop does not have access to this book');
  }

  const result = await query(
    `INSERT INTO print_jobs (book_id, bookshop_id, requested_by, copies, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [book_id, bookshop_id, req.user!.userId, copies || 1, notes],
  );

  res.status(201).json({ printJob: result.rows[0] });
}

export async function updateJobStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['pending', 'printing', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const completedAt = status === 'completed' ? new Date() : null;
  const result = await query(
    `UPDATE print_jobs SET status = $1, completed_at = $3, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [status, id, completedAt],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Print job not found');
  }

  res.json({ printJob: result.rows[0] });
}

export async function viewWatermarked(req: Request, res: Response) {
  const { bookId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  const book = await query(
    'SELECT id, title, file_data, encryption_iv, pages FROM books WHERE id = $1 AND file_data IS NOT NULL',
    [bookId],
  );
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book PDF not found');
  }

  let bookshopId: string | null = null;
  let bookshopName = 'Administrator';

  if (role === 'admin') {
    bookshopId = (req.query.bookshop_id as string) || null;
    if (bookshopId) {
      const sr = await query('SELECT name FROM bookshops WHERE id = $1', [bookshopId]);
      bookshopName = sr.rows[0]?.name || 'Admin';
    }
  } else {
    const shopResult = await query(
      `SELECT bs.id, bs.name FROM bookshops bs
       INNER JOIN book_access ba ON ba.bookshop_id = bs.id
       WHERE ba.book_id = $1 AND bs.owner_id = $2`,
      [bookId, userId],
    );
    if (shopResult.rows.length === 0) {
      throw new AppError(403, 'No access to this book');
    }
    bookshopId = shopResult.rows[0].id;
    bookshopName = shopResult.rows[0].name;
  }

  let sessionToken = 'preview';
  if (bookshopId) {
    sessionToken = crypto.randomBytes(16).toString('hex');
    await query(
      `INSERT INTO print_sessions (book_id, bookshop_id, user_id, copies, session_token)
       VALUES ($1, $2, $3, 0, $4)`,
      [bookId, bookshopId, userId, sessionToken],
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = decrypt(book.rows[0].file_data, book.rows[0].encryption_iv);
  } catch {
    throw new AppError(500, 'Failed to decrypt PDF');
  }

  const { PDFDocument, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdfBuffer);
  const pages = doc.getPages();
  const now = new Date().toISOString().split('T')[0];

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(`${bookshopName} | ${now} | ${sessionToken}`, {
      x: 50,
      y: 30,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.6,
    });
  }

  const watermarkedPdf = await doc.save();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${book.rows[0].title}-watermarked.pdf"`,
    'X-Session-Id': sessionToken,
    'Content-Length': watermarkedPdf.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
  });
  res.send(Buffer.from(watermarkedPdf));
}

export async function countPrint(req: Request, res: Response) {
  const { bookId } = req.params;
  const { copies = 1 } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (typeof copies !== 'number' || copies < 1 || copies > 1000) {
    throw new AppError(400, 'Copies must be between 1 and 1000');
  }

  const book = await query('SELECT id FROM books WHERE id = $1', [bookId]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  let bookshopId: string | null = null;

  if (role === 'admin') {
    bookshopId = (req.body.bookshop_id as string) || null;
  } else {
    const shopResult = await query(
      `SELECT bs.id FROM bookshops bs
       INNER JOIN book_access ba ON ba.bookshop_id = bs.id
       WHERE ba.book_id = $1 AND bs.owner_id = $2`,
      [bookId, userId],
    );
    if (shopResult.rows.length === 0) {
      throw new AppError(403, 'No access to this book');
    }
    bookshopId = shopResult.rows[0].id;
  }

  if (!bookshopId) {
    throw new AppError(400, 'Bookshop identification required');
  }

  const rateCheck = await query(
    `SELECT COUNT(*)::int as recent FROM print_sessions
     WHERE bookshop_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
    [bookshopId],
  );
  if (parseInt(rateCheck.rows[0]?.recent || '0', 10) >= 5) {
    throw new AppError(429, 'Too many print requests. Please wait before printing again.');
  }

  const sessionToken = crypto.randomBytes(16).toString('hex');
  const result = await query(
    `INSERT INTO print_sessions (book_id, bookshop_id, user_id, copies, session_token)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [bookId, bookshopId, userId, copies, sessionToken],
  );

  await query(
    `INSERT INTO print_jobs (book_id, bookshop_id, requested_by, copies, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'printing')
     ON CONFLICT DO NOTHING`,
    [bookId, bookshopId, userId, copies, 'Auto-created from print session'],
  );

  const printToken = crypto.randomBytes(24).toString('hex');
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
  await query(
    `INSERT INTO print_tokens (session_id, token, book_id, bookshop_id, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'print', $6)`,
    [result.rows[0].id, printToken, bookId, bookshopId, userId, tenMinutesFromNow],
  );

  const { createNotification } = await import('./adminController.js');
  await createNotification({
    title: 'New Print Session',
    message: `${copies} copy/copies of "${book.rows[0]?.title || bookId}" printed by ${req.user!.email || 'unknown'}`,
    type: 'print',
    link: `/admin/bookshops/${bookshopId}/analytics`,
  });

  res.status(201).json({ session: result.rows[0], print_token: printToken, token_expires_at: tenMinutesFromNow });
}

export async function listSessions(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { book_id, bookshop_id, page: pageStr, limit: limitStr } = req.query;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  const join = ` FROM print_sessions ps
    LEFT JOIN books b ON b.id = ps.book_id
    LEFT JOIN bookshops bs ON bs.id = ps.bookshop_id
    LEFT JOIN users u ON u.id = ps.user_id`;

  if (role !== 'admin') { paramIdx++; params.push(userId); conditions.push(`(ps.user_id = $${paramIdx} OR bs.owner_id = $${paramIdx})`); }
  if (book_id) { paramIdx++; params.push(book_id); conditions.push(`ps.book_id = $${paramIdx}`); }
  if (bookshop_id) { paramIdx++; params.push(bookshop_id); conditions.push(`ps.bookshop_id = $${paramIdx}`); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countResult = await query(`SELECT COUNT(*)::int${join}${where}`, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  paramIdx++; params.push(limit);
  paramIdx++; params.push(offset);

  const result = await query(
    `SELECT ps.*, b.title as book_title, bs.name as bookshop_name, u.name as user_name${join}${where}
     ORDER BY ps.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
    params,
  );
  res.json({ sessions: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}
