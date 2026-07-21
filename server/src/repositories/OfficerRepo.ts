import { D1Client } from "@effect/sql-d1";
import { Effect } from "effect";
import { ValidationError } from "../domain/errors.ts";
import type { Officer } from "../domain/types.ts";

export interface FindAllOptions {
  readonly division?: string | null;
  readonly activeOnly?: boolean;
}

export const findAll = ({ division, activeOnly = true }: FindAllOptions = {}) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
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
    const sql = yield* D1Client.D1Client;
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
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    const rows = yield* sql<{ id: number }>`
      INSERT INTO officers (name, email, designation, division) VALUES (${name}, ${email}, ${designation ?? null}, ${division ?? null})
      RETURNING id
    `;
    return yield* findById(rows[0]!.id);
  });

export interface UpdateOfficerInput {
  readonly name: string;
  readonly email: string;
  readonly designation?: string | null;
  readonly division?: string | null;
  readonly active?: boolean | number;
}

export const update = (id: number | string, { name, email, designation, division, active }: UpdateOfficerInput) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`
      UPDATE officers SET name = ${name}, email = ${email}, designation = ${designation ?? null}, division = ${division ?? null}, active = ${active ? 1 : 0} WHERE id = ${id}
    `;
    return yield* findById(id);
  });

export const updateContact = (id: number | string, { name, email }: { name: string; email: string }) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`UPDATE officers SET name = ${name}, email = ${email} WHERE id = ${id}`;
    return yield* findById(id);
  });

export const deactivate = (id: number | string) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`UPDATE officers SET active = 0 WHERE id = ${id}`;
  });
