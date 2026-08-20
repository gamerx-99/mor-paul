// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
const queueApi = vi.hoisted(() => ({ useQuery: vi.fn(), useMutation: vi.fn(), invalidate: vi.fn(), refetch: vi.fn(), mutateAsync: vi.fn() }));
const navigation = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => auth);
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div> }));
vi.mock("@/pages/AccessGate", () => ({ default: () => <div data-testid="access-gate">AccessGate</div> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ frontDesk: { listQueue: { invalidate: queueApi.invalidate } } }),
    frontDesk: {
      listQueue: { useQuery: queueApi.useQuery },
      callNext: { useMutation: queueApi.useMutation },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", navigation.setLocation] }));

import Home from "./Home";

function emptyQueueState(overrides: Record<string, unknown> = {}) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: queueApi.refetch,
    ...overrides,
  };
}

describe("Home dashboard integration", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queueApi.mutateAsync.mockResolvedValue({ queueNumber: 4 });
    queueApi.useMutation.mockImplementation((options: { onSuccess?: (result: { queueNumber: number } | null) => void }) => ({
      mutateAsync: async (input: unknown) => {
        const result = await queueApi.mutateAsync(input);
        options.onSuccess?.(result);
        return result;
      },
      isPending: false,
    }));
    queueApi.useQuery.mockReturnValue(emptyQueueState());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("แสดง zero-PHI platform overview ให้ SYSTEM_ADMIN โดยไม่เรียก frontDesk.listQueue", () => {
    auth.useAuth.mockReturnValue({ loading: false, user: { id: 1, role: "SYSTEM_ADMIN" } });

    act(() => root.render(<Home />));

    expect(container.textContent).toContain("ศูนย์ปฏิบัติการผู้ดูแลระบบ");
    expect(container.textContent).toContain("ไม่เรียกหรือแสดงคิว");
    expect(container.textContent).not.toContain("คิวที่ต้องติดตาม");
    expect(queueApi.useQuery).not.toHaveBeenCalled();
  });

  it("แสดง loading และ empty state ของ Clinical Transit Board สำหรับ ASSISTANT โดยเรียก query ได้", () => {
    auth.useAuth.mockReturnValue({ loading: false, user: { id: 2, role: "ASSISTANT" } });
    queueApi.useQuery.mockReturnValue(emptyQueueState({ isLoading: true }));

    act(() => root.render(<Home />));
    expect(container.textContent).toContain("กำลังอ่านคิววันนี้");
    expect(container.textContent).toContain("ลงทะเบียน");
    expect(queueApi.useQuery).toHaveBeenCalledWith(expect.objectContaining({ queueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }), expect.objectContaining({ enabled: true }));

    queueApi.useQuery.mockReturnValue(emptyQueueState());
    act(() => root.render(<Home />));
    expect(container.textContent).toContain("ยังไม่มีคิวที่ต้องดำเนินการ");
  });

  it("แสดง error state และ doctor action โดยไม่ต้องสร้างรายการผู้รับบริการจำลอง", () => {
    auth.useAuth.mockReturnValue({ loading: false, user: { id: 3, role: "DOCTOR" } });
    queueApi.useQuery.mockReturnValue(emptyQueueState({ isError: true, error: new Error("อ่านคิวไม่สำเร็จ") }));

    act(() => root.render(<Home />));

    expect(container.textContent).toContain("ไม่สามารถอ่านคิวได้");
    expect(container.textContent).toContain("อ่านคิวไม่สำเร็จ");
    expect(container.textContent).toContain("เรียกคิวถัดไป");
  });

  it("เรียกคิวถัดไปสำหรับ DOCTOR พร้อมแสดง pending และ success state", async () => {
    auth.useAuth.mockReturnValue({ loading: false, user: { id: 3, role: "DOCTOR" } });
    queueApi.useMutation.mockReturnValueOnce({ mutateAsync: queueApi.mutateAsync, isPending: true });
    act(() => root.render(<Home />));
    const pendingButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("กำลังเรียก…"));
    expect(pendingButton).toBeDefined();
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);

    queueApi.useMutation.mockImplementation((options: { onSuccess?: (result: { queueNumber: number } | null) => void }) => ({
      mutateAsync: async (input: unknown) => {
        const result = await queueApi.mutateAsync(input);
        options.onSuccess?.(result);
        return result;
      },
      isPending: false,
    }));
    act(() => root.render(<Home />));
    const callNext = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("เรียกคิวถัดไป"));
    await act(async () => { (callNext as HTMLButtonElement).click(); });

    expect(queueApi.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ queueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(queueApi.invalidate).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("เรียกคิว 4 แล้ว");
  });

  it("นำ ASSISTANT ไป Front Desk เมื่อกด action entry point", () => {
    auth.useAuth.mockReturnValue({ loading: false, user: { id: 2, role: "ASSISTANT" } });

    act(() => root.render(<Home />));
    const register = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("ลงทะเบียน"));
    act(() => { (register as HTMLButtonElement).click(); });

    expect(navigation.setLocation).toHaveBeenCalledWith("/front-desk");
  });
});
