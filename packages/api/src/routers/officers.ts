import { officer } from "@dcsp-letter-management/db/schema/letters";
import { divisionCodeSchema } from "@dcsp-letter-management/domain/division";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, staffProcedure, subjectOfficerProcedure } from "../index";
import { newId } from "../lib/ids";

export const officersRouter = {
  /**
   * Full roster for DCS/Subject Officer dashboards (roster management,
   * DCS's New Letter form) — includes inactive officers so history stays
   * legible (APP_FLOW.md §7).
   */
  list: staffProcedure
    .input(z.object({ division: divisionCodeSchema.optional() }).optional())
    .handler(async ({ context, input }) => {
      return context.db.query.officer.findMany({
        where: input?.division ? eq(officer.division, input.division) : undefined,
        orderBy: [asc(officer.name)],
      });
    }),

  /**
   * Active-only, minimal-field roster for the public "Relevant Officer"
   * pickers (DCS/Subject Officer new-letter forms, and the Relevant
   * Officer's own "reassign to" list on their unauthenticated link page).
   */
  listActive: publicProcedure.input(z.object({ division: divisionCodeSchema })).handler(async ({ context, input }) => {
    const officers = await context.db.query.officer.findMany({
      where: and(eq(officer.division, input.division), eq(officer.active, true)),
      orderBy: [asc(officer.name)],
      columns: { id: true, name: true, position: true, division: true },
    });
    return officers;
  }),

  create: subjectOfficerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.email(),
        position: z.string().min(1),
        division: divisionCodeSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const [created] = await context.db
        .insert(officer)
        .values({ id: newId(), ...input })
        .returning();
      return created;
    }),

  remove: subjectOfficerProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(officer)
      .set({ active: false })
      .where(eq(officer.id, input.id))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND");
    }
    return updated;
  }),
};
