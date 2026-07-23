import { letter, letterLink, letterReassignment, letterRelevantOfficer, officer } from "@dcsp-letter-management/db/schema/letters";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure } from "../index";
import { newId } from "../lib/ids";
import { issueLetterLink } from "../lib/letter-links";
import { recomputeLetterStatus } from "../lib/relevant-officer-status";

const letterLinkWith = {
  letter: {
    with: { relevantOfficers: { with: { officer: true } }, subjectOfficer: true },
  },
  relevantOfficerAssignment: true,
} as const;

async function resolveActiveLink(db: Parameters<typeof issueLetterLink>[0], token: string, role: "subjectOfficer" | "relevantOfficer") {
  const link = await db.query.letterLink.findFirst({
    where: and(eq(letterLink.token, token), eq(letterLink.role, role), isNull(letterLink.invalidatedAt)),
    with: letterLinkWith,
  });
  if (!link) {
    throw new ORPCError("NOT_FOUND", { message: "This link is invalid, spent, or has expired." });
  }
  return link;
}

/** Only meaningful for role="relevantOfficer" links — the specific officer-track this link belongs to. */
function requireAssignment(link: Awaited<ReturnType<typeof resolveActiveLink>>) {
  if (!link.relevantOfficerAssignment) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return link.relevantOfficerAssignment;
}

async function invalidateLink(db: Parameters<typeof issueLetterLink>[0], linkId: string) {
  await db.update(letterLink).set({ invalidatedAt: new Date() }).where(eq(letterLink.id, linkId));
}

