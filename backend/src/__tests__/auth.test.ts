import { describe, test, expect } from '@jest/globals';

describe('Auth Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test@123456';

  test('token generation produces valid JWT', () => {
    const jwt = require('jsonwebtoken');
    const payload = { userId: 'test-id', email: testEmail, role: 'admin' };
    const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
    const decoded = jwt.verify(token, 'test-secret') as any;
    expect(decoded.userId).toBe('test-id');
    expect(decoded.email).toBe(testEmail);
    expect(decoded.role).toBe('admin');
  });

  test('password hashing and verification works', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(testPassword, 12);
    expect(await bcrypt.compare(testPassword, hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });
});
