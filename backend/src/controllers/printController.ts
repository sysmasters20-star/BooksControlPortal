import { Request, Response } from 'express';
import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listJobs(req: Request, res: Response) {
  const { bookshop_id, status } = req.query;
  let sql = `SELECT pj.*, b.title as book_title
             FROM print_jobs pj
             LEFT JOIN books b ON b.id = pj.book_id
             WHERE 1=1`;
  const params: unknown[] = [];

  if (bookshop_id) {
    params.push(bookshop_id);
    sql += ` AND pj.bookshop_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND pj.status = $${params.length}`;
  }

  sql += ' ORDER BY pj.created_at DESC';

  const result = await query(sql, params);
  res.json({ printJobs: result.rows });
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

  const completedAt = status === 'completed' ? 'NOW()' : null;
  const result = await query(
    `UPDATE print_jobs SET status = $1, completed_at = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, completedAt, id],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Print job not found');
  }

  res.json({ printJob: result.rows[0] });
}
