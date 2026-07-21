import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import type { CreatedByRole, Letter, LetterStatus } from "../domain/types.js";

const LIST_SELECT = `
  SELECT
    l.*,
    so.name  AS subject_officer_name,
    so.email AS subject_officer_email,
    ro.name  AS relevant_officer_name,
    ro.email AS relevant_officer_email
  FROM letters l
  LEFT JOIN officers so ON so.id = l.subject_officer_id
  LEFT JOIN officers ro ON ro.id = l.relevant_officer_id
`;

export interface CreateLetterInput {
  readonly letterNumber: string;
  readonly division: string;
  readonly subject?: string | null;
  readonly senderName?: string | null;
  readonly receivedDate?: string | null;
  readonly subjectOfficerId?: number | string | null;
  readonly relevantOfficerId?: number | string | null;
  readonly status?: LetterStatus;
  readonly createdByRole?: CreatedByRole;
  readonly subjectOfficerReceivedAt?: Date | null;
  readonly sentToRelevantAt?: Date | null;
}

export const create = ({
  letterNumber,
  division,
  subject,
  senderName,
  receivedDate,
  subjectOfficerId,
  relevantOfficerId,
  status = "created",
  createdByRole = "dcs",
  subjectOfficerReceivedAt = null,
  sentToRelevantAt = null,
}: CreateLetterInput) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // INSERT's ResultSetHeader (which carries insertId) isn't array-shaped,
    // so @effect/sql-mysql2's row-mapping normalizes it away to `[]` - the
    // reliable way to recover the id is LAST_INSERT_ID() on the same pooled
    // connection, which withTransaction pins for both statements.
    const insertId = yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`
          INSERT INTO letters
            (letter_number, division, subject, sender_name, received_date,
             subject_officer_id, relevant_officer_id, created_by_role,
             status, subject_officer_received_at, sent_to_relevant_at)
          VALUES (${letterNumber}, ${division}, ${subject ?? null}, ${senderName ?? null}, ${receivedDate ?? null},
                  ${subjectOfficerId ?? null}, ${relevantOfficerId ?? null}, ${createdByRole},
                  ${status}, ${subjectOfficerReceivedAt}, ${sentToRelevantAt})
        `;
        const rows = yield* sql<{ id: number }>`SELECT LAST_INSERT_ID() AS id`;
        return rows[0]!.id;
      })
    );
    return yield* findById(insertId);
  });

export interface FindAllOptions {
  readonly status?: string | null;
  readonly division?: string | null;
  readonly search?: string | null;
}

export const findAll = ({ status, division, search }: FindAllOptions = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const clauses: Array<string> = [];
    const params: Array<unknown> = [];

    if (status) {
      clauses.push("l.status = ?");
      params.push(status);
    }
    if (division) {
      clauses.push("l.division = ?");
      params.push(division);
    }
    if (search) {
      clauses.push("(l.letter_number LIKE ? OR l.subject LIKE ? OR l.sender_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return yield* sql.unsafe<Letter>(`${LIST_SELECT} ${where} ORDER BY l.created_at DESC`, params);
  });

export const findById = (id: number | string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe<Letter>(`${LIST_SELECT} WHERE l.id = ?`, [id]);
    return rows[0] ?? null;
  });

// Generic partial-update, mirroring models/Letter.js#updateStatus - callers
// pass exactly the column/value pairs they want to change.
export const updateStatus = (id: number | string, fields: Record<string, unknown>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const columns = Object.keys(fields);
    if (columns.length === 0) return yield* findById(id);

    const setClause = columns.map((c) => `${c} = ?`).join(", ");
    const params = columns.map((c) => fields[c]);
    params.push(id);

    yield* sql.unsafe(`UPDATE letters SET ${setClause} WHERE id = ?`, params);
    return yield* findById(id);
  });
