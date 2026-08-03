import type { createDb } from "@dcsp-letter-management/db";
import { letter, letterRelevantOfficer } from "@dcsp-letter-management/db/schema/letters";
import { LETTER_STATUSES } from "@dcsp-letter-management/domain/letter-status";
import { and, asc, count, eq, gte, isNotNull, isNull, lte, ne } from "drizzle-orm";

import { dcsProcedure, officerProcedure } from "../index";

type Db = ReturnType<typeof createDb>;

/** A Relevant Officer is considered overdue once this long has passed since assignment without them marking it received. */
const OVERDUE_AFTER_MS = 48 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Every Relevant Officer assignment still unreceived `OVERDUE_AFTER_MS` after
 * it was made — oldest first. When `subjectOfficerId` is given, narrowed down
 * to only the letters that Subject Officer is on (their own dashboard view).
 */
async function findOverdueAssignments(db: Db, subjectOfficerId?: string) {
  const cutoff = new Date(Date.now() - OVERDUE_AFTER_MS);
  const rows = await db.query.letterRelevantOfficer.findMany({
    where: and(isNull(letterRelevantOfficer.receivedAt), lte(letterRelevantOfficer.createdAt, cutoff)),
    with: { officer: true, letter: true },
    orderBy: [asc(letterRelevantOfficer.createdAt)],
  });
  return subjectOfficerId ? rows.filter((row) => row.letter.subjectOfficerId === subjectOfficerId) : rows;
}

export const dashboardRouter = {
  /**
   * Everything the DCS dashboard's headline numbers and breakdown charts
   * need, bundled into one round trip.
   */
  overview: dcsProcedure.handler(async ({ context }) => {
    const now = new Date();
    const startOfToday = startOfUtcDay(now);

    const [
      pendingReviewTotalRow,
      pendingReviewTodayRow,
      actionTakenRow,
      inProgressRow,
      overdueAssignments,
      statusRows,
      divisionRows,
    ] = await Promise.all([
      context.db.select({ total: count() }).from(letter).where(eq(letter.status, "pending_review")),
      context.db
        .select({ total: count() })
        .from(letter)
        .where(and(eq(letter.status, "pending_review"), gte(letter.receivedDate, startOfToday))),
      context.db.select({ total: count() }).from(letter).where(eq(letter.status, "action_taken")),
      context.db.select({ total: count() }).from(letter).where(ne(letter.status, "action_taken")),
      findOverdueAssignments(context.db),
      context.db.select({ status: letter.status, total: count() }).from(letter).groupBy(letter.status),
      context.db
        .select({ division: letter.division, total: count() })
        .from(letter)
        .where(and(ne(letter.status, "action_taken"), isNotNull(letter.division)))
        .groupBy(letter.division),
    ]);

    const overdueLetterIds = new Set(overdueAssignments.map((assignment) => assignment.letterId));

    const statusCounts = new Map(statusRows.map((row) => [row.status, row.total]));

    return {
      reviewQueue: {
        total: pendingReviewTotalRow[0]?.total ?? 0,
        receivedToday: pendingReviewTodayRow[0]?.total ?? 0,
      },
      overdueRelevantOfficer: {
        letters: overdueLetterIds.size,
        assignments: overdueAssignments.length,
      },
      actionTaken: actionTakenRow[0]?.total ?? 0,
      inProgress: inProgressRow[0]?.total ?? 0,
      statusBreakdown: LETTER_STATUSES.map((status) => ({ status, total: statusCounts.get(status) ?? 0 })),
      divisionBreakdown: divisionRows.map((row) => ({
        division: row.division as NonNullable<typeof row.division>,
        total: row.total,
      })),
    };
  }),

  /** The full, actionable list behind the "overdue Relevant Officer" headline number — oldest assignment first. */
  overdueRelevantOfficers: dcsProcedure.handler(async ({ context }) => {
    const overdueAssignments = await findOverdueAssignments(context.db);
    return overdueAssignments.map((assignment) => ({
      id: assignment.id,
      assignedAt: assignment.createdAt,
      officer: { id: assignment.officer.id, name: assignment.officer.name },
      letter: {
        id: assignment.letter.id,
        referenceNumber: assignment.letter.referenceNumber,
        subject: assignment.letter.subject,
        fromWhom: assignment.letter.fromWhom,
        division: assignment.letter.division,
      },
    }));
  }),

  /**
   * The Subject Officer's own dashboard headline numbers (APP_FLOW.md §2,
   * §4-§5), scoped to only the letters where they're the Subject Officer of
   * record:
   *  - `pendingReview` — letters they sent "via DCS" (Flow 2, Option B) that
   *    DCS hasn't reviewed yet.
   *  - `awaitingReceipt` — DCS (or Flow 2, Option B review) has sent the
   *    letter out; waiting on the Subject Officer to click "Mark Received."
   *  - `awaitingForward` — received, waiting on them to send it on to the
   *    Relevant Officer.
   *  - `overdueRelevantOfficer` — of the letters they forwarded, how many
   *    Relevant Officer pickups are still outstanding 48h+ later.
   */
  subjectOfficerOverview: officerProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const now = new Date();
    const startOfToday = startOfUtcDay(now);
    const mine = eq(letter.subjectOfficerId, userId);

    const [
      pendingReviewRow,
      awaitingReceiptRow,
      awaitingReceiptTodayRow,
      awaitingForwardRow,
      overdueAssignments,
      statusRows,
    ] = await Promise.all([
      context.db.select({ total: count() }).from(letter).where(and(mine, eq(letter.status, "pending_review"))),
      context.db.select({ total: count() }).from(letter).where(and(mine, eq(letter.status, "sent_to_subject"))),
      context.db
        .select({ total: count() })
        .from(letter)
        .where(and(mine, eq(letter.status, "sent_to_subject"), gte(letter.receivedDate, startOfToday))),
      context.db.select({ total: count() }).from(letter).where(and(mine, eq(letter.status, "with_subject_officer"))),
      findOverdueAssignments(context.db, userId),
      context.db.select({ status: letter.status, total: count() }).from(letter).where(mine).groupBy(letter.status),
    ]);

    const overdueLetterIds = new Set(overdueAssignments.map((assignment) => assignment.letterId));
    const statusCounts = new Map(statusRows.map((row) => [row.status, row.total]));

    return {
      pendingReview: { total: pendingReviewRow[0]?.total ?? 0 },
      awaitingReceipt: { total: awaitingReceiptRow[0]?.total ?? 0, receivedToday: awaitingReceiptTodayRow[0]?.total ?? 0 },
      awaitingForward: { total: awaitingForwardRow[0]?.total ?? 0 },
      overdueRelevantOfficer: {
        letters: overdueLetterIds.size,
        assignments: overdueAssignments.length,
      },
      statusBreakdown: LETTER_STATUSES.map((status) => ({ status, total: statusCounts.get(status) ?? 0 })),
    };
  }),

  /** Subject-Officer-scoped equivalent of `overdueRelevantOfficers` — only letters they forwarded. */
  subjectOfficerOverdueRelevantOfficers: officerProcedure.handler(async ({ context }) => {
    const overdueAssignments = await findOverdueAssignments(context.db, context.session.user.id);
    return overdueAssignments.map((assignment) => ({
      id: assignment.id,
      assignedAt: assignment.createdAt,
      officer: { id: assignment.officer.id, name: assignment.officer.name },
      letter: {
        id: assignment.letter.id,
        referenceNumber: assignment.letter.referenceNumber,
        subject: assignment.letter.subject,
        fromWhom: assignment.letter.fromWhom,
        division: assignment.letter.division,
      },
    }));
  }),
};
