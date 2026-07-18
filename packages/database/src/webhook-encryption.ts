import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Milestone 04d - the exact same AES-256-GCM pattern as
// packages/social/src/token-encryption.ts, duplicated rather than imported:
// packages/social has no dependency on packages/database (or vice versa)
// today, and adding one for this ~40-line generic helper would be an
// awkward "notification webhook secrets" -> "social platform publishing"
// coupling. packages/database is the correct shared home instead - it's
// Node-only (unlike packages/shared, which ships as a single
// browser-bundled entry apps/web imports and can't safely take a
// node:crypto dependency), and already the common dependency of
// apps/api/apps/worker, already owning Notification-adjacent persistence.
// Reuses the same TOKEN_ENCRYPTION_KEY env var (already optional-at-boot in
// both apps) rather than adding a second key to configure.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended IV length for GCM

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not configured - required to save an outbound notification ' +
        'webhook destination. Generate one with: openssl rand -hex 32',
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex character) key');
  }
  return key;
}

// Stored as "<iv>:<authTag>:<ciphertext>", all hex - see
// NotificationWebhook.url's own comment.
export function encryptWebhookUrl(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptWebhookUrl(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted webhook url');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
