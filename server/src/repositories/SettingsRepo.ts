import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

// Tiny key/value store for singleton app configuration (currently just the
// permanent Subject Officer's officer id) - port of models/Settings.js.
export const get = (key: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ setting_value: string | null }>`
      SELECT setting_value FROM app_settings WHERE setting_key = ${key}
    `;
    return rows[0] ? rows[0].setting_value : null;
  });

export const set = (key: string, value: string | number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      INSERT INTO app_settings (setting_key, setting_value) VALUES (${key}, ${value})
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `;
  });
