import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { encrypt } from '../utils/encryption.js';

export async function list(req: Request, res: Response) {
  const { status, search, page: pageStr, limit: limitStr } = req.query;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 50));
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  if (role === 'admin') {
    if (status) { paramIdx++; params.push(status); conditions.push(`b.status = $${paramIdx}`); }
    if (search) { paramIdx++; params.push(`%${search}%`); conditions.push(`(b.title ILIKE $${paramIdx} OR b.author ILIKE $${paramIdx})`); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const countResult = await query(`SELECT COUNT(*)::int FROM books b${where}`, params);
    const total = parseInt(countResult.rows[0]?.count || '0');
    paramIdx++; params.push(limit);
    paramIdx++; params.push(offset);
    const result = await query(
      `SELECT b.id, b.title, b.author, b.isbn, b.file_size, b.pages, b.status, b.created_at,
              (SELECT COUNT(*) FROM book_access ba WHERE ba.book_id = b.id) as shop_count
       FROM books b${where} ORDER BY b.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
      params,
    );
    res.json({ books: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
    return;
  }

  paramIdx++; params.push(userId);
  conditions.push(`bs.owner_id = $${paramIdx}`);
  if (status) { paramIdx++; params.push(status); conditions.push(`b.status = $${paramIdx}`); }
  if (search) { paramIdx++; params.push(`%${search}%`); conditions.push(`(b.title ILIKE $${paramIdx} OR b.author ILIKE $${paramIdx})`); }
  const where = ' WHERE ' + conditions.join(' AND ');
  const join = ' FROM books b INNER JOIN book_access ba ON ba.book_id = b.id INNER JOIN bookshops bs ON bs.id = ba.bookshop_id';
  const countResult = await query(`SELECT COUNT(*)::int${join}${where}`, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  paramIdx++; params.push(limit);
  paramIdx++; params.push(offset);
  const result = await query(
    `SELECT b.id, b.title, b.author, b.isbn, b.file_size, b.pages, b.status, b.created_at${join}${where} ORDER BY b.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
    params,
  );
  res.json({ books: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getById(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  let accessCheck = '';
  const params: string[] = [id];
  if (role !== 'admin') {
    accessCheck = ` AND EXISTS (SELECT 1 FROM book_access ba
                   INNER JOIN bookshops bs ON bs.id = ba.bookshop_id
                   WHERE ba.book_id = b.id AND bs.owner_id = $2)`;
    params.push(userId);
  }

  const result = await query(
    `SELECT b.id, b.title, b.author, b.isbn, b.file_size, b.pages, b.status,
            b.uploaded_by, b.created_at, b.updated_at
     FROM books b WHERE b.id = $1${accessCheck}`,
    params,
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  const shops = await query(
    `SELECT bs.id, bs.name FROM bookshops bs
     INNER JOIN book_access ba ON ba.bookshop_id = bs.id
     WHERE ba.book_id = $1`,
    [id],
  );

  res.json({ book: { ...result.rows[0], shops: shops.rows } });
}

export async function create(req: Request, res: Response) {
  const { title, author, isbn } = req.body;

  let pageCount: number | null = null;

  if (req.file) {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(req.file.buffer);
    pageCount = doc.getPageCount();
  }

  const result = await query(
    `INSERT INTO books (title, author, isbn, pages, uploaded_by, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, title, author, isbn, pages, status, created_at`,
    [title, author, isbn || null, pageCount, req.user!.userId],
  );

  const book = result.rows[0];

  if (req.file) {
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const { iv, data: encrypted } = encrypt(req.file.buffer);
    await query(
      `UPDATE books SET file_data = $1, file_size = $2, file_hash = $3, encryption_iv = $4, pages = $5, updated_at = NOW()
       WHERE id = $6`,
      [encrypted, req.file.size, fileHash, iv, pageCount, book.id],
    );
    book.file_size = req.file.size;
    book.file_hash = fileHash;
    book.pages = pageCount;
  }

  res.status(201).json({ book });
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['pending', 'approved', 'rejected', 'archived'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const result = await query(
    `UPDATE books SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, title, status, updated_at`,
    [status, id],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  res.json({ book: result.rows[0] });
}

export async function uploadFile(req: Request, res: Response) {
  const { id } = req.params;
  if (!req.file) {
    throw new AppError(400, 'PDF file required');
  }

  const book = await query('SELECT id FROM books WHERE id = $1', [id]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(req.file.buffer);
  const pageCount = doc.getPageCount();

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const { iv, data: encrypted } = encrypt(req.file.buffer);

  const result = await query(
    `UPDATE books SET file_data = $1, file_size = $2, file_hash = $3, encryption_iv = $4, pages = $5, updated_at = NOW()
     WHERE id = $6 RETURNING id, file_size, file_hash, pages`,
    [encrypted, req.file.size, fileHash, iv, pageCount, id],
  );

  res.json({ book: result.rows[0] });
}

export async function remove(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query('DELETE FROM books WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  res.status(204).send();
}

export async function assignBookshop(req: Request, res: Response) {
  const { id } = req.params;
  const { bookshop_id } = req.body;

  const book = await query('SELECT id FROM books WHERE id = $1', [id]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  const shop = await query('SELECT id FROM bookshops WHERE id = $1', [bookshop_id]);
  if (shop.rows.length === 0) {
    throw new AppError(404, 'Bookshop not found');
  }

  await query(
    `INSERT INTO book_access (book_id, bookshop_id) VALUES ($1, $2)
     ON CONFLICT (book_id, bookshop_id) DO NOTHING`,
    [id, bookshop_id],
  );

  res.json({ message: 'Bookshop assigned' });
}

export async function unassignBookshop(req: Request, res: Response) {
  const { id, bookshopId } = req.params;

  await query(
    `DELETE FROM book_access WHERE book_id = $1 AND bookshop_id = $2`,
    [id, bookshopId],
  );

  res.json({ message: 'Bookshop unassigned' });
}

export async function listAssignedBookshops(req: Request, res: Response) {
  const { id } = req.params;

  const result = await query(
    `SELECT bs.id, bs.name, bs.email, bs.phone, bs.is_active, ba.created_at as assigned_at
     FROM bookshops bs
     INNER JOIN book_access ba ON ba.bookshop_id = bs.id
     WHERE ba.book_id = $1
     ORDER BY bs.name`,
    [id],
  );

  res.json({ bookshops: result.rows });
}
