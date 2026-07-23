import { appConfig, letter, letterLink, letterReassignment, letterRelevantOfficer, officer } from "@dcsp-letter-management/db/schema/letters";
import { divisionCodeSchema, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { letterStatusSchema } from "@dcsp-letter-management/domain/letter-status";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, ne, or } from "drizzle-orm";
import { z } from "zod";

import { dcsProcedure, staffProcedure, subjectOfficerProcedure } from "../index";
import { newId } from "../lib/ids";
import { issueLetterLink } from "../lib/letter-links";
import { previewNextLetterNumber, reserveNextLetterNumber } from "../lib/letter-number";

const SINGLETON_ID = "singleton";

/**
 * Confirms every requested officer is active, no id is repeated, and — when
 * `division` is given — all belong to it. When `division` is omitted (DCS
 * reviewing a "sent via DCS" letter, APP_FLOW.md §4 Option B, which has no
 * division of its own yet), the officers are instead required to all share
 * one division among themselves, which becomes the letter's division.
 */
async function requireActiveOfficers(db: Parameters<typeof issueLetterLink>[0], officerIds: string[], division?: DivisionCode) {
  if (officerIds.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "Pick at least one Relevant Officer." });
  }
  if (new Set(officerIds).size !== officerIds.length) {
    throw new ORPCError("BAD_REQUEST", { message: "The same officer was picked more than once." });
  }

  const conditions = [inArray(officer.id, officerIds), eq(officer.active, true)];
  if (division) {
    conditions.push(eq(officer.division, division));
  }
  const found = await db.query.officer.findMany({ where: and(...conditions) });
  if (found.length !== officerIds.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: division ? "One or more officers aren't active in this division." : "One or more officers aren't active.",
    });
  }

  const divisions = new Set(found.map((one) => one.division));
  if (divisions.size > 1) {
    throw new ORPCError("BAD_REQUEST", { message: "All Relevant Officers on a letter must be from the same division." });
  }

  return { officers: found, division: found[0]!.division };
}

/**
 * Inserts one independent assignment row per Relevant Officer and emails each
 * their own link (APP_FLOW.md §1, §5) — each officer acts entirely on their
 * own from here on.
 */
