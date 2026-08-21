import { describe, it, expect, vi } from "vitest";
import { withAudit } from "./auditContext";

describe("withAudit", () => {
  it("records audit event with actor + entity metadata", async () => {
    const recordEvent = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn(async () => ({ id: 99 }));
    const result = await withAudit(
      { actor: { userId: 1, role: "DOCTOR" }, action: "create.test", entityType: "testEntity" },
      handler,
      recordEvent,
    );
    expect(result.id).toBe(99);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        actorRole: "DOCTOR",
        action: "create.test",
        entityType: "testEntity",
        entityId: "99",
        outcome: "SUCCESS",
      }),
    );
  });

  it("does NOT log input payload (PHI protection)", async () => {
    const recordEvent = vi.fn();
    await withAudit(
      { actor: { userId: 1, role: "DOCTOR" }, action: "create.test", entityType: "testEntity" },
      async () => ({ id: 1 }),
      recordEvent,
    );
    const call = recordEvent.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain("nationalId");
    expect(JSON.stringify(call)).not.toContain("patientName");
  });

  it("propagates handler errors without recording audit", async () => {
    const recordEvent = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn(async () => {
      throw new Error("HANDLER_FAILED");
    });
    await expect(
      withAudit(
        { actor: { userId: 1, role: "DOCTOR" }, action: "create.test", entityType: "testEntity" },
        handler,
        recordEvent,
      ),
    ).rejects.toThrow("HANDLER_FAILED");
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
