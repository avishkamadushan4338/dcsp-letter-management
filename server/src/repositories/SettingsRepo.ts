import { D1Client } from "@effect/sql-d1";
import { Effect } from "effect";

export const get = (key: string) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    const rows = yield* sql<{ setting_value: string | null }>`
      SELECT setting_value FROM app_settings WHERE setting_key = ${key}
    `;
    return rows[0] ? rows[0].setting_value : null;
  });

export const set = (key: string, value: string | number) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    yield* sql`
      INSERT INTO app_settings (setting_key, setting_value) VALUES (${key}, ${value})
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `;
  });
