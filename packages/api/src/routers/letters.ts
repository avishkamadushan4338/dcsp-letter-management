import { appConfig, letter, letterLink, letterReassignment, officer } from "@dcsp-letter-management/db/schema/letters";
import { divisionCodeSchema, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { letterStatusSchema } from "@dcsp-letter-management/domain/letter-status";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, gte, isNull, like, or } from "drizzle-orm";
import { z } from "zod";

import { dcsProcedure, staffProcedure, subjectOfficerProcedure } from "../index";
import { newId } from "../lib/ids";
import { issueLetterLink } from "../lib/letter-links";
import { previewNextLetterNumber, reserveNextLetterNumber } from "../lib/letter-number";

const SINGLETON_ID = "singleton";

async function requireActiveOfficer(db: Parameters<typeof issueLetterLink>[0], officerId: string, division: DivisionCode) {
  const found = await db.query.officer.findFirst({
    where: and(eq(officer.id, officerId), eq(officer.division, division), eq(officer.active, true)),
  });
  if (!found) {
    throw new ORPCError("BAD_REQUEST", { message: "That officer isn't active in this division." });
  }
  return found;
}

/** Loads a letter and confirms the calling Subject Officer actually owns it (mirrors the `get` check). */
async function requireOwnSubjectLetter(db: Parameters<typeof issueLetterLink>[0], letterId: string, subjectOfficerId: string) {
  const found = await db.query.letter.findFirst({ where: eq(letter.id, letterId) });
  if (!found) {
    throw new ORPCError("NOT_FOUND");
  }
  if (found.subjectOfficerId !== subjectOfficerId) {
    throw new ORPCError("FORBIDDEN");
  }
  return found;
}

