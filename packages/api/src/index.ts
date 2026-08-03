import { OFFICER_ROLES, type UserRole } from "@dcsp-letter-management/domain/roles";
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

/**
 * Either officer login (Subject Officer or Administrative Officer) — the
 * shared letter-routing workflow both independent profiles perform
 * identically (APP_FLOW.md §4-§5).
 */
export const officerProcedure = requireRole(...OFFICER_ROLES);

/**
 * Subject Officer only — Relevant Officer roster management (APP_FLOW.md
 * §7) is the one capability Administrative Officer does not get.
 */
export const rosterProcedure = requireRole("subjectOfficer");

/** Any logged-in role — used by read endpoints every dashboard shares. */
export const staffProcedure = requireRole("dcs", ...OFFICER_ROLES);
