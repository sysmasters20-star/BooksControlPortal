import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption', () => {
  const testData = Buffer.from('This is sensitive PDF content that must be encrypted.');

  test('encrypt returns iv and data buffers', () => {
    const result = encrypt(testData);
    expect(result.iv).toBeInstanceOf(Buffer);
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.iv.length).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
  });

  test('encrypt and decrypt roundtrip returns original data', () => {
    const { iv, data } = encrypt(testData);
    const decrypted = decrypt(data, iv);
    expect(decrypted.equals(testData)).toBe(true);
  });

  test('encrypt produces different output for same input (random IV)', () => {
    const result1 = encrypt(testData);
    const result2 = encrypt(testData);
    expect(result1.iv.equals(result2.iv)).toBe(false);
    expect(result1.data.equals(result2.data)).toBe(false);
  });

  test('decrypt with wrong iv throws error', () => {
    const { data } = encrypt(testData);
    const wrongIv = Buffer.alloc(16);
    expect(() => decrypt(data, wrongIv)).toThrow();
  });

  test('encrypt handles empty buffer', () => {
    const { iv, data } = encrypt(Buffer.from(''));
    const decrypted = decrypt(data, iv);
    expect(decrypted.length).toBe(0);
  });

  test('encrypt handles large buffer (10MB)', () => {
    const large = Buffer.alloc(10 * 1024 * 1024, 'A');
    const { iv, data } = encrypt(large);
    const decrypted = decrypt(data, iv);
    expect(decrypted.length).toBe(large.length);
    expect(decrypted.equals(large)).toBe(true);
  });
});
