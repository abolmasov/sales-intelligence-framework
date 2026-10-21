/**
 * Transcript encryption at rest — AES-256-GCM
 *
 * Set TRANSCRIPT_ENCRYPTION_KEY to a 64-char hex string (32 bytes):
 *   openssl rand -hex 32
 *
 * Stored format: enc:v1:<iv_hex>:<ciphertext_hex>:<authtag_hex>
 * If the stored value doesn't start with "enc:v1:" it's treated as
 * legacy plaintext and returned as-is (backward compatible).
 *
 * If TRANSCRIPT_ENCRYPTION_KEY is not set, encryption is skipped and
 * a warning is logged once at startup. Decryption still handles both
 * plaintext and encrypted values.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag
const PREFIX = 'enc:v1:';

let _key: Buffer | null = null;
let _warned = false;

function getKey(): Buffer | null {
  if (_key) return _key;

  const hex = process.env.TRANSCRIPT_ENCRYPTION_KEY;
  if (!hex) {
    if (!_warned) {
      console.warn(
        '[transcriptCrypto] TRANSCRIPT_ENCRYPTION_KEY not set — ' +
        'transcript text will be stored unencrypted. ' +
        'Generate a key with: openssl rand -hex 32'
      );
      _warned = true;
    }
    return null;
  }

  if (hex.length !== 64) {
    throw new Error(
      `[transcriptCrypto] TRANSCRIPT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Got ${hex.length} chars.`
    );
  }

  _key = Buffer.from(hex, 'hex');
  return _key;
}

/**
 * Encrypt transcript text. Returns the encrypted string if a key is
 * configured, or the original plaintext if not.
 */
export function encryptTranscript(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt transcript text. Handles:
 *  - Encrypted values (starts with "enc:v1:")
 *  - Legacy plaintext (returned as-is)
 *  - null/undefined (returned as empty string)
 */
export function decryptTranscript(stored: string | null | undefined): string {
  if (!stored) return '';

  if (!stored.startsWith(PREFIX)) {
    // Legacy unencrypted record — return as-is
    return stored;
  }

  const key = getKey();
  if (!key) {
    throw new Error(
      '[transcriptCrypto] Cannot decrypt: TRANSCRIPT_ENCRYPTION_KEY is not configured'
    );
  }

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('[transcriptCrypto] Malformed encrypted transcript value');
  }

  const [ivHex, ctHex, tagHex] = parts;
  const iv         = Buffer.from(ivHex,  'hex');
  const ciphertext = Buffer.from(ctHex,  'hex');
  const tag        = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/** Returns true if the stored value is in encrypted format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
