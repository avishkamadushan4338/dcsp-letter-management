import "dotenv/config";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
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

    if (process.env.PULL_REQUEST) {
      yield* GitHub.Comment("preview-comment", {
        owner: "avishkamadushan4338",
        repository: "dcsp-letter-management",
        issueNumber: Number(process.env.PULL_REQUEST),
        body: Output.interpolate`
          ## Preview Deployed

          **API URL:** ${apiResource.url}

          **Site URL:** ${siteResource.url}

          Built from commit ${process.env.GITHUB_SHA?.slice(0, 7)}

          ---
          _This comment updates automatically with each push._
        `,
      });
    }

    const dbResource = yield* db;
    return {
      databaseName: dbResource.databaseName,
      site: siteResource,
      api: apiResource,
    };
  }),
);
