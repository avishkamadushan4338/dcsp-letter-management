import type { createDb } from "@dcsp-letter-management/db";
import { letterSequence } from "@dcsp-letter-management/db/schema/letters";
import {
  formatReferenceNumber,
  LETTER_NUMBER_MAX,
  type DivisionCode,
} from "@dcsp-letter-management/domain/division";
import { eq, sql } from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

const WRAPPED_NEXT = sql`(CASE WHEN ${letterSequence.lastNumber} >= ${LETTER_NUMBER_MAX} THEN 1 ELSE ${letterSequence.lastNumber} + 1 END)`;

/**
 * Atomically reserves and returns the next `{ number, referenceNumber }` for
 * a division, wrapping back to 1 after 99999 (APP_FLOW.md §3.1). Safe under
 * concurrent callers — the increment happens in a single upsert statement.
 */
export async function reserveNextLetterNumber(db: Db, division: DivisionCode) {
  const [row] = await db
    .insert(letterSequence)
    .values({ division, lastNumber: 1 })
    .onConflictDoUpdate({
      target: letterSequence.division,
      set: { lastNumber: WRAPPED_NEXT },
    })
    .returning({ lastNumber: letterSequence.lastNumber });

  const number = row?.lastNumber ?? 1;
  return { number, referenceNumber: formatReferenceNumber(division, number) };
}

/**
 * Read-only preview of what the next number *would* be, shown as soon as
 * the division is picked (APP_FLOW.md §3.1) without reserving it — the
 * actual atomic reservation happens on submit via `reserveNextLetterNumber`.
 * Under concurrent submissions for the same division the previewed number
 * can end up taken by someone else first; this app's usage volume makes
 * that an acceptable trade-off against the complexity of tracking
 * abandoned reservations.
 */
export async function previewNextLetterNumber(db: Db, division: DivisionCode) {
  const row = await db.query.letterSequence.findFirst({
    where: eq(letterSequence.division, division),
  });
  const number = row ? (row.lastNumber >= LETTER_NUMBER_MAX ? 1 : row.lastNumber + 1) : 1;
  return { number, referenceNumber: formatReferenceNumber(division, number) };
}
