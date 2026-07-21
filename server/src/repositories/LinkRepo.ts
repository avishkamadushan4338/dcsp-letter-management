import { D1Client } from "@effect/sql-d1";
import { Effect } from "effect";
import type { LinkOfficerRole, LinkRow } from "../domain/types.ts";

export const record = (letterId: number, role: LinkOfficerRole, token: string, expiresAt: Date) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`
      INSERT INTO links (token, letter_id, officer_role, expires_at) VALUES (${token}, ${letterId}, ${role}, ${expiresAt})
    `;
  });

export const findByTokenLetterRole = (token: string, letterId: number, role: LinkOfficerRole) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    const rows = yield* sql<LinkRow>`
      SELECT * FROM links WHERE token = ${token} AND letter_id = ${letterId} AND officer_role = ${role}
    `;
    return rows[0] ?? null;
  });

export const markUsed = (linkId: number) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`UPDATE links SET used_at = datetime('now') WHERE id = ${linkId}`;
  });

export const expireRelevantLinksForLetter = (letterId: number) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`UPDATE links SET expires_at = datetime('now') WHERE letter_id = ${letterId} AND officer_role = 'relevant'`;
  });
