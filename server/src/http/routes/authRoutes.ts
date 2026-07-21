import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { AppConfig } from "../../config/AppConfig.ts";
import { UnauthorizedError } from "../../domain/errors.ts";
import * as SessionService from "../../services/SessionService.ts";

interface LoginBody {
  readonly username?: string;
  readonly password?: string;
}

// Direct port of server/middleware/auth.js#login / #logout.
export const authRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    "/api/auth/login",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as LoginBody;
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
      // Express's res.cookie() defaults path to "/"; @effect/platform does
      // not, so it must be explicit here or the cookie only applies under
      // /api/auth/ and every other route sees "not authenticated".
      return HttpServerResponse.unsafeSetCookie(response, SessionService.COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SessionService.SESSION_TTL_MS,
        path: "/",
      });
    })
  ),
  HttpRouter.post(
    "/api/auth/logout",
    Effect.gen(function* () {
      const response = yield* HttpServerResponse.json({ ok: true });
      return HttpServerResponse.expireCookie(response, SessionService.COOKIE_NAME, { path: "/" });
    })
  )
);
