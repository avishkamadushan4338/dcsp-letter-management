import { MysqlClient } from "@effect/sql-mysql2";
import { Config, Redacted } from "effect";

// Direct equivalent of server/config/db.js's mysql2 pool: same env vars,
// same connectionLimit, and `dateStrings: true` so DATETIME/DATE columns
// come back as MySQL-formatted strings (not JS Date objects) - the frontend
// parses them as strings (`new Date(String(value).replace(' ', 'T'))`).
export const SqlLive = MysqlClient.layerConfig({
  host: Config.string("DB_HOST").pipe(Config.withDefault("127.0.0.1")),
  port: Config.number("DB_PORT").pipe(Config.withDefault(3306)),
  username: Config.string("DB_USER").pipe(Config.withDefault("root")),
  password: Config.redacted("DB_PASSWORD").pipe(Config.withDefault(Redacted.make(""))),
  database: Config.string("DB_NAME").pipe(Config.withDefault("letter_management")),
  maxConnections: Config.succeed(10),
  poolConfig: Config.succeed({ dateStrings: true }),
});
