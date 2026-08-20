/**
 * Standard Thailand PromptPay QR Payload Generator (EMVCo compliant)
 * Operates purely offline without any external services or APIs.
 */

function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatTlv(tag: string, value: string): string {
  const lengthStr = value.length.toString().padStart(2, "0");
  return `${tag}${lengthStr}${value}`;
}

export interface PromptPayOptions {
  /** 10-digit phone number (e.g. 0812345678) or 13-digit ID/Tax ID */
  target: string;
  /** Amount in Satang (e.g. 15000 = 150.00 Baht) or in Baht float. If undefined or 0, static QR is produced */
  amountSatang?: number;
}

/**
 * Normalizes and formats the PromptPay recipient target.
 * - Mobile: 0812345678 -> 0066812345678 (tag 01)
 * - National ID / Tax ID: 13 digits -> 13 digits (tag 02)
 */
export function formatPromptPayTarget(rawTarget: string): { type: "PHONE" | "NATIONAL_ID"; formatted: string } {
  const cleaned = rawTarget.replace(/[^0-9]/g, "");
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return {
      type: "PHONE",
      formatted: `0066${cleaned.slice(1)}`.padStart(13, "0"),
    };
  }
  if (cleaned.length === 13) {
    return {
      type: "NATIONAL_ID",
      formatted: cleaned,
    };
  }
  return {
    type: cleaned.length === 10 ? "PHONE" : "NATIONAL_ID",
    formatted: cleaned.length === 10 ? `0066${cleaned.slice(1)}`.padStart(13, "0") : cleaned.padStart(13, "0"),
  };
}

/**
 * Generates an EMVCo-compliant PromptPay payload string.
 */
export function generatePromptPayPayload({ target, amountSatang }: PromptPayOptions): string {
  const { type, formatted } = formatPromptPayTarget(target);

  // Tag 29: Merchant Account Info for PromptPay
  // Tag 00: AID = A000000677010111
  // Tag 01: Mobile (00668xxxxxxxx) or Tag 02: National/Tax ID (13 digits)
  const aidTag = formatTlv("00", "A000000677010111");
  const targetTag = formatTlv(type === "PHONE" ? "01" : "02", formatted);
  const merchantAccountInfo = formatTlv("29", `${aidTag}${targetTag}`);

  // Base EMVCo tags
  let payload = "";
  payload += formatTlv("00", "01"); // Payload Format Indicator
  payload += formatTlv("01", amountSatang && amountSatang > 0 ? "12" : "11"); // 12 = Dynamic (amount specified), 11 = Static
  payload += merchantAccountInfo;
  payload += formatTlv("53", "764"); // Currency = THB (764)
  payload += formatTlv("58", "TH");  // Country = TH

  if (amountSatang && amountSatang > 0) {
    const bahtAmount = (amountSatang / 100).toFixed(2);
    payload += formatTlv("54", bahtAmount);
  }

  // Tag 63: Checksum (CRC16)
  const checksumPrefix = "6304";
  const rawDataForChecksum = `${payload}${checksumPrefix}`;
  const checksum = crc16Ccitt(rawDataForChecksum);

  return `${payload}${checksumPrefix}${checksum}`;
}
