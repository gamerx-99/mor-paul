import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markSessionExpired,
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_NOTICE_KEY,
  sessionGateReducer,
} from "../client/src/lib/sessionExpiry";

describe("session-expiry guard for protected routes", () => {
  const storage = new Map<string, string>();
  const eventTarget = new EventTarget();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal("window", eventTarget);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves a protected workspace to AccessGate on expiry and remains there on repeated expiry events", () => {
    const redirected = sessionGateReducer("WORKSPACE", "SESSION_EXPIRED");

    expect(redirected).toBe("ACCESS_GATE");
    expect(sessionGateReducer(redirected, "SESSION_EXPIRED")).toBe("ACCESS_GATE");
    expect(sessionGateReducer(redirected, "AUTHENTICATED")).toBe("WORKSPACE");
  });

  it("stores the Thai notice flag and emits a single redirect signal for the application boundary", () => {
    const handler = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);

    markSessionExpired();

    expect(sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY)).toBe("1");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  });
});
