import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { decrypt } from '../utils/encryption.js';
import { validateRequest } from '../utils/hmac.js';
import { renderPage, getPageCount, generatePrintPdf as genPrintPdf } from '../services/pdfRenderer.js';

interface CacheEntry {
  pdfBuffer: Buffer;
  totalPages: number;
  bookshopName: string;
  copies: number;
}
const pdfCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

setInterval(() => {
  pdfCache.clear();
}, CACHE_TTL);

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
  const printToken = req.query.token as string | undefined;

  let sessionId: string;
  let bookshopId: string;
  let bookshopName: string;
  let copies: number;

  if (printToken) {
    const tokenResult = await query(
      `SELECT pt.*, ps.copies, ps.id as session_id, COALESCE(bs.name, 'Administrator') as bookshop_name, pt.bookshop_id
       FROM print_tokens pt
       JOIN print_sessions ps ON ps.id = pt.session_id
       LEFT JOIN bookshops bs ON bs.id = pt.bookshop_id
       WHERE pt.token = $1`,
      [printToken],
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError(404, 'Print token not found');
    }

    const tokenRow = tokenResult.rows[0];
    if (tokenRow.expires_at < new Date()) {
      throw new AppError(410, 'Print token has expired');
    }
    if (tokenRow.used_at) {
      throw new AppError(410, 'Print token has already been used');
    }
    if (!['view', 'print'].includes(tokenRow.purpose)) {
      throw new AppError(403, 'Invalid token purpose');
    }

    await query('UPDATE print_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

    sessionId = tokenRow.session_id;
    bookshopId = tokenRow.bookshop_id;
    bookshopName = tokenRow.bookshop_name;
    copies = tokenRow.copies;
  } else {
    const role = req.user!.role;
    if (role !== 'admin') {
      const shopResult = await query(
        `SELECT id, name FROM bookshops WHERE owner_id = $1`,
        [req.user!.userId],
      );
      if (shopResult.rows.length === 0) {
        throw new AppError(403, 'No bookshop assigned to your account');
      }
      bookshopId = shopResult.rows[0].id;
      bookshopName = shopResult.rows[0].name;

      const accessCheck = await query(
        `SELECT 1 FROM book_access WHERE book_id = $1 AND bookshop_id = $2`,
        [bookId, bookshopId],
      );
      if (accessCheck.rows.length === 0) {
        throw new AppError(403, 'Your bookshop does not have access to this book');
      }
    } else {
      bookshopId = (req.query.bookshop_id as string) || '';
      if (bookshopId) {
        const sr = await query('SELECT name FROM bookshops WHERE id = $1', [bookshopId]);
        bookshopName = sr.rows[0]?.name || 'Administrator';
      } else {
        bookshopName = 'Administrator';
      }
    }

    const previewToken = crypto.randomBytes(16).toString('hex');
    const sessionResult = await query(
      `INSERT INTO print_sessions (book_id, bookshop_id, user_id, copies, session_token)
       VALUES ($1, $2, $3, 0, $4) RETURNING *`,
      [bookId, bookshopId || null, req.user!.userId, previewToken],
    );
    sessionId = sessionResult.rows[0].id;
    copies = 0;
  }

  const book = await query(
    'SELECT id, title, file_data, encryption_iv, pages FROM books WHERE id = $1 AND file_data IS NOT NULL',
    [bookId],
  );
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book PDF not found');
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = decrypt(book.rows[0].file_data, book.rows[0].encryption_iv);
  } catch {
    throw new AppError(500, 'Failed to decrypt PDF');
  }

  const totalPages = await getPageCount(pdfBuffer);

  pdfCache.set(sessionId, {
    pdfBuffer,
    totalPages,
    bookshopName,
    copies,
  });

  res.json({
    totalPages,
    bookshopName,
    sessionId,
    copies,
  });
}

