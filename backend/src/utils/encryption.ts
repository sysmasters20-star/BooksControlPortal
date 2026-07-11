import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = env.encryption.algorithm;
const KEY = Buffer.from(env.encryption.key, 'base64');

export function encrypt(buffer: Buffer): { iv: Buffer; data: Buffer } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv, data: encrypted };
}

export function decrypt(encrypted: Buffer, iv: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
