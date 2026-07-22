import type { UserRole } from "@dcsp-letter-management/domain/roles";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

function requireRole(...roles: UserRole[]) {
  return protectedProcedure.use(async ({ context, next }) => {
    const role = context.session.user.role as UserRole | null | undefined;
    if (!role || !roles.includes(role)) {
      throw new ORPCError("FORBIDDEN");
    }
    return next({ context: { role } });
  });
}

/** DCS only ("Admin" in the UI — APP_FLOW.md §1). */
export const dcsProcedure = requireRole("dcs");

/** The Subject Officer's own dashboard (APP_FLOW.md §4, §7). */
export const subjectOfficerProcedure = requireRole("subjectOfficer");

/** Either logged-in staff role — used by read endpoints both dashboards share. */
export const staffProcedure = requireRole("dcs", "subjectOfficer");
