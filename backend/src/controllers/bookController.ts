import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { encrypt } from '../utils/encryption.js';

export async function list(req: Request, res: Response) {
  const { status, search } = req.query;
  const userId = req.user!.userId;
  const role = req.user!.role;

  let sql: string;
  const params: unknown[] = [];

  if (role === 'admin') {
    sql = `SELECT b.id, b.title, b.author, b.isbn, b.file_size, b.pages, b.status, b.created_at,
           (SELECT COUNT(*) FROM book_access ba WHERE ba.book_id = b.id) as shop_count
           FROM books b WHERE 1=1`;
    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length})`;
    }
    sql += ' ORDER BY b.created_at DESC';
  } else {
    sql = `SELECT b.id, b.title, b.author, b.isbn, b.file_size, b.pages, b.status, b.created_at
           FROM books b
           INNER JOIN book_access ba ON ba.book_id = b.id
           INNER JOIN bookshops bs ON bs.id = ba.bookshop_id
           WHERE bs.owner_id = $1`;
    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length})`;
    }
    sql += ' ORDER BY b.created_at DESC';
    params.unshift(userId);
    sql = sql.replace('$1', '$1');
    params[0] = userId;
  }

  const result = await query(sql, params);
  res.json({ books: result.rows });
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
  const { title, author, isbn, pages } = req.body;

  const result = await query(
    `INSERT INTO books (title, author, isbn, pages, uploaded_by, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, title, author, isbn, pages, status, created_at`,
    [title, author, isbn || null, pages || null, req.user!.userId],
  );

  res.status(201).json({ book: result.rows[0] });
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

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const { iv, data: encrypted } = encrypt(req.file.buffer);

  const result = await query(
    `UPDATE books SET file_data = $1, file_size = $2, file_hash = $3, encryption_iv = $4, updated_at = NOW()
     WHERE id = $5 RETURNING id, file_size, file_hash`,
    [encrypted, req.file.size, fileHash, iv, id],
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
