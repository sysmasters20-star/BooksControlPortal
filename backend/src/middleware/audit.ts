import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection.js';

export function auditLog(action: string, resourceType?: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.userId || null,
          action,
          resourceType || null,
          req.params?.id || null,
          JSON.stringify({ method: req.method, path: req.path, body: sanitizeBody(req.body) }),
          req.ip || req.socket.remoteAddress || null,
        ],
      );
    } catch (err) {
      try { const { logger } = await import('../utils/logger.js'); logger.error('Audit log failed', { error: (err as Error).message }); } catch { /* ignore logger failures */ }
    }
    next();
  };
}

function sanitizeBody(body: Record<string, unknown>) {
  if (!body) return {};
  const safe = { ...body };
  delete safe.password;
  delete safe.password_hash;
  delete safe.refreshToken;
  delete safe.token;
  return safe;
}
