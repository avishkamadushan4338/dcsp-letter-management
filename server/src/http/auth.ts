import { HttpServerRequest } from "@effect/platform";
import { Effect } from "effect";
import { AppConfig } from "../config/AppConfig.ts";
import { ForbiddenError, UnauthorizedError } from "../domain/errors.ts";
import * as SessionService from "../services/SessionService.ts";
import type { SessionRole } from "../domain/types.ts";

export const currentSession = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const config = yield* AppConfig;
  const session = SessionService.verify(config.sessionSecret, req.cookies[SessionService.COOKIE_NAME]);
  if (!session) {
    return yield* new UnauthorizedError({ message: "Not authenticated" });
  }
  return session;
});

// Direct port of middleware/auth.js#requireRole - applied per-route (Effect
// has no Express-style `router.use(...)` middleware chain for a route
// group), same effect as the original `router.use(requireAuth)`.
export const requireRole = (role: SessionRole) =>
  Effect.gen(function* () {
    const session = yield* currentSession;
    if (session.role !== role) {
      return yield* new ForbiddenError({ message: "Forbidden" });
    }
    return session;
  });

export const requireDcs = requireRole("dcs");
export const requireSubjectOfficer = requireRole("subject_officer");
