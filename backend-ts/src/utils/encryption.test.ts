import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe('encrypt', () => {
    it('returns null for empty string', () => {
      expect(service.encrypt('')).toBeNull();
    });

    it('returns a Buffer for valid input', () => {
      const result = service.encrypt('my-secret-api-key');
      expect(result).toBeInstanceOf(Buffer);
      expect(result!.length).toBeGreaterThan(0);
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const a = service.encrypt('same-input');
      const b = service.encrypt('same-input');
      expect(a).not.toEqual(b);
    });
  });

  describe('decrypt', () => {
    it('returns null for empty buffer', () => {
      expect(service.decrypt(null as any)).toBeNull();
    });

    it('round-trips a short string', () => {
      const plaintext = 'sk-abc123';
      const encrypted = service.encrypt(plaintext)!;
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips a long string', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = service.encrypt(plaintext)!;
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips unicode content', () => {
      const plaintext = 'Hello 🌍 — привет мир — 你好世界';
      const encrypted = service.encrypt(plaintext)!;
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = service.encrypt('test-data')!;
      // Tamper with the middle of the buffer
      encrypted[20] = encrypted[20] ^ 0xff;
      expect(() => service.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });
  });

  describe('cross-instance consistency', () => {
    it('two instances with the same key can decrypt each other', () => {
      const service1 = new EncryptionService();
      const service2 = new EncryptionService();
      const plaintext = 'cross-instance-test';
      const encrypted = service1.encrypt(plaintext)!;
      const decrypted = service2.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
