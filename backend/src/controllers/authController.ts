import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { query } from '../database/connection.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import type { User } from '../types/index.js';

function generateAccessToken(user: User) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiry } as SignOptions,
  );
}

function generateRefreshToken(user: User) {
  return jwt.sign(
    { userId: user.id },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry } as SignOptions,
  );
}

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(24).toString('hex');
  const result = await query(
    `INSERT INTO users (email, password_hash, name, role, verification_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, created_at`,
    [email, passwordHash, name, 'bookshop_owner', verificationToken],
  );

  const user = result.rows[0];
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

  logger.info(`Verification token for ${email}: ${verificationToken}`);
  res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const result = await query(
    'SELECT id, email, password_hash, name, role, is_verified, failed_login_attempts, locked_until FROM users WHERE email = $1',
    [email],
  );

  if (result.rows.length === 0) {
    throw new AppError(401, 'Invalid email or password');
  }

  const user = result.rows[0];

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new AppError(429, `Account locked. Try again in ${minutesLeft} minute(s)`);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= 5) {
      await query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
        [attempts, user.id]
      );
      throw new AppError(429, 'Account locked due to too many failed attempts. Try again in 15 minutes.');
    }
    await query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
    throw new AppError(401, 'Invalid email or password');
  }

  await query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, is_verified: user.is_verified }, accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError(400, 'Refresh token required');
  }

  try {
    const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret) as { userId: string };
    const result = await query(
      'SELECT id, email, name, role, refresh_token FROM users WHERE id = $1',
      [decoded.userId],
    );

    if (result.rows.length === 0 || result.rows[0].refresh_token !== refreshToken) {
      throw new AppError(401, 'Invalid refresh token');
    }

    const user = result.rows[0];
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
}

export async function me(req: Request, res: Response) {
  const result = await query(
    'SELECT id, email, name, role, is_verified, created_at FROM users WHERE id = $1',
    [req.user!.userId],
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'User not found');
  }

  res.json({ user: result.rows[0] });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const user = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (user.rows.length === 0) {
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await query(
    'UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3',
    [resetToken, expiresAt, user.rows[0].id],
  );

  logger.info(`Password reset token for ${email}: ${resetToken}`);
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;

  const user = await query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires_at > NOW()',
    [token],
  );

  if (user.rows.length === 0) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE id = $2',
    [passwordHash, user.rows[0].id],
  );

  res.json({ message: 'Password reset successfully' });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body;

  const user = await query(
    'SELECT id FROM users WHERE verification_token = $1',
    [token],
  );

  if (user.rows.length === 0) {
    throw new AppError(400, 'Invalid verification token');
  }

  await query(
    'UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1',
    [user.rows[0].id],
  );

  res.json({ message: 'Email verified successfully' });
}
