import { describe, expect, it } from "vitest";
import { canViewClinicalTransit } from "./Home";

describe("Clinical Transit Board role gate", () => {
  it("อนุญาตให้เฉพาะ ASSISTANT และ DOCTOR เปิด Clinical Transit Board", () => {
    expect(canViewClinicalTransit("ASSISTANT")).toBe(true);
    expect(canViewClinicalTransit("DOCTOR")).toBe(true);
  });

  it("ปฏิเสธ SYSTEM_ADMIN และค่าบทบาทที่ไม่รู้จักจาก Clinical Transit Board", () => {
    expect(canViewClinicalTransit("SYSTEM_ADMIN")).toBe(false);
    expect(canViewClinicalTransit(undefined)).toBe(false);
    expect(canViewClinicalTransit("UNKNOWN")).toBe(false);
  });
});
