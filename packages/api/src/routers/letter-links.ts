import { letter, letterLink, letterReassignment, officer } from "@dcsp-letter-management/db/schema/letters";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure } from "../index";
import { newId } from "../lib/ids";
import { issueLetterLink } from "../lib/letter-links";

const letterLinkWith = {
  letter: {
    with: { relevantOfficer: true, subjectOfficer: true },
  },
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
    if (link.letter.status !== "sent_to_relevant") {
      throw new ORPCError("CONFLICT", { message: "This letter isn't waiting to be received." });
    }

    const [updated] = await context.db
      .update(letter)
      .set({ relevantReceivedAt: new Date(), status: "with_relevant_officer" })
      .where(eq(letter.id, link.letterId))
      .returning();
    return updated;
  }),

  relevantRecordAction: publicProcedure
    .input(z.object({ token: z.string(), actionNotes: z.string().trim().min(1) }))
    .handler(async ({ context, input }) => {
      const link = await resolveActiveLink(context.db, input.token, "relevantOfficer");
      if (link.letter.status !== "with_relevant_officer") {
        throw new ORPCError("CONFLICT", { message: "Mark it received before recording an action." });
      }

      const [updated] = await context.db
        .update(letter)
        .set({ actionNotes: input.actionNotes, actionTakenAt: new Date(), status: "action_taken" })
        .where(eq(letter.id, link.letterId))
        .returning();

      // Spent — the normal end of the letter's life for this officer.
      await invalidateLink(context.db, link.id);

      return updated;
    }),

  /** The "wrong person got this" escape hatch (APP_FLOW.md §5). */
  relevantReassign: publicProcedure
    .input(z.object({ token: z.string(), toOfficerId: z.string(), note: z.string().trim().optional() }))
    .handler(async ({ context, input }) => {
      const link = await resolveActiveLink(context.db, input.token, "relevantOfficer");
      if (link.letter.status !== "with_relevant_officer") {
        throw new ORPCError("CONFLICT", { message: "This letter can't be reassigned right now." });
      }

      const currentOfficerId = link.letter.relevantOfficerId;
      if (!currentOfficerId) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const toOfficer = await context.db.query.officer.findFirst({
        where: and(eq(officer.id, input.toOfficerId), eq(officer.division, link.letter.division), eq(officer.active, true)),
      });
      if (!toOfficer) {
        throw new ORPCError("BAD_REQUEST", { message: "That officer isn't active in this division." });
      }

      // 1-2. Invalidate the current officer's link — it's spent the moment they hand off.
      await invalidateLink(context.db, link.id);

      // 3. Log the handoff for both the new officer and DCS to see.
      await context.db.insert(letterReassignment).values({
        id: newId(),
        letterId: link.letterId,
        fromOfficerId: currentOfficerId,
        toOfficerId: toOfficer.id,
        note: input.note ?? null,
      });

      // 4. Update the letter — received timestamp clears, status goes back a step.
      const [updated] = await context.db
        .update(letter)
        .set({ relevantOfficerId: toOfficer.id, relevantReceivedAt: null, status: "sent_to_relevant" })
        .where(eq(letter.id, link.letterId))
        .returning();

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
        division: updated.division,
        reassignment: {
          fromOfficerName: fromOfficer?.name ?? "a previous officer",
          note: input.note ?? null,
        },
      });

      return updated;
    }),
};
