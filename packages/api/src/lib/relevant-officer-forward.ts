import type { createDb } from "@dcsp-letter-management/db";
import { letter, letterRelevantOfficer } from "@dcsp-letter-management/db/schema/letters";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import { issueLetterLink } from "./letter-links";

type Db = ReturnType<typeof createDb>;

/**
 * Re-send to one specific Relevant Officer track after
 * `returnLetterToSubjectOfficer` reset it — either the same officer (back
 * from being absent) or a newly reassigned one; mints just that one fresh
 * link, leaving every other officer's track on this letter untouched.
 */
export async function resendToRelevantOfficer(db: Db, letterId: string, letterRelevantOfficerId: string) {
  const found = await db.query.letter.findFirst({ where: eq(letter.id, letterId) });
  if (!found) {
    throw new ORPCError("NOT_FOUND");
  }
  if (!found.division) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }

  const assignment = await db.query.letterRelevantOfficer.findFirst({
    where: eq(letterRelevantOfficer.id, letterRelevantOfficerId),
    with: { officer: true },
  });
  if (!assignment || assignment.letterId !== letterId) {
    throw new ORPCError("NOT_FOUND");
  }
  if (assignment.receivedAt) {
    throw new ORPCError("CONFLICT", { message: "This officer has already received this letter." });
  }

  await issueLetterLink(db, {
    letterId: found.id,
    role: "relevantOfficer",
    to: assignment.officer.email,
    referenceNumber: found.referenceNumber,
    subject: found.subject,
    fromWhom: found.fromWhom,
    division: found.division,
    letterRelevantOfficerId: assignment.id,
  });
}
