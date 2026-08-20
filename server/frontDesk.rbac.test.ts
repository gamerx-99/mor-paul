import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function contextFor(role: AuthenticatedUser["role"]): TrpcContext {
  const user: AuthenticatedUser = {
    id: 99,
    username: "policy-test-user",
    passwordHash: "scrypt$131072$8$1$salt$hash",
    displayName: "Policy Test",
    role,
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("Front Desk RBAC", () => {
  it("denies every PHI-facing Front Desk path to SYSTEM_ADMIN before a database call", async () => {
    const caller = appRouter.createCaller(contextFor("SYSTEM_ADMIN"));

    await expect(caller.frontDesk.searchPatients({ query: "query" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.frontDesk.listQueue({ queueDate: "2026-08-20" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.frontDesk.checkDuplicates({ firstName: "Test", lastName: "Policy" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.frontDesk.registerPatient({ firstName: "Test", lastName: "Policy", dateOfBirth: "1990-01-01", gender: "UNSPECIFIED", consentAccepted: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.frontDesk.nationalIdStatus({ patientId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.frontDesk.recordNationalId({ patientId: 1, nationalId: "1100700200104", source: "ASSISTANT_ENTRY" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies the doctor-only queue action to ASSISTANT", async () => {
    const caller = appRouter.createCaller(contextFor("ASSISTANT"));
    await expect(caller.frontDesk.callNext({ queueDate: "2026-08-20" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies triage mutation to DOCTOR", async () => {
    const caller = appRouter.createCaller(contextFor("DOCTOR"));
    await expect(caller.frontDesk.recordTriage({ visitId: 1, urgency: "ROUTINE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
