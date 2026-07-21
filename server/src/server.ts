import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Config from "effect/Config";
import { Effect, Layer } from "effect";
import { AppConfigLive } from "./config/AppConfig.ts";
import { appLayer } from "./http/router.ts";
import { MailTransporterLive } from "./services/MailService.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const program = Effect.gen(function* () {
  const httpEffect = yield* HttpRouter.toHttpEffect(
    appLayer.pipe(
      Layer.provide(MailTransporterLive),
      Layer.provide(AppConfigLive),
      Layer.provide(HttpRouter.cors({
        allowedOrigins: ["*"],
        allowedMethods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"],
      })),
    ),
  ).pipe(Effect.scoped);

  const serveLayer = HttpServer.serve(httpEffect).pipe(
    HttpServer.withLogAddress,
    Layer.provide(NodeHttpServer.layer(() => createServer(), { port:1337 })),
  );

  yield* Layer.launch(serveLayer);
});

program.pipe(NodeRuntime.runMain);