export async function getPage(req: Request, res: Response) {
  const { bookId, pageNum } = req.params;
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    throw new AppError(400, 'sessionId query parameter is required');
  }

  const cached = pdfCache.get(sessionId);
  if (!cached) {
    throw new AppError(404, 'Session not found or expired. Please request a new view token.');
  }

  const pageNumber = parseInt(pageNum, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > cached.totalPages) {
    throw new AppError(400, `Invalid page number. Must be between 1 and ${cached.totalPages}`);
  }

  const now = new Date().toISOString().split('T')[0];
  const ip = req.ip || req.socket.remoteAddress;

  const pageBuffer = await renderPage(cached.pdfBuffer, pageNumber, cached.totalPages, {
    bookshopName: cached.bookshopName,
    sessionId,
    copyNum: 1,
    date: now,
    ip,
  });

  res.set({
    'Content-Type': 'image/png',
    'Content-Length': pageBuffer.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(pageBuffer);
}

export async function generatePrintPdf(req: Request, res: Response) {
  const { bookId } = req.params;
  const { sessionId, copies, printToken } = req.body;

  if (!printToken) {
    throw new AppError(400, 'printToken is required');
  }

  const tokenResult = await query(
    `SELECT pt.*, ps.copies as session_copies, COALESCE(bs.name, 'Administrator') as bookshop_name
     FROM print_tokens pt
     JOIN print_sessions ps ON ps.id = pt.session_id
     LEFT JOIN bookshops bs ON bs.id = pt.bookshop_id
     WHERE pt.token = $1`,
    [printToken],
  );

  if (tokenResult.rows.length === 0) {
    throw new AppError(404, 'Print token not found');
  }

  const tokenRow = tokenResult.rows[0];
  if (tokenRow.expires_at < new Date()) {
    throw new AppError(410, 'Print token has expired');
  }
  if (tokenRow.used_at) {
    throw new AppError(410, 'Print token has already been used');
  }
  if (tokenRow.purpose !== 'print') {
    throw new AppError(403, 'Token is not valid for printing');
  }

  await query('UPDATE print_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

  const book = await query(
    'SELECT id, title, file_data, encryption_iv FROM books WHERE id = $1 AND file_data IS NOT NULL',
    [bookId],
  );
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book PDF not found');
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = decrypt(book.rows[0].file_data, book.rows[0].encryption_iv);
  } catch {
    throw new AppError(500, 'Failed to decrypt PDF');
  }

  const now = new Date().toISOString().split('T')[0];
  const actualCopies = copies || tokenRow.session_copies || 1;

  const resultPdf = await genPrintPdf(pdfBuffer, {
    bookshopName: tokenRow.bookshop_name,
    sessionId: tokenRow.session_id,
    copyNum: tokenRow.session_copies || 1,
    date: now,
    ip: req.ip || req.socket.remoteAddress,
  }, actualCopies);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline',
    'Content-Length': resultPdf.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.send(resultPdf);
}

export async function countPrint(req: Request, res: Response) {
  const { bookId } = req.params;
  const { copies = 1 } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (typeof copies !== 'number' || copies < 1 || copies > 10) {
    throw new AppError(400, 'Copies must be between 1 and 10');
  }

  const signature = req.headers['x-signature'] as string;
  const timestamp = parseInt(req.headers['x-timestamp'] as string, 10);
  if (signature && timestamp) {
    if (!validateRequest({ bookId, copies }, signature, timestamp)) {
      throw new AppError(401, 'Invalid or expired request signature');
    }
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
      `SELECT id FROM bookshops WHERE owner_id = $1`,
      [userId],
    );
    if (shopResult.rows.length === 0) {
      throw new AppError(403, 'No bookshop assigned to your account');
    }
    bookshopId = shopResult.rows[0].id;

    const accessCheck = await query(
      `SELECT 1 FROM book_access WHERE book_id = $1 AND bookshop_id = $2`,
      [bookId, bookshopId],
    );
    if (accessCheck.rows.length === 0) {
      throw new AppError(403, 'Your bookshop does not have access to this book');
    }
  }

  if (!bookshopId && role !== 'admin') {
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

export async function getSessionPdf(req: Request, res: Response) {
  const { bookId } = req.params;
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    throw new AppError(400, 'sessionId query parameter is required');
  }

  const cached = pdfCache.get(sessionId);
  if (!cached) {
    throw new AppError(404, 'Session not found or expired. Please request a new view token.');
  }

  const now = new Date().toISOString().split('T')[0];
  const ip = req.ip || req.socket.remoteAddress;

  const watermarkedPdf = await genPrintPdf(cached.pdfBuffer, {
    bookshopName: cached.bookshopName,
    sessionId,
    copyNum: 1,
    date: now,
    ip,
  }, 1);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${bookId}-session.pdf"`,
    'Content-Length': watermarkedPdf.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.send(watermarkedPdf);
}

export async function logPrintSession(req: Request, res: Response) {
  const { book_id, copies = 1 } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  const safeCopies = Math.max(1, Math.min(10, copies));

  const book = await query('SELECT id FROM books WHERE id = $1', [book_id]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  let bookshopId: string | null = null;
  let bookshopName = '';
  if (role !== 'admin') {
    const shopResult = await query('SELECT id, name FROM bookshops WHERE owner_id = $1', [userId]);
    if (shopResult.rows.length > 0) {
      bookshopId = shopResult.rows[0].id;
      bookshopName = shopResult.rows[0].name;
    }
  } else {
    bookshopId = (req.body.bookshop_id as string) || null;
    if (bookshopId) {
      const sr = await query('SELECT name FROM bookshops WHERE id = $1', [bookshopId]);
      bookshopName = sr.rows[0]?.name || 'Administrator';
    } else {
      bookshopName = 'Administrator';
    }
  }

  const sessionToken = crypto.randomBytes(16).toString('hex');
  const result = await query(
    `INSERT INTO print_sessions (book_id, bookshop_id, user_id, copies, session_token, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [book_id, bookshopId, userId, safeCopies, sessionToken],
  );

  res.status(201).json({ session: result.rows[0], bookshop_name: bookshopName, bookshop_id: bookshopId });
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
