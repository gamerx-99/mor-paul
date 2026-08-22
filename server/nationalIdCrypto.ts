import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";

function encryptionKey() {
  const source = process.env.NATIONAL_ID_ENCRYPTION_KEY;
  if (!source || source.trim().length < 32) throw new Error("NATIONAL_ID_ENCRYPTION_KEY_INVALID");
  return createHash("sha256").update(source, "utf8").digest();
}

/** Produces a non-reversible stable lookup key without retaining the identifier in query logs. */
export function nationalIdLookupHash(nationalId: string) {
  const source = process.env.NATIONAL_ID_ENCRYPTION_KEY;
  if (!source || source.trim().length < 32) throw new Error("NATIONAL_ID_ENCRYPTION_KEY_INVALID");
  return createHmac("sha256", source).update(nationalId, "utf8").digest("hex");
}

/** Encrypts the identifier using AES-256-GCM; its output is safe to persist but never to display. */
export function encryptNationalId(nationalId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(nationalId, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [CIPHER_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptNationalId(ciphertext: string) {
  const [version, ivEncoded, tagEncoded, bodyEncoded, ...unexpected] = ciphertext.split(".");
  if (version !== CIPHER_VERSION || !ivEncoded || !tagEncoded || !bodyEncoded || unexpected.length) throw new Error("NATIONAL_ID_CIPHERTEXT_INVALID");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(bodyEncoded, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("NATIONAL_ID_CIPHERTEXT_INVALID");
  }
}

/**
 * The same versioned AES-256-GCM and keyed-HMAC primitive protects every
 * identity document. These aliases preserve the legacy National-ID API while
 * making Passport use explicit at the call site without exposing plaintext.
 */
export const encryptIdentityDocument = encryptNationalId;
export const decryptIdentityDocument = decryptNationalId;
export const identityDocumentLookupHash = nationalIdLookupHash;
