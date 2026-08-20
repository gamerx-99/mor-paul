// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
const staffApi = vi.hoisted(() => ({
  listQuery: vi.fn(),
  createMutation: vi.fn(),
  changeRoleMutation: vi.fn(),
  setActiveMutation: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => auth);
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ staff: { list: { invalidate: staffApi.invalidate } } }),
    staff: {
      list: { useQuery: staffApi.listQuery },
      create: { useMutation: staffApi.createMutation },
      changeRole: { useMutation: staffApi.changeRoleMutation },
      setActive: { useMutation: staffApi.setActiveMutation },
    },
  },
}));

import StaffManagement from "./StaffManagement";

describe("StaffManagement password policy guidance", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    auth.useAuth.mockReturnValue({ user: { id: 1, role: "SYSTEM_ADMIN" } });
    staffApi.listQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    staffApi.createMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    staffApi.changeRoleMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    staffApi.setActiveMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("แสดงเกณฑ์ที่ตรงกับ server และเปลี่ยนผลความแข็งแรงตามรหัสผ่านที่กรอก", () => {
    act(() => root.render(<StaffManagement />));

    expect(container.textContent).toContain("ต้องยาว 12–128 ตัวอักษร");
    expect(container.textContent).toContain("ยังไม่ได้ตรวจ");

    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(passwordInput, "alllowercase12");
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("ยังไม่ผ่านเกณฑ์");
    expect(container.textContent).toContain("ต้องมีอย่างน้อย 3 กลุ่มอักขระ");

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(passwordInput, "MixedCase123!");
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("ผ่านเกณฑ์");
    expect(container.textContent).toContain("ผ่านด้วยความยาว 13 ตัวอักษร และ 4 กลุ่มอักขระ");
  });
});
