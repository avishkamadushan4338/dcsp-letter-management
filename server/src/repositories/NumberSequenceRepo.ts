import { D1Client } from "@effect/sql-d1";
import { Effect } from "effect";
import type { NumberSequenceRow } from "../domain/types.ts";

export const getForUpdate = (division: string, year: number) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    const rows = yield* sql<NumberSequenceRow>`
      SELECT * FROM number_sequence WHERE division = ${division}
    `;
    if (rows.length === 0) {
      yield* sql`INSERT INTO number_sequence (division, current_number, year) VALUES (${division}, 0, ${year})`;
      return { division, current_number: 0, year };
    }
    return rows[0]!;
  });

export const update = (division: string, currentNumber: number, year: number) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`
      UPDATE number_sequence SET current_number = ${currentNumber}, year = ${year} WHERE division = ${division}
    `;
  });
