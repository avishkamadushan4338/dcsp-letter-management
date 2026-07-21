import { D1Client } from "@effect/sql-d1";
import { HttpApp, HttpRouter } from "@effect/platform";
import { Effect, Layer } from "effect";
import type { D1Database } from "@cloudflare/workers-types";
import { AppConfigLive } from "./config/AppConfig.ts";
import { MailTransporterLive } from "./services/MailService.ts";
import { apiRouter } from "./http/router.ts";

const app = Effect.runSync(HttpRouter.toHttpApp(apiRouter));

let cachedHandler: (request: Request) => Promise<Response> | undefined;

export default {
  fetch(request: Request, env: { DB: D1Database; PORT: number }) {
    if (!cachedHandler) {
      const d1Layer = D1Client.layer({ db: env.DB });
      const mailLayer = MailTransporterLive.pipe(Layer.provide(AppConfigLive));
      const layer = d1Layer.pipe(
        Layer.merge(AppConfigLive),
        Layer.merge(mailLayer),
      );
      cachedHandler = HttpApp.toWebHandlerLayer(app, layer).handler;
    }
    return cachedHandler(request);
  },
};
