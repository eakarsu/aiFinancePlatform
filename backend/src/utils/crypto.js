/**
 * Symmetric encryption helpers for at-rest sensitive fields (e.g. Plaid access tokens).
 *
 * Uses AES-256-GCM with a 32-byte key derived from PLAID_TOKEN_ENC_KEY env var.
 * Stored format: base64(iv || authTag || ciphertext) — 12-byte iv, 16-byte tag.
 *
 * Usage:
 *   const { encrypt, decrypt } = require('./utils/crypto');
 *   const cipher = encrypt(accessToken);     // store this
 *   const plain  = decrypt(cipher);          // read back
 *
 * If PLAID_TOKEN_ENC_KEY is not configured, encrypt/decrypt are pass-throughs
 * (warning logged on first use) so the app degrades gracefully but operators
 * can opt in to encryption at any time.
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
let warned = false;

function getKey() {
  const raw = process.env.PLAID_TOKEN_ENC_KEY || process.env.ENC_KEY;
  if (!raw) return null;
  if (raw.length === 64) {
    // 64 hex chars = 32 bytes
    return Buffer.from(raw, 'hex');
  }
  // Otherwise derive deterministically with sha256 (lets users supply a passphrase)
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plain) {
  if (plain == null) return plain;
  const key = getKey();
  if (!key) {
    if (!warned) {
      console.warn('[crypto] PLAID_TOKEN_ENC_KEY not set — storing tokens in plaintext. Set the env var to enable AES-256-GCM at-rest encryption.');
      warned = true;
    }
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:v1:' + Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(value) {
  if (value == null) return value;
  if (typeof value !== 'string' || !value.startsWith('enc:v1:')) {
    // Plaintext / legacy value
    return value;
  }
  const key = getKey();
  if (!key) {
    throw new Error('PLAID_TOKEN_ENC_KEY required to decrypt stored token');
  }
  const buf = Buffer.from(value.slice('enc:v1:'.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