export const letterLinksRouter = {
  /** Loads whatever a link's own page needs to render (APP_FLOW.md §5). */
  get: publicProcedure.input(z.object({ token: z.string() })).handler(async ({ context, input }) => {
    const link = await context.db.query.letterLink.findFirst({
      where: eq(letterLink.token, input.token),
      with: letterLinkWith,
    });
    if (!link) {
      throw new ORPCError("NOT_FOUND");
    }
    return {
      role: link.role,
      invalidated: link.invalidatedAt !== null,
      letter: link.letter,
      // Only present for role="relevantOfficer" — this specific officer's own
      // progress, since each one now acts independently of the others.
      assignment: link.relevantOfficerAssignment
        ? {
            receivedAt: link.relevantOfficerAssignment.receivedAt,
            actionTakenAt: link.relevantOfficerAssignment.actionTakenAt,
            actionNotes: link.relevantOfficerAssignment.actionNotes,
          }
        : null,
    };
  }),

  subjectMarkReceived: publicProcedure.input(z.object({ token: z.string() })).handler(async ({ context, input }) => {
    const link = await resolveActiveLink(context.db, input.token, "subjectOfficer");
    if (link.letter.status !== "sent_to_subject") {
      throw new ORPCError("CONFLICT", { message: "This letter isn't waiting to be received." });
    }

    const [updated] = await context.db
      .update(letter)
      .set({ subjectReceivedAt: new Date(), status: "with_subject_officer" })
      .where(eq(letter.id, link.letterId))
      .returning();
    return updated;
  }),

  subjectForward: publicProcedure.input(z.object({ token: z.string() })).handler(async ({ context, input }) => {
    const link = await resolveActiveLink(context.db, input.token, "subjectOfficer");
    if (link.letter.status !== "with_subject_officer") {
      throw new ORPCError("CONFLICT", { message: "Mark it received before forwarding it." });
    }

    const [updated] = await context.db
      .update(letter)
      .set({ subjectForwardedAt: new Date(), status: "sent_to_relevant" })
      .where(eq(letter.id, link.letterId))
      .returning();

    // Spent — the Subject Officer has nothing further to do on this letter.
    await invalidateLink(context.db, link.id);

    return updated;
  }),

  relevantMarkReceived: publicProcedure.input(z.object({ token: z.string() })).handler(async ({ context, input }) => {
    const link = await resolveActiveLink(context.db, input.token, "relevantOfficer");
    const assignment = requireAssignment(link);
    // Gate on the Subject-Officer stage being done, not `letter.status` —
    // once one officer has received, the letter's overall status moves on
    // ahead of any of the others who haven't yet.
    if (!link.letter.subjectForwardedAt) {
      throw new ORPCError("CONFLICT", { message: "This letter isn't waiting to be received." });
    }
    if (assignment.receivedAt) {
      throw new ORPCError("CONFLICT", { message: "Already marked received." });
    }

    await context.db.update(letterRelevantOfficer).set({ receivedAt: new Date() }).where(eq(letterRelevantOfficer.id, assignment.id));
    await recomputeLetterStatus(context.db, link.letterId);

    const updated = await context.db.query.letter.findFirst({ where: eq(letter.id, link.letterId) });
    return updated;
  }),

  relevantRecordAction: publicProcedure
    .input(z.object({ token: z.string(), actionNotes: z.string().trim().min(1) }))
    .handler(async ({ context, input }) => {
      const link = await resolveActiveLink(context.db, input.token, "relevantOfficer");
      const assignment = requireAssignment(link);
      if (!assignment.receivedAt) {
        throw new ORPCError("CONFLICT", { message: "Mark it received before recording an action." });
      }
      if (assignment.actionTakenAt) {
        throw new ORPCError("CONFLICT", { message: "Action already recorded." });
      }

      await context.db
        .update(letterRelevantOfficer)
        .set({ actionNotes: input.actionNotes, actionTakenAt: new Date() })
        .where(eq(letterRelevantOfficer.id, assignment.id));

      // Spent — the normal end of this officer's part in the letter's life.
      await invalidateLink(context.db, link.id);
      await recomputeLetterStatus(context.db, link.letterId);

      const updated = await context.db.query.letter.findFirst({ where: eq(letter.id, link.letterId) });
      return updated;
    }),

  /** The "wrong person got this" escape hatch (APP_FLOW.md §5) — scoped to this one officer's own track. */
  relevantReassign: publicProcedure
    .input(z.object({ token: z.string(), toOfficerId: z.string(), note: z.string().trim().optional() }))
    .handler(async ({ context, input }) => {
      const link = await resolveActiveLink(context.db, input.token, "relevantOfficer");
      const assignment = requireAssignment(link);
      if (!assignment.receivedAt || assignment.actionTakenAt) {
        throw new ORPCError("CONFLICT", { message: "This letter can't be reassigned right now." });
      }

      const currentOfficerId = assignment.officerId;

      // division is always set by this point — with_relevant_officer only happens after a Relevant Officer was assigned.
      const toOfficer = await context.db.query.officer.findFirst({
        where: and(eq(officer.id, input.toOfficerId), eq(officer.division, link.letter.division!), eq(officer.active, true)),
      });
      if (!toOfficer) {
        throw new ORPCError("BAD_REQUEST", { message: "That officer isn't active in this division." });
      }

      // Can't reassign into someone who's already a separate track on this same letter.
      const alreadyAssigned = await context.db.query.letterRelevantOfficer.findFirst({
        where: and(
          eq(letterRelevantOfficer.letterId, link.letterId),
          eq(letterRelevantOfficer.officerId, toOfficer.id),
          ne(letterRelevantOfficer.id, assignment.id),
        ),
      });
      if (alreadyAssigned) {
        throw new ORPCError("BAD_REQUEST", { message: "That officer is already assigned to this letter separately." });
      }

      // 1-2. Invalidate the current officer's link — it's spent the moment they hand off.
      await invalidateLink(context.db, link.id);

      // 3. Log the handoff for both the new officer and DCS to see.
      await context.db.insert(letterReassignment).values({
        id: newId(),
        letterId: link.letterId,
        letterRelevantOfficerId: assignment.id,
        fromOfficerId: currentOfficerId,
        toOfficerId: toOfficer.id,
        note: input.note ?? null,
      });

      // 4. Update this officer-track — received timestamp clears, ready for the new officer.
      await context.db
        .update(letterRelevantOfficer)
        .set({ officerId: toOfficer.id, receivedAt: null, actionTakenAt: null, actionNotes: null })
        .where(eq(letterRelevantOfficer.id, assignment.id));
      await recomputeLetterStatus(context.db, link.letterId);

      const updated = await context.db.query.letter.findFirst({ where: eq(letter.id, link.letterId) });
      if (!updated) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      // 5. Mint and email a fresh link to the new officer, noting who reassigned it and why.
      const fromOfficer = await context.db.query.officer.findFirst({ where: eq(officer.id, currentOfficerId) });
      await issueLetterLink(context.db, {
        letterId: updated.id,
        role: "relevantOfficer",
        to: toOfficer.email,
        referenceNumber: updated.referenceNumber,
        subject: updated.subject,
        fromWhom: updated.fromWhom,
        division: toOfficer.division,
        letterRelevantOfficerId: assignment.id,
        reassignment: {
          fromOfficerName: fromOfficer?.name ?? "a previous officer",
          note: input.note ?? null,
        },
      });

      return updated;
    }),
};
