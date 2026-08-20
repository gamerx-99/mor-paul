// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
const cashierApi = vi.hoisted(() => ({
  listQuery: vi.fn(),
  detailQuery: vi.fn(),
  dailySummaryQuery: vi.fn(() => ({ data: null, isLoading: false })),
  addServiceMutation: vi.fn(),
  issueInvoiceMutation: vi.fn(),
  receivePaymentMutation: vi.fn(),
  dispenseMutation: vi.fn(),
  submitDailyCloseoutMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  addServiceRun: vi.fn(),
  issueInvoiceRun: vi.fn(),
  receivePaymentRun: vi.fn(),
  invalidateList: vi.fn(),
  invalidateVisit: vi.fn(),
  invalidateDailySummary: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => auth);
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      pharmacy: {
        cashier: {
          listVisits: { invalidate: cashierApi.invalidateList },
          getVisit: { invalidate: cashierApi.invalidateVisit },
          getDailySummary: { invalidate: cashierApi.invalidateDailySummary },
        },
      },
    }),
    pharmacy: {
      cashier: {
        listVisits: { useQuery: cashierApi.listQuery },
        getVisit: { useQuery: cashierApi.detailQuery },
        getDailySummary: { useQuery: cashierApi.dailySummaryQuery },
        dispense: { useMutation: cashierApi.dispenseMutation },
        addServiceCharge: { useMutation: cashierApi.addServiceMutation },
        issueInvoice: { useMutation: cashierApi.issueInvoiceMutation },
        receivePayment: { useMutation: cashierApi.receivePaymentMutation },
        submitDailyCloseout: { useMutation: cashierApi.submitDailyCloseoutMutation },
      },
    },
  },
}));

import Cashier from "./Cashier";

const waitingVisit = { visitId: 41, hn: "HN-TEST", firstName: "Test", lastName: "Patient", visitStatus: "DISPENSING", invoiceNumber: null };
const dispensingDetail = {
  ...waitingVisit,
  invoiceId: null,
  invoiceStatus: null,
  totalSatang: null,
  items: [],
  serviceCharges: [],
  invoiceLines: [],
};
const billedDetail = {
  ...waitingVisit,
  visitStatus: "BILLED",
  invoiceId: 88,
  invoiceNumber: "INV-00000088",
  invoiceStatus: "ISSUED",
  totalSatang: 7500,
  items: [],
  serviceCharges: [{ id: 9, description: "ค่าตรวจแพทย์", detail: "ตรวจติดตาม", quantity: 1, unitPriceSatang: 5000, status: "INVOICED" }],
  invoiceLines: [
    { id: 1, sourceType: "MEDICATION_ORDER_ITEM", descriptionSnapshot: "ยา ก", quantity: 1, unitPriceSatang: 2500, lineTotalSatang: 2500 },
    { id: 2, sourceType: "SERVICE_CHARGE", descriptionSnapshot: "ค่าตรวจแพทย์", quantity: 1, unitPriceSatang: 5000, lineTotalSatang: 5000 },
  ],
};

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes(label));
}

describe("Cashier service charge and closure flow", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    auth.useAuth.mockReturnValue({ user: { id: 12, role: "ASSISTANT" } });
    cashierApi.listQuery.mockReturnValue({ data: [waitingVisit], isLoading: false });
    cashierApi.detailQuery.mockReturnValue({ data: dispensingDetail, isLoading: false });
    cashierApi.dispenseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    cashierApi.addServiceMutation.mockImplementation((options: { onSuccess?: (result: { id: number }) => Promise<unknown> | unknown }) => ({
      mutateAsync: async (input: unknown) => {
        cashierApi.addServiceRun(input);
        const result = { id: 9 };
        await options.onSuccess?.(result);
        return result;
      },
      isPending: false,
    }));
    cashierApi.issueInvoiceMutation.mockImplementation((options: { onSuccess?: (result: { invoiceNumber: string; replayed: boolean }) => Promise<unknown> | unknown }) => ({
      mutateAsync: async (input: unknown) => {
        cashierApi.issueInvoiceRun(input);
        const result = { invoiceNumber: "INV-00000088", replayed: false };
        await options.onSuccess?.(result);
        return result;
      },
      isPending: false,
    }));
    cashierApi.receivePaymentMutation.mockImplementation((options: { onSuccess?: (result: { replayed: boolean }) => Promise<unknown> | unknown }) => ({
      mutateAsync: async (input: unknown) => {
        cashierApi.receivePaymentRun(input);
        const result = { replayed: false };
        await options.onSuccess?.(result);
        return result;
      },
      isPending: false,
    }));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("allows an assistant to key a service charge and issue an invoice even when there is no medication order", async () => {
    await act(async () => { root.render(<Cashier />); });
    expect(container.textContent).toContain("ไม่มีคำสั่งยา แต่ encounter นี้ยังต้องผ่านการออกบิลและรับชำระก่อนปิดงาน");

    const description = container.querySelector('input[placeholder="เช่น ค่าตรวจแพทย์"]') as HTMLInputElement;
    const detail = container.querySelector('input[placeholder="เช่น ตรวจติดตามอาการ"]') as HTMLInputElement;
    const inputs = container.querySelectorAll('input');
    await act(async () => {
      setInput(description, "ค่าตรวจแพทย์");
      setInput(detail, "ตรวจติดตาม");
      setInput(inputs[2] as HTMLInputElement, "1");
      setInput(inputs[3] as HTMLInputElement, "50");
      const form = description.closest("form") as HTMLFormElement;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(cashierApi.addServiceRun).toHaveBeenCalledWith(expect.objectContaining({ visitId: 41, description: "ค่าตรวจแพทย์", detail: "ตรวจติดตาม", quantity: 1, unitPriceSatang: 5000 }));

    await act(async () => { findButton(container, "ออกใบเรียกเก็บ")?.click(); });
    expect(cashierApi.issueInvoiceRun).toHaveBeenCalledWith(expect.objectContaining({ visitId: 41 }));
    expect(container.textContent).toContain("ออกใบเรียกเก็บ INV-00000088 แล้ว โปรดรับชำระเพื่อปิดงาน");
  });

  it("shows medication and service charge lines separately and sends the exact invoice total to payment", async () => {
    cashierApi.detailQuery.mockReturnValue({ data: billedDetail, isLoading: false });
    await act(async () => { root.render(<Cashier />); });

    expect(container.textContent).toContain("ค่ายา");
    expect(container.textContent).toContain("ค่าบริการ");
    expect(container.textContent).toContain("ยอดรับชำระ");
    await act(async () => { findButton(container, "รับชำระ")?.click(); });
    expect(cashierApi.receivePaymentRun).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 88, amountSatang: 7500, paymentMethod: "CASH" }));
    expect(container.textContent).toContain("รับชำระแล้ว และปิดงานเรียบร้อย");
  });
});
