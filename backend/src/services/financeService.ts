import { query } from '../database/connection.js';
import { AppError } from '../middleware/errorHandler.js';

export async function setPricing(bookId: string, costPerCopy: number) {
  const result = await query(
    'INSERT INTO pricing (book_id, cost_per_copy, effective_date) VALUES ($1, $2, NOW()) RETURNING *',
    [bookId, costPerCopy],
  );
  return result.rows[0];
}

export async function getPricing(bookId?: string) {
  let sql = 'SELECT * FROM pricing';
  const params: unknown[] = [];
  if (bookId) { params.push(bookId); sql += ' WHERE book_id = $1'; }
  sql += ' ORDER BY effective_date DESC';
  const result = await query(sql, params);
  return result.rows;
}

export async function generateInvoice(bookshopId: string, periodStart: string, periodEnd: string) {
  const sessions = await query(
    `SELECT ps.book_id, b.title, COALESCE(SUM(ps.copies), 0)::int as total_copies
     FROM print_sessions ps
     INNER JOIN books b ON b.id = ps.book_id
     WHERE ps.bookshop_id = $1 AND ps.created_at >= $2 AND ps.created_at <= $3
     GROUP BY ps.book_id, b.title`,
    [bookshopId, periodStart, periodEnd],
  );

  if (sessions.rows.length === 0) {
    throw new AppError(400, 'No print sessions found for this period');
  }

  let totalAmount = 0;
  const items: Array<{ book_id: string; title: string; copies: number; cost_per_copy: number; subtotal: number }> = [];

  for (const session of sessions.rows) {
    const pricing = await query(
      `SELECT cost_per_copy FROM pricing WHERE book_id = $1 AND effective_date <= $2
       ORDER BY effective_date DESC LIMIT 1`,
      [session.book_id, periodEnd],
    );
    const costPerCopy = parseFloat(pricing.rows[0]?.cost_per_copy || '0');
    const subtotal = session.total_copies * costPerCopy;
    totalAmount += subtotal;
    items.push({
      book_id: session.book_id,
      title: session.title,
      copies: session.total_copies,
      cost_per_copy: costPerCopy,
      subtotal,
    });
  }

  const invoice = await query(
    `INSERT INTO invoices (bookshop_id, period_start, period_end, total_amount, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [bookshopId, periodStart, periodEnd, totalAmount],
  );

  for (const item of items) {
    await query(
      `INSERT INTO invoice_items (invoice_id, book_id, copies, cost_per_copy, subtotal)
       VALUES ($1, $2, $3, $4, $5)`,
      [invoice.rows[0].id, item.book_id, item.copies, item.cost_per_copy, item.subtotal],
    );
  }

  return { invoice: invoice.rows[0], items };
}

export async function listInvoices(filters: { bookshop_id?: string; status?: string }, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  if (filters.bookshop_id) { paramIdx++; params.push(filters.bookshop_id); conditions.push(`i.bookshop_id = $${paramIdx}`); }
  if (filters.status) { paramIdx++; params.push(filters.status); conditions.push(`i.status = $${paramIdx}`); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const join = ' FROM invoices i LEFT JOIN bookshops bs ON bs.id = i.bookshop_id';

  const countResult = await query(`SELECT COUNT(*)::int${join}${where}`, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  paramIdx++; params.push(limit);
  paramIdx++; params.push(offset);

  const result = await query(
    `SELECT i.*, bs.name as bookshop_name${join}${where} ORDER BY i.created_at DESC LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
    params,
  );

  return { invoices: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceDetail(invoiceId: string) {
  const invoice = await query(
    `SELECT i.*, bs.name as bookshop_name FROM invoices i LEFT JOIN bookshops bs ON bs.id = i.bookshop_id WHERE i.id = $1`,
    [invoiceId],
  );
  if (invoice.rows.length === 0) throw new AppError(404, 'Invoice not found');

  const items = await query(
    `SELECT ii.*, b.title as book_title FROM invoice_items ii LEFT JOIN books b ON b.id = ii.book_id WHERE ii.invoice_id = $1`,
    [invoiceId],
  );

  return { invoice: invoice.rows[0], items: items.rows };
}

export async function markInvoicePaid(invoiceId: string) {
  const result = await query(
    'UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2 RETURNING *',
    ['paid', invoiceId],
  );
  if (result.rows.length === 0) throw new AppError(404, 'Invoice not found');
  return result.rows[0];
}

export async function getFinanceSummary(bookshopId?: string) {
  let params: unknown[] = [];
  let shopFilter = '';
  if (bookshopId) { params.push(bookshopId); shopFilter = ' WHERE ps.bookshop_id = $1'; }

  const totalPrinted = await query(
    `SELECT ps.book_id, b.title, COALESCE(SUM(ps.copies), 0)::int as total_copies
     FROM print_sessions ps INNER JOIN books b ON b.id = ps.book_id${shopFilter.replace('ps.', 'ps.')}
     GROUP BY ps.book_id, b.title ORDER BY total_copies DESC`,
    params,
  );

  params = [];
  let shopFilter2 = '';
  if (bookshopId) { params.push(bookshopId); shopFilter2 = ' WHERE bookshop_id = $1'; }

  const totalOwed = await query(
    `SELECT COALESCE(SUM(total_amount), 0)::float as total_owed,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0)::float as total_paid,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0)::float as total_pending
     FROM invoices${shopFilter2}`,
    params,
  );

  const totalSessions = await query(
    `SELECT COUNT(*)::int as sessions, COALESCE(SUM(copies), 0)::int as copies FROM print_sessions${shopFilter2}`,
    params,
  );

  return {
    total_printed_copies: parseInt(totalSessions.rows[0]?.copies || '0'),
    total_sessions: parseInt(totalSessions.rows[0]?.sessions || '0'),
    total_owed: totalOwed.rows[0]?.total_owed || 0,
    total_paid: totalOwed.rows[0]?.total_paid || 0,
    total_pending: totalOwed.rows[0]?.total_pending || 0,
    books: totalPrinted.rows,
  };
}
