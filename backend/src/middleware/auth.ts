import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import type { JwtPayload } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  let token: string | null = null;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    throw new AppError(401, 'Authentication required');
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'Insufficient permissions');
    }
    next();
  };
}
