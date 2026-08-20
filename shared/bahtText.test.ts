import { describe, expect, it } from "vitest";
import { satangToThaiBahtText } from "./bahtText";

describe("satangToThaiBahtText", () => {
  it("converts zero satang to ศูนย์บาทถ้วน", () => {
    expect(satangToThaiBahtText(0)).toBe("ศูนย์บาทถ้วน");
  });

  it("converts whole baht amounts correctly", () => {
    expect(satangToThaiBahtText(100)).toBe("หนึ่งบาทถ้วน");
    expect(satangToThaiBahtText(1100)).toBe("สิบเอ็ดบาทถ้วน");
    expect(satangToThaiBahtText(2100)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(satangToThaiBahtText(15000)).toBe("หนึ่งร้อยห้าสิบบาทถ้วน");
    expect(satangToThaiBahtText(125000)).toBe("หนึ่งพันสองร้อยห้าสิบบาทถ้วน");
    expect(satangToThaiBahtText(10000000)).toBe("หนึ่งแสนบาทถ้วน");
  });

  it("converts amounts with satang correctly", () => {
    expect(satangToThaiBahtText(50)).toBe("ห้าสิบสตางค์");
    expect(satangToThaiBahtText(15050)).toBe("หนึ่งร้อยห้าสิบบาทห้าสิบสตางค์");
    expect(satangToThaiBahtText(2125)).toBe("ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์");
  });
});
