import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import type { Reassignment } from "../domain/types.js";

export interface CreateReassignmentInput {
  readonly letterId: number | string;
  readonly fromOfficerId: number | string | null;
  readonly toOfficerId: number | string;
  readonly note?: string | null;
}

export const create = ({ letterId, fromOfficerId, toOfficerId, note }: CreateReassignmentInput) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      INSERT INTO letter_reassignments (letter_id, from_officer_id, to_officer_id, note)
      VALUES (${letterId}, ${fromOfficerId}, ${toOfficerId}, ${note ?? null})
    `;
  });

export const findByLetterId = (letterId: number | string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<Reassignment>`
      SELECT
        r.id, r.reassigned_at, r.note,
        fo.name AS from_officer_name,
        to_o.name AS to_officer_name
      FROM letter_reassignments r
      JOIN officers fo ON fo.id = r.from_officer_id
      JOIN officers to_o ON to_o.id = r.to_officer_id
      WHERE r.letter_id = ${letterId}
      ORDER BY r.reassigned_at ASC
    `;
  });
