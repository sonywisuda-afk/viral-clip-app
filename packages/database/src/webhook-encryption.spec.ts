import { randomBytes } from 'node:crypto';
import { decryptWebhookUrl, encryptWebhookUrl } from './webhook-encryption';

describe('webhook-encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex') };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('round-trips a url through encryptWebhookUrl/decryptWebhookUrl', () => {
    const plaintext = 'https://hooks.slack.com/services/T00/B00/xxxxxxxxxxxxxxxxxxxxxxxx';

    const result = decryptWebhookUrl(encryptWebhookUrl(plaintext));

    expect(result).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encryptWebhookUrl('same-url');
    const b = encryptWebhookUrl('same-url');

    expect(a).not.toBe(b);
    expect(decryptWebhookUrl(a)).toBe('same-url');
    expect(decryptWebhookUrl(b)).toBe('same-url');
  });

  it('stores as "<iv>:<authTag>:<ciphertext>" hex triples', () => {
    const encrypted = encryptWebhookUrl('https://example.com/hook');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    expect(parts.every((p) => /^[0-9a-f]+$/.test(p))).toBe(true);
  });

  it('throws when TOKEN_ENCRYPTION_KEY is not configured', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => encryptWebhookUrl('x')).toThrow(/TOKEN_ENCRYPTION_KEY is not configured/);
  });

  it('throws when TOKEN_ENCRYPTION_KEY is not a 32-byte key', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'too-short';

    expect(() => encryptWebhookUrl('x')).toThrow(/32-byte/);
  });

  it('throws decrypting a malformed stored url', () => {
    expect(() => decryptWebhookUrl('not-the-right-format')).toThrow(
      /Malformed encrypted webhook url/,
    );
  });

  it('fails to decrypt (auth tag mismatch) if the ciphertext was tampered with', () => {
    const encrypted = encryptWebhookUrl('https://example.com/hook');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;

    expect(() => decryptWebhookUrl(tampered)).toThrow();
  });
});
