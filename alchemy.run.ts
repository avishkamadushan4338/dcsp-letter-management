import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const db = Cloudflare.D1.Database("Database", {
  migrationsDir: "./server/src/db/migrations",
  migrationsTable: "drizzle_migrations",
});

const api = Cloudflare.Worker("Api", {
  main: "./server/src/worker.ts",
  compatibility: { flags: ["nodejs_compat"] },
  env: {
    DB: db,
    PORT: Config.number("PORT").pipe(Config.withDefault(3000)),
  },
});

export default Alchemy.Stack(
  "DcspLetterManagement",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const apiResource = yield* api;

    const siteResource = yield* Cloudflare.Website.Vite("Website", {
      rootDir: "./web",
      compatibility: { flags: ["nodejs_compat"] },
      assets: { runWorkerFirst: true },
      env: {
        VITE_API_URL: apiResource.url.as<string>(),
      },
    });

    const dbResource = yield* db;
    return {
      databaseName: dbResource.databaseName,
      site: siteResource,
      api: apiResource,
    };
  }),
);
