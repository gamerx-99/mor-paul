// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
const frontDeskApi = vi.hoisted(() => ({
  searchQuery: vi.fn(),
  nationalIdStatusQuery: vi.fn(),
  registerMutation: vi.fn(),
  createVisitMutation: vi.fn(),
  recordNationalIdMutation: vi.fn(),
  checkDuplicates: vi.fn(),
  registerRun: vi.fn(),
  invalidateSearch: vi.fn(),
  invalidateQueue: vi.fn(),
  invalidateNationalIdStatus: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => auth);
vi.mock("@/lib/smartCardBridge", () => ({ readNationalIdFromLocalSmartCardBridge: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/front-desk", frontDeskApi.setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      frontDesk: {
        checkDuplicates: { fetch: frontDeskApi.checkDuplicates },
        searchPatients: { invalidate: frontDeskApi.invalidateSearch },
        listQueue: { invalidate: frontDeskApi.invalidateQueue },
        nationalIdStatus: { invalidate: frontDeskApi.invalidateNationalIdStatus },
      },
    }),
    frontDesk: {
      searchPatients: { useQuery: frontDeskApi.searchQuery },
      registerPatient: { useMutation: frontDeskApi.registerMutation },
      createVisit: { useMutation: frontDeskApi.createVisitMutation },
      nationalIdStatus: { useQuery: frontDeskApi.nationalIdStatusQuery },
      recordNationalId: { useMutation: frontDeskApi.recordNationalIdMutation },
    },
  },
}));

import FrontDesk from "./FrontDesk";

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setChecked(input: HTMLInputElement) {
  input.click();
}

function registrationForm(container: HTMLElement) {
  return Array.from(container.querySelectorAll("form")).find(form => Array.from(form.querySelectorAll("button")).some(button => button.textContent?.includes("บันทึกและสร้าง HN"))) as HTMLFormElement;
}

describe("Front Desk required identity document", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    auth.useAuth.mockReturnValue({ user: { id: 12, role: "ASSISTANT" } });
    frontDeskApi.searchQuery.mockReturnValue({ data: [], isFetching: false });
    frontDeskApi.nationalIdStatusQuery.mockReturnValue({ data: null, isLoading: false });
    frontDeskApi.checkDuplicates.mockResolvedValue([]);
    frontDeskApi.createVisitMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    frontDeskApi.recordNationalIdMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    frontDeskApi.registerMutation.mockImplementation((options: { onSuccess?: (patient: { id: number; hn: string; firstName: string; lastName: string; dateOfBirth: string; gender: "UNSPECIFIED"; phone: null; idDocumentType: "PASSPORT" }) => void | Promise<void> }) => ({
      mutateAsync: async (input: unknown) => {
        frontDeskApi.registerRun(input);
        await options.onSuccess?.({ id: 7, hn: "HN00000007", firstName: "Policy", lastName: "Test", dateOfBirth: "1990-01-01", gender: "UNSPECIFIED", phone: null, idDocumentType: "PASSPORT" });
      },
      isPending: false,
    }));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows a required identity document control and blocks a blank-document submit before duplicate or registration calls", async () => {
    await act(async () => { root.render(<FrontDesk />); });
    expect(container.textContent).toContain("เอกสารยืนยันตัวตน");
    expect(container.textContent).not.toContain("เลขบัตรประชาชน (ไม่บังคับ)");

    const form = registrationForm(container);
    await act(async () => {
      setChecked(form.querySelector('input[type="checkbox"]') as HTMLInputElement);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("กรุณาระบุเลขบัตรประชาชนหรือ Passport ก่อนสร้าง HN");
    expect(frontDeskApi.checkDuplicates).not.toHaveBeenCalled();
    expect(frontDeskApi.registerRun).not.toHaveBeenCalled();
  });

  it("sends the selected Passport type and value to the registration mutation", async () => {
    await act(async () => { root.render(<FrontDesk />); });
    const form = registrationForm(container);
    const selects = form.querySelectorAll("select");
    const inputs = form.querySelectorAll("input");

    await act(async () => {
      setInput(inputs[0] as HTMLInputElement, "Policy");
      setInput(inputs[1] as HTMLInputElement, "Test");
      setInput(inputs[2] as HTMLInputElement, "1990-01-01");
      setSelect(selects[1] as HTMLSelectElement, "PASSPORT");
    });

    const passportInput = Array.from(form.querySelectorAll("label")).find(label => label.textContent?.includes("หมายเลข Passport"))?.querySelector("input") as HTMLInputElement;
    await act(async () => {
      setInput(passportInput, "ab-123456");
      setChecked(form.querySelector('input[type="checkbox"]') as HTMLInputElement);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(frontDeskApi.checkDuplicates).toHaveBeenCalledWith({ firstName: "Policy", lastName: "Test", dateOfBirth: "1990-01-01" });
    expect(frontDeskApi.registerRun).toHaveBeenCalledWith(expect.objectContaining({ idDocumentType: "PASSPORT", idDocumentNumber: "ab-123456", consentAccepted: true }));
  });
});
