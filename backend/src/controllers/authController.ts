import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { query } from '../database/connection.js';
import { env } from '../config/env.js';
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
  const result = await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at`,
    [email, passwordHash, name, 'bookshop_owner'],
  );

  const user = result.rows[0];
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

  res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const result = await query(
    'SELECT id, email, password_hash, name, role, is_verified FROM users WHERE email = $1',
    [email],
  );

  if (result.rows.length === 0) {
    throw new AppError(401, 'Invalid email or password');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

  res.json({ user, accessToken, refreshToken });
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
