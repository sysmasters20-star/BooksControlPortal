import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM: string = env.encryption.algorithm;
const KEY = Buffer.from(env.encryption.key, 'base64');
const GCM_TAG_LENGTH = 16;

export function encrypt(buffer: Buffer): { iv: Buffer; data: Buffer } {
  if (ALGORITHM === 'aes-256-gcm') {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: GCM_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { iv, data: Buffer.concat([encrypted, authTag]) };
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv, data: encrypted };
}

export function decrypt(encrypted: Buffer, iv: Buffer): Buffer {
  if (ALGORITHM === 'aes-256-gcm') {
    const authTag = encrypted.subarray(-GCM_TAG_LENGTH);
    const ciphertext = encrypted.subarray(0, -GCM_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: GCM_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
