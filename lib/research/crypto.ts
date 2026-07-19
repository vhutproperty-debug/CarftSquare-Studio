import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

let cachedEncryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.RESEARCH_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is required to encrypt research browser sessions.');
    }
    cachedEncryptionKey = createHash('sha256').update('dev-only-research-encryption-key').digest();
    return cachedEncryptionKey;
  }
  cachedEncryptionKey = createHash('sha256').update(secret).digest();
  return cachedEncryptionKey;
}

/** Encrypt JSON-serializable payload (cookies / storage) for Mongo persistence. */
export function encryptResearchPayload(value: unknown): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptResearchPayload<T = unknown>(encoded: string): T {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
