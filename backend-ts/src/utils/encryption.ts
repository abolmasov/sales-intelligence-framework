import * as crypto from 'crypto';

/**
 * Encryption utility for API keys
 * Uses AES-256-GCM for secure encryption
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      // Generate a default key for development (NEVER use this in production)
      const defaultKey = crypto.createHash('sha256').update('sales_intelligence_default_key').digest();
      this.key = defaultKey;
      console.warn('⚠️ WARNING: Using default encryption key. Set ENCRYPTION_KEY environment variable in production!');
    } else {
      // Use provided key (must be 32 bytes for AES-256)
      this.key = crypto.createHash('sha256').update(encryptionKey).digest();
    }
  }

  /**
   * Encrypt a string value
   */
  encrypt(plaintext: string): Buffer | null {
    if (!plaintext) {
      return null;
    }

    try {
      // Generate random IV (initialization vector)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Combine IV + encrypted data + auth tag
      const result = Buffer.concat([iv, encrypted, authTag]);

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a buffer value
   */
  decrypt(encrypted: Buffer): string | null {
    if (!encrypted) {
      return null;
    }

    try {
      // Extract IV (first 16 bytes)
      const iv = encrypted.subarray(0, 16);

      // Extract auth tag (last 16 bytes)
      const authTag = encrypted.subarray(encrypted.length - 16);

      // Extract encrypted data (middle part)
      const encryptedData = encrypted.subarray(16, encrypted.length - 16);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }
}

// Singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}
