import { createAuth } from "@dcsp-letter-management/auth";
import { user } from "@dcsp-letter-management/db/schema/auth";
import { MIN_PASSWORD_LENGTH } from "@dcsp-letter-management/domain/roles";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { dcsProcedure } from "../index";

export const subjectOfficersRouter = {
  /** Every Subject Officer account, for DCS's "New Letter" picker and roster page. */
  list: dcsProcedure.handler(async ({ context }) => {
    return context.db.query.user.findMany({
      where: eq(user.role, "subjectOfficer"),
      orderBy: [asc(user.name)],
      columns: { id: true, name: true, email: true },
    });
  }),

  /**
   * DCS provisions a brand-new Subject Officer login (APP_FLOW.md §1) — there's
   * no public sign-up, so this is the only way a second (or third, ...) Subject
   * Officer account comes into existence. Sets `role` afterwards since
   * better-auth's own sign-up API won't accept it directly (`input: false`).
   */
  create: dcsProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.email(),
        password: z.string().min(MIN_PASSWORD_LENGTH),
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
      await context.db.update(user).set({ role: "subjectOfficer" }).where(eq(user.id, created.id));

      return { id: created.id, name: created.name, email: created.email };
    }),
};
