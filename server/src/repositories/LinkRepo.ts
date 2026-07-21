import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { links } from "../db/schema.ts";
import type { LinkOfficerRole, LinkRow } from "../domain/types.ts";

export const record = (
  letterId: number,
  role: LinkOfficerRole,
  token: string,
  expiresAt: Date
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db.insert(links).values({
        token,
        letter_id: letterId,
        officer_role: role,
        expires_at: expiresAt.toISOString(),
      })
    );
  });

export const findByTokenLetterRole = (
  token: string,
  letterId: number,
  role: LinkOfficerRole
) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: LinkRow[] = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(links)
        .where(
          and(
            eq(links.token, token),
            eq(links.letter_id, letterId),
            eq(links.officer_role, role)
          )
        )
    ) as any;
    return rows[0] ?? null;
  });

export const markUsed = (linkId: number) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(links)
        .set({ used_at: sql`datetime('now')` })
        .where(eq(links.id, linkId))
    );
  });

export const expireRelevantLinksForLetter = (letterId: number) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    yield* Effect.tryPromise(() =>
      db
        .update(links)
        .set({ expires_at: sql`datetime('now')` })
        .where(
          and(
            eq(links.letter_id, letterId),
            eq(links.officer_role, "relevant")
          )
        )
    );
  });
