// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: number; username: string; displayName: string; role: "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT"; name?: string } | null,
  logout: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: false, user: authState.user, logout: authState.logout }),
}));

import DashboardLayout from "./DashboardLayout";

function renderMobileLayout() {
  return renderToStaticMarkup(createElement(DashboardLayout, null, createElement("p", null, "workspace")));
}

describe("DashboardLayout mobile initial navigation", () => {
  beforeEach(() => {
    authState.logout.mockReset();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it.each([
    ["SYSTEM_ADMIN", "/medications", "คลังยาและราคา"],
    ["DOCTOR", "/doctor-console", "ห้องตรวจ"],
    ["ASSISTANT", "/front-desk", "ลงทะเบียน"],
  ] as const)("renders the mobile navigation header on first render for %s", (role, path, expectedLabel) => {
    authState.user = { id: 1, username: role.toLowerCase(), displayName: role, role };
    window.history.replaceState({}, "", path);

    const markup = renderMobileLayout();

    expect(markup).toContain(expectedLabel);
    expect(markup).toContain("workspace");
  });
});
