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

  it("renders Mobile Bottom Navigation immediately on first render without user interaction for SYSTEM_ADMIN", () => {
    authState.user = { id: 1, username: "admin", displayName: "System Admin", role: "SYSTEM_ADMIN" };
    window.history.replaceState({}, "", "/medications");

    const markup = renderMobileLayout();

    expect(markup).toContain('data-slot="mobile-bottom-nav"');
    expect(markup).toContain("คลังยาและราคา");
    expect(markup).toContain("รายงานสรุป");
    expect(markup).toContain("บัญชีบุคลากร");
    // Should not contain assistant/doctor only pages
    expect(markup).not.toContain("ห้องตรวจ");
    expect(markup).not.toContain("ลงทะเบียน");
  });

  it("renders Mobile Bottom Navigation immediately on first render without user interaction for DOCTOR", () => {
    authState.user = { id: 2, username: "doctor", displayName: "Doctor A", role: "DOCTOR" };
    window.history.replaceState({}, "", "/doctor-console");

    const markup = renderMobileLayout();

    expect(markup).toContain('data-slot="mobile-bottom-nav"');
    expect(markup).toContain("ภาพรวม");
    expect(markup).toContain("คัดกรองและคิว");
    expect(markup).toContain("ห้องตรวจ");
    expect(markup).toContain("รายงานสรุป");
    // Should not contain admin-only or cashier
    expect(markup).not.toContain("คลังยาและราคา");
    expect(markup).not.toContain("จ่ายยาและการเงิน");
  });

  it("renders Mobile Bottom Navigation immediately on first render without user interaction for ASSISTANT", () => {
    authState.user = { id: 3, username: "assistant", displayName: "Assistant B", role: "ASSISTANT" };
    window.history.replaceState({}, "", "/front-desk");

    const markup = renderMobileLayout();

    expect(markup).toContain('data-slot="mobile-bottom-nav"');
    expect(markup).toContain("ภาพรวม");
    expect(markup).toContain("ลงทะเบียน");
    expect(markup).toContain("คัดกรองและคิว");
    expect(markup).toContain("จ่ายยาและการเงิน");
    expect(markup).toContain("รายงานสรุป");
    // Should not contain doctor-only or admin-only
    expect(markup).not.toContain("ห้องตรวจ");
    expect(markup).not.toContain("บัญชีบุคลากร");
  });

  it.each([
    ["/", "ภาพรวม"],
    ["/front-desk", "ลงทะเบียน"],
    ["/queue", "คัดกรองและคิว"],
    ["/cashier", "จ่ายยาและการเงิน"],
    ["/reports", "รายงานสรุป"],
  ] as const)("marks active state correctly on direct entry / hard refresh for route %s", (path, expectedActiveLabel) => {
    authState.user = { id: 3, username: "assistant", displayName: "Assistant B", role: "ASSISTANT" };
    window.history.replaceState({}, "", path);

    const markup = renderMobileLayout();

    expect(markup).toContain('data-slot="mobile-bottom-nav"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain(expectedActiveLabel);
  });
});
