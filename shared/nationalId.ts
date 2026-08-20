/** Normalizes accepted visual separators without changing the identity value. */
export function normalizeThaiNationalId(value: string) {
  return value.replace(/[\s-]/g, "");
}

/** Validates the 13-digit Thai citizen identifier check digit. */
export function isValidThaiNationalId(value: string) {
  const normalized = normalizeThaiNationalId(value);
  if (!/^\d{13}$/.test(normalized)) return false;
  const weightedSum = Array.from(normalized.slice(0, 12)).reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  const checkDigit = (11 - (weightedSum % 11)) % 10;
  return checkDigit === Number(normalized[12]);
}

/** The only permitted display format: two leading and three trailing digits. */
export function maskThaiNationalId(value: string) {
  const normalized = normalizeThaiNationalId(value);
  if (!/^\d{13}$/.test(normalized)) return "•••••••••••••";
  return `${normalized.slice(0, 2)}••••••••${normalized.slice(-3)}`;
}
