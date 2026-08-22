export const identityDocumentTypes = ["THAI_NATIONAL_ID", "PASSPORT"] as const;

export type IdentityDocumentType = (typeof identityDocumentTypes)[number];

/** Passport numbers are stored in a canonical, non-display form. */
export function normalizePassportNumber(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isValidPassportNumber(value: string) {
  const normalized = normalizePassportNumber(value);
  return /^[A-Z0-9]{6,20}$/.test(normalized) && /\d/.test(normalized);
}

export function maskPassportNumber(value: string) {
  const normalized = normalizePassportNumber(value);
  if (normalized.length <= 4) return "•".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"•".repeat(normalized.length - 4)}${normalized.slice(-2)}`;
}
