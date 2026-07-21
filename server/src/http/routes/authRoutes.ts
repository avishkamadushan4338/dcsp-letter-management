import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import { Effect } from "effect";
import { AppConfig } from "../../config/AppConfig.ts";
import { UnauthorizedError } from "../../domain/errors.ts";
import * as SessionService from "../../services/SessionService.ts";

interface LoginBody {
  readonly username?: string;
  readonly password?: string;
}

export const authRoutesLayer = HttpRouter.use(() =>
  Effect.gen(function* () {
    yield* HttpRouter.add("POST", "/api/auth/login",
      Effect.gen(function* () {
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as LoginBody;
        const config = yield* AppConfig;

        const username = body.username ?? "";
        const password = body.password ?? "";
        const role = SessionService.resolveRole(username, password, config);
        if (!role) {
          return yield* new UnauthorizedError({ message: "Invalid username or password" });
        }

        const token = SessionService.sign(config.sessionSecret, {
          username,
          role,
          exp: Date.now() + SessionService.SESSION_TTL_MS,
        });

        const response = yield* HttpServerResponse.json({ ok: true, username, role });
        return HttpServerResponse.setCookieUnsafe(response, SessionService.COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: SessionService.SESSION_TTL_MS,
          path: "/",
        });
      })
    );

    yield* HttpRouter.add("POST", "/api/auth/logout",
      Effect.gen(function* () {
        const response = yield* HttpServerResponse.json({ ok: true });
        return HttpServerResponse.expireCookieUnsafe(response, SessionService.COOKIE_NAME, { path: "/" });
      })
    );
  })
);
