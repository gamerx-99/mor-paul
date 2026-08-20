// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionExpiryBoundary from "../client/src/components/SessionExpiryBoundary";
import { SESSION_EXPIRED_EVENT } from "../client/src/lib/sessionExpiry";

vi.mock("@/pages/AccessGate", () => ({
  default: ({ onAuthenticated }: { onAuthenticated: () => void }) => (
    <button data-testid="access-gate" onClick={onAuthenticated}>AccessGate</button>
  ),
}));

describe("SessionExpiryBoundary integration", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("replaces a protected route with AccessGate after session expiry", () => {
    act(() => root.render(<SessionExpiryBoundary><div data-testid="protected-route">Clinical route</div></SessionExpiryBoundary>));
    expect(container.querySelector("[data-testid='protected-route']")).not.toBeNull();

    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));

    expect(container.querySelector("[data-testid='protected-route']")).toBeNull();
    expect(container.querySelector("[data-testid='access-gate']")?.textContent).toBe("AccessGate");
  });

  it("does not loop on repeated expiry and returns to the protected route only after re-authentication", () => {
    act(() => root.render(<SessionExpiryBoundary><div data-testid="protected-route">Clinical route</div></SessionExpiryBoundary>));

    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(container.querySelectorAll("[data-testid='access-gate']")).toHaveLength(1);
    expect(container.querySelector("[data-testid='protected-route']")).toBeNull();

    act(() => (container.querySelector("[data-testid='access-gate']") as HTMLButtonElement).click());
    expect(container.querySelector("[data-testid='protected-route']")?.textContent).toBe("Clinical route");

    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(container.querySelector("[data-testid='access-gate']")).not.toBeNull();
  });
});
