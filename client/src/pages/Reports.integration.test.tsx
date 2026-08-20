// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
const reportsApi = vi.hoisted(() => ({ summaryQuery: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => auth);
vi.mock("@/lib/trpc", () => ({
  trpc: {
    reports: {
      operationalSummary: { useQuery: reportsApi.summaryQuery },
      logCsvExport: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

import Reports from "./Reports";

describe("Reports empty state", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    auth.useAuth.mockReturnValue({ user: { id: 1, role: "SYSTEM_ADMIN" } });
    reportsApi.summaryQuery.mockReturnValue({
      data: {
        range: { from: "2026-08-14", to: "2026-08-20" },
        summary: {
          visitCount: 0,
          paidSatang: 0,
          paymentCount: 0,
          dispensedUnits: 0,
          activeLotCount: 0,
          onHandUnits: 0,
          expiringLotCount: 0,
        },
        daily: [],
        topMedications: [],
      },
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("แสดงสถานะว่างที่ปลอดภัยโดยไม่เผย SQL หรือพารามิเตอร์ภายใน", () => {
    act(() => root.render(<Reports />));

    const text = container.textContent ?? "";
    expect(text).toContain("ยังไม่มีข้อมูลในช่วงวันที่เลือก");
    expect(text).toContain("สิทธิ์: ข้อมูล aggregate เท่านั้น");
    expect(text).not.toContain("Failed query");
    expect(text).not.toContain("receivedAt");
    expect(text).not.toContain("amountSatang");
    expect(container.querySelectorAll("button")[0]?.hasAttribute("disabled")).toBe(false);
  });
});
