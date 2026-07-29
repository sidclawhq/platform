import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * At-rest encryption for stored secrets (webhook signing secrets).
 *
 * Format: `enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>` (AES-256-GCM).
 * Values without the prefix are legacy plaintext rows and are passed through
 * by decryptSecret so existing endpoints keep signing until backfilled
 * (scripts/encrypt-webhook-secrets.ts).
 *
 * Key: SECRET_ENCRYPTION_KEY, 64 hex chars (32 bytes). In production the
 * server refuses to boot without it (see server.ts); in dev/test, absence
 * means secrets are stored as before (plaintext) so local setups keep
 * working without extra configuration.
 */

const PREFIX = 'enc:v1:';

function loadKey(): Buffer | null {
  const raw = process.env['SECRET_ENCRYPTION_KEY'];
  if (!raw) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('SECRET_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(raw, 'hex');
}

/** Encrypts when a key is configured; returns plaintext unchanged otherwise. */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** True if the stored value is in the encrypted format. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/**
 * Decrypts an encrypted value; passes legacy plaintext through unchanged.
 * Throws if the value is encrypted but no key is configured, or if the
 * ciphertext fails authentication (tampered / wrong key).
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = loadKey();
  if (!key) {
    throw new Error('Stored secret is encrypted but SECRET_ENCRYPTION_KEY is not configured');
  }
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret');
  }
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
