import { describe, expect, it } from "vitest";
import app from "../api/trpc/handler";

describe("Vercel tRPC server entry", () => {
  it("exports the shared Express app as a request handler", () => {
    expect(typeof app).toBe("function");
  });
});
