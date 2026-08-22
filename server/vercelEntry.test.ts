import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "../api/trpc/handler";

describe("Vercel tRPC server entry", () => {
  it("exports the shared Express app as a request handler", () => {
    expect(typeof app).toBe("function");
  });

  it("ships a bundled catch-all artifact without a source-only app import", () => {
    const artifact = readFileSync(new URL("../api/trpc/[...path].js", import.meta.url), "utf8");
    expect(artifact).toContain("createApp");
    expect(artifact).not.toMatch(/from ["'][^"']*server\/_core\/app/);
  });
});
