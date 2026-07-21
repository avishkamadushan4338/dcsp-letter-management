import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import * as NumberSequenceRepo from "../repositories/NumberSequenceRepo.js";

export const MAX_NUMBER = 99999;

// DCSP/{division}/{NNNNN} - e.g. DCSP/02/12345. Not year-scoped: the wrap
// below is the only reset, so this format never changes shape. Direct port
// of server/services/numberService.js.
export const format = (division: string, seq: number): string =>
  `DCSP/${division}/${String(seq).padStart(5, "0")}`;

// Atomically issues the next number for a division inside a transaction -
// @effect/sql-mysql2's sql.withTransaction is the direct replacement for the
// old mysql2/promise connection.beginTransaction()/commit()/rollback(), and
// pins every query inside it (including the FOR UPDATE read) to one
// connection automatically. Wraps back to 00000 once the sequence exceeds
// MAX_NUMBER (99999).
export const issueNext = (division: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        const currentYear = new Date().getFullYear();
        const row = yield* NumberSequenceRepo.getForUpdate(division, currentYear);

        let nextNumber = row.current_number + 1;
        if (nextNumber > MAX_NUMBER) {
          nextNumber = 0;
        }

        yield* NumberSequenceRepo.update(division, nextNumber, currentYear);
        return format(division, nextNumber);
      })
    );
  });

export const issueBatch = (division: string, count: number) =>
  Effect.gen(function* () {
    const numbers: Array<string> = [];
    for (let i = 0; i < count; i += 1) {
      numbers.push(yield* issueNext(division));
    }
    return numbers;
  });
