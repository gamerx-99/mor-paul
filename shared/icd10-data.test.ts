import { describe, expect, it } from "vitest";
import { COMMON_ICD10_LIST, searchIcd10 } from "./icd10-data";

describe("ICD-10 primary care search", () => {
  it("returns top common list when query is empty", () => {
    const results = searchIcd10("", 10);
    expect(results).toHaveLength(10);
    expect(results[0].code).toBe(COMMON_ICD10_LIST[0].code);
  });

  it("finds exact or matching code", () => {
    const results = searchIcd10("J00");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("J00");
    expect(results[0].nameTh).toContain("หวัด");
  });

  it("finds by Thai keyword", () => {
    const results = searchIcd10("ความดัน");
    expect(results.some(r => r.code === "I10")).toBe(true);
  });

  it("finds by English keyword", () => {
    const results = searchIcd10("diabetes");
    expect(results.some(r => r.code === "E11.9")).toBe(true);
  });

  it("finds by category or partial text", () => {
    const results = searchIcd10("ผิวหนัง");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.category === "โรคผิวหนัง")).toBe(true);
  });
});
