// Backend/modules/encryption.module.js
//
// Application-level authenticated encryption (AES-256-GCM) for sensitive
// fields the schema stores at rest. Originally written for
// merchant_bank_details.account_number; reused as-is (same helper, same
// key) for merchant_payment_accounts' encrypted credential payload
// (Merchant Payments Stage 1 — see Database/schema/010_merchant_payments.sql).
// Still not a general-purpose "encrypt everything" helper — extend its use
// only for fields that genuinely need authenticated encryption at rest,
// as a deliberate decision.
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

// Full validation (presence + correct decoded length) without throwing —
// for startup diagnostics (see server.js). Never returns or logs the key
// itself; `error` is always one of getKey()'s static messages above.
export function validateEncryptionKey() {
  if (!process.env.MARKETPLACE_DATA_ENCRYPTION_KEY) {
    return { configured: false, valid: false, error: "MARKETPLACE_DATA_ENCRYPTION_KEY is not set." };
  }
  try {
    getKey();
    return { configured: true, valid: true, error: null };
  } catch (err) {
    return { configured: true, valid: false, error: err.message };
  }
}
