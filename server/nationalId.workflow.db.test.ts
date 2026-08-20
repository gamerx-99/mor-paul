import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidThaiNationalId, maskThaiNationalId, normalizeThaiNationalId } from "../shared/nationalId";

const drizzleFactory = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/mysql2", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm/mysql2")>("drizzle-orm/mysql2");
  return { ...actual, drizzle: drizzleFactory };
});

import { recordPatientNationalId } from "./db";

const selectResults: unknown[][] = [];
const updateCalls: Array<Record<string, unknown>> = [];
const auditEvents: Array<Record<string, unknown>> = [];

function queryFor(result: unknown[]) {
  const query: {
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: PromiseLike<unknown[]>["then"];
  } = {
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  return query;
}

const tx = {
  select: vi.fn(() => ({ from: vi.fn(() => queryFor(selectResults.shift() ?? [])) })),
  update: vi.fn(() => ({ set: vi.fn((values: Record<string, unknown>) => ({ where: vi.fn(async () => {
    updateCalls.push(values);
    return [{ affectedRows: 1 }];
  }) })) })),
  insert: vi.fn(() => ({ values: vi.fn(async (values: Record<string, unknown>) => {
    auditEvents.push(values);
    return [{ insertId: 1 }];
  }) })),
};

const db = { transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };
const audit = { actorUserId: 12, actorRole: "ASSISTANT" as const, requestId: "national-id-request" };

describe("national ID write-once workflow", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://national-id-test";
    drizzleFactory.mockReturnValue(db);
    selectResults.splice(0);
    updateCalls.splice(0);
    auditEvents.splice(0);
    vi.clearAllMocks();
    drizzleFactory.mockReturnValue(db);
  });

  it("validates Thai national-ID checksum and applies the 2+3 masked display format", () => {
    expect(normalizeThaiNationalId("1-1007-00200-10-7")).toBe("1100700200107");
    expect(isValidThaiNationalId("1-1007-00200-10-7")).toBe(true);
    expect(isValidThaiNationalId("1100700200108")).toBe(false);
    expect(maskThaiNationalId("1100700200107")).toBe("11••••••••107");
  });

  it("encrypts and records a national ID once, returning only its masked value", async () => {
    selectResults.push([{ id: 7, nationalIdCiphertext: null }]);

    const result = await recordPatientNationalId({ patientId: 7, nationalId: "1100700200107", source: "ASSISTANT_ENTRY" }, audit);

    expect(result).toEqual({ isSet: true, nationalIdMasked: "11••••••••107" });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual(expect.objectContaining({
      nationalIdCiphertext: expect.any(String),
      nationalIdLookupHash: expect.any(String),
      nationalIdSetBy: 12,
    }));
    expect(JSON.stringify(updateCalls)).not.toContain("1100700200107");
    expect(auditEvents[0]).toEqual(expect.objectContaining({ action: "PATIENT_NATIONAL_ID_RECORDED" }));
    expect(JSON.stringify(auditEvents)).not.toContain("1100700200107");
  });

  it("refuses a second write before issuing an update or audit event", async () => {
    selectResults.push([{ id: 7, nationalIdCiphertext: "already-encrypted" }]);

    await expect(recordPatientNationalId({ patientId: 7, nationalId: "1100700200107", source: "ASSISTANT_ENTRY" }, audit)).rejects.toThrow("NATIONAL_ID_WRITE_ONCE");
    expect(updateCalls).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });
});
