import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpRouter, HttpServer } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import dotenv from "dotenv";
import { Layer } from "effect";
import { AppConfigLive } from "./config/AppConfig.js";
import { SqlLive } from "./db/SqlLive.js";
import { appRouter } from "./http/router.js";
import { MailTransporterLive } from "./services/MailService.js";

// One .env at the repo root (same file the old server/server.js read), not
// duplicated per-package - resolved by file location rather than cwd since
// `npm run <script> -w server` runs with cwd set to this package's own
// directory, not the repo root.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../.env") });

const port = Number(process.env.PORT) || 3000;

const HttpLive = appRouter.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
  Layer.provide(SqlLive),
  Layer.provide(MailTransporterLive),
  Layer.provide(AppConfigLive),
  // The router matcher's default maxParamLength (100) is shorter than our
  // signed link tokens (HMAC-SHA256 over a JSON payload, base64url-encoded -
  // routinely 110-140+ chars), which otherwise makes /api/links/:token
  // silently fail to match for any real token.
  Layer.provide(HttpRouter.setRouterConfig({ maxParamLength: 1024 }))
);

Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
