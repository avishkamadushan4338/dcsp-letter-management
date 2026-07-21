import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/src/db/schema.ts",
  out: "./server/src/db/migrations",
  dialect: "sqlite",
  verbose: true,
});
