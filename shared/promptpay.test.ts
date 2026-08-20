import { describe, expect, it } from "vitest";
import { formatPromptPayTarget, generatePromptPayPayload } from "./promptpay";

describe("PromptPay EMVCo Generator", () => {
  it("formats 10-digit mobile number correctly to Thailand country code 0066", () => {
    const { type, formatted } = formatPromptPayTarget("0812345678");
    expect(type).toBe("PHONE");
    expect(formatted).toBe("0066812345678");
  });

  it("formats 13-digit national ID / tax ID correctly", () => {
    const { type, formatted } = formatPromptPayTarget("1234567890123");
    expect(type).toBe("NATIONAL_ID");
    expect(formatted).toBe("1234567890123");
  });

  it("generates a valid static PromptPay QR payload", () => {
    const payload = generatePromptPayPayload({ target: "0812345678" });
    expect(payload.startsWith("000201010211")).toBe(true);
    expect(payload).toContain("A000000677010111");
    expect(payload).toContain("0066812345678");
    expect(payload).toContain("5303764"); // Currency THB
    expect(payload).toContain("5802TH");  // Country TH
    expect(payload).toMatch(/6304[0-9A-F]{4}$/); // Ends with 4-char hex CRC
  });

  it("generates a valid dynamic PromptPay QR payload with amount", () => {
    const payload = generatePromptPayPayload({
      target: "0812345678",
      amountSatang: 15050, // 150.50 THB
    });
    expect(payload.startsWith("000201010212")).toBe(true); // Dynamic QR
    expect(payload).toContain("5406150.50"); // Tag 54 = 150.50
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it("generates dynamic payload for 13-digit tax ID", () => {
    const payload = generatePromptPayPayload({
      target: "0105551234567",
      amountSatang: 50000, // 500.00 THB
    });
    expect(payload).toContain("02130105551234567");
    expect(payload).toContain("5406500.00");
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });
});
