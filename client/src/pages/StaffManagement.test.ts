import { describe, expect, it } from "vitest";
import { initialPasswordStrength } from "./StaffManagement";

describe("initial password strength guidance", () => {
  it("matches the server policy for length and character classes", () => {
    expect(initialPasswordStrength("alllowercase12").passes).toBe(false);
    expect(initialPasswordStrength("MixedCase123!").passes).toBe(true);
    expect(initialPasswordStrength("long simple passphrase").passes).toBe(true);
  });
});
