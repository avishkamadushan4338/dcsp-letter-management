import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import type { NumberSequenceRow } from "../domain/types.js";

// Row-level access to `number_sequence`. Always called from within the
// `sql.withTransaction` that NumberService owns - @effect/sql-mysql2 pins
// every query inside that transaction to the same connection automatically,
// so (unlike the old mysql2/promise version) there's no explicit `conn` to
// thread through.
export const getForUpdate = (division: string, year: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<NumberSequenceRow>`
      SELECT * FROM number_sequence WHERE division = ${division} FOR UPDATE
    `;
    if (rows.length === 0) {
      yield* sql`INSERT INTO number_sequence (division, current_number, year) VALUES (${division}, 0, ${year})`;
      return { division, current_number: 0, year };
    }
    return rows[0]!;
  });

export const update = (division: string, currentNumber: number, year: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      UPDATE number_sequence SET current_number = ${currentNumber}, year = ${year} WHERE division = ${division}
    `;
  });
