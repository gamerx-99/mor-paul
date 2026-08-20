const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function convertSegment(numStr: string): string {
  let result = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(numStr[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;

    if (pos === 1 && digit === 1) {
      result += "สิบ";
    } else if (pos === 1 && digit === 2) {
      result += "ยี่สิบ";
    } else if (pos === 0 && digit === 1 && len > 1 && numStr[len - 2] !== "0") {
      result += "เอ็ด";
    } else {
      result += THAI_DIGITS[digit] + THAI_POSITIONS[pos];
    }
  }
  return result;
}

/**
 * Converts a number in satang (integer) or baht to Thai Baht text string.
 * Example: 15050 satang (150.50 THB) -> "หนึ่งร้อยห้าสิบบาทห้าสิบสตางค์"
 * Example: 15000 satang (150.00 THB) -> "หนึ่งร้อยห้าสิบบาทถ้วน"
 */
export function satangToThaiBahtText(satang: number): string {
  if (satang === 0) return "ศูนย์บาทถ้วน";
  if (satang < 0) return "ลบ" + satangToThaiBahtText(Math.abs(satang));

  const totalBaht = Math.floor(satang / 100);
  const totalSatang = satang % 100;

  let text = "";

  if (totalBaht > 0) {
    const bahtStr = String(totalBaht);
    // Handle numbers larger than 1,000,000 recursively
    if (bahtStr.length > 6) {
      const millions = bahtStr.slice(0, -6);
      const remainder = bahtStr.slice(-6);
      text += convertSegment(millions) + "ล้าน" + convertSegment(remainder);
    } else {
      text += convertSegment(bahtStr);
    }
    text += "บาท";
  }

  if (totalSatang > 0) {
    text += convertSegment(String(totalSatang)) + "สตางค์";
  } else {
    text += "ถ้วน";
  }

  return text;
}
