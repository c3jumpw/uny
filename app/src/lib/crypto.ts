import crypto from "crypto";

// Credential encryption for the integrations hub.
//
// Credentials are encrypted in the app layer with AES-256-GCM
// before they are written to Postgres, and decrypted only when
// the app needs to make a live health-check call. The database
// never holds plaintext, so a DB dump or a leaked service-role
// key does not expose client credentials — an attacker would
// also need CREDENTIAL_ENCRYPTION_KEY from the Vercel env.
//
// GCM (not CBC) because it is authenticated: the auth tag
// detects tampering, so a modified ciphertext fails loudly
// instead of decrypting to garbage.
//
// Each encryption uses a fresh random IV. IV and auth tag are
// stored alongside the ciphertext — neither is secret, both are
// required to decrypt.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV is the GCM standard

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. Credentials cannot be encrypted or decrypted."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}.`
    );
  }
  return key;
}

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encryptCredential(plaintext: string): EncryptedCredential {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCredential(enc: EncryptedCredential): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(enc.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// A short, safe display fragment so the UI can show which
// credential is which without revealing it. Shows a prefix (which
// identifies the provider, e.g. "ghp_") and the last 4 chars.
export function credentialHint(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  const prefixMatch = trimmed.match(/^([A-Za-z0-9]+_)/);
  const prefix = prefixMatch ? prefixMatch[1] : trimmed.slice(0, 4);
  return `${prefix}…${trimmed.slice(-4)}`;
}
