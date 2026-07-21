import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { D1Db } from "../db/D1Db.ts";
import { appSettings } from "../db/schema.ts";

export const get = (key: string) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const rows: Array<{ setting_value: string | null }> = yield* Effect.tryPromise(() =>
      db
        .select({ setting_value: appSettings.setting_value })
        .from(appSettings)
        .where(eq(appSettings.setting_key, key))
    ) as any;
    return rows[0]?.setting_value ?? null;
  });

export const set = (key: string, value: string | number) =>
  Effect.gen(function* () {
    const db = yield* D1Db;
    const strValue = String(value);
    yield* Effect.tryPromise(() =>
      db
        .insert(appSettings)
        .values({ setting_key: key, setting_value: strValue })
        .onConflictDoUpdate({
          target: appSettings.setting_key,
          set: { setting_value: sql`excluded.setting_value` },
        })
    );
  });
