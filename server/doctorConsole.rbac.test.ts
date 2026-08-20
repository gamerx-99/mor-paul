import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  countUsers: vi.fn(),
  createInitialAdmin: vi.fn(),
  createSession: vi.fn(),
  findUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  revokeSession: vi.fn(),
  getDoctorConsultation: vi.fn(),
  saveClinicalDraft: vi.fn(),
  signClinicalEncounter: vi.fn(),
  listStaffAccounts: vi.fn(),
  createStaffAccount: vi.fn(),
  setStaffAccountActive: vi.fn(),
  updateStaffRole: vi.fn(),
}));

vi.mock("./db", () => database);

import { appRouter } from "./routers";

const doctor = { id: 11, username: "doctor", role: "DOCTOR" as const };
const assistant = { id: 12, username: "assistant", role: "ASSISTANT" as const };
const admin = { id: 13, username: "admin", role: "SYSTEM_ADMIN" as const };

function callerFor(user: typeof doctor | typeof assistant | typeof admin) {
  return appRouter.createCaller({ user, req: { secure: true, headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as never);
}

describe("doctor console RBAC", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies assistants and system administrators before a clinical read executes", async () => {
    for (const user of [assistant, admin]) {
      await expect(callerFor(user).doctorConsole.getConsultation({ visitId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.getDoctorConsultation).not.toHaveBeenCalled();
  });

  it("denies non-doctors before any clinical draft mutation executes", async () => {
    const input = { visitId: 1, expectedRevision: 0, subjective: null, objective: null, assessment: null, plan: null };
    for (const user of [assistant, admin]) {
      await expect(callerFor(user).doctorConsole.saveDraft(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.saveClinicalDraft).not.toHaveBeenCalled();
  });

  it("permits a doctor to access only the backend-selected consultation", async () => {
    database.getDoctorConsultation.mockResolvedValue({ visitId: 1, note: null, diagnoses: [] });
    await expect(callerFor(doctor).doctorConsole.getConsultation({ visitId: 1 })).resolves.toMatchObject({ visitId: 1 });
    expect(database.getDoctorConsultation).toHaveBeenCalledWith(1, doctor.id);
  });

  it("forwards a signed encounter without medication to the billing workflow rather than a closed visit", async () => {
    const input = {
      visitId: 31,
      expectedRevision: 0,
      expectedVisitVersion: 1,
      subjective: "ไม่มีรายการยา",
      objective: "",
      assessment: "",
      plan: "",
      diagnoses: [{ code: "CLINICAL-001", display: "วินิจฉัยตามการประเมิน" }],
      medications: [],
    };
    database.signClinicalEncounter.mockResolvedValue({ visitId: 31, visitStatus: "DISPENSING", medicationOrderId: null });

    await expect(callerFor(doctor).doctorConsole.signEncounter(input)).resolves.toMatchObject({ visitId: 31, visitStatus: "DISPENSING", medicationOrderId: null });
    expect(database.signClinicalEncounter).toHaveBeenCalledWith(expect.objectContaining({
      visitId: input.visitId,
      subjective: input.subjective,
      objective: null,
      assessment: null,
      plan: null,
      diagnoses: input.diagnoses,
      medications: [],
    }), doctor.id, expect.objectContaining({ actorUserId: doctor.id, actorRole: "DOCTOR" }));
  });
});
