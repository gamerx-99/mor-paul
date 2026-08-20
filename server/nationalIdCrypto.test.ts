import { describe, expect, it } from "vitest";
import { decryptNationalId, encryptNationalId, nationalIdLookupHash } from "./nationalIdCrypto";

describe("national ID encryption key", () => {
  it("uses the configured key to encrypt, decrypt, and create a non-plaintext lookup hash", () => {
    const nonPatientTestValue = "0000000000000";
    const encrypted = encryptNationalId(nonPatientTestValue);

    expect(encrypted).not.toContain(nonPatientTestValue);
    expect(decryptNationalId(encrypted)).toBe(nonPatientTestValue);
    expect(nationalIdLookupHash(nonPatientTestValue)).toMatch(/^[a-f0-9]{64}$/);
  });
});
