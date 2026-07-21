import { and, eq, like, or, desc, sql } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { letters, officers } from "../db/schema.ts";
import type { CreatedByRole, Letter, LetterStatus } from "../domain/types.ts";

const so = aliasedTable(officers, "subject_officer");
const ro = aliasedTable(officers, "relevant_officer");

interface LetterRow {
  id: number;
  letter_number: string;
  division: string;
  subject: string | null;
  sender_name: string | null;
  received_date: string | null;
  subject_officer_id: number | null;
  relevant_officer_id: number | null;
  created_by_role: string;
  status: string;
  subject_officer_received_at: string | null;
  sent_to_relevant_at: string | null;
  relevant_officer_received_at: string | null;
  action_taken_at: string | null;
  action_notes: string | null;
  created_at: string;
  updated_at: string;
  subject_officer_name: string | null;
  subject_officer_email: string | null;
  relevant_officer_name: string | null;
  relevant_officer_email: string | null;
}

const mapLetter = (row: LetterRow): Letter => ({
  id: row.id,
  letter_number: row.letter_number,
  division: row.division,
  subject: row.subject,
  sender_name: row.sender_name,
  received_date: row.received_date,
  subject_officer_id: row.subject_officer_id,
  relevant_officer_id: row.relevant_officer_id,
  created_by_role: row.created_by_role as CreatedByRole,
  status: row.status as LetterStatus,
  subject_officer_received_at: row.subject_officer_received_at,
  sent_to_relevant_at: row.sent_to_relevant_at,
  relevant_officer_received_at: row.relevant_officer_received_at,
  action_taken_at: row.action_taken_at,
  action_notes: row.action_notes,
  created_at: row.created_at,
  updated_at: row.updated_at,
  subject_officer_name: row.subject_officer_name,
  subject_officer_email: row.subject_officer_email,
  relevant_officer_name: row.relevant_officer_name,
  relevant_officer_email: row.relevant_officer_email,
});

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
    const db = yield* D1Db;
    const rows: Array<{ id: number }> = yield* Effect.tryPromise(() =>
      db
        .insert(letters)
        .values({
          letter_number: letterNumber,
          division,
          subject: subject ?? null,
          sender_name: senderName ?? null,
          received_date: receivedDate ?? null,
          subject_officer_id: subjectOfficerId
            ? Number(subjectOfficerId)
            : null,
          relevant_officer_id: relevantOfficerId
            ? Number(relevantOfficerId)
            : null,
          created_by_role: createdByRole,
          status,
          subject_officer_received_at:
            subjectOfficerReceivedAt?.toISOString() ?? null,
          sent_to_relevant_at: sentToRelevantAt?.toISOString() ?? null,
        })
        .returning({ id: letters.id })
    ) as any;
    return yield* findById(rows[0]!.id);
  });

export interface FindAllOptions {
  readonly status?: string | null;
  readonly division?: string | null;
  readonly search?: string | null;
}

export const findAll = ({
  status,
  division,
  search,
}: FindAllOptions = {}) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const conditions: Array<ReturnType<typeof and> | undefined> = [];
    if (status) conditions.push(eq(letters.status, status as LetterStatus));
    if (division) conditions.push(eq(letters.division, division));
    if (search) {
      conditions.push(
        or(
          like(letters.letter_number, `%${search}%`),
          like(letters.subject, `%${search}%`),
          like(letters.sender_name, `%${search}%`)
        )
      );
    }
    const rows: LetterRow[] = yield* Effect.tryPromise(() =>
      db
        .select({
          id: letters.id,
          letter_number: letters.letter_number,
          division: letters.division,
          subject: letters.subject,
          sender_name: letters.sender_name,
          received_date: letters.received_date,
          subject_officer_id: letters.subject_officer_id,
          relevant_officer_id: letters.relevant_officer_id,
          created_by_role: letters.created_by_role,
          status: letters.status,
          subject_officer_received_at:
            letters.subject_officer_received_at,
          sent_to_relevant_at: letters.sent_to_relevant_at,
          relevant_officer_received_at:
            letters.relevant_officer_received_at,
          action_taken_at: letters.action_taken_at,
          action_notes: letters.action_notes,
          created_at: letters.created_at,
          updated_at: letters.updated_at,
          subject_officer_name: so.name,
          subject_officer_email: so.email,
          relevant_officer_name: ro.name,
          relevant_officer_email: ro.email,
        })
        .from(letters)
        .leftJoin(so, eq(letters.subject_officer_id, so.id))
        .leftJoin(ro, eq(letters.relevant_officer_id, ro.id))
        .where(and(...conditions))
        .orderBy(desc(letters.created_at))
    ) as any;
    return rows.map(mapLetter);
  });

export const findById = (id: number | string) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: LetterRow[] = yield* Effect.tryPromise(() =>
      db
        .select({
          id: letters.id,
          letter_number: letters.letter_number,
          division: letters.division,
          subject: letters.subject,
          sender_name: letters.sender_name,
          received_date: letters.received_date,
          subject_officer_id: letters.subject_officer_id,
          relevant_officer_id: letters.relevant_officer_id,
          created_by_role: letters.created_by_role,
          status: letters.status,
          subject_officer_received_at:
            letters.subject_officer_received_at,
          sent_to_relevant_at: letters.sent_to_relevant_at,
          relevant_officer_received_at:
            letters.relevant_officer_received_at,
          action_taken_at: letters.action_taken_at,
          action_notes: letters.action_notes,
          created_at: letters.created_at,
          updated_at: letters.updated_at,
          subject_officer_name: so.name,
          subject_officer_email: so.email,
          relevant_officer_name: ro.name,
          relevant_officer_email: ro.email,
        })
        .from(letters)
        .leftJoin(so, eq(letters.subject_officer_id, so.id))
        .leftJoin(ro, eq(letters.relevant_officer_id, ro.id))
        .where(eq(letters.id, Number(id)))
    ) as any;
    const row = rows[0];
    return row ? mapLetter(row) : null;
  });

export const updateStatus = (
  id: number | string,
  fields: Record<string, unknown>
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const setParts = Object.keys(fields).map(
      (key) => sql`${sql.identifier(key)} = ${fields[key] as string | number | Date | boolean | null}`
    );
    const setClause = setParts.reduce(
      (acc, cur, i) => (i === 0 ? cur : sql`${acc}, ${cur}`)
    );
    yield* Effect.tryPromise(() =>
      db.run(sql`UPDATE ${letters} SET ${setClause} WHERE id = ${Number(id)}`)
    );
    return yield* findById(id);
  });
