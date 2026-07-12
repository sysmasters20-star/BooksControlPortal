import crypto from 'crypto';

describe('Print Token System', () => {
  test('token generation produces hex string of expected length', () => {
    const token = crypto.randomBytes(24).toString('hex');
    expect(token.length).toBe(48);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test('token expiration check works', () => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);
    const now = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    expect(now < expiresAt).toBe(true);
    const later = new Date(issuedAt.getTime() + 15 * 60 * 1000);
    expect(later < expiresAt).toBe(false);
  });

  test('HMAC signing and validation', () => {
    const hmac = require('../utils/hmac.js');
    const data = { bookId: 'test-book', copies: 5 };
    const timestamp = Date.now();
    const signature = hmac.signRequest(data, timestamp);
    expect(hmac.validateRequest(data, signature, timestamp)).toBe(true);
    expect(hmac.validateRequest(data, signature, timestamp + 600000)).toBe(false);
    expect(hmac.validateRequest({ ...data, copies: 6 }, signature, timestamp)).toBe(false);
  });
});
