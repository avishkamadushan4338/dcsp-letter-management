import "dotenv/config";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const isProd = process.env.NODE_ENV === "production";
const APP_URL = isProd
  ? "https://dcsplettermanagement-website-prod-fek6giu2sl7ds5i5.avishkamadushan4338.workers.dev"
  : "http://localhost:1338/";
const API_URL = isProd
  ? "https://dcsplettermanagement-api-prod-m2heskt5tt73l43m.avishkamadushan4338.workers.dev"
  : "http://localhost:1337/";

console.log(`NODE_ENV=${process.env.NODE_ENV} env=${isProd ? "production" : "development"} APP_URL=${APP_URL} API_URL=${API_URL}`);

const db = Cloudflare.D1.Database("Database", {
  migrationsDir: "./server/src/db/migrations",
  migrationsTable: "drizzle_migrations",
});

export default Alchemy.Stack(
  "DcspLetterManagement",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const api = Cloudflare.Worker("Api", {
      main: "./server/src/worker.ts",
      compatibility: { flags: ["nodejs_compat"] },
      env: {
        DB: db,
        APP_BASE_URL: APP_URL,
      },
    });
    const apiResource = yield* api;

    const siteResource = yield* Cloudflare.Website.Vite("Website", {
      rootDir: "./web",
      compatibility: { flags: ["nodejs_compat"] },
      env: {
        VITE_API_URL: API_URL,
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
