import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpRouter, HttpServer } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as Config from "effect/Config";
import { Layer } from "effect";
import { AppConfigLive } from "./config/AppConfig.ts";
import { appRouter } from "./http/router.ts";
import { MailTransporterLive } from "./services/MailService.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const port = Config.unsafeFromOptionSync(
  Config.number("PORT").pipe(Config.withDefault(3000)),
);

const HttpLive = appRouter.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
  Layer.provide(MailTransporterLive),
  Layer.provide(AppConfigLive),
  Layer.provide(HttpRouter.setRouterConfig({ maxParamLength: 1024 }))
);

Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
