import { Request, Response } from 'express';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';

export async function list(req: Request, res: Response) {
  const { bookshop_id, status } = req.query;
  let sql = 'SELECT id, title, author, isbn, file_size, pages, status, bookshop_id, created_at FROM books WHERE 1=1';
  const params: unknown[] = [];

  if (bookshop_id) {
    params.push(bookshop_id);
    sql += ` AND bookshop_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  sql += ' ORDER BY created_at DESC';

  const result = await query(sql, params);
  res.json({ books: result.rows });
}

export async function getById(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query(
    'SELECT id, title, author, isbn, file_size, pages, status, bookshop_id, uploaded_by, created_at, updated_at FROM books WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  res.json({ book: result.rows[0] });
}

export async function create(req: Request, res: Response) {
  const { title, author, isbn, pages, bookshop_id } = req.body;

  const result = await query(
    `INSERT INTO books (title, author, isbn, pages, bookshop_id, uploaded_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id, title, author, isbn, pages, status, created_at`,
    [title, author, isbn, pages, bookshop_id, req.user!.userId],
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

export async function remove(req: Request, res: Response) {
  const { id } = req.params;
  const result = await query('DELETE FROM books WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    throw new AppError(404, 'Book not found');
  }

  res.status(204).send();
}
