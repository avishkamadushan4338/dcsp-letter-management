import { appConfig } from "@dcsp-letter-management/db/schema/letters";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dcsProcedure, staffProcedure } from "../index";

const SINGLETON_ID = "singleton";

export const settingsRouter = {
  /** Whoever "the" Subject Officer currently is (APP_FLOW.md §6). Read by both dashboards. */
  getCurrentSubjectOfficer: staffProcedure.handler(async ({ context }) => {
    const config = await context.db.query.appConfig.findFirst({
      where: eq(appConfig.id, SINGLETON_ID),
      with: { currentSubjectOfficer: true },
    });
    return config?.currentSubjectOfficer ?? null;
  }),

  /** Candidate users DCS can designate as the Subject Officer. */
  listSubjectOfficerCandidates: dcsProcedure.handler(async ({ context }) => {
    return context.db.query.user.findMany({
      where: (userTable, { eq: eqCol }) => eqCol(userTable.role, "subjectOfficer"),
    });
  }),

  /**
   * DCS can change who "the" Subject Officer is at any time — only affects
   * letters created after the change (APP_FLOW.md §6).
   */
  setCurrentSubjectOfficer: dcsProcedure.input(z.object({ userId: z.string() })).handler(async ({ context, input }) => {
    await context.db
      .insert(appConfig)
      .values({ id: SINGLETON_ID, currentSubjectOfficerId: input.userId })
      .onConflictDoUpdate({
        target: appConfig.id,
        set: { currentSubjectOfficerId: input.userId },
      });

    return context.db.query.user.findFirst({ where: (userTable, { eq: eqCol }) => eqCol(userTable.id, input.userId) });
  }),
};
