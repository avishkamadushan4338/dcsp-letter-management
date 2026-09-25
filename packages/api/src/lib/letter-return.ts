import type { createDb } from "@dcsp-letter-management/db";
import { letter, letterLink, letterRelevantOfficer } from "@dcsp-letter-management/db/schema/letters";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { recomputeLetterStatus } from "./relevant-officer-status";

type Db = ReturnType<typeof createDb>;

/**
 * "The Relevant Officer was absent today" loop (APP_FLOW.md §5): the Subject
 * Officer pulls the letter back from one specific Relevant Officer's track —
 * when a letter has several, each is independent, so only the absent one's
 * progress resets (receivedAt/actionTakenAt/notes cleared, active link
 * invalidated); the others are untouched and keep progressing normally,
 * effectively "on hold" from this officer's perspective while the rest carry
 * on. The Subject Officer re-sends to just this officer once available (or
 * reassigns) via `resendToRelevantOfficer`, which can loop indefinitely.
 */
export async function returnLetterToSubjectOfficer(db: Db, letterId: string, letterRelevantOfficerId: string) {
  const found = await db.query.letter.findFirst({ where: eq(letter.id, letterId) });
  if (!found) {
    throw new ORPCError("NOT_FOUND");
  }
  if (found.status !== "sent_to_relevant" && found.status !== "with_relevant_officer") {
    throw new ORPCError("CONFLICT", { message: "This letter isn't with a Relevant Officer right now." });
  }

  const assignment = await db.query.letterRelevantOfficer.findFirst({
    where: and(eq(letterRelevantOfficer.id, letterRelevantOfficerId), eq(letterRelevantOfficer.letterId, letterId)),
  });
  if (!assignment) {
    throw new ORPCError("NOT_FOUND");
  }
  if (assignment.actionTakenAt) {
    throw new ORPCError("CONFLICT", { message: "This officer already recorded an action on this letter." });
  }

  await db
    .update(letterRelevantOfficer)
    .set({ receivedAt: null, actionTakenAt: null, actionNotes: null })
    .where(eq(letterRelevantOfficer.id, assignment.id));
  await db
    .update(letterLink)
    .set({ invalidatedAt: new Date() })
    .where(
      and(
        eq(letterLink.letterRelevantOfficerId, assignment.id),
        eq(letterLink.role, "relevantOfficer"),
        isNull(letterLink.invalidatedAt),
      ),
    );

  // The other officer(s) on this letter, if any, are untouched — the overall
  // status is recomputed from all of them so their progress still shows.
  await recomputeLetterStatus(db, letterId);

  const updated = await db.query.letter.findFirst({ where: eq(letter.id, letterId) });
  if (!updated) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return updated;
}
