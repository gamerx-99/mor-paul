import type { AuditContext } from "./db";

export interface AuditSpec {
  actor: { userId: number; role: AuditContext["actorRole"] };
  action: string;
  entityType: string;
  requestId?: string;
}

export async function withAudit<TInput, TOutput extends { id: number | string }>(
  spec: AuditSpec & { input?: TInput },
  handler: (input: TInput) => Promise<TOutput>,
  recordEvent: (ctx: {
    actorUserId: number;
    actorRole: AuditContext["actorRole"];
    action: string;
    entityType: string;
    entityId: string;
    outcome: string;
    requestId: string;
    metadata?: string;
  }) => Promise<void>,
): Promise<TOutput> {
  const result = await handler((spec as { input: TInput }).input);
  await recordEvent({
    actorUserId: spec.actor.userId,
    actorRole: spec.actor.role,
    action: spec.action,
    entityType: spec.entityType,
    entityId: String(result.id),
    outcome: "SUCCESS",
    requestId: spec.requestId ?? crypto.randomUUID(),
    // NOTE: input payload intentionally omitted — PHI protection
  });
  return result;
}
