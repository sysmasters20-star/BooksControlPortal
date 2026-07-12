import crypto from 'crypto';
import { query, getClient } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { encrypt } from '../utils/encryption.js';
import { pdfToPageBuffers } from './pdfRenderer.js';

export async function listBooks(filters: Record<string, any>, userId: string, role: string) {
  const { status, search, page: pageStr, limit: limitStr } = filters;
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
    return { books: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
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
  return { books: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getBookById(bookId: string, userId: string, role: string) {
  let accessCheck = '';
  const params: string[] = [bookId];
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
    [bookId],
  );

  return { ...result.rows[0], shops: shops.rows };
}

async function storeBookFiles(bookId: string, pdfBuffer: Buffer): Promise<void> {
  const pageBuffers = await pdfToPageBuffers(pdfBuffer);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO book_files (book_id, file_data, mime_type, page_number)
       VALUES ($1, $2, 'application/pdf', NULL)`,
      [bookId, pdfBuffer],
    );

    for (let i = 0; i < pageBuffers.length; i++) {
      await client.query(
        `INSERT INTO book_files (book_id, file_data, mime_type, page_number)
         VALUES ($1, $2, 'image/png', $3)`,
        [bookId, pageBuffers[i], i + 1],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createBook(data: { title: string; author?: string; isbn?: string }, file: Express.Multer.File | undefined, userId: string) {
  const { title, author, isbn } = data;

  let pageCount: number | null = null;

  if (file) {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(file.buffer);
    pageCount = doc.getPageCount();
  }

  const result = await query(
    `INSERT INTO books (title, author, isbn, pages, uploaded_by, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, title, author, isbn, pages, status, created_at`,
    [title, author, isbn || null, pageCount, userId],
  );

  const book = result.rows[0];

  if (file) {
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const { iv, data: encrypted } = encrypt(file.buffer);
    await query(
      `UPDATE books SET file_data = $1, file_size = $2, file_hash = $3, encryption_iv = $4, pages = $5, updated_at = NOW()
       WHERE id = $6`,
      [encrypted, file.size, fileHash, iv, pageCount, book.id],
    );
    book.file_size = file.size;
    book.file_hash = fileHash;
    book.pages = pageCount;

    await storeBookFiles(book.id, file.buffer);
  }

  return book;
}

export async function updateBookStatus(bookId: string, status: string) {
  const allowedStatuses = ['pending', 'approved', 'rejected', 'archived'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const result = await query(
    `UPDATE books SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, title, status, updated_at`,
    [status, bookId],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  return result.rows[0];
}

export async function bulkUpdateBookStatus(ids: string[], status: string) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError(400, 'ids must be a non-empty array');
  }

  const allowedStatuses = ['pending', 'approved', 'rejected', 'archived'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  const result = await query(
    `UPDATE books SET status = $1, updated_at = NOW()
     WHERE id IN (${placeholders})
     RETURNING id, title, status`,
    [status, ...ids],
  );

  return { books: result.rows, updated: result.rowCount };
}

export async function uploadBookFile(bookId: string, file: Express.Multer.File) {
  const book = await query('SELECT id FROM books WHERE id = $1', [bookId]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(file.buffer);
  const pageCount = doc.getPageCount();

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const { iv, data: encrypted } = encrypt(file.buffer);

  const result = await query(
    `UPDATE books SET file_data = $1, file_size = $2, file_hash = $3, encryption_iv = $4, pages = $5, updated_at = NOW()
     WHERE id = $6 RETURNING id, file_size, file_hash, pages`,
    [encrypted, file.size, fileHash, iv, pageCount, bookId],
  );

  await query('DELETE FROM book_files WHERE book_id = $1', [bookId]);
  await storeBookFiles(bookId, file.buffer);

  return result.rows[0];
}

export async function listBookPageFiles(bookId: string) {
  const result = await query(
    `SELECT id, page_number, mime_type FROM book_files
     WHERE book_id = $1 AND mime_type = 'image/png'
     ORDER BY page_number ASC`,
    [bookId],
  );
  return result.rows;
}

export async function getBookFile(fileId: string) {
  const result = await query(
    `SELECT file_data, mime_type FROM book_files WHERE id = $1`,
    [fileId],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'File not found');
  }

  const row = result.rows[0];
  let fileBuffer: Buffer;

  if (typeof row.file_data === 'string' && row.file_data.startsWith('\\x')) {
    fileBuffer = Buffer.from(row.file_data.substring(2), 'hex');
  } else if (Buffer.isBuffer(row.file_data)) {
    fileBuffer = row.file_data;
  } else if (typeof row.file_data === 'string') {
    fileBuffer = Buffer.from(row.file_data, 'hex');
  } else if (row.file_data?.data) {
    fileBuffer = Buffer.from(row.file_data.data);
  } else {
    fileBuffer = row.file_data;
  }

  return { buffer: fileBuffer, mimeType: row.mime_type };
}

export async function deleteBook(bookId: string) {
  const result = await query('DELETE FROM books WHERE id = $1 RETURNING id', [bookId]);

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }
}

export async function assignBookToShop(bookId: string, bookshopId: string) {
  const book = await query('SELECT id FROM books WHERE id = $1', [bookId]);
  if (book.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  const shop = await query('SELECT id FROM bookshops WHERE id = $1', [bookshopId]);
  if (shop.rows.length === 0) {
    throw new AppError(404, 'Bookshop not found');
  }

  await query(
    `INSERT INTO book_access (book_id, bookshop_id) VALUES ($1, $2)
     ON CONFLICT (book_id, bookshop_id) DO NOTHING`,
    [bookId, bookshopId],
  );

  return { message: 'Bookshop assigned' };
}

export async function unassignBookFromShop(bookId: string, bookshopId: string) {
  await query(
    'DELETE FROM book_access WHERE book_id = $1 AND bookshop_id = $2',
    [bookId, bookshopId],
  );

  return { message: 'Bookshop unassigned' };
}

export async function listAssignedShops(bookId: string) {
  const result = await query(
    `SELECT bs.id, bs.name, bs.email, bs.phone, bs.is_active, ba.created_at as assigned_at
     FROM bookshops bs
     INNER JOIN book_access ba ON ba.bookshop_id = bs.id
     WHERE ba.book_id = $1
     ORDER BY bs.name`,
    [bookId],
  );

  return result.rows;
}

export async function getBookStats(userId: string, role: string) {
  if (role === 'admin') {
    const [books, jobs, sessions] = await Promise.all([
      query('SELECT COUNT(*)::int FROM books'),
      query("SELECT COUNT(*)::int FROM print_jobs WHERE status != 'cancelled'"),
      query('SELECT COUNT(*)::int, COALESCE(SUM(copies), 0)::int as total_copies FROM print_sessions'),
    ]);
    return {
      total_books: parseInt(books.rows[0]?.count || '0'),
      total_print_jobs: parseInt(jobs.rows[0]?.count || '0'),
      total_sessions: parseInt(sessions.rows[0]?.count || '0'),
      total_copies: parseInt(sessions.rows[0]?.total_copies || '0'),
    };
  }

  const [books, jobs, sessions] = await Promise.all([
    query(
      `SELECT COUNT(*)::int FROM books b
       INNER JOIN book_access ba ON ba.book_id = b.id
       INNER JOIN bookshops bs ON bs.id = ba.bookshop_id
       WHERE bs.owner_id = $1`,
      [userId],
    ),
    query(
      `SELECT COUNT(*)::int FROM print_jobs pj
       INNER JOIN bookshops bs ON bs.id = pj.bookshop_id
       WHERE bs.owner_id = $1 AND pj.status != 'cancelled'`,
      [userId],
    ),
    query(
      `SELECT COUNT(*)::int, COALESCE(SUM(ps.copies), 0)::int as total_copies
       FROM print_sessions ps
       INNER JOIN bookshops bs ON bs.id = ps.bookshop_id
       WHERE bs.owner_id = $1`,
      [userId],
    ),
  ]);

  return {
    total_books: parseInt(books.rows[0]?.count || '0'),
    total_print_jobs: parseInt(jobs.rows[0]?.count || '0'),
    total_sessions: parseInt(sessions.rows[0]?.count || '0'),
    total_copies: parseInt(sessions.rows[0]?.total_copies || '0'),
  };
}
