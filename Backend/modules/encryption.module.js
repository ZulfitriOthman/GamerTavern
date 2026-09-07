// Backend/modules/encryption.module.js
//
// Application-level authenticated encryption (AES-256-GCM) for the one
// field in the schema that genuinely needs it right now:
// merchant_bank_details.account_number. Never used for anything else
// without a deliberate decision — this is not a general-purpose "encrypt
// everything" helper.
//
// MARKETPLACE_DATA_ENCRYPTION_KEY must be a 64-character hex string
// (32 bytes). Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Never commit a real value; never log it; never return it from any API.
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length

function getKey() {
  const keyHex = process.env.MARKETPLACE_DATA_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("MARKETPLACE_DATA_ENCRYPTION_KEY is not set.");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("MARKETPLACE_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters).");
  }
  return key;
}

// Returns Buffers ready to bind directly to VARBINARY columns.
export function encryptField(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptField({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export function maskLast4(value) {
  const str = String(value || "");
  return str.length <= 4 ? str : `${"*".repeat(str.length - 4)}${str.slice(-4)}`;
}

export function isEncryptionConfigured() {
  return Boolean(process.env.MARKETPLACE_DATA_ENCRYPTION_KEY);
}
