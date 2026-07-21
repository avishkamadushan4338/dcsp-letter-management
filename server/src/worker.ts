import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Db } from "./db/D1Db.ts";
import { AppConfigLive } from "./config/AppConfig.ts";
import { MailTransporterLive } from "./services/MailService.ts";
import { apiLayer } from "./http/router.ts";

const HttpPlatformStub = Layer.succeed(HttpPlatform.HttpPlatform, {
  fileResponse: () => Effect.die("HttpPlatform.fileResponse not supported"),
  fileWebResponse: () =>
    Effect.die("HttpPlatform.fileWebResponse not supported"),
});

let cachedHandler: ((request: Request) => Promise<Response>) | undefined;

export default {
  fetch(request: Request, env: { DB: D1Database; PORT: number }) {
    if (!cachedHandler) {
      const d1Layer = D1Db.layer(env.DB);
      const mailLayer = MailTransporterLive.pipe(Layer.provide(AppConfigLive));
      const layer = d1Layer.pipe(
        Layer.merge(AppConfigLive),
        Layer.merge(mailLayer),
      );
      cachedHandler = Effect.runSync(
        Effect.gen(function* () {
          const httpEffect = yield* HttpRouter.toHttpEffect(
            apiLayer.pipe(
              Layer.provide(layer),
              Layer.provide([Etag.layer, HttpPlatformStub, Path.layer]),
            ),
          );
          return HttpEffect.toWebHandler(httpEffect);
        }).pipe(Effect.scoped),
      );
    }
    return cachedHandler(request);
  },
};
