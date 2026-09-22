import { createAuth } from "@dcsp-letter-management/auth";
import { user } from "@dcsp-letter-management/db/schema/auth";
import { MIN_PASSWORD_LENGTH, OFFICER_ROLES } from "@dcsp-letter-management/domain/roles";
import { ORPCError } from "@orpc/server";
import { asc, inArray, eq } from "drizzle-orm";
import { z } from "zod";

import { dcsProcedure } from "../index";

export const subjectOfficersRouter = {
  /**
   * Every officer account (Subject Officer or Administrative Officer) — for
   * DCS's "Subject Officers" management page. DCS's "New Letter" picker also
   * calls this, but filters the result down to Subject Officer accounts only
   * client-side, since a letter's target officer must be a Subject Officer
   * specifically (APP_FLOW.md §3).
   */
  list: dcsProcedure.handler(async ({ context }) => {
    return context.db.query.user.findMany({
      where: inArray(user.role, OFFICER_ROLES),
      orderBy: [asc(user.name)],
      columns: { id: true, name: true, email: true, role: true },
    });
  }),

  /**
   * DCS provisions a brand-new officer login (APP_FLOW.md §1) — there's no
   * public sign-up, so this is the only way a second (or third, ...) Subject
   * Officer or Administrative Officer account comes into existence. Sets
   * `role` afterwards since better-auth's own sign-up API won't accept it
   * directly (`input: false`).
   */
  create: dcsProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.email(),
        password: z.string().min(MIN_PASSWORD_LENGTH),
        role: z.enum(OFFICER_ROLES),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await context.db.query.user.findFirst({ where: eq(user.email, input.email) });
      if (existing) {
        throw new ORPCError("BAD_REQUEST", { message: "An account with this email already exists." });
      }

      const { user: created } = await createAuth().api.signUpEmail({
        body: { name: input.name, email: input.email, password: input.password },
      });
      await context.db.update(user).set({ role: input.role }).where(eq(user.id, created.id));

      return { id: created.id, name: created.name, email: created.email, role: input.role };
    }),

  /**
   * DCS reassigns an existing officer account's profile (Subject Officer ⇄
   * Administrative Officer) after it was created — e.g. correcting a mistake
   * made at creation time (APP_FLOW.md §1).
   */
  updateRole: dcsProcedure
    .input(
      z.object({
        id: z.string().min(1),
        role: z.enum(OFFICER_ROLES),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await context.db.query.user.findFirst({ where: eq(user.id, input.id) });
      if (!existing || !OFFICER_ROLES.includes(existing.role as (typeof OFFICER_ROLES)[number])) {
        throw new ORPCError("NOT_FOUND", { message: "Officer account not found." });
      }

      await context.db.update(user).set({ role: input.role }).where(eq(user.id, input.id));

      return { id: existing.id, name: existing.name, email: existing.email, role: input.role };
    }),
};