export const lettersRouter = {
  previewNextNumber: staffProcedure.input(z.object({ division: divisionCodeSchema })).handler(async ({ context, input }) => {
    return previewNextLetterNumber(context.db, input.division);
  }),

  list: staffProcedure
    .input(
      z.object({
        search: z.string().trim().optional(),
        division: divisionCodeSchema.optional(),
        status: letterStatusSchema.optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .handler(async ({ context, input }) => {
      const role = context.role;
      const conditions = [
        role === "dcs" ? undefined : eq(letter.subjectOfficerId, context.session.user.id),
        input.division ? eq(letter.division, input.division) : undefined,
        input.status ? eq(letter.status, input.status) : undefined,
        input.search
          ? or(
              like(letter.referenceNumber, `%${input.search}%`),
              like(letter.subject, `%${input.search}%`),
              like(letter.fromWhom, `%${input.search}%`),
            )
          : undefined,
      ].filter((condition) => condition !== undefined);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalRows] = await Promise.all([
        context.db.query.letter.findMany({
          where,
          with: { relevantOfficer: true, subjectOfficer: true },
          orderBy: [desc(letter.createdAt)],
          limit: input.pageSize,
          offset: (input.page - 1) * input.pageSize,
        }),
        context.db.select({ total: count() }).from(letter).where(where),
      ]);

      return { items, total: totalRows[0]?.total ?? 0, page: input.page, pageSize: input.pageSize };
    }),

  pendingReviewCount: dcsProcedure.handler(async ({ context }) => {
    const [row] = await context.db
      .select({ total: count() })
      .from(letter)
      .where(eq(letter.status, "pending_review"));
    return row?.total ?? 0;
  }),

  get: staffProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const found = await context.db.query.letter.findFirst({
      where: eq(letter.id, input.id),
      with: {
        relevantOfficer: true,
        subjectOfficer: true,
        reassignments: {
          with: { fromOfficer: true, toOfficer: true },
          orderBy: [desc(letterReassignment.createdAt)],
        },
        links: {
          columns: { id: true, role: true, invalidatedAt: true, createdAt: true },
        },
      },
    });

    if (!found) {
      throw new ORPCError("NOT_FOUND");
    }
    if (context.role === "subjectOfficer" && found.subjectOfficerId !== context.session.user.id) {
      throw new ORPCError("FORBIDDEN");
    }
    return found;
  }),

  /** Flow 1 (APP_FLOW.md §3): DCS creates the letter. */
  createByDcs: dcsProcedure
    .input(
      z.object({
        division: divisionCodeSchema,
        subject: z.string().min(1),
        fromWhom: z.string().min(1),
        receivedDate: z.coerce.date(),
        relevantOfficerId: z.string(),
      }),
    )
    .handler(async ({ context, input }) => {
      const config = await context.db.query.appConfig.findFirst({ where: eq(appConfig.id, SINGLETON_ID) });
      if (!config?.currentSubjectOfficerId) {
        throw new ORPCError("BAD_REQUEST", { message: "Set a Subject Officer before creating letters." });
      }
      const relevantOfficer = await requireActiveOfficer(context.db, input.relevantOfficerId, input.division);
      const subjectOfficer = await context.db.query.user.findFirst({
        where: (userTable, { eq: eqCol }) => eqCol(userTable.id, config.currentSubjectOfficerId as string),
      });
      if (!subjectOfficer) {
        throw new ORPCError("BAD_REQUEST", { message: "The current Subject Officer account no longer exists." });
      }

      const { number, referenceNumber } = await reserveNextLetterNumber(context.db, input.division);

      // `created` (APP_FLOW.md §2) is a passing state — DCS submitting the
      // form and it going out to both officers happen in the same request,
      // so it's never actually persisted; the row is written directly as
      // `sent_to_subject`.
      const [created] = await context.db
        .insert(letter)
        .values({
          id: newId(),
          referenceNumber,
          number,
          division: input.division,
          subject: input.subject,
          fromWhom: input.fromWhom,
          receivedDate: input.receivedDate,
          status: "sent_to_subject",
          createdByRole: "dcs",
          subjectOfficerId: subjectOfficer.id,
          relevantOfficerId: relevantOfficer.id,
        })
        .returning();

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      await issueLetterLink(context.db, {
        letterId: created.id,
        role: "subjectOfficer",
        to: subjectOfficer.email,
        referenceNumber,
        subject: created.subject,
        fromWhom: created.fromWhom,
        division: created.division,
      });
      await issueLetterLink(context.db, {
        letterId: created.id,
        role: "relevantOfficer",
        to: relevantOfficer.email,
        referenceNumber,
        subject: created.subject,
        fromWhom: created.fromWhom,
        division: created.division,
      });

      return created;
    }),

  /** Flow 2, Option A (APP_FLOW.md §4): Subject Officer sends directly. */
  createBySubjectOfficerDirect: subjectOfficerProcedure
    .input(
      z.object({
        division: divisionCodeSchema,
        subject: z.string().min(1),
        fromWhom: z.string().min(1),
        receivedDate: z.coerce.date(),
        relevantOfficerId: z.string(),
      }),
    )
    .handler(async ({ context, input }) => {
      const relevantOfficer = await requireActiveOfficer(context.db, input.relevantOfficerId, input.division);
      const { number, referenceNumber } = await reserveNextLetterNumber(context.db, input.division);
      const now = new Date();

      const [created] = await context.db
        .insert(letter)
        .values({
          id: newId(),
          referenceNumber,
          number,
          division: input.division,
          subject: input.subject,
          fromWhom: input.fromWhom,
          receivedDate: input.receivedDate,
          status: "sent_to_relevant",
          createdByRole: "subjectOfficer",
          subjectOfficerId: context.session.user.id,
          relevantOfficerId: relevantOfficer.id,
          subjectReceivedAt: now,
          subjectForwardedAt: now,
        })
        .returning();

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      await issueLetterLink(context.db, {
        letterId: created.id,
        role: "relevantOfficer",
        to: relevantOfficer.email,
        referenceNumber,
        subject: created.subject,
        fromWhom: created.fromWhom,
        division: created.division,
      });

      return created;
    }),

  /** Flow 2, Option B (APP_FLOW.md §4): Subject Officer sends via DCS review. */
  createBySubjectOfficerPending: subjectOfficerProcedure
    .input(
      z.object({
        division: divisionCodeSchema,
        subject: z.string().min(1),
        fromWhom: z.string().min(1),
        receivedDate: z.coerce.date(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { number, referenceNumber } = await reserveNextLetterNumber(context.db, input.division);

      const [created] = await context.db
        .insert(letter)
        .values({
          id: newId(),
          referenceNumber,
          number,
          division: input.division,
          subject: input.subject,
          fromWhom: input.fromWhom,
          receivedDate: input.receivedDate,
          status: "pending_review",
          createdByRole: "subjectOfficer",
          subjectOfficerId: context.session.user.id,
        })
        .returning();

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return created;
    }),

  /** DCS assigns a Relevant Officer to a Flow-2-Option-B letter (APP_FLOW.md §4). */
  review: dcsProcedure
    .input(z.object({ id: z.string(), relevantOfficerId: z.string() }))
    .handler(async ({ context, input }) => {
      const found = await context.db.query.letter.findFirst({ where: eq(letter.id, input.id) });
      if (!found) {
        throw new ORPCError("NOT_FOUND");
      }
      if (found.status !== "pending_review") {
        throw new ORPCError("CONFLICT", { message: "This letter has already been reviewed." });
      }

      const relevantOfficer = await requireActiveOfficer(context.db, input.relevantOfficerId, found.division);
      const subjectOfficer = await context.db.query.user.findFirst({
        where: (userTable, { eq: eqCol }) => eqCol(userTable.id, found.subjectOfficerId),
      });
      if (!subjectOfficer) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const [updated] = await context.db
        .update(letter)
        .set({
          relevantOfficerId: relevantOfficer.id,
          reviewedAt: new Date(),
          status: "sent_to_subject",
        })
        .where(eq(letter.id, input.id))
        .returning();

      if (!updated) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      await issueLetterLink(context.db, {
        letterId: updated.id,
        role: "subjectOfficer",
        to: subjectOfficer.email,
        referenceNumber: updated.referenceNumber,
        subject: updated.subject,
        fromWhom: updated.fromWhom,
        division: updated.division,
      });
      await issueLetterLink(context.db, {
        letterId: updated.id,
        role: "relevantOfficer",
        to: relevantOfficer.email,
        referenceNumber: updated.referenceNumber,
        subject: updated.subject,
        fromWhom: updated.fromWhom,
        division: updated.division,
      });

      return updated;
    }),

  /**
   * Subject Officer's own dashboard equivalent of the emailed link's "Mark
   * Received" action (APP_FLOW.md §5) — lets a logged-in Subject Officer act
   * on their letters without needing the emailed link.
   */
  subjectMarkReceived: subjectOfficerProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const found = await requireOwnSubjectLetter(context.db, input.id, context.session.user.id);
    if (found.status !== "sent_to_subject") {
      throw new ORPCError("CONFLICT", { message: "This letter isn't waiting to be received." });
    }

    const [updated] = await context.db
      .update(letter)
      .set({ subjectReceivedAt: new Date(), status: "with_subject_officer" })
      .where(eq(letter.id, input.id))
      .returning();
    return updated;
  }),

  /** Dashboard equivalent of the emailed link's "Send to Relevant Officer" action (APP_FLOW.md §5). */
  subjectForward: subjectOfficerProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const found = await requireOwnSubjectLetter(context.db, input.id, context.session.user.id);
    if (found.status !== "with_subject_officer") {
      throw new ORPCError("CONFLICT", { message: "Mark it received before forwarding it." });
    }

    const [updated] = await context.db
      .update(letter)
      .set({ subjectForwardedAt: new Date(), status: "sent_to_relevant" })
      .where(eq(letter.id, input.id))
      .returning();

    // Spent — the emailed link for this role becomes unusable now too, same as forwarding via the link itself.
    await context.db
      .update(letterLink)
      .set({ invalidatedAt: new Date() })
      .where(and(eq(letterLink.letterId, input.id), eq(letterLink.role, "subjectOfficer"), isNull(letterLink.invalidatedAt)));

    return updated;
  }),

  /** "Print Numbers" utility (APP_FLOW.md §6): every number issued today. */
  printNumbersToday: dcsProcedure.handler(async ({ context }) => {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return context.db.query.letter.findMany({
      where: gte(letter.createdAt, startOfDay),
      with: { relevantOfficer: true },
      orderBy: [asc(letter.division), asc(letter.number)],
    });
  }),
};