async function assignRelevantOfficers(
  db: Parameters<typeof issueLetterLink>[0],
  officers: { id: string; email: string }[],
  params: { letterId: string; referenceNumber: string; subject: string; fromWhom: string; division: DivisionCode },
) {
  for (const one of officers) {
    const [assignment] = await db
      .insert(letterRelevantOfficer)
      .values({ id: newId(), letterId: params.letterId, officerId: one.id })
      .returning();
    if (!assignment) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    await issueLetterLink(db, {
      letterId: params.letterId,
      role: "relevantOfficer",
      to: one.email,
      referenceNumber: params.referenceNumber,
      subject: params.subject,
      fromWhom: params.fromWhom,
      division: params.division,
      letterRelevantOfficerId: assignment.id,
    });
  }
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
  previewNextNumber: staffProcedure.handler(async ({ context }) => {
    return previewNextLetterNumber(context.db);
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
          with: { relevantOfficers: { with: { officer: true } }, subjectOfficer: true },
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
        relevantOfficers: { with: { officer: true } },
        subjectOfficer: true,
        reassignments: {
          with: { fromOfficer: true, toOfficer: true },
          orderBy: [desc(letterReassignment.createdAt)],
        },
        links: {
          columns: { id: true, role: true, invalidatedAt: true, createdAt: true },
          with: { relevantOfficerAssignment: { with: { officer: { columns: { name: true } } } } },
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
        relevantOfficerIds: z.array(z.string()).min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const config = await context.db.query.appConfig.findFirst({ where: eq(appConfig.id, SINGLETON_ID) });
      if (!config?.currentSubjectOfficerId) {
        throw new ORPCError("BAD_REQUEST", { message: "Set a Subject Officer before creating letters." });
      }
      const { officers: relevantOfficers } = await requireActiveOfficers(context.db, input.relevantOfficerIds, input.division);
      const subjectOfficer = await context.db.query.user.findFirst({
        where: (userTable, { eq: eqCol }) => eqCol(userTable.id, config.currentSubjectOfficerId as string),
      });
      if (!subjectOfficer) {
        throw new ORPCError("BAD_REQUEST", { message: "The current Subject Officer account no longer exists." });
      }

      const { number, referenceNumber } = await reserveNextLetterNumber(context.db);

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
        division: input.division,
      });
      await assignRelevantOfficers(context.db, relevantOfficers, {
        letterId: created.id,
        referenceNumber,
        subject: created.subject,
        fromWhom: created.fromWhom,
        division: input.division,
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
        relevantOfficerIds: z.array(z.string()).min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const { officers: relevantOfficers } = await requireActiveOfficers(context.db, input.relevantOfficerIds, input.division);
      const { number, referenceNumber } = await reserveNextLetterNumber(context.db);
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
          subjectReceivedAt: now,
          subjectForwardedAt: now,
        })
        .returning();

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      await assignRelevantOfficers(context.db, relevantOfficers, {
        letterId: created.id,
        referenceNumber,
        subject: created.subject,
        fromWhom: created.fromWhom,
        division: input.division,
      });

      return created;
    }),

  /**
   * Flow 2, Option B (APP_FLOW.md §4): Subject Officer sends via DCS review.
   * No division is picked here — they don't know who should handle it, so
   * there's nothing to scope a division to yet. DCS derives it from whichever
   * Relevant Officer they assign on review.
   */
  createBySubjectOfficerPending: subjectOfficerProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        fromWhom: z.string().min(1),
        receivedDate: z.coerce.date(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { number, referenceNumber } = await reserveNextLetterNumber(context.db);

      const [created] = await context.db
        .insert(letter)
        .values({
          id: newId(),
          referenceNumber,
          number,
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

  /**
   * DCS assigns Relevant Officer(s) to a Flow-2-Option-B letter (APP_FLOW.md
   * §4) — picked from the full roster since the letter has no division yet;
   * the letter's division is then set to match theirs (they must all share
   * one — enforced by `requireActiveOfficers`).
   */
  review: dcsProcedure
    .input(z.object({ id: z.string(), relevantOfficerIds: z.array(z.string()).min(1) }))
    .handler(async ({ context, input }) => {
      const found = await context.db.query.letter.findFirst({ where: eq(letter.id, input.id) });
      if (!found) {
        throw new ORPCError("NOT_FOUND");
      }
      if (found.status !== "pending_review") {
        throw new ORPCError("CONFLICT", { message: "This letter has already been reviewed." });
      }

      const { officers: relevantOfficers, division } = await requireActiveOfficers(context.db, input.relevantOfficerIds);
      const subjectOfficer = await context.db.query.user.findFirst({
        where: (userTable, { eq: eqCol }) => eqCol(userTable.id, found.subjectOfficerId),
      });
      if (!subjectOfficer) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const [updated] = await context.db
        .update(letter)
        .set({
          division,
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
        division,
      });
      await assignRelevantOfficers(context.db, relevantOfficers, {
        letterId: updated.id,
        referenceNumber: updated.referenceNumber,
        subject: updated.subject,
        fromWhom: updated.fromWhom,
        division,
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

  /**
   * "Print Numbers" utility (APP_FLOW.md §6): every number issued today.
   * Scoped to letters the caller's own role created — DCS and the Subject Officer each
   * print only their own numbers, so the same slip never gets printed twice.
   */
  printNumbersToday: staffProcedure.handler(async ({ context }) => {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return context.db.query.letter.findMany({
      where: and(gte(letter.createdAt, startOfDay), eq(letter.createdByRole, context.role)),
      with: { relevantOfficers: { with: { officer: true } } },
      orderBy: [asc(letter.division), asc(letter.number)],
    });
  }),

  /**
   * Letters register for the Subject Officer to print and physically sign off on.
   * Excludes anything still `pending_review` — a Subject-Officer-originated letter
   * sent "via DCS" only shows up here once DCS actually reviews it and assigns a
   * Relevant Officer; letters sent directly (by DCS or "Send Directly") appear right away.
   */
  printSummary: subjectOfficerProcedure.handler(async ({ context }) => {
    return context.db.query.letter.findMany({
      where: and(eq(letter.subjectOfficerId, context.session.user.id), ne(letter.status, "pending_review")),
      with: { relevantOfficers: { with: { officer: true } } },
      orderBy: [asc(letter.receivedDate)],
    });
  }),
};
