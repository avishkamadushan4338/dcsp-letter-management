import { SqlClient, SqlError } from "@effect/sql";
import { Effect } from "effect";
import { ValidationError } from "../domain/errors.js";
import type { Officer } from "../domain/types.js";

// officers.email is UNIQUE - surface that as a friendly 400 instead of the
// raw MySQL constraint error surfacing as an opaque 500 (mirrors
// friendlyDuplicateEmailError in the old models/Officer.js).
const withFriendlyDuplicateEmailError = <A>(effect: Effect.Effect<A, SqlError.SqlError, SqlClient.SqlClient>) =>
  effect.pipe(
    Effect.catchIf(
      (err): err is SqlError.SqlError =>
        err._tag === "SqlError" && (err.cause as { code?: string } | undefined)?.code === "ER_DUP_ENTRY",
      () => new ValidationError({ message: "An officer with this email already exists." })
    )
  );

export interface FindAllOptions {
  readonly division?: string | null;
  readonly activeOnly?: boolean;
}

export const findAll = ({ division, activeOnly = true }: FindAllOptions = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (activeOnly && division) {
      return yield* sql<Officer>`SELECT * FROM officers WHERE active = 1 AND division = ${division} ORDER BY name ASC`;
    }
    if (activeOnly) {
      return yield* sql<Officer>`SELECT * FROM officers WHERE active = 1 ORDER BY name ASC`;
    }
    if (division) {
      return yield* sql<Officer>`SELECT * FROM officers WHERE division = ${division} ORDER BY name ASC`;
    }
    return yield* sql<Officer>`SELECT * FROM officers ORDER BY name ASC`;
  });

export const findById = (id: number | string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<Officer>`SELECT * FROM officers WHERE id = ${id}`;
    return rows[0] ?? null;
  });

export interface CreateOfficerInput {
  readonly name: string;
  readonly email: string;
  readonly designation?: string | null;
  readonly division?: string | null;
}

export const create = ({ name, email, designation, division }: CreateOfficerInput) =>
  withFriendlyDuplicateEmailError(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // See LetterRepo.create for why LAST_INSERT_ID() inside a transaction
      // is needed instead of reading .insertId off the query result.
      const insertId = yield* sql.withTransaction(
        Effect.gen(function* () {
          yield* sql`INSERT INTO officers (name, email, designation, division) VALUES (${name}, ${email}, ${designation ?? null}, ${division ?? null})`;
          const rows = yield* sql<{ id: number }>`SELECT LAST_INSERT_ID() AS id`;
          return rows[0]!.id;
        })
      );
      return yield* findById(insertId);
    })
  );

export interface UpdateOfficerInput {
  readonly name: string;
  readonly email: string;
  readonly designation?: string | null;
  readonly division?: string | null;
  readonly active?: boolean | number;
}

export const update = (id: number | string, { name, email, designation, division, active }: UpdateOfficerInput) =>
  withFriendlyDuplicateEmailError(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE officers SET name = ${name}, email = ${email}, designation = ${designation ?? null}, division = ${division ?? null}, active = ${active ? 1 : 0} WHERE id = ${id}`;
      return yield* findById(id);
    })
  );

export const updateContact = (id: number | string, { name, email }: { name: string; email: string }) =>
  withFriendlyDuplicateEmailError(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE officers SET name = ${name}, email = ${email} WHERE id = ${id}`;
      return yield* findById(id);
    })
  );

// Soft delete: letters keep a foreign key to whichever officer handled them,
// so a removed officer is deactivated (hidden from rosters/dropdowns) rather
// than hard-deleted.
export const deactivate = (id: number | string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE officers SET active = 0 WHERE id = ${id}`;
  });
