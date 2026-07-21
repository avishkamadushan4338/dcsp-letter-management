import { eq } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { letterReassignments, officers } from "../db/schema.ts";
import type { Reassignment } from "../domain/types.ts";

export interface CreateReassignmentInput {
  readonly letterId: number | string;
  readonly fromOfficerId: number | string | null;
  readonly toOfficerId: number | string;
  readonly note?: string | null;
}

export const create = ({
  letterId,
  fromOfficerId,
  toOfficerId,
  note,
}: CreateReassignmentInput) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db.insert(letterReassignments).values({
        letter_id: Number(letterId),
        from_officer_id: Number(fromOfficerId),
        to_officer_id: Number(toOfficerId),
        note: note ?? null,
      })
    );
  });

export const findByLetterId = (letterId: number | string) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const fo = aliasedTable(officers, "from_officer");
    const to = aliasedTable(officers, "to_officer");
    const rows: Array<{
      id: number;
      reassigned_at: string;
      note: string | null;
      from_officer_name: string | null;
      to_officer_name: string | null;
    }> = yield* Effect.tryPromise(() =>
      db
        .select({
          id: letterReassignments.id,
          reassigned_at: letterReassignments.reassigned_at,
          note: letterReassignments.note,
          from_officer_name: fo.name,
          to_officer_name: to.name,
        })
        .from(letterReassignments)
        .leftJoin(fo, eq(letterReassignments.from_officer_id, fo.id))
        .leftJoin(to, eq(letterReassignments.to_officer_id, to.id))
        .where(eq(letterReassignments.letter_id, Number(letterId)))
        .orderBy(letterReassignments.reassigned_at)
    ) as any;
    return rows as unknown as Reassignment[];
  });
