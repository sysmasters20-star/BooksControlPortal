import { query } from '../database/connection.js';

export async function logAction(userId: string | undefined, action: string, resourceType?: string, resourceId?: string, details?: Record<string, unknown>, ipAddress?: string) {
  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId || null, action, resourceType || null, resourceId || null, details ? JSON.stringify(details) : null, ipAddress || null],
  );
}

export async function listAuditLogs(filters: { action?: string; userId?: string; resourceType?: string }, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 0;

  const join = ' FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id';

  if (filters.action) { paramIdx++; params.push(filters.action); conditions.push(`al.action = $${paramIdx}`); }
  if (filters.userId) { paramIdx++; params.push(filters.userId); conditions.push(`al.user_id = $${paramIdx}`); }
  if (filters.resourceType) { paramIdx++; params.push(filters.resourceType); conditions.push(`al.resource_type = $${paramIdx}`); }

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

  return { auditLogs: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}
