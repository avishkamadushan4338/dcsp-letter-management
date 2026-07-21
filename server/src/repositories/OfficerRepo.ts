import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { officers } from "../db/schema.ts";
import { ValidationError } from "../domain/errors.ts";
import type { Officer } from "../domain/types.ts";

export interface FindAllOptions {
  readonly division?: string | null;
  readonly activeOnly?: boolean;
}

const mapOfficer = (row: {
  id: number;
  name: string;
  email: string;
  designation: string | null;
  division: string | null;
  active: boolean | number;
  created_at: string;
}): Officer => ({
  ...row,
  active: row.active ? 1 : 0,
});

export const findAll = ({
  division,
  activeOnly = true,
}: FindAllOptions = {}) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const conditions: Array<ReturnType<typeof and> | undefined> = [];
    if (activeOnly) conditions.push(eq(officers.active, true));
    if (division) conditions.push(eq(officers.division, division));
    const rows: Array<{
      id: number;
      name: string;
      email: string;
      designation: string | null;
      division: string | null;
      active: boolean;
      created_at: string;
    }> = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(officers)
        .where(and(...conditions))
        .orderBy(officers.name)
    ) as any;
    return rows.map(mapOfficer);
  });

export const findById = (id: number | string) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: Array<{
      id: number;
      name: string;
      email: string;
      designation: string | null;
      division: string | null;
      active: boolean;
      created_at: string;
    }> = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(officers)
        .where(eq(officers.id, Number(id)))
    ) as any;
    const row = rows[0];
    return row ? mapOfficer(row) : null;
  });

export interface CreateOfficerInput {
  readonly name: string;
  readonly email: string;
  readonly designation?: string | null;
  readonly division?: string | null;
}

export const create = ({
  name,
  email,
  designation,
  division,
}: CreateOfficerInput) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: Array<{
      id: number;
      name: string;
      email: string;
      designation: string | null;
      division: string | null;
      active: boolean;
      created_at: string;
    }> = yield* Effect.tryPromise(() =>
      db
        .insert(officers)
        .values({
          name,
          email,
          designation: designation ?? null,
          division: division ?? null,
        })
        .returning()
    ) as any;
    const row = rows[0];
    return row ? mapOfficer(row) : null;
  });

export interface UpdateOfficerInput {
  readonly name: string;
  readonly email: string;
  readonly designation?: string | null;
  readonly division?: string | null;
  readonly active?: boolean | number;
}

export const update = (
  id: number | string,
  { name, email, designation, division, active }: UpdateOfficerInput
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(officers)
        .set({
          name,
          email,
          designation: designation ?? null,
          division: division ?? null,
          active: active ? true : false,
        })
        .where(eq(officers.id, Number(id)))
    );
    return yield* findById(id);
  });

export const updateContact = (
  id: number | string,
  { name, email }: { name: string; email: string }
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(officers)
        .set({ name, email })
        .where(eq(officers.id, Number(id)))
    );
    return yield* findById(id);
  });

export const deactivate = (id: number | string) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(officers)
        .set({ active: false })
        .where(eq(officers.id, Number(id)))
    );
  });
