import type { createDb } from "@dcsp-letter-management/db";
import { letter, letterRelevantOfficer } from "@dcsp-letter-management/db/schema/letters";
import { eq } from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

/**
 * Recomputes a letter's overall `status` from its independent Relevant
 * Officer assignments (APP_FLOW.md §2) — `with_relevant_officer` once any one
 * has received, `action_taken` only once *all* of them have recorded action.
 * Called after every per-assignment mutation (mark received / record action
 * / reassign).
 */
export async function recomputeLetterStatus(db: Db, letterId: string) {
  const assignments = await db.query.letterRelevantOfficer.findMany({
    where: eq(letterRelevantOfficer.letterId, letterId),
  });
  if (assignments.length === 0) {
    return;
  }

  const status = assignments.every((assignment) => assignment.actionTakenAt)
    ? "action_taken"
    : assignments.some((assignment) => assignment.receivedAt)
      ? "with_relevant_officer"
      : "sent_to_relevant";

  await db.update(letter).set({ status }).where(eq(letter.id, letterId));
}
