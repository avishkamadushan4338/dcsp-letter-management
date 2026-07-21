import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import type { LinkOfficerRole, LinkRow } from "../domain/types.js";

export const record = (letterId: number, role: LinkOfficerRole, token: string, expiresAt: Date) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      INSERT INTO links (token, letter_id, officer_role, expires_at) VALUES (${token}, ${letterId}, ${role}, ${expiresAt})
    `;
  });

export const findByTokenLetterRole = (token: string, letterId: number, role: LinkOfficerRole) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<LinkRow>`
      SELECT * FROM links WHERE token = ${token} AND letter_id = ${letterId} AND officer_role = ${role}
    `;
    return rows[0] ?? null;
  });

export const markUsed = (linkId: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE links SET used_at = NOW() WHERE id = ${linkId}`;
  });

// Reassignment expires every relevant-officer link issued so far for the
// letter (including the caller's own) - see links.routes.js POST /:token/reassign.
export const expireRelevantLinksForLetter = (letterId: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE links SET expires_at = NOW() WHERE letter_id = ${letterId} AND officer_role = 'relevant'`;
  });
