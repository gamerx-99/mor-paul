import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

function roleProcedure(role: "DOCTOR" | "ASSISTANT") {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (!ctx.user || ctx.user.role !== role) {
        throw new TRPCError({ code: "FORBIDDEN", message: "บทบาทนี้ไม่มีสิทธิ์ทำรายการนี้" });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );
}

/** PHI-facing workflow procedures intentionally exclude SYSTEM_ADMIN. */
export const assistantProcedure = roleProcedure("ASSISTANT");
export const doctorProcedure = roleProcedure("DOCTOR");

/** Read-only PHI workflow access is limited to clinical staff, never platform administrators. */
export const clinicalReadProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role === "SYSTEM_ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "ผู้ดูแลระบบไม่มีสิทธิ์เข้าถึงข้อมูลผู้รับบริการ" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

/** Medication catalog is operational master data, not PHI; every signed-in role may read it. */
export const medicationCatalogReadProcedure = protectedProcedure;

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'SYSTEM_ADMIN') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
