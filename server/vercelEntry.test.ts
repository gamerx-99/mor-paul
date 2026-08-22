import { describe, expect, it } from "vitest";
import app from "../server";

describe("Vercel root server entry", () => {
  it("exports the shared Express app as a request handler", () => {
    expect(typeof app).toBe("function");
  });
});
