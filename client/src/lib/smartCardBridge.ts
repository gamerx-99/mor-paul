export type SmartCardReadResult = { nationalId: string };

declare global {
  interface Window {
    clinicSmartCardBridge?: {
      readNationalId: () => Promise<SmartCardReadResult>;
    };
  }
}

/**
 * The browser cannot access Thai Smart Card readers directly. A clinic-managed
 * local bridge may expose this minimal, consented API; it must return only the
 * national ID needed by this form and must never expose card images or files.
 */
export async function readNationalIdFromLocalSmartCardBridge() {
  if (typeof window === "undefined" || !window.clinicSmartCardBridge) {
    throw new Error("SMART_CARD_BRIDGE_UNAVAILABLE");
  }
  const result = await window.clinicSmartCardBridge.readNationalId();
  return result.nationalId;
}
