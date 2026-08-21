import { describe, it, expect, vi } from "vitest";
import { withIdempotency } from "./idempotency";

describe("withIdempotency", () => {
  it("runs handler once for the same key and returns same result", async () => {
    const cache = new Map<string, Promise<number>>();
    const handler = vi.fn(async (k: string) => k.charCodeAt(0));
    const wrapped = withIdempotency(cache, handler);
    const a = await wrapped("KEY-1");
    const b = await wrapped("KEY-1");
    expect(a).toBe("K".charCodeAt(0));
    expect(b).toBe("K".charCodeAt(0));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs handler separately for different keys", async () => {
    const cache = new Map<string, Promise<number>>();
    const handler = vi.fn(async (k: string) => k.charCodeAt(0));
    const wrapped = withIdempotency(cache, handler);
    await wrapped("KEY-1");
    await wrapped("KEY-2");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("returns rejected promise without caching it", async () => {
    const cache = new Map<string, Promise<number>>();
    let count = 0;
    const handler = vi.fn(async () => {
      count += 1;
      if (count < 2) throw new Error("transient");
      return 42;
    });
    const wrapped = withIdempotency(cache, handler);
    await expect(wrapped("ERR")).rejects.toThrow("transient");
    const result = await wrapped("ERR");
    expect(result).toBe(42);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
