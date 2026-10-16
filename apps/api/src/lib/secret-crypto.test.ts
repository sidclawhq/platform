import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted } from './secret-crypto.js';

const KEY = 'a'.repeat(64);

describe('secret-crypto', () => {
  const original = process.env['SECRET_ENCRYPTION_KEY'];

  beforeEach(() => {
    process.env['SECRET_ENCRYPTION_KEY'] = KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env['SECRET_ENCRYPTION_KEY'];
    else process.env['SECRET_ENCRYPTION_KEY'] = original;
  });

  it('round-trips a secret', () => {
    const stored = encryptSecret('whsec_super_secret_value');
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('whsec_super_secret_value');
    expect(decryptSecret(stored)).toBe('whsec_super_secret_value');
  });

  it('produces a different ciphertext per call (fresh IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('passes legacy plaintext through decryptSecret unchanged', () => {
    expect(isEncrypted('legacy_plaintext_secret')).toBe(false);
    expect(decryptSecret('legacy_plaintext_secret')).toBe('legacy_plaintext_secret');
  });

  it('stores plaintext when no key is configured', () => {
    delete process.env['SECRET_ENCRYPTION_KEY'];
    expect(encryptSecret('plain')).toBe('plain');
  });

  it('throws on tampered ciphertext', () => {
    const stored = encryptSecret('victim');
    // flip a character inside the ciphertext section
    const tampered = stored.slice(0, -2) + (stored.endsWith('A') ? 'B' : 'A') + stored.slice(-1);
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when encrypted value found but key missing', () => {
    const stored = encryptSecret('value');
    delete process.env['SECRET_ENCRYPTION_KEY'];
    expect(() => decryptSecret(stored)).toThrow(/not configured/);
  });

  it('rejects malformed keys', () => {
    process.env['SECRET_ENCRYPTION_KEY'] = 'too-short';
    expect(() => encryptSecret('x')).toThrow(/64 hex/);
  });
});
