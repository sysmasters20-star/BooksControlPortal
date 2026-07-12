import crypto from 'crypto';
import { env } from '../config/env.js';

const HMAC_SECRET = process.env.HMAC_SECRET || env.jwt.secret;

export function signRequest(data: Record<string, unknown>, timestamp: number): string {
  const message = `${timestamp}.${JSON.stringify(data)}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
}

export function validateRequest(
  data: Record<string, unknown>,
  signature: string,
  timestamp: number,
  maxAgeMs = 300000
): boolean {
  const now = Date.now();
  if (now - timestamp > maxAgeMs || timestamp > now) {
    return false;
  }
  const expected = signRequest(data, timestamp);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
