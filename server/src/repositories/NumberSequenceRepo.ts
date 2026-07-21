import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { numberSequence } from "../db/schema.ts";
import type { NumberSequenceRow } from "../domain/types.ts";

export const getForUpdate = (division: string, year: number) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: Array<{
      division: string;
      current_number: number;
      year: number;
      updated_at: string;
    }> = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(numberSequence)
        .where(eq(numberSequence.division, division))
    ) as any;
    if (rows.length === 0) {
      yield* Effect.tryPromise(() =>
        db
          .insert(numberSequence)
          .values({ division, current_number: 0, year })
      );
      return { division, current_number: 0, year } as NumberSequenceRow;
    }
    return rows[0] as unknown as NumberSequenceRow;
  });

export const update = (
  division: string,
  currentNumber: number,
  year: number
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(numberSequence)
        .set({ current_number: currentNumber, year })
        .where(eq(numberSequence.division, division))
    );
  });
