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
  getPatientClinicalHistory: vi.fn(),
  saveClinicalDraft: vi.fn(),
  signClinicalEncounter: vi.fn(),
  listClinicalPresets: vi.fn(),
  createClinicalPreset: vi.fn(),
  deleteClinicalPreset: vi.fn(),
  listStaffAccounts: vi.fn(),
  createStaffAccount: vi.fn(),
  setStaffAccountActive: vi.fn(),
  updateStaffRole: vi.fn(),
  listSoapTemplates: vi.fn(),
  createSoapTemplate: vi.fn(),
  updateSoapTemplate: vi.fn(),
  deactivateSoapTemplate: vi.fn(),
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
      await expect(callerFor(user).doctorConsole.getPatientHistory({ patientId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.getDoctorConsultation).not.toHaveBeenCalled();
    expect(database.getPatientClinicalHistory).not.toHaveBeenCalled();
  });

  it("permits a doctor to access patient clinical history", async () => {
    database.getPatientClinicalHistory.mockResolvedValue({ patient: { id: 1, hn: "HN00000001" }, visits: [] });
    await expect(callerFor(doctor).doctorConsole.getPatientHistory({ patientId: 1 })).resolves.toMatchObject({
      patient: { id: 1 },
      visits: [],
    });
    expect(database.getPatientClinicalHistory).toHaveBeenCalledWith(1);
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

  it("denies non-doctors from managing clinical presets", async () => {
    for (const user of [assistant, admin]) {
      await expect(callerFor(user).doctorConsole.listPresets()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).doctorConsole.createPreset({ name: "ชุดหวัด", diagnoses: [], medications: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).doctorConsole.deletePreset({ presetId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("allows doctors to list, create and delete clinical presets", async () => {
    database.listClinicalPresets.mockResolvedValue([{ id: 1, name: "ชุดไข้หวัด", diagnoses: [], medications: [] }]);
    database.createClinicalPreset.mockResolvedValue({ id: 2, name: "ชุดแผลสด" });
    database.deleteClinicalPreset.mockResolvedValue({ id: 1, success: true });

    await expect(callerFor(doctor).doctorConsole.listPresets()).resolves.toEqual([{ id: 1, name: "ชุดไข้หวัด", diagnoses: [], medications: [] }]);
    await expect(callerFor(doctor).doctorConsole.createPreset({ name: "ชุดแผลสด", diagnoses: [], medications: [] })).resolves.toEqual({ id: 2, name: "ชุดแผลสด" });
    await expect(callerFor(doctor).doctorConsole.deletePreset({ presetId: 1 })).resolves.toEqual({ id: 1, success: true });
  });

  it("denies non-doctors from reading or managing SOAP templates", async () => {
    for (const user of [assistant, admin]) {
      await expect(callerFor(user).doctorConsole.listSoapTemplates({ serviceType: "general" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).doctorConsole.createSoapTemplate({
        serviceType: "general",
        name: "Common cold",
        subjectiveTemplate: "CC: ___",
        objectiveTemplate: "PE: ___",
        assessmentTemplate: "Dx: ___",
        planTemplate: "Rx: ___",
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).doctorConsole.updateSoapTemplate({ id: 1, name: "Updated" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).doctorConsole.deactivateSoapTemplate({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.listSoapTemplates).not.toHaveBeenCalled();
    expect(database.createSoapTemplate).not.toHaveBeenCalled();
    expect(database.updateSoapTemplate).not.toHaveBeenCalled();
    expect(database.deactivateSoapTemplate).not.toHaveBeenCalled();
  });

  it("allows a doctor to list active templates filtered by service type", async () => {
    database.listSoapTemplates.mockResolvedValue([{ id: 1, serviceType: "general", name: "Common cold" }]);
    await expect(callerFor(doctor).doctorConsole.listSoapTemplates({ serviceType: "general" })).resolves.toEqual([
      { id: 1, serviceType: "general", name: "Common cold" },
    ]);
    expect(database.listSoapTemplates).toHaveBeenCalledWith({ serviceType: "general" });
  });

  it("allows a doctor to create a SOAP template with audit context and no PHI in the payload", async () => {
    database.createSoapTemplate.mockResolvedValue({ id: 5 });
    const input = {
      serviceType: "general" as const,
      name: "Common cold",
      subjectiveTemplate: "CC: ___\nHPI: ___",
      objectiveTemplate: "Vitals: ___",
      assessmentTemplate: "Dx: ___",
      planTemplate: "Rx: ___",
    };
    await expect(callerFor(doctor).doctorConsole.createSoapTemplate(input)).resolves.toEqual({ id: 5 });
    expect(database.createSoapTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, createdBy: doctor.id }),
      expect.objectContaining({ actorUserId: doctor.id, actorRole: "DOCTOR" }),
    );
  });

  it("allows a doctor to update and deactivate a SOAP template", async () => {
    database.updateSoapTemplate.mockResolvedValue({ id: 5 });
    database.deactivateSoapTemplate.mockResolvedValue({ id: 5 });

    await expect(callerFor(doctor).doctorConsole.updateSoapTemplate({ id: 5, name: "Updated name" })).resolves.toEqual({ id: 5 });
    expect(database.updateSoapTemplate).toHaveBeenCalledWith(5, { name: "Updated name" }, expect.objectContaining({ actorUserId: doctor.id }));

    await expect(callerFor(doctor).doctorConsole.deactivateSoapTemplate({ id: 5 })).resolves.toEqual({ id: 5 });
    expect(database.deactivateSoapTemplate).toHaveBeenCalledWith(5, expect.objectContaining({ actorUserId: doctor.id }));
  });
});

